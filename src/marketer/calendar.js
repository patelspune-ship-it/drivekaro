// DriveKaro AI Marketer: festivals, holidays, marketing days, seasons and long weekends.
// Shared by the browser app and the server (api/marketer.js). No DOM access here.
//
// Where the dates come from (merged, newest wins):
//  1. Google's public "Holidays in India" calendar (live, no key needed) – fetched by the server.
//  2. Calendarific (optional, CALENDARIFIC_API_KEY) with location Maharashtra – adds state holidays.
//  3. Built-in fixed-date marketing days (Valentine's, Mother's Day, Tourism Day, …) and seasons.
//  4. A small built-in list of Maharashtra holidays, used only when the live sources return nothing.
//  5. Your own events added in the app (always win; you can also hide any event).

export const pad = n => String(n).padStart(2, '0');
export const ymdOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const dateOf = ymd => { const [y, m, d] = ymd.split('-').map(Number); return new Date(y, m - 1, d, 12); };
export const addDays = (ymd, n) => { const d = dateOf(ymd); d.setDate(d.getDate() + n); return ymdOf(d); };
export const dow = ymd => dateOf(ymd).getDay(); // 0 Sun … 6 Sat

/* ---------- festival knowledge ---------- */
// travel: 0 none · 1 some · 2 good · 3 peak road-trip demand. lead: days before to start promoting trips.
// mh: office holiday in Maharashtra (used for long weekends).
export const FEST = [
  { key: 'padwa', minor: true, re: /bali ?pratipada|govardhan|diwali padwa/i, label: 'Diwali Padwa', travel: 3, lead: 0, mh: true, theme: 'diwali',
    greet: { en: 'Happy Diwali Padwa', hi: 'पाडवा की शुभकामनाएं', mr: 'दिवाळी पाडव्याच्या हार्दिक शुभेच्छा' } },
  { key: 'bhaubeej', minor: true, re: /bhai ?(dooj|duj|dui)|bhau ?beej|bhaiya ?dooj|bhai ?phonta|bhratri/i, label: 'Bhau Beej', travel: 2, lead: 0, theme: 'diwali',
    greet: { en: 'Happy Bhau Beej', hi: 'भाई दूज की शुभकामनाएं', mr: 'भाऊबीजेच्या हार्दिक शुभेच्छा' } },
  { key: 'dhanteras', minor: true, re: /dhanteras|dhantrayodashi/i, label: 'Dhanteras', travel: 1, lead: 0, theme: 'diwali',
    greet: { en: 'Happy Dhanteras', hi: 'धनतेरस की शुभकामनाएं', mr: 'धनत्रयोदशीच्या शुभेच्छा' } },
  { key: 'diwali', re: /diwali|deepavali|lakshmi ?puja|laxmi ?pujan|narak(a)? chaturdashi/i, label: 'Diwali', travel: 3, lead: 12, mh: true, theme: 'diwali',
    greet: { en: 'Happy Diwali', hi: 'शुभ दीपावली', mr: 'दिवाळीच्या हार्दिक शुभेच्छा' } },
  { key: 'dussehra', re: /dussehra|dasara|dasera|vijaya ?dashami/i, label: 'Dussehra', travel: 2, lead: 6, mh: true, theme: 'dussehra',
    greet: { en: 'Happy Dussehra', hi: 'विजयादशमी की शुभकामनाएं', mr: 'दसऱ्याच्या हार्दिक शुभेच्छा' } },
  { key: 'navratri', minor: true, re: /navratri|navaratri|ghatasthapana|durga ?puja|maha ?(saptami|ashtami|navami)/i, label: 'Navratri', travel: 1, lead: 0, theme: 'navratri',
    greet: { en: 'Happy Navratri', hi: 'नवरात्रि की शुभकामनाएं', mr: 'नवरात्रीच्या हार्दिक शुभेच्छा' } },
  { key: 'anant', minor: true, re: /anant ?chaturdashi|ganesh visarjan/i, label: 'Anant Chaturdashi', travel: 1, lead: 0, theme: 'ganesh',
    greet: { en: 'Ganpati Bappa Morya, pudhchya varshi lavkar ya!', hi: 'गणपति बप्पा मोरया!', mr: 'गणपती बाप्पा मोरया, पुढच्या वर्षी लवकर या!' } },
  { key: 'ganesh', re: /ganesh|vinayak(a)? chaturthi|ganpati/i, label: 'Ganesh Chaturthi', travel: 2, lead: 5, mh: true, theme: 'ganesh',
    greet: { en: 'Ganpati Bappa Morya!', hi: 'गणपति बप्पा मोरया!', mr: 'गणपती बाप्पा मोरया!' } },
  { key: 'holi', re: /\bholi\b|holika|dhulandi|dhuleti|rang ?panchami/i, label: 'Holi', travel: 2, lead: 6, mh: true, theme: 'holi',
    greet: { en: 'Happy Holi', hi: 'होली की हार्दिक शुभकामनाएं', mr: 'होळीच्या हार्दिक शुभेच्छा' } },
  { key: 'gudipadwa', re: /gud(h)?i ?padwa|ugadi|chaitra sukhladi/i, label: 'Gudi Padwa', travel: 1, lead: 4, mh: true, theme: 'gudipadwa',
    greet: { en: 'Happy Gudi Padwa', hi: 'गुड़ी पड़वा की शुभकामनाएं', mr: 'गुढीपाडव्याच्या हार्दिक शुभेच्छा' } },
  { key: 'makar', re: /makar ?sankranti|pongal|lohri|uttarayan/i, label: 'Makar Sankranti', travel: 1, lead: 0, theme: 'makar',
    greet: { en: 'Happy Makar Sankranti', hi: 'मकर संक्रांति की शुभकामनाएं', mr: 'तिळगूळ घ्या, गोड गोड बोला' } },
  { key: 'christmas', re: /christmas(?! eve)/i, label: 'Christmas', travel: 3, lead: 12, mh: true, theme: 'christmas',
    greet: { en: 'Merry Christmas', hi: 'मेरी क्रिसमस', mr: 'नाताळच्या हार्दिक शुभेच्छा' } },
  { key: 'xmaseve', minor: true, re: /christmas eve/i, label: 'Christmas Eve', travel: 2, lead: 0, theme: 'christmas',
    greet: { en: 'Merry Christmas Eve', hi: 'मेरी क्रिसमस', mr: 'नाताळच्या शुभेच्छा' } },
  { key: 'newyear', re: /new year'?s? day|^new year$/i, label: "New Year", travel: 3, lead: 0, mh: false, theme: 'newyear',
    greet: { en: 'Happy New Year', hi: 'नव वर्ष की शुभकामनाएं', mr: 'नवीन वर्षाच्या हार्दिक शुभेच्छा' } },
  { key: 'nye', re: /new year'?s? eve/i, label: "New Year's Eve", travel: 3, lead: 14, theme: 'newyear',
    greet: { en: 'Cheers to the New Year', hi: 'नए साल की शुभकामनाएं', mr: 'नववर्षाच्या शुभेच्छा' } },
  { key: 'eidfitr', re: /eid.?ul.?fitr|id.?ul.?fitr|ramzan ?id|ramadan ?eid|eid al.?fitr/i, label: 'Eid al-Fitr', travel: 2, lead: 4, mh: true, theme: 'eid',
    greet: { en: 'Eid Mubarak', hi: 'ईद मुबारक', mr: 'ईद मुबारक' } },
  { key: 'bakrid', re: /bakri ?id|bakrid|eid.?ul.?(adha|zuha)|id.?u[lz].?zuha|eid al.?adha/i, label: 'Bakri Eid', travel: 2, lead: 4, mh: true, theme: 'eid',
    greet: { en: 'Eid Mubarak', hi: 'ईद मुबारक', mr: 'ईद मुबारक' } },
  { key: 'miladunnabi', re: /milad|prophet'?s birthday/i, label: 'Eid-e-Milad', travel: 0, lead: 0, mh: true, theme: 'eid',
    greet: { en: 'Eid-e-Milad Mubarak', hi: 'ईद-ए-मिलाद मुबारक', mr: 'ईद-ए-मिलाद मुबारक' } },
  { key: 'muharram', re: /muharram|moharr?um|ashura/i, label: 'Muharram', travel: 0, lead: 0, mh: true, greetOff: true },
  { key: 'independence', re: /independence day/i, label: 'Independence Day', travel: 2, lead: 6, mh: true, theme: 'tricolor',
    greet: { en: 'Happy Independence Day', hi: 'स्वतंत्रता दिवस की शुभकामनाएं', mr: 'स्वातंत्र्य दिनाच्या हार्दिक शुभेच्छा' } },
  { key: 'republic', re: /republic day/i, label: 'Republic Day', travel: 2, lead: 6, mh: true, theme: 'tricolor',
    greet: { en: 'Happy Republic Day', hi: 'गणतंत्र दिवस की शुभकामनाएं', mr: 'प्रजासत्ताक दिनाच्या हार्दिक शुभेच्छा' } },
  { key: 'gandhi', re: /gandhi (jayanti|'?s birthday)|mahatma gandhi/i, label: 'Gandhi Jayanti', travel: 1, lead: 4, mh: true, theme: 'tricolor',
    greet: { en: 'Gandhi Jayanti', hi: 'गांधी जयंती', mr: 'गांधी जयंती' } },
  { key: 'shivjayanti', re: /shivaji|shiv ?jayanti/i, label: 'Shiv Jayanti', travel: 1, lead: 3, mh: true, theme: 'saffron',
    greet: { en: 'Chhatrapati Shivaji Maharaj Jayanti', hi: 'शिवाजी महाराज जयंती की शुभकामनाएं', mr: 'शिवजयंतीच्या हार्दिक शुभेच्छा' } },
  { key: 'maharashtraday', re: /maharashtra (day|din)/i, label: 'Maharashtra Day', travel: 1, lead: 4, mh: true, theme: 'saffron',
    greet: { en: 'Happy Maharashtra Day', hi: 'महाराष्ट्र दिवस की शुभकामनाएं', mr: 'महाराष्ट्र दिनाच्या हार्दिक शुभेच्छा' } },
  { key: 'rakhi', re: /raksha ?bandhan|rakhi/i, label: 'Raksha Bandhan', travel: 1, lead: 0, theme: 'rakhi',
    greet: { en: 'Happy Raksha Bandhan', hi: 'रक्षाबंधन की शुभकामनाएं', mr: 'रक्षाबंधनाच्या हार्दिक शुभेच्छा' } },
  { key: 'janmashtami', re: /janmashtami|krishna jayanti|gokulashtami|dahi ?handi/i, label: 'Janmashtami', travel: 1, lead: 0, theme: 'saffron',
    greet: { en: 'Happy Janmashtami', hi: 'जन्माष्टमी की शुभकामनाएं', mr: 'गोकुळाष्टमीच्या हार्दिक शुभेच्छा' } },
  { key: 'shivratri', re: /shivrat?ri|shivaratri/i, label: 'Maha Shivratri', travel: 1, lead: 0, mh: true, theme: 'saffron',
    greet: { en: 'Happy Maha Shivratri', hi: 'महाशिवरात्रि की शुभकामनाएं', mr: 'महाशिवरात्रीच्या शुभेच्छा' } },
  { key: 'ramnavami', re: /ram(a)? ?navami|ram ?navmi/i, label: 'Ram Navami', travel: 1, lead: 0, mh: true, theme: 'saffron',
    greet: { en: 'Happy Ram Navami', hi: 'राम नवमी की शुभकामनाएं', mr: 'रामनवमीच्या शुभेच्छा' } },
  { key: 'mahavir', re: /mahavir/i, label: 'Mahavir Jayanti', travel: 1, lead: 0, mh: true, theme: 'saffron',
    greet: { en: 'Happy Mahavir Jayanti', hi: 'महावीर जयंती की शुभकामनाएं', mr: 'महावीर जयंतीच्या शुभेच्छा' } },
  { key: 'goodfriday', re: /good friday/i, label: 'Good Friday', travel: 2, lead: 5, mh: true, greetOff: true },
  { key: 'easter', minor: true, re: /easter/i, label: 'Easter', travel: 1, lead: 0, theme: 'christmas', greet: { en: 'Happy Easter', hi: 'ईस्टर की शुभकामनाएं', mr: 'ईस्टरच्या शुभेच्छा' } },
  { key: 'ambedkar', re: /ambedkar/i, label: 'Ambedkar Jayanti', travel: 1, lead: 0, mh: true, theme: 'blue',
    greet: { en: 'Dr. Babasaheb Ambedkar Jayanti', hi: 'आंबेडकर जयंती', mr: 'डॉ. बाबासाहेब आंबेडकर जयंती' } },
  { key: 'buddha', re: /buddha/i, label: 'Buddha Purnima', travel: 1, lead: 0, mh: true, theme: 'blue',
    greet: { en: 'Happy Buddha Purnima', hi: 'बुद्ध पूर्णिमा की शुभकामनाएं', mr: 'बुद्ध पौर्णिमेच्या शुभेच्छा' } },
  { key: 'gurunanak', re: /guru ?nanak|gurpurab|guru purab/i, label: 'Guru Nanak Jayanti', travel: 1, lead: 0, mh: true, theme: 'saffron',
    greet: { en: 'Happy Gurpurab', hi: 'गुरु नानक जयंती की शुभकामनाएं', mr: 'गुरु नानक जयंतीच्या शुभेच्छा' } },
  { key: 'parsi', re: /parsi new year|navroz|nowruz|shahenshahi/i, label: 'Parsi New Year', travel: 0, lead: 0, mh: true, theme: 'blue',
    greet: { en: 'Navroz Mubarak', hi: 'नवरोज़ मुबारक', mr: 'नवरोज मुबारक' } },
  { key: 'onam', minor: true, re: /onam/i, label: 'Onam', travel: 0, lead: 0, theme: 'saffron', greet: { en: 'Happy Onam', hi: 'ओणम की शुभकामनाएं', mr: 'ओणमच्या शुभेच्छा' } },
  { key: 'karwa', minor: true, re: /karwa|karva ?chauth/i, label: 'Karwa Chauth', travel: 0, lead: 0, theme: 'diwali', greet: { en: 'Happy Karwa Chauth', hi: 'करवा चौथ की शुभकामनाएं', mr: 'करवा चौथच्या शुभेच्छा' } },
  { key: 'ashadhi', re: /ashadhi|devshayani/i, label: 'Ashadhi Ekadashi', travel: 1, lead: 0, theme: 'saffron',
    greet: { en: 'Ashadhi Ekadashi', hi: 'आषाढ़ी एकादशी', mr: 'आषाढी एकादशीच्या शुभेच्छा' } },
];

// Built-in marketing days (not holidays) – fixed or rule-based dates.
function nthWeekday(year, month, weekday, n) { // month 1-12, weekday 0-6, n 1..5
  const d = new Date(year, month - 1, 1, 12); let c = 0;
  while (true) { if (d.getDay() === weekday && ++c === n) return ymdOf(d); d.setDate(d.getDate() + 1); }
}
export function marketingDays(year) {
  const f = (m, d, name, key, extra = {}) => ({ date: `${year}-${pad(m)}-${pad(d)}`, name, key, kind: 'marketing', source: 'builtin', ...extra });
  return [
    f(1, 1, "New Year's Day", 'newyear', { kind: 'holiday' }),
    f(2, 14, "Valentine's Day", 'valentine', { travel: 2, lead: 7, theme: 'valentine', greet: { en: "Happy Valentine's Day", hi: 'वैलेंटाइन डे की शुभकामनाएं', mr: 'व्हॅलेंटाईन डेच्या शुभेच्छा' } }),
    f(3, 8, "International Women's Day", 'womensday', { travel: 0, theme: 'rakhi', greet: { en: "Happy Women's Day", hi: 'महिला दिवस की शुभकामनाएं', mr: 'महिला दिनाच्या शुभेच्छा' } }),
    { date: nthWeekday(year, 5, 0, 2), name: "Mother's Day", key: 'mothersday', kind: 'marketing', source: 'builtin', travel: 1, theme: 'rakhi', greet: { en: "Happy Mother's Day", hi: 'मातृ दिवस की शुभकामनाएं', mr: 'मातृदिनाच्या शुभेच्छा' } },
    { date: nthWeekday(year, 6, 0, 3), name: "Father's Day", key: 'fathersday', kind: 'marketing', source: 'builtin', travel: 1, theme: 'blue', greet: { en: "Happy Father's Day", hi: 'पितृ दिवस की शुभकामनाएं', mr: 'पितृदिनाच्या शुभेच्छा' } },
    { date: nthWeekday(year, 8, 0, 1), name: 'Friendship Day', key: 'friendship', kind: 'marketing', source: 'builtin', travel: 2, lead: 5, theme: 'holi', greet: { en: 'Happy Friendship Day', hi: 'फ्रेंडशिप डे की शुभकामनाएं', mr: 'मैत्री दिनाच्या शुभेच्छा' } },
    f(9, 27, 'World Tourism Day', 'tourismday', { travel: 2, theme: 'blue', greet: { en: 'Happy World Tourism Day', hi: 'विश्व पर्यटन दिवस', mr: 'जागतिक पर्यटन दिन' } }),
    f(11, 14, "Children's Day", 'childrensday', { travel: 1, theme: 'holi', greet: { en: "Happy Children's Day", hi: 'बाल दिवस की शुभकामनाएं', mr: 'बालदिनाच्या शुभेच्छा' } }),
    f(12, 31, "New Year's Eve", 'nye', { kind: 'marketing' }),
  ];
}

// Maharashtra office holidays built in, used ONLY when live sources return nothing for that year.
// Dates cross-checked on public lists (2026: ClearTax / publicholidays.in; 2027: qppstudio). Lunar dates can shift by a day.
const FALLBACK = {
  2026: [['2026-01-26', 'Republic Day'], ['2026-02-15', 'Maha Shivratri'], ['2026-02-19', 'Chhatrapati Shivaji Maharaj Jayanti'], ['2026-03-03', 'Holi'],
    ['2026-03-20', 'Gudi Padwa'], ['2026-03-21', 'Id-ul-Fitr'], ['2026-03-27', 'Ram Navami'], ['2026-03-31', 'Mahavir Jayanti'], ['2026-04-03', 'Good Friday'],
    ['2026-04-14', 'Dr. Ambedkar Jayanti'], ['2026-05-01', 'Maharashtra Day'], ['2026-05-01', 'Buddha Purnima'], ['2026-05-28', 'Bakri Id'], ['2026-06-26', 'Muharram'],
    ['2026-08-15', 'Independence Day'], ['2026-08-26', 'Id-e-Milad'], ['2026-09-14', 'Ganesh Chaturthi'], ['2026-10-02', 'Gandhi Jayanti'],
    ['2026-10-20', 'Dussehra'], ['2026-11-08', 'Diwali (Lakshmi Pujan)'], ['2026-11-10', 'Diwali Bali Pratipada'], ['2026-11-24', 'Guru Nanak Jayanti'], ['2026-12-25', 'Christmas']],
  2027: [['2027-01-26', 'Republic Day'], ['2027-02-19', 'Chhatrapati Shivaji Maharaj Jayanti'], ['2027-03-06', 'Maha Shivratri'], ['2027-03-10', 'Id-ul-Fitr'],
    ['2027-03-23', 'Holi'], ['2027-03-26', 'Good Friday'], ['2027-04-07', 'Gudi Padwa'], ['2027-04-14', 'Dr. Ambedkar Jayanti'], ['2027-04-15', 'Ram Navami'],
    ['2027-04-19', 'Mahavir Jayanti'], ['2027-05-01', 'Maharashtra Day'], ['2027-05-17', 'Bakri Id'], ['2027-05-20', 'Buddha Purnima'], ['2027-06-16', 'Muharram'],
    ['2027-08-15', 'Independence Day']],
};
export function fallbackHolidays(year) {
  return (FALLBACK[year] || []).map(([date, name]) => ({ date, name, kind: 'holiday', source: 'builtin', approx: true }));
}

/* ---------- parsing live sources ---------- */
export function parseICS(text) {
  const lines = String(text || '').replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const out = []; let cur = null;
  const unesc = v => v.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (line === 'END:VEVENT') { if (cur && cur.date && cur.name) out.push(cur); cur = null; continue; }
    if (!cur) continue;
    const i = line.indexOf(':'); if (i < 0) continue;
    const head = line.slice(0, i), val = line.slice(i + 1), key = head.split(';')[0].toUpperCase();
    if (key === 'DTSTART') { const m = val.match(/(\d{4})(\d{2})(\d{2})/); if (m) cur.date = `${m[1]}-${m[2]}-${m[3]}`; }
    else if (key === 'DTEND') { const m = val.match(/(\d{4})(\d{2})(\d{2})/); if (m) cur.endExcl = `${m[1]}-${m[2]}-${m[3]}`; }
    else if (key === 'SUMMARY') cur.name = unesc(val).trim();
    else if (key === 'DESCRIPTION') cur.desc = unesc(val).trim();
  }
  return out.map(e => {
    const d = (e.desc || '').toLowerCase();
    const kind = /public holiday|gazetted/.test(d) ? 'holiday' : /restricted|optional/.test(d) ? 'restricted' : /observance/.test(d) ? 'observance' : 'festival';
    return { date: e.date, name: e.name, kind, source: 'google' };
  });
}
export function parseCalendarific(json) {
  const list = json?.response?.holidays || [];
  return list.map(h => {
    const t = (h.type || []).join(' ').toLowerCase();
    const kind = /national|gazetted|state|public/.test(t) ? 'holiday' : /restricted|optional/.test(t) ? 'restricted' : /season/.test(t) ? 'season' : 'observance';
    return { date: String(h.date?.iso || '').slice(0, 10), name: h.name, kind, source: 'calendarific' };
  }).filter(e => /^\d{4}-\d{2}-\d{2}$/.test(e.date) && e.kind !== 'season');
}

