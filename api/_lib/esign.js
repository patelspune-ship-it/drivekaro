// Shared helpers for the Leegality eSign API routes.
// Files in api/_lib are not exposed as routes by Vercel.
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function cfg() {
  return {
    base: (process.env.LEEGALITY_BASE_URL || 'https://app1.leegality.com/api').replace(/\/+$/, ''),
    token: process.env.LEEGALITY_AUTH_TOKEN || '',
    salt: process.env.LEEGALITY_PRIVATE_SALT || '',
    profileId: process.env.LEEGALITY_PROFILE_ID || '',
    // Set LEEGALITY_OWNER_SIGNS=no if the workflow signs for DriveKaro automatically (no second invitee).
    ownerSigns: (process.env.LEEGALITY_OWNER_SIGNS || 'yes').toLowerCase() !== 'no',
  };
}

export function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new HttpError(500, 'Supabase server key is missing: add SUPABASE_SERVICE_ROLE_KEY in Vercel.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body) { try { return JSON.parse(req.body); } catch { throw new HttpError(400, 'Invalid JSON.'); } }
  return {};
}

// Only signed-in emails from public.owners may call the desk routes.
export async function requireOwner(req, sb) {
  const h = req.headers.authorization || req.headers.Authorization || '';
  const jwt = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!jwt) throw new HttpError(401, 'Your sign-in expired. Sign in to the desk again.');
  const { data, error } = await sb.auth.getUser(jwt);
  const email = data?.user?.email;
  if (error || !email) throw new HttpError(401, 'Your sign-in expired. Sign in to the desk again.');
  const { data: rows, error: e2 } = await sb.from('owners').select('email');
  if (e2) throw new HttpError(500, 'Could not check the owners list.');
  if (!(rows || []).some(r => String(r.email).toLowerCase() === email.toLowerCase())) throw new HttpError(403, 'This account is not an owner.');
  return data.user;
}

/* desk_docs access (service role bypasses row-level security) */
export async function getDoc(sb, collection, id) {
  const { data, error } = await sb.from('desk_docs').select('data').eq('collection', collection).eq('id', id).maybeSingle();
  if (error) throw new HttpError(500, 'Database error: ' + error.message);
  return data?.data || null;
}
export async function saveDoc(sb, collection, id, doc) {
  const { error } = await sb.from('desk_docs').upsert({ collection, id, data: doc, updated_at: new Date().toISOString() });
  if (error) throw new HttpError(500, 'Database error: ' + error.message);
}
export async function findBookingByDocument(sb, documentId) {
  const { data, error } = await sb.from('desk_docs').select('id, data').eq('collection', 'bookings').eq('data->esign->>document_id', documentId).limit(1);
  if (error) throw new HttpError(500, 'Database error: ' + error.message);
  return data?.[0]?.data || null;
}

/* Leegality API */
export async function leegality(path, { method = 'GET', query, json } = {}) {
  const c = cfg();
  if (!c.token) throw new HttpError(500, 'Leegality is not set up: add LEEGALITY_AUTH_TOKEN in Vercel.');
  const url = new URL(c.base + path);
  Object.entries(query || {}).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const res = await fetch(url, {
    method,
    headers: { 'X-Auth-Token': c.token, ...(json ? { 'Content-Type': 'application/json' } : {}) },
    body: json ? JSON.stringify(json) : undefined,
  });
  let out = null;
  try { out = await res.json(); } catch { /* not JSON */ }
  if (!res.ok || !out || out.status !== 1) {
    const msg = (out?.messages || []).map(m => m.message || m.code).filter(Boolean).join('; ') || `Leegality error (HTTP ${res.status})`;
    throw new HttpError(502, 'Leegality: ' + msg);
  }
  return out;
}

// Webhook authenticity: mac = HMAC-SHA1(documentId, privateSalt).
export function macOk(documentId, mac, salt) {
  if (!documentId || !mac || !salt) return false;
  const h = crypto.createHmac('sha1', salt).update(String(documentId));
  const hex = h.digest('hex');
  const b64 = crypto.createHmac('sha1', salt).update(String(documentId)).digest('base64');
  const given = String(mac).trim();
  const eq = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  return eq(given.toLowerCase(), hex) || eq(given, b64);
}

export const norm10 = p => String(p || '').replace(/\D/g, '').slice(-10);

