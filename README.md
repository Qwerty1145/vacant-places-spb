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

- Для просмотра уже собранного сайта: Python 3.10+ на той системе, из которой вы запускаете сервер.
- Для пересборки `portal_data.js` на Windows: Python 3.10+ и пакет `openpyxl`.
- Для полной пересборки данных: удобнее использовать WSL / Linux и существующее окружение `.venv` в корне проекта.
- Текущее `.venv` создано под WSL / Linux. Команды вида `.venv/bin/python` не нужно запускать из PowerShell.

## Быстрый запуск готового сайта

Если нужно просто открыть уже собранную версию сайта, пересборка данных не требуется.

### PowerShell (Windows, основной вариант)

```powershell
cd "C:\путь\к\проекту"
py -m http.server 8123 --directory site
```

Если проект у вас лежит на диске `C:` по пути `C:\сайт с вузвами`, команда будет такой:

```powershell
cd "C:\сайт с вузвами"
py -m http.server 8123 --directory site
```

### WSL / Linux (альтернатива)

```bash
cd "/mnt/c/сайт с вузвами"
python3 -m http.server 8123 --directory site
```

Открыть в браузере:

- `http://localhost:8123/spb_transfer_portal.html`

Остановка сервера:

- `Ctrl+C`

## Пересборка фронтенд-данных

### PowerShell (Windows)

Если вы меняли `site/data/universities.json`, шаблон HTML или скрипты сборки, можно пересобрать `portal_data.js` прямо из PowerShell:

```powershell
cd "C:\путь\к\проекту"
py -m venv .venv-win
.\.venv-win\Scripts\python.exe -m pip install openpyxl
.\.venv-win\Scripts\python.exe scripts\build_portal_data.py
.\.venv-win\Scripts\python.exe -m http.server 8123 --directory site
```

### WSL / Linux

Если вы меняли `site/data/universities.json`, шаблон HTML или скрипты сборки, сначала пересоберите `portal_data.js`:

```bash
cd "/mnt/c/сайт с вузвами"
.venv/bin/python scripts/build_portal_data.py
.venv/bin/python -m http.server 8123 --directory site
```

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

## Важно

- Для обычного запуска сайта WSL не нужен.
- Путь `/mnt/c/...` работает только внутри WSL. В PowerShell используйте обычный Windows-путь вида `C:\...`.
- Команда `.venv/bin/python` работает только в WSL / Linux shell. В PowerShell используйте `py` или отдельное Windows-окружение, например `.venv-win`.
- В PowerShell для простого просмотра сайта используйте `py -m http.server 8123 --directory site`.
- Аргумент `--directory` должен содержать два обычных дефиса `--`, а не типографское тире `—`.

## Полезно

- Работаем с обновленным датасетом: `site/data/universities.json`.
- Старый файл `site/data/universities.prestandard.json` в текущем пайплайне не используется.
