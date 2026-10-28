# OrvexaOS app sources

Each app has its own folder under `/apps/<app-id>/`.

- `index.html` — editable HTML template.
- `app.json` — app ID, display name, and template path.
- `/apps/index.json` — registry of app source paths.

## Editing an app

1. Open the app's folder in GitHub.
2. Edit `index.html` to change its template content.
3. Keep the `data-app-template="<app-id>"` marker in the template.
4. Keep the metadata ID and `template` path consistent with the registry.
5. Run `python3 scripts/validate_apps.py` locally, or check the **App source validation** workflow after pushing.

IDs use lowercase letters, numbers, and hyphens. Registry paths must match the app ID exactly. Do not place credentials or private data in templates.

## Runtime compatibility status

The registry and template files are validated, but the existing desktop still builds its interactive built-in and plugin app content from `windows/desktop.js`, `windows/pluginRuntime.js`, and `windows/pluginManager.js`. The templates are not yet the universal runtime source for every app. Editing a template alone therefore does not necessarily change the live app window.

This separation is intentional until each app's interactive behavior can be migrated without replacing working features with placeholder HTML. Avoid deleting legacy app logic or assuming that a template edit has changed the running app until runtime integration for that app is explicitly completed.

## Checks

```bash
python3 -m json.tool apps/index.json > /dev/null
python3 scripts/validate_apps.py
python3 scripts/validate.py
```
