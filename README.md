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
