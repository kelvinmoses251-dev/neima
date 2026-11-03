/**
 * Neima — AI Autonomous Browser Agent Showcase & Interactive Simulator Engine
 * Features:
 * - Real-time 3D spatial mouse tracking with gyroscopic orbital rings
 * - Canvas-based radiant laser targeting beam with particle hit sparks
 * - Live interactive sandboxed browser agent simulator with 4 scenario recipes
 * - Set-of-Marks in-page element tagging engine
 * - Human-in-the-loop step approval demo
 * - 1-Click install walkthrough modal & clipboard managers
 */

document.addEventListener('DOMContentLoaded', () => {
  initHeroSpatialMuse();
  initHeroMissionLauncher();
  initLiveTelemetryTicker();
  initInPageLivingMuse();
  initSimulatorEngine();
  initModalAndClipboard();
  initSmoothScroll();
});

/* ==========================================================================
   1. HERO SPATIAL MUSE & LASER BEAM ENGINE
   ========================================================================== */

function initHeroSpatialMuse() {
  const viewport = document.getElementById('museViewport');
  const canvas = document.getElementById('laserCanvas');
  const muse = document.getElementById('spatialMuse');
  const bubbleText = document.getElementById('bubbleText');
  const targetLockStatus = document.getElementById('targetLockStatus');
  const targetCoords = document.getElementById('targetCoords');
  const museCurrentMood = document.getElementById('museCurrentMood');
  const targetNodes = document.querySelectorAll('.target-node');

  if (!viewport || !canvas || !muse) return;

  const ctx = canvas.getContext('2d');
  let width, height;
  let particles = [];
  let isTargetLocked = false;
  let currentTargetX = null;
  let currentTargetY = null;
  let currentAction = 'Hovering';

  function resizeCanvas() {
    width = canvas.width = viewport.clientWidth;
    height = canvas.height = viewport.clientHeight;
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Default initial position of the Muse
  let museX = 140;
  let museY = 180;
  let targetMuseX = 140;
  let targetMuseY = 180;

  // Track mouse coordinates & Living Head Gaze
  viewport.addEventListener('mousemove', (e) => {
    const rect = viewport.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (!isTargetLocked) {
      currentTargetX = mouseX;
      currentTargetY = mouseY;
      targetCoords.textContent = `X: ${Math.round(mouseX)}px | Y: ${Math.round(mouseY)}px`;
      targetLockStatus.textContent = `Tracking Cursor (${Math.round(mouseX)}, ${Math.round(mouseY)})`;
    }

    // Ease muse slightly toward the cursor position with lag for levitation feel
    targetMuseX = Math.max(70, Math.min(width - 150, mouseX - 120));
    targetMuseY = Math.max(60, Math.min(height - 120, mouseY - 60));

    // 3D Head Turning & Eye Gaze towards cursor
    const rotator = document.getElementById('heroMuseRotator');
    const gaze = document.getElementById('heroFaceGaze');
    if (rotator) {
      const rotY = Math.max(-28, Math.min(28, ((mouseX - museX) / width) * 55));
      const rotX = Math.max(-22, Math.min(22, -((mouseY - museY) / height) * 55));
      rotator.style.transform = `perspective(500px) rotateY(${rotY.toFixed(1)}deg) rotateX(${rotX.toFixed(1)}deg)`;
    }
    if (gaze) {
      const gazeX = Math.max(-3, Math.min(3, (mouseX - museX) / 80));
      const gazeY = Math.max(-2, Math.min(2, (mouseY - museY) / 80));
      gaze.style.transform = `translate(${gazeX.toFixed(1)}px, ${gazeY.toFixed(1)}px)`;
    }
  });

  viewport.addEventListener('mouseleave', () => {
    if (!isTargetLocked) {
      currentTargetX = null;
      currentTargetY = null;
      targetLockStatus.textContent = 'Awaiting User Focus';
      targetMuseX = 140;
      targetMuseY = 180;
      bubbleText.textContent = 'Neima ready. Launch any mission or hover interactive nodes!';
      const rotator = document.getElementById('heroMuseRotator');
      const gaze = document.getElementById('heroFaceGaze');
      if (rotator) rotator.style.transform = '';
      if (gaze) gaze.style.transform = '';
    }
  });

  // Natural Eye Blinking Cycle on Hero Mascot
  let heroBlinkTimer = null;
  function scheduleHeroBlink() {
    clearTimeout(heroBlinkTimer);
    const delay = 2400 + Math.random() * 2800;
    heroBlinkTimer = setTimeout(() => {
      const eyeL = document.getElementById('heroEyeL');
      const eyeR = document.getElementById('heroEyeR');
      if (eyeL && eyeR) {
        eyeL.classList.add('blinking');
        eyeR.classList.add('blinking');
        setTimeout(() => {
          eyeL.classList.remove('blinking');
          eyeR.classList.remove('blinking');
          if (Math.random() < 0.35) {
            setTimeout(() => {
              eyeL.classList.add('blinking');
              eyeR.classList.add('blinking');
              setTimeout(() => {
                eyeL.classList.remove('blinking');
                eyeR.classList.remove('blinking');
                scheduleHeroBlink();
              }, 90);
            }, 110);
          } else {
            scheduleHeroBlink();
          }
        }, 110);
      } else {
        scheduleHeroBlink();
      }
    }, delay);
  }
  scheduleHeroBlink();

  // Dynamic Mood Expressions on Hero Mascot
  function setHeroMood(mood) {
    const mouth = document.getElementById('heroMouth');
    const eyeL = document.querySelector('#heroEyeL .eye-shape');
    const eyeR = document.querySelector('#heroEyeR .eye-shape');
    if (!mouth) return;

    if (mood === 'happy') {
      mouth.setAttribute('d', 'M 19 31 Q 26 39 33 31');
      if (eyeL) eyeL.setAttribute('d', 'M -5 3 L 0 -3 L 5 3');
      if (eyeR) eyeR.setAttribute('d', 'M -5 3 L 0 -3 L 5 3');
    } else if (mood === 'thinking') {
      mouth.setAttribute('d', 'M 22 34 Q 26 34 30 34');
      if (eyeL) eyeL.setAttribute('d', 'M -4 1 Q 0 -3 4 1');
      if (eyeR) eyeR.setAttribute('d', 'M -4 1 Q 0 -3 4 1');
    } else if (mood === 'wink') {
      mouth.setAttribute('d', 'M 19 31 Q 26 38 33 31');
      const eyeRGroup = document.getElementById('heroEyeR');
      eyeRGroup?.classList.add('blinking');
      setTimeout(() => {
        eyeRGroup?.classList.remove('blinking');
        setHeroMood('idle');
      }, 700);
    } else {
      mouth.setAttribute('d', 'M 21 32 Q 26 36 31 32');
      if (eyeL) eyeL.setAttribute('d', 'M -5 3 L 0 -3 L 5 3');
      if (eyeR) eyeR.setAttribute('d', 'M -5 3 L 0 -3 L 5 3');
    }
  }
  window.setHeroMascotMood = setHeroMood;

  window.fireHeroMissionTarget = (targetX, targetY, actionText) => {
    isTargetLocked = true;
    currentTargetX = targetX;
    currentTargetY = targetY;
    if (bubbleText) bubbleText.textContent = actionText;
    createSparks(targetX, targetY, 24);
    setTimeout(() => {
      isTargetLocked = false;
    }, 2000);
  };

  // Clicking targets on stage
  targetNodes.forEach(node => {
    node.addEventListener('mouseenter', () => {
      isTargetLocked = true;
      const rect = node.getBoundingClientRect();
      const vRect = viewport.getBoundingClientRect();
      currentTargetX = rect.left - vRect.left + rect.width / 2;
      currentTargetY = rect.top - vRect.top + rect.height / 2;

      const label = node.dataset.label;
      const action = node.dataset.action;
      bubbleText.textContent = action;
      targetLockStatus.textContent = `Target Locked: ${label}`;
      museCurrentMood.textContent = 'SCANNING • TARGET LOCKED';
      node.classList.add('targeted');

      // Spawn burst particles
      createSparks(currentTargetX, currentTargetY, 12);
    });

    node.addEventListener('mouseleave', () => {
      isTargetLocked = false;
      node.classList.remove('targeted');
      museCurrentMood.textContent = 'ACTIVE • HOVERING';
    });

    node.addEventListener('click', () => {
      const label = node.dataset.label;
      bubbleText.textContent = `Autonomous execution dispatched on ${label}!`;
      createSparks(currentTargetX, currentTargetY, 30);
      showToast(`Action dispatched on ${label}`);
    });
  });

  function createSparks(x, y, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 4;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 1.5 + Math.random() * 2.5,
        alpha: 1,
        color: Math.random() > 0.4 ? '#00f0ff' : '#ffffff'
      });
    }
  }

  // Animation Loop: Easing + Laser Ray + Particles
  function animate() {
    ctx.clearRect(0, 0, width, height);

    // Smooth lerp muse position
    museX += (targetMuseX - museX) * 0.08;
    museY += (targetMuseY - museY) * 0.08;

    muse.style.left = `${museX}px`;
    muse.style.top = `${museY}px`;

    // Calculate Emitter origin
    const emitterX = museX + 40;
    const emitterY = museY + 45;

    // Draw Laser Beam if active target exists
    if (currentTargetX !== null && currentTargetY !== null) {
      const dx = currentTargetX - emitterX;
      const dy = currentTargetY - emitterY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Rotate muse sphere slightly towards target
      const angle = Math.atan2(dy, dx);
      const rotY = (dx / width) * 25;
      const rotX = -(dy / height) * 25;
      const museSphere = document.getElementById('museSphere');
      if (museSphere) {
        museSphere.style.transform = `rotateY(${rotY}deg) rotateX(${rotX}deg)`;
      }

      // Outer laser aura
      ctx.beginPath();
      ctx.moveTo(emitterX, emitterY);
      ctx.lineTo(currentTargetX, currentTargetY);
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
      ctx.lineWidth = 6;
      ctx.stroke();

      // Mid laser glow
      ctx.beginPath();
      ctx.moveTo(emitterX, emitterY);
      ctx.lineTo(currentTargetX, currentTargetY);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Core razor line
      ctx.beginPath();
      ctx.moveTo(emitterX, emitterY);
      ctx.lineTo(currentTargetX, currentTargetY);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Target impact ripple
      ctx.beginPath();
      ctx.arc(currentTargetX, currentTargetY, 6 + Math.sin(Date.now() / 150) * 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 240, 255, 0.5)';
      ctx.fill();

      // Continuous subtle target sparks
      if (Math.random() > 0.6) {
        createSparks(currentTargetX, currentTargetY, 2);
      }
    }

    // Update and draw particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.025;

      if (p.alpha <= 0) {
        particles.splice(i, 1);
        continue;
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    requestAnimationFrame(animate);
  }

  animate();
}

