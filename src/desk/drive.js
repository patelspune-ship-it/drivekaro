// Google Drive storage for customer KYC documents.
// Uses Google Identity Services (browser sign-in) with the drive.file scope:
// the desk can only see and manage files and folders it created itself.
// Files go to:  My Drive / DriveKaro Customer KYC / <Customer name - phone> / ...

const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink,createdTime';
const FOLDER = 'application/vnd.google-apps.folder';
export const ROOT_FOLDER_NAME = 'DriveKaro Customer KYC';

let clientId = '';
let token = null;
let expiry = 0;

try {
  const saved = JSON.parse(sessionStorage.getItem('dk_drive') || 'null');
  if (saved && saved.expiry > Date.now() + 60000) { token = saved.token; expiry = saved.expiry; }
} catch { /* storage blocked: sign in again when needed */ }

export function configureDrive(id) { clientId = id || ''; }
export function driveConfigured() { return !!clientId; }
export function driveConnected() { return !!token && Date.now() < expiry - 60000; }

function loadGis() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve();
    const existing = document.querySelector('script[data-gis]');
    const s = existing || document.createElement('script');
    s.addEventListener('load', () => resolve());
    s.addEventListener('error', () => reject(new Error('Could not load Google sign-in.')));
    if (!existing) { s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.dataset.gis = '1'; document.head.appendChild(s); }
  });
}

// Load Google's script early so the sign-in popup can open straight from a tap.
export function preloadDrive() { if (clientId) loadGis().catch(() => {}); }

// Must be called directly from a click handler (browsers block popups otherwise).
export function connectDrive() {
  return new Promise((resolve, reject) => {
    if (!clientId) return reject(new Error('Google Drive is not set up yet.'));
    if (!window.google?.accounts?.oauth2) { loadGis().catch(() => {}); return reject(new Error('Google sign-in is still loading. Tap again in a moment.')); }
    const tc = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: r => {
        if (r.error) return reject(new Error(r.error_description || r.error));
        token = r.access_token;
        expiry = Date.now() + (Number(r.expires_in) || 3600) * 1000;
        try { sessionStorage.setItem('dk_drive', JSON.stringify({ token, expiry })); } catch { /* ignore */ }
        resolve();
      },
      error_callback: e => reject(new Error(e?.type === 'popup_closed' ? 'Google sign-in was closed.' : (e?.message || 'Google sign-in failed.'))),
    });
    tc.requestAccessToken({ prompt: '' });
  });
}

export function disconnectDrive() {
  if (token && window.google?.accounts?.oauth2) window.google.accounts.oauth2.revoke(token, () => {});
  token = null; expiry = 0;
  try { sessionStorage.removeItem('dk_drive'); } catch { /* ignore */ }
}

class DriveError extends Error { constructor(msg, code) { super(msg); this.code = code; } }

async function call(url, opts = {}) {
  if (!driveConnected()) throw new DriveError('Connect Google Drive first.', 'auth');
  const res = await fetch(url, { ...opts, headers: { Authorization: 'Bearer ' + token, ...(opts.headers || {}) } });
  if (res.status === 401) { token = null; expiry = 0; throw new DriveError('Google Drive sign-in expired. Connect again.', 'auth'); }
  if (res.status === 404) throw new DriveError('Not found in Google Drive.', 'not_found');
  if (!res.ok) {
    let msg = 'Google Drive error ' + res.status;
    try { const j = await res.json(); msg = j.error?.message || msg; } catch { /* ignore */ }
    throw new DriveError(msg, res.status === 403 ? 'forbidden' : 'error');
  }
  return res.status === 204 ? null : res.json();
}

const q = s => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

async function folderAlive(id) {
  if (!id) return false;
  try { const f = await call(`${API}/files/${encodeURIComponent(id)}?fields=id,trashed`); return !f.trashed; }
  catch (e) { if (e.code === 'not_found' || e.code === 'forbidden') return false; throw e; }
}

async function findOrCreateFolder(name, parentId) {
  const where = `name='${q(name)}' and mimeType='${FOLDER}' and trashed=false and '${parentId || 'root'}' in parents`;
  const found = await call(`${API}/files?q=${encodeURIComponent(where)}&fields=files(id,name)&pageSize=1&spaces=drive`);
  if (found.files?.length) return found.files[0].id;
  const made = await call(`${API}/files?fields=id`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: FOLDER, ...(parentId ? { parents: [parentId] } : {}) }),
  });
  return made.id;
}

// Returns {rootId, folderId}. Pass the ids you stored last time; they are reused if still valid.
export async function ensureCustomerFolder({ rootId, folderId, folderName }) {
  const root = (await folderAlive(rootId)) ? rootId : await findOrCreateFolder(ROOT_FOLDER_NAME, null);
  const folder = (await folderAlive(folderId)) ? folderId : await findOrCreateFolder(folderName, root);
  return { rootId: root, folderId: folder };
}

// Phone photos are often 3–6 MB; shrink big images so uploads are quick on mobile data.
export async function shrinkImage(file, maxSide = 2000, quality = 0.85) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 1.5 * 1024 * 1024) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale); canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', quality));
    return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
  } catch { return file; }
}

export async function uploadFile(file, name, folderId) {
  const meta = { name, parents: [folderId] };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
  form.append('file', file);
  return call(UPLOAD, { method: 'POST', body: form });
}

export async function trashFile(id) {
  try {
    await call(`${API}/files/${encodeURIComponent(id)}?fields=id`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }),
    });
  } catch (e) { if (e.code !== 'not_found') throw e; }
}

export const folderUrl = id => `https://drive.google.com/drive/folders/${id}`;
