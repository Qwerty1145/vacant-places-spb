const { useState, useMemo, useEffect, useRef } = React;

const DATA = window.PORTAL_DATA || {};
const UNIS = Array.isArray(DATA.unis) ? DATA.unis : [];
const VACANCIES_BY_ID = DATA.vacanciesById && typeof DATA.vacanciesById === "object"
  ? DATA.vacanciesById
  : {};
const STATS = DATA.stats && typeof DATA.stats === "object" ? DATA.stats : {};

const TLABELS = {
  federal: "Федеральный",
  private: "Частный/коммерческий",
  art: "Творческий",
  regional: "Региональный/филиал",
};

function typeCls(type) {
  if (type === "art") return "art";
  if (type === "private" || type === "priv") return "priv";
  if (type === "regional") return "reg";
  return "";
}

function levelNorm(level) {
  const value = String(level || "")
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!value) return "";
  if (value.includes("бакалав")) return "бакалавриат";
  if (value.includes("магистр")) return "магистратура";
  if (value.includes("спо") || value.includes("среднее профессион")) return "спо";
  if (value.includes("подготовка кадров высшей квалификации")) return "аспирантура";
  if (value.includes("аспиран")) return "аспирантура";
  if (value.includes("ординат")) return "ординатура";
  if (value.includes("высш")) return "высшее";
  if (value.includes("специал")) return "специалитет";
  return value;
}

function lvCls(level) {
  const norm = levelNorm(level);
  if (norm.includes("бакалав")) return "bak";
  if (norm.includes("магистр")) return "mag";
  if (norm === "спо") return "spo2";
  return "spec";
}

function lvLabel(level) {
  const norm = levelNorm(level);
  if (norm.includes("бакалав")) return "Бакалавриат";
  if (norm.includes("магистр")) return "Магистратура";
  if (norm === "спо") return "СПО";
  if (norm.includes("аспиран")) return "Аспирантура";
  if (norm.includes("ординат")) return "Ординатура";
  if (norm === "высшее") return "Высшее";
  if (norm.includes("специал")) return "Специалитет";
  return String(level || "Не указано");
}

function Lv({ level }) {
  return React.createElement("span", { className: `lv ${lvCls(level)}` }, lvLabel(level));
}

function Nb({ n, type }) {
  if (n === null || n === undefined) {
    return React.createElement("span", { style: { color: "var(--muted)" } }, "-");
  }
  const value = Number(n);
  if (!Number.isFinite(value)) {
    return React.createElement("span", { style: { color: "var(--muted)" } }, "-");
  }
  return React.createElement("span", { className: `nb ${value === 0 ? "z" : type}` }, value);
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function shortText(value, maxLen = 40) {
  const text = String(value || "");
  if (!text) return "";
  return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;
}

function normCourse(value) {
  const text = String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";
  const lower = text.toLowerCase();
  if (lower === "0" || lower === "-" || lower === "—" || lower === "–" || lower === "нет данных") return "";
  const numericMatch = text.match(/^(\d+)\s*(?:курс|курс[а-я]*)?$/i);
  if (numericMatch) return numericMatch[1];
  return text;
}

function courseLabel(value) {
  const norm = normCourse(value);
  if (!norm) return "Не указан";
  if (/^\d+$/.test(norm)) return `${norm} курс`;
  return norm;
}

function formNorm(value) {
  const text = String(value ?? "")
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*-\s*/g, "-")
    .trim();
  if (!text) return "";
  if (text === "0" || text === "-" || text === "—" || text === "–" || text === "нет данных") return "";
  if (text.includes("очно-заоч")) return "очно-заочная";
  if (text.includes("заоч")) return "заочная";
  if (text.includes("очн")) return "очная";
  if (text.includes("дистанц") || text.includes("онлайн")) return "дистанционная";
  return text;
}

function formLabel(value) {
  const norm = formNorm(value);
  if (!norm) return "не указана";
  if (norm === "очная") return "Очная";
  if (norm === "заочная") return "Заочная";
  if (norm === "очно-заочная") return "Очно-заочная";
  if (norm === "дистанционная") return "Дистанционная";
  return norm.charAt(0).toUpperCase() + norm.slice(1);
}

function normComparableText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function vacancyRowKey(row) {
  return [
    normComparableText(row.code),
    normComparableText(row.dir),
    normComparableText(row.program),
    levelNorm(row.level),
    normCourse(row.course),
    formNorm(row.form),
    toNumber(row.budget),
    toNumber(row.paid),
  ].join("|");
}

function normalizeLongText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*;\s*/g, "; ")
    .trim();
}

function cleanItemText(value) {
  return String(value || "")
    .replace(/^[\-–—•●*]+\s*/, "")
    .replace(/\s+/g, " ")
    .replace(/[;\s]+$/g, "")
    .trim();
}

function splitStructuredItems(value) {
  const text = normalizeLongText(value);
  if (!text) return [];

  const numbered = [];
  const numberedPattern = /(?:^|[\s;])(\d{1,2})[.)]\s*([\s\S]*?)(?=(?:[\s;]\d{1,2}[.)]\s)|$)/g;
  let match;
  while ((match = numberedPattern.exec(text)) !== null) {
    const item = cleanItemText(match[2]);
    if (item) numbered.push(item);
  }
  if (numbered.length >= 2) return numbered;

  const chunks = text
    .split(/\s*;\s*|\s*[•●]\s*/g)
    .map(cleanItemText)
    .filter(Boolean);
  if (chunks.length >= 2) return chunks;

  return [];
}