/* ==========================================================================
   2. INTERACTIVE LIVE AGENT SIMULATOR ENGINE
   ========================================================================== */

const RECIPES_DATA = {
  flight: {
    title: 'Google Flights & Travel Hub',
    url: 'https://flights.google.com/search?q=SFO+to+Tokyo',
    prompt: 'Find lowest roundtrip fare to Tokyo departing Nov 12',
    steps: [
      {
        delay: 500,
        thought: 'Observing DOM: Located flight destination input and departure parameters.',
        musePos: { x: 230, y: 130 },
        speech: 'Setting destination...',
        action: 'type',
        targetId: 'simDestInput',
        value: 'Tokyo (HND)',
        laser: true
      },
      {
        delay: 1500,
        thought: 'Navigating dates: Applying flexible +3 day filter for maximum fare savings.',
        musePos: { x: 380, y: 130 },
        speech: 'Optimizing calendar dates...',
        action: 'highlight',
        targetId: 'simDateInput',
        laser: true
      },
      {
        delay: 1400,
        thought: 'Executing search: Triggering primary query submit button [4].',
        musePos: { x: 440, y: 220 },
        speech: 'Submitting query...',
        action: 'click',
        targetId: 'simSearchBtn',
        laser: true
      },
      {
        delay: 1600,
        thought: 'Results captured: Found nonstop ANA Flight #108 at $448 roundtrip (32% below median).',
        musePos: { x: 260, y: 280 },
        speech: 'Success! Best flight saved.',
        action: 'result',
        laser: false
      }
    ],
    renderWeb: () => `
      <div class="web-flight-card">
        <div class="flight-header">
          <span class="flight-route">San Francisco (SFO) ➔ Tokyo (HND)</span>
          <span class="flight-price" id="simFlightPrice">$448 R/T</span>
        </div>
        <div class="flight-inputs-grid">
          <div class="sim-input-box" id="simOriginBox">
            <span class="sim-badge-tag">[1]</span>
            <span class="sim-label">From</span>
            <span class="sim-val">San Francisco (SFO)</span>
          </div>
          <div class="sim-input-box" id="simDestInput">
            <span class="sim-badge-tag">[2]</span>
            <span class="sim-label">To</span>
            <span class="sim-val" id="destVal">Anywhere...</span>
          </div>
          <div class="sim-input-box" id="simDateInput">
            <span class="sim-badge-tag">[3]</span>
            <span class="sim-label">Departure - Return</span>
            <span class="sim-val">Nov 12 - Nov 24</span>
          </div>
          <div class="sim-input-box" id="simClassBox">
            <span class="sim-badge-tag">[4]</span>
            <span class="sim-label">Cabin</span>
            <span class="sim-val">Economy (Best Value)</span>
          </div>
        </div>
        <button class="btn btn-primary" id="simSearchBtn" style="width: 100%;">
          <span>Search 48 Airlines</span>
        </button>
      </div>

      <div class="web-flight-card" id="simFlightResults" style="opacity: 0.5; transition: opacity 0.3s ease;">
        <div class="flight-header">
          <span class="flight-route">✈️ All Nippon Airways (ANA) • Nonstop</span>
          <span class="flight-price">$448</span>
        </div>
        <p style="font-size: 12px; color: #94a3b8;">11h 15m • Departs 11:20 AM SFO • Arrives 3:35 PM HND (+1)</p>
      </div>
    `
  },

  table: {
    title: 'Amazon / TechSpecs Hardware Matrix',
    url: 'https://store.hardwarehub.io/comparison/gpu-benchmarks-2026',
    prompt: 'Extract all GPU price and benchmark tables to CSV format',
    steps: [
      {
        delay: 600,
        thought: 'Scanning live DOM: Found primary benchmark table <table> with 4 rows and 5 columns.',
        musePos: { x: 180, y: 120 },
        speech: 'Scanning table grid...',
        action: 'highlight',
        targetId: 'simTableElem',
        laser: true
      },
      {
        delay: 1400,
        thought: 'Parsing headers: Model, VRAM (GB), Tensor TFLOPS, TDP, Retail Price.',
        musePos: { x: 300, y: 180 },
        speech: 'Extracting cell data...',
        action: 'parse',
        targetId: 'simTableElem',
        laser: true
      },
      {
        delay: 1500,
        thought: 'Table conversion complete! Structured 4 rows into RFC 4180 CSV schema.',
        musePos: { x: 250, y: 220 },
        speech: 'CSV generated! Opening tray.',
        action: 'show_tray',
        laser: false
      }
    ],
    renderWeb: () => `
      <div style="background: #141c2b; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 14px; margin-bottom: 12px;">
        <h4 style="font-size: 14px; margin-bottom: 8px; color: #38bdf8;">Hardware Comparison Matrix</h4>
        <table id="simTableElem" style="width: 100%; border-collapse: collapse; font-size: 11.5px; text-align: left;">
          <thead>
            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.15); color: #94a3b8;">
              <th style="padding: 6px;">GPU Model</th>
              <th style="padding: 6px;">VRAM</th>
              <th style="padding: 6px;">TFLOPS</th>
              <th style="padding: 6px;">Price</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.06);">
              <td style="padding: 6px; font-weight: 600;">GeForce RTX 5090</td>
              <td style="padding: 6px;">32 GB</td>
              <td style="padding: 6px;">185</td>
              <td style="padding: 6px; color: #34d399;">$1,999</td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.06);">
              <td style="padding: 6px; font-weight: 600;">GeForce RTX 5080</td>
              <td style="padding: 6px;">16 GB</td>
              <td style="padding: 6px;">115</td>
              <td style="padding: 6px; color: #34d399;">$999</td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.06);">
              <td style="padding: 6px; font-weight: 600;">Radeon RX 8900 XTX</td>
              <td style="padding: 6px;">24 GB</td>
              <td style="padding: 6px;">120</td>
              <td style="padding: 6px; color: #34d399;">$899</td>
            </tr>
          </tbody>
        </table>
      </div>
    `
  },

  autofill: {
    title: 'Acme Cloud • Enterprise Developer Registration',
    url: 'https://cloud.acme.io/signup/developer-tier',
    prompt: 'Autofill this registration form with my saved Persona profile',
    steps: [
      {
        delay: 500,
        thought: 'Reading persona from local storage: Alex Morgan (TechFlow Dynamics, Senior Architect).',
        musePos: { x: 180, y: 90 },
        speech: 'Populating Full Name...',
        action: 'type',
        targetId: 'fieldFullName',
        value: 'Alex Morgan',
        laser: true
      },
      {
        delay: 1300,
        thought: 'Mapping email & company inputs with Set-of-Marks tags [2] and [3].',
        musePos: { x: 320, y: 90 },
        speech: 'Entering corporate credentials...',
        action: 'type',
        targetId: 'fieldEmail',
        value: 'alex.morgan@techflow.io',
        laser: true
      },
      {
        delay: 1300,
        thought: 'Smart Safety Triggered: Located sensitive submit button [4] with billing agreement.',
        musePos: { x: 260, y: 220 },
        speech: 'Safety check: User approval needed!',
        action: 'request_approval',
        laser: false
      }
    ],
    renderWeb: () => `
      <div style="background: #141c2b; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 16px;">
        <h4 style="font-size: 14px; margin-bottom: 12px; color: #c084fc;">Create Developer Workspace</h4>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
          <div class="sim-input-box" id="boxName">
            <span class="sim-badge-tag">[1]</span>
            <span class="sim-label">Full Name</span>
            <span class="sim-val" id="fieldFullName">...</span>
          </div>
          <div class="sim-input-box" id="boxEmail">
            <span class="sim-badge-tag">[2]</span>
            <span class="sim-label">Work Email</span>
            <span class="sim-val" id="fieldEmail">...</span>
          </div>
          <div class="sim-input-box" id="boxOrg">
            <span class="sim-badge-tag">[3]</span>
            <span class="sim-label">Organization</span>
            <span class="sim-val" id="fieldOrg">TechFlow Dynamics</span>
          </div>
          <div class="sim-input-box" id="boxRegion">
            <span class="sim-badge-tag">[4]</span>
            <span class="sim-label">Primary Region</span>
            <span class="sim-val">us-west-1 (Oregon)</span>
          </div>
        </div>
        <button class="btn btn-primary" id="fieldSubmitBtn" style="width: 100%; background: #a855f7;">
          <span>Submit & Provision Workspace</span>
        </button>
      </div>
    `
  },

  debug: {
    title: 'Checkout Portal (Client Debug Mode)',
    url: 'https://shop.aurora-app.com/checkout/step-3',
    prompt: 'Diagnose why the Checkout button fails on click',
    steps: [
      {
        delay: 600,
        thought: 'Attaching DevTools console hook: Listening for unhandled window.onerror and runtime promise rejections.',
        musePos: { x: 220, y: 120 },
        speech: 'Inspecting JavaScript console...',
        action: 'scan',
        laser: true
      },
      {
        delay: 1500,
        thought: 'Exception caught: TypeError: Cannot read properties of undefined (reading "checkoutToken") at checkout.js:142:18.',
        musePos: { x: 320, y: 180 },
        speech: 'Error identified at line 142!',
        action: 'highlight',
        targetId: 'brokenBtn',
        laser: true
      },
      {
        delay: 1500,
        thought: 'Root Cause & Fix: The user session token is uninitialized before stripe.confirm(). Solution: Add optional chaining `session?.checkoutToken`.',
        musePos: { x: 260, y: 220 },
        speech: 'Fix ready! 100% diagnosed.',
        action: 'fix',
        laser: false
      }
    ],
    renderWeb: () => `
      <div style="background: #141c2b; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 16px;">
        <h4 style="font-size: 14px; margin-bottom: 8px; color: #fb7185;">Order Summary • Step 3</h4>
        <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 6px; padding: 10px; margin-bottom: 12px; font-family: var(--font-mono); font-size: 11px; color: #fca5a5;">
          Uncaught TypeError: Cannot read properties of undefined (reading 'checkoutToken')
        </div>
        <button class="btn btn-primary" id="brokenBtn" style="width: 100%; background: #e11d48;">
          <span>Complete Purchase ($89.00)</span>
        </button>
      </div>
    `
  }
};

