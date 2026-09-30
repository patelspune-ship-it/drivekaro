// Public payment page: drivekaro.in/pay?b=<booking id>&a=<amount>
// The UPI ID always comes from the desk settings (never from the link), so a changed link can't redirect money.
import QRCode from 'qrcode';
import { upiLink } from './desk/summary.js';

const card = document.getElementById('card');
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const q = new URLSearchParams(location.search);
const ref = /^[A-Z0-9-]{4,24}$/i.test(q.get('b') || '') ? q.get('b').toUpperCase() : '';
const amt = Math.round(Number(q.get('a')));
const amount = Number.isFinite(amt) && amt > 0 && amt <= 500000 ? amt : 0;
const inr = n => '₹' + n.toLocaleString('en-IN');

function fail(msg) { card.innerHTML = `<h1>Drive<b>Karo</b></h1><p class="err">${esc(msg)}</p>`; }

(async () => {
  let info;
  try { const r = await fetch('/api/pay-info'); info = await r.json(); if (!r.ok) throw new Error(info.error || 'error'); }
  catch { fail('Could not load payment details. Please try again or contact DriveKaro.'); return; }
  const want = q.get('u') || '';
  const pick = (info.upis || []).find(u => u.id === want) || (info.upis || []).find(u => u.id === info.default_id) || (info.upi ? { upi: info.upi, payee: '' } : null);
  if (!pick || !pick.upi) { fail('Online payment is not set up yet. Please contact DriveKaro.'); return; }
  info.upi = pick.upi; const payee = pick.payee || info.name;
  const note = `${info.short || 'DriveKaro'}${ref ? ' ' + ref : ''}`;
  const link = upiLink({ upi: info.upi, name: payee, amount, note });
  const qr = await QRCode.toDataURL(link, { margin: 1, width: 440, errorCorrectionLevel: 'M' });
  const phone = String(info.phone || '').replace(/\D/g, '');
  const wa = phone ? `https://wa.me/${phone.length === 10 ? '91' + phone : phone}?text=${encodeURIComponent(`I have paid ${amount ? inr(amount) : ''} for booking ${ref}. Screenshot attached.`)}` : '';
  card.innerHTML = `
    <h1>Drive<b>Karo</b></h1>
    <div class="muted">${esc(payee)}</div>
    ${amount ? `<div class="amt">${inr(amount)}</div>` : `<div class="amt" style="font-size:24px">Enter the amount in your UPI app</div>`}
    ${ref ? `<div class="muted">Booking ${esc(ref)}</div>` : ''}
    <div class="qr"><img src="${qr}" alt="UPI QR code to pay ${amount ? inr(amount) : ''} to ${esc(info.upi)}"></div>
    <div class="muted">Scan with any UPI app, or on this phone:</div>
    <a class="btn" href="${esc(link)}">Pay${amount ? ' ' + inr(amount) : ''} with a UPI app</a>
    <div class="upi">${esc(info.upi)}</div>
    ${wa ? `<a class="btn sec" href="${esc(wa)}">Send payment screenshot on WhatsApp</a>` : ''}
    <p class="warn">Pay only to the UPI ID above. It should show the name <b>${esc(payee)}</b> (or DriveKaro's owner) before you confirm. DriveKaro never asks you to pay any other account.</p>`;
})();
