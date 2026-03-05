# Vacancy QA

Артефакты тотальной верификации парсинга таблиц вакантных мест:

- `vacancy_verification_register.csv` — реестр проверки по вузам.
- `evidence/uXXX/` — скрин-доказательства:
  - `portal_before.png`
  - `source_page_*.png`
  - `portal_after.png`

## Команды

Проверка одного батча:

```bash
.venv/bin/python scripts/vacancy_qa.py \
  --batch 1 \
  --capture-evidence \
  --register qa/vacancy_verification_register.csv \
  --evidence-dir qa/evidence \
  --portal-base-url http://127.0.0.1:8123/profile.html?id=
```

Проверка произвольного списка вузов:

```bash
.venv/bin/python scripts/vacancy_qa.py \
  --ids u002,u022,u027 \
  --capture-evidence \
  --register qa/vacancy_verification_register.csv \
  --evidence-dir qa/evidence \
  --portal-base-url http://127.0.0.1:8123/profile.html?id=
```

Если нужно перезаписать данные по вузу из свежего источника:

```bash
.venv/bin/python scripts/vacancy_qa.py \
  --ids u010 \
  --apply-fixes --save-data \
  --capture-evidence \
  --register qa/vacancy_verification_register.csv \
  --evidence-dir qa/evidence \
  --portal-base-url http://127.0.0.1:8123/profile.html?id=
```

## Политика

- Для `u029` fallback-таблица не применяется (`strict_match=ERROR`, `SOURCE_UNAVAILABLE`).
- Для остальных вузов QA-скрипт использует те же правила fallback, что и `scripts/build_site.py`.
