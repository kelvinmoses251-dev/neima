/**
 * Neima Sidepanel Main Controller
 * Coordinates agent loops, tab metadata, clean model selection, and quick actions.
 */

import { UnifiedApiClient } from './api.js';
import { BrowserAgent } from './agent.js';

let activeTab = null;
let apiClient = null;
let agent = null;
let currentSettings = {};
let taskQueue = [];
let activeSelectionText = '';
let attachedFiles = [];

async function initApp() {
  try {
    await initSettings();
  } catch (err) {
    console.error('[Neima] Error in initSettings:', err);
  }

  try {
    initAgent();
  } catch (err) {
    console.error('[Neima] Error in initAgent:', err);
  }

  try {
    initUIEventListeners();
  } catch (err) {
    console.error('[Neima] Error in initUIEventListeners:', err);
  }

  try {
    await initTabTracking();
  } catch (err) {
    console.error('[Neima] Error in initTabTracking:', err);
  }

  try {
    initMessageListener();
  } catch (err) {
    console.error('[Neima] Error in initMessageListener:', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

/**
 * Load settings and initialize API Client
 */
async function initSettings() {
  const defaults = {
    selectedModel: 'freellmapi-auto',
    freellmapiKey: 'freellmapi-1f4e138cd1bbee9085b68e36fd735b3785a51ab786a76b42',
    freellmapiUrl: 'http://localhost:3001/v1',
    anthropicKey: '',
    geminiKey: '',
    openaiKey: '',
    ollamaUrl: 'http://localhost:11434',
    autoConfirm: true,
    requireSensitiveApproval: true,
    stepDelay: 700,
    maxSteps: 15,
    userProfile: {
      fullName: 'Alex Morgan',
      email: 'alex.morgan@example.com',
      company: 'TechFlow Dynamics'
    }
  };

  const stored = await chrome.storage.local.get(null);
  currentSettings = { ...defaults, ...stored };

  // Supported models (FreeLLMAPI, Gemini 3.8 Flash, Argon 4, Gemini 2.5, Claude, GPT, Local)
  const validModels = [
    'freellmapi-auto',
    'freellmapi-deepseek',
    'freellmapi-gemini',
    'freellmapi-llama',
    'gemini-3.8-flash',
    'argon-4',
    'gemini-2.5-pro',
    'gemini-2.0-flash',
    'gemini-1.5-pro',
    'claude-3-7-sonnet',
    'claude-3-5-sonnet',
    'claude-3-5-haiku',
    'gpt-4o',
    'gpt-4o-mini',
    'simulation',
    'ollama'
  ];

  const hasGemini = !!currentSettings.geminiKey;
  const hasAnthropic = !!currentSettings.anthropicKey;
  const hasOpenai = !!currentSettings.openaiKey;

  // Preserve user selection or choose best default
  if (!currentSettings.selectedModel || !validModels.includes(currentSettings.selectedModel)) {
    if (hasGemini) {
      currentSettings.selectedModel = 'gemini-3.8-flash';
    } else if (hasAnthropic) {
      currentSettings.selectedModel = 'claude-3-7-sonnet';
    } else if (hasOpenai) {
      currentSettings.selectedModel = 'gpt-4o';
    } else {
      currentSettings.selectedModel = 'gemini-3.8-flash';
    }
  } else {
    // If selected model is from an unkeyed provider, switch to Gemini if key exists
    const provider = getProviderForModel(currentSettings.selectedModel);
    if (provider === 'anthropic' && !hasAnthropic && hasGemini) {
      currentSettings.selectedModel = 'gemini-3.8-flash';
    } else if (provider === 'openai' && !hasOpenai && hasGemini) {
      currentSettings.selectedModel = 'gemini-3.8-flash';
    }
  }

  await chrome.storage.local.set({ selectedModel: currentSettings.selectedModel });

  const modelSelector = document.getElementById('modelSelector');
  if (modelSelector && currentSettings.selectedModel) {
    modelSelector.value = currentSettings.selectedModel;
  }

  const autoExecToggle = document.getElementById('autoExecuteToggle');
  if (autoExecToggle) {
    autoExecToggle.checked = currentSettings.autoConfirm !== undefined ? !!currentSettings.autoConfirm : true;
  }

  const provider = getProviderForModel(currentSettings.selectedModel);
  const apiKey = getApiKeyForProvider(provider, currentSettings);

  apiClient = new UnifiedApiClient({
    provider,
    model: currentSettings.selectedModel,
    apiKey,
    ollamaUrl: currentSettings.ollamaUrl,
    freellmapiUrl: currentSettings.freellmapiUrl
  });

  updateStatusBadge(provider, apiKey);
}

function updateStatusBadge(provider, apiKey) {
  const badge = document.getElementById('statusBadge');
  const badgeDot = document.getElementById('statusBadgeDot');

  if (apiKey) {
    if (badge) {
      badge.innerText = provider === 'freellmapi' ? 'FreeLLMAPI' : 'Connected';
      badge.style.color = '#34d399';
    }
    if (badgeDot) {
      badgeDot.style.background = '#10b981';
      badgeDot.style.boxShadow = '0 0 6px #10b981';
      badgeDot.title = provider === 'freellmapi' ? 'FreeLLMAPI Router Active (34+ Free Providers)' : `${provider} connected and ready`;
    }
  } else if (provider === 'simulation') {
    if (badge) {
      badge.innerText = 'Local Engine';
      badge.style.color = '#a1a1aa';
    }
    if (badgeDot) {
      badgeDot.style.background = '#38bdf8';
      badgeDot.style.boxShadow = '0 0 6px #38bdf8';
      badgeDot.title = 'Running autonomous local engine (offline)';
    }
  } else if (provider === 'ollama') {
    if (badge) {
      badge.innerText = 'Local Ollama';
      badge.style.color = '#93c5fd';
    }
    if (badgeDot) {
      badgeDot.style.background = '#93c5fd';
      badgeDot.style.boxShadow = '0 0 6px #93c5fd';
      badgeDot.title = 'Local Ollama connected';
    }
  } else {
    if (badge) {
      badge.innerText = 'Key Missing';
      badge.style.color = '#fbbf24';
    }
    if (badgeDot) {
      badgeDot.style.background = '#fbbf24';
      badgeDot.style.boxShadow = '0 0 6px #fbbf24';
      badgeDot.title = `Missing ${provider} API key. Click to open Settings.`;
      badgeDot.onclick = () => chrome.runtime.openOptionsPage();
    }
  }
}

function getProviderForModel(modelName) {
  if (!modelName) return 'freellmapi';
  if (modelName === 'simulation') return 'simulation';
  if (modelName === 'ollama') return 'ollama';
  if (modelName.startsWith('freellmapi')) return 'freellmapi';
  if (modelName.startsWith('claude')) return 'anthropic';
  if (modelName.startsWith('gemini') || modelName.includes('argon')) return 'gemini';
  if (modelName.startsWith('gpt')) return 'openai';
  return 'freellmapi';
}

function getApiKeyForProvider(provider, settings) {
  switch (provider) {
    case 'freellmapi': return settings.freellmapiKey || 'freellmapi-1f4e138cd1bbee9085b68e36fd735b3785a51ab786a76b42';
    case 'anthropic': return settings.anthropicKey || '';
    case 'gemini': return settings.geminiKey || '';
    case 'openai': return settings.openaiKey || '';
    default: return '';
  }
}

/**
 * Initialize Browser Agent Engine
 */
function initAgent() {
  agent = new BrowserAgent({
    apiClient,
    onStatusChange: (status) => updateAgentStatus(status),
    onStepUpdate: (update) => handleAgentStepUpdate(update),
    onActionConfirmNeeded: (action) => showApprovalCard(action)
  });

  agent.setSettings({
    stepDelay: currentSettings.stepDelay || 180,
    maxSteps: currentSettings.maxSteps || 15,
    autoConfirm: currentSettings.autoConfirm !== undefined ? !!currentSettings.autoConfirm : true,
    requireSensitiveApproval: currentSettings.requireSensitiveApproval !== undefined ? !!currentSettings.requireSensitiveApproval : true
  });
}

/**
 * Connect to Active Tab and listen for URL changes
 */
async function initTabTracking() {
  try {
    if (chrome.tabs?.query) {
      const [cur] = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []);
      if (cur) {
        updateActiveTabUI(cur);
        return;
      }
      const [focused] = await chrome.tabs.query({ active: true, lastFocusedWindow: true }).catch(() => []);
      if (focused) {
        updateActiveTabUI(focused);
        return;
      }
    }
    const res = await chrome.runtime.sendMessage({ type: 'GET_ACTIVE_TAB' });
    if (res?.tab) {
      updateActiveTabUI(res.tab);
    }
  } catch (err) {
    console.debug('Error getting active tab:', err);
  }
}

function updateActiveTabUI(tab) {
  activeTab = tab;
  const urlEl = document.getElementById('tabUrl');
  const favEl = document.getElementById('tabFavicon');

  if (urlEl) {
    try {
      urlEl.innerText = tab.url ? new URL(tab.url).hostname : 'about:blank';
    } catch {
      urlEl.innerText = tab.url || 'about:blank';
    }
  }

  if (favEl) {
    favEl.src = tab.favIconUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%233b82f6"><circle cx="12" cy="12" r="10"/></svg>';
  }

  if (tab?.id) {
    syncCompanionVisibilityWithTab(tab.id);
  }
}

async function syncCompanionVisibilityWithTab(tabId) {
  if (!tabId || !agent) return;
  const toggle = document.getElementById('toggleCompanionBtn');
  const visible = toggle ? toggle.checked : true;
  await agent.ensureContentScript(tabId);
  chrome.tabs.sendMessage(tabId, {
    type: 'SET_COMPANION_VISIBILITY',
    visible
  }).catch(() => {});
}

/**
 * Attach UI Event Listeners
 */
function initUIEventListeners() {
  const modelSelector = document.getElementById('modelSelector');
  modelSelector?.addEventListener('change', async (e) => {
    const model = e.target.value;
    const fresh = await chrome.storage.local.get(null);
    currentSettings = { ...currentSettings, ...fresh, selectedModel: model };
    const provider = getProviderForModel(model);
    const apiKey = getApiKeyForProvider(provider, currentSettings);

    await chrome.storage.local.set({ selectedModel: model });
    apiClient.updateConfig({ model, provider, apiKey });
    updateStatusBadge(provider, apiKey);
  });

  document.getElementById('openOptionsBtn')?.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  document.getElementById('brandAvatar')?.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  const toggleCompanionBtn = document.getElementById('toggleCompanionBtn');
  if (toggleCompanionBtn) {
    toggleCompanionBtn.addEventListener('change', async (e) => {
      if (activeTab?.id) {
        await agent.ensureContentScript(activeTab.id);
        await chrome.tabs.sendMessage(activeTab.id, {
          type: 'SET_COMPANION_VISIBILITY',
          visible: e.target.checked
        }).catch(() => {});
      }
    });
  }

  const promptInput = document.getElementById('promptInput');
  const sendBtn = document.getElementById('sendPromptBtn');
  const queuePromptBtn = document.getElementById('queuePromptBtn');
  const stopBtn = document.getElementById('stopAgentBtn');
  const clearQueueBtn = document.getElementById('clearQueueBtn');

  if (clearQueueBtn) {
    clearQueueBtn.addEventListener('click', () => {
      taskQueue = [];
      updateQueueTrayUI();
    });
  }

  // Quick Tools Popover
  const toolsMenuBtn = document.getElementById('toolsMenuBtn');
  const toolsPopover = document.getElementById('toolsPopover');

  if (toolsMenuBtn && toolsPopover) {
    toolsMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toolsPopover.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
      if (!toolsPopover.contains(e.target) && !toolsMenuBtn.contains(e.target)) {
        toolsPopover.classList.add('hidden');
      }
    });

    document.getElementById('popSummarize')?.addEventListener('click', () => {
      toolsPopover.classList.add('hidden');
      promptInput.value = 'Summarize this page with key takeaways, insights and conclusions.';
      handleSendPrompt();
    });

    document.getElementById('popInspect')?.addEventListener('click', async () => {
      toolsPopover.classList.add('hidden');
      if (activeTab?.id) {
        await agent.ensureContentScript(activeTab.id);
        await chrome.tabs.sendMessage(activeTab.id, { type: 'START_INSPECTOR' }).catch(() => {});
      }
    });

    document.getElementById('popExtract')?.addEventListener('click', () => {
      toolsPopover.classList.add('hidden');
      handleExtractTables();
    });

    document.getElementById('popAutofill')?.addEventListener('click', () => {
      toolsPopover.classList.add('hidden');
      handleAutofill();
    });

    document.getElementById('popRecord')?.addEventListener('click', () => {
      toolsPopover.classList.add('hidden');
      toggleWorkflowRecording();
    });

    document.getElementById('popWorkflows')?.addEventListener('click', () => {
      toolsPopover.classList.add('hidden');
      openWorkflowsLibraryModal();
    });

    document.getElementById('popSchedule')?.addEventListener('click', () => {
      toolsPopover.classList.add('hidden');
      openScheduledShortcutsModal();
    });

    document.getElementById('popMultiTabs')?.addEventListener('click', () => {
      toolsPopover.classList.add('hidden');
      openMultiTabsModal();
    });

    document.getElementById('popConsole')?.addEventListener('click', () => {
      toolsPopover.classList.add('hidden');
      handleDebugLogs();
    });
  }

  // Header Quick Icons (Claude in Chrome parity)
  document.getElementById('scheduleShortcutsBtn')?.addEventListener('click', () => openScheduledShortcutsModal());
  document.getElementById('workflowsLibraryBtn')?.addEventListener('click', () => openWorkflowsLibraryModal());
  document.getElementById('recordWorkflowBtn')?.addEventListener('click', () => toggleWorkflowRecording());
  document.getElementById('cancelRecordBtn')?.addEventListener('click', () => cancelWorkflowRecording());
  document.getElementById('stopRecordBtn')?.addEventListener('click', () => finishAndSaveWorkflowRecording());

  // File Attachments (Claude-parity)
  const attachFileBtn = document.getElementById('attachFileBtn');
  const fileInput = document.getElementById('fileAttachmentInput');

  if (attachFileBtn && fileInput) {
    attachFileBtn.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      for (const file of files) {
        if (file.type.startsWith('image/')) {
          const base64 = await readFileAsBase64(file);
          attachedFiles.push({ name: file.name, type: 'image', data: base64, size: file.size });
        } else {
          const text = await readFileAsText(file);
          attachedFiles.push({ name: file.name, type: 'text', data: text, size: file.size });
        }
      }
      fileInput.value = '';
      updateAttachmentTrayUI();
    });
  }

  // Smart Selection Floating Bar Actions
  document.getElementById('selExplainBtn')?.addEventListener('click', () => {
    if (!activeSelectionText) return;
    executePromptText(`Explain this selected code or text in detail with key insights:\n\n\`\`\`\n${activeSelectionText}\n\`\`\``);
    hideSelectionBar();
  });

  document.getElementById('selRefactorBtn')?.addEventListener('click', () => {
    if (!activeSelectionText) return;
    executePromptText(`Review and refactor/improve this code or text with production best practices and explain changes:\n\n\`\`\`\n${activeSelectionText}\n\`\`\``);
    hideSelectionBar();
  });

  document.getElementById('selSummarizeBtn')?.addEventListener('click', () => {
    if (!activeSelectionText) return;
    executePromptText(`Summarize the key points of this selection:\n\n${activeSelectionText}`);
    hideSelectionBar();
  });

  document.getElementById('selDismissBtn')?.addEventListener('click', () => {
    hideSelectionBar();
  });

  promptInput?.addEventListener('input', () => {
    promptInput.style.height = 'auto';
    promptInput.style.height = Math.min(promptInput.scrollHeight, 100) + 'px';
    promptInput.style.overflowY = promptInput.scrollHeight > 100 ? 'auto' : 'hidden';

    // Fast Slash Command trigger (Claude parity)
    if (promptInput.value.trim() === '/' && toolsPopover) {
      toolsPopover.classList.remove('hidden');
    }
  });

  promptInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendPrompt();
    }
  });

  sendBtn?.addEventListener('click', handleSendPrompt);

  if (queuePromptBtn) {
    queuePromptBtn.addEventListener('click', () => {
      const userText = promptInput ? promptInput.value.trim() : '';
      if (!userText) return;
      if (promptInput) {
        promptInput.value = '';
        promptInput.style.height = 'auto';
      }
      enqueueTask(userText);
    });
  }

  stopBtn?.addEventListener('click', () => {
    agent?.abort();
    hideApprovalCard();
  });

  document.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const prompt = chip.getAttribute('data-prompt');
      if (promptInput) promptInput.value = prompt;
      handleSendPrompt();
    });
  });

  document.getElementById('approveBtn')?.addEventListener('click', () => {
    hideApprovalCard();
    agent?.confirmPendingStep(true);
  });

  document.getElementById('skipBtn')?.addEventListener('click', () => {
    hideApprovalCard();
    agent?.confirmPendingStep(false);
  });

  document.getElementById('abortBtn')?.addEventListener('click', () => {
    hideApprovalCard();
    agent?.abort();
  });

  document.getElementById('modalCloseBtn')?.addEventListener('click', closeModal);
  document.getElementById('genericModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'genericModal') closeModal();
  });
}

