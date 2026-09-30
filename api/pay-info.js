// GET /api/pay-info  → the business's official UPI ID for the public /pay page.
// Only public details are returned (the same ones printed on every invoice).
import { admin, getDoc, fail } from './_lib/esign.js';

export default async function handler(req, res) {
  try {
    const sb = admin();
    const s = (await getDoc(sb, 'settings', 'business')) || {};
    res.setHeader('Cache-Control', 'public, max-age=300');
    // Several UPI IDs can be saved; the private names (labels) are never sent.
    let upis = (s.upi_ids || []).filter(u => u && u.upi).map(u => ({ id: u.id, upi: u.upi, payee: u.payee || '' }));
    if (!upis.length && s.official_upi) upis = [{ id: 'main', upi: s.official_upi, payee: '' }];
    const def = upis.find(u => u.id === s.upi_default) || upis[0] || null;
    res.status(200).json({ upi: def ? def.upi : '', upis, default_id: def ? def.id : '', name: s.legal_name || 'DRIVEKARO SELF DRIVE CAR RENTAL', short: s.business_name || 'DriveKaro', phone: s.support_phone || '' });
  } catch (e) { fail(res, e); }
}
