<div align="center">
  <img src="assets/icon.png" width="128" height="128" alt="Antigravity Meter Logo" />
  <h1>Antigravity Meter ⏳</h1>
  <p><strong>The hyper-simplified, zero-bloat quota & weekly limit meter for Google Antigravity IDE.</strong></p>

  <p>
    <a href="https://github.com/davidcasanovasola-git/antigravity-meter/releases"><img src="https://img.shields.io/badge/version-1.4.0-blue.svg?style=flat-square" alt="Version 1.4.0" /></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg?style=flat-square" alt="MIT License" /></a>
    <img src="https://img.shields.io/badge/Antigravity%20IDE-%5E1.80.0-purple.svg?style=flat-square" alt="Antigravity IDE" />
    <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square" alt="PRs Welcome" />
  </p>
</div>

---

## ⚡ What is Antigravity Meter?

Most quota extensions for AI IDEs come packed with bloat: heavy WebViews, background cache scanners, commit generators, or intrusive in-IDE popups.

**Antigravity Meter** does exactly one thing and does it with precision: **displays your live model quotas (Gemini & Claude/GPT) right in the status bar, crucially including the official Weekly Limit and reset countdowns**, backed by silent native OS notifications when your quotas refresh.

```text
🟢 Gemini: 95% (3h 39m) · Sem: 91% (6d 1h)  |  🟢 Claude: 100% (4h 58m) · Sem: 50% (3d 13h)
```

---

## 🚀 Key Features

- **📊 Dual-Window Visibility**: Antigravity divides quotas into a **5-hour dynamic burst window** and a **7-day weekly tier limit**. Antigravity Meter displays both simultaneously at a glance.
- **⏱️ Optional Inline Countdowns**: Toggle between showing remaining time inline (`both`, `5h`, `weekly`) or keeping it to clean percentages (`none`).
- **💡 Rich Hover Card**: Hover over the status bar item to view the exact reset timestamp in your local timezone and breakdown per model group.
- **🔔 Native OS Notifications & Audio**: When a quota window resets, get an alert via your OS Notification Center (macOS AppleScript) with a gentle sound (`Glass`, `Ping`, etc.) — **zero annoying IDE popups**.
- **🎧 Live Sound Previews**: Hear your alert sound immediately in real-time as soon as you change it in Settings.
- **🛡️ Resilient Startup Daemon**: Tolerates slow language server startups gracefully — silent initial retries (0s, 1.5s, 3s, 5s) and automatic self-healing background reconnection without crashing.
- **🌍 Native Auto-Localization**: Detects your OS and IDE language automatically (supporting English, Spanish, French, German, Chinese, Japanese, Portuguese, and Italian) with manual override.
- **🪶 Zero Bloat**: No WebViews, no heavy dependencies, <1 MB footprint, instantaneous activation (< 5 ms).

---

## 🥊 Comparison with Legacy Extensions

| Feature | Legacy Antigravity Panel | **Antigravity Meter** ⏳ |
| :--- | :---: | :---: |
| **Weekly Limit in Status Bar** | ❌ No | **✅ Yes (Crucial)** |
| **5-Hour Reset Countdown** | ❌ Hidden in submenu | **✅ Inline / Hover** |
| **Memory / WebViews** | ⚠️ Heavy (>50 MB) | **⚡ Zero (< 1 MB)** |
| **Alerts Style** | ⚠️ Annoying in-IDE dialogs | **🔔 Silent Native OS Banner** |
| **Live Audio Preview in Settings** | ❌ No | **✅ Instant playback** |
| **Startup Crash Tolerance** | ❌ Fails if LS starts slow | **✅ Auto-reconnecting daemon** |
| **Bloat (Auto-accept, cache, etc.)** | ⚠️ Overloaded | **🚀 100% Zero Bloat** |

---

## ⚙️ Configuration (`settings.json`)

Clean and minimal settings:

```jsonc
{
  // Warning threshold percentage (Yellow 🟡)
  "antigravityMeter.warningThreshold": 40,

  // Critical threshold percentage (Red 🔴)
  "antigravityMeter.criticalThreshold": 20,

  // Reset time display in status bar: "both", "5h", "weekly", or "none"
  "antigravityMeter.showResetTime": "both",

  // Enable native OS notification on quota reset
  "antigravityMeter.notifications.enabled": true,

  // Play audio alert with reset notifications
  "antigravityMeter.notifications.sound": true,

  // macOS system sound name ("Glass", "Ping", "Hero", "Pop", "Basso", etc.)
  "antigravityMeter.notifications.soundName": "Glass",

  // Background polling interval in seconds
  "antigravityMeter.refreshInterval": 60,

  // Language: "auto" (detects OS/IDE), "en", "es", "fr", "de", "zh-cn", "ja", "pt-br", "it"
  "antigravityMeter.language": "auto"
}
```

---

## ⌨️ Commands

| Command | Description |
| :--- | :--- |
| `Antigravity Meter: Refresh Quota` | Force an immediate query of the Antigravity Language Server RPC. |
| `Antigravity Meter: Test Sound` | Test your currently configured notification audio alert. |
| `Antigravity Meter: Test System Notification` | Send a test native notification to macOS Notification Center. |

---

## 📦 Installation

### From VSIX (Fastest)

1. Download the latest `antigravity-meter-1.4.0.vsix` from [Releases](https://github.com/davidcasanovasola-git/antigravity-meter/releases).
2. Install via Antigravity IDE terminal:
   ```bash
   antigravity-ide --install-extension antigravity-meter-1.4.0.vsix
   ```
   *Or open Antigravity IDE -> Extensions (`Cmd+Shift+X`) -> `...` menu -> **Install from VSIX...***

### Build from Source

```bash
git clone https://github.com/davidcasanovasola-git/antigravity-meter.git
cd antigravity-meter
npx @vscode/vsce package --no-dependencies
antigravity-ide --install-extension antigravity-meter-1.4.0.vsix
```

---

## 📄 License

[MIT](LICENSE) © [David Casanova](https://github.com/davidcasanovasola-git)
