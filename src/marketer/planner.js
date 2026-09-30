// DriveKaro AI Marketer: builds a month of posts from festivals, long weekends, seasons, cars and offers.
import { addDays, dow, seasonOf, dateOf } from './calendar.js';
import { buildCopy, pick } from './copy.js';

const TEMPLATE = { festival: 'festival', marketing: 'festival', prefest: 'trip', longweekend: 'trip', destination: 'trip', spotlight: 'spotlight', whyus: 'whyus', tip: 'tip', review: 'review', offer: 'offer' };
export const TYPE_LABEL = { festival: 'Festival greeting', marketing: 'Special day', prefest: 'Festival trip push', longweekend: 'Long weekend', destination: 'Trip idea', spotlight: 'Car spotlight', whyus: 'Why DriveKaro', tip: 'Drive tip', review: 'Customer review', offer: 'Offer' };

function daysOfMonth(month) {
  const [y, m] = month.split('-').map(Number); const n = new Date(y, m, 0).getDate();
  return Array.from({ length: n }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
}

/**
 * settings: { igPerWeek (default 4), gbpPerWeek (2), stories (true), postTime ('10:00'), langs, destinations[], offer{title,details,from,until,terms} }
 * taken: Set of dates that already have kept (approved/posted) posts.
 */
export function planMonth({ month, events, windows, cars, settings = {}, reviews = [], brand = {}, taken = new Set() }) {
  const days = daysOfMonth(month), inMonth = d => d.startsWith(month);
  const igPerWeek = Number(settings.igPerWeek) || 4, gbpPerWeek = Number(settings.gbpPerWeek) || 2;
  const activeCars = (cars || []).filter(c => c && c.name && c.promote !== false);
  const minRate = Math.min(...activeCars.map(c => Number(c.rate) || Infinity)); const from = Number.isFinite(minRate) ? minRate : 0;
  const cands = [];
  const add = (date, type, prio, extra = {}) => { if (inMonth(date)) cands.push({ date, type, prio, ...extra }); };

  // 1. Festivals and holidays on the day, and trip pushes before travel festivals.
  const seenFest = new Set();
  for (const e of events) {
    if (e.hidden) continue;
    const isFest = !!e.greet && !e.greetOff && (e.kind !== 'observance' || e.travel >= 1 || e.custom);
    if (isFest) {
      const dupe = e.key && seenFest.has(e.key + e.date.slice(0, 7));
      if (e.key) seenFest.add(e.key + e.date.slice(0, 7));
      if (!dupe) add(e.date, e.kind === 'marketing' ? 'marketing' : 'festival', e.minor && !e.custom ? 55 : (e.travel >= 2 || e.mhOff ? 100 : 72) + (e.custom ? 5 : 0), { event: e, minor: e.minor && !e.custom });
    }
    if (e.travel >= 2 && e.lead > 0) add(addDays(e.date, -e.lead), 'prefest', 84, { event: e });
  }
  // 2. Long weekends: a promo about 6 days before and a reminder 2 days before.
  for (const w of windows || []) {
    const season = seasonOf(w.start);
    const dest = pick([...(settings.destinations || []), ...season.dest], w.start);
    add(addDays(w.start, -6), 'longweekend', 90, { window: w, destination: dest });
    add(addDays(w.start, -2), 'longweekend', 76, { window: w, destination: pick(season.dest, w.end), reminder: true });
  }
  // 3. Offer (if set) at its start and midway.
  const o = settings.offer;
  if (o && o.title && o.from) { add(o.from, 'offer', 88); if (o.until) { const mid = addDays(o.from, Math.floor((dateOf(o.until) - dateOf(o.from)) / 864e5 / 2)); if (mid !== o.from) add(mid, 'offer', 66); } }

  // Resolve: one feed post per day (highest priority); strong ones that lose try the next free day.
  const byDay = new Map();
  for (const c of cands.sort((a, b) => b.prio - a.prio)) {
    const free = d => inMonth(d) && !byDay.has(d) && !taken.has(d);
    // Minor festival days (Dhanteras, Padwa, Bhau Beej…) only when no other festival post is within 2 days.
    if (c.minor && [-2, -1, 1, 2].some(k => { const x = byDay.get(addDays(c.date, k)); return x && (x.type === 'festival' || x.type === 'marketing'); })) continue;
    let d = c.date;
    if (!free(d)) {
      if (c.prio < 70 || c.type === 'festival' || c.type === 'marketing') continue;
      d = [addDays(c.date, -1), addDays(c.date, 1)].find(free); if (!d) continue;
    }
    byDay.set(d, { ...c, date: d });
  }

  // 4. Fill the rest of each week up to igPerWeek with rotating everyday posts on preferred days.
  const PREF = [1, 3, 5, 6, 0, 2, 4]; // Mon, Wed, Fri, Sat, then others
  const rota = ['spotlight', 'destination', 'whyus', 'spotlight', 'tip', reviews.length ? 'review' : 'destination'];
  let r = 0, carIdx = 0, revIdx = 0;
  const weeks = []; for (const d of days) { const k = weekKey(d); if (!weeks.includes(k)) weeks.push(k); }
  for (const wk of weeks) {
    const wdays = days.filter(d => weekKey(d) === wk);
    let count = wdays.filter(d => byDay.has(d) || taken.has(d)).length;
    const target = Math.round(igPerWeek * wdays.length / 7);
    for (const want of PREF) {
      if (count >= target) break;
      const d = wdays.find(x => dow(x) === want); if (!d || byDay.has(d) || taken.has(d)) continue;
      // keep a gap day between everyday posts when possible
      if ((byDay.has(addDays(d, -1)) || byDay.has(addDays(d, 1))) && count + 1 < target - 1) continue;
      let type = rota[r++ % rota.length];
      if (type === 'spotlight' && !activeCars.length) type = 'whyus';
      const extra = {};
      if (type === 'spotlight') extra.car = activeCars[carIdx++ % activeCars.length];
      if (type === 'destination') { const s = seasonOf(d); extra.destination = pick([...(settings.destinations || []), ...s.dest], d + r); }
      if (type === 'review') extra.review = reviews[revIdx++ % reviews.length];
      byDay.set(d, { date: d, type, prio: 30, ...extra });
      count++;
    }
  }

  // 5. Build posts: platforms, template, copy.
  let gbpCount = new Map();
  const posts = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date)).map(c => {
    const season = seasonOf(c.date);
    const car = c.car || (activeCars.length ? activeCars[Math.abs(hash(c.date)) % activeCars.length] : null);
    const wk = weekKey(c.date); const g = gbpCount.get(wk) || 0;
    const gbpWorthy = ['festival', 'prefest', 'longweekend', 'offer'].includes(c.type) || (c.type === 'spotlight' && g < gbpPerWeek) || (c.type === 'destination' && g < gbpPerWeek - 1);
    const gbp = gbpWorthy && (c.type !== 'festival' || (c.event && (c.event.mhOff || c.event.travel >= 1))) && g < gbpPerWeek + 2;
    if (gbp) gbpCount.set(wk, g + 1);
    const story = settings.stories !== false && ['festival', 'prefest', 'longweekend', 'offer', 'marketing'].includes(c.type);
    const post = {
      id: `mk-${c.date}-${c.type}-${Math.random().toString(36).slice(2, 6)}`,
      date: c.date, time: c.type === 'festival' || c.type === 'marketing' ? (settings.festTime || '08:30') : (settings.postTime || '10:00'),
      type: c.type, template: TEMPLATE[c.type], status: 'draft',
      platforms: { ig: true, story, gbp },
      car_id: (c.type === 'spotlight' || c.type === 'offer' || c.type === 'longweekend' || c.type === 'prefest' || c.type === 'festival') && car ? car.id : null,
      event: c.event ? { name: c.event.name, label: c.event.label, key: c.event.key, theme: c.event.theme, date: c.event.date, travel: c.event.travel, greet: c.event.greet } : null,
      window: c.window || null, destination: c.destination || null, review: c.review || null,
      reminder: !!c.reminder,
    };
    const copy = buildCopy(post, { brand, car: car && post.car_id ? car : c.car, event: c.event, window: c.window, destination: c.destination, minRate: from, offer: settings.offer, review: c.review, season });
    return { ...post, ...copy };
  });
  return posts;
}
function hash(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return h; }
// Week key: the Monday of the week.
function weekKey(d) { const x = dateOf(d); const k = (x.getDay() + 6) % 7; x.setDate(x.getDate() - k); return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`; }
