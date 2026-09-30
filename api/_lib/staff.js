// Helpers for staff access (pickup / return people) and server-side Google Drive uploads.
import { HttpError, getDoc, saveDoc } from './esign.js';
import { parseLocal, istDayStart, DAY } from '../../src/desk/summary.js';

export const STAFF_EMAIL_DOMAIN = 'staff.drivekaro.in';
export const norm10 = p => String(p || '').replace(/\D/g, '').slice(-10);
export const staffEmail = mobile => `s${norm10(mobile)}@${STAFF_EMAIL_DOMAIN}`;

// Fields staff never receive.
const HIDDEN = ['commission', 'op_payouts', 'notes', 'example'];
export function staffView(b) {
  if (!b) return b;
  const out = { ...b };
  for (const k of HIDDEN) delete out[k];
  return out;
}

const OPEN = ['confirmed', 'draft', 'ready', 'sent', 'signed'];
// Bookings staff can see: pickups from yesterday to the end of tomorrow, every car still out,
// and anything handed over or returned today (so they can finish what they started).
export function inStaffScope(b, now = new Date()) {
  if (!b || b.status === 'cancelled' || b.example) return false;
  const t0 = istDayStart(now), from = new Date(t0.getTime() - DAY), to = new Date(t0.getTime() + 2 * DAY);
  const p = parseLocal(b.pickup), d = parseLocal(b.drop);
  if (OPEN.includes(b.status)) return p >= from && p < to;
  if (b.status === 'handed') return true;
  if (b.status === 'returned') { const r = new Date(b.returned_at || b.return_at || 0); return r >= t0; }
  return false;
}

export const KYC_FIELDS = ['name', 'father', 'dob', 'alt_phone', 'email', 'address', 'emergency', 'dl', 'dl_till', 'rto', 'id_type', 'aadhaar4',
  'addl_name', 'addl_dob', 'addl_phone', 'addl_dl', 'addl_dl_till'];
export const HANDOVER_FIELDS = ['odo', 'fuel', 'keys', 'ext_damage', 'int_damage', 'deposit_type', 'deposit', 'dep_bike_no', 'dep_bike_model', 'dep_doc_type', 'dep_doc_details', 'trip_to'];
export const RETURN_FIELDS = ['odo_return', 'return_at', 'fuel_return', 'return_damage'];
export const STAFF_EXTRAS = ['Extra kilometres', 'Late return', 'Night handling', 'Fuel shortfall'];
const PAYMODES = ['UPI', 'Cash', 'Card', 'Bank transfer'];

const clip = (v, n = 300) => String(v ?? '').slice(0, n);