function initSimulatorEngine() {
  const recipeButtons = document.querySelectorAll('.recipe-pill');
  const webContent = document.getElementById('simWebContent');
  const simTabTitle = document.getElementById('simTabTitle');
  const simUrlText = document.getElementById('simUrlText');
  const simPromptInput = document.getElementById('simPromptInput');
  const simRunBtn = document.getElementById('simRunBtn');
  const simResetBtn = document.getElementById('simResetBtn');
  const simThoughtFeed = document.getElementById('simThoughtFeed');
  const simAgentBadge = document.getElementById('simAgentBadge');
  const simInpageMuse = document.getElementById('simInpageMuse');
  const simMuseSpeech = document.getElementById('simMuseSpeech');
  const simLaserBeam = document.getElementById('simLaserBeam');
  const simApprovalBox = document.getElementById('simApprovalBox');
  const simApproveBtn = document.getElementById('simApproveBtn');
  const simSkipBtn = document.getElementById('simSkipBtn');
  const simOutputTray = document.getElementById('simOutputTray');
  const simOutputBody = document.getElementById('simOutputBody');
  const simOutputClose = document.getElementById('simOutputClose');

  let currentRecipeKey = 'flight';
  let isSimRunning = false;
  let activeTimeouts = [];

  function clearActiveSimulation() {
    activeTimeouts.forEach(t => clearTimeout(t));
    activeTimeouts = [];
    isSimRunning = false;
    simApprovalBox.classList.add('hidden');
    simOutputTray.classList.add('hidden');
    simAgentBadge.textContent = 'Idle';
    simAgentBadge.style.color = '#34d399';
    simLaserBeam.style.opacity = '0';
  }

  function loadRecipe(key) {
    clearActiveSimulation();
    currentRecipeKey = key;

    recipeButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.recipe === key);
    });

    const data = RECIPES_DATA[key];
    simTabTitle.textContent = data.title;
    simUrlText.textContent = data.url;
    simPromptInput.value = data.prompt;
    webContent.innerHTML = data.renderWeb();

    // Reset thought feed
    simThoughtFeed.innerHTML = `
      <div class="feed-entry system-entry">
        <span class="entry-time">00:01</span>
        <span class="entry-text">Session initialized. DOM indexed with Set-of-Marks tags.</span>
      </div>
    `;

    // Position muse initially
    simInpageMuse.style.left = '60px';
    simInpageMuse.style.top = '60px';
    simMuseSpeech.textContent = 'Ready!';
  }

  // Recipe Pill Clicks
  recipeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      loadRecipe(btn.dataset.recipe);
    });
  });

  // Run Simulation Execution Loop
  function executeSimulation() {
    if (isSimRunning) return;
    clearActiveSimulation();
    isSimRunning = true;

    simAgentBadge.textContent = 'Acting';
    simAgentBadge.style.color = '#c084fc';

    const data = RECIPES_DATA[currentRecipeKey];
    let cumulativeDelay = 200;

    data.steps.forEach((step, index) => {
      cumulativeDelay += step.delay;

      const timer = setTimeout(() => {
        // Move in-page muse to coordinates
        simInpageMuse.style.left = `${step.musePos.x}px`;
        simInpageMuse.style.top = `${step.musePos.y}px`;
        simMuseSpeech.textContent = step.speech;

        // Laser beam visual
        if (step.laser) {
          simLaserBeam.style.height = '60px';
          simLaserBeam.style.opacity = '1';
        } else {
          simLaserBeam.style.opacity = '0';
        }

        // Add feed entry
        const entry = document.createElement('div');
        entry.className = 'feed-entry action-entry';
        const nowSec = String(Math.floor(cumulativeDelay / 1000)).padStart(2, '0');
        entry.innerHTML = `
          <span class="entry-time">00:${nowSec}</span>
          <span class="entry-text">${step.thought}</span>
        `;
        simThoughtFeed.appendChild(entry);
        simThoughtFeed.scrollTop = simThoughtFeed.scrollHeight;

        // Apply interactive DOM modifications
        if (step.action === 'type' && step.targetId) {
          const el = document.getElementById(step.targetId);
          if (el) {
            el.classList.add('highlighted');
            if (currentRecipeKey === 'flight') {
              const destVal = document.getElementById('destVal');
              if (destVal) destVal.textContent = step.value;
            } else if (currentRecipeKey === 'autofill') {
              el.textContent = step.value;
            }
          }
        } else if (step.action === 'click' && step.targetId) {
          const el = document.getElementById(step.targetId);
          if (el) {
            el.style.transform = 'scale(0.97)';
            setTimeout(() => el.style.transform = 'none', 150);
          }
        } else if (step.action === 'result' && currentRecipeKey === 'flight') {
          const res = document.getElementById('simFlightResults');
          if (res) res.style.opacity = '1';
          simAgentBadge.textContent = 'Completed';
          simAgentBadge.style.color = '#34d399';
        } else if (step.action === 'show_tray') {
          showOutputTray();
        } else if (step.action === 'request_approval') {
          simApprovalBox.classList.remove('hidden');
        }

        // If last step and no approval pending, complete
        if (index === data.steps.length - 1 && step.action !== 'request_approval') {
          isSimRunning = false;
        }
      }, cumulativeDelay);

      activeTimeouts.push(timer);
    });
  }

  function showOutputTray() {
    simOutputTray.classList.remove('hidden');
    simOutputBody.textContent = 
`GPU Model,VRAM,TFLOPS,Price
GeForce RTX 5090,32 GB,185,$1999
GeForce RTX 5080,16 GB,115,$999
Radeon RX 8900 XTX,24 GB,120,$899`;
  }

  if (simOutputClose) {
    simOutputClose.addEventListener('click', () => {
      simOutputTray.classList.add('hidden');
    });
  }

  // Approval Handlers
  if (simApproveBtn) {
    simApproveBtn.addEventListener('click', () => {
      simApprovalBox.classList.add('hidden');
      const entry = document.createElement('div');
      entry.className = 'feed-entry success-entry';
      entry.innerHTML = `
        <span class="entry-time">00:05</span>
        <span class="entry-text"><strong>User Approved:</strong> Submit button confirmed. Workspace provisioned successfully!</span>
      `;
      simThoughtFeed.appendChild(entry);
      simThoughtFeed.scrollTop = simThoughtFeed.scrollHeight;
      simAgentBadge.textContent = 'Completed';
      simAgentBadge.style.color = '#34d399';
      simMuseSpeech.textContent = 'Form submitted!';
      isSimRunning = false;
    });
  }

  if (simSkipBtn) {
    simSkipBtn.addEventListener('click', () => {
      simApprovalBox.classList.add('hidden');
      const entry = document.createElement('div');
      entry.className = 'feed-entry system-entry';
      entry.innerHTML = `
        <span class="entry-time">00:05</span>
        <span class="entry-text">User skipped execution. Standing by.</span>
      `;
      simThoughtFeed.appendChild(entry);
      isSimRunning = false;
    });
  }

  simRunBtn.addEventListener('click', executeSimulation);
  simPromptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') executeSimulation();
  });

  simResetBtn.addEventListener('click', () => {
    loadRecipe(currentRecipeKey);
  });

  // Initial load
  loadRecipe('flight');
}

