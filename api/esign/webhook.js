// POST /api/esign/webhook  (called by Leegality)
// Verifies the MAC, updates the booking, and on completion stores the signed PDF + audit trail.
import { cfg, admin, body, getDoc, saveDoc, findBookingByDocument, macOk, applyWebhook, storeSignedFiles } from '../_lib/esign.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });
  let p;
  try { p = body(req); } catch { return res.status(400).json({ error: 'Invalid JSON.' }); }
  if (!macOk(p.documentId, p.mac, cfg().salt)) return res.status(401).json({ error: 'Invalid signature.' });
  try {
    const sb = admin();
    let b = p.irn ? await getDoc(sb, 'bookings', p.irn) : null;
    if (!b || b.esign?.document_id !== p.documentId) b = await findBookingByDocument(sb, p.documentId);
    if (!b) return res.status(200).json({ ok: true, ignored: 'Unknown document' });
    let next = applyWebhook(b, p);
    if (String(p.documentStatus).toLowerCase() === 'completed' && !b.esign?.files?.signed) {
      try { next.esign.files = await storeSignedFiles(sb, b.id, p.documentId); next.esign.file_error = null; }
      catch (e) { next.esign.file_error = e.message; }
    }
    await saveDoc(sb, 'bookings', b.id, next);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Could not record the event.' }); // Leegality retries
  }
}