// Apply a staff member's changes to a booking, allowing only the fields and steps staff may touch.
export function applyStaffPatch(b, input, who, now = new Date().toISOString()) {
  const next = { ...b };
  const log = [];
  const patch = input.patch || {};
  for (const k of [...KYC_FIELDS, ...HANDOVER_FIELDS, ...RETURN_FIELDS]) {
    if (!(k in patch)) continue;
    let v = patch[k];
    if (k === 'deposit') v = v === '' || v == null ? '' : Math.max(0, Math.round(Number(v) || 0));
    else if (k === 'aadhaar4') { v = String(v || '').replace(/\D/g, ''); if (v && v.length !== 4) throw new HttpError(400, 'Enter only the last 4 digits of the ID.'); }
    else v = clip(v, k.includes('damage') || k === 'address' ? 600 : 120);
    if (['dl', 'addl_dl', 'dep_bike_no'].includes(k)) v = String(v).toUpperCase();
    next[k] = v;
  }
  if (Object.keys(patch).length) log.push('details');
  if (input.payment) {
    const p = input.payment, amt = Math.round(Number(p.amount) || 0);
    if (!['payment', 'deposit_in'].includes(p.kind)) throw new HttpError(400, 'Staff can record rent or deposit payments only.');
    if (!(amt > 0 && amt <= 500000)) throw new HttpError(400, 'Enter a valid amount.');
    const mode = PAYMODES.includes(p.mode) ? p.mode : 'UPI';
    next.payments = [...(b.payments || []), { id: 'p' + Date.now().toString(36), kind: p.kind, amount: amt, mode, ref: clip(p.ref, 60), at: clip(p.at, 20) || now.slice(0, 16), by: who.name }];
    log.push(`${p.kind === 'deposit_in' ? 'deposit' : 'payment'} ${amt} ${mode}`);
  }
  if (input.extra) {
    const x = input.extra, amt = Math.round(Number(x.amount) || 0);
    if (!STAFF_EXTRAS.includes(x.label)) throw new HttpError(400, 'Staff can add only the suggested charges.');
    if (!(amt > 0 && amt <= 100000)) throw new HttpError(400, 'Enter a valid amount.');
    if ((b.extras || []).some(e => e.label === x.label)) throw new HttpError(409, `${x.label} is already added.`);
    next.extras = [...(b.extras || []), { id: 'x' + Date.now().toString(36), label: x.label, amount: amt, note: clip(x.note, 80), by: who.name }];
    log.push(`charge ${x.label} ${amt}`);
  }
  if (input.status) {
    const to = input.status, from = b.status;
    const ok = (to === 'ready' && ['confirmed', 'draft'].includes(from)) || (to === 'handed' && from === 'signed') || (to === 'returned' && from === 'handed');
    if (!ok) throw new HttpError(409, to === 'handed' ? 'The agreement must be signed before handover.' : 'This step is not allowed now.');
    next.status = to;
    next[to + '_at'] = now;
    if (to === 'handed') next.handed_by = who.name;
    if (to === 'returned') { next.returned_by = who.name; if (!next.return_at) next.return_at = now.slice(0, 16); }
    log.push('status ' + to);
  }
  next.updated_at = now;
  next.staff_log = [...(b.staff_log || []), ...(log.length ? [{ at: now, by: who.name, role: who.role, did: log.join(', ') }] : [])].slice(-60);
  return next;
}

/* ---------- Google Drive (server side, owner's Drive, drive.file scope) ---------- */
const DAPI = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink';
const FOLDER = 'application/vnd.google-apps.folder';

