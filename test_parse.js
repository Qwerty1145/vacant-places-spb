global.window = {};
const fs = require('fs');
eval(fs.readFileSync('./site/data/portal_data.js', 'utf8'));
const UNIS = window.PORTAL_DATA.unis;

// Load parsing functions
const code = fs.readFileSync('./site/portal_app.js', 'utf8');
const start = code.indexOf('var RU_MONTH_STEMS');
const end = code.indexOf('var TL_MONTH_SHORT');
eval(code.slice(start, end));

const data = buildTimelineData(UNIS);
console.log('Summer entries:', data.summer.length, '| VagueSummer:', data.vagueSum.length);
console.log('Winter entries:', data.winter.length, '| VagueWinter:', data.vagueWin.length);

console.log('\nUpdated universities:');
const check = [19, 15, 5, 21, 9, 3, 24, 28, 4];
check.forEach(id => {
  const u = UNIS.find(u => u.id === id);
  const inSummer = data.summer.find(e => e.uni.id === id);
  const inWinter = data.winter.find(e => e.uni.id === id);
  console.log(`  ${u.abbr.padEnd(25)} S:${inSummer?'OK':'VAGUE'} W:${inWinter?'OK':'VAGUE'}`);
  if (inSummer) console.log(`    Summer bar: m${inSummer.parsed.startMonth}-${inSummer.parsed.endMonth} d${inSummer.parsed.startDay}-${inSummer.parsed.endDay}`);
  if (inWinter) console.log(`    Winter bar: m${inWinter.parsed.startMonth}-${inWinter.parsed.endMonth} d${inWinter.parsed.startDay}-${inWinter.parsed.endDay}`);
});
