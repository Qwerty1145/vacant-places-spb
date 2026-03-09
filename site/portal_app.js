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

/* ===== TIMELINE: date parser + components ===== */
var RU_MONTH_STEMS = [
  ["январ", 0], ["янв", 0], ["феврал", 1], ["фев", 1], ["март", 2], ["мар", 2], ["апрел", 3],
  ["май", 4], ["мая", 4], ["мае", 4], ["июн", 5], ["июл", 6],
  ["август", 7], ["авг", 7], ["сентябр", 8], ["сен", 8], ["октябр", 9], ["окт", 9],
  ["ноябр", 10], ["ноя", 10], ["декабр", 11], ["дек", 11]
];
function ruMonthIdx(s) {
  if (!s) return -1;
  var lc = s.toLowerCase().replace(/ё/g, "е");
  for (var i = 0; i < RU_MONTH_STEMS.length; i++) {
    if (lc.startsWith(RU_MONTH_STEMS[i][0])) return RU_MONTH_STEMS[i][1];
  }
  return -1;
}
var RU_MONTH_RE = "(?:январ\\S*|феврал\\S*|марта?\\S*|апрел\\S*|мая?|июн\\S*|июл\\S*|августа?\\S*|сентябр\\S*|октябр\\S*|ноябр\\S*|декабр\\S*|янв|фев|мар|авг|сен|окт|ноя|дек)";

function parseRuDate(text) {
  if (!text) return null;
  var t = text.replace(/\s+/g, " ").trim();
  var m;
  var YEAR_OPT = "(?:\\s+\\d{4})?";
  // Pattern 1: DD.MM – DD.MM
  m = t.match(/(\d{1,2})\.(\d{2})\s*[–—\-]\s*(\d{1,2})\.(\d{2})/);
  if (m) return { startMonth: +m[2] - 1, startDay: +m[1], endMonth: +m[4] - 1, endDay: +m[3], approx: false, orig: t };
  // Pattern 2: DD month – DD month
  var re2 = new RegExp("(\\d{1,2})\\s+(" + RU_MONTH_RE + ")" + YEAR_OPT + "\\s*[–—\\-]\\s*(\\d{1,2})\\s+(" + RU_MONTH_RE + ")" + YEAR_OPT, "i");
  m = t.match(re2);
  if (m) { var sm = ruMonthIdx(m[2]), em = ruMonthIdx(m[4]); if (sm >= 0 && em >= 0) return { startMonth: sm, startDay: +m[1], endMonth: em, endDay: +m[3], approx: false, orig: t }; }
  // Pattern 3: DD–DD month (range within one month)
  var re3 = new RegExp("(\\d{1,2})\\s*[–—\\-]\\s*(\\d{1,2})\\s+(" + RU_MONTH_RE + ")" + YEAR_OPT, "i");
  m = t.match(re3);
  if (m) { var mo = ruMonthIdx(m[3]); if (mo >= 0) return { startMonth: mo, startDay: +m[1], endMonth: mo, endDay: +m[2], approx: false, orig: t }; }
  // Pattern 4: До DD month / Не позднее DD month
  var re4 = new RegExp("(?:[Дд]о|[Нн]е\\s+позднее)\\s+(\\d{1,2})\\s+(" + RU_MONTH_RE + ")" + YEAR_OPT, "i");
  m = t.match(re4);
  if (m) { var mo4 = ruMonthIdx(m[2]); if (mo4 >= 0) { var sd = +m[1] - 21; if (sd < 1) { var pm = mo4 === 0 ? 11 : mo4 - 1; return { startMonth: pm, startDay: 15, endMonth: mo4, endDay: +m[1], approx: true, orig: t }; } return { startMonth: mo4, startDay: 1, endMonth: mo4, endDay: +m[1], approx: true, orig: t }; } }
  // Pattern 5: 1-я неделя/декада month
  var re5 = new RegExp("1-я\\s+(?:неделя|декада)\\s+(" + RU_MONTH_RE + ")", "i");
  m = t.match(re5);
  if (m) { var mo5 = ruMonthIdx(m[1]); if (mo5 >= 0) return { startMonth: mo5, startDay: 1, endMonth: mo5, endDay: 10, approx: true, orig: t }; }
  // Pattern 6: month–month (range of months)
  var re6 = new RegExp("(" + RU_MONTH_RE + ")\\s*[–—\\-]\\s*(" + RU_MONTH_RE + ")", "i");
  m = t.match(re6);
  if (m) { var sm6 = ruMonthIdx(m[1]), em6 = ruMonthIdx(m[2]); if (sm6 >= 0 && em6 >= 0 && sm6 !== em6) return { startMonth: sm6, startDay: 1, endMonth: em6, endDay: 28, approx: true, orig: t }; }
  // Pattern 7: Standalone month name like "Август (...)" or month in parentheses "(август)"
  var re7 = new RegExp("(?:^|[\\(\\s])(" + RU_MONTH_RE + ")(?=[\\s\\)\\;,.]|$)", "i");
  m = t.match(re7);
  if (m) { var mo7 = ruMonthIdx(m[1]); if (mo7 >= 0) return { startMonth: mo7, startDay: 1, endMonth: mo7, endDay: 28, approx: true, orig: t }; }
  // Pattern 8: "Декабрь и июнь (1–15 числа)" — special dual-month reference, extract first
  var re8 = new RegExp("(" + RU_MONTH_RE + ")\\s+и\\s+(" + RU_MONTH_RE + ")\\s*\\((\\d{1,2})[–—\\-](\\d{1,2})", "i");
  m = t.match(re8);
  if (m) { var m1 = ruMonthIdx(m[1]), m2 = ruMonthIdx(m[2]); if (m1 >= 0 && m2 >= 0) return { startMonth: m2, startDay: +m[3], endMonth: m2, endDay: +m[4], approx: false, orig: t, altMonth: m1, altStartDay: +m[3], altEndDay: +m[4] }; }
  return null;
}

