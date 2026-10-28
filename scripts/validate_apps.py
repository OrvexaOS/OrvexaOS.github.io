#!/usr/bin/env python3
"""Validate the OrvexaOS editable app registry and per-app source files."""
from pathlib import Path
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "apps" / "index.json"
errors = []
warnings = []
try:
    registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
except (OSError, json.JSONDecodeError) as exc:
    print(f"App registry could not be read: {exc}")
    raise SystemExit(1)

apps = registry.get("apps")
if not isinstance(apps, list):
    print("App registry must contain an 'apps' array.")
    raise SystemExit(1)

seen = set()
checked = 0
for entry in apps:
    if not isinstance(entry, dict):
        errors.append(f"Registry entry is not an object: {entry!r}")
        continue
    app_id = entry.get("id")
    if not isinstance(app_id, str) or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", app_id):
        errors.append(f"Invalid app ID: {app_id!r}")
        continue
    if app_id in seen:
        errors.append(f"Duplicate app ID: {app_id}")
        continue
    seen.add(app_id)
    for field, expected in (("html", f"/apps/{app_id}/index.html"),
                            ("metadata", f"/apps/{app_id}/app.json")):
        value = entry.get(field)
        if value != expected:
            errors.append(f"{app_id}: {field} must be {expected!r}, got {value!r}")
            continue
        target = (ROOT / value.lstrip("/")).resolve()
        if ROOT.resolve() not in target.parents:
            errors.append(f"{app_id}: path escapes repository: {value!r}")
        elif not target.is_file():
            errors.append(f"{app_id}: missing registered {field} file: {value}")
        elif field == "html":
            try:
                text = target.read_text(encoding="utf-8")
                if not text.strip():
                    errors.append(f"{app_id}: template is empty")
                elif f'data-app-template="{app_id}"' not in text and f'data-app-root="{app_id}"' not in text:
                    warnings.append(f"{app_id}: template does not contain its expected app marker")
            except OSError as exc:
                errors.append(f"{app_id}: cannot read template: {exc}")
        else:
            try:
                metadata = json.loads(target.read_text(encoding="utf-8"))
                if metadata.get("id") != app_id:
                    errors.append(f"{app_id}: metadata ID does not match registry")
                template_path = metadata.get("template")
                if template_path != expected:
                    errors.append(f"{app_id}: metadata template must be {expected!r}")
                if not isinstance(metadata.get("name"), str) or not metadata["name"].strip():
                    errors.append(f"{app_id}: metadata needs a non-empty name")
                runtime = metadata.get("runtime", "legacy")
                if runtime not in ("legacy", "template"):
                    errors.append(f"{app_id}: runtime must be 'legacy' or 'template'")
            except (OSError, json.JSONDecodeError) as exc:
                errors.append(f"{app_id}: invalid app metadata JSON: {exc}")
    checked += 1

print(f"App registry: {checked} entries checked.")
for warning in warnings:
    print(f"WARNING: {warning}")
if errors:
    print("App source validation failed:")
    for error in errors:
        print(f" - {error}")
    raise SystemExit(1)
print("All registered app templates and metadata files are present and valid.")
