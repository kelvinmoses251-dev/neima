# Neima — AI Autonomous Browser Agent with 3D Muse Companion

> A next-generation, full-featured clone of **Claude in Chrome** featuring an in-page **3D Muse Companion Avatar**, vision, live DOM automation, Set-of-Marks indexing, multi-model intelligence (Claude 3.7, Gemini 2.0, GPT-4o, Local Ollama), DevTools console debugging, and 1-click table extraction.

---

## 🌟 What Makes Neima Unique

Unlike standard browser extensions that rely on boring default cursors or invisible actions, **Neima** features an animated, in-page **3D Muse Companion**:
* **3D Holographic Mascot**: Floats over the webpage with animated gyroscopic orbital rings, glowing OLED visor, and reactive eyes.
* **Energy Pointer Beam**: Shoots a luminous focused laser beam directly down to the button, link, or input element being acted upon.
* **Flight Trajectory & Levitation**: Floats smoothly to element coordinates with soft drop shadow physics and levitation effects.
* **Live In-Page Speech Bubbles**: Displays thoughts and actions in real time directly above the companion (e.g. *"Clicking 'Sign Up'"*, *"Typing query..."*).
* **3D Cursor Guide**: During **3D Inspect Mode**, Neima follows your cursor like an interactive assistant, scanning elements with a radiant targeting beam.
* **Header Avatar Sync**: An interactive miniature 3D Neima avatar in the side panel header tracks live agent states (`Idle`, `Observing`, `Thinking`, `Acting`, `Happy`).

---

## 🚀 Feature Comparison

| Capability | Official Claude in Chrome | Neima Agent |
| :--- | :---: | :---: |
| **Interactive 3D Muse Character** | ❌ No (Default pointer) | 🚀 **Yes (Full 3D Companion with laser beams & floating speech)** |
| **Side Panel Integration (`chrome.sidePanel`)** | ✅ Yes | ✅ **Yes** (Native V3 Sidepanel) |
| **Live Web Page Vision & Screenshots** | ✅ Yes | ✅ **Yes** (DOM + Headings + Viewport capture) |
| **Autonomous Page Actions (Click, Type, Scroll)** | ✅ Yes | ✅ **Yes** (Smooth dispatch with visual ripples) |
| **Set-of-Marks (SoM) Element Indexing** | ⚠️ Internal only | 🚀 **Visual numbered badges (`[1]`, `[2]`, `[3]`) directly on live elements** |
| **Multi-Model Support** | ❌ Claude only | 🚀 **Claude 3.7/3.5, Gemini 2.0, GPT-4o, Ollama** |
| **100% Private Offline Agent (Local LLM)** | ❌ No | 🚀 **Yes (Ollama / DeepSeek-R1 / Llama 3.2)** |
| **Interactive "Click-to-Ask" Element Inspector**| ❌ No | 🚀 **Yes (3D Muse guides your cursor to any element)** |
| **1-Click Table Scraper & CSV/JSON Exporter** | ❌ No | 🚀 **Yes (Scrapes page tables to CSV or JSON)** |
| **Smart Form Auto-Filler** | ❌ Manual prompt | 🚀 **Yes (Configurable Persona Profile)** |
| **Developer Console Error Trap & Debugger** | ❌ Basic | 🚀 **Yes (Captures unhandled JS exceptions)** |
| **Simulation / Demo Mode** | ❌ Account required | 🚀 **Yes (Instant zero-config test drive)** |
| **Human-in-the-Loop Step Confirmation** | ⚠️ Partial | 🚀 **Yes (Approve, Skip, or Auto-Run)** |

---

## 🛠️ Project Structure

```text
neima/
├── manifest.json              # Chrome Manifest V3 configuration
├── background.js              # Service Worker (side panel, tabs, screenshots)
├── generate-icons.js          # Generator script for 3D Muse PNG icons
├── icons/                     # 16, 32, 48, 128px PNG icons
├── content/
│   ├── content.js             # In-page 3D Muse manager, DOM engine, Set-of-Marks
│   └── content.css            # 3D Muse companion, gyroscopic rings, laser beams, badges
├── sidepanel/
│   ├── sidepanel.html         # Side panel UI layout with header 3D avatar
│   ├── sidepanel.css          # Glassmorphic dark theme stylesheet
│   ├── sidepanel.js           # Main controller, stream rendering, avatar state sync
│   ├── agent.js               # Autonomous Observe-Think-Act agent loop
│   └── api.js                 # Unified multi-model API client (Claude/Gemini/OpenAI/Ollama)
├── index.html                 # Flagship Web Showcase & Interactive Simulator
├── style.css                  # Dark cyberpunk glassmorphic showcase stylesheet
├── app.js                     # 3D spatial mouse physics, laser canvas & simulator engine
├── server.js                  # Zero-dependency local preview server
├── assets/                    # 3D Muse hero render & holographic avatar visuals
├── options/
│   ├── options.html           # Settings & API keys configuration
│   ├── options.css            # Settings stylesheet
│   └── options.js             # Storage persistence controller
├── CHROMEWEBSTORE.md          # Store listing, permission justifications, review checklist
└── README.md                  # Documentation and quick start
```

---

## 🌐 Live Interactive Web Showcase & Simulator

Want to experience Neima's 3D Muse and autonomous agent capabilities directly in your browser without installing anything first?

Run the included local preview server:
```bash
node server.js
```
Open **`http://localhost:3000/`** in your browser to:
* **Interact with the 3D Muse Companion**: Watch the gyroscopic orbital rings rotate in real time and guide Neima's focused laser targeting beam with your mouse cursor.
* **Test Drive the Live Agent Simulator**: Pick pre-built recipes (Flight Deal Hunter, Amazon Table Scraper, Checkout Autofill with Persona, JS Console Error Trap) and watch Neima autonomously observe the DOM, tag elements with Set-of-Marks, and execute actions with human-in-the-loop safety approvals.
* **1-Click Install Walkthrough**: High-converting visual onboarding guide for installing the unpacked extension into Chrome in under 30 seconds.

---

## 📦 How to Install and Run in Chrome

1. **Open Extension Manager**:
   - In Google Chrome, navigate to `chrome://extensions`.
2. **Enable Developer Mode**:
   - Toggle on **"Developer mode"** in the top right corner.
3. **Load Unpacked**:
   - Click the **"Load unpacked"** button in the top left.
   - Select this folder: `C:\Users\Niema Digita\Niema`.
4. **Pin & Open**:
   - Click the extension puzzle icon in Chrome's toolbar and pin **Neima**.
   - Click the Neima icon to open the side panel and watch your 3D Muse companion come to life!