function tlNormalizeParsedForWave(parsed, waveMonths) {
  if (!parsed) return null;
  if (waveMonths.indexOf(parsed.startMonth) >= 0) return parsed;
  if (parsed.altMonth !== undefined && waveMonths.indexOf(parsed.altMonth) >= 0) {
    return {
      startMonth: parsed.altMonth,
      startDay: parsed.altStartDay,
      endMonth: parsed.altMonth,
      endDay: parsed.altEndDay,
      approx: parsed.approx,
      orig: parsed.orig
    };
  }
  return null;
}

function parseRuDateForWave(text, waveMonths) {
  var direct = tlNormalizeParsedForWave(parseRuDate(text), waveMonths);
  if (direct) return direct;

  var source = String(text || "").replace(/\u00a0/g, " ");
  var parts = source
    .split(/\s*;\s*/g)
    .map(function(part) { return part.trim(); })
    .filter(Boolean);

  for (var i = 0; i < parts.length; i++) {
    var parsed = tlNormalizeParsedForWave(parseRuDate(parts[i]), waveMonths);
    if (parsed) return parsed;
  }
  return null;
}

function buildTimelineData(unis) {
  var summer = [], winter = [], vagueSum = [], vagueWin = [];
  var sumMonths = [2, 3, 4, 5, 6, 7, 8, 9];
  var winMonths = [10, 11, 0, 1, 2, 3];
  for (var i = 0; i < unis.length; i++) {
    var u = unis[i];
    var sp = parseRuDateForWave(u.summer, sumMonths);
    if (sp) {
      var vpS = u.vacPubSummer ? parseRuDate(u.vacPubSummer) : null;
      summer.push({ uni: u, parsed: sp, vacPub: vpS });
    } else { vagueSum.push(u); }
    var wp = parseRuDateForWave(u.winter, winMonths);
    if (wp) {
      var vpW = u.vacPubWinter ? parseRuDate(u.vacPubWinter) : null;
      winter.push({ uni: u, parsed: wp, vacPub: vpW });
    } else { vagueWin.push(u); }
  }
  function sortKey(e, months) {
    var idx = months.indexOf(e.parsed.startMonth);
    if (idx < 0) idx = 99;
    return idx * 31 + (e.parsed.startDay || 1);
  }
  summer.sort(function(a, b) { return sortKey(a, sumMonths) - sortKey(b, sumMonths); });
  winter.sort(function(a, b) { return sortKey(a, winMonths) - sortKey(b, winMonths); });
  return { summer: summer, winter: winter, vagueSum: vagueSum, vagueWin: vagueWin };
}