/* ---------- merging and enriching ---------- */
export function festOf(name) { return FEST.find(f => f.re.test(name || '')) || null; }
const KIND_RANK = { holiday: 4, festival: 3, restricted: 2, marketing: 2, observance: 1 };
const SRC_RANK = { custom: 5, calendarific: 3, google: 3, builtin: 1 };

// Merge lists from all sources into one list per date+festival, with the best info kept.
export function mergeEvents(...lists) {
  const map = new Map();
  for (const e of lists.flat()) {
    if (!e || !e.date || !e.name) continue;
    const f = e.key ? FEST.find(x => x.key === e.key) || null : festOf(e.name);
    const key = `${e.date}|${e.key || f?.key || e.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}`;
    const prev = map.get(key);
    const base = {
      date: e.date, name: e.name, kind: e.kind || 'festival', sources: [e.source || 'builtin'], approx: !!e.approx,
      key: e.key || f?.key || null, label: f?.label || e.name,
      travel: e.travel ?? f?.travel ?? 0, lead: e.lead ?? f?.lead ?? 0, theme: e.theme || f?.theme || null,
      greet: e.greet || f?.greet || null, greetOff: !!(e.greetOff || f?.greetOff), minor: !!(e.minor || f?.minor), mhOff: !!f?.mh || e.kind === 'holiday',
      hidden: !!e.hidden, id: e.id || null, custom: e.source === 'custom',
    };
    if (!prev) { map.set(key, base); continue; }
    const better = (SRC_RANK[e.source] || 0) > (SRC_RANK[prev.sources[0]] || 0);
    map.set(key, {
      ...prev, ...(better ? { name: e.name } : {}),
      kind: (KIND_RANK[base.kind] || 0) > (KIND_RANK[prev.kind] || 0) ? base.kind : prev.kind,
      sources: [...new Set([...prev.sources, ...base.sources])],
      approx: prev.approx && base.approx, mhOff: prev.mhOff || base.mhOff,
      hidden: prev.hidden || base.hidden, custom: prev.custom || base.custom, id: prev.id || base.id,
      greet: prev.greet || base.greet, theme: prev.theme || base.theme,
      travel: Math.max(prev.travel, base.travel), lead: Math.max(prev.lead, base.lead),
    });
  }
  // A festival with the same key on consecutive days (e.g. Diwali spread over days): keep all, planner picks one.
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date) || (KIND_RANK[b.kind] || 0) - (KIND_RANK[a.kind] || 0));
}

