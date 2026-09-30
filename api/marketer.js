// DriveKaro AI Marketer server.
// POST /api/marketer { action, ... } (owner sign-in token required)
//   status            which connections are set up
//   calendar          live holidays and festivals: Google's public India calendar (+ Calendarific if CALENDARIFIC_API_KEY), cached 7 days
//   caption_ai        rewrite a caption with Claude (only if ANTHROPIC_API_KEY is set)
//   publish           post one saved post now to Instagram feed / story / Google Business Profile
//   ig_check          check the Instagram token and account
//   gbp_connect       save the Google Business Profile connection (Google sign-in code)
//   gbp_locations     list the business locations on that Google account
//   gbp_set_location  choose the location to post to
//   gbp_disconnect
// GET  /api/marketer with "Authorization: Bearer CRON_SECRET" (Vercel Cron): autopilot posts today's approved posts.
import { HttpError, admin, body, requireOwner, getDoc, saveDoc, fail } from './_lib/esign.js';
import { exchangeCode, googleCreds } from './_lib/staff.js';
import { parseICS, parseCalendarific, addDays } from '../src/marketer/calendar.js';

export const config = { maxDuration: 60 };

const GOOGLE_ICS = [
  'https://calendar.google.com/calendar/ical/en.indian%23holiday%40group.v.calendar.google.com/public/basic.ics',
  'https://calendar.google.com/calendar/ical/en.indian.official%23holiday%40group.v.calendar.google.com/public/basic.ics',
];
const CACHE_DAYS = 7;
const istNow = () => new Date(Date.now() + 5.5 * 36e5);
const istYmd = () => istNow().toISOString().slice(0, 10);

/* ---------- holidays ---------- */
async function fetchText(url, ms = 12000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': 'DriveKaro-Marketer/1.0' } }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return await r.text(); }
  finally { clearTimeout(t); }
}
async function googleHolidays() {
  let lastErr = null;
  for (const url of GOOGLE_ICS) {
    try {
      const text = await fetchText(url);
      if (!/BEGIN:VCALENDAR/.test(text)) throw new Error('not a calendar file');
      const list = parseICS(text); if (list.length) return list;
      throw new Error('calendar was empty');
    } catch (e) { lastErr = e; }
  }
  throw new Error('Google holiday calendar: ' + (lastErr?.message || 'failed'));
}
async function calendarificHolidays(year) {
  const key = process.env.CALENDARIFIC_API_KEY; if (!key) return null;
  const q = new URLSearchParams({ api_key: key, country: 'IN', year: String(year), location: 'in-mh' });
  const j = JSON.parse(await fetchText('https://calendarific.com/api/v2/holidays?' + q));
  if (j?.meta?.code && j.meta.code !== 200) throw new Error('Calendarific: ' + (j.meta.error_detail || j.meta.code));
  return parseCalendarific(j);
}
export async function calendar(sb, years, force) {
  const out = {}; let google = null, googleErr = null;
  for (const year of years) {
    const id = `cal-${year}`; const cached = await getDoc(sb, 'mk_cache', id);
    const fresh = cached && Date.now() - Date.parse(cached.fetched_at || 0) < CACHE_DAYS * 864e5;
    if (fresh && !force) { out[year] = cached; continue; }
    const doc = { year, fetched_at: new Date().toISOString(), google: cached?.google || [], calendarific: cached?.calendarific || [], errors: {} };
    if (!google && !googleErr) { try { google = await googleHolidays(); } catch (e) { googleErr = e.message; } }
    if (google) doc.google = google.filter(e => e.date.startsWith(String(year)));
    else doc.errors.google = googleErr;
    try { const c = await calendarificHolidays(year); if (c) doc.calendarific = c; } catch (e) { doc.errors.calendarific = e.message; }
    doc.counts = { google: doc.google.length, calendarific: doc.calendarific.length };
    // Only keep the new fetch time if something came back, so a failed fetch retries next time.
    if (!doc.google.length && !doc.calendarific.length) doc.fetched_at = cached?.fetched_at || null;
    await saveDoc(sb, 'mk_cache', id, doc);
    out[year] = doc;
  }
  return out;
}

