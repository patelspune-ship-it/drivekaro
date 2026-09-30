// DriveKaro AI Marketer: branded post images drawn on a canvas.
// Formats: post 1080×1350 (Instagram 4:5), story 1080×1920, square 1080×1080 (Google Business Profile).
export const FORMATS = { post: [1080, 1350], story: [1080, 1920], square: [1080, 1080] };
export const BRAND_DEFAULT = { red: '#B5382A', beige: '#F4E8D0', dark: '#1A120C', cream: '#FFFAF4' };

const THEMES = {
  diwali: { bg: ['#2A0C04', '#5E1B08'], ink: '#FFE9B8', accent: '#F4A51C', motif: 'diya' },
  dussehra: { bg: ['#6E1B0B', '#C2461C'], ink: '#FFF3DA', accent: '#FFC94A', motif: 'marigold' },
  navratri: { bg: ['#3E0B52', '#A11C73'], ink: '#FFF0F6', accent: '#FFC857', motif: 'dandiya' },
  ganesh: { bg: ['#7E2408', '#E0651A'], ink: '#FFF4DE', accent: '#FFD66B', motif: 'mandala' },
  holi: { bg: ['#FFFDF8', '#FFF1E6'], ink: '#2A1840', accent: '#E0337A', motif: 'splash', light: true },
  gudipadwa: { bg: ['#FFF4DC', '#FFE2B0'], ink: '#4A1D05', accent: '#E3741B', motif: 'gudi', light: true },
  makar: { bg: ['#CFEFFF', '#8FD3FF'], ink: '#0B2F4D', accent: '#E3391C', motif: 'kites', light: true },
  christmas: { bg: ['#0C3527', '#1D6647'], ink: '#FFF6E6', accent: '#E9C46A', motif: 'snow' },
  newyear: { bg: ['#0B0A1F', '#2A2157'], ink: '#FFF6E0', accent: '#F4C542', motif: 'fireworks' },
  eid: { bg: ['#0B3533', '#136059'], ink: '#FDF6E3', accent: '#E9C46A', motif: 'crescent' },
  tricolor: { bg: ['#FFFFFF', '#FFFFFF'], ink: '#0B2A5B', accent: '#FF9933', motif: 'tricolor', light: true },
  saffron: { bg: ['#FFF3E0', '#FFE0B8'], ink: '#4A1D05', accent: '#E8761F', motif: 'mandala', light: true },
  blue: { bg: ['#EAF2FF', '#CFE1FF'], ink: '#10284F', accent: '#2C5A96', motif: 'circles', light: true },
  rakhi: { bg: ['#FFE7EE', '#FFCADB'], ink: '#5A0F2E', accent: '#C2185B', motif: 'hearts', light: true },
  valentine: { bg: ['#FFE3EA', '#FF9DB6'], ink: '#5A0F2E', accent: '#C2185B', motif: 'hearts', light: true },
  brand: { bg: ['#F4E8D0', '#EBD9B7'], ink: '#1A120C', accent: '#B5382A', motif: 'road', light: true },
};

