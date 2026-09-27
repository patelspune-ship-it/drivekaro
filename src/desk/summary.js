// Pure helpers shared by the desk page (browser) and the daily summary email (api/cron/daily.js, Node).
// No DOM access here. Times typed in the desk are saved without a time zone ("2026-09-30T10:00"),
// so they are read as India time (IST) everywhere, whatever the server's clock zone is.

export const DAY = 864e5;
const IST_MS = 330 * 60000;
const n = v => Number(v) || 0;
const pad = x => String(x).padStart(2, '0');

export function parseLocal(s) {
  if (!s) return new Date(NaN);
  if (s instanceof Date) return s;
  const str = String(s);
  if (/[zZ]$|[+-]\d\d:\d\d$/.test(str)) return new Date(str);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return new Date(str + 'T00:00:00+05:30');
  return new Date(str + (str.length === 16 ? ':00' : '') + '+05:30');
}
// Start of the IST calendar day containing `d`, as a Date.
export function istDayStart(d = new Date()) { return new Date(Math.floor((d.getTime() + IST_MS) / DAY) * DAY - IST_MS); }
export function istYmd(d = new Date()) { const x = new Date(d.getTime() + IST_MS); return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`; }
export function fmtWhen(s) {
  const d = parseLocal(s); if (isNaN(d)) return '';
  return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
}
export function fmtTime(s) {
  const d = parseLocal(s); if (isNaN(d)) return '';
  return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true });
}
export const inr = v => '₹' + Math.round(n(v)).toLocaleString('en-IN');

function charge(b, s, k, def) { const c = b.charges || {}; if (c[k] !== undefined && c[k] !== '') return c[k]; const d = (s && s.charges) || {}; return d[k] !== undefined && d[k] !== '' ? d[k] : def; }

// Same maths as the desk's calc()/ledger(), usable without the page state.
export function money(b, s) {
  const p = parseLocal(b.pickup), d = parseLocal(b.drop);
  const hours = (isNaN(p) || isNaN(d)) ? 0 : Math.max(0, (d - p) / 36e5);
  const days = hours > 0 ? Math.max(1, Math.ceil(hours / 24 - 1e-9)) : 0;
  const rate = n(b.rate);
  const ext = b.extensions || [];
  let rental = days * rate;
  if (ext.length) {
    const bh = Math.max(0, (parseLocal(ext[0].from) - p) / 36e5);
    const baseDays = bh > 0 ? Math.max(1, Math.ceil(bh / 24 - 1e-9)) : 0;
    rental = baseDays * rate + ext.reduce((t, x) => t + n(x.amount), 0);
  }
  const delivery = b.with_delivery ? n(charge(b, s, 'delivery_charge', 0)) : 0;
  const extras = (b.extras || []).reduce((t, x) => t + n(x.amount), 0);
  const pays = b.payments || [];
  const k = kind => pays.filter(x => x.kind === kind).reduce((t, x) => t + n(x.amount), 0);
  const total = rental + delivery + extras;
  const settled = k('payment') + k('deposit_used');
  const depCash = (b.deposit_type || 'cash') === 'cash' ? n(b.deposit) : 0;
  const depIn = k('deposit_in');
  const depHeld = depIn - k('deposit_used') - k('deposit_refund');
  const balance = total - settled;
  return { days, hours, rental, total, settled, balance, depCash, depIn, depHeld, depositDue: Math.max(0, depCash - depIn), km: days * n(charge(b, s, 'km_per_day', 0)) };
}
// Amount the customer should pay now: rental balance, plus the deposit before handover.
export function dueNow(b, s) {
  const m = money(b, s);
  const beforeHandover = ['draft', 'ready', 'sent', 'signed'].includes(b.status);
  return Math.max(0, m.balance) + (beforeHandover ? m.depositDue : 0);
}

/* UPI */
export function upiLink({ upi, name, amount, note }) {
  const q = [['pa', upi], ['pn', name || ''], ['am', amount ? (Math.round(n(amount) * 100) / 100).toFixed(2) : ''], ['cu', 'INR'], ['tn', note || '']]
    .filter(([, v]) => v !== '').map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%40/g, '@')}`).join('&');
  return `upi://pay?${q}`;
}
export function payUrl(origin, bookingId, amount) { return `${origin}/pay?b=${encodeURIComponent(bookingId)}&a=${Math.round(n(amount))}`; }