/* ---------- Instagram (Meta Graph API) ---------- */
function igCfg() {
  const id = process.env.IG_USER_ID, token = process.env.META_ACCESS_TOKEN;
  const host = process.env.IG_GRAPH_HOST || 'graph.facebook.com', ver = process.env.META_GRAPH_VERSION || 'v23.0';
  return { ok: !!(id && token), id, token, base: `https://${host}/${ver}` };
}
async function graph(url, params, method = 'POST') {
  const c = igCfg();
  const q = new URLSearchParams({ ...params, access_token: c.token });
  const r = method === 'GET' ? await fetch(`${url}?${q}`) : await fetch(url, { method, body: q });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new HttpError(502, 'Instagram: ' + (j.error?.error_user_msg || j.error?.message || `HTTP ${r.status}`));
  return j;
}
async function igPublish(image_url, caption, story) {
  const c = igCfg(); if (!c.ok) throw new HttpError(409, 'Instagram is not connected. Add IG_USER_ID and META_ACCESS_TOKEN in Vercel.');
  const created = await graph(`${c.base}/${c.id}/media`, story ? { image_url, media_type: 'STORIES' } : { image_url, caption });
  for (let i = 0; i < 12; i++) { // wait until Instagram has fetched the image
    const s = await graph(`${c.base}/${created.id}`, { fields: 'status_code' }, 'GET').catch(() => ({}));
    if (!s.status_code || s.status_code === 'FINISHED') break;
    if (s.status_code === 'ERROR' || s.status_code === 'EXPIRED') throw new HttpError(502, 'Instagram could not process the image.');
    await new Promise(r => setTimeout(r, 2000));
  }
  const pub = await graph(`${c.base}/${c.id}/media_publish`, { creation_id: created.id });
  const info = await graph(`${c.base}/${pub.id}`, { fields: 'permalink' }, 'GET').catch(() => ({}));
  return { id: pub.id, link: info.permalink || null };
}

