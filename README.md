# SPB Transfer Portal

Сайт по вакантным местам для перевода в вузы Санкт-Петербурга.

## Что в проекте

- `site/spb_transfer_portal.html` — основная страница портала.
- `site/data/universities.json` — полный собранный датасет (источник для портала).
- `site/data/portal_data.js` — готовые данные для фронтенда (`window.PORTAL_DATA`).
- `site/data/manual_profile_overrides.json` — ручные правки профилей.
- `scripts/build_site.py` — сборка `universities.json` из Excel и парсинга источников.
- `scripts/build_portal_data.py` — сборка `portal_data.js` и финального HTML.

## Требования

- Python 3.10+
- Виртуальное окружение `.venv` в корне проекта
- Установленные зависимости в `.venv` (включая `openpyxl`, `requests`, `beautifulsoup4`, `pandas`, `pdfplumber`, `camelot-py`)

## Быстрый запуск (WSL / Linux)

```bash
cd "/mnt/c/сайт с вузвами"
.venv/bin/python scripts/build_portal_data.py
.venv/bin/python -m http.server 8123 --directory site
```

Открыть в браузере:

- `http://localhost:8123/spb_transfer_portal.html`

Остановка сервера:

- `Ctrl+C`

## Полная пересборка данных (WSL / Linux)

Если нужно заново спарсить вузы из актуальной Excel-таблицы:

```bash
cd "/mnt/c/сайт с вузвами"
.venv/bin/python scripts/build_site.py \
  --source "/mnt/c/Users/arsen/Downloads/transfer_dates_spb_FULL_v2.xlsx" \
  --out "site/data/universities.json" \
  --workers 8

.venv/bin/python scripts/build_portal_data.py
```

После этого снова поднимите локальный сервер:

```bash
.venv/bin/python -m http.server 8123 --directory site
```

## Запуск из PowerShell (Windows)

```powershell
cd "<путь_к_проекту>"
.\.venv\Scripts\python.exe scripts\build_portal_data.py
.\.venv\Scripts\python.exe -m http.server 8123 --directory site
```

Открыть:

- `http://localhost:8123/spb_transfer_portal.html`

## Полезно

- Работаем с обновленным датасетом: `site/data/universities.json`.
- Старый файл `site/data/universities.prestandard.json` в текущем пайплайне не используется.
