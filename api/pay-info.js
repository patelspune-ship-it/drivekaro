// GET /api/pay-info  → the business's official UPI ID for the public /pay page.
// Only public details are returned (the same ones printed on every invoice).
import { admin, getDoc, fail } from './_lib/esign.js';

export default async function handler(req, res) {
  try {
    const sb = admin();
    const s = (await getDoc(sb, 'settings', 'business')) || {};
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.status(200).json({ upi: s.official_upi || '', name: s.legal_name || 'DRIVEKARO SELF DRIVE CAR RENTAL', short: s.business_name || 'DriveKaro', phone: s.support_phone || '' });
  } catch (e) { fail(res, e); }
}