function tlDatePos(month, day, waveMonths, trackW) {
  var idx = waveMonths.indexOf(month);
  if (idx < 0) return null;
  var mw = trackW / waveMonths.length;
  var frac = ((day || 1) - 1) / 30;
  return idx * mw + frac * mw;
}

function tlIsCurrent(entry, today) {
  var tm = today.getMonth(), td = today.getDate();
  var sm = entry.parsed.startMonth, sd = entry.parsed.startDay || 1;
  var em = entry.parsed.endMonth, ed = entry.parsed.endDay || 28;
  function lin(m) {
    if (em < sm && m <= em) return m + 12;
    return m;
  }
  var tv = lin(tm) * 31 + td;
  var sv = lin(sm) * 31 + sd;
  var ev = lin(em) * 31 + ed;
  return tv >= sv && tv <= ev;
}

var TL_MONTH_SHORT = ["ЯНВ","ФЕВ","МАР","АПР","МАЙ","ИЮН","ИЮЛ","АВГ","СЕН","ОКТ","НОЯ","ДЕК"];

function TimelineBar(_ref) {
  var entry = _ref.entry, waveMonths = _ref.waveMonths, trackW = _ref.trackW, onSel = _ref.onSel, isCurrent = _ref.isCurrent, wave = _ref.wave;
  var _useState = useState(false), hover = _useState[0], setHover = _useState[1];
  var p = entry.parsed;
  var left = tlDatePos(p.startMonth, p.startDay, waveMonths, trackW);
  var right = tlDatePos(p.endMonth, p.endDay, waveMonths, trackW);
  if (left === null || right === null) return null;
  var w = Math.max(right - left, 4);
  var cls = "tl-bar" + (p.approx ? " approx" : "") + (isCurrent ? " current" : "");
  // Vacancy publication diamond marker
  var vpDiamond = null;
  if (entry.vacPub) {
    var vpMid = Math.round(((entry.vacPub.startDay || 1) + (entry.vacPub.endDay || 28)) / 2);
    var vpPos = tlDatePos(entry.vacPub.startMonth, vpMid, waveMonths, trackW);
    if (vpPos !== null) {
      vpDiamond = React.createElement("div", {
        className: "tl-vp-diamond",
        style: { left: vpPos + "px" },
        title: "Публикация вакантных мест: " + ((wave === "summer" ? entry.uni.vacPubSummer : entry.uni.vacPubWinter) || "")
      });
    }
  }
  return React.createElement("div", { className: "tl-row" },
    React.createElement("div", {
      className: "tl-row-label",
      title: entry.uni.name || entry.uni.abbr,
      onClick: function() { onSel(entry.uni); }
    }, entry.uni.abbr),
    React.createElement("div", { className: "tl-row-track" },
      vpDiamond,
      React.createElement("div", {
        className: cls,
        style: { left: left + "px", width: w + "px" },
        onMouseEnter: function() { setHover(true); },
        onMouseLeave: function() { setHover(false); },
        onClick: function() { onSel(entry.uni); }
      },
        hover && React.createElement("div", { className: "tl-tip" },
          React.createElement("div", { style: { fontFamily: "'Unbounded',sans-serif", fontSize: "9px", marginBottom: "4px", opacity: .7 } }, entry.uni.abbr),
          p.orig,
          entry.vacPub && React.createElement("div", { style: { marginTop: "4px", fontSize: "10px", color: "#e57373" } },
            "◆ Вакантные места: " + (wave === "summer" ? entry.uni.vacPubSummer : entry.uni.vacPubWinter)
          )
        )
      )
    )
  );
}

function TimelineVagueList(_ref) {
  var entries = _ref.entries, wave = _ref.wave, onSel = _ref.onSel;
  var _useState = useState(false), exp = _useState[0], setExp = _useState[1];
  if (!entries.length) return null;
  var isSummer = wave === "summer";
  return React.createElement("div", { className: "tl-vague" },
    React.createElement("div", { className: "tl-vague-hd", onClick: function() { setExp(!exp); } },
      React.createElement("span", { className: "chev" + (exp ? " o" : "") }, "▾"),
      " Даты уточняются (" + entries.length + " " + (entries.length === 1 ? "вуз" : entries.length < 5 ? "вуза" : "вузов") + ")"
    ),
    exp && React.createElement("div", { className: "tl-vague-body" },
      entries.map(function(uni) {
        return React.createElement("div", { key: uni.id, className: "tl-vague-item" },
          React.createElement("span", {
            className: "tl-vague-abbr",
            onClick: function() { onSel(uni); }
          }, uni.abbr),
          React.createElement("span", { className: "tl-vague-text" },
            isSummer ? (uni.summer || "Уточнять на сайте") : (uni.winter || "Уточнять на сайте")
          )
        );
      })
    )
  );
}