function initMessageListener() {
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area === 'local') {
      const fresh = await chrome.storage.local.get(null);
      currentSettings = { ...currentSettings, ...fresh };
      const provider = getProviderForModel(currentSettings.selectedModel);
      const apiKey = getApiKeyForProvider(provider, currentSettings);
      apiClient.updateConfig({ model: currentSettings.selectedModel, provider, apiKey });
      updateStatusBadge(provider, apiKey);
    }
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'TAB_CHANGED' || message.type === 'TAB_UPDATED') {
      updateActiveTabUI(message.tab);
    } else if (message.type === 'INSPECTED_ELEMENT') {
      handleInspectedElement(message.element);
    } else if (message.type === 'PAGE_TEXT_SELECTED') {
      showSelectionBar(message.text);
    } else if (message.type === 'PAGE_TEXT_CLEARED') {
      hideSelectionBar();
    } else if (message.type === 'WORKFLOW_ACTION_CAPTURED') {
      updateRecordingStatusUI(message.totalCount);
    } else if (message.type === 'EXECUTE_SCHEDULED_SHORTCUT') {
      handleExecuteScheduledShortcut(message.shortcut);
    }
  });
}

function showSelectionBar(text) {
  activeSelectionText = text;
  const bar = document.getElementById('selectionBar');
  const snippet = document.getElementById('selectionTextSnippet');
  if (!bar || !snippet) return;
  snippet.innerText = text.slice(0, 100).replace(/\s+/g, ' ');
  snippet.title = text;
  bar.classList.remove('hidden');
}