function renderTextWithLinks(text, keyPrefix = "txt") {
  const source = String(text || "");
  if (!source) return "";
  const nodes = [];
  const urlRe = /(https?:\/\/[^\s<>"'`]+[^\s<>"'`.,;:!?])/gi;
  let start = 0;
  let match;
  while ((match = urlRe.exec(source)) !== null) {
    const url = match[0];
    if (match.index > start) nodes.push(source.slice(start, match.index));
    nodes.push(
      React.createElement(
        "a",
        { key: `${keyPrefix}-${match.index}`, className: "proc-link", href: url, target: "_blank" },
        url
      )
    );
    start = match.index + url.length;
  }
  if (start < source.length) nodes.push(source.slice(start));
  return nodes.length ? nodes : source;
}

function getVacanciesForUni(uni) {
  const key = String(uni.id);
  const rows = VACANCIES_BY_ID[key];
  return Array.isArray(rows) ? rows : [];
}

function Sec({ title, icon, children, open0 = true }) {
  const [open, setOpen] = useState(open0);
  return React.createElement(
    "div",
    { className: "sec" },
    React.createElement(
      "div",
      { className: "sh", onClick: () => setOpen(!open) },
      React.createElement(
        "div",
        { className: "st" },
        React.createElement("div", { className: "si2" }, icon),
        title
      ),
      React.createElement("span", { className: `chev ${open ? "o" : ""}` }, "▼")
    ),
    open && React.createElement("div", { className: "sb" }, children)
  );
}

function VacSec({ uni, highlightRowKey = "" }) {
  const allRows = getVacanciesForUni(uni);
  const hasRows = allRows.length > 0;
  const [q, setQ] = useState("");
  const [fLv, setFL] = useState("all");
  const [fFm, setFF] = useState("all");
  const [fCr, setFC] = useState("all");
  const [fBd, setFB] = useState("all");
  const [onlyPl, setOP] = useState(false);
  const [sb, setSB] = useState("");
  const [sd, setSD] = useState(1);
  const highlightRowRef = useRef(null);
  const scrolledHighlightKeyRef = useRef("");

  function toggleSort(column) {
    if (sb === column) setSD((prev) => -prev);
    else {
      setSB(column);
      setSD(1);
    }
  }

  function SA({ col }) {
    const on = sb === col;
    return React.createElement(
      "span",
      { className: `sarr ${on ? "on" : ""}` },
      on ? (sd > 0 ? "▲" : "▼") : "⇅"
    );
  }

  const levels = [...new Set(allRows.map((row) => levelNorm(row.level)).filter(Boolean))];
  const forms = [...new Set(allRows.map((row) => formNorm(row.form)).filter(Boolean))];
  const courses = [...new Set(allRows.map((row) => normCourse(row.course)).filter(Boolean))].sort((left, right) =>
    new Intl.Collator("ru", { numeric: true, sensitivity: "base" }).compare(left, right)
  );

  const filtered = useMemo(() => {
    const collator = new Intl.Collator("ru", { numeric: true, sensitivity: "base" });
    let rows = [...allRows];
    if (q) {
      const needle = q.toLowerCase();
      rows = rows.filter((row) =>
        [row.code, row.dir, row.program, lvLabel(row.level), formLabel(row.form), normCourse(row.course)]
          .map((value) => String(value || "").toLowerCase())
          .some((value) => value.includes(needle))
      );
    }
    if (fLv !== "all") rows = rows.filter((row) => levelNorm(row.level) === fLv);
    if (fFm !== "all") rows = rows.filter((row) => formNorm(row.form) === fFm);
    if (fCr !== "all") rows = rows.filter((row) => normCourse(row.course) === fCr);
    if (fBd === "hasB") rows = rows.filter((row) => toNumber(row.budget) > 0);
    if (fBd === "hasP") rows = rows.filter((row) => toNumber(row.paid) > 0);
    if (onlyPl) rows = rows.filter((row) => toNumber(row.budget) > 0 || toNumber(row.paid) > 0);

    if (sb) {
      const numericCols = new Set(["course", "budget", "paid"]);
      rows.sort((left, right) => {
        if (numericCols.has(sb)) {
          const leftValue = sb === "course" ? toNumber(normCourse(left.course)) : toNumber(left[sb]);
          const rightValue = sb === "course" ? toNumber(normCourse(right.course)) : toNumber(right[sb]);
          return sd * (leftValue - rightValue);
        }
        return sd * collator.compare(String(left[sb] || ""), String(right[sb] || ""));
      });
    }
    return rows;
  }, [allRows, q, fLv, fFm, fCr, fBd, onlyPl, sb, sd]);

  const totalBudget = filtered.reduce((sum, row) => sum + toNumber(row.budget), 0);
  const totalPaid = filtered.reduce((sum, row) => sum + toNumber(row.paid), 0);
  const hasFilters = q || fLv !== "all" || fFm !== "all" || fCr !== "all" || fBd !== "all" || onlyPl;
  const hasHighlight = Boolean(highlightRowKey);

  useEffect(() => {
    if (!hasHighlight || !highlightRowKey) return;
    if (scrolledHighlightKeyRef.current === highlightRowKey) return;
    if (highlightRowRef.current) {
      highlightRowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      scrolledHighlightKeyRef.current = highlightRowKey;
    }
  }, [hasHighlight, highlightRowKey, filtered]);

  const vacancyInfo = hasRows
    ? React.createElement(
        "div",
        { className: "snote ok" },
        React.createElement("span", { className: "ic" }, "✅"),
        React.createElement(
          "div",
          null,
          React.createElement("strong", null, `Загружены данные: ${allRows.length} строк.`),
          React.createElement("br"),
          "Источник: ",
          uni.vacancySource
            ? React.createElement(
                "a",
                { href: uni.vacancySource, target: "_blank", style: { color: "var(--teal)" } },
                shortText(uni.vacancySource, 120)
              )
            : "не указан",
          ". Бюджет = сумма всех бюджетных форм финансирования."
        )
      )
    : React.createElement(
        "div",
        { className: "snote" },
        React.createElement("span", { className: "ic" }, "⚠️"),
        React.createElement(
          "div",
          null,
          uni.vacancyMessage
            ? `Таблица не загружена автоматически: ${uni.vacancyMessage}`
            : "Таблица вакантных мест не была получена автоматически.",
          " ",
          uni.src &&
            React.createElement(
              "a",
              { href: uni.src, target: "_blank", style: { color: "var(--teal)" } },
              "Перейти к источнику →"
            )
        )
      );

  return React.createElement(
    "div",
    null,
    vacancyInfo,
    hasRows &&
      React.createElement(
        "div",
        { className: "vc" },
        React.createElement(
          "div",
          { className: "vsw" },
          React.createElement(
            "svg",
            {
              xmlns: "http://www.w3.org/2000/svg",
              width: 11,
              height: 11,
              viewBox: "0 0 24 24",
              fill: "none",
              stroke: "currentColor",
              strokeWidth: 2.5,
            },
            React.createElement("circle", { cx: 11, cy: 11, r: 8 }),
            React.createElement("path", { d: "m21 21-4.35-4.35" })
          ),
          React.createElement("input", {
            className: "vs",
            placeholder: "Поиск по коду, направлению, программе...",
            value: q,
            onChange: (event) => setQ(event.target.value),
          })
        ),
        React.createElement(
          "select",
          { className: "vsel", value: fLv, onChange: (event) => setFL(event.target.value) },
          React.createElement("option", { value: "all" }, "Все уровни"),
          ...levels.map((level) => React.createElement("option", { key: level, value: level }, lvLabel(level)))
        ),
        React.createElement(
          "select",
          { className: "vsel", value: fFm, onChange: (event) => setFF(event.target.value) },
          React.createElement("option", { value: "all" }, "Все формы"),
          ...forms.map((form) => React.createElement("option", { key: form, value: form }, formLabel(form)))
        ),
        React.createElement(
          "select",
          { className: "vsel", value: fCr, onChange: (event) => setFC(event.target.value) },
          React.createElement("option", { value: "all" }, "Все курсы"),
          ...courses.map((course) =>
            React.createElement("option", { key: course, value: course }, courseLabel(course))
          )
        ),
        React.createElement(
          "select",
          { className: "vsel", value: fBd, onChange: (event) => setFB(event.target.value) },
          React.createElement("option", { value: "all" }, "Все места"),
          React.createElement("option", { value: "hasB" }, "Есть бюджетные"),
          React.createElement("option", { value: "hasP" }, "Есть платные")
        ),
        React.createElement(
          "button",
          { className: `vtog ${onlyPl ? "on" : ""}`, onClick: () => setOP(!onlyPl) },
          onlyPl ? "★ С местами" : "☆ С местами"
        ),
        hasFilters &&
          React.createElement(
            "button",
            {
              className: "vrs",
              onClick: () => {
                setQ("");
                setFL("all");
                setFF("all");
                setFC("all");
                setFB("all");
                setOP(false);
              },
            },
            "✕ Сбросить"
          )
      ),
    hasRows &&
      React.createElement(
        "div",
        { className: "ri" },
        React.createElement("span", null, `Показано: ${filtered.length} строк`),
        React.createElement("span", { className: "pill b" }, `⬤ Бюджет: ${totalBudget}`),
        React.createElement("span", { className: "pill p" }, `⬤ Платно: ${totalPaid}`)
      ),
    React.createElement(
      "div",
      { className: "vtw" },
      React.createElement(
        "table",
        { className: "vt" },
        React.createElement(
          "thead",
          null,
          React.createElement(
            "tr",
            null,
            React.createElement(
              "th",
              { className: "s", onClick: () => hasRows && toggleSort("code") },
              "Код специальности",
              hasRows && React.createElement(SA, { col: "code" })
            ),
            React.createElement(
              "th",
              { className: "s", onClick: () => hasRows && toggleSort("dir") },
              "Направление подготовки",
              hasRows && React.createElement(SA, { col: "dir" })
            ),
            React.createElement("th", null, "Программа / профиль"),
            React.createElement(
              "th",
              { className: "s", onClick: () => hasRows && toggleSort("level") },
              "Уровень",
              hasRows && React.createElement(SA, { col: "level" })
            ),
            React.createElement(
              "th",
              {
                className: "s",
                onClick: () => hasRows && toggleSort("course"),
                style: { textAlign: "center" },
              },
              "Курс",
              hasRows && React.createElement(SA, { col: "course" })
            ),
            React.createElement("th", null, "Форма"),
            React.createElement(
              "th",
              {
                className: "s",
                onClick: () => hasRows && toggleSort("budget"),
                style: { textAlign: "center" },
              },
              "Бюджет",
              hasRows && React.createElement(SA, { col: "budget" })
            ),
            React.createElement(
              "th",
              {
                className: "s",
                onClick: () => hasRows && toggleSort("paid"),
                style: { textAlign: "center" },
              },
              "Платно",
              hasRows && React.createElement(SA, { col: "paid" })
            )
          )
        ),
        React.createElement(
          "tbody",
          null,
          hasRows
            ? filtered.length === 0
              ? React.createElement(
                  "tr",
                  null,
                  React.createElement(
                    "td",
                    { colSpan: 8, style: { textAlign: "center", color: "var(--muted)", padding: "28px" } },
                    "Ничего не найдено. Измените фильтры."
                  )
                )
              : filtered.map((row, index) => {
                  const rowKey = vacancyRowKey(row);
                  const isHighlighted = hasHighlight && rowKey === highlightRowKey;
                  const highlightStyle = isHighlighted
                    ? {
                        background: "rgba(235, 189, 68, .16)",
                        boxShadow: "inset 0 0 0 1px rgba(235, 189, 68, .55)",
                      }
                    : undefined;
                  return React.createElement(
                    "tr",
                    {
                      key: `${rowKey}-${index}`,
                      ref: isHighlighted ? highlightRowRef : null,
                      style: highlightStyle,
                    },
                    React.createElement("td", { className: "cc" }, row.code || "—"),
                    React.createElement("td", { className: "dc" }, row.dir || "—"),
                    React.createElement("td", { className: "pc" }, row.program || "—"),
                    React.createElement("td", null, React.createElement(Lv, { level: row.level })),
                    React.createElement(
                      "td",
                      { style: { textAlign: "center", color: "var(--muted)" } },
                      normCourse(row.course) || "—"
                    ),
                    React.createElement(
                      "td",
                      null,
                      React.createElement("span", { className: "fb" }, formLabel(row.form))
                    ),
                    React.createElement(
                      "td",
                      { style: { textAlign: "center" } },
                      React.createElement(Nb, { n: row.budget, type: "b" })
                    ),
                    React.createElement(
                      "td",
                      { style: { textAlign: "center" } },
                      React.createElement(Nb, { n: row.paid, type: "p" })
                    )
                  );
                })
            : React.createElement(
                "tr",
                null,
                React.createElement(
                  "td",
                  { colSpan: 8 },
                  React.createElement(
                    "div",
                    { className: "empty" },
                    React.createElement("div", { className: "big" }, "📋"),
                    React.createElement("p", null, "Данные о вакантных местах временно недоступны.")
                  )
                )
              )
        )
      )
    )
  );
}

function GlobalVacancySec({ onSel }) {
  const allRows = useMemo(() => {
    const rows = [];
    for (const uni of UNIS) {
      const uniRows = getVacanciesForUni(uni);
      for (const row of uniRows) {
        rows.push({
          uniId: String(uni.id),
          uniName: uni.name || uni.abbr || "",
          uniAbbr: uni.abbr || uni.name || "",
          uniType: uni.type || "",
          uniDorm: Boolean(uni.dorm),
          code: String(row.code || ""),
          dir: String(row.dir || ""),
          program: String(row.program || ""),
          level: String(row.level || ""),
          course: normCourse(row.course),
          form: String(row.form || ""),
          budget: toNumber(row.budget),
          paid: toNumber(row.paid),
        });
      }
    }
    return rows;
  }, []);

  const uniById = useMemo(() => {
    const map = {};
    for (const uni of UNIS) map[String(uni.id)] = uni;
    return map;
  }, []);

  const [q, setQ] = useState("");
  const [fUni, setFU] = useState("all");
  const [fType, setFT] = useState("all");
  const [fLv, setFL] = useState("all");
  const [fFm, setFF] = useState("all");
  const [fCr, setFC] = useState("all");
  const [fBd, setFB] = useState("all");
  const [onlyDorm, setOD] = useState(false);
  const [sb, setSB] = useState("");
  const [sd, setSD] = useState(1);
  const [showAll, setShowAll] = useState(false);

  function toggleSort(column) {
    if (sb === column) setSD((prev) => -prev);
    else {
      setSB(column);
      setSD(1);
    }
  }

  function SA({ col }) {
    const on = sb === col;
    return React.createElement("span", { className: `sarr ${on ? "on" : ""}` }, on ? (sd > 0 ? "▲" : "▼") : "⇅");
  }

  const collator = new Intl.Collator("ru", { numeric: true, sensitivity: "base" });
  const levels = [...new Set(allRows.map((row) => levelNorm(row.level)).filter(Boolean))];
  const forms = [...new Set(allRows.map((row) => formNorm(row.form)).filter(Boolean))];
  const courses = [...new Set(allRows.map((row) => normCourse(row.course)).filter(Boolean))].sort((left, right) =>
    collator.compare(left, right)
  );
  const unis = [...new Set(allRows.map((row) => row.uniId))]
    .map((id) => {
      const uni = uniById[id];
      return uni ? { id, label: uni.abbr || uni.name || id } : { id, label: id };
    })
    .sort((left, right) => collator.compare(left.label, right.label));

  const filtered = useMemo(() => {
    let rows = [...allRows];
    if (q) {
      const needle = q.toLowerCase();
      rows = rows.filter((row) =>
        [
          row.uniName,
          row.uniAbbr,
          TLABELS[row.uniType] || row.uniType,
          row.code,
          row.dir,
          row.program,
          lvLabel(row.level),
          formLabel(row.form),
          row.course,
        ]
          .map((value) => String(value || "").toLowerCase())
          .some((value) => value.includes(needle))
      );
    }
    if (fUni !== "all") rows = rows.filter((row) => row.uniId === fUni);
    if (fType !== "all") rows = rows.filter((row) => String(row.uniType || "") === fType);
    if (fLv !== "all") rows = rows.filter((row) => levelNorm(row.level) === fLv);
    if (fFm !== "all") rows = rows.filter((row) => formNorm(row.form) === fFm);
    if (fCr !== "all") rows = rows.filter((row) => normCourse(row.course) === fCr);
    if (fBd === "hasB") rows = rows.filter((row) => toNumber(row.budget) > 0);
    if (fBd === "hasP") rows = rows.filter((row) => toNumber(row.paid) > 0);
    if (fBd === "hasAny") rows = rows.filter((row) => toNumber(row.budget) > 0 || toNumber(row.paid) > 0);
    if (onlyDorm) rows = rows.filter((row) => row.uniDorm);

    if (sb) {
      const numericCols = new Set(["budget", "paid", "course"]);
      rows.sort((left, right) => {
        if (numericCols.has(sb)) {
          const leftValue = sb === "course" ? toNumber(normCourse(left.course)) : toNumber(left[sb]);
          const rightValue = sb === "course" ? toNumber(normCourse(right.course)) : toNumber(right[sb]);
          return sd * (leftValue - rightValue);
        }
        return sd * collator.compare(String(left[sb] || ""), String(right[sb] || ""));
      });
    }
    return rows;
  }, [allRows, q, fUni, fType, fLv, fFm, fCr, fBd, onlyDorm, sb, sd, collator]);

  const hasFilters =
    q || fUni !== "all" || fType !== "all" || fLv !== "all" || fFm !== "all" || fCr !== "all" || fBd !== "all" || onlyDorm;
  const totalBudget = filtered.reduce((sum, row) => sum + toNumber(row.budget), 0);
  const totalPaid = filtered.reduce((sum, row) => sum + toNumber(row.paid), 0);
  const MAX_VISIBLE = 1200;
  const visibleRows = showAll || filtered.length <= MAX_VISIBLE ? filtered : filtered.slice(0, MAX_VISIBLE);
  const isTrimmed = visibleRows.length < filtered.length;

  return React.createElement(
    "div",
    null,
    React.createElement(
      "div",
      { className: "snote ok", style: { marginBottom: "14px" } },
      React.createElement("span", { className: "ic" }, "🌐"),
      React.createElement(
        "div",
        null,
        React.createElement("strong", null, `Глобальный индекс: ${allRows.length} строк из ${UNIS.length} вузов.`),
        React.createElement("br"),
        "Ищет по всем полям сразу: вуз, код, направление, программа, уровень, курс, форма, бюджет/платно."
      )
    ),
    React.createElement(
      "div",
      { className: "vc" },
      React.createElement(
        "div",
        { className: "vsw" },
        React.createElement(
          "svg",
          {
            xmlns: "http://www.w3.org/2000/svg",
            width: 11,
            height: 11,
            viewBox: "0 0 24 24",
            fill: "none",
            stroke: "currentColor",
            strokeWidth: 2.5,
          },
          React.createElement("circle", { cx: 11, cy: 11, r: 8 }),
          React.createElement("path", { d: "m21 21-4.35-4.35" })
        ),
        React.createElement("input", {
          className: "vs",
          placeholder: "Глобальный поиск по всем вузам и всем полям...",
          value: q,
          onChange: (event) => setQ(event.target.value),
        })
      ),
      React.createElement(
        "select",
        { className: "vsel", value: fUni, onChange: (event) => setFU(event.target.value) },
        React.createElement("option", { value: "all" }, "Все вузы"),
        ...unis.map((uni) => React.createElement("option", { key: uni.id, value: uni.id }, uni.label))
      ),
      React.createElement(
        "select",
        { className: "vsel", value: fType, onChange: (event) => setFT(event.target.value) },
        React.createElement("option", { value: "all" }, "Все типы"),
        React.createElement("option", { value: "federal" }, "Федеральные"),
        React.createElement("option", { value: "regional" }, "Региональные"),
        React.createElement("option", { value: "art" }, "Творческие"),
        React.createElement("option", { value: "private" }, "Частные")
      ),
      React.createElement(
        "select",
        { className: "vsel", value: fLv, onChange: (event) => setFL(event.target.value) },
        React.createElement("option", { value: "all" }, "Все уровни"),
        ...levels.map((level) => React.createElement("option", { key: level, value: level }, lvLabel(level)))
      ),
      React.createElement(
        "select",
        { className: "vsel", value: fFm, onChange: (event) => setFF(event.target.value) },
        React.createElement("option", { value: "all" }, "Все формы"),
        ...forms.map((form) => React.createElement("option", { key: form, value: form }, formLabel(form)))
      ),
      React.createElement(
        "select",
        { className: "vsel", value: fCr, onChange: (event) => setFC(event.target.value) },
        React.createElement("option", { value: "all" }, "Все курсы"),
        ...courses.map((course) => React.createElement("option", { key: course, value: course }, courseLabel(course)))
      ),
      React.createElement(
        "select",
        { className: "vsel", value: fBd, onChange: (event) => setFB(event.target.value) },
        React.createElement("option", { value: "all" }, "Все места"),
        React.createElement("option", { value: "hasB" }, "Есть бюджет"),
        React.createElement("option", { value: "hasP" }, "Есть платные"),
        React.createElement("option", { value: "hasAny" }, "Есть любые места")
      ),
      React.createElement(
        "button",
        { className: `vtog ${onlyDorm ? "on" : ""}`, onClick: () => setOD(!onlyDorm) },
        onlyDorm ? "🏠 Только с общежитием" : "🏠 Все по общежитию"
      ),
      hasFilters &&
        React.createElement(
          "button",
          {
            className: "vrs",
            onClick: () => {
              setQ("");
              setFU("all");
              setFT("all");
              setFL("all");
              setFF("all");
              setFC("all");
              setFB("all");
              setOD(false);
              setShowAll(false);
            },
          },
          "✕ Сбросить"
        )
    ),
    React.createElement(
      "div",
      { className: "ri" },
      React.createElement("span", null, `Показано: ${visibleRows.length} из ${filtered.length} строк`),
      React.createElement("span", { className: "pill b" }, `⬤ Бюджет: ${totalBudget}`),
      React.createElement("span", { className: "pill p" }, `⬤ Платно: ${totalPaid}`),
      isTrimmed &&
        React.createElement(
          "button",
          { className: "vrs", onClick: () => setShowAll(true), style: { marginLeft: "auto" } },
          `Показать все (${filtered.length})`
        )
    ),
    React.createElement(
      "div",
      { className: "vtw" },
      React.createElement(
        "table",
        { className: "vt" },
        React.createElement(
          "thead",
          null,
          React.createElement(
            "tr",
            null,
            React.createElement(
              "th",
              { className: "s", onClick: () => toggleSort("uniAbbr") },
              "Вуз",
              React.createElement(SA, { col: "uniAbbr" })
            ),
            React.createElement(
              "th",
              { className: "s", onClick: () => toggleSort("code") },
              "Код",
              React.createElement(SA, { col: "code" })
            ),
            React.createElement(
              "th",
              { className: "s", onClick: () => toggleSort("dir") },
              "Направление",
              React.createElement(SA, { col: "dir" })
            ),
            React.createElement("th", null, "Программа / профиль"),
            React.createElement(
              "th",
              { className: "s", onClick: () => toggleSort("level") },
              "Уровень",
              React.createElement(SA, { col: "level" })
            ),
            React.createElement(
              "th",
              { className: "s", onClick: () => toggleSort("course"), style: { textAlign: "center" } },
              "Курс",
              React.createElement(SA, { col: "course" })
            ),
            React.createElement(
              "th",
              { className: "s", onClick: () => toggleSort("form") },
              "Форма",
              React.createElement(SA, { col: "form" })
            ),
            React.createElement(
              "th",
              { className: "s", onClick: () => toggleSort("budget"), style: { textAlign: "center" } },
              "Бюджет",
              React.createElement(SA, { col: "budget" })
            ),
            React.createElement(
              "th",
              { className: "s", onClick: () => toggleSort("paid"), style: { textAlign: "center" } },
              "Платно",
              React.createElement(SA, { col: "paid" })
            ),
            React.createElement("th", null, "")
          )
        ),
        React.createElement(
          "tbody",
          null,
          visibleRows.length === 0
            ? React.createElement(
                "tr",
                null,
                React.createElement(
                  "td",
                  { colSpan: 10, style: { textAlign: "center", color: "var(--muted)", padding: "28px" } },
                  "Ничего не найдено. Измените фильтры."
                )
              )
            : visibleRows.map((row, index) => {
                const uni = uniById[row.uniId];
                const openProfile = () =>
                  uni &&
                  onSel(uni, {
                    source: "global",
                    rowKey: vacancyRowKey(row),
                  });
                return React.createElement(
                  "tr",
                  {
                    key: `${row.uniId}-${index}`,
                    onClick: openProfile,
                    style: { cursor: uni ? "pointer" : "default" },
                  },
                  React.createElement(
                    "td",
                    null,
                    React.createElement("div", { className: "td-abbr" }, row.uniAbbr || row.uniName || "—"),
                    React.createElement(
                      "div",
                      { style: { fontSize: "10px", color: "var(--muted)", marginTop: "2px" } },
                      TLABELS[row.uniType] || row.uniType || "—"
                    )
                  ),
                  React.createElement("td", { className: "cc" }, row.code || "—"),
                  React.createElement("td", { className: "dc" }, row.dir || "—"),
                  React.createElement("td", { className: "pc" }, row.program || "—"),
                  React.createElement("td", null, React.createElement(Lv, { level: row.level })),
                  React.createElement(
                    "td",
                    { style: { textAlign: "center", color: "var(--muted)" } },
                    normCourse(row.course) || "—"
                  ),
                  React.createElement("td", null, React.createElement("span", { className: "fb" }, formLabel(row.form))),
                  React.createElement("td", { style: { textAlign: "center" } }, React.createElement(Nb, { n: row.budget, type: "b" })),
                  React.createElement("td", { style: { textAlign: "center" } }, React.createElement(Nb, { n: row.paid, type: "p" })),
                  React.createElement(
                    "td",
                    { onClick: (event) => event.stopPropagation() },
                    uni && React.createElement("button", { className: "open-btn", onClick: openProfile }, "Профиль →")
                  )
                );
              })
        )
      )
    )
  );
}

function DatSec({ uni }) {
  return React.createElement(
    "div",
    null,
    uni.notes &&
      React.createElement(
        "div",
        { className: "snote blue", style: { marginBottom: "14px" } },
        React.createElement("span", { className: "ic" }, "ℹ️"),
        React.createElement("span", null, uni.notes)
      ),
    React.createElement(
      "div",
      { className: "dgrid" },
      React.createElement(
        "div",
        { className: "dblock s" },
        React.createElement("div", { className: "dbt" }, "☀️ Летняя волна (осенний семестр)"),
        React.createElement(
          "div",
          { className: "di" },
          React.createElement("div", { className: "dot" }),
          React.createElement("span", null, uni.summer || "Уточнять на официальном сайте")
        )
      ),
      React.createElement(
        "div",
        { className: "dblock w" },
        React.createElement("div", { className: "dbt" }, "❄️ Зимняя волна (весенний семестр)"),
        React.createElement(
          "div",
          { className: "di" },
          React.createElement("div", { className: "dot" }),
          React.createElement("span", null, uni.winter || "Уточнять на официальном сайте")
        )
      )
    )
  );
}

function ProcSec({ uni }) {
  const proc = normalizeLongText(uni.proc || "");
  const docs = normalizeLongText(uni.docs || "");
  const special = normalizeLongText(uni.special || "");
  const hasSpecial = special && special !== "nan" && special.length > 3;
  if (!proc || proc === "nan" || proc.length < 10) {
    return React.createElement(
      "div",
      { className: "proc-shell" },
      React.createElement(
        "div",
        { className: "snote" },
        React.createElement("span", { className: "ic" }, "⚠️"),
        "Подробная процедура перевода не найдена в открытых источниках. Обратитесь напрямую в вуз."
      ),
      hasSpecial &&
        React.createElement(
          "div",
          { className: "spec-box" },
          React.createElement("strong", null, "⚡ ОСОБЕННОСТИ ПЕРЕВОДА: "),
          special
        )
    );
  }

  const procItems = splitStructuredItems(proc);
  const docsItems = splitStructuredItems(docs);

  return React.createElement(
    "div",
    { className: "proc-shell" },
    procItems.length >= 2
      ? React.createElement(
          "ol",
          { className: "proc-list" },
          ...procItems.map((item, index) =>
            React.createElement(
              "li",
              { key: `proc-${index}`, className: "proc-item" },
              React.createElement("div", { className: "proc-step" }, index + 1),
              React.createElement("div", { className: "proc-body" }, renderTextWithLinks(item, `proc-${index}`))
            )
          )
        )
      : React.createElement("div", { className: "proc-text proc-text-card" }, renderTextWithLinks(proc, "proc-fallback")),
    docs &&
      docs !== "nan" &&
      docs.length > 5 &&
      React.createElement(
        "div",
        { className: "docs-box" },
        React.createElement("div", { className: "docs-label" }, "📄 НЕОБХОДИМЫЕ ДОКУМЕНТЫ"),
        docsItems.length >= 2
          ? React.createElement(
              "ul",
              { className: "docs-list" },
              ...docsItems.map((item, index) =>
                React.createElement(
                  "li",
                  { key: `doc-${index}`, className: "docs-item" },
                  React.createElement("span", { className: "docs-num" }, index + 1),
                  React.createElement("span", null, renderTextWithLinks(item, `doc-${index}`))
                )
              )
            )
          : React.createElement("div", { className: "docs-text" }, renderTextWithLinks(docs, "doc-fallback"))
      ),
    hasSpecial &&
      React.createElement(
        "div",
        { className: "spec-box" },
        React.createElement("strong", null, "⚡ ОСОБЕННОСТИ ПЕРЕВОДА: "),
        special
      )
  );
}

function DormSec({ uni }) {
  const hasDorm = Boolean(uni.dorm);
  return React.createElement(
    "div",
    { className: "dorm-card" },
    React.createElement(
      "div",
      { className: "dorm-row" },
      React.createElement("div", { className: "dorm-icon" }, hasDorm ? "🏠" : "🚫"),
      React.createElement(
        "div",
        null,
        React.createElement(
          "div",
          { className: `dorm-yn ${hasDorm ? "yes" : "no"}` },
          hasDorm ? "✓ Общежитие имеется" : "✗ Собственного общежития нет"
        ),
        uni.dormInfo &&
          uni.dormInfo !== "nan" &&
          React.createElement("div", { className: "dorm-detail", style: { marginTop: "5px" } }, uni.dormInfo)
      )
    )
  );
}

function Profile({ uni, highlightRowKey = "" }) {
  const tc = typeCls(uni.type);
  const hasRows = toNumber(uni.vacancyRowCount) > 0;
  return React.createElement(
    "div",
    { className: "pw" },
    React.createElement(
      "div",
      { className: "ph" },
      React.createElement("div", { className: "ph-abbr" }, uni.abbr),
      React.createElement(
        "div",
        { className: "ph-info" },
        React.createElement("div", { className: "ph-num" }, `ВУЗ №${uni.id} / ${UNIS.length} ВУЗОВ В БАЗЕ`),
        React.createElement("div", { className: "ph-name" }, uni.name),
        React.createElement(
          "div",
          { className: "tags" },
          React.createElement("span", { className: `tag ${tc}` }, TLABELS[uni.type] || uni.type || "Вуз"),
          hasRows &&
            React.createElement("span", { className: "rbadge" }, `✅ ${toNumber(uni.vacancyRowCount)} строк`),
          React.createElement("span", { className: `dorm-dot ${uni.dorm ? "yes" : "no"}` }),
          React.createElement(
            "span",
            { style: { fontSize: "11px", color: uni.dorm ? "var(--teal)" : "var(--red)" } },
            uni.dorm ? "Есть общежитие" : "Без общежития"
          )
        ),
        React.createElement(
          "div",
          { style: { marginTop: "10px", display: "flex", gap: "8px", flexWrap: "wrap" } },
          uni.src &&
            React.createElement(
              "a",
              { className: "sl", href: uni.src, target: "_blank" },
              "🔗 Официальный источник"
            )
        )
      )
    ),
    React.createElement(
      Sec,
      { title: "ВАКАНТНЫЕ МЕСТА", icon: "📋", open0: true },
      React.createElement(VacSec, { uni, highlightRowKey })
    ),
    React.createElement(
      Sec,
      { title: "СРОКИ ПОДАЧИ ЗАЯВЛЕНИЙ", icon: "📅", open0: true },
      React.createElement(DatSec, { uni })
    ),
    React.createElement(
      Sec,
      { title: "ПРОЦЕДУРА ПЕРЕВОДА И ДОКУМЕНТЫ", icon: "📌", open0: false },
      React.createElement(ProcSec, { uni })
    ),
    React.createElement(
      Sec,
      { title: "ОБЩЕЖИТИЕ", icon: "🏠", open0: false },
      React.createElement(DormSec, { uni })
    )
  );
}

function MainTable({ onSel }) {
  const [q, setQ] = useState("");
  const [tf, setTF] = useState("all");
  const [df, setDF] = useState(false);

  const filtered = useMemo(
    () =>
      UNIS.filter((uni) => {
        if (tf !== "all" && uni.type !== tf) return false;
        if (df && !uni.dorm) return false;
        const query = q.toLowerCase();
        if (!query) return true;
        return (
          String(uni.abbr || "").toLowerCase().includes(query) ||
          String(uni.name || "").toLowerCase().includes(query)
        );
      }),
    [q, tf, df]
  );

  const totalUnis = toNumber(STATS.totalUniversities) || UNIS.length;
  const loadedUnis =
    toNumber(STATS.loadedUniversities) ||
    UNIS.filter((uni) => uni.vacancyStatus === "ok" && toNumber(uni.vacancyRowCount) > 0).length;
  const totalRows =
    toNumber(STATS.totalVacancyRows) ||
    UNIS.reduce((sum, uni) => sum + toNumber(uni.vacancyRowCount), 0);

  return React.createElement(
    "div",
    null,
    React.createElement(
      "div",
      { className: "hero" },
      React.createElement("div", { className: "hero-tag" }, "Санкт-Петербург 2025–2026"),
      React.createElement(
        "h1",
        null,
        "Вакантные места для ",
        React.createElement("em", null, "перевода"),
        React.createElement("br"),
        "в вузы Санкт-Петербурга"
      ),
      React.createElement(
        "p",
        null,
        "Данные по вакантным местам, срокам, процедурам и общежитиям собраны из актуальных источников. Нажмите на строку, чтобы открыть профиль вуза."
      ),
      React.createElement(
        "div",
        { className: "stats-row" },
        React.createElement(
          "div",
          { className: "stat-card" },
          React.createElement("span", { className: "num" }, totalUnis),
          React.createElement("span", { className: "lbl" }, "Вузов в базе")
        ),
        React.createElement(
          "div",
          { className: "stat-card" },
          React.createElement("span", { className: "num" }, loadedUnis),
          React.createElement("span", { className: "lbl" }, "Вузов с загруженной таблицей")
        ),
        React.createElement(
          "div",
          { className: "stat-card" },
          React.createElement("span", { className: "num" }, totalRows),
          React.createElement("span", { className: "lbl" }, "Строк вакантных мест")
        ),
        React.createElement(
          "div",
          { className: "stat-card" },
          React.createElement("span", { className: "num" }, UNIS.filter((uni) => uni.dorm).length),
          React.createElement("span", { className: "lbl" }, "С общежитием")
        )
      )
    ),
    React.createElement(
      "div",
      { className: "ctrls" },
      React.createElement(
        "div",
        { className: "sw" },
        React.createElement(
          "svg",
          {
            xmlns: "http://www.w3.org/2000/svg",
            width: 14,
            height: 14,
            viewBox: "0 0 24 24",
            fill: "none",
            stroke: "currentColor",
            strokeWidth: 2,
          },
          React.createElement("circle", { cx: 11, cy: 11, r: 8 }),
          React.createElement("path", { d: "m21 21-4.35-4.35" })
        ),
        React.createElement("input", {
          className: "si",
          placeholder: "Поиск по названию...",
          value: q,
          onChange: (event) => setQ(event.target.value),
        })
      ),
      [
        ["all", "Все"],
        ["federal", "Федеральные"],
        ["art", "Творческие"],
        ["private", "Частные"],
        ["regional", "Региональные"],
      ].map(([value, label]) =>
        React.createElement(
          "button",
          { key: value, className: `chip ${tf === value ? "on" : ""}`, onClick: () => setTF(value) },
          label
        )
      ),
      React.createElement(
        "button",
        { className: `chip ${df ? "on" : ""}`, onClick: () => setDF(!df) },
        "🏠 С общежитием"
      )
    ),
    React.createElement(
      "div",
      { className: "tw" },
      React.createElement(
        "table",
        null,
        React.createElement(
          "thead",
          null,
          React.createElement(
            "tr",
            null,
            React.createElement("th", null, "№"),
            React.createElement("th", null, "Вуз"),
            React.createElement("th", null, "Тип"),
            React.createElement("th", null, "☀ Летняя / ❄ Зимняя"),
            React.createElement("th", null, "Общежитие"),
            React.createElement("th", null, "Источник"),
            React.createElement("th", null, "")
          )
        ),
        React.createElement(
          "tbody",
          null,
          filtered.length === 0
            ? React.createElement(
                "tr",
                null,
                React.createElement(
                  "td",
                  { colSpan: 7 },
                  React.createElement(
                    "div",
                    { className: "empty" },
                    React.createElement("div", { className: "big" }, "🔍"),
                    React.createElement("p", null, "Ничего не найдено.")
                  )
                )
              )
            : filtered.map((uni) =>
                React.createElement(
                  "tr",
                  { key: uni.id, onClick: () => onSel(uni) },
                  React.createElement("td", { className: "td-n" }, uni.id),
                  React.createElement(
                    "td",
                    null,
                    React.createElement(
                      "div",
                      { className: "td-abbr" },
                      uni.abbr || uni.name,
                      toNumber(uni.vacancyRowCount) > 0 &&
                        React.createElement(
                          "span",
                          {
                            style: {
                              fontSize: "9px",
                              background: "rgba(58,212,176,.1)",
                              border: "1px solid rgba(58,212,176,.3)",
                              color: "var(--teal)",
                              borderRadius: "3px",
                              padding: "1px 5px",
                              fontFamily: "'Unbounded',sans-serif",
                            },
                          },
                          "DATA"
                        )
                    ),
                    React.createElement(
                      "div",
                      { style: { fontSize: "12px", color: "var(--muted)", marginTop: "2px" } },
                      uni.name
                    )
                  ),
                  React.createElement(
                    "td",
                    null,
                    React.createElement("span", { className: `tag ${typeCls(uni.type)}` }, TLABELS[uni.type] || uni.type)
                  ),
                  React.createElement(
                    "td",
                    null,
                    React.createElement(
                      "div",
                      { style: { display: "flex", flexDirection: "column", gap: "3px" } },
                      React.createElement("span", { className: "dbg s" }, `☀ ${shortText(uni.summer || "Уточнять", 40)}`),
                      React.createElement("span", { className: "dbg w" }, `❄ ${shortText(uni.winter || "Уточнять", 40)}`)
                    )
                  ),
                  React.createElement(
                    "td",
                    null,
                    React.createElement("span", { className: `dorm-dot ${uni.dorm ? "yes" : "no"}` }),
                    React.createElement(
                      "span",
                      { style: { fontSize: "11px", color: uni.dorm ? "var(--teal)" : "var(--muted)" } },
                      uni.dorm ? "Есть" : "Нет"
                    ),
                    uni.dormInfo &&
                      uni.dormInfo !== "nan" &&
                      React.createElement(
                        "div",
                        { style: { fontSize: "10px", color: "var(--muted)", marginTop: "2px" } },
                        shortText(uni.dormInfo, 35)
                      )
                  ),
                  React.createElement(
                    "td",
                    { className: "td-src", onClick: (event) => event.stopPropagation() },
                    uni.src
                      ? React.createElement(
                          "a",
                          { href: uni.src, target: "_blank" },
                          `${uni.src.replace("https://", "").replace("http://", "").slice(0, 30)}…`
                        )
                      : "—"
                  ),
                  React.createElement(
                    "td",
                    null,
                    React.createElement("button", { className: "open-btn" }, "Открыть →")
                  )
                )
              )
        )
      )
    ),
    React.createElement(
      Sec,
      { title: "ГЛОБАЛЬНЫЙ ПОИСК ПО ВСЕМ ВАКАНТНЫМ МЕСТАМ", icon: "🌐", open0: false },
      React.createElement(GlobalVacancySec, { onSel })
    )
  );
}

function findUniById(uniId) {
  const target = String(uniId || "").trim();
  if (!target) return null;
  return UNIS.find((uni) => String(uni.id) === target) || null;
}

function buildUrlForUni(uniId) {
  const url = new URL(window.location.href);
  const target = String(uniId || "").trim();
  if (target) url.searchParams.set("uni", target);
  else url.searchParams.delete("uni");
  return `${url.pathname}${url.search}${url.hash}`;
}

function readNavState() {
  const state = window.history && typeof window.history.state === "object" ? window.history.state : {};
  const url = new URL(window.location.href);
  const uniId = String((state && state.uniId) || url.searchParams.get("uni") || "").trim();
  const rowKey = String((state && state.rowKey) || "");
  return { uniId, rowKey };
}

function App() {
  const initialNav = readNavState();
  const [selectedUni, setSelectedUni] = useState(() => findUniById(initialNav.uniId));
  const [selectedHighlightKey, setSelectedHighlightKey] = useState(() => initialNav.rowKey);
  const generatedAt = DATA.generatedAt ? new Date(DATA.generatedAt).toLocaleString("ru-RU") : "";

  useEffect(() => {
    const nav = readNavState();
    window.history.replaceState({ uniId: nav.uniId, rowKey: nav.rowKey }, "", buildUrlForUni(nav.uniId));

    const onPopState = () => {
      const current = readNavState();
      setSelectedUni(findUniById(current.uniId));
      setSelectedHighlightKey(current.rowKey);
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function selectUni(uni, context) {
    const rowKey = context && context.rowKey ? String(context.rowKey) : "";
    setSelectedUni(uni);
    setSelectedHighlightKey(rowKey);
    window.history.pushState(
      { uniId: String(uni.id), rowKey },
      "",
      buildUrlForUni(uni.id)
    );
  }

  function resetSelection() {
    setSelectedUni(null);
    setSelectedHighlightKey("");
    window.history.pushState({ uniId: "", rowKey: "" }, "", buildUrlForUni(""));
  }

  return React.createElement(
    "div",
    null,
    React.createElement(
      "header",
      { className: "hdr" },
      React.createElement(
        "div",
        { className: "logo", onClick: resetSelection },
        "ВАК",
        React.createElement("span", null, "СПб")
      ),
      React.createElement("div", { className: "hdr-sub" }, "Портал вакантных мест для перевода"),
      selectedUni &&
        React.createElement(
          "button",
          { className: "back-btn", onClick: resetSelection },
          "← К списку вузов"
        )
    ),
    selectedUni
      ? React.createElement(Profile, { uni: selectedUni, highlightRowKey: selectedHighlightKey })
      : React.createElement(MainTable, { onSel: selectUni }),
    React.createElement(
      "footer",
      { className: "footer" },
      generatedAt
        ? `Данные собраны из открытых источников. Обновлено: ${generatedAt}. Проверяйте актуальность на официальных сайтах вузов.`
        : "Данные собраны из открытых источников. Проверяйте актуальность на официальных сайтах вузов."
    )
  );
}

ReactDOM.render(React.createElement(App), document.getElementById("root"));
