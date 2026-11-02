# Chrome Web Store Listing & Compliance: Neima

**Extension Name**: Neima — AI Autonomous Browser Agent & 3D Muse  
**Version**: 1.0.0  
**Manifest Version**: 3  
**Category**: Productivity / Developer Tools  
**Last Updated**: October 2026  

---

## 1. Store Listing Metadata

### Short Description (max 132 chars)
Autonomous AI browser agent with 3D Muse companion, vision, live DOM automation, and multi-model support (Claude 3.7, Gemini, GPT-4o).

### Detailed Description
Neima is an autonomous AI browser agent and interactive 3D Muse companion inspired by modern creative AI assistants and Claude in Chrome, equipped with vision, live DOM automation, and multi-model intelligence.

Instead of a generic cursor, Neima features an animated, in-page 3D Muse companion that physically navigates the webpage, points laser beams at interactive buttons, types queries, and guides you through complex workflows.

#### Key Features:
* 🤖 **3D Muse Companion**: An animated holographic in-page mascot with gyroscopic orbital rings, animated OLED visor expressions, and energy pointer beams.
* ⚡ **Autonomous Browser Agent**: Directly clicks buttons, fills out forms, navigates workflows, scrolls, and verifies actions using Set-of-Marks visual indexing.
* 👁 **Vision & Live Page Awareness**: Captures visible tab context and inspects live DOM hierarchies, reading dashboards, single-page apps, and authenticated sessions.
* 🎯 **3D Element Inspector**: Hover across the page with Neima following your cursor to inspect elements, generate CSS selectors, and ask targeted questions.
* 📊 **Data & Table Extractor**: 1-click export of any web table to CSV or JSON.
* 📝 **Smart Form Auto-Filler**: Instantly fills registration and checkout fields with saved persona data.
* 🐞 **Live Console Debugger**: Captures unhandled JavaScript errors and promise rejections directly from the active tab.
* 🛡 **Human-in-the-Loop & Safety**: Full control to approve every click/action step-by-step or toggle full autonomous execution with safe step caps.
* 🔒 **Bring Your Own Key (BYOK) & 100% Privacy**: All API keys and settings are stored strictly in local browser storage (`chrome.storage.local`). Supports 100% offline local models with Ollama.

---

## 2. Permissions Justification

| Permission | Justification |
| :--- | :--- |
| `sidePanel` | Required to provide the persistent side panel interface running alongside any open webpage without obstructing the viewport. |
| `tabs` | Required to detect the active tab's URL, page title, and favicon, enabling Neima to observe context and navigate across tabs upon user request. |
| `activeTab` | Required to grant temporary script execution and state observation when triggered directly by user gestures in the toolbar. |
| `scripting` | Required to programmatically inject the content script automation engine, 3D Muse avatar, Set-of-Marks element indexer, and inspector overlay into web pages. |
| `storage` | Required to securely persist user configuration, API keys, chosen models, autonomy limits, and form-fill personas locally on the user's device. |
| `<all_urls>` (host_permissions) | Required for the browser agent to analyze DOM structures, index interactive buttons/inputs, and automate workflows across user-selected web domains. |

---

## 3. Privacy & Data Use Disclosure

* **Does this extension collect or transmit user data?**  
  No. Neima does not run any telemetry, remote trackers, analytics, or external logging servers.
* **Where are API keys stored?**  
  All keys (Anthropic, Gemini, OpenAI) and persona profiles are stored exclusively on the user's machine via `chrome.storage.local`.
* **Where is page context sent?**  
  Page text and screenshots are dispatched *only* to the AI provider endpoint explicitly configured by the user (Anthropic, Google, OpenAI, or the user's local Ollama endpoint).
