#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import importlib.util
import io
import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import urlparse

try:
    from playwright.sync_api import sync_playwright
except Exception:  # pragma: no cover
    sync_playwright = None  # type: ignore

try:
    import pypdfium2
except Exception:  # pragma: no cover
    pypdfium2 = None  # type: ignore


REGISTER_COLUMNS = [
    "batch_id",
    "uni_id",
    "uni_name",
    "source_url",
    "source_type",
    "source_pages",
    "parsed_rows_before",
    "expected_rows_source",
    "mismatch_types",
    "fix_strategy",
    "fix_files",
    "parsed_rows_after",
    "strict_match",
    "evidence_before",
    "evidence_after",
    "checked_at",
    "notes",
]

BATCHES: dict[str, list[str]] = {
    "1": ["u002", "u022", "u027"],
    "2": ["u021", "u028", "u019"],
    "3": ["u010", "u025", "u026"],
    "4": ["u017", "u015", "u024"],
    "5": ["u020", "u013", "u016"],
    "6": ["u014", "u018", "u023"],
    "7": ["u003", "u004", "u005"],
    "8": ["u006", "u007", "u008"],
    "9": ["u009", "u011", "u012"],
    "10": ["u001", "u030", "u031"],
    "11": ["u032", "u033", "u029"],
}


def normalize_uni_id(raw: str) -> str:
    text = str(raw or "").strip().lower()
    if not text:
        return ""
    if text.startswith("u"):
        suffix = re.sub(r"\D", "", text[1:])
        return f"u{int(suffix):03d}" if suffix else text
    if text.isdigit():
        return f"u{int(text):03d}"
    return text


def parse_ids(raw: str) -> list[str]:
    if not raw:
        return []
    result: list[str] = []
    for item in re.split(r"[,\s;]+", raw.strip()):
        uni_id = normalize_uni_id(item)
        if uni_id:
            result.append(uni_id)
    return result


