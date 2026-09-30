// POST /api/esign/send  { bookingId, pdfBase64 }
// Sends the booking's agreement PDF to Leegality for Aadhaar eSign and saves the signing links.
import { HttpError, cfg, admin, body, requireOwnerOrStaff, getDoc, saveDoc, leegality, buildInvitees, fail } from '../_lib/esign.js';
import { staffView } from '../_lib/staff.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Use POST.');
    const c = cfg();
    if (!c.token || !c.profileId) throw new HttpError(500, 'Leegality is not set up yet: add LEEGALITY_AUTH_TOKEN and LEEGALITY_PROFILE_ID in Vercel.');
    const sb = admin();
    const who = await requireOwnerOrStaff(req, sb);
    const { bookingId, pdfBase64 } = body(req);
    if (!bookingId) throw new HttpError(400, 'Missing booking.');
    if (typeof pdfBase64 !== 'string' || !pdfBase64.startsWith('JVBER')) throw new HttpError(400, 'The agreement PDF is missing or invalid.');
    if (pdfBase64.length > 19_000_000) throw new HttpError(413, 'The agreement PDF is too large.');

    const b = await getDoc(sb, 'bookings', bookingId);
    if (!b) throw new HttpError(404, 'Booking not found.');
    if (!['ready', 'sent'].includes(b.status)) throw new HttpError(409, 'Only bookings marked "Agreement ready" can be sent for eSign.');
    if (String(b.phone || '').replace(/\D/g, '').length < 10) throw new HttpError(400, "The customer's mobile number is missing.");
    const settings = (await getDoc(sb, 'settings', 'business')) || {};

    const r = await leegality('/v3.0/sign/request', {
      method: 'POST',
      json: {
        profileId: c.profileId,
        file: { name: `DriveKaro Rental Agreement ${b.id}`, file: pdfBase64 },
        invitees: buildInvitees(b, settings, c),
        irn: b.id,
      },
    });
    const d = r.data || {};
    const now = new Date().toISOString();
    const esign = {
      provider: 'leegality',
      env: c.base.includes('sandbox') ? 'sandbox' : 'production',
      document_id: d.documentId,
      state: 'sent',
      sent_at: now,
      invitees: (d.invitees || []).map((x, i) => ({
        role: i === 0 ? 'customer' : 'owner', name: x.name, phone: x.phone || '', email: x.email || '',
        sign_url: x.signUrl, expiry: x.expiryDate || null, signed: false,
      })),
      events: [],
      previous: b.esign?.document_id ? [...(b.esign.previous || []), b.esign.document_id].slice(-5) : (b.esign?.previous || []),
    };
    const updated = { ...b, status: 'sent', sent_at: now, esign_doc_id: d.documentId, esign, updated_at: now };
    await saveDoc(sb, 'bookings', b.id, updated);
    res.status(200).json({ ok: true, booking: who.role === 'staff' ? staffView(updated) : updated });
  } catch (e) { fail(res, e); }
}
