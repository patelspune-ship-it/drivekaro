// DriveKaro AI Marketer (drivekaro.in/marketer): 30-day post plans from live holidays and festivals,
// branded images, captions, and posting to Instagram and Google Business Profile.
// Owner-only. Data lives in desk_docs: mk_settings/brand, mk_posts, mk_photos, mk_events, mk_cache (server).
import { supabase } from '../supabaseClient.js';
import { createStore } from '../desk/store.js';
import { fallbackHolidays, marketingDays, mergeEvents, longWeekends, addDays, dateOf, ymdOf, festOf } from './calendar.js';
import { planMonth, TYPE_LABEL } from './planner.js';
import { renderPost, logos, loadImage, canvasToBlob, FORMATS, BRAND_DEFAULT } from './render.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const BUCKET = 'marketing';
const THEMES = ['brand', 'diwali', 'dussehra', 'navratri', 'ganesh', 'holi', 'gudipadwa', 'makar', 'christmas', 'newyear', 'eid', 'tricolor', 'saffron', 'blue', 'rakhi', 'valentine'];
const TEMPLATES = { festival: 'Festival greeting', trip: 'Trip / photo', spotlight: 'Car spotlight', offer: 'Offer', whyus: 'Why DriveKaro', tip: 'Drive tip', review: 'Review' };
const STATUS = { draft: 'Draft', approved: 'Approved', posted: 'Posted', partial: 'Partly posted', failed: 'Failed' };
const BRAND_DEFAULTS = { phone: '', website: 'drivekaro.in', langs: ['en', 'mr'], hashtags: '', igPerWeek: 4, gbpPerWeek: 2, stories: true, destinations: [], offer: null, reviews: [], cars_off: [], hidden: [], autopilot: false, colors: {} };

const M = {
  db: null, tab: 'plan', month: defaultMonth(), brand: { ...BRAND_DEFAULTS }, brandLoaded: false, posts: [], photos: [], custom: [], fleet: [], business: {},
  cal: {}, calState: 'idle', calErr: '', status: null, edit: null, editFormat: 'post', busy: new Set(), thumbs: new Map(), showMinor: false, locations: null, addEvent: false,
};

function defaultMonth() { const d = new Date(); if (d.getDate() > 20) d.setMonth(d.getMonth() + 1, 1); return ymdOf(d).slice(0, 7); }
const today = () => ymdOf(new Date());
const monthLabel = m => dateOf(m + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
const dayLabel = d => dateOf(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
const lastDay = m => { const [y, mm] = m.split('-').map(Number); return `${m}-${String(new Date(y, mm, 0).getDate()).padStart(2, '0')}`; };
const shiftMonth = (m, n) => { const d = dateOf(m + '-01'); d.setMonth(d.getMonth() + n, 1); return ymdOf(d).slice(0, 7); };
const B = () => ({ ...BRAND_DEFAULTS, ...M.brand, phone: M.brand.phone || M.business.support_phone || '+91 76663 98984', website: M.brand.website || M.business.website || 'drivekaro.in' });
const evKey = e => `${e.date}|${e.key || String(e.name).toLowerCase()}`;
const uid = p => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
function hash(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }

let toastT = null;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 4200); }
async function api(action, payload = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  let r; try { r = await fetch('/api/marketer', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (session?.access_token || '') }, body: JSON.stringify({ action, ...payload }) }); }
  catch { throw new Error('No connection. Check your internet and try again.'); }
  let j = {}; try { j = await r.json(); } catch { /* ignore */ }
  if (!r.ok) throw new Error(j.error || `Server error (${r.status}). Try again.`);
  return j;
}
async function save(path, data) { try { await M.db.doc(path).set(data); return true; } catch (e) { toast(e.code === 'invalid_argument' ? "You don't have permission to change this." : "Couldn't save. Check your connection."); return false; } }
async function del(path) { try { await M.db.doc(path).delete(); return true; } catch { toast("Couldn't delete. Try again."); return false; } }
async function busy(key, fn) { if (M.busy.has(key)) return; M.busy.add(key); render(); try { return await fn(); } catch (e) { toast(e.message || String(e)); } finally { M.busy.delete(key); render(); } }

/* ---------- data ---------- */
function start() {
  const db = M.db = createStore(supabase);
  const onErr = e => { $('#banner').textContent = e.code === 'invalid_argument' ? 'This account is not a desk owner.' : 'Connection problem: ' + e.message; $('#banner').hidden = false; };
  db.doc('mk_settings/brand').onSnapshot(s => { M.brand = { ...BRAND_DEFAULTS, ...(s.exists ? s.data() : {}) }; M.brandLoaded = true; M.thumbs.clear(); softRender(); }, onErr);
  db.collection('mk_posts').onSnapshot(s => { M.posts = s.docs.map(d => ({ ...d.data(), id: d.id })); softRender(); }, onErr);
  db.collection('mk_photos').onSnapshot(s => { M.photos = s.docs.map(d => ({ ...d.data(), id: d.id })).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))); softRender(); }, onErr);
  db.collection('mk_events').onSnapshot(s => { M.custom = s.docs.map(d => ({ ...d.data(), id: d.id })); softRender(); }, onErr);
  db.collection('fleet').onSnapshot(s => { M.fleet = s.docs.map(d => ({ ...d.data(), id: d.id })); softRender(); }, onErr);
  db.doc('settings/business').onSnapshot(s => { M.business = s.exists ? s.data() : {}; softRender(); }, onErr);
  loadCalendar(false);
  api('status').then(s => { M.status = s; softRender(); }).catch(e => { M.status = { error: e.message }; softRender(); });
  render();
}
async function loadCalendar(force) {
  const y = Number(M.month.slice(0, 4)); const years = [y, y + 1];
  if (!force && years.every(x => M.cal[x])) return;
  M.calState = 'loading'; softRender();
  try { const r = await api('calendar', { years, force }); Object.assign(M.cal, r.years); M.calState = 'ok'; M.calErr = ''; }
  catch (e) { M.calState = 'error'; M.calErr = e.message; }
  softRender();
}
// All events for the given years: live sources, built-in fallback when live has no holidays, special days, and your own.
function eventsFor(years) {
  const hidden = new Set(M.brand.hidden || []); const lists = [];
  for (const y of years) {
    const c = M.cal[y] || {}; const live = [...(c.google || []), ...(c.calendarific || [])];
    // Built-in Maharashtra holidays fill gaps: used when live feeds are down, and for state holidays the
    // national feed misses. Skipped when a live source already has the same festival within 3 days.
    const near = (a, b) => Math.abs(dateOf(a) - dateOf(b)) <= 3 * 864e5;
    const liveKeys = live.map(e => ({ date: e.date, key: festOf(e.name)?.key || e.name.toLowerCase() }));
    const fill = fallbackHolidays(y).filter(f => { const k = festOf(f.name)?.key || f.name.toLowerCase(); return !liveKeys.some(l => l.key === k && near(l.date, f.date)); });
    lists.push(live, fill, marketingDays(y));
  }
  lists.push(M.custom.map(e => ({ ...e, source: 'custom' })));
  return mergeEvents(...lists).map(e => ({ ...e, hidden: e.hidden || hidden.has(evKey(e)) }));
}
function cars() {
  const off = new Set(M.brand.cars_off || []);
  return M.fleet.filter(c => c.active !== false && c.make_model).map(c => ({ id: c.id, name: c.make_model, rate: c.rate, fuel: c.fuel, transmission: c.transmission, seats: c.seats, plate: c.plate, promote: !off.has(c.id) }));
}
function reviews() { return (M.brand.reviews || []).filter(r => r && r.text); }
function monthPosts(m = M.month) { return M.posts.filter(p => String(p.date).startsWith(m)).sort((a, b) => a.date.localeCompare(b.date) || String(a.time).localeCompare(String(b.time))); }