function hideSelectionBar() {
  activeSelectionText = '';
  const bar = document.getElementById('selectionBar');
  if (bar) bar.classList.add('hidden');
}

function readFileAsText(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result || '');
    reader.onerror = () => resolve('');
    reader.readAsText(file);
  });
}

function readFileAsBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result || '');
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

function updateAttachmentTrayUI() {
  const tray = document.getElementById('attachmentTray');
  if (!tray) return;

  if (attachedFiles.length === 0) {
    tray.classList.add('hidden');
    tray.innerHTML = '';
    return;
  }

  tray.classList.remove('hidden');
  tray.innerHTML = attachedFiles.map((file, idx) => `
    <div class="attachment-pill" title="${escapeHtml(file.name)} (${Math.round(file.size / 1024)} KB)">
      <span>${file.type === 'image' 
        ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>' 
        : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>'}</span>
      <span>${escapeHtml(file.name.length > 20 ? file.name.slice(0, 18) + '...' : file.name)}</span>
      <button class="attachment-pill-remove" data-idx="${idx}" title="Remove file">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>
  `).join('');

  tray.querySelectorAll('.attachment-pill-remove').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      attachedFiles.splice(idx, 1);
      updateAttachmentTrayUI();
    });
  });
}

function showToast(msg) {
  const existing = document.querySelector('.neima-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'neima-toast';
  toast.innerText = msg;
  toast.style.cssText = `
    position: fixed;
    bottom: 84px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(18, 18, 18, 0.95);
    color: #f0f3f6;
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 11.5px;
    font-weight: 500;
    border: 1px solid rgba(255, 255, 255, 0.15);
    backdrop-filter: blur(8px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6);
    z-index: 999;
    pointer-events: none;
    transition: opacity 0.25s ease, transform 0.25s ease;
  `;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(6px)';
    setTimeout(() => toast.remove(), 260);
  }, 2200);
}

function enqueueTask(text) {
  const trimmed = text.trim();
  if (!trimmed) return;

  const task = {
    id: 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    text: trimmed,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };

  taskQueue.push(task);
  updateQueueTrayUI();

  if (agent?.isRunning) {
    const tray = document.getElementById('queueTray');
    if (tray) {
      tray.classList.remove('hidden');
      tray.style.animation = 'none';
      void tray.offsetWidth;
      tray.style.animation = 'slideQueueTray 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
    }
  } else {
    processNextQueuedTask();
  }
}

function removeQueuedTask(taskId) {
  taskQueue = taskQueue.filter((t) => t.id !== taskId);
  updateQueueTrayUI();
}

function processNextQueuedTask() {
  if (agent?.isRunning || taskQueue.length === 0) return;
  const nextTask = taskQueue.shift();
  updateQueueTrayUI();
  executePromptText(nextTask.text);
}

function updateQueueTrayUI() {
  const tray = document.getElementById('queueTray');
  const countLabel = document.getElementById('queueCountLabel');
  const list = document.getElementById('queueItemsList');
  if (!tray || !countLabel || !list) return;

  if (taskQueue.length === 0) {
    tray.classList.add('hidden');
    list.innerHTML = '';
    return;
  }

  tray.classList.remove('hidden');
  countLabel.innerText = `Queued Tasks (${taskQueue.length})`;

  list.innerHTML = taskQueue.map((item, idx) => `
    <div class="queue-item" data-id="${item.id}">
      <span class="queue-item-text" title="${escapeHtml(item.text)}">#${idx + 1}: ${escapeHtml(item.text)}</span>
      <div class="queue-item-actions">
        <button class="queue-item-btn run-now" data-id="${item.id}" title="Run next / prioritize">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
        </button>
        <button class="queue-item-btn remove" data-id="${item.id}" title="Remove from queue">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.queue-item-btn.remove').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      removeQueuedTask(id);
    });
  });

  list.querySelectorAll('.queue-item-btn.run-now').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const idx = taskQueue.findIndex((t) => t.id === id);
      if (idx > -1) {
        const [target] = taskQueue.splice(idx, 1);
        if (!agent?.isRunning) {
          updateQueueTrayUI();
          executePromptText(target.text);
        } else {
          taskQueue.unshift(target);
          updateQueueTrayUI();
        }
      }
    });
  });
}

async function handleSendPrompt() {
  const promptInput = document.getElementById('promptInput');
  if (!promptInput) return;
  const userText = promptInput.value.trim();
  if (!userText) return;

  promptInput.value = '';
  promptInput.style.height = 'auto';
  promptInput.style.overflowY = 'hidden';

  // If agent is currently executing, enqueue automatically (Antigravity parity!)
  if (agent?.isRunning) {
    enqueueTask(userText);
    showToast('Task added to queue (#' + taskQueue.length + ')');
    return;
  }

  try {
    await executePromptText(userText);
  } catch (err) {
    console.error('[Neima] Error running prompt in handleSendPrompt:', err);
    appendMessage('assistant', `⚠️ Notice: ${err.message || err}`);
    if (agent) agent.isRunning = false;
    updateAgentStatus('IDLE');
  } finally {
    promptInput.focus();
  }
}

async function executePromptText(userText) {
  if (!userText) return;

  const currentAttachments = [...attachedFiles];
  if (attachedFiles.length > 0) {
    attachedFiles = [];
    updateAttachmentTrayUI();
  }

  const provider = getProviderForModel(currentSettings.selectedModel);
  const apiKey = getApiKeyForProvider(provider, currentSettings);

  const welcome = document.getElementById('welcomeCard');
  if (welcome) welcome.remove();

  appendMessage('user', userText, currentAttachments.map((f) => f.name));

  if (provider !== 'simulation' && provider !== 'ollama' && !apiKey) {
    showToast(`No ${provider} key found. Running with Autonomous Local Engine.`);
  }

  let effectivePrompt = userText;
  if (currentAttachments.length > 0) {
    const fileBlocks = currentAttachments.map((f, i) => {
      if (f.type === 'image') {
        return `[Attached Image ${i + 1}: "${f.name}"]`;
      }
      return `[Attached File ${i + 1}: "${f.name}"]:\n\`\`\`\n${f.data}\n\`\`\``;
    }).join('\n\n');

    effectivePrompt = `${fileBlocks}\n\nUser Task / Request:\n${userText}`;
  }

  const includeVision = !!document.getElementById('includeVisionToggle')?.checked;

  // Ensure active tab metadata is fresh
  if (!activeTab?.id) {
    try {
      const res = await chrome.runtime.sendMessage({ type: 'GET_ACTIVE_TAB' });
      if (res?.tab) activeTab = res.tab;
    } catch (e) {}
  }

  await agent.runTask(effectivePrompt, {
    includeVision,
    activeTabId: activeTab?.id
  });
}