function TimelineWave(_ref) {
  var wave = _ref.wave, entries = _ref.entries, vagueEntries = _ref.vagueEntries, onSel = _ref.onSel, containerWidth = _ref.containerWidth;
  var isSummer = wave === "summer";
  var waveMonths = isSummer ? [2, 3, 4, 5, 6, 7, 8, 9] : [10, 11, 0, 1, 2, 3];
  var labelW = containerWidth < 640 ? 55 : 80;
  var trackW = containerWidth - labelW - 32;
  if (trackW < 100) trackW = 100;
  var today = new Date();
  var todayPos = tlDatePos(today.getMonth(), today.getDate(), waveMonths, trackW);
  var mw = trackW / waveMonths.length;

  return React.createElement("div", { className: "tl-wave " + (isSummer ? "tl-summer" : "tl-winter") },
    React.createElement("div", { className: "tl-wave-title" },
      isSummer ? "☀️  ЛЕТНЯЯ ВОЛНА (осенний семестр)" : "❄️  ЗИМНЯЯ ВОЛНА (весенний семестр)"
    ),
    React.createElement("div", { className: "tl-chart" },
      // grid lines
      React.createElement("div", { className: "tl-grid-lines", style: { left: labelW + "px", right: "0" } },
        waveMonths.map(function(mo, i) {
          return React.createElement("div", { key: mo, className: "tl-grid-line", style: { left: (i * mw) + "px" } });
        })
      ),
      // axis
      React.createElement("div", { className: "tl-axis" },
        React.createElement("div", { className: "tl-axis-label" }),
        React.createElement("div", { className: "tl-axis-months", style: { width: trackW + "px" } },
          waveMonths.map(function(mo) {
            return React.createElement("div", {
              key: mo,
              className: "tl-axis-month" + (mo === today.getMonth() ? " cur" : "")
            }, TL_MONTH_SHORT[mo]);
          })
        )
      ),
      // bars
      entries.map(function(entry, idx) {
        return React.createElement(TimelineBar, {
          key: entry.uni.id + "-" + idx,
          entry: entry,
          waveMonths: waveMonths,
          trackW: trackW,
          onSel: onSel,
          isCurrent: tlIsCurrent(entry, today),
          wave: wave
        });
      }),
      // today line
      todayPos !== null && React.createElement("div", {
        className: "tl-today",
        style: { left: (labelW + todayPos) + "px" }
      },
        React.createElement("div", { className: "tl-today-tag" }, "СЕГОДНЯ")
      ),
      entries.length === 0 && React.createElement("div", {
        style: { padding: "12px 0", textAlign: "center", fontSize: "12px", color: "var(--muted)" }
      }, "Нет вузов с точными датами для этой волны")
    ),
    // mobile cards
    React.createElement("div", { className: "tl-cards" },
      entries.map(function(entry, idx) {
        var p = entry.parsed;
        var isCur = tlIsCurrent(entry, today);
        var rangeText = "";
        if (p.startDay && p.endDay) {
          rangeText = p.startDay + " " + TL_MONTH_SHORT[p.startMonth].toLowerCase() + " – " + p.endDay + " " + TL_MONTH_SHORT[p.endMonth].toLowerCase();
        } else {
          rangeText = TL_MONTH_SHORT[p.startMonth] + " – " + TL_MONTH_SHORT[p.endMonth];
        }
        return React.createElement("div", {
          key: entry.uni.id + "-m-" + idx,
          className: "tl-card" + (isCur ? " current" : ""),
          onClick: function() { onSel(entry.uni); }
        },
          React.createElement("div", { className: "tl-card-abbr" }, entry.uni.abbr),
          React.createElement("div", { className: "tl-card-range" + (p.approx ? " approx" : "") }, rangeText)
        );
      })
    ),
    React.createElement(TimelineVagueList, { entries: vagueEntries, wave: wave, onSel: onSel })
  );
}

