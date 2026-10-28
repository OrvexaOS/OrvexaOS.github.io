# Releases and changelog

## Publishing a release

1. Merge and validate the changes on `main`.
2. Create and push a semantic-version tag such as `v1.2.0`.
3. The **Publish OrvexaOS release** workflow validates JavaScript, HTML references, the manifest, and app source registry before creating a GitHub release with generated release notes.
4. Review the generated notes and correct any omissions in the GitHub release page.

You can also run the workflow manually from GitHub Actions by selecting an existing version tag. The workflow does not create tags or invent version numbers for you.

## Updating CHANGELOG.md

Open **Update changelog** in GitHub Actions and choose **Run workflow**. Enter a version, a one-line summary, and a list of changes (one item per line). The workflow checks for duplicate version headings, prepends the entry, and commits the update to `main`.

## Security automation

The **Security checks** workflow runs CodeQL's extended JavaScript queries, a lightweight scan for common accidentally committed credential patterns, and dependency review on pull requests. These checks are additional safeguards; they do not replace GitHub secret scanning, code review, or safe handling of credentials.

## App source checks

The **App source validation** workflow verifies that every ID in `apps/index.json` has a matching non-empty HTML template and valid `app.json` metadata. The normal validation and release workflows run the same app source validator.

A passing template check confirms the files and registry are consistent; it does not prove that every template is already the live interactive app runtime. See `apps/README.md` for the current migration status.
