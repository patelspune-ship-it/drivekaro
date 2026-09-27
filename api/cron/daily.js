// Daily summary email. Vercel Cron calls this every morning (see vercel.json; needs CRON_SECRET).
// The owner can also trigger it from the desk (Settings → Send test email) with their sign-in token.
// Email goes through Resend (RESEND_API_KEY). Recipient: Settings "Daily summary email", else SUMMARY_EMAIL.
import { HttpError, admin, requireOwner, fail } from '../_lib/esign.js';
import { daySummary, summaryHTML, summaryText, istYmd } from '../../src/desk/summary.js';

export default async function handler(req, res) {
  try {
    const sb = admin();
    const auth = req.headers.authorization || '';
    const fromCron = !!process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`;
    if (!fromCron) await requireOwner(req, sb);

    const { data, error } = await sb.from('desk_docs').select('collection, id, data').in('collection', ['bookings', 'fleet', 'settings']).range(0, 9999);
    if (error) throw new HttpError(500, 'Database error: ' + error.message);
    const rows = data || [];
    const bookings = rows.filter(r => r.collection === 'bookings').map(r => ({ id: r.id, ...r.data }));
    const fleet = rows.filter(r => r.collection === 'fleet').map(r => ({ id: r.id, ...r.data }));
    const settings = rows.find(r => r.collection === 'settings' && r.id === 'business')?.data || {};

    const S = daySummary({ bookings, fleet, settings });
    const to = String(settings.summary_email || process.env.SUMMARY_EMAIL || '').trim();
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new HttpError(500, 'Email is not set up: add RESEND_API_KEY in Vercel.');
    if (!to) throw new HttpError(400, 'Add the daily summary email address in Settings.');
    const origin = process.env.SITE_URL || `https://${req.headers['x-forwarded-host'] || req.headers.host || 'drivekaro.in'}`;
    const subject = `DriveKaro today: ${S.pickupsToday.length} pickup${S.pickupsToday.length === 1 ? '' : 's'}, ${S.returnsToday.length + S.overdue.length} return${S.returnsToday.length + S.overdue.length === 1 ? '' : 's'}${S.overdue.length ? `, ${S.overdue.length} overdue` : ''}`;
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || 'DriveKaro Desk <onboarding@resend.dev>',
        to: to.split(/[,;\s]+/).filter(Boolean),
        subject,
        html: summaryHTML(S, { fleet, settings, origin }),
        text: summaryText(S, { fleet, settings }).replace(/\*/g, ''),
      }),
    });
    let out = {}; try { out = await r.json(); } catch { /* ignore */ }
    if (!r.ok) throw new HttpError(502, 'Email service: ' + (out.message || out.error || `HTTP ${r.status}`));
    res.status(200).json({ ok: true, to, date: istYmd(), id: out.id || null });
  } catch (e) { fail(res, e); }
}
