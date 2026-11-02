/**
 * Neima Settings Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  const saveBtn = document.getElementById('saveBtn');
  const stepDelayInput = document.getElementById('stepDelay');
  const delayVal = document.getElementById('delayVal');
  const saveToast = document.getElementById('saveToast');

  // Load existing settings
  const defaults = {
    freellmapiKey: 'freellmapi-1f4e138cd1bbee9085b68e36fd735b3785a51ab786a76b42',
    freellmapiUrl: 'http://localhost:3001/v1',
    anthropicKey: '',
    geminiKey: '',
    openaiKey: '',
    ollamaUrl: 'http://localhost:11434',
    autoConfirm: true,
    requireSensitiveApproval: true,
    stepDelay: 180,
    maxSteps: 15,
    userProfile: {
      fullName: 'Alex Morgan',
      email: 'alex.morgan@example.com',
      phone: '+1 (555) 234-5678',
      company: 'TechFlow Dynamics',
      jobTitle: 'Senior Software Architect',
      address: '742 Evergreen Terrace',
      zipCode: '97477',
      country: 'United States'
    }
  };

  const stored = await chrome.storage.local.get(defaults);

  document.getElementById('anthropicKey').value = stored.anthropicKey || '';
  document.getElementById('geminiKey').value = stored.geminiKey || '';
  document.getElementById('openaiKey').value = stored.openaiKey || '';
  document.getElementById('freellmapiUrl').value = stored.freellmapiUrl || 'http://localhost:3001/v1';
  document.getElementById('freellmapiKey').value = stored.freellmapiKey || 'freellmapi-1f4e138cd1bbee9085b68e36fd735b3785a51ab786a76b42';
  document.getElementById('ollamaUrl').value = stored.ollamaUrl || 'http://localhost:11434';
  document.getElementById('autoConfirm').checked = !!stored.autoConfirm;
  const sensitiveCheck = document.getElementById('requireSensitiveApproval');
  if (sensitiveCheck) {
    sensitiveCheck.checked = stored.requireSensitiveApproval !== undefined ? !!stored.requireSensitiveApproval : true;
  }

  stepDelayInput.value = stored.stepDelay || 800;
  delayVal.innerText = stored.stepDelay || 800;

  document.getElementById('maxSteps').value = stored.maxSteps || 15;

  const profile = stored.userProfile || {};
  document.getElementById('profileFullName').value = profile.fullName || '';
  document.getElementById('profileEmail').value = profile.email || '';
  document.getElementById('profilePhone').value = profile.phone || '';
  document.getElementById('profileCompany').value = profile.company || '';
  document.getElementById('profileJobTitle').value = profile.jobTitle || '';
  document.getElementById('profileAddress').value = profile.address || '';
  document.getElementById('profileZip').value = profile.zipCode || '';
  document.getElementById('profileCountry').value = profile.country || '';

  // Step delay slider live update
  stepDelayInput.addEventListener('input', (e) => {
    delayVal.innerText = e.target.value;
  });

  // Toggle password visibility with branded SVG icons
  const eyeSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
  const eyeOffSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;

  document.querySelectorAll('.toggle-visibility').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      if (input.type === 'password') {
        input.type = 'text';
        btn.innerHTML = eyeOffSvg;
      } else {
        input.type = 'password';
        btn.innerHTML = eyeSvg;
      }
    });
  });

  // Save Settings
  saveBtn.addEventListener('click', async () => {
    const toSave = {
      freellmapiKey: document.getElementById('freellmapiKey').value.trim() || 'freellmapi-1f4e138cd1bbee9085b68e36fd735b3785a51ab786a76b42',
      freellmapiUrl: document.getElementById('freellmapiUrl').value.trim() || 'http://localhost:3001/v1',
      anthropicKey: document.getElementById('anthropicKey').value.trim(),
      geminiKey: document.getElementById('geminiKey').value.trim(),
      openaiKey: document.getElementById('openaiKey').value.trim(),
      ollamaUrl: document.getElementById('ollamaUrl').value.trim() || 'http://localhost:11434',
      autoConfirm: document.getElementById('autoConfirm').checked,
      requireSensitiveApproval: document.getElementById('requireSensitiveApproval')?.checked ?? true,
      stepDelay: parseInt(document.getElementById('stepDelay').value, 10) || 800,
      maxSteps: parseInt(document.getElementById('maxSteps').value, 10) || 15,
      userProfile: {
        fullName: document.getElementById('profileFullName').value.trim(),
        email: document.getElementById('profileEmail').value.trim(),
        phone: document.getElementById('profilePhone').value.trim(),
        company: document.getElementById('profileCompany').value.trim(),
        jobTitle: document.getElementById('profileJobTitle').value.trim(),
        address: document.getElementById('profileAddress').value.trim(),
        zipCode: document.getElementById('profileZip').value.trim(),
        country: document.getElementById('profileCountry').value.trim()
      }
    };

    await chrome.storage.local.set(toSave);

    // Show toast
    saveToast.classList.remove('hidden');
    setTimeout(() => {
      saveToast.classList.add('hidden');
    }, 2800);
  });
});
