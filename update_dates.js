const fs = require('fs');
const path = './site/data/portal_data.js';
let content = fs.readFileSync(path, 'utf8');

// Parse the JSON object from the JS file
const prefix = 'window.PORTAL_DATA = ';
const jsonStr = content.slice(prefix.length).replace(/;\s*$/, '');
const data = JSON.parse(jsonStr);

// Map of updates by ID
const updates = {
  // СПбГУ (ID 19) - CRITICAL: summer wave is March, not June-July!
  19: {
    summer: "2 марта – 27 марта (летняя волна, осенний семестр 2026; заседание ЦКПиВ — 15.04.2026)",
    winter: "8 декабря – 25 января (зимняя волна, весенний семестр 2026; заседание ЦКПиВ — 10.02.2026)",
    vacPubSummer: "Начало марта (на edu.spbu.ru)",
    vacPubWinter: "Начало декабря (на edu.spbu.ru)"
  },
  // ИТМО (ID 15) - added 1st wave
  15: {
    summer: "30 июня – 4 июля (1-я волна); 14 июля – 22 августа (2-я волна, осенний семестр)",
    winter: "22 – 28 января (приём заявлений на весенний семестр)",
    vacPubSummer: "Конец августа (после окончания приёма заявлений)",
    vacPubWinter: "Конец января (после окончания приёма)"
  },
  // СЗИУ РАНХиГС (ID 5) - more detailed with multiple commissions
  5: {
    summer: "01 августа – 11 сентября (на 1-й семестр; комиссии: 26.08 и 23.09)",
    winter: "15 января – 10 марта (на 2-й семестр; комиссии: 10.02, 03.03, 20.03)"
  },
  // СПбГУТ (ID 21) - earlier start dates
  21: {
    summer: "01 августа – 05 сентября (осенний семестр)",
    winter: "10 января – 05 февраля (весенний семестр)"
  },
  // ГУМРФ (ID 9) - winter budget not available for bachelor's очная
  9: {
    summer: "20.06 – 29.08 (бюджет, очная, 1-й семестр)",
    winter: "Перевод на бюджет очной формы в зимнюю волну не предусмотрен; платное/заочное — уточнять на gumrf.ru"
  },
  // СПбГЭУ (ID 3) - confirmed winter dates
  3: {
    summer: "Июль–август (до начала осеннего семестра); уточнять на unecon.ru",
    winter: "12 – 27 января (весенний семестр; комиссия 30.01)"
  },
  // СПбГУПТД (ID 24) - confirmed with exact times
  24: {
    summer: "До 10 сентября 18:00 (осенний семестр)",
    winter: "До 20 февраля 15:00 (весенний семестр)"
  },
  // Филиал ФинУниверситета (ID 28) - confirmed, clarified budget vs contract
  28: {
    summer: "11 – 20 августа 2026 (бюджет и договор)",
    winter: "20–29 января 2026 (договор); 16–20 февраля 2026 (бюджет)"
  },
  // НИУ ВШЭ — СПб (ID 4) - minor date correction
  4: {
    summer: "1–14 июня; доп. период на отд. программах — август",
    winter: "1–14 декабря; доп. период — февраль на отд. программах",
    vacPubSummer: "28–31 мая (на странице программы hse.ru)",
    vacPubWinter: "28–30 ноября (на странице программы hse.ru)"
  },
  // СПбУТУиЭ (ID 6) - keep as-is, these are specific 2025 dates already
  // ЛЭТИ (ID 2) - keep as-is, site was down
  // СПбПУ (ID 20) - keep as-is, Excel file not accessible
  // РГПУ Герцена (ID 13) - confirmed, keep as-is
  // ПГУПС (ID 32) - confirmed, keep as-is
  // ЛГУ Пушкина (ID 12) - confirmed, keep as-is
};

// Apply updates
let changeCount = 0;
for (const [id, upd] of Object.entries(updates)) {
  const uni = data.unis.find(u => u.id === parseInt(id));
  if (!uni) {
    console.log('WARNING: University ID', id, 'not found!');
    continue;
  }
  for (const [key, value] of Object.entries(upd)) {
    if (uni[key] !== value) {
      console.log(`[${uni.abbr}] ${key}: "${(uni[key]||'').slice(0,50)}" → "${value.slice(0,50)}"`);
      uni[key] = value;
      changeCount++;
    }
  }
}

// Update generatedAt
data.generatedAt = new Date().toISOString();

// Write back
const output = prefix + JSON.stringify(data) + ';\n';
fs.writeFileSync(path, output, 'utf8');
console.log(`\nDone! ${changeCount} fields updated.`);
