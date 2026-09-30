// DriveKaro AI Marketer: post text (headline, subline, caption, hashtags, Google post text).
// Template-based and deterministic (same post → same words) so plans are stable; AI rewrite is optional.
import { dateOf } from './calendar.js';

// Approximate road distance from Pune (km).
export const DEST_KM = { 'Lonavala': 65, 'Tamhini Ghat': 55, 'Malshej Ghat': 125, 'Bhandardara': 180, 'Mulshi': 40, 'Konkan': 330, 'Mahabaleshwar': 120,
  'Panchgani': 100, 'Kaas Plateau': 125, 'Alibaug': 145, 'Goa': 450, 'Konkan beaches': 330, 'Nashik vineyards': 210, 'Shirdi': 185, 'Lavasa': 60, 'Kolad': 120,
  'Diveagar': 170, 'Ganpatipule': 330, 'Matheran': 120, 'Igatpuri': 190, 'Sinhagad': 35, 'Bhimashankar': 110, 'Aamby Valley': 90 };

const short = ymd => dateOf(ymd).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const range = (a, b) => { const A = dateOf(a), B = dateOf(b); return A.getMonth() === B.getMonth() ? `${A.getDate()}–${B.getDate()} ${A.toLocaleDateString('en-IN', { month: 'short' })}` : `${short(a)} – ${short(b)}`; };
const inr = n => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
const tag = s => '#' + String(s).replace(/[^A-Za-z0-9]/g, '');
// Pick deterministically from a list using a seed string.
export function pick(list, seed) { let h = 0; for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return list[h % list.length]; }

const BASE_TAGS = ['#DriveKaro', '#SelfDriveCarPune', '#CarRentalPune', '#SelfDriveCars', '#PuneDiaries', '#RoadTrip'];
const TIPS = {
  monsoon: ['Slow down on ghats in the rain. Wet roads double your braking distance.', 'Switch on headlights in heavy rain and fog, even in the day.', 'Avoid waterlogged roads. If you can\'t see the road, don\'t drive through it.', 'Keep 3–4 seconds of distance on wet highways.'],
  winter: ['Early-morning fog on the expressway? Low beams, not high beams.', 'Plan a sunrise start to beat the traffic to Mahabaleshwar.', 'Check tyre pressure before a long drive. Cold mornings lower it.'],
  summer: ['Park in the shade and crack the windows a little to keep the cabin cool.', 'Carry water and take a break every 2 hours on long drives.', 'Service stops on the expressway: plan your fuel before the ghat.'],
  postmonsoon: ['Roads after the rains can have potholes. Keep speed moderate on state highways.', 'Best season for Kaas Plateau: book early, entry is by slots.'],
  any: ['Seatbelts for everyone, front and back. It\'s the law and it saves lives.', 'Use the FASTag lane and keep toll money handy as a backup.', 'Download offline Google Maps before ghat sections with weak network.', 'Take a photo of the fuel gauge and odometer at pickup. Easy returns!'],
};
export const WHY = ['Well-maintained, sanitised cars', 'Doorstep delivery and pickup', 'Transparent pricing, no hidden charges', 'Quick Aadhaar e-sign booking', '24×7 support on WhatsApp'];