// Signers in the order the workflow expects: customer first, then DriveKaro.
export function buildInvitees(b, settings, c) {
  const cust = { name: String(b.name || '').trim(), phone: norm10(b.phone) };
  if (b.email) cust.email = String(b.email).trim();
  const ac = {};
  if (/^\d{4}$/.test(String(b.aadhaar4 || '')) && /aadhaar/i.test(b.id_type || 'Aadhaar')) ac.verifyTitle = String(b.aadhaar4);
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(b.dob || ''))) ac.verifyYob = String(b.dob).slice(0, 4);
  if (Object.keys(ac).length) cust.aadhaarConfig = { verifySmartName: true, ...ac };
  const list = [cust];
  // In "printed" mode DriveKaro's signature image is already on the PDF, so only the customer is invited.
  if (c.ownerSigns && settings?.owner_sign_mode !== 'printed') {
    const owner = { name: String(settings.signatory || 'DriveKaro').trim() };
    const ph = norm10(process.env.LEEGALITY_OWNER_PHONE || settings.support_phone);
    const em = process.env.LEEGALITY_OWNER_EMAIL || settings.support_email;
    if (ph.length === 10) owner.phone = ph;
    if (em) owner.email = em;
    list.push(owner);
  }
  return list;
}

// Apply one webhook event to a booking. Pure: returns a new booking object.
export function applyWebhook(b, p, now = new Date().toISOString()) {
  const r = p.request || {};
  const es = { ...(b.esign || {}) };
  const ev = {
    at: now, type: p.webhookType || null, action: r.action || null, name: r.name || null,
    signType: r.signType || null, documentStatus: p.documentStatus || null,
    error: r.error || r.rejectionMessage || (p.messages || []).map(m => m.message).filter(Boolean).join('; ') || null,
  };
  const dup = (es.events || []).some(e => e.action === ev.action && e.name === ev.name && e.documentStatus === ev.documentStatus && e.type === ev.type);
  es.events = dup ? (es.events || []) : [...(es.events || []), ev].slice(-30);
  const match = i => (r.phone && norm10(i.phone) === norm10(r.phone)) || (r.email && i.email && i.email.toLowerCase() === String(r.email).toLowerCase()) || (r.name && i.name && i.name.trim().toLowerCase() === String(r.name).trim().toLowerCase());
  es.invitees = (es.invitees || []).map(i => {
    if (!match(i)) return i;
    const a = String(r.action || '').toLowerCase();
    return { ...i, signed: i.signed || a === 'signed', rejected: a.includes('reject') || i.rejected || false, sign_type: r.signType || i.sign_type, acted_at: now };
  });
  const out = { ...b, esign: es, updated_at: now };
  const status = String(p.documentStatus || '').toLowerCase();
  const action = String(r.action || '').toLowerCase();
  if (status === 'completed') {
    es.state = 'completed'; es.completed_at = es.completed_at || now;
    if (['sent', 'ready'].includes(b.status)) { out.status = 'signed'; out.signed_at = now; }
  } else if (action.includes('reject')) {
    es.state = 'rejected'; es.last_error = ev.error || `${r.name || 'A signer'} rejected the agreement.`;
    if (b.status === 'sent') out.status = 'ready';
  } else if (r.expired || action.includes('expire')) {
    es.state = 'expired'; es.last_error = 'The signing link expired. Send it again.';
    if (b.status === 'sent') out.status = 'ready';
  } else if (p.webhookType === 'Error') {
    es.last_error = ev.error || 'Leegality reported an error.';
  } else if (es.state !== 'completed') {
    es.state = 'sent';
  }
  return out;
}

// Download the signed PDF and audit trail right away (Leegality's links last ~15 s) and keep them in the private "esign" bucket.
export async function storeSignedFiles(sb, bookingId, documentId) {
  const files = {};
  for (const [type, name] of [['DOCUMENT', 'agreement-signed.pdf'], ['AUDIT_TRAIL', 'audit-trail.pdf']]) {
    let url;
    try { url = (await leegality('/v3.3/document/fetchDocument', { query: { documentId, documentDownloadType: type } })).data?.file; }
    catch (e) { if (type === 'AUDIT_TRAIL') continue; throw e; }
    if (!url) continue;
    const res = await fetch(url);
    if (!res.ok) throw new HttpError(502, `Could not download the ${type === 'DOCUMENT' ? 'signed PDF' : 'audit trail'} from Leegality.`);
    const buf = Buffer.from(await res.arrayBuffer());
    const path = `${bookingId}/${name}`;
    const { error } = await sb.storage.from('esign').upload(path, buf, { contentType: 'application/pdf', upsert: true });
    if (error) throw new HttpError(500, 'Storage error: ' + error.message + ' (has supabase/esign_setup.sql been run?)');
    files[type === 'DOCUMENT' ? 'signed' : 'audit'] = path;
  }
  return files;
}

export function send(res, status, obj) { res.status(status).json(obj); }
export function fail(res, e) {
  const status = e instanceof HttpError ? e.status : 500;
  if (!(e instanceof HttpError)) console.error(e);
  res.status(status).json({ error: e instanceof HttpError ? e.message : 'Server error. Try again.' });
}