function updateAgentStatus(status) {
  const indicator = document.getElementById('agentStatusIndicator');
  const badgeDot = document.getElementById('statusBadgeDot');
  const sendBtn = document.getElementById('sendPromptBtn');
  const stopBtn = document.getElementById('stopAgentBtn');

  if (status === 'IDLE') {
    if (indicator) {
      indicator.innerText = 'Ready';
      indicator.classList.remove('running');
    }
    if (badgeDot) {
      badgeDot.classList.remove('busy');
      const provider = getProviderForModel(currentSettings.selectedModel);
      const apiKey = getApiKeyForProvider(provider, currentSettings);
      updateStatusBadge(provider, apiKey);
    }
    sendBtn?.classList.remove('hidden');
    stopBtn?.classList.add('hidden');

    // Automatically process next queued task when agent returns to IDLE!
    if (taskQueue.length > 0) {
      setTimeout(() => {
        if (!agent?.isRunning && taskQueue.length > 0) {
          processNextQueuedTask();
        }
      }, 350);
    }
  } else {
    if (indicator) {
      indicator.innerText = `${status.toLowerCase()}...`;
      indicator.classList.add('running');
    }
    if (badgeDot) {
      badgeDot.classList.add('busy');
    }
    sendBtn?.classList.add('hidden');
    stopBtn?.classList.remove('hidden');
  }
}

function handleAgentStepUpdate(update) {
  const feed = document.getElementById('feedContainer');

  switch (update.type) {
    case 'plan_proposed': {
      // Milestone Checklist for large tasks
      if (update.milestones && update.milestones.length > 0) {
        let tray = feed.querySelector('.task-milestone-tray');
        if (!tray) {
          tray = document.createElement('div');
          tray.className = 'task-milestone-tray';
          feed.appendChild(tray);
        }
        tray.innerHTML = `
          <div class="task-milestone-title">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 11 12 14 22 4"></polyline>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
            </svg>
            <span>Autonomous Execution Milestones</span>
          </div>
          ${update.milestones.map((m, idx) => `
            <div class="task-milestone-item ${m.status || (idx === 0 ? 'active' : '')}">
              <span class="milestone-dot"></span>
              <span>${escapeHtml(m.label || m)}</span>
            </div>
          `).join('')}
        `;
      }

      // Sleek Claude-style activity indicator rather than clunky debug card
      if (update.actions && update.actions.length > 0) {
        const action = update.actions[0];
        let label = action.reason || '';
        if (!label) {
          if (action.actionType === 'navigate') label = `Navigating to ${action.url || 'webpage'}`;
          else if (action.actionType === 'click') label = `Selecting element #${action.elementId || ''}`;
          else if (action.actionType === 'type') label = `Entering text into #${action.elementId || ''}`;
          else label = update.thought || 'Executing browser action...';
        }

        // Avoid duplicate activity pills
        const existingPill = feed.querySelector('.claude-activity-step');
        if (existingPill) {
          existingPill.querySelector('.claude-activity-text').innerText = label;
        } else {
          const stepPill = document.createElement('div');
          stepPill.className = 'claude-activity-step';
          stepPill.innerHTML = `
            <div class="claude-activity-indicator">
              <span class="activity-pulse-dot"></span>
              <span class="claude-activity-text">${escapeHtml(label)}</span>
            </div>
          `;
          feed.appendChild(stepPill);
        }
        scrollToBottom();
      }
      break;
    }

    case 'completed': {
      // Cleanly clear activity steps and milestone trays so the final Claude narrative takes center stage
      feed.querySelectorAll('.claude-activity-step').forEach((el) => el.remove());
      feed.querySelectorAll('.task-milestone-tray').forEach((el) => el.remove());
      appendMessage('assistant', update.finalMessage, [], { thought: update.thought });
      break;
    }

    case 'text_response': {
      feed.querySelectorAll('.claude-activity-step').forEach((el) => el.remove());
      feed.querySelectorAll('.task-milestone-tray').forEach((el) => el.remove());
      appendMessage('assistant', update.text);
      break;
    }

    case 'error': {
      feed.querySelectorAll('.claude-activity-step').forEach((el) => el.remove());
      appendMessage('assistant', `I ran into an issue connecting to the model API: ${update.error}\n\n*Tip: You can switch to **Claude 3.7 Sonnet** or the **Autonomous Local Engine** to continue your task right away.*`);
      break;
    }

    case 'max_steps_reached': {
      feed.querySelectorAll('.claude-activity-step').forEach((el) => el.remove());
      appendMessage('assistant', `${update.message}`);
      break;
    }
  }
}

function showApprovalCard(action) {
  const card = document.getElementById('approvalCard');
  const indicator = card.querySelector('.approval-indicator');
  const title = document.getElementById('approvalActionTitle');
  const reason = document.getElementById('approvalActionReason');
  const approveBtn = document.getElementById('approveBtn');

  if (action.isSensitive) {
    card.classList.add('sensitive-alert');
    if (indicator) {
      indicator.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block;vertical-align:middle;margin-right:4px;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg> Sensitive Action Authorization';
    }
    approveBtn.innerText = 'Authorize';
    title.innerText = `${action.actionType.toUpperCase()}${action.elementId ? ` on #${action.elementId}` : (action.url ? ` ${action.url}` : '')}`;
    reason.innerHTML = `<span style="color:#fbbf24;font-weight:600;">Sensitive Operation:</span> ${escapeHtml(action.sensitiveReason || action.reason || 'This action interacts with credentials, payment, or critical account settings.')}`;
  } else {
    card.classList.remove('sensitive-alert');
    if (indicator) indicator.innerText = 'Pending Action';
    approveBtn.innerText = 'Execute';
    title.innerText = `${action.actionType.toUpperCase()}${action.elementId ? ` on #${action.elementId}` : (action.url ? ` ${action.url}` : '')}`;
    reason.innerText = action.reason || 'Executing next step';
  }

  card.classList.remove('hidden');
  card.scrollIntoView({ behavior: 'smooth' });
}

function hideApprovalCard() {
  const card = document.getElementById('approvalCard');
  card.classList.remove('sensitive-alert');
  card.classList.add('hidden');
}

function handleInspectedElement(el) {
  const welcome = document.getElementById('welcomeCard');
  if (welcome) welcome.remove();

  appendMessage('assistant', `**Inspected Element:**\n- Tag: \`<${el.tag}>\`\n- Selector: \`${el.selector}\`\n${el.text ? `- Text: "${el.text}"\n` : ''}\n\`\`\`html\n${el.outerHtml}\n\`\`\``);
}