/* odometer and service */
export function carOdometer(car, bookings) {
  const reads = [];
  for (const b of bookings) {
    if (b.car_id !== car.id || b.status === 'cancelled') continue;
    if (n(b.odo_return) > 0) reads.push({ km: n(b.odo_return), at: parseLocal(b.return_at || b.drop), src: 'return' });
    if (n(b.odo) > 0 && ['handed', 'returned'].includes(b.status)) reads.push({ km: n(b.odo), at: parseLocal(b.pickup), src: 'pickup' });
  }
  if (n(car.odo_manual) > 0) reads.push({ km: n(car.odo_manual), at: parseLocal(car.odo_manual_at || '2000-01-01'), src: 'manual' });
  if (n(car.service_km) > 0) reads.push({ km: n(car.service_km), at: parseLocal(car.service_date || '2000-01-01'), src: 'service' });
  const valid = reads.filter(r => !isNaN(r.at));
  if (!valid.length) return null;
  // Latest reading by date; if two are close in time, trust the higher number.
  valid.sort((a, b) => (b.at - a.at) || (b.km - a.km));
  return valid[0];
}
export function serviceStatus(car, bookings) {
  const interval = n(car.service_interval) || 10000;
  const warn = Math.min(1000, Math.round(interval * 0.1));
  const cur = carOdometer(car, bookings);
  if (!(n(car.service_km) > 0) || !cur) return { state: 'unknown', interval, current: cur?.km || null };
  const dueAt = n(car.service_km) + interval, left = dueAt - cur.km;
  return { state: left <= 0 ? 'due' : left <= warn ? 'soon' : 'ok', interval, dueAt, current: cur.km, currentAt: cur.at, left };
}
export function serviceLabel(st) {
  if (st.state === 'due') return `Service overdue by ${Math.abs(st.left).toLocaleString('en-IN')} km`;
  if (st.state === 'soon') return `Service due in ${st.left.toLocaleString('en-IN')} km`;
  if (st.state === 'ok') return `Next service at ${st.dueAt.toLocaleString('en-IN')} km (${st.left.toLocaleString('en-IN')} km left)`;
  return 'Add last service km in the car profile';
}
export function paperAlerts(car, now = new Date(), within = 30) {
  const out = [];
  for (const [k, label] of [['insurance_till', 'Insurance'], ['puc_till', 'PUC']]) {
    if (!car[k]) continue;
    const d = parseLocal(car[k] + 'T23:59'); const days = Math.ceil((d - now) / DAY);
    if (days < 0) out.push({ label: `${label} expired`, bad: true });
    else if (days <= within) out.push({ label: `${label} expires in ${days} day${days === 1 ? '' : 's'}`, bad: days <= 7 });
  }
  return out;
}

