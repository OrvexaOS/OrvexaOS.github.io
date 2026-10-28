# OrvexaOS developer handbook

## Repository layout

- `index.html` — browser entry point.
- `windows/` — desktop, windows, app runtime, and related UI logic.
- `apps/index.json` — catalog of editable app template paths.
- `apps/<app-id>/` — app template and metadata, where present.
- `pluginmng/` — plugin-management code.
- `scripts/validate.py` — dependency-free HTML reference and web manifest validation.
- `.github/workflows/` — automated repository checks.

## Safe change workflow

1. Identify the existing implementation before editing; avoid adding duplicate handlers.
2. Make a small change and preserve the existing boot sequence.
3. Run `node --check path/to/file.js` on changed JavaScript files.
4. Run `python3 scripts/validate.py`.
5. Validate JSON files with `python3 -m json.tool path/to/file.json`.
6. Test the affected app in a browser and inspect the console.
7. For boot, cache, and service-worker changes, test normal reload and fresh-cache startup.

## App template status

The app registry describes editable templates, and the desktop includes an opt-in source loader. Setting `"runtime": "template"` in an app's `app.json` enables its template to replace the legacy window content. The loader validates the metadata path and ID, strips executable scripts and inline event handlers, and falls back to the legacy content if loading fails.

Keep existing apps on the legacy runtime until their interactive behavior has been migrated and tested. The HTML templates are not automatically the live runtime for every app; verify the app's `runtime` metadata before expecting a template edit to affect the desktop.

## Browser data and backups

OrvexaOS stores supported app data and preferences in browser storage. Clearing browser site data may remove local information. Export a backup before clearing storage or testing restore behavior. Browser storage is local to a browser profile and does not automatically synchronize between devices.

## Security and privacy

Never commit tokens, credentials, private keys, or personal data. Treat user-entered text and imported files as untrusted input. Do not use `innerHTML` with untrusted strings; prefer `textContent` or carefully validated DOM construction. A UI-level permission preference is not a substitute for browser security boundaries.

## Reporting

Use the GitHub issue templates for reproducible bugs and feature requests. Include device/browser details and sanitized error messages where useful.