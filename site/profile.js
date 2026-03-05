const DATA_URL = "./data/universities.json";

const universityNameEl = document.getElementById("universityName");
const statusBadgeEl = document.getElementById("statusBadge");
const mainSourceEl = document.getElementById("mainSource");

const vacancyHeadEl = document.getElementById("vacancyHead");
const vacancyBodyEl = document.getElementById("vacancyBody");
const vacancyMetaEl = document.getElementById("vacancyMeta");
const vacancyMessageEl = document.getElementById("vacancyMessage");

const wavesTextEl = document.getElementById("wavesText");
const conditionsTextEl = document.getElementById("conditionsText");
const notesTextEl = document.getElementById("notesText");
const contactsTextEl = document.getElementById("contactsText");

const winterDatesEl = document.getElementById("winterDates");
const summerDatesEl = document.getElementById("summerDates");
const otherDatesEl = document.getElementById("otherDates");

const dormitoryStatusEl = document.getElementById("dormitoryStatus");
const dormitorySkeletonEl = document.getElementById("dormitorySkeleton");

const vacancySearchEl = document.getElementById("vacancySearch");
const courseFilterEl = document.getElementById("courseFilter");
const directionFilterEl = document.getElementById("directionFilter");
const levelFilterEl = document.getElementById("levelFilter");
const budgetOnlyEl = document.getElementById("budgetOnly");

let currentUniversity = null;

function statusClass(status) {
  if (status === "ok") return "status-ok";
  if (status === "partial") return "status-partial";
  return "status-error";
}

function statusTitle(status) {
  if (status === "ok") return "Таблица найдена";
  if (status === "partial") return "Частично";
  return "Ошибка";
}

function safeText(value, fallback = "Нет данных") {
  const text = String(value || "").trim();
  return text ? text : fallback;
}

function setBadge(element, text, className) {
  element.innerHTML = "";
  const span = document.createElement("span");
  span.className = `pill ${className}`;
  span.textContent = text;
  element.appendChild(span);
}

function renderList(listElement, values) {
  listElement.innerHTML = "";
  if (!values || values.length === 0) {
    const li = document.createElement("li");
    li.textContent = "Нет данных";
    listElement.appendChild(li);
    return;
  }
  for (const value of values) {
    const li = document.createElement("li");
    li.textContent = value;
    listElement.appendChild(li);
  }
}

function maxNumberInRow(row) {
  let max = 0;
  for (const cell of row) {
    const matches = String(cell).match(/\d+/g) || [];
    for (const match of matches) {
      const value = Number(match);
      if (Number.isFinite(value) && value > max) {
        max = value;
      }
    }
  }
  return max;
}

function getActiveTable() {
  if (!currentUniversity) return { columns: [], rows: [], standardized: false };
  const vacancies = currentUniversity.vacancies || {};
  const standardizedRows = vacancies.standardized_rows || [];
  const standardizedCols = vacancies.standardized_columns || [];
  const useStandardized = standardizedRows.length > 0 && standardizedCols.length > 0;
  return {
    columns: useStandardized ? standardizedCols : vacancies.columns || [],
    rows: useStandardized ? standardizedRows : vacancies.rows || [],
    standardized: useStandardized,
    source: vacancies.source_url || currentUniversity.official_vacancies_link || "",
    status: vacancies.status || "error",
    truncated: Boolean(vacancies.truncated),
    message: vacancies.message || "",
  };
}

const LEVEL_ORDER = ["spo", "bak", "spec", "mag", "asp", "ord", "dpo", "higher"];

function cleanCell(value) {
  return String(value || "").trim();
}

function parseDormitoryMarker(value) {
  const lowered = cleanCell(value).toLowerCase();
  if (!lowered) return null;
  if (["+", "++", "да", "есть", "yes"].includes(lowered)) return true;
  if (["-", "нет", "no"].includes(lowered)) return false;
  return null;
}

function resolveDormitoryFlag(university) {
  const directFlag = university?.dormitory?.has_dormitory;
  if (typeof directFlag === "boolean") return directFlag;
  return parseDormitoryMarker(university?.marker);
}

function normalizeHeaderText(value) {
  return cleanCell(value).toLowerCase().replace(/\s+/g, " ");
}