/* ---------- seasons and destinations (Pune) ---------- */
export const SEASONS = [
  { key: 'monsoon', from: '06-10', to: '09-30', label: 'Monsoon', dest: ['Lonavala', 'Tamhini Ghat', 'Malshej Ghat', 'Bhandardara', 'Mulshi', 'Konkan'] },
  { key: 'postmonsoon', from: '10-01', to: '10-31', label: 'Post-monsoon', dest: ['Mahabaleshwar', 'Kaas Plateau', 'Lonavala', 'Alibaug'] },
  { key: 'winter', from: '11-01', to: '02-28', label: 'Winter', dest: ['Mahabaleshwar', 'Goa', 'Alibaug', 'Konkan beaches', 'Nashik vineyards', 'Panchgani'] },
  { key: 'summer', from: '03-01', to: '06-09', label: 'Summer', dest: ['Mahabaleshwar', 'Panchgani', 'Lonavala', 'Bhandardara', 'Goa'] },
];
export function seasonOf(ymd) {
  const md = ymd.slice(5);
  for (const s of SEASONS) {
    if (s.from <= s.to ? (md >= s.from && md <= s.to) : (md >= s.from || md <= s.to)) return s;
  }
  return SEASONS[0];
}
// School and college vacations in Maharashtra (approximate), good for family trips.
export function vacationOf(ymd) {
  const md = ymd.slice(5);
  if (md >= '04-20' && md <= '06-10') return 'Summer vacation';
  if (md >= '12-24' || md <= '01-01') return 'Christmas holidays';
  return null;
}

