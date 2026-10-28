# OrvexaOS app sources

Each app has its own folder under `/apps/<app-id>/` so its template and metadata can be edited directly in GitHub.

- `index.html` — editable HTML template
- `app.json` — app ID, display name, and template path
- `/apps/index.json` — registry of app source paths

Important: existing live app logic is still implemented in `windows/desktop.js` and `windows/pluginRuntime.js`. These template files are source scaffolding and are not automatically loaded into live app windows yet; this keeps current functionality intact while the loader is migrated.