function normalizeCourseValue(value) {
  const text = cleanCell(value);
  if (!text) return "";
  const lowered = text.toLowerCase();
  if (lowered.includes("все") && lowered.includes("курс")) return "";
  const match = text.match(/\d+/);
  return match ? match[0] : text;
}

function parseCellNumber(value) {
  const text = cleanCell(value).toLowerCase();
  if (!text || ["-", "—", "нет", "нет данных"].includes(text)) return 0;
  const matches = text.match(/\d+/g) || [];
  if (!matches.length) return 0;
  const numbers = matches.map((item) => Number(item)).filter((item) => Number.isFinite(item));
  if (!numbers.length) return 0;
  if (numbers.length > 1 && new Set(numbers).size === 1) return numbers[0];
  return numbers.reduce((sum, item) => sum + item, 0);
}

function detectEducationLevelKey(value) {
  const lowered = normalizeHeaderText(value);
  if (!lowered) return "";
  if (
    lowered.includes("средн") &&
    (lowered.includes("проф") || lowered.includes("звена"))
  ) {
    return "spo";
  }
  if (lowered.includes("спо")) return "spo";
  if (lowered.includes("дополнитель")) return "dpo";
  if (lowered.includes("аспиран")) return "asp";
  if (lowered.includes("ординат")) return "ord";
  if (lowered.includes("магистр")) return "mag";
  if (lowered.includes("бакалав")) return "bak";
  if (lowered.includes("специал")) return "spec";
  if (lowered.includes("высш")) return "higher";
  return "";
}

function educationLevelTitle(value) {
  if (value === "spo") return "СПО";
  if (value === "bak") return "Бакалавриат";
  if (value === "spec") return "Специалитет";
  if (value === "mag") return "Магистратура";
  if (value === "asp") return "Аспирантура";
  if (value === "ord") return "Ординатура";
  if (value === "dpo") return "Доп. образование";
  if (value === "higher") return "Высшее (не уточнено)";
  return value;
}

function bestHeaderIndex(headers, scorer) {
  let bestIndex = null;
  let bestScore = 0;
  for (let index = 0; index < headers.length; index += 1) {
    const score = scorer(headers[index]);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }
  return bestScore > 0 ? bestIndex : null;
}

function detectRawFilterIndices(columns) {
  const headers = columns.map((column) => normalizeHeaderText(column));
  const courseIndex = bestHeaderIndex(headers, (header) => (header.includes("курс") ? 3 : 0));
  const directionIndex = bestHeaderIndex(
    headers,
    (header) =>
      (header.includes("наимен") &&
      (header.includes("направлен") || header.includes("специальн") || header.includes("професс"))
        ? 3
        : 0) +
      ((header.includes("направлен") || header.includes("специальн")) &&
      !header.includes("программ")
        ? 2
        : 0) +
      (["направление", "специальность", "направление подготовки"].includes(header) ? 1 : 0) -
      (header.includes("образовательная программа") ||
      header.includes("профил") ||
      header.includes("специализац")
        ? 2
        : 0)
  );
  const levelIndex = bestHeaderIndex(
    headers,
    (header) => (header.includes("уровень") && header.includes("образован") ? 4 : 0)
  );
  const budgetIndices = [];
  for (let index = 0; index < headers.length; index += 1) {
    const header = headers[index];
    const isBudget = header.includes("бюджет") || header.includes("ассигн");
    const isPaid =
      header.includes("платн") ||
      header.includes("договор") ||
      header.includes("средств физ") ||
      header.includes("средств юрид");
    if (isBudget && !isPaid) budgetIndices.push(index);
  }
  return { courseIndex, directionIndex, levelIndex, budgetIndices };
}

function buildFilterMeta(columns, standardized) {
  if (standardized) {
    return {
      standardized: true,
      courseIndex: 4,
      directionIndex: 1,
      levelIndex: 3,
      budgetIndices: [6],
    };
  }
  return { standardized: false, ...detectRawFilterIndices(columns) };
}

function setSelectOptions(selectElement, values, previousValue, titleResolver = null) {
  if (!selectElement) return;
  selectElement.innerHTML = '<option value="">Все</option>';
  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = titleResolver ? titleResolver(value) : value;
    selectElement.appendChild(option);
  }
  if (values.includes(previousValue)) {
    selectElement.value = previousValue;
  } else {
    selectElement.value = "";
  }
}