/* ---------- plan ---------- */
async function makePlan() {
  const m = M.month, y = Number(m.slice(0, 4));
  await loadCalendar(false);
  const events = eventsFor([y - 1, y, y + 1]);
  const windows = longWeekends(events, m + '-01', addDays(lastDay(m), 8));
  const existing = monthPosts(m);
  const keep = existing.filter(p => p.status !== 'draft' || p.edited);
  const taken = new Set(keep.map(p => p.date));
  const b = B();
  const posts = planMonth({ month: m, events, windows, cars: cars(), settings: b, reviews: reviews(), brand: b, taken });
  for (const p of existing.filter(p => !keep.includes(p))) await del('mk_posts/' + p.id);
  for (const p of posts) await save('mk_posts/' + p.id, { ...p, created_at: new Date().toISOString() });
  toast(`${posts.length} posts planned for ${monthLabel(m)}${keep.length ? ` (kept ${keep.length} you approved or edited)` : ''}.`);
}

/* ---------- photos and images ---------- */
function photoFor(p) {
  if (p.photo_id === 'none') return null;
  if (p.photo_id) return M.photos.find(x => x.id === p.photo_id) || null;
  if (['whyus', 'tip', 'review'].includes(p.template)) return null;
  let pool = p.car_id ? M.photos.filter(x => x.car_id === p.car_id && x.kind !== 'people') : [];
  if (!pool.length && p.template !== 'spotlight') pool = M.photos.filter(x => (p.template === 'trip' ? x.kind !== 'people' : true));
  return pool.length ? pool[hash(p.id) % pool.length] : null;
}
async function renderCtx(p) {
  const b = B(); const ph = photoFor(p);
  return { brand: { ...BRAND_DEFAULT, ...(b.colors || {}) }, phone: b.phone, site: b.website, logos: await logos(), photo: ph ? await loadImage(ph.url) : null };
}
const thumbKey = p => JSON.stringify([p.template, p.headline, p.subline, p.badge, p.event?.theme, p.review, photoFor(p)?.id, B().phone, B().website, B().colors]);
let thumbQueue = Promise.resolve();
function queueThumb(p) {
  const key = thumbKey(p); if (M.thumbs.get(p.id)?.key === key) return;
  M.thumbs.set(p.id, { key, url: M.thumbs.get(p.id)?.url || null });
  thumbQueue = thumbQueue.then(async () => {
    if (M.thumbs.get(p.id)?.key !== key) return;
    const c = await renderPost(p, await renderCtx(p), 'post');
    const s = document.createElement('canvas'); s.width = 324; s.height = 405; s.getContext('2d').drawImage(c, 0, 0, 324, 405);
    M.thumbs.set(p.id, { key, url: s.toDataURL('image/jpeg', 0.82) });
    const im = document.querySelector(`[data-thumb="${CSS.escape(p.id)}"]`); if (im) im.src = M.thumbs.get(p.id).url;
  }).catch(() => {});
}
function publicUrl(path) { return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl; }
async function uploadBlob(path, blob, type = 'image/jpeg') {
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: type, upsert: true, cacheControl: '31536000' });
  if (error) throw new Error(/bucket not found/i.test(error.message) ? 'Storage is not set up. Run supabase/marketer_setup.sql in Supabase first.' : /row-level|policy/i.test(error.message) ? 'Storage permission missing. Run supabase/marketer_setup.sql in Supabase.' : 'Upload failed: ' + error.message);
  return publicUrl(path);
}
async function approve(p, { quiet } = {}) {
  const ctx = await renderCtx(p); const stamp = Date.now().toString(36); const images = {};
  const old = await supabase.storage.from(BUCKET).list(`posts/${p.id}`).then(r => r.data || []).catch(() => []);
  for (const f of ['post', 'story', 'square']) { const c = await renderPost(p, ctx, f); images[f] = await uploadBlob(`posts/${p.id}/${f}-${stamp}.jpg`, await canvasToBlob(c)); }
  if (old.length) await supabase.storage.from(BUCKET).remove(old.map(o => `posts/${p.id}/${o.name}`)).catch(() => {});
  const next = { ...p, images, status: 'approved', approved_at: new Date().toISOString(), errors: {} };
  await save('mk_posts/' + p.id, next);
  if (!quiet) toast('Approved. Image saved.');
  return next;
}
async function download(p, format) {
  const c = await renderPost(p, await renderCtx(p), format);
  const blob = await canvasToBlob(c); const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `drivekaro-${p.date}-${p.type}-${format}.jpg`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
async function shrink(file, max = 2000) {
  const url = URL.createObjectURL(file); const im = await loadImage(url);
  if (!im) throw new Error(`${file.name} is not an image I can read (use JPG or PNG).`);
  const s = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight)); const c = document.createElement('canvas');
  c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
  URL.revokeObjectURL(url); return { blob: await canvasToBlob(c, 'image/jpeg', 0.88), w: c.width, h: c.height };
}
async function uploadPhotos(files, car_id, kind) {
  let n = 0;
  for (const f of files) {
    const { blob, w, h } = await shrink(f); const id = uid('ph'); const path = `photos/${id}.jpg`;
    const url = await uploadBlob(path, blob);
    await save('mk_photos/' + id, { url, path, car_id: car_id || null, kind: kind || 'car', w, h, name: f.name.slice(0, 80), created_at: new Date().toISOString() });
    n++;
  }
  toast(`${n} photo${n > 1 ? 's' : ''} added.`);
}