function TimelineSection(_ref) {
  var onSel = _ref.onSel;
  var _useState = useState("all"), wf = _useState[0], setWf = _useState[1];
  var ref = useRef(null);
  var _useState2 = useState(800), cw = _useState2[0], setCw = _useState2[1];

  useEffect(function() {
    if (!ref.current) return;
    var ro = new ResizeObserver(function(entries) {
      for (var i = 0; i < entries.length; i++) setCw(entries[i].contentRect.width);
    });
    ro.observe(ref.current);
    return function() { ro.disconnect(); };
  }, []);

  var data = useMemo(function() { return buildTimelineData(UNIS); }, []);

  return React.createElement("div", { ref: ref, className: "tl-section" },
    React.createElement("div", { className: "tl-header" },
      React.createElement("div", { className: "tl-title" },
        React.createElement("div", { className: "tl-icon" }, "📅"),
        "ТАЙМЛАЙН ПОДАЧИ ЗАЯВЛЕНИЙ"
      ),
      React.createElement("div", { className: "tl-toggles" },
        [["all", "Все волны"], ["summer", "☀ Летняя"], ["winter", "❄ Зимняя"]].map(function(pair) {
          return React.createElement("button", {
            key: pair[0],
            className: "chip" + (wf === pair[0] ? " on" : ""),
            onClick: function() { setWf(pair[0]); }
          }, pair[1]);
        })
      )
    ),
    React.createElement("div", { className: "tl-legend" },
      React.createElement("span", { className: "tl-legend-item" },
        React.createElement("span", { className: "tl-legend-bar" }), " Подача заявлений"
      ),
      React.createElement("span", { className: "tl-legend-item" },
        React.createElement("span", { className: "tl-legend-bar approx" }), " Примерные даты"
      ),
      React.createElement("span", { className: "tl-legend-item" },
        React.createElement("span", { className: "tl-legend-diamond" }), " Публикация вакантных мест"
      )
    ),
    (wf === "all" || wf === "summer") &&
      React.createElement(TimelineWave, {
        wave: "summer", entries: data.summer, vagueEntries: data.vagueSum, onSel: onSel, containerWidth: cw
      }),
    (wf === "all" || wf === "winter") &&
      React.createElement(TimelineWave, {
        wave: "winter", entries: data.winter, vagueEntries: data.vagueWin, onSel: onSel, containerWidth: cw
      })
  );
}
/* ===== END TIMELINE ===== */

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
    React.createElement(TimelineSection, { onSel: onSel }),
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
      "div",
      { style: { maxWidth: "1300px", margin: "0 auto", padding: "0 24px 20px" } },
      React.createElement(
        "a",
        {
          href: "./search.html",
          style: {
            display: "flex",
            alignItems: "center",
            gap: "12px",
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: "10px",
            padding: "16px 20px",
            textDecoration: "none",
            color: "var(--text)",
            transition: "border-color .15s, background .15s",
          },
          onMouseOver: function(e) { e.currentTarget.style.borderColor = "var(--gold)"; },
          onMouseOut: function(e) { e.currentTarget.style.borderColor = "var(--border)"; },
        },
        React.createElement("span", { style: { fontSize: "24px" } }, "🌐"),
        React.createElement(
          "div",
          null,
          React.createElement(
            "div",
            { style: { fontFamily: "'Unbounded',sans-serif", fontSize: "12px", fontWeight: "600", color: "var(--gold)", letterSpacing: ".05em", marginBottom: "4px" } },
            "ГЛОБАЛЬНЫЙ ПОИСК ПО ВСЕМ ВАКАНТНЫМ МЕСТАМ"
          ),
          React.createElement(
            "div",
            { style: { fontSize: "12px", color: "var(--muted)" } },
            "Поиск по всем направлениям, программам и вузам одновременно с расширенными фильтрами →"
          )
        )
      )
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
      !selectedUni &&
        React.createElement(
          "a",
          { className: "back-btn", href: "./search.html", style: { marginLeft: "auto" } },
          "🌐 Глобальный поиск"
        ),
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
