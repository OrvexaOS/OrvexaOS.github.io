# Contributing to OrvexaOS

Thanks for helping improve OrvexaOS!

## Before changing code

- Keep the existing boot sequence and working features intact.
- Prefer small, focused changes that are easy to review and roll back.
- Check whether related logic already exists in `windows/`, `apps/`, or `pluginmng/` before adding another implementation.
- Do not put credentials, access tokens, or private user data in the repository.

## Apps

The `apps/index.json` file is the app registry. When adding or changing an app, keep its ID unique and use consistent paths. Read `apps/README.md` for the current app-folder conventions. Note that app templates may not yet be the runtime source for every existing app, so verify how the target app is actually loaded before assuming a template change affects the live desktop.

## Validation

Run the checks locally when available:

```bash
node --check path/to/changed-file.js
python3 scripts/validate.py
```

For changes involving multiple JavaScript files, check each changed file. Test the affected app or screen in a browser and check the browser console. For boot, service-worker, or cache changes, verify a normal reload and a fresh-cache load when possible.

## Pull requests

Explain the user-facing change, list the checks you ran, and mention anything that could not be tested. UI changes should include screenshots when practical. Avoid combining unrelated fixes in one pull request.