/* ---------- render ---------- */
let editing = false;
function softRender() { if (editing) return; render(); }
function render() {
  const app = $('#app'); if (!app || !M.db) return;
  document.querySelectorAll('nav.tabs .tab').forEach(t => t.classList.toggle('on', t.dataset.tab === M.tab));
  if (M.edit) { app.innerHTML = editorHTML(); drawPreview(); return; }
  app.innerHTML = M.tab === 'plan' ? planHTML() : M.tab === 'calendar' ? calendarHTML() : M.tab === 'photos' ? photosHTML() : brandHTML();
  if (M.tab === 'plan') monthPosts().forEach(queueThumb);
}
const monthBar = () => `<div class="monthbar"><button class="btn sm" data-act="month" data-n="-1" aria-label="Previous month">‹</button><strong>${esc(monthLabel(M.month))}</strong><button class="btn sm" data-act="month" data-n="1" aria-label="Next month">›</button></div>`;
function calNote() {
  const y = Number(M.month.slice(0, 4)); const c = M.cal[y];
  if (M.calState === 'loading' && !c) return `<p class="muted small">Fetching holidays and festivals…</p>`;
  if (M.calState === 'error') return `<p class="warnline">Couldn't fetch live holidays (${esc(M.calErr)}). Using the built-in list, which is approximate.</p>`;
  if (!c) return '';
  if (!c.google?.length && !c.calendarific?.length) return `<p class="warnline">Live holiday feed didn't answer${c.errors?.google ? ` (${esc(c.errors.google)})` : ''}. Using the built-in Maharashtra list for ${y}, which is approximate. <button class="linkbtn" data-act="cal-refresh">Try again</button></p>`;
  return '';
}
function planHTML() {
  const ps = monthPosts(); const cnt = s => ps.filter(p => p.status === s).length; const b = B();
  const draft = cnt('draft');
  return `${monthBar()}${calNote()}
  <div class="card">
    <div class="row between wrap">
      <div><div class="big">${ps.length} post${ps.length === 1 ? '' : 's'}</div><div class="muted small">${[['draft', 'draft'], ['approved', 'approved'], ['posted', 'posted'], ['failed', 'failed']].map(([k, l]) => cnt(k) ? `${cnt(k)} ${l}` : '').filter(Boolean).join(' · ') || 'Nothing planned yet'}</div></div>
      <div class="actions">
        <button class="btn ${ps.length ? '' : 'primary'}" data-act="plan" ${M.busy.has('plan') ? 'disabled' : ''}>${M.busy.has('plan') ? 'Planning…' : ps.length ? 'Remake drafts' : `Make ${monthLabel(M.month).split(' ')[0]} plan`}</button>
        ${draft ? `<button class="btn primary" data-act="approve-all" ${M.busy.has('approve-all') ? 'disabled' : ''}>${M.busy.has('approve-all') ? 'Approving…' : `Approve all ${draft}`}</button>` : ''}
      </div>
    </div>
    <p class="muted small" style="margin:10px 0 0">${b.autopilot ? `<span class="chip ok">Autopilot on</span> Approved posts go out automatically each morning (about 8:30–9:30 AM).` : `<span class="chip">Autopilot off</span> Nothing posts by itself. Use “Post now”, or download and post by hand. Turn autopilot on in Brand & connections.`}</p>
    ${ps.length ? `<p class="muted small" style="margin:6px 0 0">“Remake drafts” keeps posts you approved, posted or edited.</p>` : ''}
  </div>
  ${ps.length ? `<div class="posts">${ps.map(postCard).join('')}</div>` : `<div class="empty"><h3>No plan for ${esc(monthLabel(M.month))} yet</h3><p>The plan uses festivals, holidays and long weekends in Maharashtra, your cars, the season's best trips from Pune and your offer.</p>${cars().length ? '' : '<p>Tip: cars in your desk Fleet get their own spotlight posts.</p>'}${M.photos.length ? '' : '<p>Tip: add car photos in Photos so posts show your real cars.</p>'}</div>`}`;
}
function platformChips(p) {
  const pub = p.published || {};
  return [['ig', 'Instagram'], ['story', 'Story'], ['gbp', 'Google']].map(([k, l]) => `<label class="pchip ${p.platforms?.[k] ? 'on' : ''} ${pub[k]?.at ? 'done' : p.errors?.[k] ? 'bad' : ''}" title="${esc(p.errors?.[k] || (pub[k]?.at ? 'Posted' : ''))}"><input type="checkbox" data-plat="${k}" data-id="${esc(p.id)}" ${p.platforms?.[k] ? 'checked' : ''} ${p.status === 'posted' ? 'disabled' : ''}>${l}${pub[k]?.at ? ' ✓' : p.errors?.[k] ? ' !' : ''}</label>`).join('');
}
function postCard(p) {
  const th = M.thumbs.get(p.id)?.url; const past = p.date < today(); const id = esc(p.id);
  const links = Object.entries(p.published || {}).filter(([, v]) => v?.link).map(([k, v]) => `<a href="${esc(v.link)}" target="_blank" rel="noopener">${k === 'gbp' ? 'Google' : k === 'story' ? 'Story' : 'Instagram'} ↗</a>`).join(' ');
  const errs = Object.entries(p.errors || {}).map(([k, v]) => `<div class="err small">${k === 'gbp' ? 'Google' : k === 'story' ? 'Story' : 'Instagram'}: ${esc(v)}</div>`).join('');
  return `<article class="post ${past && p.status !== 'posted' ? 'past' : ''}">
    <button class="thumb" data-act="edit" data-id="${id}" aria-label="Edit post">${th ? `<img data-thumb="${id}" src="${th}" alt="">` : `<img data-thumb="${id}" alt="">`}</button>
    <div class="pbody">
      <div class="row between"><span class="pdate">${esc(dayLabel(p.date))}</span><span class="chip st-${esc(p.status)}">${esc(STATUS[p.status] || p.status)}</span></div>
      <div class="ptype">${esc(TYPE_LABEL[p.type] || p.type)}${p.event ? ` · ${esc(p.event.label || p.event.name)}` : ''}${p.destination ? ` · ${esc(p.destination)}` : ''}</div>
      <div class="phead">${esc(p.headline)}</div>
      <div class="pchips">${platformChips(p)}</div>
      ${errs}${links ? `<div class="small">${links}</div>` : ''}
      <div class="actions">
        <button class="btn sm" data-act="edit" data-id="${id}">Edit</button>
        ${p.status === 'draft' || p.status === 'failed' ? `<button class="btn sm primary" data-act="approve" data-id="${id}" ${M.busy.has('ap' + p.id) ? 'disabled' : ''}>${M.busy.has('ap' + p.id) ? 'Saving…' : 'Approve'}</button>` : ''}
        ${p.status === 'approved' || p.status === 'partial' || p.status === 'failed' ? `<button class="btn sm" data-act="publish" data-id="${id}" ${M.busy.has('pub' + p.id) ? 'disabled' : ''}>${M.busy.has('pub' + p.id) ? 'Posting…' : 'Post now'}</button>` : ''}
        ${p.status === 'approved' ? `<button class="btn sm" data-act="unapprove" data-id="${id}">Back to draft</button>` : ''}
        <button class="btn sm" data-act="copy" data-id="${id}">Copy caption</button>
        <button class="btn sm danger" data-act="delete" data-id="${id}">Delete</button>
      </div>
    </div>
  </article>`;
}