// ctx: { brand, car, event, window, destination, minRate, offer, review, season, lang }
export function buildCopy(p, ctx) {
  const b = ctx.brand || {}; const phone = b.phone || '+91 76663 98984'; const site = b.website || 'drivekaro.in';
  const langs = b.langs || ['en']; const regional = langs.includes('mr') ? 'mr' : langs.includes('hi') ? 'hi' : null;
  const from = ctx.minRate ? `from ${inr(ctx.minRate)}/day` : '';
  const cta = `📲 Book on WhatsApp: ${phone}\n🌐 ${site}`;
  const seed = p.date + p.type + (p.car_id || '') + (ctx.destination || '');
  const e = ctx.event, w = ctx.window, car = ctx.car;
  let headline = '', subline = '', body = '', tags = [...BASE_TAGS], gbp = '', badge = '';
  const destTags = d => d ? [tag(d.replace(/ (Ghat|beaches|vineyards|Plateau)$/, ''))] : [];
  switch (p.type) {
    case 'festival': {
      const g = e.greet || { en: `Happy ${e.label}` };
      headline = g.en; subline = regional && g[regional] && g[regional] !== g.en ? g[regional] : '';
      const lines = {
        diwali: ['May this festival of lights fill your home with joy and your roads with smooth drives.', 'Lights, sweets and a road trip home. Wishing you a bright and safe Diwali.'],
        ganesh: ['May Bappa bless every journey you take.', 'Wishing you and your family a blessed Ganeshotsav.'],
        christmas: ['Wishing you warmth, joy and wonderful road trips this season.'],
        newyear: ['New year, new roads. Here\'s to more adventures together.'],
        tricolor: ['Proud to drive India forward, one journey at a time.'],
        eid: ['Wishing you peace, happiness and time with loved ones.'],
        holi: ['Play safe, drive safe and have a colourful Holi!'],
      };
      body = pick(lines[e.theme] || ['Warm wishes to you and your family from all of us at DriveKaro.'], seed);
      if (e.travel >= 1) body += `\n\nVisiting family or heading out of town? Self-drive cars ${from} with doorstep delivery.`;
      tags = [tag(`Happy${e.label}`), tag(`${e.label}${p.date.slice(0, 4)}`), ...BASE_TAGS.slice(0, 4)];
      gbp = `${g.en}! ${body.replace(/\n+/g, ' ')} Book: ${phone}.`;
      break;
    }
    case 'prefest': {
      const family = ['diwali', 'ganesh', 'eidfitr', 'bakrid', 'dussehra', 'holi', 'gudipadwa', 'christmas'].includes(e.key);
      headline = pick(family ? [`${e.label} road trip?`, `Going home for ${e.label}?`, `${e.label} plans sorted?`] : [`${e.label} road trip?`, `${e.label} plans sorted?`, `Off for ${e.label}? Go explore`], seed);
      subline = `Book early · self-drive ${from}`.trim(); badge = `${e.label.toUpperCase()} · ${short(e.date).toUpperCase()}`;
      body = `${e.label} is on ${short(e.date)}. Cars get booked out fast around festivals, so lock yours in now.\n\n✅ Doorstep delivery in Pune\n✅ Aadhaar e-sign in 2 minutes\n✅ Clean, well-maintained cars`;
      tags = [tag(e.label), tag(`${e.label}${p.date.slice(0, 4)}`), ...BASE_TAGS];
      gbp = `${e.label} on ${short(e.date)}: book your self-drive car early. Doorstep delivery across Pune, ${from}. Call or WhatsApp ${phone}.`;
      break;
    }
    case 'longweekend': {
      const d = ctx.destination || 'Lonavala';
      headline = p.reminder
        ? pick([`Long weekend in 2 days. Car booked?`, `Last call: long weekend cars`, `Still no car for the long weekend?`], seed)
        : pick([`Long weekend: ${range(w.start, w.end)}`, `${w.days} days off. Where to?`, `${d} this long weekend?`], seed);
      subline = `${d} ${DEST_KM[d] ? `· ${DEST_KM[d]} km` : ''} · self-drive ${from}`.replace(/\s+·\s+·/g, ' ·').trim();
      badge = `LONG WEEKEND · ${range(w.start, w.end).toUpperCase()}`;
      const names = w.names.join(' + ');
      const ideas = (ctx.season?.dest || []).slice(0, 4).map(x => `📍 ${x}${DEST_KM[x] ? ` (${DEST_KM[x]} km)` : ''}`).join('\n');
      body = `${names} gives you ${w.days} days off (${range(w.start, w.end)})${w.bridge ? `, with 1 day of leave on ${short(w.leaveDay)}` : ''}. Perfect for a road trip!\n\nIdeas from Pune:\n${ideas}\n\nBook early, cars go fast on long weekends.`;
      tags = [...destTags(d), '#LongWeekend', '#WeekendGetaway', ...BASE_TAGS];
      gbp = `Long weekend ${range(w.start, w.end)} (${names}). Plan a road trip to ${d}: self-drive cars ${from}, doorstep delivery in Pune. Book: ${phone}.`;
      break;
    }
    case 'spotlight': {
      headline = car ? car.name : 'Our fleet';
      const spec = car ? [car.fuel, car.transmission, car.seats ? `${car.seats} seats` : ''].filter(Boolean).join(' · ') : '';
      subline = car && car.rate ? `${inr(car.rate)}/day${spec ? ' · ' + spec : ''}` : spec;
      badge = 'FEATURED CAR';
      const use = pick(['family trips', 'weekend getaways', 'city drives', 'airport runs', 'ghat drives'], seed);
      body = `Meet the ${car ? car.name : 'car'}: perfect for ${use}.${car?.rate ? `\n\n💰 ${inr(car.rate)} per day` : ''}${spec ? `\n⚙️ ${spec}` : ''}\n🚗 Doorstep delivery in Pune\n📝 Quick Aadhaar e-sign booking`;
      tags = car ? [tag(car.name.split(' ').slice(0, 2).join('')), ...BASE_TAGS] : BASE_TAGS;
      gbp = `${car ? car.name : 'Self-drive cars'} available for self-drive in Pune${car?.rate ? ` at ${inr(car.rate)}/day` : ''}. Doorstep delivery, quick e-sign booking. Call/WhatsApp ${phone}.`;
      break;
    }
    case 'destination': {
      const d = ctx.destination || 'Lonavala';
      headline = pick([`${d} this weekend?`, `Weekend plan: ${d}`, `Your next drive: ${d}`], seed);
      subline = `${DEST_KM[d] ? `${DEST_KM[d]} km from Pune · ` : ''}self-drive ${from}`.trim();
      badge = (ctx.season?.label || 'Weekend').toUpperCase() + ' GETAWAY';
      body = `${d} is ${DEST_KM[d] ? `about ${DEST_KM[d]} km` : 'a short drive'} from Pune and ${ctx.season?.key === 'monsoon' ? 'at its greenest in the monsoon' : ctx.season?.key === 'winter' ? 'lovely in the cool winter weather' : 'a great escape this season'}.\n\nGrab a self-drive car ${from} and go at your own pace.`;
      tags = [...destTags(d), '#WeekendGetaway', '#PuneToNature', ...BASE_TAGS];
      gbp = `Weekend drive to ${d}? Self-drive cars ${from} with doorstep delivery in Pune. Book: ${phone}.`;
      break;
    }
    case 'whyus': {
      headline = pick(['Why Pune drives with DriveKaro', 'Self-drive, the easy way', 'Your car. Your trip. Your way.'], seed);
      subline = ''; badge = 'WHY DRIVEKARO';
      body = `${WHY.map(x => '✅ ' + x).join('\n')}\n\nSelf-drive cars in Pune ${from}.`;
      gbp = `Self-drive car rental in Pune: ${WHY.join(', ').toLowerCase()}. Call/WhatsApp ${phone}.`;
      break;
    }
    case 'tip': {
      const list = [...(TIPS[ctx.season?.key] || []), ...TIPS.any];
      const tip = pick(list, seed);
      headline = 'Drive tip'; subline = tip; badge = 'DRIVE SMART';
      body = `💡 ${tip}\n\nDrive safe, and when you need a car, we've got you.`;
      tags = ['#DriveSafe', '#RoadSafety', ...BASE_TAGS.slice(0, 4)];
      gbp = `Drive tip: ${tip} Self-drive cars in Pune ${from}. ${phone}.`;
      break;
    }
    case 'review': {
      const r = ctx.review || {};
      headline = `“${r.text || 'Smooth booking and a great car!'}”`; subline = `${'★'.repeat(r.stars || 5)} · ${r.name || 'Happy customer'}`; badge = 'CUSTOMER LOVE';
      body = `Thank you, ${r.name || 'friend'}, for the kind words! 🙏\n\n“${r.text || ''}”`;
      tags = ['#CustomerLove', '#HappyCustomers', ...BASE_TAGS.slice(0, 4)];
      gbp = `Thank you ${r.name || ''} for your review! Self-drive cars in Pune ${from}. ${phone}.`;
      break;
    }
    case 'offer': {
      const o = ctx.offer || {};
      headline = o.title || 'Special offer'; subline = o.details || ''; badge = o.until ? `TILL ${short(o.until).toUpperCase()}` : 'LIMITED OFFER';
      body = `🎉 ${o.title || 'Special offer'}${o.details ? `\n${o.details}` : ''}${o.until ? `\n\nValid till ${short(o.until)}.` : ''}${o.terms ? `\n*${o.terms}` : ''}`;
      tags = ['#Offer', '#Deal', ...BASE_TAGS];
      gbp = `${o.title || 'Special offer'}. ${o.details || ''}${o.until ? ` Valid till ${short(o.until)}.` : ''} Book: ${phone}.`;
      break;
    }
    case 'marketing': {
      const g = e.greet || { en: e.name };
      headline = g.en; subline = regional && g[regional] && g[regional] !== g.en ? g[regional] : '';
      body = e.travel >= 2 ? `Celebrate with a drive! Self-drive cars ${from} with doorstep delivery in Pune.` : 'Warm wishes from all of us at DriveKaro.';
      tags = [tag(e.name), ...BASE_TAGS.slice(0, 4)];
      gbp = `${g.en}! ${body}`;
      break;
    }
  }
  const extra = (b.hashtags || '').split(/[\s,]+/).filter(x => x.startsWith('#'));
  const hashtags = [...new Set([...tags, ...extra])].slice(0, 15);
  const caption = `${p.type === 'festival' || p.type === 'marketing' ? headline + (subline ? `\n${subline}` : '') : headline}\n\n${body}\n\n${cta}\n\n${hashtags.join(' ')}`;
  return { headline, subline, badge, caption, gbp_text: gbp.slice(0, 1450), hashtags };
}