async function handleExtractTables() {
  if (!activeTab?.id) return;
  await agent.ensureContentScript(activeTab.id);
  const res = await chrome.tabs.sendMessage(activeTab.id, { type: 'EXTRACT_TABLE_DATA' }).catch(() => null);

  const tables = res?.tables || [];
  if (tables.length === 0) {
    showModal('Extract Tables', '<p>No HTML tables were found on this page.</p>', '');
    return;
  }

  let html = `<p style="margin-bottom: 10px; color: var(--text-secondary);">Found <strong>${tables.length}</strong> table(s) on this page.</p>`;

  tables.forEach((t) => {
    html += `
      <div style="margin-bottom: 14px;">
        <h4 style="margin-bottom: 4px; color: var(--text-primary); font-size: 12px;">Table #${t.tableIndex} (${t.rows.length} rows)</h4>
        <div style="overflow-x: auto; max-height: 180px;">
          <table class="extracted-table">
            <thead>
              <tr>${t.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${t.rows.slice(0, 8).map((row) => `
                <tr>${row.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  });

  const footer = `
    <button id="downloadCsvBtn" class="btn btn-confirm">Download CSV</button>
    <button id="downloadJsonBtn" class="btn btn-muted">Download JSON</button>
  `;

  showModal('Extracted Table Data', html, footer);

  document.getElementById('downloadCsvBtn')?.addEventListener('click', () => {
    const csvContent = tablesToCsv(tables[0]);
    downloadFile(csvContent, 'table-export.csv', 'text/csv');
  });

  document.getElementById('downloadJsonBtn')?.addEventListener('click', () => {
    downloadFile(JSON.stringify(tables, null, 2), 'tables-export.json', 'application/json');
  });
}

function tablesToCsv(table) {
  const lines = [];
  lines.push(table.headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(','));
  table.rows.forEach((row) => {
    lines.push(row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','));
  });
  return lines.join('\n');
}

function downloadFile(content, fileName, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

async function handleAutofill() {
  if (!activeTab?.id) return;
  await agent.ensureContentScript(activeTab.id);
  const profile = currentSettings.userProfile || {};
  const res = await chrome.tabs.sendMessage(activeTab.id, {
    type: 'AUTOFILL_FORM',
    profile
  }).catch(() => null);

  if (res?.fieldsFilled) {
    appendMessage('assistant', `Filled **${res.fieldsFilled}** form input(s) with saved persona profile.`);
  } else {
    appendMessage('assistant', `No unfilled form fields detected on this page.`);
  }
}

async function handleDebugLogs() {
  if (!activeTab?.id) return;
  await agent.ensureContentScript(activeTab.id);
  const res = await chrome.tabs.sendMessage(activeTab.id, { type: 'GET_DEBUG_LOGS' }).catch(() => null);
  const errors = res?.errors || [];

  if (errors.length === 0) {
    showModal('Page Console Debugger', '<p style="color: var(--accent-green); display: flex; align-items: center; gap: 6px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> Zero unhandled JavaScript errors captured on this page.</p>', '');
    return;
  }

  let html = `<p style="margin-bottom: 10px; color: var(--accent-rose);">Captured <strong>${errors.length}</strong> runtime error(s):</p>`;
  errors.forEach((e, idx) => {
    html += `
      <div style="background: var(--bg-input); padding: 8px 10px; border-radius: 4px; margin-bottom: 6px; border-left: 2px solid var(--accent-rose);">
        <div style="font-weight: 500; color: #f87171;">#${idx + 1} ${escapeHtml(e.message)}</div>
        <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">
          ${e.filename ? `File: ${escapeHtml(e.filename)}:${e.lineno} ` : ''} [${e.timestamp}]
        </div>
      </div>
    `;
  });

  const footer = `
    <button id="askAiDebugBtn" class="btn btn-confirm">Diagnose with AI</button>
  `;

  showModal('Page Console Logs', html, footer);

  document.getElementById('askAiDebugBtn')?.addEventListener('click', () => {
    closeModal();
    const promptInput = document.getElementById('promptInput');
    promptInput.value = `Analyze these webpage console errors and provide fixes:\n\n${JSON.stringify(errors, null, 2)}`;
    handleSendPrompt();
  });
}

/* ==========================================================================
   WORKFLOW RECORDER & CLOCK SCHEDULE SHORTCUTS (CLAUDE IN CHROME PARITY)
   ========================================================================== */

let isRecordingWorkflow = false;

async function toggleWorkflowRecording() {
  if (isRecordingWorkflow) {
    await finishAndSaveWorkflowRecording();
  } else {
    await startWorkflowRecording();
  }
}

async function startWorkflowRecording() {
  if (!activeTab?.id) {
    showToast('Please open a webpage tab to record actions.');
    return;
  }
  isRecordingWorkflow = true;
  await agent.ensureContentScript(activeTab.id);

  const banner = document.getElementById('recordingBanner');
  const recordBtn = document.getElementById('recordWorkflowBtn');
  const statusText = document.getElementById('recordingStatusText');

  if (banner) banner.classList.remove('hidden');
  if (recordBtn) recordBtn.classList.add('recording');
  if (statusText) statusText.innerText = 'Recording Workflow (0 actions captured)...';

  await chrome.tabs.sendMessage(activeTab.id, { type: 'START_WORKFLOW_RECORDING' }).catch(() => {});
}

function updateRecordingStatusUI(count) {
  const statusText = document.getElementById('recordingStatusText');
  if (statusText) {
    statusText.innerText = `Recording Workflow (${count} action${count === 1 ? '' : 's'} captured)...`;
  }
}

async function cancelWorkflowRecording() {
  if (!activeTab?.id) return;
  isRecordingWorkflow = false;

  const banner = document.getElementById('recordingBanner');
  const recordBtn = document.getElementById('recordWorkflowBtn');
  if (banner) banner.classList.add('hidden');
  if (recordBtn) recordBtn.classList.remove('recording');

  await chrome.tabs.sendMessage(activeTab.id, { type: 'STOP_WORKFLOW_RECORDING' }).catch(() => {});
}

async function finishAndSaveWorkflowRecording() {
  if (!activeTab?.id) return;
  isRecordingWorkflow = false;

  const banner = document.getElementById('recordingBanner');
  const recordBtn = document.getElementById('recordWorkflowBtn');
  if (banner) banner.classList.add('hidden');
  if (recordBtn) recordBtn.classList.remove('recording');

  const res = await chrome.tabs.sendMessage(activeTab.id, { type: 'STOP_WORKFLOW_RECORDING' }).catch(() => null);
  const actions = res?.actions || [];

  if (actions.length === 0) {
    appendMessage('assistant', 'Workflow recording cancelled: No page actions were captured.');
    return;
  }

  let defaultName = `Workflow on ${activeTab.url ? new URL(activeTab.url).hostname : 'Webpage'}`;
  const workflowName = prompt('Enter a name for this saved workflow shortcut:', defaultName) || defaultName;

  const newWorkflow = {
    id: 'wf_' + Date.now(),
    name: workflowName,
    url: activeTab.url || '',
    actions,
    createdAt: new Date().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
  };

  const stored = await chrome.storage.local.get(['workflows']);
  const workflows = stored.workflows || [];
  workflows.unshift(newWorkflow);
  await chrome.storage.local.set({ workflows });

  appendMessage('assistant', `✨ **Saved Repeatable Workflow: "${escapeHtml(workflowName)}"**\n\n- **Target Page**: \`${activeTab.url}\`\n- **Captured Steps**: **${actions.length}** action(s)\n\nYou can repeat this workflow anytime or schedule it using the **Clock** (⏰) icon!`);
}

async function replayWorkflow(workflowId) {
  const stored = await chrome.storage.local.get(['workflows']);
  const workflows = stored.workflows || [];
  const wf = workflows.find((w) => w.id === workflowId);
  if (!wf || !wf.actions || wf.actions.length === 0) {
    alert('Workflow actions not found.');
    return;
  }

  closeModal();

  if (!activeTab?.id) {
    appendMessage('assistant', 'Error: No active tab available to run workflow.');
    return;
  }

  appendMessage('assistant', `▶ **Replaying Workflow: "${escapeHtml(wf.name)}"**\n\nExecuting ${wf.actions.length} automated step(s) with visual Set-of-Marks...`);
  await agent.ensureContentScript(activeTab.id);

  for (let i = 0; i < wf.actions.length; i++) {
    const action = wf.actions[i];
    const res = await chrome.tabs.sendMessage(activeTab.id, {
      type: 'REPLAY_WORKFLOW_STEP',
      action
    }).catch((err) => ({ error: err.message }));

    if (res?.error) {
      appendMessage('assistant', `⚠️ Notice on step ${i + 1}: ${res.error}`);
    }
    await new Promise((r) => setTimeout(r, 650));
  }

  appendMessage('assistant', `✅ **Workflow "${escapeHtml(wf.name)}" completed successfully!**`);
}

async function deleteWorkflow(workflowId) {
  const stored = await chrome.storage.local.get(['workflows']);
  let workflows = stored.workflows || [];
  workflows = workflows.filter((w) => w.id !== workflowId);
  await chrome.storage.local.set({ workflows });
  openWorkflowsLibraryModal();
}

async function openWorkflowsLibraryModal() {
  const stored = await chrome.storage.local.get(['workflows']);
  const workflows = stored.workflows || [];

  let html = `
    <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
      <span style="font-size: 11px; color: var(--text-muted);">Recorded workflows Claude/Neima can repeat automatically on command.</span>
      <button id="modalStartRecordBtn" class="btn-action-sm btn-action-run">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="7"></circle></svg> Record New
      </button>
    </div>
  `;

  if (workflows.length === 0) {
    html += `
      <div style="text-align: center; padding: 24px 10px; color: var(--text-muted); font-size: 12px;">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin: 0 auto 8px; display: block; opacity: 0.5;">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
        No recorded workflows yet.<br>Click <strong>Record New</strong> to record your browser clicks and inputs!
      </div>
    `;
  } else {
    workflows.forEach((wf) => {
      html += `
        <div class="workflow-item-card">
          <div class="workflow-info">
            <span class="workflow-title" title="${escapeHtml(wf.name)}">${escapeHtml(wf.name)}</span>
            <span class="workflow-meta">
              <span>${wf.actions?.length || 0} step(s)</span> •
              <span>${escapeHtml(wf.createdAt || 'Saved')}</span>
            </span>
          </div>
          <div class="workflow-actions">
            <button class="btn-action-sm btn-action-run run-wf-btn" data-id="${wf.id}" title="Replay this workflow on current page">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Run
            </button>
            <button class="btn-action-sm schedule-wf-btn" data-id="${wf.id}" title="Schedule this workflow to run automatically">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            </button>
            <button class="btn-action-sm btn-action-del del-wf-btn" data-id="${wf.id}" title="Delete workflow">
              ✕
            </button>
          </div>
        </div>
      `;
    });
  }

  showModal('Recorded Workflows & Shortcuts', html, '');

  document.getElementById('modalStartRecordBtn')?.addEventListener('click', () => {
    closeModal();
    startWorkflowRecording();
  });

  document.querySelectorAll('.run-wf-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      replayWorkflow(id);
    });
  });

  document.querySelectorAll('.schedule-wf-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const target = workflows.find((w) => w.id === id);
      openScheduledShortcutsModal(target);
    });
  });

  document.querySelectorAll('.del-wf-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      deleteWorkflow(id);
    });
  });
}

