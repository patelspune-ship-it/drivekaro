// POST /api/staff  { action, ... }
// One route for the staff (pickup / return) app and for the owner managing staff accounts.
// Staff never read the database directly: they get only their day's bookings, without commission or internal notes.
import { HttpError, admin, body, requireOwnerOrStaff, getDoc, saveDoc, fail } from './_lib/esign.js';
import { staffView, inStaffScope, applyStaffPatch, staffEmail, norm10, staffUpload, exchangeCode, accessToken, driveAbout, KYC_FIELDS } from './_lib/staff.js';

const ownerOnly = who => { if (who.role !== 'owner') throw new HttpError(403, 'Only the owner can do this.'); };

async function listCollection(sb, collection) {
  const { data, error } = await sb.from('desk_docs').select('id, data').eq('collection', collection).range(0, 9999);
  if (error) throw new HttpError(500, 'Database error: ' + error.message);
  return (data || []).map(r => ({ id: r.id, ...r.data }));
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Use POST.');
    const sb = admin();
    const who = await requireOwnerOrStaff(req, sb);
    const input = body(req);
    const action = input.action;

    /* ----- everyone signed in (owner or staff) ----- */
    if (action === 'me') {
      return res.status(200).json({ role: who.role, name: who.name });
    }
    if (action === 'tasks') {
      const [bookings, fleet] = await Promise.all([listCollection(sb, 'bookings'), listCollection(sb, 'fleet')]);
      const settings = (await getDoc(sb, 'settings', 'business')) || {};
      const drive = await getDoc(sb, 'secrets', 'drive_server');
      return res.status(200).json({
        role: who.role, name: who.name,
        bookings: bookings.filter(b => inStaffScope(b)).map(staffView),
        fleet: fleet.map(c => ({ ...c })),
        settings,
        photos_ready: !!drive?.refresh_token,
      });
    }
    if (action === 'save') {
      const b = await getDoc(sb, 'bookings', input.bookingId);
      if (!b) throw new HttpError(404, 'Booking not found.');
      if (who.role === 'staff' && !inStaffScope(b)) throw new HttpError(403, 'This booking is not in your list.');
      const next = applyStaffPatch(b, input, who);
      await saveDoc(sb, 'bookings', b.id, next);
      // Keep the customer's profile in step with the KYC typed by staff (only filled values overwrite).
      const cid = norm10(next.phone);
      if (cid.length === 10 && input.patch && KYC_FIELDS.some(k => k in input.patch)) {
        const prev = (await getDoc(sb, 'customers', cid)) || { id: cid, created_at: new Date().toISOString(), source: 'staff' };
        const doc = { ...prev, id: cid, phone: next.phone, updated_at: new Date().toISOString() };
        for (const k of ['name', 'father', 'dob', 'alt_phone', 'email', 'address', 'emergency', 'dl', 'dl_till', 'rto', 'id_type', 'aadhaar4']) if (String(next[k] ?? '').trim()) doc[k] = next[k];
        await saveDoc(sb, 'customers', cid, doc);
        if (!next.customer_id) { next.customer_id = cid; await saveDoc(sb, 'bookings', b.id, next); }
      }
      return res.status(200).json({ booking: who.role === 'staff' ? staffView(next) : next });
    }
    if (action === 'upload') {
      const b = await getDoc(sb, 'bookings', input.bookingId);
      if (!b) throw new HttpError(404, 'Booking not found.');
      if (who.role === 'staff' && !inStaffScope(b)) throw new HttpError(403, 'This booking is not in your list.');
      const r = await staffUpload(sb, b, input, who);
      let next = b;
      if (input.kind === 'kyc') {
        if (!b.customer_id) { next = { ...b, customer_id: r.customer_id }; await saveDoc(sb, 'bookings', b.id, next); }
      } else {
        const fresh = (await getDoc(sb, 'bookings', b.id)) || b;
        next = { ...fresh, photos_folder_id: r.folder, photos: [...(fresh.photos || []), r.entry], updated_at: new Date().toISOString() };
        await saveDoc(sb, 'bookings', b.id, next);
      }
      return res.status(200).json({ entry: r.entry, booking: who.role === 'staff' ? staffView(next) : next });
    }

    /* ----- owner only ----- */
    ownerOnly(who);
    if (action === 'staff_create') {
      const name = String(input.name || '').trim(), mobile = norm10(input.mobile), password = String(input.password || '');
      if (!name) throw new HttpError(400, 'Enter the staff member\'s name.');
      if (mobile.length !== 10) throw new HttpError(400, 'Enter a 10-digit mobile number.');
      if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters.');
      const email = staffEmail(mobile);
      const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { staff: true, name } });
      if (error) throw new HttpError(400, /already/i.test(error.message) ? 'A staff login with this mobile number already exists.' : error.message);
      const now = new Date().toISOString();
      const doc = { id: data.user.id, name, mobile, email, active: true, created_at: now, updated_at: now };
      await saveDoc(sb, 'staff', data.user.id, doc);
      return res.status(200).json({ staff: doc });
    }
    if (action === 'staff_update') {
      const st = await getDoc(sb, 'staff', input.id);
      if (!st) throw new HttpError(404, 'Staff member not found.');
      const upd = {};
      if (input.password) { if (String(input.password).length < 8) throw new HttpError(400, 'Password must be at least 8 characters.'); upd.password = String(input.password); }
      if (typeof input.active === 'boolean') upd.ban_duration = input.active ? 'none' : '876000h';
      const mobile = input.mobile ? norm10(input.mobile) : st.mobile;
      if (input.mobile && mobile.length !== 10) throw new HttpError(400, 'Enter a 10-digit mobile number.');
      if (mobile !== st.mobile) upd.email = staffEmail(mobile), upd.email_confirm = true;
      if (Object.keys(upd).length) { const { error } = await sb.auth.admin.updateUserById(st.id, upd); if (error) throw new HttpError(400, error.message); }
      const doc = { ...st, name: String(input.name || st.name).trim(), mobile, email: staffEmail(mobile), active: typeof input.active === 'boolean' ? input.active : st.active, updated_at: new Date().toISOString() };
      await saveDoc(sb, 'staff', st.id, doc);
      return res.status(200).json({ staff: doc });
    }
    if (action === 'staff_delete') {
      const st = await getDoc(sb, 'staff', input.id);
      if (!st) throw new HttpError(404, 'Staff member not found.');
      await sb.auth.admin.deleteUser(st.id).catch(() => {});
      const { error } = await sb.from('desk_docs').delete().eq('collection', 'staff').eq('id', st.id);
      if (error) throw new HttpError(500, 'Database error: ' + error.message);
      return res.status(200).json({ ok: true });
    }
    if (action === 'drive_connect') {
      const t = await exchangeCode(String(input.code || ''));
      const prev = (await getDoc(sb, 'secrets', 'drive_server')) || {};
      const refresh = t.refresh_token || prev.refresh_token;
      if (!refresh) throw new HttpError(400, 'Google did not give long-term access. Open myaccount.google.com → Security → Third-party access, remove DriveKaro, then connect again.');
      const user = await driveAbout(t.access_token);
      await saveDoc(sb, 'secrets', 'drive_server', { refresh_token: refresh, email: user.emailAddress || '', connected_at: new Date().toISOString() });
      return res.status(200).json({ ok: true, email: user.emailAddress || '' });
    }
    if (action === 'drive_status') {
      const d = await getDoc(sb, 'secrets', 'drive_server');
      if (!d?.refresh_token) return res.status(200).json({ connected: false });
      try { await accessToken(sb); return res.status(200).json({ connected: true, email: d.email || '', connected_at: d.connected_at }); }
      catch (e) { return res.status(200).json({ connected: false, error: e.message }); }
    }
    if (action === 'drive_disconnect') {
      const { error } = await sb.from('desk_docs').delete().eq('collection', 'secrets').eq('id', 'drive_server');
      if (error) throw new HttpError(500, 'Database error: ' + error.message);
      return res.status(200).json({ ok: true });
    }
    throw new HttpError(400, 'Unknown action.');
  } catch (e) { fail(res, e); }
}