/* the day's summary */
const OPEN = ['draft', 'ready', 'sent', 'signed'];
export function daySummary({ bookings, fleet, settings, now = new Date() }) {
  const t0 = istDayStart(now), t1 = new Date(t0.getTime() + DAY), t2 = new Date(t0.getTime() + 2 * DAY);
  const live = bookings.filter(b => b.status !== 'cancelled' && !b.example);
  const at = (b, k) => parseLocal(b[k]);
  const byPick = (a, b) => at(a, 'pickup') - at(b, 'pickup');
  const pickupsToday = live.filter(b => OPEN.includes(b.status) && at(b, 'pickup') >= t0 && at(b, 'pickup') < t1).sort(byPick);
  const pickupsTomorrow = live.filter(b => OPEN.includes(b.status) && at(b, 'pickup') >= t1 && at(b, 'pickup') < t2).sort(byPick);
  const missedPickups = live.filter(b => OPEN.includes(b.status) && at(b, 'pickup') < t0 && at(b, 'drop') > now).sort(byPick);
  const out = live.filter(b => b.status === 'handed');
  const overdue = out.filter(b => at(b, 'drop') < now).sort((a, b) => at(a, 'drop') - at(b, 'drop'));
  const returnsToday = out.filter(b => at(b, 'drop') >= now && at(b, 'drop') < t1).sort((a, b) => at(a, 'drop') - at(b, 'drop'));
  const returnsTomorrow = out.filter(b => at(b, 'drop') >= t1 && at(b, 'drop') < t2);
  const toCollect = [];
  for (const b of live) {
    const m = money(b, settings);
    if (['handed', 'returned'].includes(b.status) && m.balance > 0) toCollect.push({ b, amount: m.balance, why: 'balance due' });
    else if (OPEN.includes(b.status) && b.status !== 'draft' && at(b, 'pickup') < t2 && dueNow(b, settings) > 0) toCollect.push({ b, amount: dueNow(b, settings), why: 'before handover' });
    if (b.status === 'returned' && m.depHeld > 0) toCollect.push({ b, amount: -m.depHeld, why: 'deposit to settle' });
  }
  const cars = fleet.filter(c => c.active !== false && !c.example);
  const papers = []; const service = [];
  for (const c of cars) {
    paperAlerts(c, now).forEach(a => papers.push({ car: c, ...a }));
    const st = serviceStatus(c, bookings);
    if (st.state === 'due' || st.state === 'soon') service.push({ car: c, st, label: serviceLabel(st) });
  }
  const weekAgo = new Date(now.getTime() - 7 * DAY);
  const reviews = live.filter(b => b.status === 'returned' && !(b.reminders || {}).review && parseLocal(b.returned_at || b.return_at || b.drop) >= weekAgo);
  const collectTotal = toCollect.filter(x => x.amount > 0).reduce((t, x) => t + x.amount, 0);
  return { date: istYmd(now), now, pickupsToday, pickupsTomorrow, missedPickups, overdue, returnsToday, returnsTomorrow, out, toCollect, collectTotal, papers, service, reviews };
}

function carName(b, fleet) { const c = fleet.find(x => x.id === b.car_id) || b.car_snapshot || {}; return `${c.make_model || ''}${c.plate ? ` (${c.plate})` : ''}`.trim(); }
const dayTitle = d => parseLocal(d).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long' });

// Plain text (for WhatsApp to yourself).
export function summaryText(S, { fleet, settings }) {
  const L = [`*DriveKaro · ${dayTitle(S.date)}*`];
  const sec = (title, rows) => { if (rows.length) { L.push('', `*${title}*`, ...rows); } };
  sec(`Pickups today (${S.pickupsToday.length})`, S.pickupsToday.map(b => `• ${fmtTime(b.pickup)} ${b.name} · ${carName(b, fleet)}${b.status !== 'signed' ? ' · agreement not signed' : ''}`));
  sec('Pickup missed / not marked handed', S.missedPickups.map(b => `• ${b.name} · ${carName(b, fleet)} · was ${fmtWhen(b.pickup)}`));
  sec(`Overdue returns (${S.overdue.length})`, S.overdue.map(b => `• ${b.name} · ${carName(b, fleet)} · due ${fmtWhen(b.drop)}`));
  sec(`Returns today (${S.returnsToday.length})`, S.returnsToday.map(b => `• ${fmtTime(b.drop)} ${b.name} · ${carName(b, fleet)}`));
  sec(`Pickups tomorrow (${S.pickupsTomorrow.length})`, S.pickupsTomorrow.map(b => `• ${fmtTime(b.pickup)} ${b.name} · ${carName(b, fleet)}`));
  sec(`To collect (${inr(S.collectTotal)})`, S.toCollect.map(x => `• ${x.b.name}: ${x.amount < 0 ? `refund/settle deposit ${inr(-x.amount)}` : `${inr(x.amount)} ${x.why}`}`));
  sec('Papers', S.papers.map(p => `• ${p.car.plate}: ${p.label}`));
  sec('Service', S.service.map(x => `• ${x.car.plate}: ${x.label}`));
  sec('Ask for a Google review', S.reviews.map(b => `• ${b.name}`));
  if (L.length === 1) L.push('', 'Nothing scheduled today.');
  L.push('', `Cars out now: ${S.out.length}`);
  return L.join('\n');
}