function extractRowFilterValues(row, meta) {
  if (meta.standardized) {
    return {
      course: normalizeCourseValue(row[meta.courseIndex]),
      direction: cleanCell(row[meta.directionIndex]),
      levelKey: detectEducationLevelKey(row[meta.levelIndex]),
      budgetValue: Number(row[meta.budgetIndices[0]]) || 0,
      searchText: [row[0], row[1], row[2], row[3], row[5]].filter(Boolean).join(" ").toLowerCase(),
    };
  }

  const course =
    meta.courseIndex !== null && meta.courseIndex < row.length
      ? normalizeCourseValue(row[meta.courseIndex])
      : "";
  const direction =
    meta.directionIndex !== null && meta.directionIndex < row.length
      ? cleanCell(row[meta.directionIndex])
      : "";
  const levelKey =
    meta.levelIndex !== null && meta.levelIndex < row.length
      ? detectEducationLevelKey(row[meta.levelIndex])
      : "";
  const budgetValue =
    meta.budgetIndices.length > 0
      ? meta.budgetIndices.reduce((sum, index) => sum + parseCellNumber(row[index]), 0)
      : maxNumberInRow(row);

  return {
    course,
    direction,
    levelKey,
    budgetValue,
    searchText: row.join(" ").toLowerCase(),
  };
}

function populateFilters(rows, meta) {
  const previousCourse = courseFilterEl ? courseFilterEl.value : "";
  const previousDirection = directionFilterEl ? directionFilterEl.value : "";
  const previousLevel = levelFilterEl ? levelFilterEl.value : "";

  const courses = new Set();
  const directions = new Set();
  const levels = new Set();

  for (const row of rows) {
    const values = extractRowFilterValues(row, meta);
    if (values.course) courses.add(values.course);
    if (values.direction) directions.add(values.direction);
    if (values.levelKey) levels.add(values.levelKey);
  }

  const sortedCourses = Array.from(courses).sort((left, right) => {
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber - rightNumber;
    return left.localeCompare(right, "ru");
  });
  const sortedDirections = Array.from(directions).sort((left, right) => left.localeCompare(right, "ru"));
  const sortedLevels = Array.from(levels).sort((left, right) => {
    const leftIndex = LEVEL_ORDER.indexOf(left);
    const rightIndex = LEVEL_ORDER.indexOf(right);
    if (leftIndex >= 0 && rightIndex >= 0) return leftIndex - rightIndex;
    if (leftIndex >= 0) return -1;
    if (rightIndex >= 0) return 1;
    return left.localeCompare(right, "ru");
  });

  setSelectOptions(courseFilterEl, sortedCourses, previousCourse);
  setSelectOptions(directionFilterEl, sortedDirections, previousDirection);
  setSelectOptions(levelFilterEl, sortedLevels, previousLevel, educationLevelTitle);
}

function rowMatchesFilters(row, meta) {
  const searchQuery = vacancySearchEl.value.trim().toLowerCase();
  const selectedCourse = courseFilterEl ? courseFilterEl.value : "";
  const selectedDirection = directionFilterEl ? directionFilterEl.value : "";
  const selectedLevel = levelFilterEl ? levelFilterEl.value : "";
  const budgetOnly = budgetOnlyEl ? budgetOnlyEl.checked : false;
  const values = extractRowFilterValues(row, meta);

  if (searchQuery && !values.searchText.includes(searchQuery)) return false;
  if (selectedCourse && values.course !== selectedCourse) return false;
  if (selectedDirection && values.direction !== selectedDirection) return false;
  if (selectedLevel && values.levelKey !== selectedLevel) return false;
  if (budgetOnly && values.budgetValue <= 0) return false;

  return true;
}

