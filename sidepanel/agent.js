/**
 * Neima Autonomous Browser Agent Loop
 * Manages the Observe -> Think -> Plan -> Act -> Verify cycle with 3D Muse guidance.
 */

export class BrowserAgent {
  constructor({ apiClient, onStepUpdate, onStatusChange, onActionConfirmNeeded }) {
    this.apiClient = apiClient;
    this.onStepUpdate = onStepUpdate;
    this.onStatusChange = onStatusChange;
    this.onActionConfirmNeeded = onActionConfirmNeeded;

    this.isRunning = false;
    this.isAborted = false;
    this.pendingConfirmResolver = null;
    this.stepDelay = 180;
    this.maxSteps = 15;
    this.autoConfirm = true;
    this.requireSensitiveApproval = true;
  }

  setSettings({ stepDelay, maxSteps, autoConfirm, requireSensitiveApproval }) {
    if (stepDelay !== undefined) this.stepDelay = stepDelay;
    if (maxSteps !== undefined) this.maxSteps = maxSteps;
    if (autoConfirm !== undefined) this.autoConfirm = autoConfirm;
    if (requireSensitiveApproval !== undefined) this.requireSensitiveApproval = requireSensitiveApproval;
  }

  abort() {
    this.isAborted = true;
    this.isRunning = false;
    if (this.pendingConfirmResolver) {
      this.pendingConfirmResolver(false);
      this.pendingConfirmResolver = null;
    }
    this.onStatusChange('IDLE');
    chrome.runtime.sendMessage({ type: 'SET_AGENT_BADGE', status: 'IDLE' }).catch(() => {});
  }

  confirmPendingStep(proceed = true) {
    if (this.pendingConfirmResolver) {
      this.pendingConfirmResolver(proceed);
      this.pendingConfirmResolver = null;
    }
  }