// Scheduled Shortcuts & Automations (Clock Icon - Claude in Chrome Parity)
async function openScheduledShortcutsModal(prefillWorkflow = null) {
  const stored = await chrome.storage.local.get(['scheduledShortcuts', 'workflows']);
  const shortcuts = stored.scheduledShortcuts || [];
  const workflows = stored.workflows || [];

  let html = `
    <div class="schedule-creator-box">
      <div style="font-size: 11px; font-weight: 600; color: #38bdf8; margin-bottom: 8px; display: flex; align-items: center; gap: 5px;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        <span>Schedule New Automatic Shortcut</span>
      </div>
      <div class="schedule-form-row">
        <label class="schedule-form-label">Shortcut Name</label>
        <input type="text" id="newScheduleName" class="schedule-form-input" placeholder="e.g. Daily Report Extraction or Account Balance Check" value="${prefillWorkflow ? escapeHtml(prefillWorkflow.name) : ''}">
      </div>
      <div class="schedule-form-row">
        <label class="schedule-form-label">Task Prompt or Workflow Instruction</label>
        <input type="text" id="newSchedulePrompt" class="schedule-form-input" placeholder="e.g. Go to orders, extract latest summary, and report status" value="${prefillWorkflow ? `Replay workflow "${escapeHtml(prefillWorkflow.name)}"` : ''}">
      </div>
      <div class="schedule-form-row" style="display: flex; gap: 8px;">
        <div style="flex: 1;">
          <label class="schedule-form-label">Repeat Interval</label>
          <select id="newScheduleInterval" class="schedule-form-select">
            <option value="15">Every 15 minutes</option>
            <option value="30">Every 30 minutes</option>
            <option value="60" selected>Every 1 hour</option>
            <option value="360">Every 6 hours</option>
            <option value="720">Every 12 hours</option>
            <option value="1440">Daily (Every 24 hours)</option>
          </select>
        </div>
        <div style="flex: 1; align-self: flex-end;">
          <button id="saveScheduleBtn" class="btn btn-confirm" style="width: 100%; height: 33px; font-size: 11px;">
            Save &amp; Schedule ⏰
          </button>
        </div>
      </div>
    </div>

    <div style="font-size: 11px; font-weight: 600; color: #ffffff; margin-bottom: 8px;">
      Active Scheduled Automations (${shortcuts.length})
    </div>
  `;

  if (shortcuts.length === 0) {
    html += `
      <div style="text-align: center; padding: 18px 10px; color: var(--text-muted); font-size: 12px;">
        No active scheduled automations.<br>Create a schedule above to run workflows automatically in the background.
      </div>
    `;
  } else {
    shortcuts.forEach((sc) => {
      const intervalLabel = sc.intervalMinutes >= 1440 
        ? 'Daily' 
        : (sc.intervalMinutes >= 60 ? `Every ${sc.intervalMinutes / 60}h` : `Every ${sc.intervalMinutes}m`);

      html += `
        <div class="shortcut-card">
          <div class="shortcut-info">
            <span class="shortcut-name" title="${escapeHtml(sc.name)}">${escapeHtml(sc.name)}</span>
            <span class="shortcut-meta">
              <span class="schedule-badge">⏰ ${intervalLabel}</span>
              <span>Last: ${sc.lastRun ? new Date(sc.lastRun).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending'}</span>
            </span>
          </div>
          <div class="shortcut-actions">
            <button class="btn-action-sm btn-action-run run-now-sc-btn" data-id="${sc.id}" title="Run shortcut immediately">
              ▶ Run
            </button>
            <button class="btn-action-sm btn-action-del del-sc-btn" data-id="${sc.id}" title="Delete schedule">
              ✕
            </button>
          </div>
        </div>
      `;
    });
  }

  showModal('Scheduled Shortcuts & Automations (Clock)', html, '');

  document.getElementById('saveScheduleBtn')?.addEventListener('click', async () => {
    const name = document.getElementById('newScheduleName').value.trim();
    const prompt = document.getElementById('newSchedulePrompt').value.trim();
    const intervalMinutes = parseInt(document.getElementById('newScheduleInterval').value, 10) || 60;

    if (!name) {
      alert('Please enter a name for the scheduled shortcut.');
      return;
    }

    const newShortcut = {
      id: 'sc_' + Date.now(),
      name,
      prompt: prompt || name,
      intervalMinutes,
      enabled: true,
      createdAt: Date.now(),
      lastRun: null
    };

    const storedFresh = await chrome.storage.local.get(['scheduledShortcuts']);
    const list = storedFresh.scheduledShortcuts || [];
    list.unshift(newShortcut);
    await chrome.storage.local.set({ scheduledShortcuts: list });

    // Register alarm with background service worker
    await chrome.runtime.sendMessage({
      type: 'SCHEDULE_SHORTCUT',
      id: newShortcut.id,
      intervalMinutes: newShortcut.intervalMinutes
    }).catch(() => {});

    openScheduledShortcutsModal();
  });

  document.querySelectorAll('.run-now-sc-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const sc = shortcuts.find((s) => s.id === id);
      if (sc) {
        closeModal();
        handleExecuteScheduledShortcut(sc);
      }
    });
  });

  document.querySelectorAll('.del-sc-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      await chrome.runtime.sendMessage({ type: 'CANCEL_SCHEDULED_SHORTCUT', id }).catch(() => {});
      const storedFresh = await chrome.storage.local.get(['scheduledShortcuts']);
      let list = storedFresh.scheduledShortcuts || [];
      list = list.filter((s) => s.id !== id);
      await chrome.storage.local.set({ scheduledShortcuts: list });
      openScheduledShortcutsModal();
    });
  });
}

