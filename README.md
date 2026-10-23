# OrvexaOS

OrvexaOS is a browser-based desktop environment built with HTML, CSS, and vanilla JavaScript. It is a work in progress and runs without a build step.

## Run it

- Open `index.html` in a modern browser, or publish the repository with GitHub Pages.
- No package installation or compilation is required.
- App data, notes, files, calendar events, installed plugins, and display preferences are stored locally in the browser. Clearing site data can remove them, so export important files or backups before clearing storage.

## Included desktop features

- Home launcher and taskbar for opening apps.
- Files workspace with text import and export.
- Notes and Calendar with local persistence.
- Focus Timer with 15-, 25-, and 50-minute sessions, pause/resume, reset, task labels, and completion notifications.
- Browser/Store, Messages, Settings, and System Monitor experiences.
- Window dragging, focus, minimize, maximize, and close controls.
- Control Center with theme, accent, wallpaper, brightness, and night-light options.
- Notification center and optional browser notifications.
- Plugin Store with locally running utilities.

## Keyboard and accessibility

- Press **Ctrl+K** (Windows/Linux) or **⌘K** (Mac) to open the command palette.
- Search for apps or system actions, then use **↑ / ↓** and **Enter** to navigate and launch; **Escape** closes the palette.
- Press **Alt+C** to toggle Control Center.
- Press **Escape** to close Control Center and Notifications.
- Use the taskbar and app controls with a keyboard; visible focus indicators are provided.
- Layout adapts for smaller screens and devices with display safe areas.

## Published site and installable app

The live site is published at https://orvexaos.github.io/. The repository includes a web app manifest, scalable app icon, and service worker for caching the app shell after a successful online visit. On supported browsers, use **Install / Add to Home Screen** in Control Center to install it. On iOS Safari, use Share → Add to Home Screen if the browser does not offer an install prompt.

The Control Center app panel shows connection status and offers a manual update check. When a new service-worker version is ready, choose **Apply update** to reload the app. Offline mode only covers the cached app shell and local browser data; remote websites, external resources, and network-dependent features still require a connection. Browser storage is local to the current browser/device.

Search metadata, a canonical URL, crawler instructions, and a sitemap are included for the published page.

## Notes

- This is a browser simulation, not a native operating system. Browser APIs and permissions vary by device.
- The built-in AI Assistant plugin uses local writing helpers; it does not connect to an AI service unless separately implemented.
- Changes and feature support may vary by browser. Please report issues with your browser and device details.


## Advanced desktop tools

- **Advanced Launcher:** searchable app library with locally saved favorites.
- **Pro Window Manager:** tile left/right, center, cascade, focus, minimize, and close open windows.
- **Desktop Widgets:** configurable local time, saved-note count, and desktop status cards.
- **Backup & Restore:** exports OrvexaOS local app data and display preferences as JSON. Restore validates the format and imports recognized OrvexaOS keys.
- **Terminal:** safe simulated commands including `help`, `date`, `time`, `apps`, `open`, `theme`, `about`, and `clear`; it is not a system shell.
- **Lock screen & profiles:** saves a local display name and offers a visual demo lock, not authentication or a security boundary.
- **Sound & notifications:** stores app sound-level preference and Do Not Disturb/browser-alert preferences; hardware volume remains controlled by the operating system.
- **Files:** adds search to the existing local text editor, import/export, and delete workflow.

- **Color Studio:** converts HEX to RGB/HSL, saves a local palette, and copies color values.
- **Clipboard & Text Tools:** counts characters/words/lines, transforms text, sorts lines, and copies text on request.

- **App Store:** browse built-in apps and the plugin catalog, search/filter available and installed apps, install or uninstall Store plugins, and open installed apps.
- **Pinned apps:** pin/unpin built-in or installed apps from the App Store; pins are saved locally and appear first in Advanced Launcher.
- **App permission preferences:** manage per-plugin preferences for local app data, notifications, network features, and device information. These are OrvexaOS-level preferences exposed through `OrvexaPluginManager.hasPermission()`; browser/OS permissions remain separate and are not bypassed.


## Additional built-in apps

The built-in app library now includes 50 additional tools. The first group includes Password Generator, Stopwatch, Pomodoro Timer, Countdown, Checklist, Kanban Board, Bookmark Manager, Reading List, Daily Journal, Flashcards, Random Picker, CSV Viewer, Base64 Tool, URL Encoder, Timestamp Converter, Regex Tester, Text Diff, Color Contrast Checker, Gradient Studio, Invoice Maker, Tip Splitter, Loan Calculator, BMI Calculator, World Clock, and Daily Planner.

The second group adds Word Counter, Case Converter, Text Cleaner, Lorem Generator, HTML Encoder, JSON to CSV, CSV to JSON, UUID Generator, Hash Generator, Number Base Converter, Binary Converter, Percentage Calculator, Date Calculator, Age Calculator, Savings Calculator, Text Splitter, List Sorter, Duplicate Remover, Slug Generator, Markdown Table, Character Map, Color Mixer, Icon Preview, Typing Test, and Regex Cheatsheet. Most tools work locally in the browser; hash generation requires Web Crypto support. CSV converters support common quoted cells but are intended for ordinary tabular data, not every possible CSV dialect.

## Customization and maintenance

- Display settings include dark/light theme, accent presets and custom accent color, wallpaper presets and custom wallpaper, interface scale, window transparency, corner radius, taskbar alignment, compact layout, brightness, and night light.
- Tool inputs are saved locally where applicable. Data remains browser/device-specific unless exported.
- Timer pause/resume preserves the remaining time, and the CSV viewer handles quoted cells and escaped quotes.
- Run JavaScript syntax checks after changing app modules. Browser-level interaction testing is still recommended before treating a release as fully verified.