/* ==========================================================================
   3. MODAL, TOAST, & CLIPBOARD ACTIONS
   ========================================================================== */

function initModalAndClipboard() {
  const installModal = document.getElementById('installModal');
  const closeInstallModal = document.getElementById('closeInstallModal');
  const modalDismissBtn = document.getElementById('modalDismissBtn');
  const heroInstallBtn = document.getElementById('heroInstallBtn');
  const installCtaNavBtn = document.getElementById('installCtaNavBtn');
  const heroPlayBtn = document.getElementById('heroPlayBtn');
  const openSimTopBtn = document.getElementById('openSimTopBtn');
  const downloadZipBtn = document.getElementById('downloadZipBtn');
  const modalCopyAllBtn = document.getElementById('modalCopyAllBtn');
  const simDownloadCsvBtn = document.getElementById('simDownloadCsvBtn');
  const simCopyDataBtn = document.getElementById('simCopyDataBtn');

  function openModal() {
    installModal.classList.remove('hidden');
  }

  function closeModal() {
    installModal.classList.add('hidden');
  }

  if (heroInstallBtn) heroInstallBtn.addEventListener('click', openModal);
  if (installCtaNavBtn) installCtaNavBtn.addEventListener('click', openModal);
  if (closeInstallModal) closeInstallModal.addEventListener('click', closeModal);
  if (modalDismissBtn) modalDismissBtn.addEventListener('click', closeModal);

  installModal.addEventListener('click', (e) => {
    if (e.target === installModal) closeModal();
  });

  // Jump to simulator
  function scrollToSim() {
    const sim = document.getElementById('simulator');
    if (sim) sim.scrollIntoView({ behavior: 'smooth' });
  }

  if (heroPlayBtn) heroPlayBtn.addEventListener('click', scrollToSim);
  if (openSimTopBtn) openSimTopBtn.addEventListener('click', scrollToSim);

  // Copy Buttons
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const text = btn.dataset.copy;
      copyToClipboard(text);
      showToast(`Copied "${text}" to clipboard!`);
    });
  });

  if (modalCopyAllBtn) {
    modalCopyAllBtn.addEventListener('click', () => {
      const summary = `1. Go to chrome://extensions\n2. Enable Developer mode\n3. Load Unpacked: C:\\Users\\Niema Digita\\Niema`;
      copyToClipboard(summary);
      showToast('Copied full install steps to clipboard!');
      closeModal();
    });
  }

  if (downloadZipBtn) {
    downloadZipBtn.addEventListener('click', () => {
      showToast('Preparing unpacked repository folder...');
      openModal();
    });
  }

  if (simDownloadCsvBtn) {
    simDownloadCsvBtn.addEventListener('click', () => {
      showToast('Downloaded gpu-benchmarks-2026.csv');
    });
  }

  if (simCopyDataBtn) {
    simCopyDataBtn.addEventListener('click', () => {
      const json = JSON.stringify([
        { model: "RTX 5090", vram: "32GB", price: "$1999" },
        { model: "RTX 5080", vram: "16GB", price: "$999" },
        { model: "RX 8900 XTX", vram: "24GB", price: "$899" }
      ], null, 2);
      copyToClipboard(json);
      showToast('Copied JSON table dataset to clipboard!');
    });
  }
}

function copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text);
  } else {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}

function showToast(message) {
  const toast = document.getElementById('globalToast');
  const msgEl = document.getElementById('toastMessage');
  if (!toast || !msgEl) return;

  msgEl.textContent = message;
  toast.classList.remove('hidden');

  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 2800);
}

/* ==========================================================================
   4. SMOOTH SCROLLING & ACTIVE NAV LINKS
   ========================================================================== */

function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      const targetElem = document.querySelector(targetId);
      if (targetElem) {
        e.preventDefault();
        targetElem.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
}

/* ==========================================================================
   5. HERO AUTONOMOUS MISSION LAUNCHER & HUD STREAM ENGINE
   ========================================================================== */

function initHeroMissionLauncher() {
  const missionInput = document.getElementById('heroMissionInput');
  const missionBtn = document.getElementById('heroMissionBtn');
  const chips = document.querySelectorAll('.mission-chip');
  const hud = document.getElementById('heroMissionHud');
  const hudStatus = document.getElementById('hudStatusText');
  const hudStream = document.getElementById('hudStream');
  const hudTimer = document.getElementById('hudTimer');
  const hudResultPill = document.getElementById('hudResultPill');
  const hudViewBtn = document.getElementById('hudViewBtn');
  const bubbleText = document.getElementById('bubbleText');

  if (!missionInput || !missionBtn) return;

  const missionConfigs = {
    flight: {
      prompt: "Find lowest roundtrip flight to Tokyo under $650 & extract price matrix",
      targetId: "nodeSearch",
      recipe: "flight",
      steps: [
        { label: "SoM Indexer: Mapped 18 interactive flight selectors", time: "00:00.3" },
        { label: "Gemini 3.8 Flash: Real-time visual comparison (118ms)", time: "00:00.7" },
        { label: "Autonomous Laser: Filtered 14 airlines → Deal locked: $582 SFO-NRT", time: "00:01.2" },
        { label: "Extraction Complete: tokyo_fares_matrix.csv ready", time: "00:01.6" }
      ],
      result: "Flight locked: $582 (Saved $184)"
    },
    scrape: {
      prompt: "Extract Amazon competitive pricing table into structured CSV",
      targetId: "nodeTable",
      recipe: "table",
      steps: [
        { label: "SoM Indexer: Identified table headers & 24 product rows", time: "00:00.3" },
        { label: "Data Pipeline: Cleaned currency strings & extracted RAM/CPU specs", time: "00:00.8" },
        { label: "Autonomous Laser: Extracted 24 product records", time: "00:01.3" },
        { label: "Extraction Complete: amazon_laptops_pricing.csv (4.8 KB)", time: "00:01.7" }
      ],
      result: "Table extracted: 24 items"
    },
    autofill: {
      prompt: "Autofill checkout form with encrypted local user persona",
      targetId: "nodeBook",
      recipe: "autofill",
      steps: [
        { label: "SoM Indexer: Detected 5 input fields (Name, Address, Payment)", time: "00:00.3" },
        { label: "Security Engine: Retrieved local encrypted profile (BYOK)", time: "00:00.7" },
        { label: "Autonomous Laser: Injected validated credentials safely", time: "00:01.2" },
        { label: "Safety Gate: Paused for human confirmation before purchase", time: "00:01.6" }
      ],
      result: "Autofill complete • Awaiting confirmation"
    },
    audit: {
      prompt: "Trap and analyze active JavaScript runtime console errors",
      targetId: "nodeSearch",
      recipe: "debug",
      steps: [
        { label: "DevTools Trap: Intercepted unhandled Promise rejection", time: "00:00.3" },
        { label: "Gemini 3.8 Flash: Pinpointed root-cause in auth handler", time: "00:00.7" },
        { label: "Autonomous Laser: Verified line reference & memory footprint", time: "00:01.1" },
        { label: "Audit Complete: Zero memory leaks detected (99.8% health)", time: "00:01.5" }
      ],
      result: "Audit finished: 0 critical leaks"
    },
    upwork: {
      prompt: "Deep research Upwork platform architecture, fee structure & escrow",
      targetId: "nodeTable",
      recipe: "table",
      steps: [
        { label: "Deep Research: Triangulated 4 independent knowledge sources", time: "00:00.3" },
        { label: "Gemini 3.8 Flash: Synthesized Work Diary & Milestone escrow rules", time: "00:00.8" },
        { label: "Autonomous Laser: Compiled structured executive matrix", time: "00:01.3" },
        { label: "Deliverable Ready: upwork_strategic_briefing.md indexed", time: "00:01.7" }
      ],
      result: "Executive research briefing synthesized"
    }
  };

  let activeMissionKey = 'flight';

  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeMissionKey = chip.dataset.mission || 'flight';
      const config = missionConfigs[activeMissionKey];
      if (config) {
        missionInput.value = config.prompt;
      }
    });
  });

  function executeMission() {
    const config = missionConfigs[activeMissionKey] || missionConfigs.flight;
    const targetNode = document.getElementById(config.targetId) || document.getElementById('nodeSearch');
    const viewport = document.getElementById('museViewport');

    if (hud) hud.classList.remove('hidden');
    if (hudStatus) hudStatus.textContent = "AUTONOMOUS MISSION ACTIVE";
    if (hudStream) hudStream.innerHTML = "";
    if (hudResultPill) hudResultPill.classList.add('hidden');
    if (bubbleText) bubbleText.textContent = `Autonomous mission initialized: ${config.prompt.slice(0, 40)}...`;

    if (window.setHeroMascotMood) window.setHeroMascotMood('thinking');

    // Fire laser at target node
    if (targetNode && viewport && window.fireHeroMissionTarget) {
      const rect = targetNode.getBoundingClientRect();
      const vRect = viewport.getBoundingClientRect();
      const tx = rect.left - vRect.left + rect.width / 2;
      const ty = rect.top - vRect.top + rect.height / 2;
      window.fireHeroMissionTarget(tx, ty, `Executing: ${config.prompt.slice(0, 35)}...`);
      targetNode.classList.add('targeted');
      setTimeout(() => targetNode.classList.remove('targeted'), 2400);
    }

    // Step stream orchestration
    let currentStepIdx = 0;
    const interval = setInterval(() => {
      if (currentStepIdx < config.steps.length) {
        const step = config.steps[currentStepIdx];
        if (hudTimer) hudTimer.textContent = step.time;

        const entry = document.createElement('div');
        entry.className = 'hud-step-entry active';
        entry.innerHTML = `<span class="hud-step-check">✓</span><span>${step.label}</span>`;
        if (hudStream) {
          hudStream.appendChild(entry);
          hudStream.scrollTop = hudStream.scrollHeight;
        }

        currentStepIdx++;
      } else {
        clearInterval(interval);
        if (hudStatus) hudStatus.textContent = "MISSION COMPLETE (1.6s)";
        if (hudResultPill) {
          hudResultPill.classList.remove('hidden');
          const resTxt = document.getElementById('hudResultText');
          if (resTxt) resTxt.textContent = config.result;
        }
        if (bubbleText) bubbleText.textContent = `Mission Complete! ${config.result}`;
        if (window.setHeroMascotMood) window.setHeroMascotMood('happy');
        showToast(`Autonomous mission completed in 1.6s with Gemini 3.8 Flash!`);
      }
    }, 450);
  }

  missionBtn.addEventListener('click', executeMission);
  missionInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeMission();
    }
  });

  if (hudViewBtn) {
    hudViewBtn.addEventListener('click', () => {
      const config = missionConfigs[activeMissionKey] || missionConfigs.flight;
      const simSection = document.getElementById('simulator');
      if (simSection) {
        simSection.scrollIntoView({ behavior: 'smooth' });
        // Select corresponding recipe
        const pill = document.querySelector(`.recipe-pill[data-recipe="${config.recipe}"]`);
        if (pill) pill.click();
      }
    });
  }
}