function handleExecuteScheduledShortcut(shortcut) {
  if (!shortcut) return;
  appendMessage('assistant', `⏰ **Executing Scheduled Shortcut: "${escapeHtml(shortcut.name)}"**\n\nAutomation triggered automatically on schedule.`);
  executePromptText(shortcut.prompt || shortcut.name);
}

// Multi-Tab Orchestration ("handle several tabs at once")
async function openMultiTabsModal() {
  const res = await chrome.runtime.sendMessage({ type: 'LIST_ALL_TABS' }).catch(() => ({ tabs: [] }));
  const tabs = res?.tabs || [];

  let html = `
    <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
      <span>Currently managing <strong>${tabs.length}</strong> active open browser tab(s).</span>
      <button id="crossTabSummarizeBtn" class="btn-action-sm btn-action-run">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg> Cross-Tab AI Summary
      </button>
    </div>
  `;

  tabs.forEach((tab) => {
    let hostname = 'about:blank';
    try {
      hostname = tab.url ? new URL(tab.url).hostname : 'about:blank';
    } catch (e) {}

    html += `
      <div class="tab-manager-card ${tab.active ? 'active-tab' : ''}" style="${tab.active ? 'border-color: #38bdf8;' : ''}">
        <div class="tab-info">
          <div style="display: flex; align-items: center; gap: 6px;">
            <img src="${tab.favIconUrl || 'data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'%233b82f6\'><circle cx=\'12\' cy=\'12\' r=\'10\'/></svg>'}" style="width: 14px; height: 14px; border-radius: 2px;" alt="">
            <span class="tab-title" title="${escapeHtml(tab.title)}">${escapeHtml(tab.title)}</span>
          </div>
          <span class="tab-meta">${escapeHtml(hostname)} ${tab.active ? '• <strong style="color: #38bdf8;">Active Viewport</strong>' : ''}</span>
        </div>
        <div class="tab-actions">
          ${!tab.active ? `
            <button class="btn-action-sm switch-tab-btn" data-id="${tab.id}" title="Switch focus to this tab">
              Switch
            </button>
          ` : '<span style="font-size: 10px; color: #38bdf8; padding: 4px 6px;">Active</span>'}
          <button class="btn-action-sm btn-action-del close-tab-btn" data-id="${tab.id}" title="Close this tab">
            ✕
          </button>
        </div>
      </div>
    `;
  });

  showModal('Multi-Tab Orchestration Manager', html, '');

  document.querySelectorAll('.switch-tab-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = parseInt(btn.getAttribute('data-id'), 10);
      await chrome.runtime.sendMessage({ type: 'SWITCH_TAB', tabId: id }).catch(() => {});
      closeModal();
    });
  });

  document.querySelectorAll('.close-tab-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = parseInt(btn.getAttribute('data-id'), 10);
      await chrome.runtime.sendMessage({ type: 'CLOSE_TAB', tabId: id }).catch(() => {});
      openMultiTabsModal();
    });
  });

  document.getElementById('crossTabSummarizeBtn')?.addEventListener('click', () => {
    closeModal();
    const promptInput = document.getElementById('promptInput');
    const tabListText = tabs.map((t, idx) => `${idx + 1}. [${t.title}] (${t.url})`).join('\n');
    promptInput.value = `Synthesize and analyze information across all my ${tabs.length} open browser tabs:\n\n${tabListText}`;
    handleSendPrompt();
  });
}

function extractCleanMessageText(content) {
  if (!content || typeof content !== 'string') return { text: content || '', extractedThought: '' };
  const trimmed = content.trim();

  // 1. Strip markdown code fence: ```json { ... } ``` or ``` { ... } ```
  const codeBlockMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = codeBlockMatch ? codeBlockMatch[1].trim() : trimmed;

  // 2. If it's a JSON string or object
  if (candidate.startsWith('{') && candidate.endsWith('}')) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object') {
        if (parsed.finalMessage && typeof parsed.finalMessage === 'string') {
          return {
            text: parsed.finalMessage,
            extractedThought: parsed.thought || ''
          };
        }
        if (parsed.text && typeof parsed.text === 'string') {
          return {
            text: parsed.text,
            extractedThought: parsed.thought || ''
          };
        }
        if (parsed.thought && typeof parsed.thought === 'string') {
          return {
            text: parsed.thought,
            extractedThought: ''
          };
        }
      }
    } catch (e) {
      // Regex extraction fallback for unescaped newlines/quotes in JSON strings
      const finalMsgMatch = candidate.match(/"finalMessage"\s*:\s*"([\s\S]*?)"\s*(?:,\s*"(?:actions|thought|isComplete|milestones)"|\s*})/);
      const thoughtMatch = candidate.match(/"thought"\s*:\s*"([\s\S]*?)"\s*(?:,\s*"(?:actions|finalMessage|isComplete|milestones)"|\s*})/);
      if (finalMsgMatch || thoughtMatch) {
        const text = finalMsgMatch
          ? finalMsgMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
          : (thoughtMatch ? thoughtMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\') : '');
        const extractedThought = (finalMsgMatch && thoughtMatch)
          ? thoughtMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
          : '';
        return { text: text || content, extractedThought };
      }
    }
  }

  return { text: content, extractedThought: '' };
}