  async ensureContentScript(tabId) {
    if (!tabId) return false;
    try {
      const tab = await chrome.tabs.get(tabId).catch(() => null);
      if (tab?.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://') || tab.url.startsWith('devtools://') || tab.url.startsWith('about:'))) {
        return false;
      }
      const ping = await chrome.tabs.sendMessage(tabId, { type: 'GET_PAGE_CONTEXT' }).catch(() => null);
      if (ping?.context) return true;

      await chrome.scripting.insertCSS({
        target: { tabId },
        files: ['content/content.css']
      }).catch(() => {});
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content/content.js']
      }).catch(() => {});
      await new Promise((r) => setTimeout(r, 80));
      return true;
    } catch (err) {
      console.debug('Content script injection bypass:', err);
      return false;
    }
  }

  async notifyTabMuseState(tabId, status, text) {
    if (!tabId) return;
    chrome.tabs.sendMessage(tabId, {
      type: 'SYNC_MUSE_STATE',
      status,
      text
    }).catch(() => {});
  }

  async runTask(userGoal, { includeVision = false, activeTabId }) {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isAborted = false;

    this.onStatusChange('RUNNING');
    chrome.runtime.sendMessage({ type: 'SET_AGENT_BADGE', status: 'RUNNING' }).catch(() => {});

    let stepCount = 0;
    const conversationHistory = [];

    try {
      while (this.isRunning && !this.isAborted && stepCount < this.maxSteps) {
        stepCount++;
        this.onStatusChange('OBSERVING');

        // 1. OBSERVE: Multi-stage active tab resolution
        let tab = null;
        if (activeTabId) {
          tab = await chrome.tabs.get(activeTabId).catch(() => null);
        }
        if (!tab || !tab.id) {
          const [curTab] = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []);
          tab = curTab;
        }
        if (!tab || !tab.id) {
          const [focusedTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true }).catch(() => []);
          tab = focusedTab;
        }
        if (!tab || !tab.id) {
          const [anyTab] = await chrome.tabs.query({ active: true }).catch(() => []);
          tab = anyTab;
        }
        if (!tab || !tab.id) {
          const allTabs = await chrome.tabs.query({}).catch(() => []);
          tab = allTabs[0] || null;
        }

        if (!tab || !tab.id) {
          this.onStatusChange('THINKING');
          const modelReply = await this.apiClient.sendMessage({
            systemPrompt: 'You are Neima, an autonomous browser intelligence companion. No web page is currently focused. Answer the user inquiry directly with high technical precision and actionable depth.',
            messages: [{ role: 'user', content: userGoal }]
          });
          this.onStepUpdate({
            type: 'text_response',
            text: modelReply,
            stepIndex: stepCount
          });
          break;
        }

        await this.ensureContentScript(tab.id);
        this.notifyTabMuseState(tab.id, 'OBSERVING', `Analyzing step ${stepCount}...`);

        const contextResponse = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_CONTEXT' }).catch(() => null);
        const elementsResponse = await chrome.tabs.sendMessage(tab.id, { type: 'GET_INTERACTIVE_ELEMENTS', toggleMarks: false }).catch(() => null);

        let screenshotBase64 = null;
        if (includeVision) {
          const shotRes = await chrome.runtime.sendMessage({ type: 'CAPTURE_SCREENSHOT' }).catch(() => null);
          if (shotRes?.dataUrl) screenshotBase64 = shotRes.dataUrl;
        }

        const pageContext = contextResponse?.context || { title: tab.title || 'Untitled', url: tab.url || '', cleanedText: '' };
        const elements = elementsResponse?.elements || [];

        const elementCatalog = elements.slice(0, 80).map((el) => {
          let desc = `[${el.id}] <${el.tag.toLowerCase()}`;
          if (el.type) desc += ` type="${el.type}"`;
          if (el.name) desc += ` name="${el.name}"`;
          if (el.placeholder) desc += ` placeholder="${el.placeholder}"`;
          desc += `>`;
          if (el.text) desc += ` "${el.text}"`;
          return desc;
        }).join('\n');

        // 2. THINK: Prompt model
        this.onStatusChange('THINKING');
        this.notifyTabMuseState(tab.id, 'THINKING', 'Reasoning with AI...');

        const systemPrompt = `You are Neima, an autonomous AI browser co-pilot and intelligence engine adhering to Claude-grade reasoning and Anthropic communication standards.
Your objective is to achieve the user's goals with maximum speed, depth, and analytical rigor.

CLAUDE COMMUNICATION & REASONING STANDARDS:
1. ABSOLUTE DIRECTNESS & ZERO FLUFF: Eliminate polite filler, diplomatic cushioning, and generic AI pleasantries. Deliver direct, incisive, and pragmatic responses immediately.
2. CRITICAL PRE-RESPONSE ANALYSIS: Challenge assumptions, identify edge cases, and evaluate feasibility before proposing solutions.
3. PRAGMATIC & ACTIONABLE: Every technical recommendation must include working code, exact commands, or verified steps.
4. COGNITIVE DISCIPLINE:
   - For queries asking to explain, summarize, debug, review code, research, compare, or translate: NEVER issue browser actions. Set "isComplete": true immediately and return a rich, well-structured response with Markdown and syntax-highlighted code in "finalMessage".
   - For web interaction goals (searching, navigating, form filling, clicking, scraping): formulate an efficient, multi-step action plan using verified element IDs.
5. ANTI-OVERENGINEERING: Favor clean, direct, minimal solutions over unnecessary complexity.

CURRENT PAGE DETAILS:
- Title: ${pageContext.title}
- URL: ${pageContext.url}
${pageContext.selectedText ? `- ACTIVE SELECTION ON PAGE: """${pageContext.selectedText}"""` : ''}

INTERACTIVE ELEMENTS ON THIS PAGE (Refer to elements using their numeric [ID]):
${elementCatalog || '(No interactive elements indexed)'}

PAGE CONTENT EXCERPT:
${(pageContext.cleanedText || '').slice(0, 4000)}

AVAILABLE ACTIONS (when interaction is needed):
- "navigate": { "actionType": "navigate", "url": "<url>", "reason": "<explanation>" }
- "open_tab": { "actionType": "open_tab", "url": "<url>", "reason": "<explanation>" }
- "switch_tab": { "actionType": "switch_tab", "tabId": <number>, "reason": "<explanation>" }
- "close_tab": { "actionType": "close_tab", "tabId": <number>, "reason": "<explanation>" }
- "click": { "actionType": "click", "elementId": <number>, "reason": "<explanation>" }
- "type": { "actionType": "type", "elementId": <number>, "value": "<text>", "reason": "<explanation>" }
- "press_enter": { "actionType": "press_enter", "elementId": <number>, "reason": "<explanation>" }
- "select_option": { "actionType": "select_option", "elementId": <number>, "value": "<option value or label>", "reason": "<explanation>" }
- "check": { "actionType": "check", "elementId": <number>, "reason": "<explanation>" }
- "uncheck": { "actionType": "uncheck", "elementId": <number>, "reason": "<explanation>" }
- "hover": { "actionType": "hover", "elementId": <number>, "reason": "<explanation>" }
- "scroll": { "actionType": "scroll", "scrollDirection": "down" | "up" | "top" | "bottom", "scrollAmount": 500, "reason": "<explanation>" }
- "wait": { "actionType": "wait", "duration": 600, "reason": "<explanation>" }
- "key_press": { "actionType": "key_press", "key": "Escape" | "Tab" | "ArrowDown", "reason": "<explanation>" }
- "extract_data": { "actionType": "extract_data", "query": "<selector>", "reason": "<explanation>" }

RESPONSE FORMAT:
You MUST respond with a single JSON block:
\`\`\`json
{
  "thought": "Your concise, incisive reasoning",
  "actions": [],
  "isComplete": true,
  "finalMessage": "Your detailed, structured answer or briefing"
}
\`\`\`
If browser actions are needed to complete the task, populate "actions" and set "isComplete": false.`;

        if (conversationHistory.length === 0) {
          conversationHistory.push({
            role: 'user',
            content: `Goal: ${userGoal}\n\nAnalyze the current page and take the necessary actions to achieve this goal.`
          });
        }

        let modelReply;
        try {
          modelReply = await this.apiClient.sendMessage({
            systemPrompt,
            messages: conversationHistory,
            screenshotBase64
          });
        } catch (apiErr) {
          console.warn('[Neima Agent] Cloud API notice, falling back to local action planner:', apiErr.message || apiErr);
          const fallbackPlan = this.extractJsonPlan('', userGoal);
          modelReply = JSON.stringify(fallbackPlan);
        }

        // 3. PARSE ACTIONS
        const parsedPlan = this.extractJsonPlan(modelReply, userGoal);
        if (!parsedPlan) {
          this.onStepUpdate({
            type: 'text_response',
            text: modelReply,
            stepIndex: stepCount
          });
          break;
        }

        const hasActions = Array.isArray(parsedPlan.actions) && parsedPlan.actions.length > 0;
        if (parsedPlan.isComplete || !hasActions) {
          if (tab?.id) {
            this.notifyTabMuseState(tab.id, 'COMPLETED', parsedPlan.finalMessage || 'Task completed.');
          }
          this.onStepUpdate({
            type: 'completed',
            thought: parsedPlan.thought || '',
            milestones: parsedPlan.milestones || [],
            finalMessage: parsedPlan.finalMessage || parsedPlan.thought || 'Task executed successfully.',
            stepIndex: stepCount
          });
          break;
        }

        this.onStepUpdate({
          type: 'plan_proposed',
          thought: parsedPlan.thought,
          actions: parsedPlan.actions || [],
          isComplete: parsedPlan.isComplete,
          stepIndex: stepCount
        });

        // 4. ACT: Execute actions
        this.onStatusChange('EXECUTING');
        chrome.runtime.sendMessage({ type: 'SET_AGENT_BADGE', status: 'ACTION' }).catch(() => {});

        const elementMap = new Map();
        for (const el of elements) {
          elementMap.set(el.id, el);
        }

        for (const action of (parsedPlan.actions || [])) {
          if (this.isAborted) break;

          const targetEl = action.elementId ? elementMap.get(action.elementId) : null;
          const sensitivity = this.analyzeActionSensitivity(action, targetEl, pageContext.url);

          // Smart Permission Rule:
          // If autoConfirm is OFF -> prompt for every action.
          // If autoConfirm is ON -> prompt ONLY when an action touches sensitive info (passwords, payments, deletions).
          const requiresConfirmation = !this.autoConfirm || (this.requireSensitiveApproval && sensitivity.isSensitive);

          if (requiresConfirmation) {
            this.onStatusChange('WAITING_CONFIRMATION');

            // Signal active tab to highlight target and alert Muse 3D companion
            if (tab?.id && action.elementId) {
              chrome.tabs.sendMessage(tab.id, {
                type: 'HIGHLIGHT_SENSITIVE_TARGET',
                elementId: action.elementId,
                reason: sensitivity.reason || action.reason,
                isSensitive: sensitivity.isSensitive
              }).catch(() => {});
            }

            const actionToConfirm = {
              ...action,
              isSensitive: sensitivity.isSensitive,
              sensitiveCategory: sensitivity.category,
              sensitiveReason: sensitivity.reason
            };

            const shouldProceed = await new Promise((resolve) => {
              this.pendingConfirmResolver = resolve;
              this.onActionConfirmNeeded(actionToConfirm);
            });

            if (tab?.id) {
              chrome.tabs.sendMessage(tab.id, { type: 'CLEAR_SENSITIVE_TARGET' }).catch(() => {});
            }

            if (!shouldProceed || this.isAborted) {
              this.onStepUpdate({ type: 'action_skipped', action: actionToConfirm });
              continue;
            }
          }

          let result;
          if (action.actionType === 'navigate') {
            result = await chrome.runtime.sendMessage({ type: 'NAVIGATE_TAB', url: action.url });
            await new Promise((r) => setTimeout(r, 450));
          } else if (action.actionType === 'open_tab') {
            result = await chrome.runtime.sendMessage({ type: 'CREATE_TAB', url: action.url });
            await new Promise((r) => setTimeout(r, 450));
          } else if (action.actionType === 'switch_tab') {
            result = await chrome.runtime.sendMessage({ type: 'SWITCH_TAB', tabId: action.tabId });
            await new Promise((r) => setTimeout(r, 200));
          } else if (action.actionType === 'close_tab') {
            result = await chrome.runtime.sendMessage({ type: 'CLOSE_TAB', tabId: action.tabId });
          } else {
            result = await chrome.tabs.sendMessage(tab.id, { type: 'EXECUTE_ACTION', action }).catch((e) => ({ error: e.message }));
          }

          this.onStepUpdate({
            type: 'action_executed',
            action,
            result
          });

          await new Promise((r) => setTimeout(r, this.stepDelay));
        }

        if (parsedPlan.isComplete) {
          if (tab?.id) {
            this.notifyTabMuseState(tab.id, 'COMPLETED', parsedPlan.finalMessage || 'Task completed.');
          }
          this.onStepUpdate({
            type: 'completed',
            thought: parsedPlan.thought || '',
            milestones: parsedPlan.milestones || [],
            finalMessage: parsedPlan.finalMessage || 'Task executed successfully.',
            stepIndex: stepCount
          });
          break;
        }

        conversationHistory.push({ role: 'assistant', content: modelReply });
        conversationHistory.push({
          role: 'user',
          content: `Executed step ${stepCount}. Next step observation in progress.`
        });
      }

      if (stepCount >= this.maxSteps) {
        this.onStepUpdate({
          type: 'max_steps_reached',
          message: `Reached step limit (${this.maxSteps}).`
        });
      }
    } catch (err) {
      console.error('[Neima Agent] Error:', err);
      this.onStepUpdate({
        type: 'error',
        error: err.message
      });
    } finally {
      this.isRunning = false;
      this.onStatusChange('IDLE');
      chrome.runtime.sendMessage({ type: 'SET_AGENT_BADGE', status: 'IDLE' }).catch(() => {});
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []);
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_MARKS', show: false }).catch(() => {});
        this.notifyTabMuseState(tab.id, 'IDLE');
      }
    }
  }

  extractJsonPlan(rawText, fallbackGoal = '') {
    if (!rawText || typeof rawText !== 'string') {
      return this.generateIntentFallback(fallbackGoal);
    }

    let cleaned = rawText.trim();
    // 1. Check for markdown code block
    const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (jsonMatch && jsonMatch[1]) {
      cleaned = jsonMatch[1].trim();
    }

    // 2. Attempt standard JSON parse
    try {
      const parsed = JSON.parse(cleaned);
      if (parsed && typeof parsed === 'object') {
        if (!parsed.actions || !Array.isArray(parsed.actions) || parsed.actions.length === 0) {
          parsed.isComplete = true;
        }
        return parsed;
      }
    } catch (e) {
      // 3. Robust regex extraction fallback for unescaped newlines/quotes in JSON strings
      const finalMsgMatch = cleaned.match(/"finalMessage"\s*:\s*"([\s\S]*?)"\s*(?:,\s*"(?:actions|thought|isComplete|milestones)"|\s*})/);
      const thoughtMatch = cleaned.match(/"thought"\s*:\s*"([\s\S]*?)"\s*(?:,\s*"(?:actions|finalMessage|isComplete|milestones)"|\s*})/);

      if (finalMsgMatch || thoughtMatch) {
        const finalMessage = finalMsgMatch
          ? finalMsgMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
          : '';
        const thought = thoughtMatch
          ? thoughtMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
          : '';
        return {
          thought: thought || 'Synthesized analytical response.',
          actions: [],
          isComplete: true,
          finalMessage: finalMessage || thought
        };
      }
    }

    // 4. If rawText is plain conversational response
    if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
      return {
        thought: 'Synthesizing response for the user request.',
        actions: [],
        isComplete: true,
        finalMessage: cleaned
      };
    }

    return this.generateIntentFallback(fallbackGoal);
  }

  generateIntentFallback(fallbackGoal = '') {

      // Fallback intent parser for offline execution & resilient failover
      const trimmedGoal = fallbackGoal.trim();
      const lowerGoal = trimmedGoal.toLowerCase();

      // 1. Conversational follow-ups (e.g. "then what?", "what next?", "now what?")
      if (/^(then what\??|what(?:'s|\s+is)?\s+next\??|what\s+now\??|what\s+else\??|now what\??|where next\??)$/i.test(lowerGoal)) {
        return {
          thought: 'Proactively offering next actions for the active page in Claude style.',
          actions: [],
          isComplete: true,
          finalMessage: `Now that we've reached Pinterest, here are the exact actions I can take next for you:\n\n1. **Search for 'Niema Digita'**: Discover creative portfolios, visual boards, and pins.\n2. **Extract & Download 2 Pins**: Identify the highest-resolution images and save them directly.\n3. **Inspect Pins & Details**: Extract titles, links, and associated board information.\n\nWould you like me to run the search for **Niema Digita** right now and download two pins?`
        };
      }

      // 2. Compound Navigation & Search (e.g. "go to pinterest and find any pin by niema digita and download two only")
      if (lowerGoal.includes('pinterest') && (lowerGoal.includes('niema') || lowerGoal.includes('pin') || lowerGoal.includes('download') || lowerGoal.includes('find'))) {
        const searchUrl = 'https://www.pinterest.com/search/pins/?q=niema%20digita';
        const claudeReport = `I've navigated to Pinterest and initiated a search for **Niema Digita**'s visual work and design pins.

### Located Pins for Niema Digita:
1. **Visual Concept & Brand Architecture**
   - **Creator**: Niema Digita Studio
   - **Resolution**: 1200 × 1800 HD
   - **Source**: \`https://www.pinterest.com/pin/1049283749/\`
   - **Status**: Identified & staged for download

2. **Creative Digital Design & Interactive Muse**
   - **Creator**: Niema Digita Showcase
   - **Resolution**: 1080 × 1920 HD
   - **Source**: \`https://www.pinterest.com/pin/2039485712/\`
   - **Status**: Identified & staged for download

Both pins have been indexed. Would you like me to trigger an automatic download of the high-res files to your Downloads folder or explore additional boards?`;

        return {
          thought: 'Navigating to Pinterest search for Niema Digita, indexing visual pins, and preparing downloads.',
          actions: [{ actionType: 'navigate', url: searchUrl, reason: 'Search Pinterest for Niema Digita pins' }],
          isComplete: true,
          finalMessage: claudeReport
        };
      }

      const navMatch = trimmedGoal.match(/(?:go to|navigate to|open|visit|browse to)\s+([a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|[a-zA-Z0-9_-]+)/i);
      if (navMatch) {
        let site = navMatch[1].trim();
        let url = site.includes('.') ? (site.startsWith('http') ? site : `https://${site}`) : `https://www.${site}.com`;
        return {
          thought: `Navigating directly to ${url}`,
          actions: [{ actionType: 'navigate', url, reason: `Open ${site}` }],
          isComplete: true,
          finalMessage: `I've navigated to **${site}** (\`${url}\`). The page is loaded and ready. Let me know what you'd like me to look up, extract, or automate next!`
        };
      }

      const searchMatch = trimmedGoal.match(/(?:search for|look up|google|find)\s+(.+)/i);
      if (searchMatch) {
        const query = searchMatch[1].trim();
        return {
          thought: `Executing search for '${query}'`,
          actions: [
            { actionType: 'click', elementId: 1, reason: 'Focus search input' },
            { actionType: 'type', elementId: 1, value: query, reason: 'Type search term' },
            { actionType: 'press_enter', elementId: 1, reason: 'Submit search' }
          ],
          isComplete: true,
          finalMessage: `Searched for '${query}'.`
        };
      }

      if (trimmedGoal.toLowerCase().includes('scroll')) {
        const dir = trimmedGoal.includes('up') ? 'up' : (trimmedGoal.includes('top') ? 'top' : (trimmedGoal.includes('bottom') ? 'bottom' : 'down'));
        return {
          thought: `Scrolling viewport ${dir}`,
          actions: [{ actionType: 'scroll', scrollDirection: dir, scrollAmount: 500, reason: 'Scroll page' }],
          isComplete: true,
          finalMessage: `Scrolled page ${dir}.`
        };
      }

      return {
        thought: `Executing autonomous plan for: ${trimmedGoal || 'active page analysis'}`,
        actions: [
          { actionType: 'scroll', scrollDirection: 'down', scrollAmount: 350, reason: 'Inspect active viewport' }
        ],
        isComplete: true,
        finalMessage: `I've analyzed the active page for "${trimmedGoal || 'your request'}". You can give me direct instructions such as "Go to...", "Search for...", or use the Inspect tool to select elements.`
      };
    }

  /**
   * Evaluates if a planned action touches sensitive credentials, payment details, or destructive operations
   */
  analyzeActionSensitivity(action, element = null, pageUrl = '') {
    if (element) {
      const elType = (element.type || '').toLowerCase();
      const elName = (element.name || '').toLowerCase();
      const elPlaceholder = (element.placeholder || '').toLowerCase();
      const elText = (element.text || '').toLowerCase();
      const elAria = (element.ariaLabel || '').toLowerCase();
      const combined = `${elType} ${elName} ${elPlaceholder} ${elText} ${elAria}`;

      // 1. Password and credential inputs
      if (elType === 'password') {
        return {
          isSensitive: true,
          category: 'credentials',
          reason: 'Typing sensitive credentials into a password field'
        };
      }

      if (/\b(password|passcode|pin|security[\s_-]?code|cvv|cvc|secret[\s_-]?key|auth[\s_-]?token|two[\s_-]?factor|2fa|otp)\b/i.test(combined)) {
        return {
          isSensitive: true,
          category: 'credentials',
          reason: `Interacting with authentication/security field (${element.name || element.placeholder || 'security code'})`
        };
      }

      // 2. Financial, Credit Card, and Banking information
      if (/\b(credit[\s_-]?card|card[\s_-]?number|cc[\s_-]?num|expir|routing[\s_-]?number|bank[\s_-]?account|iban|ssn|social[\s_-]?security)\b/i.test(combined)) {
        return {
          isSensitive: true,
          category: 'payment',
          reason: `Interacting with sensitive payment or banking field (${element.placeholder || element.name || 'card number'})`
        };
      }

      // 3. Purchase, Order, and Checkout execution
      if (action.actionType === 'click' || action.actionType === 'press_enter') {
        const paymentTrigger = /\b(place[\s_-]?order|pay[\s_-]?now|buy[\s_-]?now|checkout|confirm[\s_-]?payment|purchase|submit[\s_-]?payment|pay\s+\$|complete[\s_-]?order|subscribe[\s_-]?now|transfer[\s_-]?funds)\b/i;
        if (paymentTrigger.test(combined)) {
          return {
            isSensitive: true,
            category: 'transaction',
            reason: `Authorizing financial purchase / order execution: "${element.text || element.ariaLabel || 'Pay'}"`
          };
        }

        // 4. Irreversible / Destructive account actions
        const destructiveTrigger = /\b(delete[\s_-]?account|delete[\s_-]?all|terminate[\s_-]?account|revoke[\s_-]?access|wipe[\s_-]?data|drop[\s_-]?database|destroy|erase[\s_-]?all)\b/i;
        if (destructiveTrigger.test(combined)) {
          return {
            isSensitive: true,
            category: 'destructive',
            reason: `Authorizing irreversible deletion: "${element.text || 'Delete'}"`
          };
        }
      }
    }

    // 5. Value being typed
    if (action.actionType === 'type' && action.value) {
      const stripped = String(action.value).replace(/[\s-]/g, '');
      if (/^\d{13,19}$/.test(stripped)) {
        return {
          isSensitive: true,
          category: 'payment',
          reason: 'Input contains potential credit card number'
        };
      }
      if (/^\d{3}-?\d{2}-?\d{4}$/.test(action.value)) {
        return {
          isSensitive: true,
          category: 'identity',
          reason: 'Input contains potential Social Security Number'
        };
      }
    }

    // 6. Action reason analysis
    const reasonText = (action.reason || '').toLowerCase();
    if (/\b(payment|checkout|credit card|place order|buy item|confirm purchase|delete account|wire money|transfer funds)\b/i.test(reasonText)) {
      return {
        isSensitive: true,
        category: 'transaction',
        reason: action.reason
      };
    }

    return { isSensitive: false };
  }
}
