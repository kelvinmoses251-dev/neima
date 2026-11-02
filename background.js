/**
 * Neima - Background Service Worker (Manifest V3)
 * Handles side panel opening, tab listeners, screenshot captures, and message routing.
 */

// Configure side panel behavior immediately whenever service worker boots
if (chrome.sidePanel?.setPanelBehavior) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err) => {
    console.debug('[Neima SW] setPanelBehavior notice:', err);
  });
}

// Fallback: If openPanelOnActionClick is unsupported or fails, open explicitly on click
if (chrome.action?.onClicked) {
  chrome.action.onClicked.addListener(async (tab) => {
    try {
      if (chrome.sidePanel?.open && tab?.windowId) {
        await chrome.sidePanel.open({ windowId: tab.windowId });
      }
    } catch (err) {
      console.debug('[Neima SW] Action click fallback notice:', err);
    }
  });
}

chrome.runtime.onInstalled.addListener(async () => {
  try {
    if (chrome.sidePanel?.setPanelBehavior) {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    }
    console.log('[Neima SW] Side panel behavior set to open on action click.');
  } catch (err) {
    console.debug('[Neima SW] Failed to set side panel behavior in onInstalled:', err);
  }

  // Initialize default extension storage settings if not present
  const defaults = {
    selectedModel: 'gemini-3.8-flash',
    provider: 'gemini',
    autoConfirm: true,
    showMarks: false,
    stepDelay: 700,
    maxSteps: 15,
    userProfile: {
      fullName: 'Alex Morgan',
      email: 'alex.morgan@example.com',
      phone: '+1 (555) 234-5678',
      company: 'TechFlow Dynamics',
      jobTitle: 'Senior Software Architect',
      address: '742 Evergreen Terrace, Springfield, OR',
      zipCode: '97477',
      country: 'United States'
    }
  };

  const current = await chrome.storage.local.get(Object.keys(defaults));
  const toSet = {};
  for (const [key, value] of Object.entries(defaults)) {
    if (current[key] === undefined) {
      toSet[key] = value;
    }
  }
  if (Object.keys(toSet).length > 0) {
    await chrome.storage.local.set(toSet);
  }
});

// Notify sidepanel whenever the active tab changes or finishes loading
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    chrome.runtime.sendMessage({
      type: 'TAB_CHANGED',
      tab: {
        id: tab.id,
        title: tab.title || 'Untitled',
        url: tab.url || '',
        favIconUrl: tab.favIconUrl || ''
      }
    }).catch(() => {
      // Side panel might not be open yet, safe to ignore
    });
  } catch (err) {
    console.debug('[Neima SW] onActivated error:', err);
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    chrome.runtime.sendMessage({
      type: 'TAB_UPDATED',
      tab: {
        id: tab.id,
        title: tab.title || 'Untitled',
        url: tab.url || '',
        favIconUrl: tab.favIconUrl || ''
      }
    }).catch(() => {
      // Side panel might not be open
    });
  }
});

