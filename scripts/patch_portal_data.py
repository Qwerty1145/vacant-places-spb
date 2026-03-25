#!/usr/bin/env python3
"""Patch portal_data.js with dormInfo values from manual_profile_overrides.json."""

import json
import re
from pathlib import Path

ROOT = Path(__file__).parent.parent
PORTAL_DATA_JS = ROOT / "site" / "data" / "portal_data.js"
OVERRIDES_JSON = ROOT / "site" / "data" / "manual_profile_overrides.json"

# Load overrides
with open(OVERRIDES_JSON, "r", encoding="utf-8") as f:
    overrides_raw = json.load(f)

overrides = overrides_raw.get("overrides", overrides_raw)

# Load portal_data.js
with open(PORTAL_DATA_JS, "r", encoding="utf-8") as f:
    content = f.read()

# Extract JSON part: window.PORTAL_DATA = {...}
prefix = "window.PORTAL_DATA = "
assert content.startswith(prefix), "Unexpected format"
json_str = content[len(prefix):]
# Strip trailing semicolon/newline
suffix = ""
while json_str and json_str[-1] in ";\n\r":
    suffix = json_str[-1] + suffix
    json_str = json_str[:-1]

data = json.loads(json_str)

updated = 0
for uni in data.get("unis", []):
    uid = str(uni.get("id"))
    override = overrides.get(uid, {})
    if "dormInfo" in override:
        old = uni.get("dormInfo", "")
        new = override["dormInfo"]
        if old != new:
            uni["dormInfo"] = new
            updated += 1
            print(f"  [{uid}] Updated dormInfo")
    # Also update vacPubSummer / vacPubWinter if present
    for field in ("vacPubSummer", "vacPubWinter"):
        if field in override:
            old = uni.get(field, "")
            new = override[field]
            if old != new:
                uni[field] = new
                print(f"  [{uid}] Updated {field}")

print(f"\nTotal dormInfo updated: {updated}")

# Write back
new_content = prefix + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + suffix
with open(PORTAL_DATA_JS, "w", encoding="utf-8") as f:
    f.write(new_content)

print(f"portal_data.js written ({len(new_content):,} bytes)")