/* ==========================================================================
   6. LIVE GLOBAL TELEMETRY TICKER & COUNTER
   ========================================================================== */

function initLiveTelemetryTicker() {
  const counterEl = document.getElementById('liveTaskCounter');
  const activityEl = document.getElementById('liveActivityFeed');
  if (!counterEl && !activityEl) return;

  let currentCount = 52894;
  setInterval(() => {
    currentCount += Math.floor(Math.random() * 3) + 1;
    if (counterEl) counterEl.textContent = currentCount.toLocaleString();
  }, 2600);

  const activities = [
    "Developer in Berlin automated AWS Cloud deployment review (2s ago)",
    "Researcher in London extracted 850 PubMed paper abstracts to CSV (5s ago)",
    "Product Manager in San Francisco executed competitive checkout audit (8s ago)",
    "Data Engineer in Tokyo scraped multi-currency exchange matrix (11s ago)",
    "Security Analyst in Austin trapped 3 memory leaks in React app (14s ago)",
    "E-commerce Founder in New York monitored 12 competitor price drops (18s ago)"
  ];

  let actIdx = 0;
  setInterval(() => {
    if (!activityEl) return;
    actIdx = (actIdx + 1) % activities.length;
    activityEl.style.opacity = '0';
    setTimeout(() => {
      activityEl.textContent = activities[actIdx];
      activityEl.style.opacity = '1';
    }, 250);
  }, 4200);
}

