const DATA_URL = "./data/universities.json";

const tableBody = document.getElementById("tableBody");
const searchInput = document.getElementById("searchInput");
const statusSelect = document.getElementById("statusSelect");
const generatedAtEl = document.getElementById("generatedAt");
const statsLineEl = document.getElementById("statsLine");

let universities = [];

function statusTitle(status) {
  if (status === "ok") return "Таблица найдена";
  if (status === "partial") return "Частично";
  return "Ошибка";
}

function statusClass(status) {
  if (status === "ok") return "status-ok";
  if (status === "partial") return "status-partial";
  return "status-error";
}

function shortSource(url) {
  if (!url) return "Нет ссылки";
  try {
    const parsed = new URL(url);
    return parsed.host;
  } catch {
    return url.slice(0, 50);
  }
}

function setMeta(payload) {
  const generatedDate = new Date(payload.generated_at);
  generatedAtEl.textContent = `Обновлено: ${generatedDate.toLocaleString("ru-RU")}`;
  statsLineEl.textContent = `Вузов: ${payload.total_universities} | Таблицы найдены: ${payload.stats.vacancies_ok} | Частично: ${payload.stats.vacancies_partial} | Ошибки: ${payload.stats.vacancies_error}`;
}

function createCell(text) {
  const td = document.createElement("td");
  td.textContent = text;
  return td;
}

function passesFilters(item) {
  const query = searchInput.value.trim().toLowerCase();
  const status = statusSelect.value;

  if (query && !item.university.toLowerCase().includes(query)) return false;
  if (status !== "all" && item.vacancies.status !== status) return false;
  return true;
}

function renderRows() {
  tableBody.innerHTML = "";
  const filtered = universities.filter(passesFilters);

  if (!filtered.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 5;
    td.className = "empty-state";
    td.textContent = "По текущим фильтрам записи не найдены.";
    tr.appendChild(td);
    tableBody.appendChild(tr);
    return;
  }

  for (const item of filtered) {
    const tr = document.createElement("tr");

    tr.appendChild(createCell(item.university));

    const statusTd = document.createElement("td");
    const statusPill = document.createElement("span");
    statusPill.className = `pill ${statusClass(item.vacancies.status)}`;
    const rows = item.vacancies.row_count || 0;
    statusPill.textContent = `${statusTitle(item.vacancies.status)} (${rows})`;
    statusTd.appendChild(statusPill);
    tr.appendChild(statusTd);

    tr.appendChild(createCell(item.application_start_dates_raw || "Нет данных"));

    const sourceTd = document.createElement("td");
    if (item.official_vacancies_link) {
      const sourceLink = document.createElement("a");
      sourceLink.href = item.official_vacancies_link;
      sourceLink.target = "_blank";
      sourceLink.rel = "noopener noreferrer";
      sourceLink.textContent = shortSource(item.official_vacancies_link);
      sourceTd.appendChild(sourceLink);
    } else {
      sourceTd.textContent = "Нет ссылки";
    }
    tr.appendChild(sourceTd);

    const profileTd = document.createElement("td");
    const profileLink = document.createElement("a");
    profileLink.className = "btn-link";
    profileLink.href = `./profile.html?id=${encodeURIComponent(item.id)}`;
    profileLink.textContent = "Открыть профиль";
    profileTd.appendChild(profileLink);
    tr.appendChild(profileTd);

    tableBody.appendChild(tr);
  }
}

async function init() {
  const response = await fetch(`${DATA_URL}?v=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Не удалось загрузить ${DATA_URL}`);
  }
  const payload = await response.json();
  universities = payload.universities || [];
  setMeta(payload);
  renderRows();
}

for (const element of [searchInput, statusSelect]) {
  element.addEventListener("input", renderRows);
  element.addEventListener("change", renderRows);
}

init().catch((error) => {
  tableBody.innerHTML = "";
  const tr = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = 5;
  td.className = "empty-state";
  td.textContent = `Ошибка загрузки данных: ${error.message}`;
  tr.appendChild(td);
  tableBody.appendChild(tr);
});