/* ---------- Google Business Profile ---------- */
async function gbpToken(sb) {
  const meta = (await getDoc(sb, 'secrets', 'gbp')) || {};
  if (!meta.refresh_token) throw new HttpError(409, 'Google Business Profile is not connected. Connect it in Brand & connections.');
  const c = googleCreds();
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: c.id, client_secret: c.secret, refresh_token: meta.refresh_token, grant_type: 'refresh_token' }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new HttpError(502, 'Google Business Profile connection expired. Connect it again.');
  return { token: j.access_token, meta };
}
async function gcall(token, url, opts = {}) {
  const r = await fetch(url, { ...opts, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = j.error?.message || `HTTP ${r.status}`;
    throw new HttpError(502, 'Google Business Profile: ' + (/quota|has not been used|disabled/i.test(msg) ? msg + ' (Your Google Cloud project needs Business Profile API access. See the setup guide.)' : msg));
  }
  return j;
}
async function gbpPublish(sb, post) {
  const { token, meta } = await gbpToken(sb);
  if (!meta.location) throw new HttpError(409, 'Choose your business location in Brand & connections.');
  const summary = String(post.gbp_text || post.caption || '').slice(0, 1450);
  const payload = { languageCode: 'en-IN', summary, topicType: 'STANDARD', callToAction: { actionType: 'CALL' } };
  const img = post.images?.square || post.images?.post;
  if (img) payload.media = [{ mediaFormat: 'PHOTO', sourceUrl: img }];
  const j = await gcall(token, `https://mybusiness.googleapis.com/v4/${meta.location}/localPosts`, { method: 'POST', body: JSON.stringify(payload) });
  return { id: j.name || null, link: j.searchUrl || null };
}

/* ---------- publishing one post ---------- */
const httpsUrl = u => typeof u === 'string' && /^https:\/\//.test(u);
export function igCaption(p) {
  // The caption normally already ends with its hashtags; add them only if it has none.
  let c = String(p.caption || '').trim();
  const tags = (p.hashtags || []).filter(t => /^#\S+$/.test(t)).slice(0, 25);
  if (tags.length && !/(^|\s)#\w/.test(c)) c += '\n\n' + tags.join(' ');
  return c.slice(0, 2200);
}
export async function publishPost(sb, post, only) {
  const want = ['ig', 'story', 'gbp'].filter(k => post.platforms?.[k] && (!only || only.includes(k)));
  if (!want.length) throw new HttpError(400, 'No platform is ticked for this post.');
  const published = { ...(post.published || {}) }, errors = {};
  for (const k of want) {
    if (published[k]?.at) continue; // already done
    try {
      if (k === 'ig') { if (!httpsUrl(post.images?.post)) throw new Error('Approve the post first so its image is saved.'); published.ig = { ...(await igPublish(post.images.post, igCaption(post), false)), at: new Date().toISOString() }; }
      if (k === 'story') { const u = post.images?.story || post.images?.post; if (!httpsUrl(u)) throw new Error('Approve the post first so its image is saved.'); published.story = { ...(await igPublish(u, '', true)), at: new Date().toISOString() }; }
      if (k === 'gbp') published.gbp = { ...(await gbpPublish(sb, post)), at: new Date().toISOString() };
    } catch (e) { errors[k] = e.message; }
  }
  const allDone = want.every(k => published[k]?.at);
  const next = { ...post, published, errors, status: allDone ? 'posted' : Object.keys(published).length ? 'partial' : 'failed', last_try: new Date().toISOString() };
  await saveDoc(sb, 'mk_posts', post.id, next);
  return next;
}

/* ---------- AI captions (optional) ---------- */
async function captionAI(post, brand, instruction) {
  const key = process.env.ANTHROPIC_API_KEY; if (!key) throw new HttpError(409, 'AI captions are off. Add ANTHROPIC_API_KEY in Vercel to turn them on.');
  const langs = (brand.langs || ['en']).join(', ');
  const prompt = `You write social media posts for DriveKaro, a self-drive car rental in Pune, India. Phone/WhatsApp: ${brand.phone || ''}. Website: ${brand.website || 'drivekaro.in'}.
Rewrite this ${post.type} post. Keep all facts (dates, prices, car names, places) exactly as given; do not invent offers, prices or discounts.
Languages allowed: ${langs} (English first; add a short line in Marathi or Hindi only if listed). Warm, local, not salesy. Emojis sparingly.
${instruction ? 'Owner\'s note: ' + String(instruction).slice(0, 300) + '\n' : ''}
Current headline: ${post.headline || ''}
Current caption:
${post.caption || ''}
Current Google Business text: ${post.gbp_text || ''}

Reply with JSON only: {"caption": "Instagram caption without hashtags, max 900 characters, end with the booking line", "gbp_text": "Google Business Profile post, max 600 characters, no hashtags", "hashtags": ["#...", up to 12, include #DriveKaro and #SelfDriveCarPune]}`;
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: process.env.MARKETER_AI_MODEL || 'claude-haiku-4-5-20251001', max_tokens: 1200, messages: [{ role: 'user', content: prompt }] }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new HttpError(502, 'AI: ' + (j.error?.message || `HTTP ${r.status}`));
  const text = (j.content || []).map(c => c.text || '').join('');
  const m = text.match(/\{[\s\S]*\}/); if (!m) throw new HttpError(502, 'AI reply was not readable. Try again.');
  let o; try { o = JSON.parse(m[0]); } catch { throw new HttpError(502, 'AI reply was not readable. Try again.'); }
  return { caption: String(o.caption || '').slice(0, 2000), gbp_text: String(o.gbp_text || '').slice(0, 1450), hashtags: (o.hashtags || []).filter(t => /^#\S+$/.test(t)).slice(0, 15) };
}

/* ---------- autopilot (cron) ---------- */
export async function autopilot(sb) {
  const brand = (await getDoc(sb, 'mk_settings', 'brand')) || {};
  if (!brand.autopilot) return { skipped: 'Autopilot is off.' };
  const { data, error } = await sb.from('desk_docs').select('id, data').eq('collection', 'mk_posts').range(0, 9999);
  if (error) throw new HttpError(500, 'Database error: ' + error.message);
  const today = istYmd(), yday = addDays(today, -1);
  const due = (data || []).map(r => ({ id: r.id, ...r.data })).filter(p => (p.status === 'approved' || p.status === 'partial') && p.date >= yday && p.date <= today);
  const results = [];
  for (const p of due) { try { const n = await publishPost(sb, p); results.push({ id: p.id, status: n.status, errors: n.errors }); } catch (e) { results.push({ id: p.id, status: 'failed', errors: { all: e.message } }); } }
  const bad = results.filter(r => r.status !== 'posted');
  if (bad.length && process.env.RESEND_API_KEY) {
    const settings = (await getDoc(sb, 'settings', 'business')) || {};
    const to = String(settings.summary_email || process.env.SUMMARY_EMAIL || '').trim();
    if (to) await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.RESEND_FROM || 'DriveKaro Desk <onboarding@resend.dev>', to: to.split(/[,;\s]+/).filter(Boolean), subject: `DriveKaro Marketer: ${bad.length} post${bad.length > 1 ? 's' : ''} didn't go out`,
        text: bad.map(b => `${b.id}: ${Object.entries(b.errors || {}).map(([k, v]) => `${k}: ${v}`).join('; ')}`).join('\n') + '\n\nOpen drivekaro.in/marketer to retry.' }) }).catch(() => {});
  }
  return { date: today, tried: due.length, results };
}