// Central message router
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      switch (message.type) {
        case 'GET_ACTIVE_TAB': {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (!tab) {
            sendResponse({ error: 'No active tab found' });
            return;
          }
          sendResponse({
            tab: {
              id: tab.id,
              title: tab.title || 'Untitled',
              url: tab.url || '',
              favIconUrl: tab.favIconUrl || ''
            }
          });
          break;
        }

        case 'CAPTURE_SCREENSHOT': {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (!tab || !tab.id) {
            sendResponse({ error: 'No active tab for screenshot' });
            return;
          }
          // captureVisibleTab returns a data URL (e.g. data:image/png;base64,...)
          const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
          sendResponse({ dataUrl });
          break;
        }

        case 'LIST_ALL_TABS': {
          const tabs = await chrome.tabs.query({ currentWindow: true });
          const mapped = tabs.map((t) => ({
            id: t.id,
            title: t.title || 'Untitled',
            url: t.url || '',
            favIconUrl: t.favIconUrl || '',
            active: t.active
          }));
          sendResponse({ tabs: mapped });
          break;
        }

        case 'SWITCH_TAB': {
          if (message.tabId) {
            await chrome.tabs.update(message.tabId, { active: true });
            sendResponse({ success: true });
          } else {
            sendResponse({ error: 'Missing tabId' });
          }
          break;
        }

        case 'NAVIGATE_TAB': {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab && tab.id && message.url) {
            let finalUrl = message.url;
            if (!/^https?:\/\//i.test(finalUrl)) {
              finalUrl = 'https://' + finalUrl;
            }
            await chrome.tabs.update(tab.id, { url: finalUrl });
            sendResponse({ success: true, url: finalUrl });
          } else {
            sendResponse({ error: 'Could not navigate tab' });
          }
          break;
        }

        case 'CREATE_TAB': {
          let targetUrl = message.url || 'https://www.google.com';
          if (!/^https?:\/\//i.test(targetUrl)) {
            targetUrl = 'https://' + targetUrl;
          }
          const newTab = await chrome.tabs.create({ url: targetUrl, active: message.active !== false });
          sendResponse({ success: true, tab: { id: newTab.id, url: newTab.url } });
          break;
        }

        case 'CLOSE_TAB': {
          if (message.tabId) {
            await chrome.tabs.remove(message.tabId);
            sendResponse({ success: true });
          } else {
            sendResponse({ error: 'Missing tabId' });
          }
          break;
        }

        case 'SET_AGENT_BADGE': {
          if (message.status === 'RUNNING') {
            await chrome.action.setBadgeText({ text: 'NEI' });
            await chrome.action.setBadgeBackgroundColor({ color: '#7c3aed' }); // Purple
          } else if (message.status === 'ACTION') {
            await chrome.action.setBadgeText({ text: 'ACT' });
            await chrome.action.setBadgeBackgroundColor({ color: '#e11d48' }); // Rose
          } else {
            await chrome.action.setBadgeText({ text: '' });
          }
          sendResponse({ success: true });
          break;
        }

        case 'SCHEDULE_SHORTCUT': {
          const { id, intervalMinutes } = message;
          if (id && intervalMinutes > 0) {
            const alarmName = `neima_shortcut_${id}`;
            await chrome.alarms.create(alarmName, {
              periodInMinutes: Math.max(1, intervalMinutes)
            });
            sendResponse({ success: true, alarmName });
          } else {
            sendResponse({ error: 'Invalid shortcut id or interval' });
          }
          break;
        }

        case 'CANCEL_SCHEDULED_SHORTCUT': {
          const { id } = message;
          if (id) {
            const alarmName = `neima_shortcut_${id}`;
            await chrome.alarms.clear(alarmName);
            sendResponse({ success: true });
          } else {
            sendResponse({ error: 'Missing shortcut id' });
          }
          break;
        }

        case 'LIST_SCHEDULED_ALARMS': {
          const alarms = await chrome.alarms.getAll();
          sendResponse({ alarms });
          break;
        }

        case 'SHOW_NOTIFICATION': {
          const { title, text } = message;
          try {
            chrome.notifications.create({
              type: 'basic',
              iconUrl: chrome.runtime.getURL('icons/icon-48.png'),
              title: title || 'Neima Browser Co-Pilot',
              message: text || 'Automated task finished.'
            });
          } catch (notifErr) {
            console.debug('Notification notice:', notifErr);
          }
          sendResponse({ success: true });
          break;
        }

        default:
          sendResponse({ status: 'unhandled_type' });
      }
    } catch (err) {
      console.error('[Neima SW] Error handling message:', err);
      sendResponse({ error: err.message });
    }
  })();

  return true; // Keeps async response channel open
});

// Chrome Alarms Listener for Scheduled Shortcuts & Automations (Claude in Chrome parity)
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name.startsWith('neima_shortcut_')) {
    const shortcutId = alarm.name.replace('neima_shortcut_', '');
    try {
      const stored = await chrome.storage.local.get(['scheduledShortcuts', 'workflows']);
      const shortcuts = stored.scheduledShortcuts || [];
      const shortcut = shortcuts.find((s) => s.id === shortcutId);

      if (shortcut && shortcut.enabled !== false) {
        // 1. Show desktop notification
        try {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icons/icon-48.png'),
            title: `Neima Scheduled Automation ⏰`,
            message: `Executing shortcut: "${shortcut.name}"`
          });
        } catch (e) {}

        // 2. Dispatch to open sidepanel or execute in active tab
        chrome.runtime.sendMessage({
          type: 'EXECUTE_SCHEDULED_SHORTCUT',
          shortcut
        }).catch(() => {});

        // 3. Update lastRun timestamp
        shortcut.lastRun = Date.now();
        await chrome.storage.local.set({ scheduledShortcuts: shortcuts });
      }
    } catch (err) {
      console.error('[Neima SW] Error executing scheduled alarm:', err);
    }
  }
});

