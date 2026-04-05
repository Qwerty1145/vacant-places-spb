const { useState, useMemo } = React;

const DATA = window.PORTAL_DATA || {};
const UNIS = Array.isArray(DATA.unis) ? DATA.unis : [];
const VACANCIES_BY_ID = DATA.vacanciesById && typeof DATA.vacanciesById === "object"
  ? DATA.vacanciesById
  : {};

const TLABELS = {
  federal: "Федеральный",
  private: "Частный/коммерческий",
  art: "Творческий",
  regional: "Региональный/филиал",
};

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

function getVacancyRowRef(row, rowIndex) {
  const direct = String((row && row.rowRef) || "").trim();
  if (direct) return direct;
  return `row-${rowIndex}`;
}

function getVacanciesForUni(uni) {
  const key = String(uni.id);
  const rows = VACANCIES_BY_ID[key];
  return Array.isArray(rows) ? rows : [];
}

function GlobalSearch() {
  const allRows = useMemo(() => {
    const rows = [];
    for (const uni of UNIS) {
      const uniRows = getVacanciesForUni(uni);
      for (let rowIndex = 0; rowIndex < uniRows.length; rowIndex += 1) {
        const row = uniRows[rowIndex];
        rows.push({
          uniId: String(uni.id),
          uniName: uni.name || uni.abbr || "",
          uniAbbr: uni.abbr || uni.name || "",
          uniType: uni.type || "",
          uniDorm: Boolean(uni.dorm),
          rowRef: getVacancyRowRef(row, rowIndex),
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

  function buildProfileUrl(uniId, rowRef) {
    const params = new URLSearchParams();
    params.set("uni", String(uniId || "").trim());
    if (rowRef) params.set("row", String(rowRef));
    return `./index.html?${params.toString()}`;
  }

  function openProfile(uniId, rowRef) {
    const url = buildProfileUrl(uniId, rowRef);
    window.open(url, "_blank");
  }

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
          autoFocus: true,
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
                const handleClick = () => uni && openProfile(uni.id, row.rowRef);
                return React.createElement(
                  "tr",
                  {
                    key: `${row.uniId}-${row.rowRef || index}`,
                    onClick: handleClick,
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
                    uni &&
                      React.createElement(
                        "a",
                        { className: "open-btn", href: buildProfileUrl(uni.id, row.rowRef), target: "_blank" },
                        "Профиль →"
                      )
                  )
                );
              })
        )
      )
    )
  );
}

function SearchApp() {
  const generatedAt = DATA.generatedAt ? new Date(DATA.generatedAt).toLocaleString("ru-RU") : "";

  return React.createElement(
    "div",
    null,
    React.createElement(
      "header",
      { className: "hdr" },
      React.createElement(
        "a",
        { className: "logo", href: "./index.html" },
        "ВАК",
        React.createElement("span", null, "СПб")
      ),
      React.createElement("div", { className: "hdr-sub" }, "Глобальный поиск вакантных мест"),
      React.createElement(
        "a",
        { className: "back-btn", href: "./index.html" },
        "← К списку вузов"
      )
    ),
    React.createElement(
      "div",
      { className: "search-hero" },
      React.createElement(
        "h1",
        null,
        "Глобальный ",
        React.createElement("em", null, "поиск"),
        " вакантных мест"
      ),
      React.createElement(
        "p",
        null,
        "Поиск по всем направлениям, программам и вузам Санкт-Петербурга одновременно. Используйте фильтры для уточнения результатов."
      )
    ),
    React.createElement(
      "div",
      { className: "search-wrap" },
      React.createElement(GlobalSearch)
    ),
    React.createElement(
      "footer",
      { className: "footer" },
      generatedAt
        ? `Данные собраны из открытых источников. Обновлено: ${generatedAt}. Проверяйте актуальность на официальных сайтах вузов.`
        : "Данные собраны из открытых источников. Проверяйте актуальность на официальных сайтах вузов."
    )
  );
}

ReactDOM.render(React.createElement(SearchApp), document.getElementById("root"));
