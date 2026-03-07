#!/usr/bin/env python3
"""Refresh vacancy data by re-crawling university websites.

Reuses the parsing infrastructure from build_site.py without
requiring the original Excel source files.

Usage:
    python scripts/refresh_vacancies.py [--workers 8] [--only u002,u010] [--dry-run]
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "site" / "data"
UNIVERSITIES_JSON = DATA_DIR / "universities.json"
PORTAL_DATA_JS = DATA_DIR / "portal_data.js"
OVERRIDES_JSON = DATA_DIR / "manual_profile_overrides.json"


def load_module(name: str, path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load module from {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def load_universities(path: Path) -> list[dict[str, Any]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    return payload.get("universities", [])


def save_universities(universities: list[dict[str, Any]], path: Path) -> None:
    ok = sum(1 for u in universities if u.get("vacancies", {}).get("status") == "ok")
    partial = sum(1 for u in universities if u.get("vacancies", {}).get("status") == "partial")
    error = sum(1 for u in universities if u.get("vacancies", {}).get("status") == "error")
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_file": "refresh_vacancies.py",
        "total_universities": len(universities),
        "stats": {
            "vacancies_ok": ok,
            "vacancies_partial": partial,
            "vacancies_error": error,
        },
        "universities": universities,
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Saved {path} | ok={ok} partial={partial} error={error}")


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).replace("\xa0", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def parse_int(value: Any) -> int:
    text = clean_text(value)
    if not text:
        return 0
    numbers = re.findall(r"\d+", text)
    if not numbers:
        return 0
    ints = [int(n) for n in numbers]
    if len(ints) > 1 and len(set(ints)) == 1:
        return ints[0]
    return sum(ints)


def normalize_course(value: Any) -> Any:
    text = clean_text(value)
    if not text:
        return ""
    match = re.search(r"\d+", text)
    return int(match.group(0)) if match else text


def rows_to_portal_format(rows: list[list[Any]]) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for row in rows:
        current = [clean_text(cell) for cell in row]
        if len(current) < 8:
            current.extend([""] * (8 - len(current)))
        code, direction, program, level, course, form, budget, paid = current[:8]
        budget_num = parse_int(budget)
        paid_num = parse_int(paid)
        if not any([code, direction, program, level, course, form, budget_num, paid_num]):
            continue
        result.append({
            "code": code,
            "dir": direction,
            "program": program,
            "level": level,
            "course": normalize_course(course),
            "form": form,
            "budget": budget_num,
            "paid": paid_num,
        })
    return result


def update_portal_data(universities: list[dict[str, Any]], portal_path: Path) -> None:
    raw = portal_path.read_text(encoding="utf-8")
    prefix = "window.PORTAL_DATA = "
    if not raw.startswith(prefix):
        raise RuntimeError(f"Unexpected format in {portal_path}")
    json_str = raw[len(prefix):].rstrip().rstrip(";")
    portal = json.loads(json_str)

    # Build name→vacancy mapping from fresh universities.json
    vac_by_name: dict[str, dict[str, Any]] = {}
    for u in universities:
        name = clean_text(u.get("university"))
        vacancies = u.get("vacancies") or {}
        std_rows = vacancies.get("standardized_rows") or []
        vac_by_name[name] = {
            "status": clean_text(vacancies.get("status")) or "error",
            "message": clean_text(vacancies.get("message") or vacancies.get("note")),
            "source": clean_text(
                vacancies.get("source_url") or u.get("official_vacancies_link")
            ),
            "rows": rows_to_portal_format(std_rows),
        }

    # Update portal unis + vacanciesById
    total_rows = 0
    loaded = 0
    vacancies_by_id: dict[str, list[dict[str, Any]]] = portal.get("vacanciesById", {})

    for uni in portal["unis"]:
        abbr = uni["abbr"]
        vac = vac_by_name.get(abbr)
        if not vac:
            continue

        rows = vac["rows"]
        status = vac["status"]
        message = vac["message"]
        if status == "ok" and not rows:
            status = "error"
            message = "Таблица извлечена без пригодных строк."

        uni["vacancyStatus"] = status
        uni["vacancyMessage"] = message
        uni["vacancySource"] = vac["source"]
        uni["vacancyRowCount"] = len(rows)

        vacancies_by_id[str(uni["id"])] = rows
        total_rows += len(rows)
        if status == "ok" and rows:
            loaded += 1

    portal["generatedAt"] = datetime.now(timezone.utc).isoformat()
    portal["stats"] = {
        "totalUniversities": len(portal["unis"]),
        "loadedUniversities": loaded,
        "errorUniversities": sum(
            1 for u in portal["unis"] if u["vacancyStatus"] == "error"
        ),
        "totalVacancyRows": total_rows,
    }
    portal["vacanciesById"] = vacancies_by_id

    # Re-apply manual overrides for vacPub fields (not in PROFILE_OVERRIDE_FIELDS)
    if OVERRIDES_JSON.exists():
        overrides_data = json.loads(OVERRIDES_JSON.read_text(encoding="utf-8"))
        overrides = overrides_data.get("overrides", overrides_data)
        for uni in portal["unis"]:
            ovr = overrides.get(str(uni["id"]))
            if not ovr:
                continue
            for field in ("vacPubSummer", "vacPubWinter"):
                if field in ovr:
                    uni[field] = ovr[field]

    content = prefix + json.dumps(portal, ensure_ascii=False) + ";\n"
    portal_path.write_text(content, encoding="utf-8")
    print(
        f"Saved {portal_path} | universities={len(portal['unis'])} "
        f"loaded={loaded} rows={total_rows}"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Refresh vacancy data from university websites.")
    parser.add_argument("--workers", type=int, default=8, help="Parallel workers (default: 8)")
    parser.add_argument("--only", type=str, help="Comma-separated university IDs, e.g. u002,u010")
    parser.add_argument("--dry-run", action="store_true", help="Crawl but don't write files")
    args = parser.parse_args()

    # Load build_site module for its crawling infrastructure
    build_site_path = ROOT / "scripts" / "build_site.py"
    print(f"Loading parsing engine from {build_site_path}...")
    build_site = load_module("build_site", build_site_path)

    # Load universities
    print(f"Loading universities from {UNIVERSITIES_JSON}...")
    universities = load_universities(UNIVERSITIES_JSON)
    print(f"  Found {len(universities)} universities")

    # Apply SOURCE_OVERRIDES
    source_overrides = getattr(build_site, "SOURCE_OVERRIDES", {})
    for u in universities:
        uid = u.get("id", "")
        if uid in source_overrides:
            u["official_vacancies_link"] = source_overrides[uid]

    # Filter by --only
    if args.only:
        only_ids = set(args.only.split(","))
        universities = [u for u in universities if u.get("id") in only_ids]
        print(f"  Filtered to {len(universities)} universities: {args.only}")

    if not universities:
        print("No universities to process.")
        return 1

    # Crawl
    print(f"\nStarting crawl with {args.workers} workers...\n")
    build_site.enrich_with_vacancies(universities, workers=args.workers)

    # Summary
    ok = sum(1 for u in universities if u.get("vacancies", {}).get("status") == "ok")
    err = sum(1 for u in universities if u.get("vacancies", {}).get("status") == "error")
    total_rows = sum(
        len(u.get("vacancies", {}).get("standardized_rows") or [])
        for u in universities
    )
    print(f"\nCrawl complete: {ok} ok, {err} error, {total_rows} total rows")

    if args.dry_run:
        print("\n--dry-run: not writing files")
        for u in universities:
            v = u.get("vacancies", {})
            name = u.get("university", "?")[:40]
            rows = len(v.get("standardized_rows") or [])
            print(f"  {u['id']} {name}: {v.get('status', '?')} ({rows} rows)")
        return 0

    # If --only was used, merge back into full list
    if args.only:
        full = load_universities(UNIVERSITIES_JSON)
        refreshed = {u["id"]: u for u in universities}
        for i, u in enumerate(full):
            if u["id"] in refreshed:
                full[i] = refreshed[u["id"]]
        universities = full

    # Save
    print(f"\nSaving {UNIVERSITIES_JSON}...")
    save_universities(universities, UNIVERSITIES_JSON)

    print(f"Updating {PORTAL_DATA_JS}...")
    update_portal_data(universities, PORTAL_DATA_JS)

    print("\nDone!")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