const h = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Email HTML (inline styles only, for mail apps).
export function summaryHTML(S, { fleet, settings, origin }) {
  const box = (title, rows, tone = '#1A120C') => rows.length ? `<h3 style="font:700 15px Arial,sans-serif;margin:20px 0 6px;color:${tone}">${h(title)}</h3><table style="width:100%;border-collapse:collapse;font:14px Arial,sans-serif">${rows.map(r => `<tr>${r.map((c, i) => `<td style="padding:7px 6px;border-top:1px solid #e6dccb;${i === r.length - 1 ? 'text-align:right;white-space:nowrap' : ''}">${c}</td>`).join('')}</tr>`).join('')}</table>` : '';
  const who = b => `<b>${h(b.name)}</b><br><span style="color:#6E5C4C;font-size:12.5px">${h(carName(b, fleet))}</span>`;
  const tile = (label, value, tone = '#1A120C') => `<td style="padding:10px;border:1px solid #e6dccb;border-radius:8px;background:#fffaf4;width:25%"><div style="font:11px Arial,sans-serif;color:#6E5C4C;text-transform:uppercase;letter-spacing:.06em">${label}</div><div style="font:700 20px Arial,sans-serif;color:${tone}">${value}</div></td>`;
  const body = [
    `<h2 style="font:800 20px Arial,sans-serif;margin:0">Drive<span style="color:#B5382A">Karo</span> · ${h(dayTitle(S.date))}</h2>`,
    `<table style="width:100%;border-spacing:6px;margin:12px -6px 0"><tr>${tile('Pickups today', S.pickupsToday.length)}${tile('Returns today', S.returnsToday.length)}${tile('Cars out', S.out.length)}${tile('To collect', inr(S.collectTotal), S.collectTotal ? '#B0281F' : '#2A7A4B')}</tr></table>`,
    box('Overdue returns', S.overdue.map(b => [who(b), `due ${h(fmtWhen(b.drop))}`]), '#B0281F'),
    box('Pickups today', S.pickupsToday.map(b => [who(b), `${h(fmtTime(b.pickup))}${b.status !== 'signed' ? '<br><span style="color:#9A6412;font-size:12px">agreement not signed</span>' : ''}`])),
    box('Pickup time passed, not marked handed over', S.missedPickups.map(b => [who(b), h(fmtWhen(b.pickup))]), '#9A6412'),
    box('Returns today', S.returnsToday.map(b => [who(b), h(fmtTime(b.drop))])),
    box('Pickups tomorrow', S.pickupsTomorrow.map(b => [who(b), h(fmtTime(b.pickup))])),
    box('To collect', S.toCollect.map(x => [who(x.b), x.amount < 0 ? `settle deposit ${inr(-x.amount)}` : `<b>${inr(x.amount)}</b><br><span style="color:#6E5C4C;font-size:12px">${h(x.why)}</span>`])),
    box('Papers', S.papers.map(p => [`<b>${h(p.car.plate)}</b> ${h(p.car.make_model || '')}`, `<span style="color:${p.bad ? '#B0281F' : '#9A6412'}">${h(p.label)}</span>`])),
    box('Service', S.service.map(x => [`<b>${h(x.car.plate)}</b> ${h(x.car.make_model || '')}`, `<span style="color:${x.st.state === 'due' ? '#B0281F' : '#9A6412'}">${h(x.label)}</span>`])),
    box('Ask for a Google review', S.reviews.map(b => [who(b), 'returned'])),
    `<p style="margin:24px 0 0"><a href="${h(origin)}/desk" style="display:inline-block;background:#B5382A;color:#fff;text-decoration:none;font:700 14px Arial,sans-serif;padding:10px 16px;border-radius:8px">Open the booking desk</a></p>`,
    `<p style="font:12px Arial,sans-serif;color:#6E5C4C;margin-top:18px">Sent every morning by your DriveKaro booking desk.</p>`,
  ].join('');
  return `<div style="background:#F4E8D0;padding:20px"><div style="max-width:620px;margin:0 auto;background:#fff;border-radius:12px;padding:20px;color:#1A120C">${body}</div></div>`;
}