def clean_text(value: Any) -> str:
    text = str(value or "")
    text = text.replace("\u00a0", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def norm_text(value: Any) -> str:
    return clean_text(value).lower()


def norm_number(value: Any) -> int:
    text = clean_text(value).lower()
    if not text or text in {"-", "—", "–", "нет", "нет данных"}:
        return 0
    numbers = [int(match) for match in re.findall(r"\d+", text)]
    if not numbers:
        return 0
    if len(numbers) > 1 and len(set(numbers)) == 1:
        return numbers[0]
    return sum(numbers)


def norm_course(value: Any) -> str:
    text = clean_text(value).lower()
    if not text or text in {"-", "—", "–", "0", "нет данных"}:
        return ""
    match = re.search(r"\d+", text)
    return match.group(0) if match else text


def norm_form(value: Any) -> str:
    text = clean_text(value).lower()
    text = re.sub(r"\s*-\s*", "-", text)
    if not text or text in {"-", "—", "–", "0", "нет данных"}:
        return ""
    if "очно-заоч" in text:
        return "очно-заочная"
    if "заоч" in text:
        return "заочная"
    if "очн" in text:
        return "очная"
    return text


def norm_level(value: Any) -> str:
    text = clean_text(value).lower()
    text = text.replace("–", "-").replace("—", "-")
    if not text:
        return ""
    if "бакалав" in text:
        return "бакалавриат"
    if "магистр" in text:
        return "магистратура"
    if "специал" in text:
        return "специалитет"
    if "среднее профессион" in text or text == "спо":
        return "спо"
    if "ординат" in text:
        return "ординатура"
    if "аспиран" in text or "подготовка кадров высшей квалификации" in text:
        return "аспирантура"
    if "высш" in text:
        return "высшее"
    return text


def row_to_fields(row: Any) -> tuple[str, str, str, str, str, str, int, int]:
    if isinstance(row, dict):
        code = row.get("code", "")
        direction = row.get("dir", "")
        program = row.get("program", "")
        level = row.get("level", "")
        course = row.get("course", "")
        form = row.get("form", "")
        budget = row.get("budget", 0)
        paid = row.get("paid", 0)
    else:
        values = list(row) if isinstance(row, list) else []
        while len(values) < 8:
            values.append("")
        code, direction, program, level, course, form, budget, paid = values[:8]
    return (
        norm_text(code),
        norm_text(direction),
        norm_text(program),
        norm_level(level),
        norm_course(course),
        norm_form(form),
        norm_number(budget),
        norm_number(paid),
    )


def canonical_counter(rows: list[Any]) -> Counter[tuple[str, str, str, str, str, str, int, int]]:
    counter: Counter[tuple[str, str, str, str, str, str, int, int]] = Counter()
    for row in rows:
        fields = row_to_fields(row)
        if not any(fields[:6]) and fields[6] == 0 and fields[7] == 0:
            continue
        counter[fields] += 1
    return counter


def classify_mismatch(
    parsed_rows: list[Any],
    expected_rows: list[Any],
    source_type: str,
) -> list[str]:
    parsed_counter = canonical_counter(parsed_rows)
    expected_counter = canonical_counter(expected_rows)
    if parsed_counter == expected_counter:
        return []

    mismatch: set[str] = set()
    parsed_total = sum(parsed_counter.values())
    expected_total = sum(expected_counter.values())

    if expected_total > parsed_total:
        mismatch.add("MISS_ROWS")
        if source_type == "pdf":
            mismatch.add("MISS_PAGE")
    if parsed_total > expected_total:
        mismatch.add("NOISE_ROWS")

    if any(count > 1 for count in parsed_counter.values()):
        mismatch.add("DUP_ROWS")

    parsed_base = Counter(key[:6] for key, count in parsed_counter.items() for _ in range(count))
    expected_base = Counter(key[:6] for key, count in expected_counter.items() for _ in range(count))
    if parsed_base != expected_base:
        mismatch.add("WRONG_CODE_FORM_COURSE")

    parsed_num: dict[tuple[str, str, str, str, str, str], list[int]] = defaultdict(lambda: [0, 0])
    expected_num: dict[tuple[str, str, str, str, str, str], list[int]] = defaultdict(lambda: [0, 0])
    for key, count in parsed_counter.items():
        parsed_num[key[:6]][0] += key[6] * count
        parsed_num[key[:6]][1] += key[7] * count
    for key, count in expected_counter.items():
        expected_num[key[:6]][0] += key[6] * count
        expected_num[key[:6]][1] += key[7] * count

    for base_key in set(parsed_num) & set(expected_num):
        if parsed_num[base_key] != expected_num[base_key]:
            mismatch.add("NUMERIC_MISMATCH")
            break

    shifted = 0
    for row in parsed_rows:
        fields = row_to_fields(row)
        if not fields[0] and not fields[1] and (fields[6] > 0 or fields[7] > 0):
            shifted += 1
    if parsed_rows and shifted / max(1, len(parsed_rows)) > 0.05:
        mismatch.add("HEADER_SHIFT")

    return sorted(mismatch)


def load_build_site_module(path: Path):
    spec = importlib.util.spec_from_file_location("build_site_module", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load module: {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)  # type: ignore[attr-defined]
    return module


def detect_source_meta(module: Any, source_url: str) -> tuple[str, str]:
    parsed = urlparse(source_url)
    ext = Path(parsed.path).suffix.lower()
    source_type = "html"
    if ext == ".pdf":
        source_type = "pdf"
    elif ext in {".xls", ".xlsx"}:
        source_type = "excel"
    elif ext == ".csv":
        source_type = "csv"

    pages = ""
    response = None
    if source_type in {"html", "unknown"}:
        try:
            response = module.fetch(source_url)
            ctype = clean_text(response.headers.get("content-type")).lower()
            if "pdf" in ctype:
                source_type = "pdf"
            elif "excel" in ctype or "spreadsheet" in ctype:
                source_type = "excel"
            elif "csv" in ctype:
                source_type = "csv"
        except Exception:
            pass

    if source_type == "pdf":
        try:
            if response is None:
                response = module.fetch(source_url)
            if getattr(module, "pdfplumber", None) is not None:
                with module.pdfplumber.open(io.BytesIO(response.content)) as pdf:  # type: ignore[attr-defined]
                    pages = str(len(pdf.pages))
        except Exception:
            pages = ""
    return source_type, pages


def ensure_register(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        return
    with path.open("w", encoding="utf-8", newline="") as fp:
        writer = csv.DictWriter(fp, fieldnames=REGISTER_COLUMNS)
        writer.writeheader()


def append_register(path: Path, rows: list[dict[str, str]]) -> None:
    ensure_register(path)
    with path.open("a", encoding="utf-8", newline="") as fp:
        writer = csv.DictWriter(fp, fieldnames=REGISTER_COLUMNS)
        for row in rows:
            writer.writerow(row)


def take_screenshot(page: Any, url: str, out_path: Path, wait_selector: str = "") -> bool:
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=90000)
        if wait_selector:
            try:
                page.wait_for_selector(wait_selector, timeout=20000)
            except Exception:
                pass
        page.wait_for_timeout(1000)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(out_path), full_page=True)
        return True
    except Exception:
        return False


def render_pdf_pages_fallback(module: Any, source_url: str, evidence_dir: Path, max_pages: int) -> list[str]:
    if pypdfium2 is None:
        return []
    try:
        response = module.fetch(source_url)
        pdf = pypdfium2.PdfDocument(response.content)
    except Exception:
        return []

    paths: list[str] = []
    try:
        page_count = min(max_pages, len(pdf))
        for idx in range(page_count):
            try:
                page = pdf[idx]
                bitmap = page.render(scale=2)
                image = bitmap.to_pil()
                out_path = evidence_dir / f"source_page_{idx + 1}.png"
                out_path.parent.mkdir(parents=True, exist_ok=True)
                image.save(out_path)
                paths.append(str(out_path))
            except Exception:
                continue
    finally:
        try:
            pdf.close()
        except Exception:
            pass
    return paths


def capture_before_evidence(
    page: Any,
    module: Any,
    uni_id: str,
    source_url: str,
    source_type: str,
    source_pages: str,
    portal_base_url: str,
    evidence_dir: Path,
    max_source_pages: int,
) -> str:
    before_paths: list[str] = []
    before_portal = evidence_dir / "portal_before.png"
    portal_url = f"{portal_base_url}{uni_id}"
    if take_screenshot(page, portal_url, before_portal, wait_selector="#vacancyTable"):
        before_paths.append(str(before_portal))

    max_pages = 1
    if source_type == "pdf":
        try:
            max_pages = min(max_source_pages, max(1, int(source_pages or "1")))
        except ValueError:
            max_pages = min(max_source_pages, 1)
    source_shots = 0
    for page_no in range(1, max_pages + 1):
        target = source_url if page_no == 1 else f"{source_url}#page={page_no}"
        source_path = evidence_dir / f"source_page_{page_no}.png"
        if take_screenshot(page, target, source_path):
            before_paths.append(str(source_path))
            source_shots += 1
    if source_type == "pdf" and source_shots == 0:
        before_paths.extend(render_pdf_pages_fallback(module, source_url, evidence_dir, max_pages))
    return "; ".join(before_paths)


def capture_after_evidence(page: Any, uni_id: str, portal_base_url: str, evidence_dir: Path) -> str:
    after_portal = evidence_dir / "portal_after.png"
    portal_url = f"{portal_base_url}{uni_id}"
    if take_screenshot(page, portal_url, after_portal, wait_selector="#vacancyTable"):
        return str(after_portal)
    return ""


def rebuild_portal(build_portal_script: Path, universities_json: Path) -> None:
    import subprocess

    cmd = [
        "python3",
        str(build_portal_script),
        "--vacancies",
        str(universities_json),
    ]
    subprocess.run(cmd, check=True)


def apply_build_site_fallback(module: Any, uni_id: str, source_url: str, result: dict[str, Any]) -> dict[str, Any]:
    fallback_map = getattr(module, "MANUAL_VACANCY_FALLBACKS", {})
    fallback = fallback_map.get(uni_id)
    if not fallback:
        return result

    std_rows = result.get("standardized_rows") or []
    has_rows = isinstance(std_rows, list) and len(std_rows) > 0
    if result.get("status") == "ok" and has_rows:
        return result

    # Policy exception: u029 must remain error without fallback.
    if uni_id == "u029":
        return result

    tried = result.get("tried_urls") or [source_url]
    fetched_at = result.get("fetched_at") or datetime.now(timezone.utc).isoformat()
    return module.manual_fallback_payload(fallback, source_url, tried, fetched_at)


def iter_target_ids(batch: str, ids: str) -> list[str]:
    if ids:
        return parse_ids(ids)
    if batch:
        if batch not in BATCHES:
            raise RuntimeError(f"Unknown batch: {batch}")
        return BATCHES[batch]
    return [uni_id for group in BATCHES.values() for uni_id in group]


def main() -> None:
    parser = argparse.ArgumentParser(description="QA verification of vacancy parsing by university batches.")
    parser.add_argument("--data", default="site/data/universities.json", help="Path to universities.json")
    parser.add_argument("--batch", default="", help="Batch number from verification plan (1..11)")
    parser.add_argument("--ids", default="", help="Comma/space separated IDs, e.g. u002,u022,u027")
    parser.add_argument("--apply-fixes", action="store_true", help="Replace university vacancies with fresh extraction on mismatch")
    parser.add_argument("--save-data", action="store_true", help="Persist modified universities.json when --apply-fixes is enabled")
    parser.add_argument("--register", default="qa/vacancy_verification_register.csv", help="QA register CSV path")
    parser.add_argument("--evidence-dir", default="qa/evidence", help="Evidence root directory")
    parser.add_argument("--portal-base-url", default="http://127.0.0.1:8123/profile.html?id=", help="Portal profile URL prefix")
    parser.add_argument("--max-source-pages", type=int, default=3, help="Max number of source PDF pages to screenshot")
    parser.add_argument("--capture-evidence", action="store_true", help="Capture portal/source screenshots via Playwright")
    parser.add_argument("--build-site-script", default="scripts/build_site.py", help="Path to build_site.py")
    parser.add_argument("--build-portal-script", default="scripts/build_portal_data.py", help="Path to build_portal_data.py")
    args = parser.parse_args()

    data_path = Path(args.data).resolve()
    register_path = Path(args.register).resolve()
    evidence_root = Path(args.evidence_dir).resolve()
    build_site_script = Path(args.build_site_script).resolve()
    build_portal_script = Path(args.build_portal_script).resolve()

    payload = json.loads(data_path.read_text(encoding="utf-8"))
    universities = payload.get("universities", [])
    by_id = {normalize_uni_id(uni.get("id")): uni for uni in universities}
    targets = iter_target_ids(args.batch, args.ids)

    build_site = load_build_site_module(build_site_script)
    now = datetime.now(timezone.utc).isoformat()
    rows_for_register: list[dict[str, str]] = []
    changed = False
    if args.capture_evidence and sync_playwright is None:
        print("[WARN] Playwright is not available; evidence capture is skipped.")

    if args.capture_evidence and sync_playwright is not None:
        playwright_ctx = sync_playwright().start()
        browser = playwright_ctx.chromium.launch()
        page = browser.new_page(viewport={"width": 1600, "height": 1800})
    else:
        playwright_ctx = None
        browser = None
        page = None

    try:
        for uni_id in targets:
            uni = by_id.get(normalize_uni_id(uni_id))
            if not uni:
                print(f"[WARN] {uni_id}: not found in universities.json")
                continue

            uni_id_norm = normalize_uni_id(uni.get("id"))
            uni_name = clean_text(uni.get("university"))
            vacancies = uni.get("vacancies") or {}
            source_url = clean_text(uni.get("official_vacancies_link") or vacancies.get("source_url"))
            parsed_before_rows = vacancies.get("standardized_rows") or []
            parsed_rows_before = len(parsed_before_rows)

            source_type = "unknown"
            source_pages = ""
            parsed_source = {
                "status": "error",
                "message": "source url missing",
                "standardized_rows": [],
                "row_count": 0,
            }

            if source_url:
                source_type, source_pages = detect_source_meta(build_site, source_url)
                try:
                    parsed_source = build_site.extract_vacancies(source_url)
                    parsed_source = apply_build_site_fallback(build_site, uni_id_norm, source_url, parsed_source)
                except Exception as exc:  # noqa: BLE001
                    parsed_source = {
                        "status": "error",
                        "message": f"extract_vacancies failed: {exc}",
                        "standardized_rows": [],
                        "row_count": 0,
                    }

            evidence_dir = evidence_root / uni_id_norm
            evidence_before = ""
            evidence_after = ""
            if page is not None and source_url:
                evidence_before = capture_before_evidence(
                    page=page,
                    module=build_site,
                    uni_id=uni_id_norm,
                    source_url=source_url,
                    source_type=source_type,
                    source_pages=source_pages,
                    portal_base_url=args.portal_base_url,
                    evidence_dir=evidence_dir,
                    max_source_pages=max(1, args.max_source_pages),
                )

            expected_rows = parsed_source.get("standardized_rows") or []
            expected_rows_source = len(expected_rows)

            source_status = clean_text(parsed_source.get("status") or "").lower()
            if uni_id_norm == "u029" and source_status != "ok":
                mismatch_types = ["SOURCE_UNAVAILABLE"]
                strict_match = "ERROR"
            elif source_status != "ok" or expected_rows_source == 0:
                mismatch_types = ["SOURCE_PARSE_ERROR"]
                strict_match = "FAIL"
            else:
                mismatch_types = classify_mismatch(parsed_before_rows, expected_rows, source_type)
                strict_match = "PASS" if not mismatch_types else "FAIL"

            fix_strategy = ""
            fix_files = ""
            parsed_rows_after = parsed_rows_before
            notes = clean_text(parsed_source.get("message"))

            if args.apply_fixes and strict_match == "FAIL" and parsed_source.get("status") == "ok":
                uni["vacancies"] = parsed_source
                changed = True
                fix_strategy = "refresh_from_source"
                fix_files = "site/data/universities.json"
                parsed_rows_after = len((uni.get("vacancies") or {}).get("standardized_rows") or [])
                mismatch_types = classify_mismatch(uni["vacancies"].get("standardized_rows") or [], expected_rows, source_type)
                strict_match = "PASS" if not mismatch_types else "FAIL"

                if args.save_data:
                    data_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
                    rebuild_portal(build_portal_script, data_path)

            if page is not None:
                evidence_after = capture_after_evidence(
                    page=page,
                    uni_id=uni_id_norm,
                    portal_base_url=args.portal_base_url,
                    evidence_dir=evidence_dir,
                )

            row = {
                "batch_id": args.batch or "manual",
                "uni_id": uni_id_norm,
                "uni_name": uni_name,
                "source_url": source_url,
                "source_type": source_type,
                "source_pages": source_pages,
                "parsed_rows_before": str(parsed_rows_before),
                "expected_rows_source": str(expected_rows_source),
                "mismatch_types": ",".join(mismatch_types),
                "fix_strategy": fix_strategy,
                "fix_files": fix_files,
                "parsed_rows_after": str(parsed_rows_after),
                "strict_match": strict_match,
                "evidence_before": evidence_before,
                "evidence_after": evidence_after,
                "checked_at": now,
                "notes": notes,
            }
            rows_for_register.append(row)
            print(f"[{uni_id_norm}] {strict_match} | before={parsed_rows_before} expected={expected_rows_source} mismatch={row['mismatch_types'] or '-'}")
    finally:
        if browser is not None:
            browser.close()
        if playwright_ctx is not None:
            playwright_ctx.stop()

    append_register(register_path, rows_for_register)

    if changed and args.save_data:
        data_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"[INFO] Saved updated data: {data_path}")
        rebuild_portal(build_portal_script, data_path)
        print("[INFO] Rebuilt portal data.")

    print(f"[DONE] Register updated: {register_path}")


if __name__ == "__main__":
    main()