export default async function handler(req, res) {
  try {
    const sb = admin();
    if (req.method === 'GET') {
      const auth = req.headers.authorization || '';
      if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) throw new HttpError(401, 'Not allowed.');
      return res.status(200).json(await autopilot(sb));
    }
    if (req.method !== 'POST') throw new HttpError(405, 'Use POST.');
    await requireOwner(req, sb);
    const input = body(req); const action = input.action;

    if (action === 'status') {
      const gbp = (await getDoc(sb, 'secrets', 'gbp')) || {};
      const ig = igCfg();
      return res.status(200).json({
        ig: { configured: ig.ok, host: process.env.IG_GRAPH_HOST || 'graph.facebook.com' },
        gbp: { connected: !!gbp.refresh_token, email: gbp.email || null, location: gbp.location || null, location_title: gbp.location_title || null, secret_ready: !!googleCreds().secret },
        ai: !!process.env.ANTHROPIC_API_KEY, calendarific: !!process.env.CALENDARIFIC_API_KEY, cron: !!process.env.CRON_SECRET,
      });
    }
    if (action === 'calendar') {
      const now = Number(istYmd().slice(0, 4));
      const years = [...new Set((input.years || [now, now + 1]).map(Number).filter(y => y >= 2024 && y <= 2035))].slice(0, 3);
      return res.status(200).json({ years: await calendar(sb, years, !!input.force) });
    }
    if (action === 'caption_ai') {
      const brand = (await getDoc(sb, 'mk_settings', 'brand')) || {};
      return res.status(200).json(await captionAI(input.post || {}, { ...brand, ...(input.brand || {}) }, input.instruction));
    }
    if (action === 'publish') {
      const post = await getDoc(sb, 'mk_posts', String(input.postId || ''));
      if (!post) throw new HttpError(404, 'Post not found. Save it first.');
      return res.status(200).json({ post: await publishPost(sb, { id: input.postId, ...post }, input.only) });
    }
    if (action === 'ig_check') {
      const c = igCfg(); if (!c.ok) throw new HttpError(409, 'Add IG_USER_ID and META_ACCESS_TOKEN in Vercel first.');
      const j = await graph(`${c.base}/${c.id}`, { fields: 'username,name' }, 'GET');
      return res.status(200).json({ username: j.username || null, name: j.name || null });
    }
    if (action === 'gbp_connect') {
      if (!input.code) throw new HttpError(400, 'Missing Google code.');
      const t = await exchangeCode(input.code);
      if (!t.refresh_token) throw new HttpError(400, 'Google did not return a long-term key. Remove DriveKaro from myaccount.google.com/permissions and connect again.');
      let email = null; try { const u = await (await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + t.access_token } })).json(); email = u.email || null; } catch { /* ignore */ }
      const prev = (await getDoc(sb, 'secrets', 'gbp')) || {};
      await saveDoc(sb, 'secrets', 'gbp', { ...prev, refresh_token: t.refresh_token, email, connected_at: new Date().toISOString() });
      return res.status(200).json({ connected: true, email });
    }
    if (action === 'gbp_locations') {
      const { token } = await gbpToken(sb);
      const acc = await gcall(token, 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts');
      const out = [];
      for (const a of acc.accounts || []) {
        const l = await gcall(token, `https://mybusinessbusinessinformation.googleapis.com/v1/${a.name}/locations?readMask=name,title,storefrontAddress&pageSize=100`);
        for (const x of l.locations || []) out.push({ location: `${a.name}/${x.name}`, title: x.title, address: (x.storefrontAddress?.addressLines || []).join(', ') + (x.storefrontAddress?.locality ? ', ' + x.storefrontAddress.locality : ''), account: a.accountName || a.name });
      }
      return res.status(200).json({ locations: out });
    }
    if (action === 'gbp_set_location') {
      const prev = (await getDoc(sb, 'secrets', 'gbp')) || {};
      if (!/^accounts\/[^/]+\/locations\/[^/]+$/.test(input.location || '')) throw new HttpError(400, 'Choose a location.');
      await saveDoc(sb, 'secrets', 'gbp', { ...prev, location: input.location, location_title: String(input.title || '').slice(0, 120) });
      return res.status(200).json({ ok: true });
    }
    if (action === 'gbp_disconnect') {
      await sb.from('desk_docs').delete().eq('collection', 'secrets').eq('id', 'gbp');
      return res.status(200).json({ ok: true });
    }
    throw new HttpError(400, 'Unknown action.');
  } catch (e) { fail(res, e); }
}
