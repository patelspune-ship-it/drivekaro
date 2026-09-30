// POST /api/esign/status  { bookingId }
// Manual refresh from Leegality (backup for missed webhooks).
import { HttpError, admin, body, requireOwnerOrStaff, getDoc, saveDoc, leegality, storeSignedFiles, norm10, fail } from '../_lib/esign.js';
import { staffView } from '../_lib/staff.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Use POST.');
    const sb = admin();
    const who = await requireOwnerOrStaff(req, sb);
    const { bookingId } = body(req);
    const b = await getDoc(sb, 'bookings', bookingId);
    if (!b) throw new HttpError(404, 'Booking not found.');
    const docId = b.esign?.document_id;
    if (!docId) throw new HttpError(409, 'This booking has not been sent for eSign.');

    const r = await leegality('/v3.3/document/details', { query: { documentId: docId } });
    const d = r.data || {};
    const docStatus = String(d.document?.status || d.status || d.documentStatus || '').toUpperCase();
    const invs = d.invitations || d.document?.invitations || d.invitees || [];
    const now = new Date().toISOString();
    const es = { ...b.esign, checked_at: now };
    es.invitees = (es.invitees || []).map((i, idx) => {
      const m = invs.find(x => (x.phone && norm10(x.phone) === norm10(i.phone)) || (x.email && i.email && x.email.toLowerCase() === i.email.toLowerCase()) || (x.name && x.name.trim().toLowerCase() === String(i.name).trim().toLowerCase())) || invs[idx];
      const st = m?.invitationStatus || m || {};
      return m ? { ...i, signed: !!(st.signed || i.signed), rejected: !!st.rejected, expired: !!st.expired } : i;
    });
    const next = { ...b, esign: es, updated_at: now };
    if (docStatus === 'COMPLETED') {
      es.state = 'completed'; es.completed_at = es.completed_at || now;
      if (['sent', 'ready'].includes(b.status)) { next.status = 'signed'; next.signed_at = now; }
      if (!es.files?.signed) {
        try { es.files = await storeSignedFiles(sb, b.id, docId); es.file_error = null; } catch (e) { es.file_error = e.message; }
      }
    } else if (es.invitees.some(i => i.rejected)) {
      es.state = 'rejected'; es.last_error = 'A signer rejected the agreement.';
      if (b.status === 'sent') next.status = 'ready';
    } else if (es.invitees.some(i => i.expired && !i.signed)) {
      es.state = 'expired'; es.last_error = 'The signing link expired. Send it again.';
      if (b.status === 'sent') next.status = 'ready';
    }
    await saveDoc(sb, 'bookings', b.id, next);
    res.status(200).json({ ok: true, booking: who.role === 'staff' ? staffView(next) : next, leegalityStatus: docStatus || null });
  } catch (e) { fail(res, e); }
}