function renderVacancyTable() {
  vacancyHeadEl.innerHTML = "";
  vacancyBodyEl.innerHTML = "";
  vacancyMessageEl.textContent = "";

  if (!currentUniversity) return;

  const { columns, rows, standardized, source, status, truncated, message } = getActiveTable();

  if (status !== "ok" || !columns.length || !rows.length) {
    vacancyMetaEl.textContent = `Статус: ${statusTitle(status || "error")}`;
    vacancyMessageEl.textContent = safeText(
      message,
      "Таблица вакантных мест пока не извлечена автоматически."
    );
    return;
  }

  const filterMeta = buildFilterMeta(columns, standardized);
  populateFilters(rows, filterMeta);

  const theadRow = document.createElement("tr");
  for (const column of columns) {
    const th = document.createElement("th");
    th.textContent = column;
    theadRow.appendChild(th);
  }
  vacancyHeadEl.appendChild(theadRow);

  const filteredRows = rows.filter((row) => rowMatchesFilters(row, filterMeta));

  for (const row of filteredRows) {
    const tr = document.createElement("tr");
    for (const cell of row) {
      const td = document.createElement("td");
      td.textContent = cell;
      tr.appendChild(td);
    }
    vacancyBodyEl.appendChild(tr);
  }

  vacancyMetaEl.textContent = `Строк после фильтра: ${filteredRows.length} из ${rows.length}. Источник: ${source}${
    standardized ? " · Стандартизировано" : ""
  }`;
  if (!filteredRows.length) {
    vacancyMessageEl.textContent = "По текущим фильтрам строки не найдены.";
  }
  if (truncated) {
    vacancyMessageEl.textContent = `${vacancyMessageEl.textContent} Показана усечённая выборка.`;
  }
}

function renderUniversity(university) {
  currentUniversity = university;
  universityNameEl.textContent = university.university;

  setBadge(
    statusBadgeEl,
    `Извлечение: ${statusTitle(university.vacancies.status)}`,
    statusClass(university.vacancies.status)
  );

  mainSourceEl.innerHTML = "";
  const sourceText = document.createElement("span");
  sourceText.textContent = "Официальный источник: ";
  mainSourceEl.appendChild(sourceText);
  if (university.official_vacancies_link) {
    const sourceLink = document.createElement("a");
    sourceLink.href = university.official_vacancies_link;
    sourceLink.target = "_blank";
    sourceLink.rel = "noopener noreferrer";
    sourceLink.textContent = university.official_vacancies_link;
    mainSourceEl.appendChild(sourceLink);
  } else {
    const noSource = document.createElement("span");
    noSource.textContent = "не указан";
    mainSourceEl.appendChild(noSource);
  }

  wavesTextEl.textContent = safeText(university.transfer_waves_description);
  conditionsTextEl.textContent = safeText(university.transfer_conditions);
  notesTextEl.textContent = safeText(university.notes);
  contactsTextEl.textContent = safeText(university.contacts);

  const seasonData = university.application_start_dates_by_season || {};
  renderList(winterDatesEl, seasonData.winter || []);
  renderList(summerDatesEl, seasonData.summer || []);
  renderList(otherDatesEl, seasonData.other || []);

  const hasDormitory = resolveDormitoryFlag(university);
  if (hasDormitory === true) {
    setBadge(dormitoryStatusEl, "Общежитие: есть", "status-ok");
  } else if (hasDormitory === false) {
    setBadge(dormitoryStatusEl, "Общежитие: нет", "status-error");
  } else {
    setBadge(dormitoryStatusEl, "Общежитие: уточняется", "status-partial");
  }

  const dormitoryDetails = cleanCell(university?.dormitory?.details);
  const dormitoryPlaceholder = cleanCell(university?.dormitory?.placeholder);
  if (dormitoryDetails) {
    dormitorySkeletonEl.textContent = dormitoryDetails;
  } else if (dormitoryPlaceholder) {
    dormitorySkeletonEl.textContent = dormitoryPlaceholder;
  } else {
    dormitorySkeletonEl.textContent = "Секция подготовлена, данные будут добавлены позже.";
  }

  renderVacancyTable();
}

async function init() {
  const id = new URLSearchParams(window.location.search).get("id");
  if (!id) throw new Error("Не передан идентификатор профиля");

  const response = await fetch(`${DATA_URL}?v=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Не удалось загрузить ${DATA_URL}`);
  const payload = await response.json();

  const university = (payload.universities || []).find((item) => item.id === id);
  if (!university) throw new Error("Профиль вуза не найден");

  renderUniversity(university);
}

for (const element of [vacancySearchEl, courseFilterEl, directionFilterEl, levelFilterEl, budgetOnlyEl]) {
  if (!element) continue;
  element.addEventListener("input", renderVacancyTable);
  element.addEventListener("change", renderVacancyTable);
}

init().catch((error) => {
  universityNameEl.textContent = "Ошибка загрузки профиля";
  vacancyMessageEl.textContent = error.message;
});
