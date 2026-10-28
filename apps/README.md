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

## Runtime integration

An app can opt into rendering its editable HTML template by adding `"runtime": "template"` to its `app.json`. The source loader fetches that app's metadata and template when the app window opens, checks that the IDs and paths match, and removes scripts, inline event handlers, and unsafe JavaScript URLs before mounting the HTML.

By default, apps remain on the legacy runtime. Do not enable template mode for an app until its required interactive behavior has been migrated into supported code; a static template can replace its old controls. If a template fails to load, OrvexaOS keeps the legacy content. The migration is intentionally opt-in so unfinished templates cannot silently replace working apps.

## Runtime compatibility status

The registry and template files are validated, and the desktop now has a safe opt-in template-loading path. Existing apps still use the legacy runtime unless their metadata explicitly selects template mode. Not every app's interactive logic has been migrated into its editable template yet.

## Checks

```bash
python3 -m json.tool apps/index.json > /dev/null
python3 scripts/validate_apps.py
python3 scripts/validate.py
```