/* ---------- fonts and images ---------- */
let fontsReady = null;
export function ensureFonts() {
  if (!fontsReady) fontsReady = Promise.all([
    '800 80px Archivo', '700 40px Archivo', '600 30px "IBM Plex Sans"', '400 30px "IBM Plex Sans"', '700 60px Mukta', '800 60px Mukta',
  ].map(f => document.fonts.load(f, 'Aa अ').catch(() => null))).then(() => document.fonts.ready);
  return fontsReady;
}
const imgCache = new Map();
export function loadImage(src) {
  if (!src) return Promise.resolve(null);
  if (imgCache.has(src)) return imgCache.get(src);
  const p = new Promise(res => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  imgCache.set(src, p); return p;
}
// Light version of the logo for dark backgrounds: dark letters become white, red stays.
let lightLogo = null;
export async function logos(src = '/logo-transparent.png') {
  const dark = await loadImage(src);
  if (!dark) return { dark: null, light: null };
  if (!lightLogo) {
    const c = document.createElement('canvas'); c.width = dark.naturalWidth; c.height = dark.naturalHeight;
    const x = c.getContext('2d'); x.drawImage(dark, 0, 0);
    const id = x.getImageData(0, 0, c.width, c.height), d = id.data;
    for (let i = 0; i < d.length; i += 4) { const r = d[i], g = d[i + 1], b = d[i + 2]; if (d[i + 3] > 10 && Math.max(r, g, b) - Math.min(r, g, b) < 60 && r < 140) { d[i] = d[i + 1] = d[i + 2] = 255; } }
    x.putImageData(id, 0, 0); lightLogo = c;
  }
  return { dark, light: lightLogo };
}

/* ---------- drawing helpers ---------- */
const DISPLAY = 'Archivo, "Arial Narrow", Arial, sans-serif', BODY = '"IBM Plex Sans", Arial, sans-serif', DEVA = 'Mukta, "Noto Sans Devanagari", sans-serif';
const hasDeva = s => /[ऀ-ॿ]/.test(s || '');
function rr(x, X, Y, W, H, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + W, Y, X + W, Y + H, r); x.arcTo(X + W, Y + H, X, Y + H, r); x.arcTo(X, Y + H, X, Y, r); x.arcTo(X, Y, X + W, Y, r); x.closePath(); }
function cover(x, img, X, Y, W, H, r = 0) {
  x.save(); if (r) { rr(x, X, Y, W, H, r); x.clip(); }
  const s = Math.max(W / img.width, H / img.height), w = img.width * s, h = img.height * s;
  x.drawImage(img, X + (W - w) / 2, Y + (H - h) / 2, w, h); x.restore();
}
function lines(x, text, maxW) {
  const out = []; for (const para of String(text || '').split('\n')) {
    const words = para.split(/\s+/).filter(Boolean); let cur = '';
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (x.measureText(t).width <= maxW || !cur) cur = t; else { out.push(cur); cur = w; } }
    out.push(cur);
  } return out;
}
// Largest font size (≤ max) at which text fits in maxW × maxLines.
function fit(x, text, { weight = 800, family = DISPLAY, max = 110, min = 34, maxW, maxLines = 3, lh = 1.08 }) {
  const fam = hasDeva(text) ? DEVA : family;
  for (let s = max; s >= min; s -= 2) { x.font = `${weight} ${s}px ${fam}`; const L = lines(x, text, maxW); if (L.length <= maxLines) return { size: s, lines: L, font: x.font, lh: s * lh }; }
  x.font = `${weight} ${min}px ${fam}`; const L = lines(x, text, maxW).slice(0, maxLines); return { size: min, lines: L, font: x.font, lh: min * lh };
}
function drawLines(x, F, X, Y, align = 'left', color) { x.font = F.font; x.textAlign = align; x.textBaseline = 'alphabetic'; if (color) x.fillStyle = color; F.lines.forEach((l, i) => x.fillText(l, X, Y + F.size + i * F.lh)); return Y + F.lines.length * F.lh + (F.size - F.lh) * 0; }
function pill(x, text, X, Y, { bg, fg, size = 30, padX = 26, h = 64, align = 'left' } = {}) {
  x.font = `700 ${size}px ${DISPLAY}`; const w = x.measureText(text).width + padX * 2; const XX = align === 'center' ? X - w / 2 : align === 'right' ? X - w : X;
  x.fillStyle = bg; rr(x, XX, Y, w, h, h / 2); x.fill(); x.fillStyle = fg; x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillText(text, XX + padX, Y + h / 2 + 2); x.textBaseline = 'alphabetic'; return w;
}
function gradient(x, W, H, [a, b], angle = 1) { const g = x.createLinearGradient(0, 0, W * (angle ? 0.3 : 0), H); g.addColorStop(0, a); g.addColorStop(1, b); x.fillStyle = g; x.fillRect(0, 0, W, H); }
function seeded(seed) { let s = 0; for (const c of String(seed)) s = (s * 31 + c.charCodeAt(0)) >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function logo(x, L, X, Y, w, light, align = 'left') { const im = light ? L.light : L.dark; if (!im) return; const h = w * (im.height / im.width); x.drawImage(im, align === 'center' ? X - w / 2 : align === 'right' ? X - w : X, Y, w, h); return h; }
function ctaBar(x, W, H, brand, phone, site, { color, ink } = {}) {
  const h = Math.min(Math.round(H * 0.085), 118), Y = H - h;
  x.fillStyle = color || brand.red; x.fillRect(0, Y, W, h);
  x.fillStyle = ink || '#FFFFFF'; x.textBaseline = 'middle';
  const left = `Book on WhatsApp  ${phone}`;
  let a = Math.round(h * 0.34), b = Math.round(h * 0.28);
  // shrink both until they fit side by side with a gap
  for (; a > 18; a -= 1, b = Math.max(16, b - 1)) { x.font = `700 ${a}px ${DISPLAY}`; const lw = x.measureText(left).width; x.font = `600 ${b}px ${BODY}`; if (lw + x.measureText(site).width + 56 * 2 + 40 <= W) break; }
  x.font = `700 ${a}px ${DISPLAY}`; x.textAlign = 'left'; x.fillText(left, 56, Y + h / 2 + 2);
  x.font = `600 ${b}px ${BODY}`; x.textAlign = 'right'; x.fillText(site, W - 56, Y + h / 2 + 2); x.textBaseline = 'alphabetic';
  return h;
}

/* ---------- motifs (simple, tasteful vector ornaments) ---------- */
function motif(x, kind, W, H, T, seed) {
  const R = seeded(seed); x.save();
  if (kind === 'diya') {
    for (let i = 0; i < 70; i++) { const cx = R() * W, cy = R() * H * 0.55, r = 1.5 + R() * 3.5; x.fillStyle = `rgba(255,${190 + R() * 60 | 0},90,${0.25 + R() * 0.5})`; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); }
    const n = 5, y = H - (H / W > 1.5 ? 260 : 190), gap = W / (n + 1);
    for (let i = 1; i <= n; i++) {
      const cx = gap * i, s = 1 + (i % 2 ? 0.15 : 0);
      const glow = x.createRadialGradient(cx, y - 40 * s, 4, cx, y - 40 * s, 110 * s); glow.addColorStop(0, 'rgba(255,200,90,0.55)'); glow.addColorStop(1, 'rgba(255,160,40,0)'); x.fillStyle = glow; x.fillRect(cx - 120, y - 170, 240, 200);
      x.fillStyle = '#C7641B'; x.beginPath(); x.ellipse(cx, y, 46 * s, 20 * s, 0, 0, Math.PI); x.fill();
      x.fillStyle = '#E58A2B'; x.beginPath(); x.ellipse(cx, y, 46 * s, 9 * s, 0, 0, 7); x.fill();
      x.fillStyle = '#FFD36B'; x.beginPath(); x.moveTo(cx, y - 52 * s); x.quadraticCurveTo(cx + 15 * s, y - 20 * s, cx, y - 8 * s); x.quadraticCurveTo(cx - 15 * s, y - 20 * s, cx, y - 52 * s); x.fill();
    }
  } else if (kind === 'marigold') {
    for (let row = 0; row < 2; row++) for (let i = 0; i <= 18; i++) { const cx = i * W / 18, cy = 30 + row * 26 + Math.sin(i / 18 * Math.PI) * 120; x.fillStyle = i % 2 ? '#FFB31A' : '#FF7A00'; x.beginPath(); x.arc(cx, cy, 20, 0, 7); x.fill(); x.fillStyle = 'rgba(0,0,0,0.12)'; x.beginPath(); x.arc(cx, cy, 7, 0, 7); x.fill(); }
  } else if (kind === 'mandala' || kind === 'circles') {
    const cx = W * 0.92, cy = H * 0.1; x.strokeStyle = T.accent; x.globalAlpha = 0.28; x.lineWidth = 3;
    for (let r = 60; r < 360; r += 42) { x.beginPath(); x.arc(cx, cy, r, 0, 7); x.stroke(); }
    if (kind === 'mandala') for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; x.beginPath(); x.ellipse(cx + Math.cos(a) * 190, cy + Math.sin(a) * 190, 34, 14, a, 0, 7); x.stroke(); }
    x.globalAlpha = 0.18; for (let r = 60; r < 300; r += 50) { x.beginPath(); x.arc(W * 0.06, H * 0.92, r, 0, 7); x.stroke(); }
  } else if (kind === 'splash') {
    const cols = ['#FF3E8A', '#FFC400', '#2BC48A', '#3D7BFF', '#9B5BFF', '#FF7A1A'];
    for (let i = 0; i < 16; i++) { const cx = (R() < 0.5 ? R() * 0.22 : 0.78 + R() * 0.22) * W, cy = R() < 0.6 ? R() * H * 0.22 : H * 0.72 + R() * H * 0.12, r = 40 + R() * 110; x.fillStyle = cols[i % cols.length]; x.globalAlpha = 0.28 + R() * 0.3; x.beginPath(); for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2, rr2 = r * (0.7 + R() * 0.5); x.lineTo(cx + Math.cos(a) * rr2, cy + Math.sin(a) * rr2); } x.fill(); }
  } else if (kind === 'snow') {
    x.fillStyle = 'rgba(255,255,255,0.7)'; for (let i = 0; i < 90; i++) { x.globalAlpha = 0.25 + R() * 0.6; x.beginPath(); x.arc(R() * W, R() * H, 1.5 + R() * 4, 0, 7); x.fill(); }
    x.globalAlpha = 1; x.strokeStyle = T.accent; x.lineWidth = 3; for (let i = 0; i <= 14; i++) { const cx = i * W / 14, cy = 40 + Math.sin(i / 14 * Math.PI) * 70; x.beginPath(); x.arc(cx, cy, 10, 0, 7); x.fillStyle = ['#E63946', '#E9C46A', '#2A9D8F', '#F1FAEE'][i % 4]; x.fill(); }
  } else if (kind === 'fireworks') {
    for (let f = 0; f < 4; f++) { const cx = (0.15 + R() * 0.7) * W, cy = (0.08 + R() * 0.25) * H, r = 80 + R() * 90; x.strokeStyle = ['#F4C542', '#FF6B6B', '#6BCBFF', '#B28DFF'][f]; x.lineWidth = 3; x.globalAlpha = 0.8; for (let k = 0; k < 18; k++) { const a = k / 18 * Math.PI * 2; x.beginPath(); x.moveTo(cx + Math.cos(a) * r * 0.25, cy + Math.sin(a) * r * 0.25); x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); x.stroke(); } }
    for (let i = 0; i < 60; i++) { x.globalAlpha = 0.6; x.fillStyle = ['#F4C542', '#FF6B6B', '#6BCBFF', '#FFFFFF'][i % 4]; x.fillRect(R() * W, R() * H, 6, 12); }
  } else if (kind === 'crescent') {
    const cx = W * 0.82, cy = H * 0.14; x.fillStyle = T.accent; x.beginPath(); x.arc(cx, cy, 90, 0, 7); x.fill(); x.globalCompositeOperation = 'destination-out'; x.beginPath(); x.arc(cx + 38, cy - 22, 80, 0, 7); x.fill(); x.globalCompositeOperation = 'source-over';
    x.fillStyle = T.accent; for (let i = 0; i < 26; i++) { x.globalAlpha = 0.3 + R() * 0.6; star(x, R() * W, R() * H * 0.45, 4 + R() * 7); }
  } else if (kind === 'tricolor') {
    x.fillStyle = '#FF9933'; wave(x, W, 0, 150, 1); x.fillStyle = '#138808'; wave(x, W, H, 150, -1);
    x.strokeStyle = '#0B2A8C'; x.lineWidth = 4; x.globalAlpha = 0.35; const cx = W * 0.88, cy = H * 0.22; x.beginPath(); x.arc(cx, cy, 70, 0, 7); x.stroke(); for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(a) * 70, cy + Math.sin(a) * 70); x.stroke(); }
  } else if (kind === 'kites') {
    for (let i = 0; i < 7; i++) { const cx = R() * W, cy = R() * H * 0.45, s = 30 + R() * 40; x.fillStyle = ['#E3391C', '#FFC400', '#2BC48A', '#3D7BFF', '#9B5BFF'][i % 5]; x.beginPath(); x.moveTo(cx, cy - s); x.lineTo(cx + s * 0.8, cy); x.lineTo(cx, cy + s); x.lineTo(cx - s * 0.8, cy); x.fill(); x.strokeStyle = 'rgba(0,0,0,0.3)'; x.lineWidth = 2; x.beginPath(); x.moveTo(cx, cy + s); x.bezierCurveTo(cx + 30, cy + s + 60, cx - 30, cy + s + 120, cx + 10, cy + s + 180); x.stroke(); }
  } else if (kind === 'gudi') {
    const cx = W * 0.86, base = H * 0.62; x.strokeStyle = '#8B5A2B'; x.lineWidth = 10; x.beginPath(); x.moveTo(cx, base); x.lineTo(cx, base - 420); x.stroke();
    x.fillStyle = '#F2C94C'; x.beginPath(); x.moveTo(cx - 5, base - 400); x.lineTo(cx - 110, base - 170); x.lineTo(cx + 70, base - 190); x.fill();
    x.fillStyle = '#C0392B'; x.beginPath(); x.arc(cx, base - 425, 26, Math.PI, 0); x.lineTo(cx + 22, base - 405); x.lineTo(cx - 22, base - 405); x.fill();
  } else if (kind === 'hearts') {
    for (let i = 0; i < 18; i++) { x.globalAlpha = 0.15 + R() * 0.35; x.fillStyle = T.accent; heart(x, R() * W, R() * H, 16 + R() * 34); }
  } else if (kind === 'dandiya') {
    x.lineWidth = 16; x.lineCap = 'round'; x.strokeStyle = T.accent; x.globalAlpha = 0.6;
    x.beginPath(); x.moveTo(W * 0.72, H * 0.06); x.lineTo(W * 0.96, H * 0.26); x.stroke(); x.beginPath(); x.moveTo(W * 0.96, H * 0.06); x.lineTo(W * 0.72, H * 0.26); x.stroke();
    for (let i = 0; i < 40; i++) { x.globalAlpha = 0.25 + R() * 0.4; x.fillStyle = ['#FFC857', '#FF6FB5', '#6BE4FF'][i % 3]; x.beginPath(); x.arc(R() * W, R() * H, 3 + R() * 5, 0, 7); x.fill(); }
  } else if (kind === 'road') {
    x.globalAlpha = 0.12; x.fillStyle = T.ink; x.beginPath(); x.moveTo(W * 0.42, H * 0.55); x.lineTo(W * 0.58, H * 0.55); x.lineTo(W * 1.1, H); x.lineTo(-W * 0.1, H); x.fill();
    x.globalAlpha = 0.35; x.fillStyle = '#FFFFFF'; for (let i = 0; i < 6; i++) { const t = i / 6, y1 = H * (0.57 + t * 0.4), h = 12 + t * 50, w = 4 + t * 16; x.fillRect(W / 2 - w / 2, y1, w, h); }
  }
  x.restore();
}
function star(x, cx, cy, r) { x.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 - Math.PI / 2, rr2 = i % 2 ? r * 0.45 : r; x.lineTo(cx + Math.cos(a) * rr2, cy + Math.sin(a) * rr2); } x.fill(); }
function heart(x, cx, cy, s) { x.beginPath(); x.moveTo(cx, cy + s * 0.35); x.bezierCurveTo(cx - s, cy - s * 0.4, cx - s * 0.4, cy - s, cx, cy - s * 0.4); x.bezierCurveTo(cx + s * 0.4, cy - s, cx + s, cy - s * 0.4, cx, cy + s * 0.35); x.fill(); }
function wave(x, W, y, h, dir) { x.beginPath(); x.moveTo(0, y); x.lineTo(0, y + dir * h); for (let i = 0; i <= 20; i++) x.lineTo(i * W / 20, y + dir * (h * 0.6 + Math.sin(i / 20 * Math.PI * 2) * h * 0.25)); x.lineTo(W, y); x.fill(); }
function steering(x, cx, cy, r, color) { x.save(); x.strokeStyle = color; x.lineWidth = r * 0.16; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.stroke(); x.beginPath(); x.arc(cx, cy, r * 0.18, 0, 7); x.fillStyle = color; x.fill(); x.lineWidth = r * 0.14; x.beginPath(); x.moveTo(cx - r, cy); x.lineTo(cx + r, cy); x.moveTo(cx, cy); x.lineTo(cx, cy + r); x.stroke(); x.restore(); }

