#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Iterable

from playwright.sync_api import sync_playwright


def iter_university_ids(data: dict) -> Iterable[str]:
    for uni in data.get("universities", []):
        uni_id = str(uni.get("id", "")).strip()
        if uni_id:
            yield uni_id


def normalize_id(raw: str) -> str:
    text = str(raw or "").strip()
    if not text:
        return ""
    if text.lower().startswith("u"):
        return text.lower()
    if text.isdigit():
        return f"u{int(text):03d}"
    return text.lower()


def parse_ids_arg(raw: str) -> list[str]:
    if not raw:
        return []
    items: list[str] = []
    for chunk in raw.replace(";", ",").split(","):
        item = normalize_id(chunk)
        if item:
            items.append(item)
    return items


def main() -> None:
    parser = argparse.ArgumentParser(description="Take visual screenshots of all university profiles.")
    parser.add_argument(
        "--data",
        default="site/data/universities.json",
        help="Path to universities.json",
    )
    parser.add_argument(
        "--base-url",
        default="http://127.0.0.1:8123/profile.html?id=",
        help="Base URL for profile pages",
    )
    parser.add_argument("--out", default="shots", help="Output directory for PNGs")
    parser.add_argument("--limit", type=int, default=0, help="Limit number of profiles (0=all)")
    parser.add_argument(
        "--ids",
        default="",
        help="Comma-separated university IDs to capture, e.g. u002,u022,u027 (overrides --limit)",
    )
    parser.add_argument(
        "--viewport",
        default="1400x1800",
        help="Viewport size, e.g. 1400x1800",
    )
    args = parser.parse_args()

    data_path = Path(args.data)
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    raw = json.loads(data_path.read_text(encoding="utf-8"))
    ids = list(iter_university_ids(raw))
    selected_ids = parse_ids_arg(args.ids)
    if selected_ids:
        allow = set(selected_ids)
        ids = [uni_id for uni_id in ids if uni_id in allow]
    elif args.limit and args.limit > 0:
        ids = ids[: args.limit]

    width, height = (int(part) for part in args.viewport.lower().split("x", 1))

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": width, "height": height})

        for uni_id in ids:
            url = f"{args.base_url}{uni_id}"
            page.goto(url, wait_until="networkidle")
            page.wait_for_selector("#vacancyTable", state="attached", timeout=15000)
            try:
                page.wait_for_selector("#vacancyBody tr", state="attached", timeout=15000)
            except Exception:
                pass
            page.wait_for_timeout(800)
            out_path = out_dir / f"{uni_id}.png"
            page.screenshot(path=str(out_path), full_page=True)

        browser.close()


if __name__ == "__main__":
    main()
