/**
 * Neima Content Script
 * Featuring the 3D Muse Companion Avatar, DOM Vision, Set-of-Marks indexing, and Action Execution.
 */

(() => {
  if (window !== window.top) return; // Prevent executing inside iframes
  if (window.__NEIMA_INITIALIZED__) return;
  window.__NEIMA_INITIALIZED__ = true;

  let marksVisible = false;
  let inspectorActive = false;
  let inspectorOverlay = null;
  let inspectorTooltip = null;
  let capturedErrors = [];

  // Neima 3D Muse DOM elements
  let museEl = null;
  let museSpeechEl = null;

  // Safe runtime message wrapper: suppresses Extension context invalidated after extension reloads
  function safeSendMessage(payload, responseCallback) {
    try {
      if (!chrome?.runtime?.id) return;
      const res = chrome.runtime.sendMessage(payload, (resp) => {
        if (chrome?.runtime?.lastError) return;
        if (typeof responseCallback === 'function') responseCallback(resp);
      });
      if (res && typeof res.catch === 'function') {
        res.catch(() => {});
      }
    } catch (e) {
      // Suppress Extension context invalidated gracefully
    }
  }

  // Page error trap for developer debugging
  window.addEventListener('error', (event) => {
    capturedErrors.push({
      type: 'error',
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      timestamp: new Date().toLocaleTimeString()
    });
    if (capturedErrors.length > 50) capturedErrors.shift();
  });

  window.addEventListener('unhandledrejection', (event) => {
    capturedErrors.push({
      type: 'unhandledrejection',
      message: event.reason ? String(event.reason) : 'Unhandled Promise Rejection',
      timestamp: new Date().toLocaleTimeString()
    });
    if (capturedErrors.length > 50) capturedErrors.shift();
  });

  // Live Selection Intelligence (Claude for Chrome Parity)
  let selectionDebounce = null;
  document.addEventListener('selectionchange', () => {
    try {
      if (!chrome?.runtime?.id) return;
      clearTimeout(selectionDebounce);
      selectionDebounce = setTimeout(() => {
        try {
          if (!chrome?.runtime?.id) return;
          const selection = window.getSelection()?.toString().trim();
          if (selection && selection.length > 2 && selection.length < 4000) {
            safeSendMessage({
              type: 'PAGE_TEXT_SELECTED',
              text: selection
            });
          } else if (!selection) {
            safeSendMessage({
              type: 'PAGE_TEXT_CLEARED'
            });
          }
        } catch (e) {}
      }, 280);
    } catch (e) {}
  });

  // Message router from Background & Sidepanel
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async () => {
      try {
        switch (message.type) {
          case 'GET_PAGE_CONTEXT': {
            const context = extractPageContext();
            sendResponse({ context });
            break;
          }

          case 'GET_INTERACTIVE_ELEMENTS': {
            const elements = indexInteractiveElements();
            if (message.toggleMarks !== undefined) {
              setMarksVisible(message.toggleMarks);
            }
            sendResponse({ elements });
            break;
          }

          case 'TOGGLE_MARKS': {
            setMarksVisible(message.show);
            sendResponse({ marksVisible });
            break;
          }

          case 'EXECUTE_ACTION': {
            clearSensitiveHighlight();
            const result = await executeAgentAction(message.action);
            sendResponse(result);
            break;
          }

          case 'HIGHLIGHT_SENSITIVE_TARGET': {
            const targetEl = document.querySelector(`[data-neima-id="${message.elementId}"]`);
            if (targetEl) {
              targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
              highlightSensitiveElement(targetEl);
              animateMuseToElement(targetEl, `Authorization Required: ${message.reason || 'Sensitive action'}`);
            }
            sendResponse({ success: true });
            break;
          }

          case 'CLEAR_SENSITIVE_TARGET': {
            clearSensitiveHighlight();
            returnCompanionToRest();
            sendResponse({ success: true });
            break;
          }

          case 'SYNC_MUSE_STATE': {
            syncMuseState(message.status, message.text);
            sendResponse({ success: true });
            break;
          }

          case 'SET_COMPANION_VISIBILITY': {
            setCompanionVisibility(message.visible);
            sendResponse({ success: true });
            break;
          }

          case 'START_INSPECTOR': {
            startElementInspector();
            sendResponse({ success: true });
            break;
          }

          case 'STOP_INSPECTOR': {
            stopElementInspector();
            sendResponse({ success: true });
            break;
          }

          case 'EXTRACT_TABLE_DATA': {
            const tables = extractTablesData();
            sendResponse({ tables });
            break;
          }

          case 'AUTOFILL_FORM': {
            const count = autofillForm(message.profile || {});
            sendResponse({ success: true, fieldsFilled: count });
            break;
          }

          case 'GET_DEBUG_LOGS': {
            sendResponse({ errors: capturedErrors });
            break;
          }

          case 'CLEAR_DEBUG_LOGS': {
            capturedErrors = [];
            sendResponse({ success: true });
            break;
          }

          case 'START_WORKFLOW_RECORDING': {
            startWorkflowRecording();
            sendResponse({ success: true });
            break;
          }

          case 'STOP_WORKFLOW_RECORDING': {
            const actions = stopWorkflowRecording();
            sendResponse({ success: true, actions });
            break;
          }

          case 'REPLAY_WORKFLOW_STEP': {
            const { action } = message;
            let target = null;
            if (action.selector) {
              try {
                target = document.querySelector(action.selector);
              } catch (e) {}
            }
            if (!target && action.text) {
              const elements = Array.from(document.querySelectorAll(action.tag || 'button, a, input, div, span'));
              target = elements.find((el) => (el.innerText || '').trim() === action.text);
            }
            if (target) {
              target.scrollIntoView({ behavior: 'smooth', block: 'center' });
              animateMuseToElement(target, `Replaying: ${action.actionType}`);
              await sleep(400);
              if (action.actionType === 'click') {
                target.click();
                spawnClickRipple(target);
              } else if (action.actionType === 'type') {
                target.focus();
                target.value = action.value || '';
                target.dispatchEvent(new Event('input', { bubbles: true }));
                target.dispatchEvent(new Event('change', { bubbles: true }));
              }
              sendResponse({ success: true });
            } else {
              sendResponse({ error: `Element not found for selector: ${action.selector}` });
            }
            break;
          }

          default:
            sendResponse({ status: 'unknown_action' });
        }
      } catch (err) {
        console.error('[Neima Content] Error:', err);
        sendResponse({ error: err.message });
      }
    })();

    return true;
  });

  /**
   * 3D MUSE COMPANION AVATAR MANAGER (PERSISTENT, DRAGGABLE & AMBIENT ROAMING)
   */
  let companionX = Math.max(30, window.innerWidth - 85);
  let companionY = Math.max(30, window.innerHeight - 135);
  let isCompanionVisible = true;
  let isDraggingCompanion = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let initialLeft = 0;
  let initialTop = 0;
  let hasDragged = false;
  let speechTimeout = null;
  let ambientRoamTimer = null;
  let lastMouseMoveTime = 0;
  let scrollTimeout = null;

  let blinkCycleTimer = null;
  let idleCuriosityTimer = null;
  let lastUserActivityTime = Date.now();

  function ensureMuseCompanion() {
    const parent = document.body || document.documentElement;
    if (!parent) return null;

    // Check if companion already exists in DOM and clean up any duplicates
    const existing = document.querySelectorAll('.neima-muse-companion');
    if (existing.length > 0) {
      for (let i = 1; i < existing.length; i++) {
        existing[i].remove();
      }
      museEl = existing[0];
      museSpeechEl = museEl.querySelector('#neimaMuseSpeech') || museEl.querySelector('.neima-muse-speech');
      return museEl;
    }

    if (museEl && parent.contains(museEl)) return museEl;

    museEl = document.createElement('div');
    museEl.className = 'neima-muse-companion idle-hidden';
    museEl.style.left = `${companionX}px`;
    museEl.style.top = `${companionY}px`;
    museEl.setAttribute('title', 'Neima Living 3D Cyber Companion (Active during tasks • Walks & Clicks • Draggable)');
    museEl.innerHTML = `
      <div class="neima-muse-speech" id="neimaMuseSpeech">Neima Ready</div>
      <div class="neima-muse-floater">
        <div class="neima-muse-rotator" id="neimaRotator">
          <!-- Head Sphere & Visor -->
          <div class="neima-muse-head-sphere" id="neimaHeadSphere">
            <div class="neima-muse-ring neima-muse-ring-1"></div>
            <div class="neima-muse-ring neima-muse-ring-2"></div>
            <div class="neima-muse-visor-dome">
              <svg class="neima-face-svg" viewBox="0 0 52 52" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <filter id="neimaCyberGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                <!-- Dark OLED Visor Screen -->
                <rect x="7" y="9" width="38" height="34" rx="17" fill="#040813" stroke="rgba(56, 189, 248, 0.45)" stroke-width="1.2" />

                <!-- Moving Eye Gaze & Mouth Group -->
                <g id="neimaFaceGaze" class="neima-face-gaze">
                  <!-- Left Eye -->
                  <g id="neimaEyeL" class="neima-eye" transform="translate(18, 22)">
                    <path class="eye-shape" d="M -5 3 L 0 -3 L 5 3" fill="none" stroke="#00f0ff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" filter="url(#neimaCyberGlow)" />
                  </g>

                  <!-- Right Eye -->
                  <g id="neimaEyeR" class="neima-eye" transform="translate(34, 22)">
                    <path class="eye-shape" d="M -5 3 L 0 -3 L 5 3" fill="none" stroke="#00f0ff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" filter="url(#neimaCyberGlow)" />
                  </g>

                  <!-- Animated Glowing Smile -->
                  <path id="neimaMouth" class="neima-mouth" d="M 21 32 Q 26 36 31 32" fill="none" stroke="#00f0ff" stroke-width="2.2" stroke-linecap="round" filter="url(#neimaCyberGlow)" />
                </g>

                <!-- Visor Glass Specular Arc Highlight -->
                <path d="M 12 16 A 14 14 0 0 1 40 16" fill="none" stroke="rgba(255, 255, 255, 0.45)" stroke-width="1.6" stroke-linecap="round" />
                <circle cx="15" cy="15" r="1.5" fill="rgba(255, 255, 255, 0.6)" />
              </svg>
              <div class="neima-muse-hologram-scan"></div>
            </div>
          </div>

          <!-- Cyber-Torso & Glowing Reactor Core -->
          <div class="neima-muse-body">
            <div class="neima-muse-chest-armor">
              <div class="neima-muse-core-reactor"></div>
            </div>

            <!-- Left Cyber-Arm -->
            <div class="neima-muse-arm arm-left" id="neimaArmL">
              <div class="arm-upper"></div>
              <div class="arm-forearm"></div>
              <div class="arm-hand">
                <span class="finger-pointer"></span>
              </div>
            </div>

            <!-- Right Cyber-Arm (Reaches & Clicks) -->
            <div class="neima-muse-arm arm-right" id="neimaArmR">
              <div class="arm-upper"></div>
              <div class="arm-forearm"></div>
              <div class="arm-hand">
                <span class="finger-pointer"></span>
              </div>
            </div>
          </div>

          <!-- Pelvis & Cyber-Legs for Walking around the Screen -->
          <div class="neima-muse-pelvis"></div>
          <div class="neima-muse-legs-container">
            <div class="neima-muse-leg leg-left" id="neimaLegL">
              <div class="leg-thigh"></div>
              <div class="leg-knee"></div>
              <div class="leg-shin"></div>
              <div class="leg-foot"></div>
            </div>
            <div class="neima-muse-leg leg-right" id="neimaLegR">
              <div class="leg-thigh"></div>
              <div class="leg-knee"></div>
              <div class="leg-shin"></div>
              <div class="leg-foot"></div>
            </div>
          </div>
        </div>
      </div>
      <div class="neima-muse-beam"></div>
      <div class="neima-muse-jet"></div>
      <div class="neima-muse-shadow"></div>
    `;

    parent.appendChild(museEl);
    museSpeechEl = museEl.querySelector('#neimaMuseSpeech');

    // Drag-and-drop repositioning
    museEl.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      isDraggingCompanion = true;
      hasDragged = false;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      const rect = museEl.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;
      museEl.classList.add('dragging');
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDraggingCompanion || !museEl) return;
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasDragged = true;

      const newX = Math.max(10, Math.min(window.innerWidth - 65, initialLeft + dx));
      const newY = Math.max(10, Math.min(window.innerHeight - 75, initialTop + dy));
      museEl.style.left = `${newX}px`;
      museEl.style.top = `${newY}px`;
      companionX = newX;
      companionY = newY;
    });

    window.addEventListener('mouseup', () => {
      if (!isDraggingCompanion) return;
      isDraggingCompanion = false;
      if (museEl) museEl.classList.remove('dragging');
    });

    // Companion Hover Reaction: Perks up, smiles widely!
    museEl.addEventListener('mouseenter', () => {
      if (isDraggingCompanion) return;
      museEl.classList.add('happy');
      setCompanionMood('happy');
    });

    museEl.addEventListener('mouseleave', () => {
      if (!museEl.classList.contains('acting')) {
        museEl.classList.remove('happy');
        setCompanionMood('idle');
      }
    });

    // Companion click interaction: 3D barrel roll + wink + speech
    museEl.addEventListener('click', (e) => {
      if (hasDragged) return;
      e.stopPropagation();

      const rotator = museEl.querySelector('#neimaRotator');
      if (rotator) {
        rotator.style.transition = 'transform 0.7s cubic-bezier(0.16, 1, 0.3, 1)';
        rotator.style.transform = 'perspective(600px) rotateY(360deg)';
        setTimeout(() => {
          rotator.style.transition = '';
          rotator.style.transform = 'perspective(600px) rotateY(0deg)';
        }, 700);
      }

      setCompanionMood('wink');

      const phrases = [
        'Tracking project context in real-time',
        'Observing viewport and ready to execute',
        'Select any element or invoke quick tools',
        'Co-pilot active and exploring this tab',
        'Ready to run workflows and automate actions'
      ];
      const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];
      showMuseSpeech(randomPhrase, 3200);
    });

    // Start lifelike eye blinking and idle curiosity loops
    startBlinkCycle();
    startIdleCuriosityLoop();
    startAmbientRoaming();

    return museEl;
  }

  // 1. Natural Organic Eye Blinking System
  function startBlinkCycle() {
    clearTimeout(blinkCycleTimer);
    function scheduleBlink() {
      const delay = 2600 + Math.random() * 3000;
      blinkCycleTimer = setTimeout(() => {
        executeBlink(() => {
          scheduleBlink();
        });
      }, delay);
    }

    function executeBlink(callback) {
      const eyeL = museEl?.querySelector('#neimaEyeL');
      const eyeR = museEl?.querySelector('#neimaEyeR');
      if (!eyeL || !eyeR) return callback?.();

      eyeL.classList.add('blinking');
      eyeR.classList.add('blinking');

      setTimeout(() => {
        eyeL.classList.remove('blinking');
        eyeR.classList.remove('blinking');

        // 30% chance of an expressive double-blink!
        if (Math.random() < 0.3) {
          setTimeout(() => {
            eyeL.classList.add('blinking');
            eyeR.classList.add('blinking');
            setTimeout(() => {
              eyeL.classList.remove('blinking');
              eyeR.classList.remove('blinking');
              callback?.();
            }, 90);
          }, 110);
        } else {
          callback?.();
        }
      }, 120);
    }

    scheduleBlink();
  }

  // 2. Dynamic Smiling & Mood Expressions
  function setCompanionMood(mood) {
    if (!museEl) return;
    const mouth = museEl.querySelector('#neimaMouth');
    const eyeL = museEl.querySelector('#neimaEyeL .eye-shape');
    const eyeR = museEl.querySelector('#neimaEyeR .eye-shape');

    if (mood === 'happy') {
      if (mouth) mouth.setAttribute('d', 'M 19 31 Q 26 39 33 31'); // Big warm smile
      if (eyeL) eyeL.setAttribute('d', 'M -5 3 L 0 -3 L 5 3');
      if (eyeR) eyeR.setAttribute('d', 'M -5 3 L 0 -3 L 5 3');
    } else if (mood === 'thinking') {
      if (mouth) mouth.setAttribute('d', 'M 22 34 Q 26 34 30 34'); // Thoughtful line
      if (eyeL) eyeL.setAttribute('d', 'M -4 1 Q 0 -3 4 1');
      if (eyeR) eyeR.setAttribute('d', 'M -4 1 Q 0 -3 4 1');
    } else if (mood === 'wink') {
      if (mouth) mouth.setAttribute('d', 'M 19 31 Q 26 38 33 31');
      const eyeRGroup = museEl.querySelector('#neimaEyeR');
      eyeRGroup?.classList.add('blinking');
      setTimeout(() => {
        eyeRGroup?.classList.remove('blinking');
        setCompanionMood('idle');
      }, 750);
    } else {
      // Default gentle smile
      if (mouth) mouth.setAttribute('d', 'M 21 32 Q 26 36 31 32');
      if (eyeL) eyeL.setAttribute('d', 'M -5 3 L 0 -3 L 5 3');
      if (eyeR) eyeR.setAttribute('d', 'M -5 3 L 0 -3 L 5 3');
    }
  }

  // 3. 3D Head Turning & Gaze Tracking towards User Mouse
  window.addEventListener('mousemove', (e) => {
    lastUserActivityTime = Date.now();
    if (!museEl || !isCompanionVisible || isDraggingCompanion) return;

    const now = performance.now();
    if (now - lastMouseMoveTime < 20) return;
    lastMouseMoveTime = now;

    const rect = museEl.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;

    const headSphere = museEl.querySelector('#neimaHeadSphere');
    const gazeGroup = museEl.querySelector('#neimaFaceGaze');
    const bodyEl = museEl.querySelector('.neima-muse-body');

    if (headSphere && !museEl.classList.contains('acting')) {
      const maxRotY = 28;
      const maxRotX = 20;
      const rotY = Math.max(-maxRotY, Math.min(maxRotY, (dx / (window.innerWidth / 2)) * maxRotY));
      const rotX = Math.max(-maxRotX, Math.min(maxRotX, -(dy / (window.innerHeight / 2)) * maxRotX));
      const rotZ = rotY * 0.1; // Natural head tilt

      headSphere.style.transform = `perspective(500px) rotateY(${rotY.toFixed(1)}deg) rotateX(${rotX.toFixed(1)}deg) rotateZ(${rotZ.toFixed(1)}deg)`;
    }

    if (bodyEl && !museEl.classList.contains('acting')) {
      const bodyRotY = Math.max(-8, Math.min(8, (dx / (window.innerWidth / 2)) * 8));
      bodyEl.style.transform = `perspective(500px) rotateY(${bodyRotY.toFixed(1)}deg)`;
    }

    if (gazeGroup && !museEl.classList.contains('acting')) {
      const gazeX = Math.max(-3.5, Math.min(3.5, dx / 90));
      const gazeY = Math.max(-2.5, Math.min(2.5, dy / 90));
      gazeGroup.style.transform = `translate(${gazeX.toFixed(1)}px, ${gazeY.toFixed(1)}px)`;
    }
  }, { passive: true });

  // 4. Inquisitive Idle Curiosity: Tilts head, looks around, blinks, and smiles
  function startIdleCuriosityLoop() {
    clearInterval(idleCuriosityTimer);
    idleCuriosityTimer = setInterval(() => {
      if (!museEl || !isCompanionVisible || isDraggingCompanion || museEl.classList.contains('acting') || museEl.classList.contains('thinking')) return;

      const idleDuration = Date.now() - lastUserActivityTime;
      if (idleDuration > 5500) {
        const headSphere = museEl.querySelector('#neimaHeadSphere');
        const gazeGroup = museEl.querySelector('#neimaFaceGaze');
        if (!headSphere || !gazeGroup) return;

        // Step 1: Curious head tilt left & glance left
        headSphere.style.transition = 'transform 0.45s ease';
        headSphere.style.transform = 'perspective(500px) rotateY(-18deg) rotateX(8deg) rotateZ(-12deg)';
        gazeGroup.style.transform = 'translate(-3px, -1px)';

        setTimeout(() => {
          // Step 2: Glance right
          gazeGroup.style.transform = 'translate(3px, 0px)';
          headSphere.style.transform = 'perspective(500px) rotateY(16deg) rotateX(-6deg) rotateZ(8deg)';

          setTimeout(() => {
            // Step 3: Return to center and smile brightly!
            headSphere.style.transform = 'perspective(500px) rotateY(0deg) rotateX(0deg) rotateZ(0deg)';
            gazeGroup.style.transform = 'translate(0px, 0px)';
            setCompanionMood('happy');

            setTimeout(() => {
              headSphere.style.transition = '';
              setCompanionMood('idle');
            }, 1200);
          }, 800);
        }, 800);
      }
    }, 9000);
  }

  // 5. Living Ambient Floating & Roaming System
  function startAmbientRoaming() {
    clearInterval(ambientRoamTimer);
    let roamAngle = 0;
    ambientRoamTimer = setInterval(() => {
      if (!isCompanionVisible || isDraggingCompanion || !museEl) return;
      if (museEl.classList.contains('acting') || museEl.classList.contains('pointing')) return;

      const idleTime = Date.now() - lastUserActivityTime;
      roamAngle += 0.05;
      const driftX = Math.sin(roamAngle) * (idleTime > 5000 ? 7 : 3);
      const driftY = Math.cos(roamAngle * 0.8) * (idleTime > 5000 ? 5 : 2);

      museEl.style.transform = `translate3d(${driftX.toFixed(1)}px, ${driftY.toFixed(1)}px, 0)`;
    }, 60);
  }

  // Keep companion safely within viewport on window resize
  window.addEventListener('resize', () => {
    companionX = Math.max(25, Math.min(window.innerWidth - 75, companionX));
    companionY = Math.max(25, Math.min(window.innerHeight - 85, companionY));
    if (museEl && !museEl.classList.contains('acting') && !isDraggingCompanion) {
      museEl.style.left = `${companionX}px`;
      museEl.style.top = `${companionY}px`;
    }
  });

  function showMuseSpeech(text, duration = 3000) {
    if (!museSpeechEl) return;
    museSpeechEl.innerText = text;
    museSpeechEl.classList.add('active');
    clearTimeout(speechTimeout);
    if (duration > 0) {
      speechTimeout = setTimeout(() => {
        if (museSpeechEl) museSpeechEl.classList.remove('active');
      }, duration);
    }
  }

  /**
   * Walk & Click: Animates 3D Cyber Companion to walk to target element, tap with finger, and click
   */
  async function animateMuseToElement(targetEl, speechText, state = 'acting') {
    const muse = ensureMuseCompanion();
    if (!muse) return;
    muse.classList.remove('hidden', 'idle-hidden', 'happy', 'acting', 'pointing', 'thinking', 'observing', 'warning', 'clicking', 'celebrating');
    muse.classList.add(state);

    const rect = targetEl.getBoundingClientRect();
    const targetX = rect.left + rect.width / 2;
    const targetY = rect.top;

    const curX = parseFloat(muse.style.left) || companionX;
    const dx = targetX - curX;

    // Face in direction of walking
    if (dx < -15) {
      muse.classList.add('facing-left');
    } else if (dx > 15) {
      muse.classList.remove('facing-left');
    }

    // Step 1: Start walking stride!
    muse.classList.add('walking');

    const destX = Math.max(15, Math.min(window.innerWidth - 75, targetX - 32));
    const destY = Math.max(15, targetY - 78);
    muse.style.left = `${destX}px`;
    muse.style.top = `${destY}px`;

    if (speechText) {
      showMuseSpeech(speechText, 2500);
    }

    // Fast walking transit: 180ms
    await sleep(180);

    // Step 2: Arrived at element -> Stop walking, extend arm and click!
    muse.classList.remove('walking');
    muse.classList.add('clicking');

    // Laser/finger pulse
    muse.classList.add('pointing');

    // Fast click tap duration: 120ms
    await sleep(120);
    muse.classList.remove('pointing', 'clicking');
  }

  function returnCompanionToRest() {
    if (!museEl) return;
    museEl.classList.remove('pointing', 'acting', 'thinking', 'observing', 'warning', 'walking', 'clicking');
    setCompanionMood('idle');

    // Auto-hide off-screen when resting/idle so it does NOT block the user's view
    museEl.classList.add('idle-hidden');
    museEl.style.transform = '';
  }

  function hideMuseCompanion() {
    returnCompanionToRest();
  }

  function syncMuseState(status, text) {
    const muse = ensureMuseCompanion();
    if (!muse) return;

    muse.classList.remove('pointing', 'acting', 'thinking', 'observing', 'warning', 'happy', 'walking', 'clicking', 'celebrating');

    switch (status) {
      case 'OBSERVING':
      case 'RUNNING':
        // Active task started -> Wake up & become visible!
        muse.classList.remove('hidden', 'idle-hidden');
        muse.classList.add('observing', 'walking');
        setCompanionMood('happy');
        // Walk smoothly toward center top
        muse.style.left = `${Math.max(30, window.innerWidth / 2 - 32)}px`;
        muse.style.top = `40px`;
        showMuseSpeech(text || 'Observing page...', 2200);
        setTimeout(() => muse?.classList.remove('walking'), 220);
        break;

      case 'THINKING':
        muse.classList.remove('hidden', 'idle-hidden');
        muse.classList.add('thinking');
        setCompanionMood('thinking');
        showMuseSpeech(text || 'Thinking with AI...', 2500);
        break;

      case 'WAITING_CONFIRMATION':
        muse.classList.remove('hidden', 'idle-hidden');
        muse.classList.add('warning');
        setCompanionMood('idle');
        showMuseSpeech(text || 'Awaiting your authorization...', 4000);
        break;

      case 'COMPLETED':
        muse.classList.remove('hidden', 'idle-hidden');
        muse.classList.add('happy', 'celebrating');
        setCompanionMood('happy');
        showMuseSpeech(text || 'Task complete! ✨', 2000);
        // After brief victory celebration, smoothly retreat and hide!
        setTimeout(() => {
          returnCompanionToRest();
        }, 1400);
        break;

      case 'IDLE':
      default:
        // Automatically hide from screen when idle
        returnCompanionToRest();
        break;
    }
  }

  function setCompanionVisibility(visible) {
    isCompanionVisible = !!visible;
    const muse = ensureMuseCompanion();
    if (!muse) return;
    if (isCompanionVisible) {
      muse.classList.remove('hidden', 'idle-hidden');
      setCompanionMood('happy');
      showMuseSpeech('Neima ready for tasks!', 1800);
      setTimeout(() => {
        if (!muse.classList.contains('observing') && !muse.classList.contains('acting') && !muse.classList.contains('thinking')) {
          returnCompanionToRest();
        }
      }, 2000);
    } else {
      muse.classList.add('hidden', 'idle-hidden');
      clearInterval(ambientRoamTimer);
      if (museEl) museEl.style.transform = '';
    }
  }

  /**
   * Extract comprehensive page context
   */
  function extractPageContext() {
    const title = document.title || '';
    const url = window.location.href;
    const selectedText = window.getSelection() ? window.getSelection().toString().trim() : '';

    const descMeta = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
    const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';

    const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
      .filter(isElementVisible)
      .slice(0, 20)
      .map((h) => ({
        level: h.tagName.toLowerCase(),
        text: h.innerText.trim().slice(0, 100)
      }));

    const forms = Array.from(document.querySelectorAll('form')).map((form, i) => {
      const inputs = Array.from(form.querySelectorAll('input, select, textarea')).map((el) => ({
        tag: el.tagName.toLowerCase(),
        type: el.type || '',
        name: el.name || el.id || '',
        placeholder: el.placeholder || ''
      }));
      return { formIndex: i, id: form.id, inputsCount: inputs.length, inputs: inputs.slice(0, 10) };
    });

    const clone = document.body.cloneNode(true);
    const unwanted = clone.querySelectorAll('script, style, noscript, svg, nav, footer, iframe, .neima-muse-companion, .neima-badge');
    unwanted.forEach((el) => el.remove());
    const rawText = clone.innerText || '';
    const cleanedText = rawText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join('\n')
      .slice(0, 15000);

    return {
      title: ogTitle || title,
      url,
      description: descMeta,
      headings,
      forms,
      selectedText,
      cleanedText,
      totalTables: document.querySelectorAll('table').length
    };
  }

  /**
   * Set-of-Marks: Scan and index interactive elements
   */
  function indexInteractiveElements() {
    document.querySelectorAll('.neima-badge').forEach((b) => b.remove());

    const selector = [
      'a[href]',
      'button',
      'input:not([type="hidden"])',
      'select',
      'textarea',
      '[role="button"]',
      '[role="link"]',
      '[role="tab"]',
      '[role="checkbox"]',
      '[role="switch"]',
      '[contenteditable="true"]'
    ].join(',');

    const candidates = Array.from(document.querySelectorAll(selector));
    const indexed = [];
    let idCounter = 1;

    for (const el of candidates) {
      if (!isElementVisible(el)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 8 || rect.height < 8) continue;

      const elementId = idCounter++;
      el.setAttribute('data-neima-id', String(elementId));

      const tag = el.tagName.toUpperCase();
      let text = (el.innerText || el.value || el.placeholder || el.getAttribute('aria-label') || '').trim();
      text = text.replace(/\s+/g, ' ').slice(0, 80);

      indexed.push({
        id: elementId,
        tag,
        type: el.type || null,
        text,
        placeholder: el.placeholder || null,
        name: el.name || el.id || null,
        ariaLabel: el.getAttribute('aria-label') || null,
        href: el.href || null,
        value: el.value || null,
        rect: {
          x: Math.round(rect.left + window.scrollX),
          y: Math.round(rect.top + window.scrollY),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        }
      });
    }

    if (marksVisible) {
      renderMarks();
    }

    return indexed.slice(0, 120);
  }

  function setMarksVisible(visible) {
    marksVisible = visible;
    if (visible) {
      renderMarks();
    } else {
      document.querySelectorAll('.neima-badge').forEach((b) => b.remove());
    }
  }

  function renderMarks() {
    document.querySelectorAll('.neima-badge').forEach((b) => b.remove());

    const markedElements = document.querySelectorAll('[data-neima-id]');
    markedElements.forEach((el) => {
      const id = el.getAttribute('data-neima-id');
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;

      const badge = document.createElement('span');
      badge.className = 'neima-badge';
      badge.innerText = id;
      badge.style.left = `${rect.left + window.scrollX + 6}px`;
      badge.style.top = `${rect.top + window.scrollY + 6}px`;

      document.body.appendChild(badge);
    });
  }

  /**
   * Execute atomic browser actions with 3D Muse Companion Animation
   */
  async function executeAgentAction(action) {
    const { actionType, elementId, selector, value, scrollDirection, scrollAmount } = action;

    let targetEl = null;
    if (elementId) {
      targetEl = document.querySelector(`[data-neima-id="${elementId}"]`);
    } else if (selector) {
      targetEl = document.querySelector(selector);
    }

    showToast(`Neima Muse: ${actionType.toUpperCase()}${targetEl ? ` on [${elementId || selector}]` : ''}`);

    switch (actionType) {
      case 'click': {
        if (!targetEl) return { error: `Element [${elementId || selector}] not found` };
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(70);

        // Walk 3D Companion to element and tap with finger
        await animateMuseToElement(targetEl, `Clicking [${elementId || selector}]`);

        // Highlight and spawn 3D energy ripple
        highlightElement(targetEl);
        spawnClickRipple(targetEl);

        const rect = targetEl.getBoundingClientRect();
        const clientX = rect.left + rect.width / 2;
        const clientY = rect.top + rect.height / 2;

        const eventOpts = { bubbles: true, cancelable: true, view: window, clientX, clientY };
        targetEl.dispatchEvent(new PointerEvent('pointerdown', eventOpts));
        targetEl.dispatchEvent(new MouseEvent('mousedown', eventOpts));
        targetEl.focus();
        targetEl.dispatchEvent(new PointerEvent('pointerup', eventOpts));
        targetEl.dispatchEvent(new MouseEvent('mouseup', eventOpts));
        targetEl.click();

        return { success: true, message: `Clicked element [${elementId || selector}]` };
      }

      case 'type': {
        if (!targetEl) return { error: `Input element [${elementId || selector}] not found` };
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(70);

        // Walk 3D Companion to element
        await animateMuseToElement(targetEl, `Typing "${value}"`);

        highlightElement(targetEl);
        targetEl.focus();

        if (targetEl.tagName === 'INPUT' || targetEl.tagName === 'TEXTAREA') {
          targetEl.value = value || '';
          targetEl.dispatchEvent(new Event('input', { bubbles: true }));
          targetEl.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (targetEl.isContentEditable) {
          targetEl.innerText = value || '';
          targetEl.dispatchEvent(new Event('input', { bubbles: true }));
        }

        return { success: true, message: `Typed "${value}" into element [${elementId || selector}]` };
      }

      case 'press_enter': {
        if (!targetEl) return { error: `Element [${elementId || selector}] not found` };
        targetEl.focus();
        const keyOpts = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
        targetEl.dispatchEvent(new KeyboardEvent('keydown', keyOpts));
        targetEl.dispatchEvent(new KeyboardEvent('keypress', keyOpts));
        targetEl.dispatchEvent(new KeyboardEvent('keyup', keyOpts));

        const parentForm = targetEl.closest('form');
        if (parentForm) {
          parentForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        }

        return { success: true, message: 'Pressed Enter' };
      }

      case 'select':
      case 'select_option': {
        if (!targetEl || targetEl.tagName !== 'SELECT') {
          return { error: `Select dropdown [${elementId || selector}] not found` };
        }
        await animateMuseToElement(targetEl, `Selecting "${value}"`);
        let matched = Array.from(targetEl.options).find(
          (opt) =>
            opt.value.toLowerCase() === String(value).toLowerCase() ||
            opt.text.toLowerCase().includes(String(value).toLowerCase())
        );
        if (matched) {
          targetEl.value = matched.value;
        } else {
          targetEl.value = value;
        }
        targetEl.dispatchEvent(new Event('input', { bubbles: true }));
        targetEl.dispatchEvent(new Event('change', { bubbles: true }));
        hideMuseCompanion();
        return { success: true, message: `Selected option "${targetEl.value}"` };
      }

      case 'check':
      case 'uncheck': {
        if (!targetEl) return { error: `Checkbox [${elementId || selector}] not found` };
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await animateMuseToElement(targetEl, `${actionType}ing element`);
        highlightElement(targetEl);
        const shouldCheck = actionType === 'check';
        if (targetEl.checked !== shouldCheck) {
          targetEl.checked = shouldCheck;
          targetEl.dispatchEvent(new Event('change', { bubbles: true }));
          targetEl.dispatchEvent(new Event('input', { bubbles: true }));
          targetEl.click();
        }
        hideMuseCompanion();
        return { success: true, message: `${actionType}ed element [${elementId || selector}]` };
      }

      case 'hover': {
        if (!targetEl) return { error: `Element [${elementId || selector}] not found` };
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await animateMuseToElement(targetEl, `Hovering over element`);
        highlightElement(targetEl);
        const rect = targetEl.getBoundingClientRect();
        const clientX = rect.left + rect.width / 2;
        const clientY = rect.top + rect.height / 2;
        const mouseOpts = { bubbles: true, cancelable: true, view: window, clientX, clientY };
        targetEl.dispatchEvent(new MouseEvent('mouseover', mouseOpts));
        targetEl.dispatchEvent(new MouseEvent('mouseenter', mouseOpts));
        targetEl.dispatchEvent(new MouseEvent('mousemove', mouseOpts));
        await sleep(350);
        hideMuseCompanion();
        return { success: true, message: `Hovered over element [${elementId || selector}]` };
      }

      case 'wait': {
        const ms = Math.min(action.duration || 1000, 5000);
        showToast(`Neima: Waiting ${ms}ms for dynamic page state...`);
        await sleep(ms);
        return { success: true, message: `Waited for ${ms}ms` };
      }

      case 'key_press': {
        const key = action.key || 'Escape';
        const target = targetEl || document.activeElement || document.body;
        target.dispatchEvent(new KeyboardEvent('keydown', { key, code: key, bubbles: true }));
        target.dispatchEvent(new KeyboardEvent('keyup', { key, code: key, bubbles: true }));
        return { success: true, message: `Pressed key "${key}"` };
      }

      case 'scroll': {
        const amount = scrollAmount || 450;
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else if (scrollDirection === 'up') {
          window.scrollBy({ top: -amount, behavior: 'smooth' });
        } else if (scrollDirection === 'down') {
          window.scrollBy({ top: amount, behavior: 'smooth' });
        } else if (scrollDirection === 'top') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (scrollDirection === 'bottom') {
          window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        }
        await sleep(300);
        return { success: true, message: `Scrolled ${scrollDirection || 'to element'}` };
      }

      case 'extract_data':
      case 'extract_text': {
        if (targetEl) {
          return { success: true, data: targetEl.innerText.trim() };
        }
        const query = action.query || 'h1, h2, h3, p, table, ul, ol';
        const items = Array.from(document.querySelectorAll(query)).map((e) => e.innerText.trim()).filter(Boolean);
        return { success: true, data: items.slice(0, 40) };
      }

      default:
        return { error: `Unrecognized action type: ${actionType}` };
    }
  }

  function highlightElement(el) {
    el.classList.add('neima-highlight-active');
    setTimeout(() => {
      el.classList.remove('neima-highlight-active');
    }, 1500);
  }

  function highlightSensitiveElement(el) {
    clearSensitiveHighlight();
    el.classList.add('neima-highlight-sensitive');
  }

  function clearSensitiveHighlight() {
    document.querySelectorAll('.neima-highlight-sensitive').forEach((el) => {
      el.classList.remove('neima-highlight-sensitive');
    });
  }

  function spawnClickRipple(el) {
    const rect = el.getBoundingClientRect();
    const ripple = document.createElement('div');
    ripple.className = 'neima-click-ripple';
    ripple.style.left = `${rect.left + window.scrollX + rect.width / 2}px`;
    ripple.style.top = `${rect.top + window.scrollY + rect.height / 2}px`;
    document.body.appendChild(ripple);
    setTimeout(() => ripple.remove(), 800);
  }

  /**
   * Interactive Click-to-Ask Element Inspector with 3D Muse Companion
   */
  function startElementInspector() {
    if (inspectorActive) return;
    inspectorActive = true;
    document.body.style.cursor = 'none'; // Hide default pointer in favor of Muse!

    // Summon 3D Muse Companion
    const muse = ensureMuseCompanion();
    muse.classList.remove('hidden');
    muse.classList.add('acting', 'pointing');
    if (museSpeechEl) {
      museSpeechEl.innerText = 'Scanning DOM...';
      museSpeechEl.classList.add('active');
    }

    inspectorOverlay = document.createElement('div');
    inspectorOverlay.className = 'neima-inspector-box';
    document.body.appendChild(inspectorOverlay);

    inspectorTooltip = document.createElement('div');
    inspectorTooltip.className = 'neima-inspector-tooltip';
    document.body.appendChild(inspectorTooltip);

    window.addEventListener('mousemove', onInspectorMouseMove, true);
    window.addEventListener('click', onInspectorClick, true);
    window.addEventListener('keydown', onInspectorKeyDown, true);

    showToast('Neima Muse Inspector active: Hover & click any element (Esc to cancel)');
  }

  function stopElementInspector() {
    if (!inspectorActive) return;
    inspectorActive = false;
    document.body.style.cursor = '';

    if (inspectorOverlay) inspectorOverlay.remove();
    if (inspectorTooltip) inspectorTooltip.remove();
    inspectorOverlay = null;
    inspectorTooltip = null;

    hideMuseCompanion();

    window.removeEventListener('mousemove', onInspectorMouseMove, true);
    window.removeEventListener('click', onInspectorClick, true);
    window.removeEventListener('keydown', onInspectorKeyDown, true);
  }

  function onInspectorMouseMove(e) {
    if (!inspectorActive) return;

    // Follow cursor with 3D Muse companion
    if (museEl) {
      museEl.style.left = `${e.pageX - 36}px`;
      museEl.style.top = `${e.pageY - 72}px`;
    }

    const target = e.target;
    if (target === inspectorOverlay || target === inspectorTooltip || target.closest('.neima-toast-container') || target.closest('.neima-muse-companion')) return;

    const rect = target.getBoundingClientRect();
    if (inspectorOverlay) {
      inspectorOverlay.style.left = `${rect.left + window.scrollX}px`;
      inspectorOverlay.style.top = `${rect.top + window.scrollY}px`;
      inspectorOverlay.style.width = `${rect.width}px`;
      inspectorOverlay.style.height = `${rect.height}px`;
    }

    const tag = target.tagName.toLowerCase();
    const idStr = target.id ? `#${target.id}` : '';
    const classStr = target.className && typeof target.className === 'string' ? `.${target.className.split(' ').slice(0, 2).join('.')}` : '';

    if (inspectorTooltip) {
      inspectorTooltip.innerHTML = `<span class="tag-name">&lt;${tag}&gt;</span> <span class="attr-info">${idStr}${classStr}</span> (${Math.round(rect.width)}x${Math.round(rect.height)})`;
      inspectorTooltip.style.left = `${rect.left + window.scrollX}px`;
      inspectorTooltip.style.top = `${rect.top + window.scrollY}px`;
    }
  }

  function onInspectorClick(e) {
    if (!inspectorActive) return;
    e.preventDefault();
    e.stopPropagation();

    const target = e.target;
    stopElementInspector();

    const tag = target.tagName.toLowerCase();
    const text = target.innerText ? target.innerText.slice(0, 500).trim() : '';
    const outerHtml = target.outerHTML ? target.outerHTML.slice(0, 1000) : '';
    const selector = generateCssSelector(target);

    safeSendMessage({
      type: 'INSPECTED_ELEMENT',
      element: {
        tag,
        text,
        outerHtml,
        selector
      }
    });

    showToast(`Element <${tag}> captured by Neima Muse`);
  }

  function onInspectorKeyDown(e) {
    if (e.key === 'Escape') {
      stopElementInspector();
      showToast('Inspector canceled');
    }
  }

  function generateCssSelector(el) {
    if (el.id) return `#${el.id}`;
    let path = [];
    while (el && el.nodeType === Node.ELEMENT_NODE) {
      let selector = el.nodeName.toLowerCase();
      if (el.id) {
        selector += `#${el.id}`;
        path.unshift(selector);
        break;
      } else {
        let sib = el, nth = 1;
        while ((sib = sib.previousElementSibling)) {
          if (sib.nodeName.toLowerCase() === selector) nth++;
        }
        if (nth !== 1) selector += `:nth-of-type(${nth})`;
      }
      path.unshift(selector);
      el = el.parentNode;
    }
    return path.join(' > ');
  }

  function extractTablesData() {
    const tables = document.querySelectorAll('table');
    const results = [];

    tables.forEach((table, index) => {
      const headers = Array.from(table.querySelectorAll('th')).map((th) => th.innerText.trim());
      const rows = [];
      const trs = table.querySelectorAll('tbody tr, tr');

      trs.forEach((tr) => {
        const tds = Array.from(tr.querySelectorAll('td')).map((td) => td.innerText.trim());
        if (tds.length > 0) rows.push(tds);
      });

      if (rows.length > 0) {
        results.push({
          tableIndex: index + 1,
          headers: headers.length > 0 ? headers : rows[0].map((_, i) => `Column ${i + 1}`),
          rows: headers.length > 0 ? rows : rows.slice(1)
        });
      }
    });

    return results;
  }

  function autofillForm(profile) {
    const inputs = document.querySelectorAll('input:not([type="hidden"]), textarea');
    let filled = 0;

    inputs.forEach((input) => {
      if (input.value && input.value.trim().length > 0) return;

      const name = (input.name || input.id || input.placeholder || input.getAttribute('autocomplete') || '').toLowerCase();
      const type = (input.type || '').toLowerCase();

      let valToSet = null;

      if (type === 'email' || name.includes('email') || name.includes('e-mail')) {
        valToSet = profile.email || 'alex.morgan@example.com';
      } else if (name.includes('name') && (name.includes('full') || name.includes('user'))) {
        valToSet = profile.fullName || 'Alex Morgan';
      } else if (name.includes('first')) {
        valToSet = (profile.fullName || 'Alex Morgan').split(' ')[0];
      } else if (name.includes('last')) {
        valToSet = (profile.fullName || 'Alex Morgan').split(' ')[1] || 'Morgan';
      } else if (type === 'tel' || name.includes('phone') || name.includes('mobile')) {
        valToSet = profile.phone || '+1 (555) 234-5678';
      } else if (name.includes('company') || name.includes('organization')) {
        valToSet = profile.company || 'TechFlow Dynamics';
      } else if (name.includes('job') || name.includes('role') || name.includes('title')) {
        valToSet = profile.jobTitle || 'Senior Software Architect';
      } else if (name.includes('address') || name.includes('street')) {
        valToSet = profile.address || '742 Evergreen Terrace, Springfield, OR';
      } else if (name.includes('zip') || name.includes('postal')) {
        valToSet = profile.zipCode || '97477';
      } else if (name.includes('country')) {
        valToSet = profile.country || 'United States';
      }

      if (valToSet) {
        input.value = valToSet;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        highlightElement(input);
        filled++;
      }
    });

    showToast(`Neima Muse: Autofilled ${filled} form fields`);
    return filled;
  }

  function showToast(text) {
    let container = document.querySelector('.neima-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'neima-toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'neima-toast';
    toast.innerHTML = `
      <div class="neima-toast-icon">⟐</div>
      <span>${escapeHtml(text)}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  }

  // ==========================================================================
  // WORKFLOW RECORDER (CLAUDE IN CHROME PARITY)
  // ==========================================================================
  let isRecordingWorkflow = false;
  let recordedWorkflowActions = [];

  function calculateElementSelector(el) {
    if (!el || el === document.body || el === document.documentElement) return '';
    if (el.id) return `#${CSS.escape(el.id)}`;
    if (el.name) return `${el.tagName.toLowerCase()}[name="${CSS.escape(el.name)}"]`;
    if (el.getAttribute('data-testid')) return `[data-testid="${CSS.escape(el.getAttribute('data-testid'))}"]`;
    if (el.getAttribute('aria-label')) return `[aria-label="${CSS.escape(el.getAttribute('aria-label'))}"]`;
    if (el.placeholder) return `${el.tagName.toLowerCase()}[placeholder="${CSS.escape(el.placeholder)}"]`;

    let sel = el.tagName.toLowerCase();
    if (el.className && typeof el.className === 'string') {
      const cls = el.className.trim().split(/\s+/).filter((c) => !c.startsWith('neima-')).slice(0, 2);
      if (cls.length > 0) sel += '.' + cls.map((c) => CSS.escape(c)).join('.');
    }
    return sel;
  }

  function handleRecordClick(e) {
    if (!isRecordingWorkflow) return;
    if (e.target.closest('.neima-muse-companion') || e.target.closest('.neima-inspector-box') || e.target.closest('.neima-toast-container')) return;
    const target = e.target;
    const selector = calculateElementSelector(target);
    const text = (target.innerText || target.value || target.getAttribute('aria-label') || '').slice(0, 35).trim();

    const action = {
      actionType: 'click',
      selector,
      tag: target.tagName.toLowerCase(),
      text,
      url: window.location.href,
      timestamp: Date.now()
    };
    recordedWorkflowActions.push(action);
    safeSendMessage({ type: 'WORKFLOW_ACTION_CAPTURED', action, totalCount: recordedWorkflowActions.length });
    showMuseSpeech(`🔴 Recorded: Click "${text || selector}"`);
    spawnClickRipple(target);
  }

  function handleRecordInput(e) {
    if (!isRecordingWorkflow) return;
    if (e.target.closest('.neima-muse-companion')) return;
    const target = e.target;
    const selector = calculateElementSelector(target);
    const val = target.value || '';

    const last = recordedWorkflowActions[recordedWorkflowActions.length - 1];
    if (last && last.actionType === 'type' && last.selector === selector) {
      last.value = val;
    } else {
      const action = {
        actionType: 'type',
        selector,
        tag: target.tagName.toLowerCase(),
        value: val,
        url: window.location.href,
        timestamp: Date.now()
      };
      recordedWorkflowActions.push(action);
    }
    safeSendMessage({ type: 'WORKFLOW_ACTION_CAPTURED', totalCount: recordedWorkflowActions.length });
  }

  function startWorkflowRecording() {
    isRecordingWorkflow = true;
    recordedWorkflowActions = [];
    document.addEventListener('click', handleRecordClick, true);
    document.addEventListener('input', handleRecordInput, true);

    const muse = ensureMuseCompanion();
    if (muse) {
      muse.classList.remove('hidden');
      muse.classList.add('acting');
    }
    showMuseSpeech('🔴 Recording Workflow... Perform actions on page');
  }

  function stopWorkflowRecording() {
    isRecordingWorkflow = false;
    document.removeEventListener('click', handleRecordClick, true);
    document.removeEventListener('input', handleRecordInput, true);

    const muse = ensureMuseCompanion();
    if (muse) muse.classList.remove('acting');
    showMuseSpeech('Workflow recording complete! ✨');
    return [...recordedWorkflowActions];
  }

  function isElementVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.innerText = str;
    return div.innerHTML;
  }

  // Auto-initialize persistent 3D Muse Companion on page
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ensureMuseCompanion());
  } else {
    ensureMuseCompanion();
  }
})();