export function googleCreds() {
  return { id: process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '', secret: process.env.GOOGLE_CLIENT_SECRET || '' };
}
export async function exchangeCode(code) {
  const c = googleCreds();
  if (!c.id || !c.secret) throw new HttpError(500, 'Add GOOGLE_CLIENT_SECRET in Vercel first (Google Cloud → Credentials → your OAuth client).');
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: c.id, client_secret: c.secret, redirect_uri: 'postmessage', grant_type: 'authorization_code' }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new HttpError(502, 'Google: ' + (j.error_description || j.error || r.status));
  return j;
}
async function accessToken(sb) {
  const meta = (await getDoc(sb, 'secrets', 'drive_server')) || {};
  if (!meta.refresh_token) throw new HttpError(409, 'Photo upload is not set up yet. Ask the owner to connect Google Drive in Settings.');
  const c = googleCreds();
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: c.id, client_secret: c.secret, refresh_token: meta.refresh_token, grant_type: 'refresh_token' }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new HttpError(502, 'Google Drive connection expired. Ask the owner to connect Drive again in Settings.');
  return j.access_token;
}
async function gcall(token, url, opts = {}) {
  const r = await fetch(url, { ...opts, headers: { Authorization: 'Bearer ' + token, ...(opts.headers || {}) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new HttpError(r.status === 404 ? 404 : 502, 'Google Drive: ' + (j.error?.message || r.status)); throw e; }
  return j;
}
const q = s => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
async function folderAlive(token, id) {
  if (!id) return false;
  try { const f = await gcall(token, `${DAPI}/files/${encodeURIComponent(id)}?fields=id,trashed`); return !f.trashed; } catch { return false; }
}
async function findOrCreate(token, name, parent) {
  const where = `name='${q(name)}' and mimeType='${FOLDER}' and trashed=false and '${parent || 'root'}' in parents`;
  const found = await gcall(token, `${DAPI}/files?q=${encodeURIComponent(where)}&fields=files(id)&pageSize=1&spaces=drive`);
  if (found.files?.length) return found.files[0].id;
  const made = await gcall(token, `${DAPI}/files?fields=id`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, mimeType: FOLDER, ...(parent ? { parents: [parent] } : {}) }) });
  return made.id;
}
async function uploadBuffer(token, buf, name, mime, folderId) {
  const boundary = 'dk' + Math.random().toString(36).slice(2);
  const meta = JSON.stringify({ name, parents: [folderId] });
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`),
    buf, Buffer.from(`\r\n--${boundary}--`)]);
  return gcall(token, UPLOAD, { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body });
}
const MIMES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
// kind "kyc": into the customer's KYC folder (same folders the desk uses); kind "car": handover/return photos of the booking.
export async function staffUpload(sb, b, { kind, docType, stage, mime, dataBase64 }, who) {
  if (!MIMES.includes(mime)) throw new HttpError(400, 'Send a photo (JPG/PNG) or a PDF.');
  const buf = Buffer.from(String(dataBase64 || ''), 'base64');
  if (!buf.length || buf.length > 4_000_000) throw new HttpError(413, 'The photo is too large. Try again (it is resized automatically).');
  const token = await accessToken(sb);
  const ext = mime === 'application/pdf' ? 'pdf' : mime.split('/')[1].replace('jpeg', 'jpg');
  const day = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();
  if (kind === 'kyc') {
    const cid = norm10(b.phone);
    if (cid.length !== 10) throw new HttpError(400, "The customer's mobile number is missing.");
    const cust = (await getDoc(sb, 'customers', cid)) || { id: cid, phone: b.phone, name: b.name, created_at: now, source: 'staff' };
    const dmeta = (await getDoc(sb, 'meta', 'drive')) || {};
    const root = (await folderAlive(token, dmeta.root_id)) ? dmeta.root_id : await findOrCreate(token, 'DriveKaro Customer KYC', null);
    if (root !== dmeta.root_id) await saveDoc(sb, 'meta', 'drive', { ...dmeta, root_id: root });
    const folder = (await folderAlive(token, cust.drive_folder_id)) ? cust.drive_folder_id : await findOrCreate(token, `${cust.name || b.name || 'Customer'} - ${cid}`, root);
    const type = clip(docType || 'Other', 40);
    const f = await uploadBuffer(token, buf, `${type} - ${cust.name || b.name || cid} - ${day}.${ext}`, mime, folder);
    const entry = { id: f.id, type, name: f.name, link: f.webViewLink, mime: f.mimeType, size: Number(f.size) || buf.length, at: now, by: who.name };
    await saveDoc(sb, 'customers', cid, { ...cust, name: cust.name || b.name || '', drive_folder_id: folder, docs: [...(cust.docs || []), entry], updated_at: now });
    return { entry, customer_id: cid };
  }
  const pmeta = (await getDoc(sb, 'meta', 'drive_photos')) || {};
  const root = (await folderAlive(token, pmeta.root_id)) ? pmeta.root_id : await findOrCreate(token, 'DriveKaro Handover Photos', null);
  if (root !== pmeta.root_id) await saveDoc(sb, 'meta', 'drive_photos', { ...pmeta, root_id: root });
  const plate = b.car_snapshot?.plate || '';
  const folder = (await folderAlive(token, b.photos_folder_id)) ? b.photos_folder_id : await findOrCreate(token, `${b.id} ${plate} ${b.name || ''}`.trim(), root);
  const st = stage === 'return' ? 'return' : 'pickup';
  const n = (b.photos || []).filter(p => p.stage === st).length + 1;
  const f = await uploadBuffer(token, buf, `${st === 'return' ? 'Return' : 'Pickup'} ${n} - ${plate} - ${day}.${ext}`, mime, folder);
  const entry = { id: f.id, name: f.name, link: f.webViewLink, stage: st, at: now, by: who.name };
  return { entry, folder };
}
export async function driveAbout(token) {
  try { const a = await gcall(token, `${DAPI}/about?fields=user(emailAddress,displayName)`); return a.user || {}; } catch { return {}; }
}
export { accessToken };