function appendMessage(role, content, attachments = [], { thought = '' } = {}) {
  const feed = document.getElementById('feedContainer');
  if (!feed) return;
  const bubble = document.createElement('div');
  bubble.className = `message-bubble ${role}`;

  let displayContent = content || '';
  let displayThought = thought || '';

  if (role === 'assistant') {
    const cleaned = extractCleanMessageText(content);
    displayContent = cleaned.text;
    if (!displayThought && cleaned.extractedThought) {
      displayThought = cleaned.extractedThought;
    }
  }

  try {
    if (!bubble.dataset) bubble.dataset = {};
    bubble.dataset.rawText = displayContent;
  } catch (e) {
    bubble.setAttribute('data-raw-text', displayContent);
  }

  if (role === 'assistant') {
    const metaHeader = document.createElement('div');
    metaHeader.className = 'assistant-meta-header';
    metaHeader.innerHTML = `
      <div class="assistant-spark-badge">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6Z"></path>
        </svg>
      </div>
      <span class="assistant-name-tag">Neima</span>
    `;
    bubble.appendChild(metaHeader);

    // Collapsible Decision & Reasoning Receipt (Claude / Antigravity parity)
    if (displayThought && displayThought.trim().length > 0) {
      const receipt = document.createElement('details');
      receipt.className = 'decision-receipt-card';
      receipt.innerHTML = `
        <summary class="decision-receipt-summary">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          <span>Reasoning &amp; Decision Receipt</span>
          <svg class="receipt-chevron" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </summary>
        <div class="decision-receipt-body">
          ${renderMarkdown(displayThought)}
        </div>
      `;
      bubble.appendChild(receipt);
    }
  }

  if (role === 'user' && attachments && attachments.length > 0) {
    const attachWrap = document.createElement('div');
    attachWrap.className = 'user-msg-attachments';
    attachWrap.innerHTML = attachments.map((name) => `
      <span class="user-msg-attachment-tag">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
        ${escapeHtml(name)}
      </span>
    `).join('');
    bubble.appendChild(attachWrap);
  }

  const body = document.createElement('div');
  body.className = 'bubble-body';
  body.innerHTML = renderMarkdown(displayContent);
  bubble.appendChild(body);

  // Wire up code block copy buttons
  bubble.querySelectorAll('.code-copy-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const card = btn.closest('.code-block-card');
      const code = card?.querySelector('pre code')?.innerText || '';
      if (!code) return;
      try {
        await navigator.clipboard.writeText(code);
        btn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied`;
        setTimeout(() => {
          btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> <span>Copy</span>`;
        }, 1600);
      } catch (err) {
        console.error('Failed to copy code snippet:', err);
      }
    });
  });

  const actionsBar = document.createElement('div');
  actionsBar.className = 'message-actions-bar';

  if (role === 'user') {
    actionsBar.innerHTML = `
      <button class="msg-action-btn edit-btn" aria-label="Edit prompt">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg> Edit
      </button>
      <button class="msg-action-btn copy-btn" aria-label="Copy prompt">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy
      </button>
      <button class="msg-action-btn queue-btn" aria-label="Send copy to Queue">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> Queue
      </button>
      <button class="msg-action-btn delete-btn" aria-label="Delete message">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
      </button>
    `;

    // Edit Handler
    const editBtn = actionsBar.querySelector('.edit-btn');
    editBtn.addEventListener('click', () => {
      if (bubble.querySelector('.inline-edit-box')) return;
      const currentRaw = bubble.dataset.rawText || content;

      body.style.display = 'none';
      actionsBar.style.display = 'none';

      const editBox = document.createElement('div');
      editBox.className = 'inline-edit-box';
      editBox.innerHTML = `
        <textarea class="inline-edit-textarea">${escapeHtml(currentRaw)}</textarea>
        <div class="inline-edit-actions">
          <button class="inline-cancel-btn">Cancel</button>
          <button class="inline-save-btn">Save &amp; Run</button>
        </div>
      `;

      bubble.appendChild(editBox);
      const textarea = editBox.querySelector('.inline-edit-textarea');
      textarea.focus();
      textarea.select();

      editBox.querySelector('.inline-cancel-btn').addEventListener('click', () => {
        editBox.remove();
        body.style.display = '';
        actionsBar.style.display = '';
      });

      editBox.querySelector('.inline-save-btn').addEventListener('click', async () => {
        const newText = textarea.value.trim();
        if (!newText) return;
        bubble.dataset.rawText = newText;
        body.innerHTML = renderMarkdown(newText);
        editBox.remove();
        body.style.display = '';
        actionsBar.style.display = '';

        if (agent?.isRunning) {
          enqueueTask(newText);
        } else {
          await executePromptText(newText);
        }
      });
    });

    // Copy Handler
    const copyBtn = actionsBar.querySelector('.copy-btn');
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(bubble.dataset.rawText || content);
        copyBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied`;
        setTimeout(() => {
          copyBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy`;
        }, 1500);
      } catch (err) {
        console.error('Copy failed:', err);
      }
    });

    // Queue Handler
    const queueBtn = actionsBar.querySelector('.queue-btn');
    queueBtn.addEventListener('click', () => {
      enqueueTask(bubble.dataset.rawText || content);
      queueBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> Queued`;
      setTimeout(() => {
        queueBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> Queue`;
      }, 1500);
    });

    // Delete Handler
    const deleteBtn = actionsBar.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', () => {
      bubble.style.transition = 'all 0.2s ease';
      bubble.style.opacity = '0';
      bubble.style.transform = 'translateY(-6px)';
      setTimeout(() => {
        bubble.remove();
      }, 200);
    });
  } else {
    // Assistant message actions
    actionsBar.style.justifyContent = 'flex-start';
    actionsBar.innerHTML = `
      <button class="msg-action-btn copy-btn" aria-label="Copy response">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy
      </button>
      <button class="msg-action-btn delete-btn" aria-label="Delete response">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg> Delete
      </button>
    `;

    const copyBtn = actionsBar.querySelector('.copy-btn');
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(bubble.dataset.rawText || content);
        copyBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied`;
        setTimeout(() => {
          copyBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy`;
        }, 1500);
      } catch (err) {
        console.error('Copy failed:', err);
      }
    });

    const deleteBtn = actionsBar.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', () => {
      bubble.style.transition = 'all 0.2s ease';
      bubble.style.opacity = '0';
      bubble.style.transform = 'translateY(-6px)';
      setTimeout(() => {
        bubble.remove();
      }, 200);
    });
  }

  bubble.appendChild(actionsBar);
  feed.appendChild(bubble);
  scrollToBottom();
}

function scrollToBottom() {
  const feed = document.getElementById('feedContainer');
  feed.scrollTop = feed.scrollHeight;
}

function renderMarkdown(text) {
  if (!text) return '';
  const codeBlocks = [];
  const inlineCodes = [];

  let str = text.replace(/```([a-z0-9_-]*)\r?\n([\s\S]*?)```/gi, (_, lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push({ lang: (lang || 'code').trim(), code: code.trim() });
    return `___CODE_BLOCK_${idx}___`;
  });

  str = str.replace(/`([^`\n]+)`/g, (_, code) => {
    const idx = inlineCodes.length;
    inlineCodes.push(code);
    return `___INLINE_CODE_${idx}___`;
  });

  str = escapeHtml(str);

  // Markdown Tables (| Header | Header | \n | --- | --- | \n | Cell | Cell |)
  str = str.replace(/((?:^|\n)\|[^\n]+\|\r?\n\|[-:\s|]+\|\r?\n(?:\|[^\n]+\|(?:\r?\n|$))+)/g, (match) => {
    const lines = match.trim().split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 3) return match;
    const parseRow = (line) => line.split('|').slice(1, -1).map((c) => c.trim());
    const headers = parseRow(lines[0]);
    const rows = lines.slice(2).map(parseRow);

    const thead = '<thead><tr>' + headers.map((h) => '<th>' + h + '</th>').join('') + '</tr></thead>';
    const tbody = '<tbody>' + rows.map((r) => '<tr>' + r.map((c) => '<td>' + c + '</td>').join('') + '</tr>').join('') + '</tbody>';
    return '<div class="table-card"><table class="markdown-table">' + thead + tbody + '</table></div>';
  });

  // Blockquotes (> Quote)
  str = str.replace(/(?:^|\n)((?:&gt;[^\n]+(?:\n|$))+)/g, (_, quoteBlock) => {
    const lines = quoteBlock.trim().split(/\n/).map((l) => l.replace(/^&gt;\s*/, '').trim());
    return '<blockquote class="markdown-quote">' + lines.join('<br>') + '</blockquote>';
  });

  // Ordered lists (1. Item, 2. Item)
  str = str.replace(/(?:^|\n)((?:\d+\.\s+[^\n]+(?:\n|$))+)/g, (_, listBlock) => {
    const items = listBlock.trim().split(/\n/).map((item) => item.replace(/^\d+\.\s+/, '').trim());
    return '<ol class="markdown-ol">' + items.map((it) => '<li>' + it + '</li>').join('') + '</ol>';
  });

  // Unordered lists (* Item or - Item)
  str = str.replace(/(?:^|\n)((?:[*+-]\s+[^\n]+(?:\n|$))+)/g, (_, listBlock) => {
    const items = listBlock.trim().split(/\n/).map((item) => item.replace(/^[*+-]\s+/, '').trim());
    return '<ul class="markdown-ul">' + items.map((it) => '<li>' + it + '</li>').join('') + '</ul>';
  });

  // Headers
  str = str.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  str = str.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  str = str.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Dividers
  str = str.replace(/^(?:---|___|\*\*\*)$/gm, '<hr class="markdown-divider">');

  // Bold & Italic
  str = str.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  str = str.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Paragraph & linebreaks
  str = str.replace(/\n\n/g, '<br><br>');

  // Restore inline codes
  str = str.replace(/___INLINE_CODE_(\d+)___/g, (_, i) => {
    return '<code>' + escapeHtml(inlineCodes[Number(i)]) + '</code>';
  });

  // Restore code blocks with language badge and copy button
  str = str.replace(/___CODE_BLOCK_(\d+)___/g, (_, i) => {
    const item = codeBlocks[Number(i)];
    return (
      '<div class="code-block-card"><div class="code-block-header"><span class="code-block-lang">' +
      escapeHtml(item.lang) +
      '</span><button class="code-copy-btn" title="Copy code snippet"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> <span>Copy</span></button></div><pre><code>' +
      escapeHtml(item.code) +
      '</code></pre></div>'
    );
  });

  return str;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showModal(title, bodyHtml, footerHtml) {
  const modal = document.getElementById('genericModal');
  document.getElementById('modalTitle').innerText = title;
  document.getElementById('modalBody').innerHTML = bodyHtml;
  document.getElementById('modalFooter').innerHTML = footerHtml;
  modal.classList.remove('hidden');
}

function closeModal() {
  document.getElementById('genericModal').classList.add('hidden');
}