/* ---------- long weekends ---------- */
// Runs of 3+ days off (weekends + Maharashtra office holidays). Also flags "take 1 day off" bridges.
export function longWeekends(events, fromYmd, toYmd) {
  const off = new Map();
  for (const e of events) if (!e.hidden && (e.mhOff || e.kind === 'holiday')) { if (!off.has(e.date)) off.set(e.date, []); off.get(e.date).push(e.label || e.name); }
  const isOff = d => off.has(d) || [0, 6].includes(dow(d));
  const start = addDays(fromYmd, -6), end = addDays(toYmd, 6);
  const out = []; let d = start;
  while (d <= end) {
    if (isOff(d)) {
      let s = d, e = d; while (isOff(addDays(e, 1))) e = addDays(e, 1);
      const len = (dateOf(e) - dateOf(s)) / 864e5 + 1;
      const names = []; for (let x = s; x <= e; x = addDays(x, 1)) if (off.has(x)) names.push(...off.get(x));
      if (len >= 3 && names.length) out.push({ start: s, end: e, days: len, names: [...new Set(names)], bridge: false });
      // bridge: a single working day between a holiday and a weekend (or another holiday)
      const nxt = addDays(e, 1), after = addDays(e, 2);
      if (!isOff(nxt) && isOff(after) && names.length + (off.has(after) ? 1 : 0) > 0) {
        let e2 = after; while (isOff(addDays(e2, 1))) e2 = addDays(e2, 1);
        const len2 = (dateOf(e2) - dateOf(s)) / 864e5 + 1;
        const names2 = [...names]; for (let x = after; x <= e2; x = addDays(x, 1)) if (off.has(x)) names2.push(...off.get(x));
        if (len2 >= 4 && names2.length) out.push({ start: s, end: e2, days: len2, names: [...new Set(names2)], bridge: true, leaveDay: nxt });
      }
      d = addDays(e, 1);
    } else d = addDays(d, 1);
  }
  const seen = new Set();
  return out.filter(w => w.end >= fromYmd && w.start <= toYmd).filter(w => { const k = w.start + w.end; if (seen.has(k)) return false; seen.add(k); return true; });
}
