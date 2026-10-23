#!/usr/bin/env python3
"""Small, dependency-free static checks for the OrvexaOS GitHub Pages site."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
errors = []
checked_assets = set()


class DocumentAudit(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids = set()
        self.references = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        element_id = attrs.get("id")
        if element_id:
            if element_id in self.ids:
                errors.append(f"index.html: duplicate id {element_id!r}")
            self.ids.add(element_id)

        for attr in ("src", "href"):
            value = attrs.get(attr)
            if value:
                self.references.append((tag, attr, value))

        for attr in ("for", "aria-labelledby", "aria-describedby", "aria-controls"):
            value = attrs.get(attr, "")
            for target in value.split():
                if target:
                    self.references.append(("id-reference", attr, target))


def local_path(value):
    parsed = urlsplit(value)
    if parsed.scheme or parsed.netloc or value.startswith(("#", "data:", "mailto:", "javascript:")):
        return None
    path = unquote(parsed.path)
    if not path:
        return None
    return path.lstrip("/") if path.startswith("/") else path


html_path = ROOT / "index.html"
if not html_path.is_file():
    errors.append("Missing index.html")
    html = ""
else:
    html = html_path.read_text(encoding="utf-8")

audit = DocumentAudit()
audit.feed(html)

for tag, attr, value in audit.references:
    if tag == "id-reference":
        if value not in audit.ids:
            errors.append(f"index.html: {attr} points to missing id {value!r}")
        continue
    path = local_path(value)
    if path is None:
        continue
    target = (ROOT / path).resolve()
    if ROOT.resolve() not in target.parents and target != ROOT.resolve():
        errors.append(f"Unsafe local reference: {value!r}")
    elif not target.is_file():
        errors.append(f"Missing local {attr} referenced by <{tag}>: {value!r}")
    else:
        checked_assets.add(path)

manifest_path = ROOT / "manifest.webmanifest"
try:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    for key in ("name", "short_name", "start_url", "display"):
        if not manifest.get(key):
            errors.append(f"manifest.webmanifest: required field {key!r} is missing")
except (OSError, json.JSONDecodeError) as exc:
    errors.append(f"manifest.webmanifest: {exc}")

if errors:
    print("OrvexaOS validation failed:")
    for error in errors:
        print(f" - {error}")
    sys.exit(1)

print(f"HTML audit passed: {len(audit.ids)} unique IDs, {len(checked_assets)} local assets checked.")
print("Web app manifest is valid.")