/* ---------- templates ---------- */
// post: { template, headline, subline, badge, event{theme}, review }, ctx: { brand, phone, site, photo (Image), logos }
export async function renderPost(post, ctx, format = 'post') {
  await ensureFonts();
  const [W, H] = FORMATS[format] || FORMATS.post;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  const brand = { ...BRAND_DEFAULT, ...(ctx.brand || {}) }; const L = ctx.logos || { dark: null, light: null };
  const phone = ctx.phone || '+91 76663 98984', site = ctx.site || 'drivekaro.in';
  const tall = H / W > 1.5, sq = H === W;
  const M = 64; // margin
  const photo = ctx.photo || null;
  const t = post.template;

  if (t === 'festival') {
    const T = THEMES[post.event?.theme] || THEMES.brand; const lightBg = !!T.light;
    gradient(x, W, H, T.bg); motif(x, T.motif, W, H, T, post.id || post.date);
    logo(x, L, W / 2, M, tall ? 360 : 300, !lightBg, 'center');
    const top = tall ? H * 0.22 : sq ? H * 0.2 : H * 0.19;
    const F = fit(x, post.headline, { maxW: W - M * 2.4, max: tall ? 132 : 118, min: 60, maxLines: 3 });
    let y = drawLines(x, F, W / 2, top, 'center', T.ink);
    if (post.subline) { const S = fit(x, post.subline, { weight: 700, maxW: W - M * 2.6, max: 70, min: 38, maxLines: 2, lh: 1.25 }); y = drawLines(x, S, W / 2, y + 18, 'center', T.accent); }
    const bottomReserve = Math.round(H * (tall ? 0.16 : 0.14));
    if (photo && !sq) {
      const pw = W - M * 3, ph = Math.min(H - y - bottomReserve - 70, tall ? 720 : 520), py = y + 44;
      if (ph > 220) { x.save(); x.shadowColor = 'rgba(0,0,0,0.35)'; x.shadowBlur = 40; x.shadowOffsetY = 16; rr(x, (W - pw) / 2, py, pw, ph, 36); x.fillStyle = '#000'; x.fill(); x.restore(); cover(x, photo, (W - pw) / 2, py, pw, ph, 36); x.strokeStyle = T.accent; x.lineWidth = 6; rr(x, (W - pw) / 2, py, pw, ph, 36); x.stroke(); }
    }
    x.fillStyle = lightBg ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.8)'; x.font = `600 ${tall ? 34 : 30}px ${BODY}`; x.textAlign = 'center';
    x.fillText('Warm wishes from DriveKaro Self Drive · Pune', W / 2, H - (tall ? 150 : 96));
    x.font = `700 ${tall ? 36 : 32}px ${DISPLAY}`; x.fillStyle = lightBg ? T.accent : T.accent; x.fillText(`${phone}  ·  ${site}`, W / 2, H - (tall ? 96 : 50));
    return c;
  }

  if (t === 'trip') {
    if (photo) { cover(x, photo, 0, 0, W, H); } else { gradient(x, W, H, ['#2B1A12', '#6B2A1C']); motif(x, 'road', W, H, { ink: '#000' }, post.date); }
    const g = x.createLinearGradient(0, H * 0.28, 0, H); g.addColorStop(0, 'rgba(10,6,4,0)'); g.addColorStop(0.55, 'rgba(10,6,4,0.72)'); g.addColorStop(1, 'rgba(10,6,4,0.94)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    const gt = x.createLinearGradient(0, 0, 0, 260); gt.addColorStop(0, 'rgba(10,6,4,0.55)'); gt.addColorStop(1, 'rgba(10,6,4,0)'); x.fillStyle = gt; x.fillRect(0, 0, W, 260);
    logo(x, L, W - M, M, tall ? 300 : 260, true, 'right');
    const cta = Math.min(Math.round(H * 0.085), 118);
    const F = fit(x, post.headline, { maxW: W - M * 2, max: tall ? 124 : 108, min: 56, maxLines: 3 });
    const S = post.subline ? fit(x, post.subline, { weight: 600, family: BODY, maxW: W - M * 2, max: 44, min: 30, maxLines: 2, lh: 1.3 }) : null;
    const blockH = F.lines.length * F.lh + (S ? S.lines.length * S.lh + 28 : 0) + (post.badge ? 100 : 0);
    let y = H - cta - 70 - blockH;
    if (post.badge) { pill(x, post.badge, M, y, { bg: brand.red, fg: '#FFFFFF', size: tall ? 32 : 28, h: tall ? 70 : 62 }); y += 100; }
    y = drawLines(x, F, M, y, 'left', '#FFFFFF');
    if (S) drawLines(x, S, M, y + 20, 'left', '#F4E8D0');
    ctaBar(x, W, H, brand, phone, site);
    return c;
  }

  if (t === 'spotlight' || t === 'offer') {
    const offer = t === 'offer';
    x.fillStyle = offer ? brand.red : brand.beige; x.fillRect(0, 0, W, H);
    if (!offer) motif(x, 'circles', W, H, { accent: brand.red }, post.date);
    logo(x, L, M, M, tall ? 320 : 280, offer);
    if (post.badge) pill(x, post.badge, W - M, M + 6, { bg: offer ? '#FFFFFF' : brand.dark, fg: offer ? brand.red : '#FFFFFF', size: 26, h: 58, align: 'right' });
    const cta = Math.min(Math.round(H * 0.085), 118);
    const pTop = tall ? 260 : 190, pH = Math.round(H * (tall ? 0.42 : sq ? 0.38 : 0.44));
    if (photo) { x.save(); x.shadowColor = 'rgba(0,0,0,0.25)'; x.shadowBlur = 40; x.shadowOffsetY = 14; rr(x, M, pTop, W - M * 2, pH, 40); x.fillStyle = '#fff'; x.fill(); x.restore(); cover(x, photo, M, pTop, W - M * 2, pH, 40); }
    else { x.fillStyle = offer ? 'rgba(255,255,255,0.12)' : 'rgba(26,18,12,0.06)'; rr(x, M, pTop, W - M * 2, pH, 40); x.fill(); steering(x, W / 2, pTop + pH / 2, pH * 0.28, offer ? 'rgba(255,255,255,0.55)' : brand.red); }
    let y = pTop + pH + (tall ? 70 : 44);
    const ink = offer ? '#FFFFFF' : brand.dark;
    const F = fit(x, post.headline, { maxW: W - M * 2, max: offer ? (tall ? 130 : 112) : (tall ? 104 : 88), min: 50, maxLines: 2 });
    y = drawLines(x, F, M, y, 'left', ink);
    if (post.subline) { const S = fit(x, post.subline, { weight: 600, family: BODY, maxW: W - M * 2, max: 42, min: 28, maxLines: 3, lh: 1.3 }); y = drawLines(x, S, M, y + 14, 'left', offer ? '#FFE9DC' : '#5A4636'); }
    // Selling points in the space left above the booking bar.
    const pts = ['Doorstep delivery in Pune', 'Aadhaar e-sign booking in 2 minutes', 'Clean, well-maintained car'];
    let py = y + (tall ? 60 : 40); const gap = tall ? 76 : 62;
    for (const t of pts) {
      if (py + 40 > H - cta - 30) break;
      x.fillStyle = offer ? '#FFFFFF' : brand.red; x.beginPath(); x.arc(M + 16, py + 16, 16, 0, 7); x.fill();
      x.strokeStyle = offer ? brand.red : '#FFFFFF'; x.lineWidth = 4; x.lineCap = 'round'; x.beginPath(); x.moveTo(M + 9, py + 17); x.lineTo(M + 14, py + 22); x.lineTo(M + 23, py + 10); x.stroke();
      x.fillStyle = ink; x.font = `600 ${tall ? 36 : 32}px ${BODY}`; x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillText(t, M + 48, py + 17); x.textBaseline = 'alphabetic';
      py += gap;
    }
    ctaBar(x, W, H, brand, phone, site, offer ? { color: brand.dark } : {});
    return c;
  }

  if (t === 'whyus' || t === 'tip') {
    const dark = t === 'whyus';
    x.fillStyle = dark ? brand.dark : brand.beige; x.fillRect(0, 0, W, H);
    motif(x, dark ? 'road' : 'circles', W, H, { ink: dark ? '#FFFFFF' : brand.dark, accent: brand.red }, post.date);
    logo(x, L, M, M, tall ? 320 : 280, dark);
    if (post.badge) pill(x, post.badge, M, tall ? 300 : 210, { bg: brand.red, fg: '#FFFFFF', size: 28, h: 60 });
    let y = tall ? 420 : 310;
    const ink = dark ? '#FFF6E6' : brand.dark;
    const F = fit(x, post.headline, { maxW: W - M * 2, max: tall ? 110 : 96, min: 52, maxLines: 3 });
    y = drawLines(x, F, M, y, 'left', ink) + (tall ? 60 : 36);
    if (dark) {
      const items = (post.bullets || ['Well-maintained, sanitised cars', 'Doorstep delivery and pickup', 'Transparent pricing, no hidden charges', 'Quick Aadhaar e-sign booking', '24×7 support on WhatsApp']).slice(0, sq ? 4 : 5);
      const gap = tall ? 118 : sq ? 92 : 104;
      for (const it of items) {
        x.fillStyle = brand.red; x.beginPath(); x.arc(M + 30, y + 30, 30, 0, 7); x.fill();
        x.strokeStyle = '#FFFFFF'; x.lineWidth = 7; x.lineCap = 'round'; x.beginPath(); x.moveTo(M + 17, y + 31); x.lineTo(M + 27, y + 42); x.lineTo(M + 45, y + 19); x.stroke();
        x.fillStyle = ink; x.font = `600 ${tall ? 44 : 38}px ${BODY}`; x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillText(it, M + 86, y + 31); x.textBaseline = 'alphabetic';
        y += gap;
      }
    } else {
      const S = fit(x, post.subline || '', { weight: 600, family: BODY, maxW: W - M * 2 - 40, max: tall ? 64 : 56, min: 34, maxLines: 7, lh: 1.32 });
      x.fillStyle = brand.red; x.fillRect(M, y - 6, 10, S.lines.length * S.lh + 20);
      drawLines(x, S, M + 40, y - 10, 'left', ink);
      steering(x, W - M - 150, H - 118 - 220, 130, 'rgba(181,56,42,0.22)');
    }
    ctaBar(x, W, H, brand, phone, site);
    return c;
  }

  if (t === 'review') {
    x.fillStyle = brand.beige; x.fillRect(0, 0, W, H); motif(x, 'circles', W, H, { accent: brand.red }, post.date);
    logo(x, L, M, M, tall ? 320 : 280, false);
    if (post.badge) pill(x, post.badge, W - M, M + 6, { bg: brand.dark, fg: '#FFFFFF', size: 26, h: 58, align: 'right' });
    x.fillStyle = brand.red; x.font = `800 ${tall ? 340 : 300}px ${DISPLAY}`; x.textAlign = 'left'; x.fillText('“', M - 10, tall ? 560 : 440);
    const quote = String(post.review?.text || post.headline || '').replace(/^“|”$/g, '');
    const F = fit(x, quote, { weight: 700, maxW: W - M * 2, max: tall ? 84 : 72, min: 40, maxLines: 6, lh: 1.2 });
    let y = drawLines(x, F, M, tall ? 560 : 440, 'left', brand.dark) + 40;
    x.fillStyle = '#E0A100'; x.font = `800 ${tall ? 64 : 56}px ${DISPLAY}`; x.fillText('★'.repeat(post.review?.stars || 5), M, y + 50);
    x.fillStyle = '#5A4636'; x.font = `600 ${tall ? 42 : 36}px ${BODY}`; x.fillText(`— ${post.review?.name || 'Happy customer'}`, M, y + 120);
    ctaBar(x, W, H, brand, phone, site);
    return c;
  }

  // unknown template: simple brand card
  x.fillStyle = brand.beige; x.fillRect(0, 0, W, H); logo(x, L, W / 2, H / 3, 420, false, 'center');
  return c;
}

export function canvasToBlob(canvas, type = 'image/jpeg', q = 0.92) { return new Promise(res => canvas.toBlob(res, type, q)); }