function editorHTML() {
  const p = M.edit; const b = B(); const f = M.editFormat;
  const photoOpts = M.photos.map(ph => `<button type="button" class="phpick ${p.photo_id === ph.id ? 'on' : ''}" data-act="pick-photo" data-pid="${esc(ph.id)}" title="${esc(carName(ph.car_id) || ph.kind)}"><img src="${esc(ph.url)}" alt="" loading="lazy"></button>`).join('');
  return `<div class="editor">
    <div class="row between wrap"><button class="btn sm" data-act="edit-close">‹ Back</button><div class="muted small">${esc(dayLabel(p.date))} · ${esc(TYPE_LABEL[p.type] || p.type)}</div></div>
    <div class="edgrid">
      <div>
        <div class="seg">${Object.keys(FORMATS).map(k => `<button type="button" class="${f === k ? 'on' : ''}" data-act="fmt" data-f="${k}">${k === 'post' ? 'Instagram post' : k === 'story' ? 'Story' : 'Google (square)'}</button>`).join('')}</div>
        <div class="preview"><canvas id="pv"></canvas></div>
        <div class="actions"><button class="btn sm" data-act="dl" data-f="${f}">Download this image</button></div>
      </div>
      <div class="fields">
        <div class="two"><div class="field"><label>Date</label><input type="date" data-e="date" value="${esc(p.date)}"></div>
        <div class="field"><label>Design</label><select data-e="template">${Object.entries(TEMPLATES).map(([k, l]) => `<option value="${k}" ${p.template === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
        ${p.template === 'festival' ? `<div class="field"><label>Colours and decoration</label><select data-e="theme">${THEMES.map(t => `<option value="${t}" ${(p.event?.theme || 'brand') === t ? 'selected' : ''}>${t === 'brand' ? 'DriveKaro colours' : t[0].toUpperCase() + t.slice(1)}</option>`).join('')}</select></div>` : ''}
        <div class="field"><label>Headline (on the image)</label><input data-e="headline" value="${esc(p.headline)}" maxlength="90"></div>
        <div class="field"><label>Second line (on the image)</label><input data-e="subline" value="${esc(p.subline)}" maxlength="140"></div>
        ${['trip', 'spotlight', 'offer', 'whyus', 'tip', 'review'].includes(p.template) ? `<div class="field"><label>Label (small tag on the image)</label><input data-e="badge" value="${esc(p.badge)}" maxlength="40"></div>` : ''}
        ${['whyus', 'tip', 'review'].includes(p.template) ? '' : `<div class="field"><label>Photo</label><div class="phgrid"><button type="button" class="phpick auto ${!p.photo_id ? 'on' : ''}" data-act="pick-photo" data-pid="">Auto</button><button type="button" class="phpick auto ${p.photo_id === 'none' ? 'on' : ''}" data-act="pick-photo" data-pid="none">None</button>${photoOpts}</div>${M.photos.length ? '' : '<p class="muted small">No photos yet. Add some in Photos.</p>'}</div>`}
        <div class="field"><label>Instagram caption</label><textarea data-e="caption" rows="9">${esc(p.caption)}</textarea></div>
        ${M.status?.ai ? `<div class="aibox"><input id="ai_note" placeholder="Optional note for AI, e.g. mention Swift CNG is free on Sunday"><button class="btn sm" data-act="ai" ${M.busy.has('ai') ? 'disabled' : ''}>${M.busy.has('ai') ? 'Writing…' : 'Rewrite with AI'}</button></div>` : ''}
        <div class="field"><label>Google Business Profile text</label><textarea data-e="gbp_text" rows="4" maxlength="1450">${esc(p.gbp_text)}</textarea></div>
        <div class="field"><label>Post to</label><div class="pchips">${[['ig', 'Instagram feed'], ['story', 'Instagram story'], ['gbp', 'Google Business']].map(([k, l]) => `<label class="pchip ${p.platforms?.[k] ? 'on' : ''}"><input type="checkbox" data-eplat="${k}" ${p.platforms?.[k] ? 'checked' : ''}>${l}</label>`).join('')}</div></div>
        <div class="actions sticky">
          <button class="btn primary" data-act="edit-save" data-approve="1" ${M.busy.has('save') ? 'disabled' : ''}>${M.busy.has('save') ? 'Saving…' : 'Save and approve'}</button>
          <button class="btn" data-act="edit-save" ${M.busy.has('save') ? 'disabled' : ''}>Save as draft</button>
          <button class="btn" data-act="copy-edit">Copy caption</button>
        </div>
        <p class="muted small">Your phone and website (${esc(b.phone)} · ${esc(b.website)}) are added to every image.</p>
      </div>
    </div>
  </div>`;
}
const carName = id => M.fleet.find(c => c.id === id)?.make_model || '';
let pvTimer = null, pvSeq = 0;
function drawPreview() {
  clearTimeout(pvTimer);
  pvTimer = setTimeout(async () => {
    const seq = ++pvSeq; const p = M.edit; if (!p) return;
    const c = await renderPost(p, await renderCtx(p), M.editFormat);
    const pv = $('#pv'); if (!pv || seq !== pvSeq) return;
    pv.width = c.width; pv.height = c.height; pv.getContext('2d').drawImage(c, 0, 0);
  }, 120);
}

function calendarHTML() {
  const m = M.month, y = Number(m.slice(0, 4));
  const all = eventsFor([y - 1, y, y + 1]);
  const evs = all.filter(e => e.date.startsWith(m));
  const shown = evs.filter(e => M.showMinor || e.kind !== 'observance' || e.greet || e.travel || e.custom);
  const wins = longWeekends(all, m + '-01', lastDay(m)).filter(w => w.start.startsWith(m) || w.end.startsWith(m));
  const c = M.cal[y] || {};
  const srcLine = [`Google holiday calendar: ${c.google?.length ? `${c.google.length} days for ${y}` : c.errors?.google ? 'not reachable' : '…'}`,
    `Calendarific: ${M.status?.calendarific ? (c.calendarific?.length ? `${c.calendarific.length} days` : c.errors?.calendarific ? 'error' : '…') : 'not set up (optional)'}`,
    c.fetched_at ? `checked ${new Date(c.fetched_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''].filter(Boolean).join(' · ');
  const kindChip = e => e.kind === 'holiday' || e.mhOff ? `<span class="chip bad">Holiday</span>` : e.kind === 'marketing' ? `<span class="chip info">Special day</span>` : e.kind === 'restricted' ? `<span class="chip">Optional holiday</span>` : e.kind === 'observance' ? `<span class="chip">Observance</span>` : `<span class="chip warn">Festival</span>`;
  const srcChip = s => ({ google: 'Google', calendarific: 'Calendarific', builtin: 'Built-in', custom: 'Yours' }[s] || s);
  return `${monthBar()}${calNote()}
  <div class="card"><div class="row between wrap"><p class="muted small" style="margin:0">${esc(srcLine)}</p><button class="btn sm" data-act="cal-refresh" ${M.calState === 'loading' ? 'disabled' : ''}>${M.calState === 'loading' ? 'Checking…' : 'Refresh holidays'}</button></div>
  <p class="muted small" style="margin:8px 0 0">Festival dates follow the Indian calendar and can move by a day. If a date is wrong, hide it and add the right one yourself.</p></div>
  ${wins.length ? `<div class="card"><h3>Long weekends</h3>${wins.map(w => `<div class="lw"><strong>${esc(dayLabel(w.start))} – ${esc(dayLabel(w.end))}</strong> · ${w.days} days · ${esc(w.names.join(', '))}${w.bridge ? ` <span class="chip warn">take ${esc(dayLabel(w.leaveDay))} off</span>` : ''}</div>`).join('')}</div>` : ''}
  <div class="card"><div class="row between wrap"><h3 style="margin:0">Holidays and festivals</h3><label class="small"><input type="checkbox" data-act="minor" ${M.showMinor ? 'checked' : ''}> Show all observances</label></div>
  ${shown.length ? shown.map(e => `<div class="ev ${e.hidden ? 'hid' : ''}">
      <div class="evd">${esc(dayLabel(e.date))}</div>
      <div class="evn"><strong>${esc(e.name)}</strong> ${kindChip(e)} ${e.travel >= 2 ? '<span class="chip ok">Trip season</span>' : ''} ${e.approx ? '<span class="chip">≈ approx</span>' : ''}<div class="muted small">${e.sources.map(srcChip).join(', ')}${e.greet && !e.greetOff ? ' · greeting post' : ''}</div></div>
      <div>${e.custom && e.id ? `<button class="btn sm danger" data-act="ev-del" data-id="${esc(e.id)}">Delete</button>` : `<button class="btn sm" data-act="ev-hide" data-k="${esc(evKey(e))}">${e.hidden ? 'Show' : 'Hide'}</button>`}</div>
    </div>`).join('') : `<p class="muted">Nothing this month.</p>`}
  </div>
  <div class="card">${M.addEvent ? `<h3>Add your own day</h3>
    <div class="two"><div class="field"><label>Date</label><input type="date" id="ne_date" value="${m}-01"></div><div class="field"><label>Name</label><input id="ne_name" placeholder="e.g. DriveKaro 2nd anniversary"></div></div>
    <div class="field"><label>Greeting on the post (optional)</label><input id="ne_greet" placeholder="e.g. Thank you for 2 years, Pune!"></div>
    <div class="two"><div class="field"><label>Design colours</label><select id="ne_theme">${THEMES.map(t => `<option value="${t}">${t === 'brand' ? 'DriveKaro colours' : t[0].toUpperCase() + t.slice(1)}</option>`).join('')}</select></div>
    <div class="field"><label>Options</label><label class="small"><input type="checkbox" id="ne_trip"> People travel (adds a “book early” post before)</label><label class="small"><input type="checkbox" id="ne_off"> Holiday in Maharashtra</label></div></div>
    <div class="actions"><button class="btn primary" data-act="ev-add">Add</button><button class="btn" data-act="ev-cancel">Cancel</button></div>` : `<button class="btn" data-act="ev-new">+ Add your own day</button> <span class="muted small">Your anniversary, a local event, or a corrected festival date.</span>`}</div>`;
}

function photosHTML() {
  const cs = M.fleet.filter(c => c.active !== false);
  return `<div class="card"><h3>Add photos</h3>
    <p class="muted small">Your real car photos make the best posts. Landscape photos in daylight work best. Photos are shrunk before upload. Only upload marketing photos here (they are public): never DL, Aadhaar or other documents.</p>
    <div class="two"><div class="field"><label>Which car</label><select id="up_car"><option value="">Not a specific car</option>${cs.map(c => `<option value="${esc(c.id)}">${esc(c.make_model)} · ${esc(c.plate || '')}</option>`).join('')}</select></div>
    <div class="field"><label>What's in it</label><select id="up_kind"><option value="car">Car</option><option value="place">Place / road trip</option><option value="people">Happy customers</option></select></div></div>
    <input type="file" id="up_files" accept="image/*" multiple>
    <div class="actions"><button class="btn primary" data-act="upload" ${M.busy.has('upload') ? 'disabled' : ''}>${M.busy.has('upload') ? 'Uploading…' : 'Upload'}</button></div></div>
  <div class="card"><h3>Your photos (${M.photos.length})</h3>
  ${M.photos.length ? `<div class="gallery">${M.photos.map(ph => `<figure><img src="${esc(ph.url)}" alt="" loading="lazy"><figcaption><select data-phcar="${esc(ph.id)}"><option value="">Any</option>${cs.map(c => `<option value="${esc(c.id)}" ${ph.car_id === c.id ? 'selected' : ''}>${esc(c.make_model)}</option>`).join('')}</select><select data-phkind="${esc(ph.id)}">${['car', 'place', 'people'].map(k => `<option ${ph.kind === k ? 'selected' : ''}>${k}</option>`).join('')}</select><button class="btn sm danger" data-act="ph-del" data-id="${esc(ph.id)}">Delete</button></figcaption></figure>`).join('')}</div>` : `<p class="muted">No photos yet. Posts use designed backgrounds until you add some.</p>`}</div>`;
}

function brandHTML() {
  const b = B(), st = M.status || {}, o = b.offer || {};
  const col = { ...BRAND_DEFAULT, ...(b.colors || {}) };
  const langs = new Set(b.langs || []);
  const gbp = st.gbp || {};
  return `<form id="brandform" class="card"><h3>Business</h3>
    <div class="two"><div class="field"><label>WhatsApp / phone on posts</label><input name="phone" value="${esc(M.brand.phone || '')}" placeholder="${esc(b.phone)}"></div>
    <div class="field"><label>Website on posts</label><input name="website" value="${esc(M.brand.website || '')}" placeholder="${esc(b.website)}"></div></div>
    <div class="field"><label>Languages in captions</label><div class="pchips">${[['en', 'English'], ['mr', 'Marathi'], ['hi', 'Hindi']].map(([k, l]) => `<label class="pchip ${langs.has(k) ? 'on' : ''}"><input type="checkbox" name="lang" value="${k}" ${langs.has(k) ? 'checked' : ''} ${k === 'en' ? 'disabled' : ''}>${l}</label>`).join('')}</div><p class="muted small">Festival posts add the greeting in Marathi (or Hindi) under the English one.</p></div>
    <div class="field"><label>Extra hashtags (added to every post)</label><input name="hashtags" value="${esc(b.hashtags)}" placeholder="#PuneCarRental #HadapsarPune"></div>
    <div class="field"><label>Brand colours</label><div class="pchips">${[['red', 'Main'], ['beige', 'Background'], ['dark', 'Text']].map(([k, l]) => `<label class="pchip on">${l} <input type="color" name="c_${k}" value="${esc(col[k])}"></label>`).join('')}</div></div>
    <h3>Plan</h3>
    <div class="two"><div class="field"><label>Instagram posts per week</label><select name="igPerWeek">${[3, 4, 5, 6, 7].map(n => `<option ${Number(b.igPerWeek) === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
    <div class="field"><label>Google posts per week</label><select name="gbpPerWeek">${[1, 2, 3].map(n => `<option ${Number(b.gbpPerWeek) === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div>
    <label class="small"><input type="checkbox" name="stories" ${b.stories !== false ? 'checked' : ''}> Also post festival, long-weekend and offer posts as Instagram stories</label>
    <div class="field"><label>Favourite trip ideas (comma separated, optional)</label><input name="destinations" value="${esc((b.destinations || []).join(', '))}" placeholder="Lonavala, Mahabaleshwar"></div>
    <div class="field"><label>Cars to feature</label><div class="pchips">${M.fleet.filter(c => c.active !== false).map(c => `<label class="pchip ${(b.cars_off || []).includes(c.id) ? '' : 'on'}"><input type="checkbox" name="car" value="${esc(c.id)}" ${(b.cars_off || []).includes(c.id) ? '' : 'checked'}>${esc(c.make_model)}</label>`).join('') || '<span class="muted small">No cars in the desk Fleet yet.</span>'}</div></div>
    <h3>Current offer (optional)</h3>
    <div class="two"><div class="field"><label>Title</label><input name="o_title" value="${esc(o.title || '')}" placeholder="10% off weekday bookings"></div><div class="field"><label>Details</label><input name="o_details" value="${esc(o.details || '')}" placeholder="Mon–Thu pickups, all cars"></div></div>
    <div class="two"><div class="field"><label>From</label><input type="date" name="o_from" value="${esc(o.from || '')}"></div><div class="field"><label>Till</label><input type="date" name="o_until" value="${esc(o.until || '')}"></div></div>
    <div class="field"><label>Terms (short)</label><input name="o_terms" value="${esc(o.terms || '')}" placeholder="T&C apply. Not with other offers."></div>
    <h3>Customer reviews for review posts</h3>
    <div class="field"><label>One per line: Name | stars | review</label><textarea name="reviews" rows="4" placeholder="Rohit S | 5 | Clean car, smooth pickup at my door.">${esc((b.reviews || []).map(r => `${r.name || ''} | ${r.stars || 5} | ${r.text}`).join('\n'))}</textarea><p class="muted small">Copy real reviews from your Google profile. Only use real ones.</p></div>
    <h3>Autopilot</h3>
    <label class="small"><input type="checkbox" name="autopilot" ${b.autopilot ? 'checked' : ''}> Post approved posts automatically every morning (about 8:30–9:30 AM)</label>
    <p class="muted small">Only posts you approved go out. Drafts never post. If something fails you get an email (same address as the desk's daily summary).</p>
    <div class="actions sticky"><button class="btn primary" type="submit">Save</button></div>
  </form>
  <div class="card"><h3>Connections</h3>
    ${st.error ? `<p class="err">${esc(st.error)}</p>` : !M.status ? '<p class="muted">Checking…</p>' : `
    <div class="conn"><div><strong>Instagram</strong><div class="muted small">${st.ig?.configured ? 'Keys are set in Vercel.' : 'Not set up. Needs a Business/Creator account and a Meta app (see the setup guide).'}</div></div>${st.ig?.configured ? `<button class="btn sm" data-act="ig-check" ${M.busy.has('ig') ? 'disabled' : ''}>Check</button>` : '<span class="chip">Off</span>'}</div>
    <div class="conn"><div><strong>Google Business Profile</strong><div class="muted small">${gbp.connected ? `Connected${gbp.email ? ' as ' + esc(gbp.email) : ''}. ${gbp.location ? 'Posting to: ' + esc(gbp.location_title || gbp.location) : '<b>Choose your location.</b>'}` : 'Not connected.'}</div>
      ${M.locations ? `<div class="field" style="margin-top:6px"><select id="gbp_loc">${M.locations.map(l => `<option value="${esc(l.location)}" data-title="${esc(l.title)}">${esc(l.title)} · ${esc(l.address)}</option>`).join('')}</select><button class="btn sm primary" data-act="gbp-setloc">Use this location</button></div>` : ''}</div>
      <div class="actions">${gbp.connected ? `<button class="btn sm" data-act="gbp-locs" ${M.busy.has('locs') ? 'disabled' : ''}>${gbp.location ? 'Change location' : 'Choose location'}</button><button class="btn sm" data-act="gbp-off">Disconnect</button>` : `<button class="btn sm primary" data-act="gbp-connect">Connect</button>`}</div></div>
    <div class="conn"><div><strong>AI captions</strong><div class="muted small">${st.ai ? 'On. Use “Rewrite with AI” in any post.' : 'Off. Captions come from ready-made templates. Add ANTHROPIC_API_KEY in Vercel to turn on.'}</div></div><span class="chip ${st.ai ? 'ok' : ''}">${st.ai ? 'On' : 'Off'}</span></div>
    <div class="conn"><div><strong>Holiday feeds</strong><div class="muted small">Google's public India holiday calendar is used automatically.${st.calendarific ? ' Calendarific is on too.' : ' Optional: add CALENDARIFIC_API_KEY for a second source.'}</div></div><span class="chip ok">On</span></div>
    <div class="conn"><div><strong>Autopilot timer</strong><div class="muted small">${st.cron ? 'Ready (CRON_SECRET is set).' : 'CRON_SECRET is missing in Vercel, so autopilot cannot run.'}</div></div><span class="chip ${st.cron ? 'ok' : 'bad'}">${st.cron ? 'Ready' : 'Missing'}</span></div>`}
  </div>`;
}

/* ---------- actions ---------- */
function readBrandForm(f) {
  const v = n => (f.elements[n]?.value || '').trim();
  const reviews = v('reviews').split('\n').map(l => l.split('|').map(x => x.trim())).filter(a => a.length >= 3 && a[2]).map(([name, stars, ...t]) => ({ name, stars: Math.min(5, Math.max(1, Number(stars) || 5)), text: t.join(' | ') }));
  const on = [...f.querySelectorAll('input[name=car]')]; const langs = ['en', ...[...f.querySelectorAll('input[name=lang]:checked')].map(x => x.value).filter(x => x !== 'en')];
  const offer = v('o_title') ? { title: v('o_title'), details: v('o_details'), from: v('o_from') || null, until: v('o_until') || null, terms: v('o_terms') } : null;
  return { ...M.brand, phone: v('phone'), website: v('website'), langs, hashtags: v('hashtags'), igPerWeek: Number(v('igPerWeek')) || 4, gbpPerWeek: Number(v('gbpPerWeek')) || 2,
    stories: f.elements.stories.checked, destinations: v('destinations').split(',').map(s => s.trim()).filter(Boolean), cars_off: on.filter(x => !x.checked).map(x => x.value),
    offer, reviews, autopilot: f.elements.autopilot.checked, colors: { red: v('c_red'), beige: v('c_beige'), dark: v('c_dark') }, updated_at: new Date().toISOString() };
}
function loadGIS() { return new Promise((res, rej) => { if (window.google?.accounts?.oauth2) return res(); const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.onload = res; s.onerror = () => rej(new Error("Couldn't load Google sign-in.")); document.head.appendChild(s); }); }
async function connectGBP() {
  const cid = import.meta.env.VITE_GOOGLE_CLIENT_ID; if (!cid) throw new Error('Google sign-in is not set up (VITE_GOOGLE_CLIENT_ID).');
  await loadGIS();
  window.google.accounts.oauth2.initCodeClient({ client_id: cid, scope: 'https://www.googleapis.com/auth/business.manage openid email', ux_mode: 'popup',
    callback: async r => { if (r.error) { toast(r.error_description || r.error); return; } try { const x = await api('gbp_connect', { code: r.code }); toast(`Connected${x.email ? ' as ' + x.email : ''}. Now choose your location.`); M.status = await api('status'); await loadLocations(); } catch (e) { toast(e.message); } render(); } }).requestCode();
}
async function loadLocations() { const r = await api('gbp_locations'); M.locations = r.locations; if (!r.locations.length) toast('No business locations found on this Google account.'); }
const findPost = id => M.posts.find(p => p.id === id);

document.addEventListener('click', async e => {
  const t = e.target.closest('[data-act]'); if (!t) { const tab = e.target.closest('nav.tabs .tab'); if (tab) { M.tab = tab.dataset.tab; M.edit = null; render(); window.scrollTo(0, 0); } return; }
  const act = t.dataset.act, id = t.dataset.id;
  if (act === 'minor') { M.showMinor = t.checked; render(); return; }
  if (t.tagName === 'INPUT') return;
  e.preventDefault();
  if (act === 'month') { M.month = shiftMonth(M.month, Number(t.dataset.n)); render(); loadCalendar(false); }
  else if (act === 'plan') { const drafts = monthPosts().filter(p => p.status === 'draft' && !p.edited).length; if (drafts && !confirm(`Replace ${drafts} draft post${drafts > 1 ? 's' : ''} with a fresh plan?`)) return; busy('plan', makePlan); }
  else if (act === 'approve-all') busy('approve-all', async () => { let n = 0; for (const p of monthPosts().filter(p => p.status === 'draft')) { await approve(p, { quiet: true }); n++; } toast(`${n} posts approved.`); });
  else if (act === 'approve') busy('ap' + id, () => approve(findPost(id)));
  else if (act === 'unapprove') { const p = findPost(id); await save('mk_posts/' + id, { ...p, status: 'draft' }); }
  else if (act === 'publish') busy('pub' + id, async () => { let p = findPost(id); if (!p.images?.post) p = await approve(p, { quiet: true }); const r = await api('publish', { postId: id }); toast(r.post.status === 'posted' ? 'Posted!' : 'Some platforms failed. See the post.'); });
  else if (act === 'delete') { if (confirm('Delete this post?')) { await del('mk_posts/' + id); supabase.storage.from(BUCKET).list(`posts/${id}`).then(r => r.data?.length && supabase.storage.from(BUCKET).remove(r.data.map(o => `posts/${id}/${o.name}`))).catch(() => {}); } }
  else if (act === 'copy' || act === 'copy-edit') { const p = act === 'copy' ? findPost(id) : M.edit; try { await navigator.clipboard.writeText(p.caption || ''); toast('Caption copied.'); } catch { toast("Couldn't copy. Select the text and copy it."); } }
  else if (act === 'edit') { M.edit = JSON.parse(JSON.stringify(findPost(id))); M.editFormat = 'post'; editing = true; render(); window.scrollTo(0, 0); }
  else if (act === 'edit-close') { if (M.edit?._dirty && !confirm('Leave without saving?')) return; M.edit = null; editing = false; render(); }
  else if (act === 'fmt') { M.editFormat = t.dataset.f; render(); }
  else if (act === 'dl') { if (M.edit) download(M.edit, t.dataset.f); }
  else if (act === 'pick-photo') { M.edit.photo_id = t.dataset.pid || undefined; if (!t.dataset.pid) delete M.edit.photo_id; M.edit._dirty = true; render(); }
  else if (act === 'ai') { const note = $('#ai_note')?.value || ''; busy('ai', async () => { const r = await api('caption_ai', { post: M.edit, brand: B(), instruction: note }); M.edit.caption = r.caption + (r.hashtags?.length ? '\n\n' + r.hashtags.join(' ') : ''); M.edit.gbp_text = r.gbp_text || M.edit.gbp_text; if (r.hashtags?.length) M.edit.hashtags = r.hashtags; M.edit._dirty = true; toast('New caption written. Check it before saving.'); }); }
  else if (act === 'edit-save') busy('save', async () => {
    const { _dirty, ...p } = M.edit; p.edited = true; p.updated_at = new Date().toISOString();
    if (t.dataset.approve) { await approve({ ...p, status: 'draft', published: p.status === 'posted' ? p.published : {} }); }
    else await save('mk_posts/' + p.id, { ...p, status: p.status === 'posted' ? 'posted' : 'draft' });
    M.edit = null; editing = false; toast(t.dataset.approve ? 'Saved and approved.' : 'Saved.');
  });
  else if (act === 'cal-refresh') { await loadCalendar(true); toast(M.calState === 'ok' ? 'Holidays refreshed.' : "Couldn't refresh."); }
  else if (act === 'ev-hide') { const k = t.dataset.k; const h = new Set(M.brand.hidden || []); h.has(k) ? h.delete(k) : h.add(k); await save('mk_settings/brand', { ...M.brand, hidden: [...h] }); }
  else if (act === 'ev-new') { M.addEvent = true; render(); }
  else if (act === 'ev-cancel') { M.addEvent = false; render(); }
  else if (act === 'ev-add') {
    const date = $('#ne_date').value, name = $('#ne_name').value.trim(); if (!date || !name) { toast('Add a date and a name.'); return; }
    const greet = $('#ne_greet').value.trim(); const trip = $('#ne_trip').checked;
    const ev = { date, name, kind: $('#ne_off').checked ? 'holiday' : 'festival', theme: $('#ne_theme').value, travel: trip ? 2 : 0, lead: trip ? 5 : 0, greet: greet ? { en: greet } : null, created_at: new Date().toISOString() };
    await save('mk_events/' + uid('ev'), ev); M.addEvent = false; render(); toast('Added. Remake drafts to include it in the plan.');
  }
  else if (act === 'ev-del') { if (confirm('Delete this day?')) await del('mk_events/' + id); }
  else if (act === 'upload') { const files = [...($('#up_files').files || [])], car = $('#up_car').value, kind = $('#up_kind').value; if (!files.length) { toast('Choose photos first.'); return; } busy('upload', () => uploadPhotos(files, car, kind)); }
  else if (act === 'ph-del') { const ph = M.photos.find(x => x.id === id); if (!confirm('Delete this photo? Posts already approved keep their image.')) return; await supabase.storage.from(BUCKET).remove([ph.path]).catch(() => {}); await del('mk_photos/' + id); }
  else if (act === 'ig-check') busy('ig', async () => { const r = await api('ig_check'); toast(`Instagram OK: @${r.username || r.name}`); });
  else if (act === 'gbp-connect') connectGBP().catch(err => toast(err.message));
  else if (act === 'gbp-locs') busy('locs', loadLocations);
  else if (act === 'gbp-setloc') { const s = $('#gbp_loc'); await api('gbp_set_location', { location: s.value, title: s.selectedOptions[0]?.dataset.title }); M.locations = null; M.status = await api('status'); toast('Location saved.'); render(); }
  else if (act === 'gbp-off') { if (!confirm('Disconnect Google Business Profile?')) return; await api('gbp_disconnect'); M.status = await api('status'); render(); }
});
document.addEventListener('change', async e => {
  const t = e.target;
  if (t.dataset.plat) { const p = findPost(t.dataset.id); await save('mk_posts/' + p.id, { ...p, platforms: { ...p.platforms, [t.dataset.plat]: t.checked } }); return; }
  if (t.dataset.phcar !== undefined) { const ph = M.photos.find(x => x.id === t.dataset.phcar); await save('mk_photos/' + ph.id, { ...ph, car_id: t.value || null }); return; }
  if (t.dataset.phkind !== undefined) { const ph = M.photos.find(x => x.id === t.dataset.phkind); await save('mk_photos/' + ph.id, { ...ph, kind: t.value }); return; }
  if (t.dataset.eplat && M.edit) { M.edit.platforms = { ...M.edit.platforms, [t.dataset.eplat]: t.checked }; M.edit._dirty = true; t.closest('.pchip')?.classList.toggle('on', t.checked); return; }
  if (t.dataset.e && M.edit) { editField(t); if (t.dataset.e === 'template' || t.dataset.e === 'date') render(); }
  if (t.name === 'lang' || t.name === 'car') t.closest('.pchip')?.classList.toggle('on', t.checked);
});
document.addEventListener('input', e => { const t = e.target; if (t.dataset.e && M.edit && t.tagName !== 'SELECT') editField(t); });
function editField(t) {
  const k = t.dataset.e, p = M.edit; p._dirty = true;
  if (k === 'theme') p.event = { ...(p.event || { name: p.headline }), theme: t.value };
  else p[k] = t.value;
  if (['headline', 'subline', 'badge', 'template', 'theme'].includes(k)) drawPreview();
}
document.addEventListener('submit', async e => {
  if (e.target.id === 'gateform') return;
  if (e.target.id === 'brandform') { e.preventDefault(); if (await save('mk_settings/brand', readBrandForm(e.target))) toast('Saved. Remake drafts to use the new settings.'); }
});

/* ---------- sign-in ---------- */
function showGate(msg) { $('#gate').hidden = false; $('#main').hidden = true; $('#g_err').textContent = msg || ''; $('#g_btn').disabled = false; $('#g_btn').textContent = 'Sign in'; }
async function begin(session) {
  $('#gate').hidden = true; $('#main').hidden = false; $('#who').textContent = session.user.email;
  start();
}
async function boot() {
  $('#gateform').addEventListener('submit', async e => {
    e.preventDefault(); const email = $('#g_email').value.trim(), password = $('#g_pass').value;
    if (!email || !password) { $('#g_err').textContent = 'Enter your email and password.'; return; }
    $('#g_btn').disabled = true; $('#g_btn').textContent = 'Signing in…';
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { showGate('Wrong email or password.'); return; }
    begin(data.session);
  });
  $('#signout').addEventListener('click', async () => { await supabase.auth.signOut(); location.reload(); });
  const { data: { session } } = await supabase.auth.getSession();
  if (session) begin(session); else showGate('');
}
boot();