/* ==========================================================================
   7. SUMMON LIVING 3D IN-PAGE COMPANION WIDGET
   ========================================================================== */

function initInPageLivingMuse() {
  const trigger = document.getElementById('summonCompanionTrigger');
  if (!trigger) return;

  let inPageCompanion = null;
  let isSummoned = false;

  trigger.addEventListener('click', () => {
    // If an in-page companion is already injected (e.g. by the extension), toggle it to prevent duplicates
    const existingCompanion = document.querySelector('.neima-muse-companion');
    if (existingCompanion && existingCompanion !== inPageCompanion) {
      const isHidden = existingCompanion.classList.contains('hidden') || existingCompanion.style.display === 'none';
      if (isHidden) {
        existingCompanion.classList.remove('hidden');
        existingCompanion.style.display = '';
        trigger.querySelector('.summon-action').textContent = "Dismiss Co-Pilot ✕";
        trigger.style.borderColor = "#10b981";
        showToast("Neima 3D Companion is active on screen!");
      } else {
        existingCompanion.classList.add('hidden');
        trigger.querySelector('.summon-action').textContent = "Summon on This Page ✦";
        trigger.style.borderColor = "";
        showToast("Neima 3D Companion dismissed.");
      }
      return;
    }

    if (!isSummoned) {
      isSummoned = true;
      trigger.querySelector('.summon-action').textContent = "Dismiss Co-Pilot ✕";
      trigger.style.borderColor = "#10b981";

      inPageCompanion = document.createElement('div');
      inPageCompanion.className = 'neima-muse-companion';
      inPageCompanion.style.position = 'fixed';
      inPageCompanion.style.bottom = '95px';
      inPageCompanion.style.right = '35px';
      inPageCompanion.style.zIndex = '100000';
      inPageCompanion.style.cursor = 'grab';

      inPageCompanion.innerHTML = `
        <div class="neima-muse-speech active" id="demoInpageSpeech" style="position: absolute; bottom: 105px; right: 0; background: rgba(9,13,24,0.95); border: 1px solid #38bdf8; color: #fff; padding: 7px 16px; border-radius: 12px; font-size: 12px; font-weight: 500; white-space: nowrap; box-shadow: 0 0 18px rgba(56,189,248,0.35);">
          Neima living companion online! Drag me or click anywhere ✦
        </div>
        <div class="neima-muse-floater">
          <div class="neima-muse-rotator" id="demoRotator">
            <!-- Head Sphere & Visor -->
            <div class="neima-muse-head-sphere" id="demoHeadSphere">
              <div class="neima-muse-ring neima-muse-ring-1"></div>
              <div class="neima-muse-ring neima-muse-ring-2"></div>
              <div class="neima-muse-visor-dome">
                <svg class="neima-face-svg" viewBox="0 0 52 52">
                  <rect x="7" y="9" width="38" height="34" rx="17" fill="#040813" stroke="rgba(56, 189, 248, 0.45)" stroke-width="1.2" />
                  <g id="demoFaceGaze" class="neima-face-gaze">
                    <g class="neima-eye" transform="translate(18, 22)">
                      <path d="M -5 3 L 0 -3 L 5 3" fill="none" stroke="#00f0ff" stroke-width="2.6" stroke-linecap="round" />
                    </g>
                    <g class="neima-eye" transform="translate(34, 22)">
                      <path d="M -5 3 L 0 -3 L 5 3" fill="none" stroke="#00f0ff" stroke-width="2.6" stroke-linecap="round" />
                    </g>
                    <path d="M 21 32 Q 26 36 31 32" fill="none" stroke="#00f0ff" stroke-width="2.2" stroke-linecap="round" />
                  </g>
                </svg>
                <div class="neima-muse-hologram-scan"></div>
              </div>
            </div>

            <!-- Cyber-Torso & Glowing Reactor Core -->
            <div class="neima-muse-body">
              <div class="neima-muse-chest-armor">
                <div class="neima-muse-core-reactor"></div>
              </div>
              <div class="neima-muse-arm arm-left">
                <div class="arm-upper"></div>
                <div class="arm-forearm"></div>
                <div class="arm-hand"><span class="finger-pointer"></span></div>
              </div>
              <div class="neima-muse-arm arm-right">
                <div class="arm-upper"></div>
                <div class="arm-forearm"></div>
                <div class="arm-hand"><span class="finger-pointer"></span></div>
              </div>
            </div>

            <!-- Pelvis & Legs -->
            <div class="neima-muse-pelvis"></div>
            <div class="neima-muse-legs-container">
              <div class="neima-muse-leg leg-left">
                <div class="leg-thigh"></div>
                <div class="leg-knee"></div>
                <div class="leg-shin"></div>
                <div class="leg-foot"></div>
              </div>
              <div class="neima-muse-leg leg-right">
                <div class="leg-thigh"></div>
                <div class="leg-knee"></div>
                <div class="leg-shin"></div>
                <div class="leg-foot"></div>
              </div>
            </div>
          </div>
          <div class="neima-muse-shadow"></div>
        </div>
      `;

      document.body.appendChild(inPageCompanion);
      showToast("Neima 3D Companion summoned on page! Drag her anywhere.");

      // Dragging logic
      let isDragging = false;
      let startX, startY, initX, initY;

      inPageCompanion.addEventListener('mousedown', (e) => {
        isDragging = true;
        inPageCompanion.style.cursor = 'grabbing';
        startX = e.clientX;
        startY = e.clientY;
        const rect = inPageCompanion.getBoundingClientRect();
        initX = rect.left;
        initY = rect.top;
      });

      window.addEventListener('mousemove', (e) => {
        if (!isDragging || !inPageCompanion) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        inPageCompanion.style.left = `${Math.max(20, Math.min(window.innerWidth - 80, initX + dx))}px`;
        inPageCompanion.style.top = `${Math.max(20, Math.min(window.innerHeight - 80, initY + dy))}px`;
        inPageCompanion.style.bottom = 'auto';
        inPageCompanion.style.right = 'auto';
      });

      window.addEventListener('mouseup', () => {
        if (isDragging && inPageCompanion) {
          isDragging = false;
          inPageCompanion.style.cursor = 'grab';
        }
      });
    } else {
      isSummoned = false;
      trigger.querySelector('.summon-action').textContent = "Summon on This Page ✦";
      trigger.style.borderColor = "";
      if (inPageCompanion && inPageCompanion.parentNode) {
        inPageCompanion.parentNode.removeChild(inPageCompanion);
        inPageCompanion = null;
      }
      showToast("Companion dismissed.");
    }
  });
}
