// POST /api/esign/file  { bookingId, type: "signed" | "audit" }
// Returns a short-lived download link for the stored signed agreement or audit trail.
import { HttpError, admin, body, requireOwner, getDoc, fail } from '../_lib/esign.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Use POST.');
    const sb = admin();
    await requireOwner(req, sb);
    const { bookingId, type } = body(req);
    const b = await getDoc(sb, 'bookings', bookingId);
    const path = b?.esign?.files?.[type === 'audit' ? 'audit' : 'signed'];
    if (!path) throw new HttpError(404, 'The signed file is not available yet. Tap "Refresh status" first.');
    const { data, error } = await sb.storage.from('esign').createSignedUrl(path, 120);
    if (error) throw new HttpError(500, 'Storage error: ' + error.message);
    res.status(200).json({ ok: true, url: data.signedUrl });
  } catch (e) { fail(res, e); }
}
