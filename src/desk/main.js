// DriveKaro booking desk (drivekaro.in/desk).
// Same workflow as the prototype: fleet profiles, car-first bookings, auto-filled
// rental agreement (template v2.0), payments, invoices and WhatsApp messages.
import { supabase } from "../supabaseClient.js";
import { jsPDF } from "jspdf";
import { createStore } from "./store.js";
import { configureDrive, driveConfigured, driveConnected, preloadDrive, connectDrive, ensureCustomerFolder, shrinkImage, uploadFile, trashFile, folderUrl } from "./drive.js";

configureDrive(import.meta.env.VITE_GOOGLE_CLIENT_ID);

window.jspdf = { jsPDF };

(function(){
"use strict";

/* ---------- constants ---------- */
// Per-booking charges: [key, label, kind, hint]. kind: money | num | text
const CHARGE_FIELDS = [
  ["km_per_day","Km included per 24 hrs","num",""],
  ["extra_km","Extra km charge (₹ per km)","money",""],
  ["grace_minutes","Grace period for return (minutes)","num",""],
  ["late_per_hour","Late return (₹ per hour)","money",""],
  ["refuel_fee","Refuelling fee on top of fuel (₹)","money",""],
  ["cleaning_charge","Extra cleaning (₹)","money",""],
  ["smoking_charge","Smoke odour or pet hair (₹)","money",""],
  ["night_charge","Night handling, 1–6 AM (₹)","money",""],
  ["delivery_charge","Delivery or collection (₹)","money","0 = not charged"],
  ["damage_limit","Accident damage paid by customer, up to (₹)","money","Above this: insurance claim, customer pays what insurance doesn't"],
  ["lost_key","Lost key (₹)","money",""],
  ["lost_doc","Lost vehicle document (₹)","money",""],
  ["gps_tamper","Tracker tampering (₹)","money",""],
  ["challan_fee","Challan processing (₹ per item)","money",""],
  ["challan_holdback","Challan holdback from deposit (₹)","money",""],
  ["challan_days","Holdback period (days)","num",""],
  ["deposit_refund_days","Deposit refund within (days)","num",""],
  ["part_block_rule","Hours beyond full days","text",""],
  ["restricted_areas","Restricted areas","text",""],
  ["cancellation_terms","Cancellation by customer","text",""]
];
const DEFAULT_CHARGES = {
  km_per_day:350, extra_km:5, grace_minutes:60, late_per_hour:500, refuel_fee:500,
  cleaning_charge:250, smoking_charge:2000, night_charge:200, delivery_charge:0,
  damage_limit:25000,
  lost_key:3000, lost_doc:500, gps_tamper:10000, challan_fee:100,
  challan_holdback:2000, challan_days:30, deposit_refund_days:3,
  part_block_rule:"Charged as a full day",
  restricted_areas:"Ladakh, and any area that needs an Inner Line Permit or Protected Area Permit",
  cancellation_terms:"Full refund if cancelled more than 24 hours before the Start Time; 50% of Rental Charges refunded if cancelled within 24 hours; no refund for a no-show"
};
const DEFAULT_SETTINGS = {
  business_name:"DriveKaro", legal_name:"DRIVEKARO SELF DRIVE CAR RENTAL", signatory:"Amaan Zakir Patel",
  address:"B, Kool Homes Solitaire, Kausarbaugh, Kondhwa, Pune 411048, Maharashtra",
  udyam:"UDYAM-MH-26-1067376", shop_act:"2631000320857751",
  support_phone:"+91 76663 98984", support_email:"hello@drivekaro.in", grievance_email:"hello@drivekaro.in", website:"drivekaro.in",
  official_upi:"", official_bank:"", designated_location:"DriveKaro, B, Kool Homes Solitaire, Kausarbaugh, Kondhwa, Pune 411048",
  non_return_hours:24, unreachable_hours:12, return_inspection_hours:12, emergency_repair_limit:2000,
  late_interest:12, tracking_retention_days:90, fast_track_limit:200000,
  min_age:21, min_age_premium:25, dl_min_months:12,
  charges:{...DEFAULT_CHARGES}
};
const STATUS = {
  draft:{label:"Draft", cls:"s-draft"}, ready:{label:"Agreement ready", cls:"s-ready"}, sent:{label:"Sent for eSign", cls:"s-sent"},
  signed:{label:"Signed", cls:"s-signed"}, handed:{label:"Car handed over", cls:"s-handed"}, returned:{label:"Returned", cls:"s-returned"},
  cancelled:{label:"Cancelled", cls:"s-cancelled"}
};
const FLOW = ["draft","ready","sent","signed","handed","returned"];
const FUEL = ["Full","3/4","1/2","1/4","Reserve"];
const PAYMODES = ["UPI","Cash","Bank transfer","Card"];
const IDTYPES = ["Aadhaar (masked)","Passport","Voter ID","PAN"];

/* ---------- state ---------- */
const S = {
  fleet:[], bookings:[], customers:[], custView:null, custEdit:null, custQuery:"", confirmDoc:null, confirmCustDel:null, formCust:null, webMatches:[], settings:JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
  view:"bookings", selected:null, filter:"active",
  editId:null, draft:null, carEdit:null, carView:null, detailTab:"agreement", confirmPay:null, confirmSettle:false, confirmDelete:null, confirmCar:null,
  db:null, dbState:"loading", downloads:null
};

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const inr = n => "₹" + Math.round(Number(n)||0).toLocaleString("en-IN");
const pad = n => String(n).padStart(2,"0");
function fmtDT(s){ if(!s) return ""; const d=new Date(s); if(isNaN(d)) return ""; return d.toLocaleString("en-IN",{day:"numeric",month:"short",year:"numeric",hour:"numeric",minute:"2-digit",hour12:true}); }
function fmtD(s){ if(!s) return ""; const d=new Date(s.length<=10? s+"T00:00":s); if(isNaN(d)) return ""; return d.toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"}); }
function newId(){ const d=new Date(); const r=Math.random().toString(36).slice(2,6).toUpperCase(); return `DK-${String(d.getFullYear()).slice(2)}${pad(d.getMonth()+1)}${pad(d.getDate())}-${r}`; }
function toast(msg){ const t=$("#toast"); t.textContent=msg; t.hidden=false; clearTimeout(toast._t); toast._t=setTimeout(()=>t.hidden=true,2800); }
function carOf(b){ return S.fleet.find(c=>c.id===b.car_id) || b.car_snapshot || null; }
function ageOn(dob, on){ if(!dob) return null; const d=new Date(dob+"T00:00"), o=new Date(on); let a=o.getFullYear()-d.getFullYear(); const m=o.getMonth()-d.getMonth(); if(m<0||(m===0&&o.getDate()<d.getDate())) a--; return a; }
function defaultCharges(){ return {...DEFAULT_CHARGES, ...(S.settings.charges||{})}; }
function ch(b,k){ const c=b.charges||{}; return (c[k]!==undefined && c[k]!=="") ? c[k] : defaultCharges()[k]; }
function money(b,k){ const v=Number(ch(b,k)); return v>0 ? inr(v) : "Not charged"; }
const PHONE_RE=/^(\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}$/;

function calc(b){
  const p=new Date(b.pickup), d=new Date(b.drop);
  const hours = (isNaN(p)||isNaN(d)) ? 0 : Math.max(0,(d-p)/36e5);
  const days = hours>0 ? Math.max(1, Math.ceil(hours/24 - 1e-9)) : 0;
  const rate=Number(b.rate)||0, dep=depCash(b), delivery=Number(b.with_delivery? ch(b,"delivery_charge"):0)||0;
  const rental = days*rate;
  return {hours, days, rental, delivery, payable:rental+delivery, deposit:dep, collected:rental+delivery+dep, km: days*(Number(ch(b,"km_per_day"))||0)};
}
function durText(c){ if(!c.hours) return ""; const h=Math.round(c.hours); return `${c.days} day${c.days>1?"s":""} (${h} hrs)`; }

/* ---------- db wiring ---------- */
function setBanner(msg){ const b=$("#banner"); if(msg){ b.textContent=msg; b.hidden=false; } else b.hidden=true; }
/* ---------- sign-in and data ---------- */
function saveFile(blob, filename){
  const url=URL.createObjectURL(blob); const a=document.createElement("a");
  a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),5000);
}
// On phones, open the share sheet so the PDF can go straight into WhatsApp; otherwise download.
const fileSaver = { async save({filename, data}){
  try{
    const file=new File([data], filename, {type:(data&&data.type)||"application/pdf"});
    if(navigator.canShare && navigator.canShare({files:[file]}) && window.matchMedia("(max-width:900px)").matches){
      await navigator.share({files:[file], title:filename}); return {status:"delivered"};
    }
  }catch(e){ if(e && e.name==="AbortError") return {status:"declined"}; }
  saveFile(data, filename); return {status:"saved"};
}};

function showGate(msg){ $("#app").hidden=true; $("#gate").hidden=false; $("#g_err").textContent=msg||""; $("#g_btn").disabled=false; $("#g_btn").textContent="Sign in"; }
async function isOwner(email){
  const { data, error } = await supabase.from("owners").select("email").eq("email", email).maybeSingle();
  return !error && !!data;
}
let started=false;
async function startDesk(session){
  if(!(await isOwner(session.user.email))){ await supabase.auth.signOut(); showGate("This account is not in the owners list."); return; }
  $("#gate").hidden=true; $("#app").hidden=false;
  if(started) return; started=true;
  S.downloads=fileSaver;
  const db=createStore(supabase);
  S.db=db; S.dbState="on"; render();
  const onErr = e => { setBanner(e && e.code==="invalid_argument" ? "Your account can't read the desk data. Check that the desk SQL has been run and your email is in the owners table." : "Couldn't load the latest data. Check your connection; it will retry."); };
  db.collection("fleet").onSnapshot(snap=>{ setBanner(""); S.fleet = snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.make_model||"").localeCompare(b.make_model||"")); softRender(); }, onErr);
  db.collection("bookings").onSnapshot(snap=>{ S.bookings = snap.docs.map(d=>({id:d.id,...d.data()})); S._bkLoaded=true; softRender(); syncCustomersFromBookings(); }, onErr);
  db.collection("customers").onSnapshot(snap=>{ S.customers = snap.docs.map(d=>({id:d.id,...d.data()})); S._custLoaded=true; softRender(); syncCustomersFromBookings(); }, onErr);
  preloadDrive();
  db.doc("settings/business").onSnapshot(snap=>{ const d=snap.exists? snap.data():{}; S.settings = {...JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), ...d, charges:{...DEFAULT_CHARGES, ...(d.charges||{})}}; softRender(); }, onErr);
}
async function boot(){
  $("#gateform").addEventListener("submit", async e=>{
    e.preventDefault();
    const email=$("#g_email").value.trim(), password=$("#g_pass").value;
    if(!email||!password){ $("#g_err").textContent="Enter your email and password."; return; }
    $("#g_btn").disabled=true; $("#g_btn").textContent="Signing in…"; $("#g_err").textContent="";
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if(error){ showGate(/confirm/i.test(error.message) ? "This email isn't confirmed yet in Supabase." : "Wrong email or password."); return; }
    await startDesk(data.session);
  });
  $("#signout").addEventListener("click", async ()=>{ await supabase.auth.signOut(); location.reload(); });
  supabase.auth.onAuthStateChange((event)=>{ if(event==="SIGNED_OUT") showGate(""); });
  const { data:{ session } } = await supabase.auth.getSession();
  if(session) await startDesk(session); else showGate("");
}
function softRender(){
  if(["new","settings"].includes(S.view) || S.carEdit || S.custEdit){ refreshCarOptions(); updateSummary(); return; }
  if(S.view==="customers" && !S.custView){ const l=$("#custlist"); if(l){ l.innerHTML=custListHTML(); return; } }
  if(S.view==="customers" && S.custView && ($("#doc_file")?.files?.length || S.uploading)) return;
  render();
}
async function write(path, data){
  if(S.dbState!=="on") return true;
  try{ await S.db.doc(path).set(data); return true; }
  catch(e){
    if(e && e.code==="unavailable"){ await new Promise(r=>setTimeout(r,600+Math.random()*600)); try{ await S.db.doc(path).set(data); return true; }catch(_){} }
    toast(e && e.code==="quota_exceeded" ? "Storage is full. Delete old returned bookings to add new ones." : e && e.code==="invalid_argument" ? "You don't have permission to change bookings on this page." : "Couldn't save. Check your connection and try again.");
    return false;
  }
}
async function remove(path){ if(S.dbState!=="on") return true; try{ await S.db.doc(path).delete(); return true; }catch(e){ toast("Couldn't delete. Try again."); return false; } }
function localUpsert(list, obj){ const i=list.findIndex(x=>x.id===obj.id); if(i>=0) list[i]=obj; else list.push(obj); }

/* ---------- agreement model (template v2.0) ---------- */
function V(x){ return (x===undefined||x===null||x==="") ? null : String(x); }
function buildAgreement(b){
  const s=S.settings, car=carOf(b)||{}, c=calc(b), sup=s.support_phone;
  const dep = depText(b); const cashDep = depType(b)==="cash";
  const hasAddl = !!(b.addl_name||"").trim();
  const T=[];
  T.push({h:"Parties", body:[
    {t:"p", text:`This Self-Drive Vehicle Rental Agreement (the "Agreement") is made on ${fmtD(b.agreement_date||b.created_at)||"________"} at Pune, Maharashtra.`},
    {t:"p", text:`BETWEEN ${s.legal_name}, a sole proprietorship of Mr. ${s.signatory||"________"}, having its place of business at ${s.address}, registered under the Maharashtra Shops and Establishments (Regulation of Employment and Conditions of Service) Act, 2017 (Registration No. ${s.shop_act||"________"}) and with Udyam (Registration No. ${s.udyam||"________"}) ("DriveKaro", which expression includes its proprietor, successors and permitted assigns), of the FIRST PART;`},
    {t:"p", text:`AND the person named as the Hirer in Schedule I (the "Hirer", which expression includes the Hirer's heirs, executors, administrators and legal representatives), of the SECOND PART. DriveKaro and the Hirer are each a "Party" and together the "Parties".`},
    {t:"p", text:"WHEREAS: (A) DriveKaro carries on the business of leasing self-drive (without driver) motor vehicles to customers for their personal use, and is the registered owner of, or is authorised in writing by the registered owner to lease, the vehicle described in Schedule II (the \"Vehicle\"); (B) the Hirer has requested to hire the Vehicle for personal use for the Booking Period, has completed DriveKaro's identity and licence verification, and has had an opportunity to read this Agreement before signing it; and (C) DriveKaro has agreed to rent the Vehicle to the Hirer on the terms of this Agreement."},
    {t:"p", text:"NOW, THEREFORE, THE PARTIES AGREE AS FOLLOWS:"}
  ]});
  T.push({h:"1. Definitions and Interpretation", body:[
    {t:"p", text:"1.1 In this Agreement:"},
    {t:"ol", items:[
      '"Additional Driver" means a person named as an additional driver in Schedule I whom DriveKaro has verified and approved in writing before handover.',
      '"Applicable Law" means all laws, rules, regulations, notifications and orders in force in India, including the Motor Vehicles Act, 1988, the Central Motor Vehicles Rules, 1989 and the Maharashtra Motor Vehicles Rules, 1989.',
      '"Authorised Driver" means the Hirer and any Additional Driver.',
      '"Booking Period" means the period from the Start Time to the End Time stated in Schedule III, as extended under clause 2.5.',
      '"Charges" means the rental amount stated in Schedule III (the "Rental Charges") and every other amount payable by the Hirer under this Agreement or Schedule III.',
      '"Damage Limit" means the amount per incident stated in Schedule III up to which the Hirer pays the repair cost of the Vehicle directly, without an insurance claim.',
      '"Excluded Event" has the meaning given in clause 10.4.',
      '"Handover Record" means Part B of Schedule II together with the time-stamped photographs and video of the Vehicle taken at handover.',
      '"Insured Declared Value" or "IDV" means the insured declared value of the Vehicle stated in its insurance policy on the date of the relevant event.',
      '"Return Record" means the record of the Vehicle\'s condition made at return together with the time-stamped photographs and video taken at return.',
      '"Security Deposit" means the refundable deposit stated in Schedule III.',
      '"Tracking Device" means any GPS, telematics, immobiliser, dash camera (recording the road only) or similar device fitted to the Vehicle by DriveKaro.',
      '"Vehicle Documents" means the registration certificate, insurance certificate, pollution under control certificate, permit and any other document the Vehicle must carry under Applicable Law.'
    ]},
    {t:"p", text:'1.2 Headings are for convenience only. Words in the singular include the plural and vice versa. "Including" means "including without limitation". A reference to a statute includes any amendment or re-enactment of it. The Schedules form part of this Agreement. "Rent", "hire" and "lease" have the same meaning in this Agreement. If a clause and Schedule III differ on an amount, Schedule III prevails; on anything else, the clause prevails.'}
  ]});
  T.push({h:"2. Rental of the Vehicle", body:[
    {t:"p", text:"2.1 DriveKaro rents the Vehicle to the Hirer, and the Hirer hires it, for the Booking Period on the terms of this Agreement."},
    {t:"p", text:"2.2 This Agreement is a lease of the Vehicle for a limited period for the Hirer's personal use, of the kind referred to in section 51 of the Motor Vehicles Act, 1988, and a bailment under sections 148 to 171 of the Indian Contract Act, 1872. The Hirer receives only temporary possession and use. Ownership and title remain with the registered owner at all times, including for all purposes of the Motor Vehicles Act, 1988. The Hirer shall not sell, pledge, mortgage, sub-let, lend or part with possession of the Vehicle, or allow any lien or charge to arise over it."},
    {t:"p", text:"2.3 The Hirer shall take the same care of the Vehicle as a person of ordinary prudence would take of their own vehicle."},
    {t:"p", text:"2.4 The Booking Period starts at the Start Time whether or not the Hirer collects the Vehicle at that time, subject to the cancellation terms in clause 13."},
    {t:"p", text:"2.5 The Hirer may request an extension before the End Time. An extension is valid only when DriveKaro confirms it in writing, including by WhatsApp or through its booking system, and the Hirer pays the extension Charges. Possession after the End Time without a confirmed extension is unauthorised and clause 12 applies."},
    {t:"p", text:"2.6 The Vehicle is handed over and returned at the location stated in Schedule III (the \"Designated Location\"). Where DriveKaro agrees to deliver or collect the Vehicle elsewhere, the delivery charge in Schedule III applies and the Hirer's responsibility for the Vehicle starts at handover and ends at return."}
  ]});
  T.push({h:"3. Eligibility, Verification and Authorised Drivers", body:[
    {t:"p", text:"3.1 The Hirer represents, and shall ensure that every Additional Driver is, a person who:"},
    {t:"ol", items:[
      `is at least ${s.min_age} years old, or ${s.min_age_premium} years old for a Vehicle in the SUV or luxury category;`,
      `holds a valid Indian driving licence for light motor vehicles issued at least ${s.dl_min_months} months before the Start Time, or, for a foreign national, a valid International Driving Permit with the national licence and passport;`,
      "does not hold a licence that is suspended, revoked, disqualified or under proceedings for suspension; and",
      "is medically fit to drive and not dependent on any intoxicant."
    ]},
    {t:"p", text:"3.2 Before handover, each Authorised Driver shall produce the original driving licence and a government photo identity document, allow a photograph to be taken, and provide any further document DriveKaro reasonably requests. DriveKaro may verify the licence through the Parivahan or Sarathi portals."},
    {t:"p", text:"3.3 DriveKaro does not collect or store any person's full Aadhaar number. Where an Aadhaar card is used for identity, only a masked copy showing the last four digits is kept. The Hirer's Aadhaar number is entered by the Hirer only on the licensed eSign service provider's page when signing."},
    {t:"p", text:"3.4 Only an Authorised Driver may drive the Vehicle. An Additional Driver does not sign this Agreement; the Hirer is fully responsible for every Additional Driver as if the Hirer were driving, any act or omission of an Additional Driver is treated as the act or omission of the Hirer, and the Hirer confirms that each Additional Driver has been told of and agrees to follow the rules in this Agreement."},
    {t:"p", text:"3.5 DriveKaro may refuse or stop handover if verification cannot be completed, a document appears altered or does not match the person, or an Authorised Driver appears unfit to drive. DriveKaro will then refund all Charges and the Security Deposit paid, except where the refusal is due to a forged document or false information."}
  ]});
  T.push({h:"4. Charges, Security Deposit and Payment", body:[
    {t:"p", text:"4.1 The Hirer shall pay the Rental Charges and other Charges stated in Schedule III. Rental Charges are payable, and the Security Deposit shall be paid or handed over, in full before handover unless Schedule III states otherwise."},
    {t:"p", text:"4.2 Rental Charges are calculated in blocks of 24 hours from the Start Time. A part block is charged as stated in Schedule III."},
    {t:"p", text:"4.3 The Rental Charges include the kilometre allowance stated in Schedule III. Distance beyond the allowance is charged at the excess kilometre rate in Schedule III, measured by the odometer readings in the Handover Record and the Return Record. If the odometer is faulty or has been tampered with, the distance recorded by the Tracking Device is used."},
    {t:"p", text:"4.4 The fixed charges in Schedule III for late return, fuel shortfall, cleaning, night handling, lost keys or documents and similar matters are a genuine pre-estimate of the loss DriveKaro is likely to suffer from each event and are not penalties. They do not cover damage to or loss of the Vehicle, which is dealt with in clause 10."},
    {t:"p", text:"4.5 Where DriveKaro pays any toll, fine, fuel, inter-state tax, permit fee or other amount that is the Hirer's responsibility, the Hirer shall reimburse it on demand together with the processing charge stated in Schedule III."},
    {t:"p", text:"4.6 DriveKaro is not registered under the Goods and Services Tax laws on the date of this Agreement and does not charge GST. If DriveKaro becomes registered, GST at the applicable rate shall be payable in addition to the Charges for bookings made after registration, and DriveKaro shall issue a tax invoice. DriveKaro shall issue a receipt for every amount collected."},
    cashDep
      ? {t:"p", text:"4.7 The Security Deposit is interest-free and is held as security for the Hirer's obligations. It is not a limit on the Hirer's liability. After return of the Vehicle, DriveKaro shall refund the Security Deposit, less amounts due under this Agreement, within the period stated in Schedule III. DriveKaro may hold back the amount stated in Schedule III as the Challan Holdback for up to the period stated there, to cover traffic challans and tolls that are notified after return, and shall then refund any unused balance."}
      : {t:"p", text:`4.7 The Hirer hands over the Security Deposit described in Schedule III as security for the Hirer's obligations under this Agreement. It is not a limit on the Hirer's liability. DriveKaro shall keep it safely, shall not use it, and shall return it to the Hirer when the Vehicle is returned and all amounts then due under this Agreement have been paid; until then DriveKaro may retain it.${depType(b)==="bike"?" The Hirer confirms that they own the two-wheeler or are authorised by its owner to give it as security, and that it has valid registration and insurance. DriveKaro is not responsible for ordinary wear or for any loss or damage to it not caused by DriveKaro's negligence while it is in DriveKaro's custody, and may keep it parked at its premises.":""}`},
    {t:"p", text:`4.8 DriveKaro shall give the Hirer an itemised statement of any deduction, with supporting photographs, invoices or challan copies. The Hirer may dispute a deduction in writing within 7 days of receiving the statement. ${cashDep?"Any amount due in excess of the Security Deposit":"Any amount due"} is payable within 7 days of the statement; unpaid amounts carry simple interest at ${s.late_interest} per cent per annum from the due date until payment.`},
    {t:"p", text:"4.9 Payments are valid only when made to DriveKaro's official bank account or UPI ID stated in Schedule III, or in cash against a DriveKaro receipt. A payment made to any other account or person does not discharge the Hirer."}
  ]});
  T.push({h:"5. Handover and Inspection", body:[
    {t:"p", text:"5.1 DriveKaro shall hand over the Vehicle at the Designated Location to an Authorised Driver in person, on production of the original driving licence."},
    {t:"p", text:"5.2 Before handover, the Parties shall inspect the Vehicle together. DriveKaro shall record the odometer reading, fuel or charge level, keys, accessories and all existing damage in the Handover Record, and shall share the time-stamped photographs and video with the Hirer before the keys are handed over."},
    {t:"p", text:"5.3 The Hirer shall point out any damage or defect not recorded before accepting the Vehicle. On acceptance, the Vehicle is treated as received in the condition shown in the Handover Record, except for defects that a reasonable inspection could not have revealed."},
    {t:"p", text:"5.4 DriveKaro shall provide the Vehicle Documents in the Vehicle, in physical form or through DigiLocker or mParivahan. The Hirer shall keep them safe and return them with the Vehicle."},
    {t:"p", text:"5.5 DriveKaro is not required to hand over the Vehicle until this Agreement has been signed by both Parties, the Charges due before handover have been paid, the Security Deposit has been paid or handed over, and verification under clause 3 is complete."}
  ]});
  T.push({h:"6. Permitted and Prohibited Use", body:[
    {t:"p", text:"6.1 The Vehicle may be used only for personal, family and leisure travel, driven by an Authorised Driver on public roads within India, excluding the areas listed in Schedule III as restricted unless DriveKaro approves them in writing (the \"Permitted Territory\")."},
    {t:"p", text:"6.2 The Vehicle shall not be used:"},
    {t:"ol", items:[
      "by any person who is not an Authorised Driver;",
      "to carry passengers or goods for hire or reward, for ride-hailing or delivery work, or for sub-rental of any kind;",
      "for racing, rallies, speed tests, stunts, off-road driving, or on beaches, riverbeds, unmade tracks or flooded roads;",
      "by a driver under the influence of alcohol, a drug or any intoxicant, including in breach of section 185 of the Motor Vehicles Act, 1988;",
      "to tow or push any vehicle or trailer, or to jump-start another vehicle;",
      "to carry more persons than its registered seating capacity or a load above its permitted weight;",
      "to carry hazardous, inflammable, illegal or prohibited goods, weapons or contraband;",
      "for driving lessons, or by a holder of a learner's licence;",
      "for any offence or unlawful purpose;",
      "while the driver holds a mobile phone or uses any device in a way that breaches Applicable Law;",
      "outside the Permitted Territory, and in no case outside India; or",
      "in any way that breaches the conditions of the Vehicle's insurance policy."
    ]},
    {t:"p", text:"6.3 Smoking, vaping and drinking alcohol inside the Vehicle are prohibited. Pets may be carried only with DriveKaro's prior written consent and in a carrier or on a seat cover."},
    {t:"p", text:"6.4 Sale, mortgage or pledge prohibited. The Hirer shall not sell, mortgage, pledge, pawn, hypothecate, rent out or lend the Vehicle, or hand over the Vehicle, its keys or its Vehicle Documents to any person as security for money or for any other purpose, and shall not remove or change the Vehicle's number plates, Tracking Device or identification marks. If the Hirer does or attempts any of these:"},
    {t:"ol", items:[
      "this Agreement ends at once without notice, and the Hirer's right to possess the Vehicle ends;",
      "DriveKaro may take back the Vehicle at any time, from any place and from any person holding it, by lawful means, including by using the Tracking Device and immobiliser;",
      "DriveKaro may make a police complaint and file a first information report against the Hirer and every person involved, including for dishonest misappropriation (section 314), criminal breach of trust (section 316) and cheating (section 318) under the Bharatiya Nyaya Sanhita, 2023, and against any person who knowingly receives the Vehicle (section 317); the Hirer consents to DriveKaro giving this Agreement, the KYC records and the Tracking Device records to the police;",
      "because the Hirer is not the owner, no person who buys the Vehicle, takes it on mortgage or accepts it as security gets any right in it (section 27 of the Sale of Goods Act, 1930), and DriveKaro owes that person nothing; and",
      "the Hirer shall pay the Charges until the Vehicle is recovered, all recovery, towing, legal and police-related costs, and any damage to the Vehicle, and DriveKaro may apply the Security Deposit towards these amounts."
    ]},
    {t:"p", text:"6.5 Any breach of this clause 6 is a material breach of this Agreement."}
  ]});
  T.push({h:"7. Hirer's Obligations During the Rental", body:[
    {t:"p", text:"7.1 The Hirer shall, and shall ensure that every Authorised Driver shall:"},
    {t:"ol", items:[
      "drive with due care and comply with Applicable Law, including speed limits and the use of seat belts and child restraints;",
      "carry the original driving licence while driving;",
      "lock the Vehicle, close its windows and keep the keys in their possession whenever the Vehicle is unattended, and park only in lawful and reasonably safe places;",
      "use only the fuel type stated in Schedule II, and bear the full cost of any damage caused by wrong fuel;",
      "stop driving as soon as it is safe and call DriveKaro if a red warning light (engine, oil pressure, temperature, brake or battery) appears;",
      `not repair, modify or add anything to the Vehicle without DriveKaro's written consent, except an emergency repair costing no more than ${inr(s.emergency_repair_limit)}, supported by a receipt, which DriveKaro shall reimburse unless the repair was needed because of the Hirer's breach;`,
      "tell DriveKaro immediately if their driving licence is suspended, seized or revoked, or if they are booked for drunk driving or dangerous driving during the Booking Period;",
      "answer calls and messages from DriveKaro's registered numbers and confirm the Vehicle's location when reasonably asked;",
      "allow DriveKaro to inspect the Vehicle on 4 hours' notice, or at once where there is a safety or theft concern; and",
      "not do or allow anything that could make the Vehicle's insurance void or unenforceable."
    ]}
  ]});
  T.push({h:"8. Tracking and In-Vehicle Devices", body:[
    {t:"p", text:"8.1 The Vehicle is fitted with a Tracking Device. The Hirer consents to DriveKaro recording the Vehicle's location, route, speed, distance and ignition status during the Booking Period for safety, theft prevention and recovery, billing, accident investigation, dispute resolution and legal compliance. This data is handled under clause 16."},
    {t:"p", text:"8.2 The Hirer shall not disconnect, obstruct, damage or remove any Tracking Device. Doing so is a material breach and the Hirer shall pay the charge stated in Schedule III and any further loss DriveKaro proves."},
    {t:"p", text:`8.3 DriveKaro may use the immobiliser function only where: (a) the Vehicle has not been returned within ${s.non_return_hours} hours after the End Time without a confirmed extension and the Hirer cannot be reached; (b) DriveKaro reasonably believes the Vehicle has been stolen or is being driven by a person who is not an Authorised Driver; (c) the Vehicle has been taken outside the Permitted Territory; or (d) DriveKaro reasonably believes the Vehicle has been sold, mortgaged or pledged in breach of clause 6.4. DriveKaro shall first try to contact the Hirer where practicable, and shall use the function only in a way that stops the engine from restarting once switched off, never while the Vehicle is moving.`}
  ]});
  T.push({h:"9. Accident, Theft, Breakdown and Other Incidents", body:[
    {t:"p", text:"9.1 If the Vehicle is involved in an accident, is damaged, stolen or seized, or breaks down, the Hirer shall:"},
    {t:"ol", items:[
      "first ensure the safety of all persons and call emergency services on 112 where needed;",
      `inform DriveKaro on ${sup} as soon as it is safe to do so and in any case within 1 hour, or, if an Authorised Driver is injured, as soon as physically possible;`,
      "take photographs or video of the scene, all vehicles, number plates, the other party's licence and insurance, any injuries and any witnesses, and send them to DriveKaro within 2 hours;",
      "not admit liability, make any payment or settle with any person without DriveKaro's written consent;",
      "not leave the Vehicle unattended unless it is unsafe to stay, and in that case secure it and take the keys;",
      "report the incident to the nearest police station and obtain a copy of the FIR or report in every case of theft, injury, death, damage to third-party property or hit-and-run, or where the insurer requires it, and give DriveKaro a copy within 24 hours;",
      "give DriveKaro a written account of the incident and cooperate with the police, the insurer and its surveyor; and",
      "follow DriveKaro's instructions on towing and repair."
    ]},
    {t:"p", text:"9.2 If the Vehicle breaks down through normal wear or a mechanical defect not caused by the Hirer, DriveKaro shall arrange roadside assistance and repair or, where reasonably available, a replacement vehicle of similar category. If neither is possible, DriveKaro shall refund the Rental Charges for the unused part of the Booking Period. The Hirer is not charged for such a breakdown."},
    {t:"p", text:"9.3 Towing and repair costs, and rent at the daily rental rate for the days the Vehicle is off the road, for a breakdown caused by the Hirer's misuse, including wrong fuel, running out of fuel, ignoring warning lights or driving through water, are payable by the Hirer."}
  ]});
  T.push({h:"10. Insurance and Liability for Damage or Loss", body:[
    {t:"p", text:"10.1 DriveKaro shall keep the Vehicle covered throughout the Booking Period by a comprehensive motor insurance policy covering own damage, theft and third-party liability as required by the Motor Vehicles Act, 1988. The policy number and validity are stated in Schedule II. The Hirer shall do nothing that gives the insurer grounds to refuse a claim, and shall give true and complete information to the police, the insurer and its surveyor."},
    {t:"p", text:"10.2 Claims by third parties for death, bodily injury or property damage arising from the use of the Vehicle shall be handled under that policy. The Hirer shall cooperate fully in the defence of any such claim."},
    {t:"p", text:`10.3 For damage to the Vehicle in an incident that is not an Excluded Event, the Hirer shall pay:`},
    {t:"ol", items:[
      `if the total repair cost is up to the Damage Limit (${money(b,"damage_limit")}), the actual repair cost, and DriveKaro shall not make an insurance claim for it;`,
      "if the total repair cost is more than the Damage Limit, the part of the repair cost that the insurer does not pay after DriveKaro claims under the insurance policy, including the compulsory and voluntary excess, depreciation deducted on replaced parts, and any item the insurer disallows;",
      "in every case, the cost of damage the policy does not cover, such as damage to tyres and wheels not caused in an insured accident, interior damage from spills, burns or stains, and loss of or damage to keys, Vehicle Documents and accessories; and",
      `rent at the daily rental rate in Schedule III (${inr(b.rate)} per day) for each day the Vehicle is at the workshop or otherwise off the road because of the damage, from the day of the incident until the repaired Vehicle is released, as shown by the workshop's job card or invoice.`
    ]},
    {t:"p", text:"10.4 Each of the following is an \"Excluded Event\":"},
    {t:"ol", items:[
      "the Vehicle was driven by a person who is not an Authorised Driver;",
      "the driver was under the influence of alcohol, a drug or any intoxicant;",
      "the driver did not hold a valid driving licence for the Vehicle;",
      "the Vehicle was used for any purpose prohibited by clause 6.2 or outside the Permitted Territory;",
      "the Hirer failed to comply with clause 9.1 and this prejudiced an insurance claim;",
      "the Vehicle was stolen after being left unlocked or with the keys inside it, or the keys were not returned after a theft;",
      "the damage or loss was caused wilfully, or by racing or driving far above the speed limit; or",
      "the insurer rejected or reduced the claim because of an act, omission or false statement of an Authorised Driver."
    ]},
    {t:"p", text:"10.5 In an Excluded Event, clause 10.3 does not apply and the Hirer is liable for the full cost of repair, towing, assessment and loss of use, and for any third-party liability that the insurer recovers from DriveKaro or refuses to pay. If the Vehicle is stolen or declared a total loss in an Excluded Event, the Hirer shall also pay the difference between the Vehicle's IDV and any amount DriveKaro actually receives from the insurer."},
    {t:"p", text:"10.6 If the Vehicle is stolen or declared a total loss in an incident that is not an Excluded Event, the Hirer shall pay the amount the insurer deducts from the claim (such as the compulsory excess) and any Charges due up to the date of the incident, provided the Hirer has complied with clause 9.1."},
    {t:"p", text:"10.7 Repairs shall be carried out at an authorised or reputable workshop. DriveKaro shall give the Hirer a copy of the estimate or invoice and the photographs relied on. The Hirer may, at the Hirer's cost, have the damage inspected by an independent surveyor within 3 days of being notified."},
    {t:"p", text:"10.8 The Vehicle's insurance may not cover personal accident for the Hirer or passengers, or personal belongings. DriveKaro is not liable for loss of belongings left in the Vehicle, except where caused by DriveKaro's own negligence."}
  ]});
  T.push({h:"11. Traffic Offences, Tolls and Seizure", body:[
    {t:"p", text:"11.1 The Hirer is responsible for all traffic challans, fines, penalties, compounding fees, tolls, parking charges and inter-state taxes or permit fees relating to the Vehicle during the Booking Period, including those notified after the Vehicle is returned."},
    {t:"p", text:"11.2 DriveKaro shall send the Hirer a copy of each challan it receives. The Hirer shall pay it within 7 days and send proof, failing which DriveKaro may pay it and recover the amount under clause 4.5, including from any Challan Holdback. The Hirer consents to DriveKaro giving the Authorised Driver's name, address and licence details to any authority entitled to them, including under section 133 of the Motor Vehicles Act, 1988, and shall attend any court or authority where required."},
    {t:"p", text:"11.3 Tolls paid through the FASTag fitted to the Vehicle are recoverable from the Hirer at the amount deducted."},
    {t:"p", text:"11.4 If the Vehicle is detained, seized or impounded by any authority during the Booking Period because of an act or omission of an Authorised Driver, the Hirer shall inform DriveKaro within 1 hour, take all steps to secure its release, and pay all fines, release charges, towing and storage costs and rent at the daily rental rate in Schedule III for each day until release. If the seizure is caused by a defect in the Vehicle Documents or any failure of DriveKaro, DriveKaro shall bear those costs and refund the Rental Charges for the lost period."}
  ]});
  T.push({h:"12. Return of the Vehicle", body:[
    {t:"p", text:"12.1 The Hirer shall return the Vehicle at the Designated Location by the End Time, with all keys, Vehicle Documents, accessories and Tracking Devices, with the same fuel or charge level as in the Handover Record, and in the same condition apart from fair wear and tear."},
    {t:"p", text:`12.2 The Parties shall inspect the Vehicle together at return and complete the Return Record. If DriveKaro has agreed to an unattended return, DriveKaro shall inspect the Vehicle within ${s.return_inspection_hours} hours and send the Hirer the Return Record and photographs, and the Hirer may object in writing within 48 hours.`},
    {t:"p", text:"12.3 A return after the grace period stated in Schedule III attracts the hourly late return charge in Schedule III, up to the daily rate for each 24 hours of delay. This charge does not extend the Booking Period or authorise continued use."},
    {t:"p", text:"12.4 If the Vehicle is left at a place other than the Designated Location without DriveKaro's consent, the Hirer shall pay the reasonable cost of bringing it back."},
    {t:"p", text:"12.5 Excess kilometres, fuel shortfall, extra cleaning and missing items are charged as stated in Schedule III."},
    {t:"p", text:`12.6 If the Vehicle is not returned within ${s.non_return_hours} hours after the End Time without a confirmed extension, and the Hirer cannot be reached or refuses to return it:`},
    {t:"ol", items:[
      "the Hirer's right to possess the Vehicle ends automatically;",
      "the Hirer irrevocably authorises DriveKaro and its agents to take back the Vehicle from any place where it can lawfully be accessed, and to use the Tracking Device and clause 8.3 for that purpose;",
      "DriveKaro may contact the emergency contact in Schedule I and report the matter to the police, including by a first information report for criminal breach of trust under section 316 or dishonest misappropriation of property under section 314 of the Bharatiya Nyaya Sanhita, 2023; and",
      "the Hirer shall pay the Charges up to the date of recovery, all reasonable recovery costs and any damage to the Vehicle."
    ]},
    {t:"p", text:"12.7 DriveKaro and its agents shall act only by lawful means. Nothing in this Agreement permits the use of force, threats or intimidation, or entry onto private property without consent."},
    {t:"p", text:"12.8 After the Return Record is completed, the Hirer is not responsible for anything that happens to the Vehicle, except for Charges relating to the Booking Period that are notified later and for damage that could not reasonably be seen at the return inspection, such as underbody damage, notified to the Hirer with evidence within 48 hours of return."}
  ]});
  T.push({h:"13. Cancellation, Suspension and Termination", body:[
    {t:"p", text:"13.1 The Hirer may cancel the booking before the Start Time, and refunds of the Rental Charges are made as stated in Schedule III. If the Vehicle is not handed over, the Security Deposit is refunded or returned in full."},
    {t:"p", text:"13.2 If DriveKaro cancels before handover for any reason other than the Hirer's default, it shall refund all amounts paid in full within 7 days, or, if the Hirer agrees, provide a vehicle of the same or a higher category at no extra charge."},
    {t:"p", text:"13.3 DriveKaro may end the rental immediately by notice to the Hirer, including by WhatsApp or SMS, if:"},
    {t:"ol", items:[
      "the Hirer breaches clause 6 or clause 8.2;",
      "an Authorised Driver's licence is suspended, seized or revoked;",
      "any information or document given by the Hirer is false or forged;",
      "any Charge due is not paid when due;",
      "an Excluded Event occurs;",
      `the Hirer cannot be reached for ${s.unreachable_hours} consecutive hours during the Booking Period;`,
      "the Vehicle is seized under clause 11.4; or",
      "DriveKaro reasonably believes that continued use puts the Vehicle, the Hirer or the public at serious risk."
    ]},
    {t:"p", text:"13.4 On termination under clause 13.3, the Hirer shall return the Vehicle at once to the Designated Location or where DriveKaro reasonably directs, failing which clause 12.6 applies. DriveKaro shall refund the Rental Charges for the unused part of the Booking Period after setting off any amount due from the Hirer."},
    {t:"p", text:"13.5 Termination or expiry does not affect rights and liabilities that have already arisen. Clauses 4, 10, 11, 12.6 to 12.8, 15, 16 and 18 continue to apply after this Agreement ends."}
  ]});
  T.push({h:"14. Representations and Warranties", body:[
    {t:"p", text:"14.1 DriveKaro represents and warrants that:"},
    {t:"ol", items:[
      "it is the registered owner of the Vehicle or is authorised in writing by the registered owner to rent it out;",
      "at handover the Vehicle holds a valid registration certificate, insurance policy and pollution under control certificate, and DriveKaro holds every registration required by Applicable Law to carry on its business;",
      "the Vehicle is roadworthy at handover and has been serviced in line with the manufacturer's schedule; and",
      "it knows of no legal proceeding or order that prevents it from renting the Vehicle to the Hirer."
    ]},
    {t:"p", text:"14.2 The Hirer represents and warrants that:"},
    {t:"ol", items:[
      "all information and documents given to DriveKaro are true, complete and genuine;",
      "the Hirer has the legal capacity to enter into this Agreement;",
      "each Authorised Driver meets clause 3.1 and no proceeding or order restricts their right to drive; and",
      "the Vehicle will not be used for any purpose prohibited by clause 6.2."
    ]},
    {t:"p", text:"14.3 Apart from the warranties in this Agreement and those that cannot be excluded under Applicable Law, DriveKaro gives no other warranty about the Vehicle."}
  ]});
  T.push({h:"15. Indemnity and Limitation of Liability", body:[
    {t:"p", text:"15.1 The Hirer shall indemnify DriveKaro, its proprietor, employees and agents against all losses, claims, fines, penalties, costs and reasonable legal fees arising from:"},
    {t:"ol", items:[
      "any breach of this Agreement by an Authorised Driver;",
      "any Excluded Event or prohibited use of the Vehicle;",
      "any offence committed by an Authorised Driver during the Booking Period;",
      "any false information or forged document given by the Hirer; and",
      "any claim by a passenger or third party caused by an Authorised Driver's negligence, to the extent not paid by the insurer."
    ]},
    {t:"p", text:"15.2 DriveKaro is not liable for any indirect or consequential loss, such as a missed flight, event or business opportunity, unless caused by its gross negligence or wilful misconduct."},
    {t:"p", text:"15.3 DriveKaro's total liability to the Hirer under or in connection with this Agreement is limited to the Charges paid for the booking, except for death or personal injury caused by DriveKaro's negligence, including failure to maintain the Vehicle, and except for fraud."},
    {t:"p", text:"15.4 Nothing in this Agreement limits or excludes any liability or right that cannot be limited or excluded under Applicable Law, including the Consumer Protection Act, 2019."},
    {t:"p", text:"15.5 The indemnity in clause 15.1 continues after this Agreement ends."}
  ]});
  T.push({h:"16. Personal Data and Confidentiality", body:[
    {t:"p", text:"16.1 DriveKaro processes the personal data of each Authorised Driver as a data fiduciary under the Digital Personal Data Protection Act, 2023. It processes identity, contact, licence, verification, booking, payment, vehicle and Tracking Device data only to perform this Agreement, verify identity, keep people and the Vehicle safe, prevent fraud, keep accounts and tax records, handle insurance claims, establish or defend legal claims, and comply with Applicable Law."},
    {t:"p", text:"16.2 DriveKaro shares personal data only with its insurer, surveyors and workshops, its eSign, payment and verification service providers, its professional advisers, the emergency contact under clause 12.6, and authorities where required by law. DriveKaro does not sell personal data, and sends marketing messages only with separate consent."},
    {t:"p", text:`16.3 DriveKaro keeps booking and verification records for as long as needed for these purposes and for the periods required by tax and other laws. Tracking Device data for a booking is deleted within ${s.tracking_retention_days} days after return, unless it is needed for a claim, dispute or legal requirement.`},
    {t:"p", text:`16.4 The Hirer may ask to access, correct or erase their personal data, subject to legal retention requirements, by writing to ${s.grievance_email}. The Hirer may also complain to the Data Protection Board of India.`},
    {t:"p", text:"16.5 The Hirer confirms that the emergency contact named in Schedule I has agreed to be contacted by DriveKaro."},
    {t:"p", text:"16.6 Each Party shall keep confidential any personal or business information of the other received under this Agreement and use it only for this Agreement, except as permitted by this clause 16 or required by law."}
  ]});
  T.push({h:"17. Electronic Execution and Records", body:[
    {t:"p", text:"17.1 The Parties may sign this Agreement by Aadhaar-based electronic signature or any other electronic signature recognised under section 3A and the Second Schedule of the Information Technology Act, 2000. An electronically signed Agreement is as valid and binding as one signed in ink, and a contract formed electronically is valid under section 10A of that Act."},
    {t:"p", text:"17.2 The eSign certificate and audit trail, OTP and timestamp logs, the Handover Record and Return Record, messages exchanged by WhatsApp, SMS or email, payment records and Tracking Device data form part of the record of this Agreement. The Parties agree that they may be produced as electronic records under section 63 of the Bharatiya Sakshya Adhiniyam, 2023."},
    {t:"p", text:"17.3 DriveKaro shall send the Hirer a copy of the fully signed Agreement, with its audit trail, by email or WhatsApp promptly after signing."},
    {t:"p", text:"17.4 The Parties have chosen to execute this Agreement electronically without stamp paper. If stamp duty becomes payable on it under the Maharashtra Stamp Act, 1958, including for producing it in evidence, the Party producing it may pay the duty, and the Hirer shall reimburse the duty, but not any penalty."},
    {t:"p", text:"17.5 The Hirer confirms that the full Agreement was made available to them before signing, that they have read it or had it explained in a language they understand, and that they are signing voluntarily."}
  ]});
  T.push({h:"18. Governing Law and Dispute Resolution", body:[
    {t:"p", text:"18.1 This Agreement is governed by the laws of India."},
    {t:"p", text:`18.2 A Party with a dispute shall first raise it in writing, in the Hirer's case to ${s.grievance_email}. The Parties shall try in good faith to settle it within 15 days.`},
    {t:"p", text:`18.3 A dispute not settled within that time shall be referred to a sole arbitrator appointed by mutual agreement, or failing agreement under the Arbitration and Conciliation Act, 1996. The seat and venue of arbitration is Pune, the language is English, and hearings may be held online. Claims not exceeding ${inr(s.fast_track_limit)} shall be decided on documents under the fast-track procedure in section 29B of that Act.`},
    {t:"p", text:"18.4 Nothing in this clause prevents a Party from seeking urgent interim relief from a court at Pune, DriveKaro from reporting a criminal offence to the police, or the Hirer from approaching a Consumer Commission under the Consumer Protection Act, 2019."},
    {t:"p", text:"18.5 Subject to clauses 18.3 and 18.4, the courts at Pune, Maharashtra have exclusive jurisdiction."}
  ]});
  T.push({h:"19. General Provisions", body:[
    {t:"p", text:`19.1 Entire agreement. This Agreement, its Schedules, and DriveKaro's Terms and Conditions and Privacy Policy published at ${s.website} on the booking date form the entire agreement for this booking. If they conflict, this Agreement prevails.`},
    {t:"p", text:"19.2 Changes. A change to this Agreement is valid only if recorded in writing and accepted by both Parties, including by electronic message as provided in clause 2.5."},
    {t:"p", text:`19.3 Notices. Notices to the Hirer may be sent to the mobile number, WhatsApp number or email in Schedule I. Notices to DriveKaro shall be sent to ${sup}, ${s.support_email} or its address above. A notice sent electronically is received when sent, unless the sender receives a failure message; a notice sent by courier is received 3 days after dispatch.`},
    {t:"p", text:"19.4 Assignment. The Hirer may not assign or transfer any right or obligation under this Agreement. DriveKaro may assign its right to receive payments by notice to the Hirer."},
    {t:"p", text:"19.5 Force majeure. Neither Party is liable for a delay or failure caused by events beyond its reasonable control, such as natural disasters, epidemics, riots, curfews, strikes or government orders. The Parties shall then reschedule the rental or end it with a refund of the unused Rental Charges. This clause does not excuse payment for use already made or the Hirer's duty to keep the Vehicle safe."},
    {t:"p", text:"19.6 Waiver. A delay or failure to enforce a right is not a waiver of it."},
    {t:"p", text:"19.7 Severability. If any provision is held invalid or unenforceable, the rest of this Agreement remains in force and the Parties shall replace the invalid provision with a valid one as close as possible to its intent."},
    {t:"p", text:"19.8 Relationship. Nothing in this Agreement creates a partnership, joint venture or agency between the Parties."},
    {t:"p", text:"19.9 Language. This Agreement is made in English. If it is translated, the English version prevails."}
  ]});
  const hirerRows = [
    ["Full name (as on licence)", V(b.name)],
    ["Father's or spouse's name", V(b.father)],
    ["Date of birth", V(fmtD(b.dob))],
    ["Permanent address", V(b.address)],
    ["Mobile and WhatsApp", V(b.phone)],
    ["Alternate mobile", V(b.alt_phone)],
    ["Email", V(b.email)],
    ["Driving licence no.", V(b.dl)],
    ["Issuing RTO", V(b.rto)],
    ["Licence valid till", V(fmtD(b.dl_till))],
    ["Photo ID", V(b.aadhaar4 && `${b.id_type||"Aadhaar (masked)"}, XXXX ${b.aadhaar4}`)],
    ["Emergency contact", V(b.emergency)]
  ];
  const sched1 = [{t:"kv", title:"Hirer", rows:hirerRows}];
  if(hasAddl) sched1.push({t:"kv", title:"Additional Driver", rows:[["Full name",V(b.addl_name)],["Date of birth",V(fmtD(b.addl_dob))],["Mobile",V(b.addl_phone)],["Driving licence no.",V(b.addl_dl)],["Licence valid till",V(fmtD(b.addl_dl_till))]]});
  else sched1.push({t:"p", text:"Additional Driver: None. Only the Hirer may drive the Vehicle."});
  T.push({h:"Schedule I: Hirer and Additional Driver", body:sched1});
  T.push({h:"Schedule II: Vehicle and Handover Record", body:[
    {t:"kv", title:"Part A: Vehicle", rows:[
      ["Make and model", V(car.make_model)],
      ["Registration number", V(car.plate)],
      ["Chassis number (last 5)", V(car.chassis_last5)],
      ["Colour, year, fuel, transmission", V([car.colour,car.year,car.fuel,car.transmission].filter(Boolean).join(", "))],
      ["Seating capacity", V(car.seats)],
      ["Registration type and permit no.", V([car.reg_type, car.permit_no].filter(Boolean).join(", "))],
      ["Insurance policy no. and insurer", V([car.insurance_no, car.insurer].filter(Boolean).join(", "))],
      ["Insurance valid till", V(fmtD(car.insurance_till))],
      ["Insured Declared Value", V(car.idv && inr(car.idv))],
      ["PUC valid till", V(fmtD(car.puc_till))],
      ["FASTag fitted", V(car.fastag)]
    ]},
    {t:"kv", title:"Part B: Handover Record", rows:[
      ["Handover date and time", V(fmtDT(b.pickup))],
      ["Odometer (km)", V(b.odo && Number(b.odo).toLocaleString("en-IN"))],
      ["Fuel or charge level", V(b.fuel)],
      ["Keys handed over", V(b.keys)],
      ["Vehicle Documents", "RC, insurance, PUC (physical or DigiLocker)"],
      ["Existing exterior damage", V(b.ext_damage)],
      ["Existing interior damage", V(b.int_damage)],
      ["Photos and video", "Shared with the Hirer on WhatsApp at handover"]
    ]},
    {t:"p", text:"The Hirer confirms having inspected the Vehicle and seen the photographs and video, and accepts the Vehicle in the condition recorded."}
  ]});
  T.push({h:"Schedule III: Booking and Charges", body:[
    {t:"kv", rows:[
      ["Start Time", V(fmtDT(b.pickup))],
      ["End Time", V(fmtDT(b.drop))],
      ["Designated Location", V(b.location || s.designated_location)],
      ["Rental rate", V(b.rate && `${inr(b.rate)} per 24 hours`)],
      ["Duration", V(durText(c))],
      ["Hours beyond full days", V(ch(b,"part_block_rule"))],
      ["Rental Charges", V(c.days && b.rate ? inr(c.rental) : null)],
      ...(c.delivery ? [["Delivery or collection", inr(c.delivery)]] : []),
      ["GST", "Not charged (see clause 4.6)"],
      ["Security Deposit", V(dep)],
      ["Total collected before handover", V(c.days && b.rate ? inr(c.collected) : null)],
      ["Payment mode and reference", V([b.paymode,b.payref].filter(Boolean).join(", "))],
      ["DriveKaro's official payment accounts", V([s.official_upi && "UPI "+s.official_upi, s.official_bank && "Bank "+s.official_bank].filter(Boolean).join("; "))],
      ["Kilometre allowance", `${ch(b,"km_per_day")} km per 24 hours (${c.km||"__"} km for this booking)`],
      ["Excess kilometre charge", `${money(b,"extra_km")} per km`],
      ["Grace period for return", `${ch(b,"grace_minutes")} minutes`],
      ["Late return charge", `${money(b,"late_per_hour")} per hour, up to the daily rate per 24 hours`],
      ["Fuel shortfall", `Fuel at the prevailing pump price plus ${money(b,"refuel_fee")}`],
      ["Extra cleaning", `${money(b,"cleaning_charge")}; smoke odour or pet hair ${money(b,"smoking_charge")}`],
      ["Night handling (1:00 AM to 6:00 AM)", money(b,"night_charge")],
      ["Delivery or collection away from Designated Location", money(b,"delivery_charge")],
      ["Damage Limit (accident damage paid directly by Hirer)", `${money(b,"damage_limit")} per incident; above this, insurance claim and the Hirer pays the amount not paid by the insurer`],
      ["Rent while the Vehicle is at the workshop or seized", V(b.rate && `${inr(b.rate)} per day (the daily rental rate)`)],
      ["Lost key", money(b,"lost_key")],
      ["Lost Vehicle Document", money(b,"lost_doc")],
      ["Tracking Device tampering", money(b,"gps_tamper")],
      ["Processing charge for challans and tolls paid by DriveKaro", `${money(b,"challan_fee")} per item`],
      ...(cashDep ? [["Challan Holdback", `${money(b,"challan_holdback")} for up to ${ch(b,"challan_days")} days`],
        ["Security Deposit refund", `Within ${ch(b,"deposit_refund_days")} days of return`]]
        : [["Return of Security Deposit", "When the Vehicle is returned and all amounts due are paid"]]),
      ["Restricted areas", V(ch(b,"restricted_areas"))],
      ["Cancellation by Hirer", V(ch(b,"cancellation_terms"))]
    ]}
  ]});
  T.push({h:"Schedule IV: Return Record", body:[
    {t:"p", text:"Completed at return: return date and time, odometer and distance driven, excess kilometres, fuel level, new damage, missing items, cleaning condition, known challans or tolls, deductions with reasons, final amount refunded or payable, photo and video reference, and the Hirer's acknowledgement or objection."}
  ]});
  T.push({h:"Schedule V: Declaration and Signatures", sig:true, body:[
    {t:"p", text:`I, ${b.name||"________"}, the Hirer, confirm that I have read this Agreement and its Schedules in full; that the information and documents I have given are true; that I${hasAddl?" and the Additional Driver":""} meet the requirements of clause 3.1;${hasAddl?" that I take full responsibility for the Additional Driver under clause 3.4;":""} that I have inspected the Vehicle and accept the Handover Record; that I understand that selling, mortgaging or pledging the Vehicle is a criminal offence and allows DriveKaro to take it back at any time; that I consent to tracking under clause 8 and to the use of my data under clause 16; and that I sign voluntarily.`},
    {t:"p", text:"No signed Agreement, no handover."}
  ]});
  return {sections:T, car, calc:c, hasAddl};
}

function sigParties(b, A){
  const s=S.settings;
  const out=[["HIRER", `Aadhaar eSign by ${b.name||"________"}`]];
  out.push([`FOR ${s.legal_name.toUpperCase()}`, `Aadhaar eSign by ${s.signatory||"________"}, Proprietor`]);
  return out;
}
function agreementHTML(b){
  const A=buildAgreement(b);
  const val = v => v===null ? `<span class="blank miss">____________</span>` : esc(v);
  let h = `<h2>SELF-DRIVE VEHICLE RENTAL AGREEMENT</h2><div class="sub">${esc(S.settings.legal_name)} · Agreement No. ${esc(b.id)} · Template v2.0</div>`;
  for(const sec of A.sections){
    h += `<h4>${esc(sec.h)}</h4>`;
    for(const blk of sec.body){
      if(blk.t==="p") h += `<p>${esc(blk.text)}</p>`;
      else if(blk.t==="kv") h += (blk.title?`<p><b>${esc(blk.title)}</b></p>`:"") + `<table>${blk.rows.map(r=>`<tr><td>${esc(r[0])}</td><td>${val(r[1])}</td></tr>`).join("")}</table>`;
      else h += `<${blk.t}>${blk.items.map(i=>`<li>${esc(i)}</li>`).join("")}</${blk.t}>`;
    }
    if(sec.sig) h += `<div class="sigs">${sigParties(b,A).map(p=>`<div class="sig"><b>${esc(p[0])}</b>${esc(p[1])}<br>Timestamp and certificate added on signing</div>`).join("")}</div>`;
  }
  return h;
}

/* ---------- PDF ---------- */
function pdfSafe(t){ return String(t).replace(/₹\s?/g,"Rs. ").replace(/[—–]/g,"-").replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/·/g,"|").replace(/[^\x00-\xFF]/g,""); }
function buildPdf(b, opts={}){
  const {jsPDF} = window.jspdf; const doc=new jsPDF({unit:"mm",format:"a4"});
  const s=S.settings, A=buildAgreement(b);
  const W=210, M=18, CW=W-2*M; let y=M;
  const BOTTOM = opts.esign ? 297-44 : 297-18;
  const ensure = hNeed => { if(y+hNeed>BOTTOM){ doc.addPage(); y=M; } };
  const text = (t,size,style,x=M,w=CW,lh=1.45) => { doc.setFont("helvetica",style); doc.setFontSize(size); const lines=doc.splitTextToSize(pdfSafe(t),w); const step=size*0.3528*lh; for(const ln of lines){ ensure(step); doc.text(ln,x,y+step*0.8); y+=step; } };
  text("SELF-DRIVE VEHICLE RENTAL AGREEMENT",15,"bold"); y+=1;
  text(`${s.legal_name} | Agreement No. ${b.id} | Template v2.0`,9.5,"normal"); y+=3;
  for(const sec of A.sections){
    ensure(14); y+=2; doc.setDrawColor(190); doc.line(M,y,W-M,y); y+=3;
    text(sec.h.toUpperCase(),10.5,"bold"); y+=1;
    for(const blk of sec.body){
      if(blk.t==="p"){ text(blk.text,9.5,"normal"); y+=1.5; }
      else if(blk.t==="kv"){
        if(blk.title) text(blk.title,9.5,"bold");
        for(const [k,v] of blk.rows){
          doc.setFontSize(9.5); const vl=doc.splitTextToSize(pdfSafe(v===null?"______________________":v),CW*0.56); const kl=doc.splitTextToSize(pdfSafe(k),CW*0.4);
          const step=9.5*0.3528*1.45; const n=Math.max(vl.length,kl.length); ensure(step*n);
          doc.setFont("helvetica","normal"); doc.setTextColor(90); kl.forEach((l,i)=>doc.text(l,M,y+step*(i+0.8)));
          doc.setTextColor(0); vl.forEach((l,i)=>doc.text(l,M+CW*0.44,y+step*(i+0.8)));
          y+=step*n+0.6;
        }
        y+=1.5;
      } else {
        blk.items.forEach((it,i)=>{ const mark = blk.t==="ol" ? `(${String.fromCharCode(97+i)})` : "-"; doc.setFont("helvetica","normal"); doc.setFontSize(9.5); const step=9.5*0.3528*1.45; ensure(step); doc.text(mark,M+1,y+step*0.8); text(it,9.5,"normal",M+8,CW-8); y+=0.8; });
        y+=1;
      }
    }
    if(sec.sig){
      const ps=sigParties(b,A); const gap=6, bw=(CW-gap*(ps.length-1))/ps.length;
      ensure(40); y+=2;
      ps.forEach((c,i)=>{
        const x=M+i*(bw+gap); doc.setDrawColor(150); doc.setLineDashPattern([1.5,1.5],0); doc.roundedRect(x,y,bw,34,2,2); doc.setLineDashPattern([],0);
        doc.setFont("helvetica","bold"); doc.setFontSize(8.5); doc.splitTextToSize(pdfSafe(c[0]),bw-8).forEach((l,j)=>doc.text(l,x+4,y+6+j*3.6));
        doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.splitTextToSize(pdfSafe(c[1]),bw-8).forEach((l,j)=>doc.text(l,x+4,y+24+j*3.4));
      }); y+=38;
    }
  }
  const n=doc.getNumberOfPages();
  for(let i=1;i<=n;i++){ doc.setPage(i); doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(120);
    if(opts.esign){ doc.setDrawColor(210); doc.line(M,297-42,W-M,297-42); doc.setFontSize(7.5); doc.text("Hirer's Aadhaar eSign",M,297-38.5); doc.text(pdfSafe(`For ${s.legal_name}`),W-M,297-38.5,{align:"right"}); doc.setFontSize(8); } doc.text(pdfSafe(`${s.legal_name} | ${s.support_phone} | Agreement ${b.id}`),M,297-9); doc.text(`Page ${i} of ${n}`,W-M,297-9,{align:"right"}); doc.setTextColor(0); }
  return doc.output("blob");
}

/* ---------- validation ---------- */
function validate(b, forReady){
  const e={}; const s=S.settings;
  const need = (k,msg)=>{ if(!String(b[k]??"").trim()) e[k]=msg; };
  need("name","Enter the customer's full name as on the licence.");
  need("phone","Enter a mobile number.");
  if(b.phone && !PHONE_RE.test(b.phone.trim())) e.phone="Enter a 10-digit Indian mobile number.";
  if(b.alt_phone && !PHONE_RE.test(b.alt_phone.trim())) e.alt_phone="Enter a 10-digit Indian mobile number.";
  if(b.addl_phone && !PHONE_RE.test(b.addl_phone.trim())) e.addl_phone="Enter a 10-digit Indian mobile number.";
  if(b.email && !/^\S+@\S+\.\S+$/.test(b.email)) e.email="Enter a valid email or leave it blank.";
  if(b.aadhaar4 && !/^\d{4}$/.test(b.aadhaar4)) e.aadhaar4="Enter only the last 4 digits.";
  need("car_id","Choose a car.");
  { const c=custById(normPhone(b.phone)); if(c && c.blocked) e.phone=`${c.name||"This customer"} is marked do not rent${c.block_reason?`: ${c.block_reason}`:""}.`; }
  need("pickup","Set the pickup date and time.");
  need("drop","Set the drop-off date and time.");
  if(b.pickup && b.drop && new Date(b.drop)<=new Date(b.pickup)) e.drop="Drop-off must be after pickup.";
  if(b.rate!=="" && b.rate!=null && !(Number(b.rate)>0)) e.rate="Enter the daily rate.";
  // Only the essentials block the agreement; KYC and deposit details can be completed at pickup (see softMissing).
  if(forReady){ need("rate","Enter the daily rate."); }
  const car=S.fleet.find(c=>c.id===b.car_id); const min=/suv|luxury/i.test(car?.category||"")? s.min_age_premium : s.min_age;
  if(b.dob && b.pickup){ const a=ageOn(b.dob,b.pickup); if(a!==null && a<min) e.dob=`Customer is ${a}. This car needs age ${min}+.`; }
  if(b.addl_dob && b.pickup){ const a=ageOn(b.addl_dob,b.pickup); if(a!==null && a<min) e.addl_dob=`Driver is ${a}. This car needs age ${min}+.`; }
  if(b.dl_till && b.drop && new Date(b.dl_till+"T23:59")<new Date(b.drop)) e.dl_till="Licence expires before the drop-off date.";
  if(b.addl_dl_till && b.drop && new Date(b.addl_dl_till+"T23:59")<new Date(b.drop)) e.addl_dl_till="Licence expires before the drop-off date.";
  if(b.car_id && b.pickup && b.drop && !e.drop){
    const p=new Date(b.pickup), d=new Date(b.drop);
    const clash=S.bookings.find(x=>x.id!==b.id && x.car_id===b.car_id && !["cancelled","returned"].includes(x.status) && new Date(x.pickup)<d && new Date(x.drop)>p);
    if(clash) e.car_id=`Already booked for ${clash.name} (${fmtDT(clash.pickup)} to ${fmtDT(clash.drop)}).`;
  }
  if(forReady && car && b.drop && !e.car_id){
    const ins=docStatus(car.insurance_till,b.drop), puc=docStatus(car.puc_till,b.drop);
    if(ins.bad) e.car_id=`Insurance for ${car.plate} ${ins.label.toLowerCase()}. Renew it in the fleet profile first.`;
    else if(puc.bad) e.car_id=`PUC for ${car.plate} ${puc.label.toLowerCase()}. Renew it in the fleet profile first.`;
  }
  return e;
}
// Details that print as blanks if missing but don't stop the agreement from being sent.
function softMissing(b){
  const out=[]; const miss=(k,l)=>{ if(!String(b[k]??"").trim()) out.push(l); };
  miss("father","father's/spouse's name"); miss("dob","date of birth"); miss("address","address"); miss("emergency","emergency contact");
  miss("dl","licence number"); miss("dl_till","licence expiry"); miss("aadhaar4","ID last 4 digits");
  const t=depType(b);
  if(t==="cash" && (b.deposit===""||b.deposit==null)) out.push("deposit amount");
  if(t==="bike" && !String(b.dep_bike_no||"").trim()) out.push("deposit bike number");
  if(t==="document" && !b.dep_doc_type) out.push("deposit document");
  if((b.addl_name||"").trim()){ miss("addl_dl","additional driver's licence"); miss("addl_dob","additional driver's date of birth"); }
  const car=S.fleet.find(c=>c.id===b.car_id); if(car && !car.insurance_no) out.push(`${car.plate} insurance number`);
  return out;
}
function softNote(b){
  const m=softMissing(b); if(!m.length) return "";
  return `<p class="note" style="margin:0 0 10px">Not filled yet (optional, prints as blank): ${esc(m.join(", "))}. Add them before sending if you have them — they can't be added to an agreement after it's signed.</p>`;
}

/* ---------- views ---------- */
function setTabs(){ document.querySelectorAll(".tab").forEach(t=>t.setAttribute("aria-current", t.dataset.view===S.view?"page":"false")); }
function render(){
  setTabs();
  if(S.view==="customers"){ $("#main").innerHTML=viewCustomers(); return; }
  if(S.view==="revenue"){ $("#main").innerHTML=viewRevenue(); return; }
  const m=$("#main");
  if(S.view==="bookings") m.innerHTML = S.selected ? viewDetail() : viewList();
  else if(S.view==="new"){ m.innerHTML = viewForm(); updateSummary(); }
  else if(S.view==="fleet") m.innerHTML = viewFleet();
  else if(S.view==="settings") m.innerHTML = viewSettings();
}

function viewList(){
  const now=new Date();
  const active=S.bookings.filter(b=>b.status==="handed").length;
  const upcoming=S.bookings.filter(b=>!["cancelled","returned","handed"].includes(b.status) && new Date(b.pickup)>=new Date(now-864e5)).length;
  const pending=S.bookings.filter(b=>["draft","ready","sent"].includes(b.status)).length;
  const F={active:b=>!["returned","cancelled"].includes(b.status), all:()=>true, returned:b=>b.status==="returned", cancelled:b=>b.status==="cancelled"};
  const list=S.bookings.filter(F[S.filter]).sort((a,b)=>new Date(a.pickup)-new Date(b.pickup));
  return `
  <div class="head-row">
    <div><h2>Bookings</h2>
      <div class="stats num"><span><b>${active}</b>cars out now</span><span><b>${upcoming}</b>upcoming</span><span><b>${pending}</b>waiting on agreement</span></div>
    </div>
    <button class="btn primary" data-act="new">+ New booking</button>
  </div>
  <div class="filters" role="group" aria-label="Filter bookings">
    ${[["active","Open"],["all","All"],["returned","Returned"],["cancelled","Cancelled"]].map(([k,l])=>`<button class="chip" aria-pressed="${S.filter===k}" data-filter="${k}">${l}</button>`).join("")}
  </div>
  <div class="list">
    ${S.dbState==="loading"? `<div class="empty">Loading bookings…</div>` : list.length? list.map(rowHTML).join("") : `<div class="empty"><h3>No bookings here yet</h3>${S.fleet.length? "Add a booking and its agreement is filled in automatically." : "Start by adding your cars in Fleet, then create a booking."}</div>`}
  </div>`;
}
function rowHTML(b){
  const car=carOf(b)||{}; const c=calc(b); const st=STATUS[b.status]||STATUS.draft;
  return `<button class="row" data-open="${esc(b.id)}">
    <span class="pl">${car.plate?`<span class="plate">${esc(car.plate)}</span>`:`<span class="muted">No car</span>`}</span>
    <span class="who"><b>${esc(b.name||"Unnamed")} ${b.example?'<span class="ex">Example</span>':""}</b><small>${esc(car.make_model||"")}</small></span>
    <span class="when num">${esc(fmtDT(b.pickup))}<br><small>to ${esc(fmtDT(b.drop))}</small></span>
    <span class="amt num">${c.days?inr(c.collected):"—"}<br><small class="muted">${c.days?c.days+" day"+(c.days>1?"s":""):""}</small></span>
    <span class="st"><span class="pill ${st.cls}">${st.label}</span></span>
  </button>`;
}

/* ---------- payments, invoice, WhatsApp ---------- */
const PAY_KINDS = {payment:"Payment received", deposit_in:"Deposit received", deposit_used:"Adjusted from deposit", deposit_refund:"Deposit refunded"};
const EXTRA_LABELS = ["Extra kilometres","Late return","Fuel shortfall","Extra cleaning","Night handling","Traffic challan / toll","Accident damage","Insurance shortfall","Garage days rent","Lost key or document","Other"];
const sum = (arr,f)=>arr.reduce((s,x)=>s+(Number(f(x))||0),0);
function toLocalInput(d){ d=d||new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function ledger(b){
  const c=calc(b), extras=b.extras||[], pays=(b.payments||[]).slice().sort((x,y)=>new Date(x.at)-new Date(y.at));
  const k = kind => sum(pays.filter(p=>p.kind===kind), p=>p.amount);
  const extrasTotal=sum(extras,x=>x.amount);
  const total=c.rental+c.delivery+extrasTotal;
  const paid=k("payment"), depIn=k("deposit_in"), depUsed=k("deposit_used"), depOut=k("deposit_refund");
  const settled=paid+depUsed;
  return {c, extras, pays, extrasTotal, total, paid, depIn, depUsed, depOut, settled, balance: total-settled, depHeld: depIn-depUsed-depOut};
}
function fyOf(d){ const y=d.getFullYear(), start=d.getMonth()>=3?y:y-1; return `${String(start).slice(2)}-${String(start+1).slice(2)}`; }
function waHref(phone, text){
  let d=String(phone||"").replace(/\D/g,""); if(d.length===10) d="91"+d; if(d.length===11 && d.startsWith("0")) d="91"+d.slice(1);
  return d.length>=11 ? `https://wa.me/${d}?text=${encodeURIComponent(text)}` : null;
}
function waButton(phone, text, label, cls="btn"){
  const h=waHref(phone,text);
  return h ? `<a class="${cls} wa" href="${esc(h)}" target="_blank" rel="noopener">${label}</a>` : `<span class="muted" style="font-size:13px">Add a valid mobile number to use WhatsApp</span>`;
}
function suggestions(b){
  const out=[]; const c=calc(b);
  if(b.odo && b.odo_return){
    const driven=Number(b.odo_return)-Number(b.odo), excess=Math.max(0, driven-c.km), rate=Number(ch(b,"extra_km"))||0;
    if(driven>=0) out.push({label:"Extra kilometres", info:`${driven.toLocaleString("en-IN")} km driven, ${c.km} included`, amount:excess*rate, note:`${excess} km × ${inr(rate)}`, show:excess>0});
  }
  if(b.return_at && b.drop){
    const late=(new Date(b.return_at)-new Date(b.drop))/6e4 - (Number(ch(b,"grace_minutes"))||0);
    if(late>0){
      const hrs=Math.ceil(late/60), rate=Number(b.rate)||0, per=Number(ch(b,"late_per_hour"))||0;
      const full=Math.floor(hrs/24), rem=hrs%24, amt=full*rate + Math.min(rem*per, rate||rem*per);
      out.push({label:"Late return", info:`${hrs} hour${hrs>1?"s":""} late after grace`, amount:amt, note:`${hrs} hrs late`, show:true});
    }
  }
  return out.filter(s=>s.show);
}
function receiptText(b, p, L){
  const s=S.settings;
  return [`Hello ${b.name}, this is ${s.business_name}.`, `We have received ${inr(p.amount)} (${PAY_KINDS[p.kind].toLowerCase()}) by ${p.mode}${p.ref?`, ref ${p.ref}`:""} on ${fmtDT(p.at)} for booking ${b.id}.`,
    L.balance>0?`Balance due: ${inr(L.balance)}.`:`Your rental charges are paid in full.`, L.depHeld>0?`Security deposit held: ${inr(L.depHeld)}.`:"", `Thank you. ${s.support_phone}`].filter(Boolean).join("\n");
}
function invoiceText(b){
  const s=S.settings, L=ledger(b), car=carOf(b)||{}, inv=b.invoice||{};
  const lines=[`Hello ${b.name}, thank you for choosing ${s.business_name}.`, ``, `*Invoice ${inv.no||"(draft)"}* · Booking ${b.id}`, `${car.make_model||""} (${car.plate||""})`, `${fmtDT(b.pickup)} to ${fmtDT(b.return_at||b.drop)}`, ``,
    `Rental: ${L.c.days} day${L.c.days>1?"s":""} × ${inr(b.rate)} = ${inr(L.c.rental)}`];
  if(L.c.delivery) lines.push(`Delivery: ${inr(L.c.delivery)}`);
  L.extras.forEach(x=>lines.push(`${x.label}${x.note?` (${x.note})`:""}: ${inr(x.amount)}`));
  lines.push(`*Total: ${inr(L.total)}*`, `Paid: ${inr(L.settled)}`, L.balance>0?`*Balance due: ${inr(L.balance)}*`:L.balance<0?`Excess paid, to be refunded: ${inr(-L.balance)}`:`Paid in full`);
  if(depType(b)!=="cash") lines.push(``, `Security deposit: ${depShort(b)} (${b.dep_returned_at?"returned":"held"})`);
  if(L.depIn) lines.push(``, `Security deposit: received ${inr(L.depIn)}${L.depUsed?`, adjusted ${inr(L.depUsed)}`:""}${L.depOut?`, refunded ${inr(L.depOut)}`:""}${L.depHeld>0?`, held ${inr(L.depHeld)}`:""}`);
  if(L.balance>0 && s.official_upi) lines.push(``, `Please pay only to our UPI ID: ${s.official_upi}`);
  lines.push(``, `${s.legal_name} · ${s.support_phone}`);
  return lines.join("\n");
}
function invoiceModel(b){
  const s=S.settings, L=ledger(b), car=carOf(b)||{}, inv=b.invoice||{};
  const items=[[`Vehicle rental: ${car.make_model||""} (${car.plate||""}), ${L.c.days} × 24 hrs at ${inr(b.rate)}`, L.c.rental]];
  if(L.c.delivery) items.push(["Delivery or collection", L.c.delivery]);
  L.extras.forEach(x=>items.push([`${x.label}${x.note?` (${x.note})`:""}`, Number(x.amount)||0]));
  return {s, L, car, inv, items};
}
function invoiceHTML(b){
  const {s,L,car,inv,items}=invoiceModel(b);
  return `<div class="inv">
    <div class="inv-head"><div><h2 style="text-align:left">${esc(s.legal_name)}</h2><div class="sub" style="text-align:left;margin:0">${esc(s.address)}<br>Udyam ${esc(s.udyam)} · Shop Act ${esc(s.shop_act)}<br>${esc(s.support_phone)} · ${esc(s.support_email)}</div></div>
      <div class="inv-meta"><b>INVOICE</b><br>No. ${esc(inv.no||"Not generated yet")}<br>Date ${esc(fmtD(inv.date)||fmtD(new Date().toISOString()))}<br>Booking ${esc(b.id)}</div></div>
    <table class="inv-parties"><tr><td><b>Billed to</b><br>${esc(b.name||"")}<br>${esc(b.phone||"")}<br>${esc(b.address||"")}</td>
      <td><b>Rental period</b><br>${esc(fmtDT(b.pickup))}<br>to ${esc(fmtDT(b.return_at||b.drop))}<br>${esc(car.plate||"")}</td></tr></table>
    <table class="inv-items"><thead><tr><th>Description</th><th>Amount</th></tr></thead><tbody>
      ${items.map(([d,a])=>`<tr><td>${esc(d)}</td><td>${inr(a)}</td></tr>`).join("")}
      <tr class="inv-total"><td>Total</td><td>${inr(L.total)}</td></tr>
      ${L.pays.filter(p=>p.kind==="payment"||p.kind==="deposit_used").map(p=>`<tr class="inv-pay"><td>Less: ${esc(PAY_KINDS[p.kind].toLowerCase())}, ${esc(p.mode||"")}${p.ref?` ref ${esc(p.ref)}`:""}, ${esc(fmtD(p.at))}</td><td>− ${inr(p.amount)}</td></tr>`).join("")}
      <tr class="inv-total"><td>${L.balance>0?"Balance due":L.balance<0?"Excess paid, to be refunded":"Balance due"}</td><td>${inr(Math.abs(L.balance))}</td></tr>
    </tbody></table>
    ${L.balance<=0?`<p class="inv-stamp">${L.balance<0?"EXCESS PAID":"PAID IN FULL"}</p>`:""}
    ${depType(b)!=="cash"?`<p><b>Security deposit:</b> ${esc(depShort(b))}, ${b.dep_returned_at?"returned":"held by DriveKaro"}. Not part of the invoice amount.</p>`:""}
    ${L.depIn?`<p><b>Security deposit:</b> received ${inr(L.depIn)}${L.depUsed?`; adjusted against charges ${inr(L.depUsed)}`:""}${L.depOut?`; refunded ${inr(L.depOut)}`:""}; ${L.depHeld>0?`held ${inr(L.depHeld)}`:"fully settled"}. The deposit is not part of the invoice amount.</p>`:""}
    ${L.balance>0&&(s.official_upi||s.official_bank)?`<p><b>Pay only to:</b> ${esc([s.official_upi&&"UPI "+s.official_upi, s.official_bank&&"Bank "+s.official_bank].filter(Boolean).join(" · "))}</p>`:""}
    <p class="inv-foot">${esc(s.legal_name)} is not registered under GST; no GST has been charged. This invoice is issued under the rental agreement ${esc(b.id)}.</p>
  </div>`;
}
function invoicePdf(b){
  const {jsPDF}=window.jspdf; const doc=new jsPDF({unit:"mm",format:"a4"});
  const {s,L,car,inv,items}=invoiceModel(b); const M=18, W=210, CW=W-2*M; let y=M;
  const t=(str,x,yy,opt)=>doc.text(pdfSafe(str),x,yy,opt);
  const wrap=(str,w)=>doc.splitTextToSize(pdfSafe(str),w);
  doc.setFont("helvetica","bold"); doc.setFontSize(14); t(s.legal_name,M,y+5);
  doc.setFont("helvetica","normal"); doc.setFontSize(8.5); doc.setTextColor(80);
  wrap(s.address,110).concat([`Udyam ${s.udyam} | Shop Act ${s.shop_act}`, `${s.support_phone} | ${s.support_email}`]).forEach((l,i)=>t(l,M,y+11+i*4));
  doc.setTextColor(0); doc.setFont("helvetica","bold"); doc.setFontSize(16); t("INVOICE",W-M,y+5,{align:"right"});
  doc.setFont("helvetica","normal"); doc.setFontSize(9); [`No. ${inv.no||"Not generated"}`,`Date ${fmtD(inv.date)||fmtD(new Date().toISOString())}`,`Booking ${b.id}`].forEach((l,i)=>t(l,W-M,y+12+i*4.5,{align:"right"}));
  y+=32; doc.setDrawColor(200); doc.line(M,y,W-M,y); y+=6;
  doc.setFont("helvetica","bold"); t("Billed to",M,y); t("Rental period",M+CW/2,y); doc.setFont("helvetica","normal"); y+=5;
  const left=[b.name||"", b.phone||"", ...wrap(b.address||"",CW/2-6)], right=[fmtDT(b.pickup), "to "+fmtDT(b.return_at||b.drop), `${car.make_model||""} (${car.plate||""})`];
  for(let i=0;i<Math.max(left.length,right.length);i++){ if(left[i]) t(left[i],M,y+i*4.5); if(right[i]) t(right[i],M+CW/2,y+i*4.5); }
  y+=Math.max(left.length,right.length)*4.5+6;
  doc.setFillColor(238,241,240); doc.rect(M,y-4.5,CW,7,"F"); doc.setFont("helvetica","bold"); t("Description",M+2,y); t("Amount",W-M-2,y,{align:"right"}); y+=7; doc.setFont("helvetica","normal");
  const row=(d,a,bold)=>{ doc.setFont("helvetica",bold?"bold":"normal"); const dl=wrap(d,CW-40); dl.forEach((l,i)=>t(l,M+2,y+i*4.5)); t(a,W-M-2,y,{align:"right"}); y+=dl.length*4.5+2.5; };
  items.forEach(([d,a])=>row(d,inr(a)));
  doc.line(M,y-2,W-M,y-2); y+=2; row("Total",inr(L.total),true);
  L.pays.filter(p=>p.kind==="payment"||p.kind==="deposit_used").forEach(p=>row(`Less: ${PAY_KINDS[p.kind].toLowerCase()}, ${p.mode||""}${p.ref?` ref ${p.ref}`:""}, ${fmtD(p.at)}`, "- "+inr(p.amount)));
  doc.line(M,y-2,W-M,y-2); y+=2; row(L.balance<0?"Excess paid, to be refunded":"Balance due", inr(Math.abs(L.balance)), true);
  if(L.balance<=0){ doc.setTextColor(30,120,70); doc.setFont("helvetica","bold"); doc.setFontSize(12); t(L.balance<0?"EXCESS PAID":"PAID IN FULL",M,y+4); doc.setTextColor(0); doc.setFontSize(9); y+=10; }
  doc.setFont("helvetica","normal");
  if(depType(b)!=="cash"){ wrap(`Security deposit: ${depShort(b)}, ${b.dep_returned_at?"returned":"held by DriveKaro"}. Not part of the invoice amount.`,CW).forEach(l=>{ t(l,M,y); y+=4.5; }); y+=2; }
  if(L.depIn){ wrap(`Security deposit: received ${inr(L.depIn)}${L.depUsed?`; adjusted against charges ${inr(L.depUsed)}`:""}${L.depOut?`; refunded ${inr(L.depOut)}`:""}; ${L.depHeld>0?`held ${inr(L.depHeld)}`:"fully settled"}. The deposit is not part of the invoice amount.`,CW).forEach(l=>{ t(l,M,y); y+=4.5; }); y+=2; }
  if(L.balance>0&&(s.official_upi||s.official_bank)){ t(`Pay only to: ${[s.official_upi&&"UPI "+s.official_upi, s.official_bank&&"Bank "+s.official_bank].filter(Boolean).join(" | ")}`,M,y); y+=6; }
  doc.setFontSize(8); doc.setTextColor(110); wrap(`${s.legal_name} is not registered under GST; no GST has been charged. This invoice is issued under the rental agreement ${b.id}.`,CW).forEach(l=>{ t(l,M,y+4); y+=4; });
  return doc.output("blob");
}

function viewPayments(b){
  const L=ledger(b); const sg=suggestions(b);
  const due=L.c.days?L.c.collected:0;
  const quick=[];
  if(L.balance>0) quick.push(`<button type="button" class="btn sm" data-act="quick-pay" data-kind="payment" data-amount="${L.balance}">Rental balance ${inr(L.balance)}</button>`);
  if(depType(b)==="cash" && Number(b.deposit)>0 && L.depIn<Number(b.deposit)) quick.push(`<button type="button" class="btn sm" data-act="quick-pay" data-kind="deposit_in" data-amount="${Number(b.deposit)-L.depIn}">Deposit ${inr(Number(b.deposit)-L.depIn)}</button>`);
  const use=Math.min(L.depHeld, Math.max(L.balance,0)), refund=L.depHeld-use;
  return `
  <div class="money">
    <div class="tile"><span class="label">Invoice total</span><b class="num">${inr(L.total)}</b><small>${L.extras.length?`incl. ${inr(L.extrasTotal)} extra charges`:"rental"+(L.c.delivery?" + delivery":"")}</small></div>
    <div class="tile"><span class="label">Paid</span><b class="num">${inr(L.settled)}</b><small>${L.depUsed?`incl. ${inr(L.depUsed)} from deposit`:"&nbsp;"}</small></div>
    <div class="tile ${L.balance>0?"t-bad":"t-ok"}"><span class="label">${L.balance<0?"Excess paid":"Balance due"}</span><b class="num">${inr(Math.abs(L.balance))}</b><small>${L.balance>0?"to collect":L.balance<0?"refund to customer":"paid in full"}</small></div>
    ${depType(b)==="cash" ? `<div class="tile"><span class="label">Deposit held</span><b class="num">${inr(L.depHeld)}</b><small>${L.depIn?`of ${inr(L.depIn)} received`:"not received yet"}</small></div>`
      : `<div class="tile"><span class="label">Security held</span><b style="font-size:16px">${esc(depShort(b))}</b><small>${b.dep_returned_at?`returned ${esc(fmtD(b.dep_returned_at))}`:"with DriveKaro"}</small></div>`}
  </div>
  ${["signed","ready","sent"].includes(b.status) && due ? `<p class="note">Collect before handover: <b>${inr(due)}</b> (rental ${inr(L.c.rental+L.c.delivery)}${L.c.deposit?` + deposit ${inr(L.c.deposit)}`:""})${depType(b)!=="cash"?`, and take the security: ${esc(depShort(b))}`:""}.</p>`:""}

  <section class="pcard"><h3>Record a payment</h3>
    ${quick.length?`<div class="actions" style="margin-bottom:10px"><span class="muted" style="font-size:13px;align-self:center">Quick fill:</span>${quick.join("")}</div>`:""}
    <div class="grid">
      ${selectHTML("p_kind","Type","payment",Object.entries(PAY_KINDS))}
      ${fieldHTML("p_amount","Amount (₹)","",{type:"number",attrs:'min="1" inputmode="numeric"'})}
      ${selectHTML("p_mode","Mode","UPI",PAYMODES.map(m=>[m,m]))}
      ${fieldHTML("p_ref","Reference","",{hint:"UPI / bank ref"})}
      ${fieldHTML("p_at","Date and time",toLocalInput(),{type:"datetime-local"})}
    </div>
    <div id="payerr"></div>
    <div class="actions" style="margin-top:10px"><button type="button" class="btn primary" data-act="add-pay">Add entry</button></div>
    ${L.pays.length?`<div class="tablewrap"><table class="ptable num"><thead><tr><th>Date</th><th>Type</th><th>Mode</th><th style="text-align:right">Amount</th><th></th></tr></thead><tbody>
      ${L.pays.map(p=>`<tr><td>${esc(fmtDT(p.at))}</td><td>${esc(PAY_KINDS[p.kind])}</td><td>${esc(p.mode||"")}${p.ref?`<br><small class="muted">${esc(p.ref)}</small>`:""}</td><td style="text-align:right">${p.kind==="deposit_refund"?"− ":""}${inr(p.amount)}</td>
        <td class="rowact">${waButton(b.phone, receiptText(b,p,L), "Receipt", "btn sm")}${S.confirmPay===p.id?`<button class="btn sm danger" data-act="del-pay" data-id="${esc(p.id)}">Confirm delete</button><button class="btn sm" data-act="keep-pay">Keep</button>`:`<button class="btn sm" data-act="ask-del-pay" data-id="${esc(p.id)}" aria-label="Delete entry">Delete</button>`}</td></tr>`).join("")}
    </tbody></table></div>`:`<p class="muted" style="margin:12px 0 0;font-size:14px">No payments recorded yet.</p>`}
  </section>

  <section class="pcard"><h3>Return and extra charges</h3>
    <div class="grid">
      ${fieldHTML("r_odo","Odometer at return (km)",b.odo_return??"",{type:"number",hint:b.odo?`At pickup: ${Number(b.odo).toLocaleString("en-IN")} km`:"Add pickup odometer in booking details for km maths"})}
      ${fieldHTML("r_at","Returned at",b.return_at||"",{type:"datetime-local",hint:`Due ${fmtDT(b.drop)}`})}
      ${selectHTML("r_fuel","Fuel at return",b.fuel_return||"",[["",""],...FUEL.map(f=>[f,f])],{hint:b.fuel?`At pickup: ${b.fuel}`:""})}
    </div>
    <div class="actions" style="margin-top:10px"><button type="button" class="btn" data-act="save-return">Save return details</button></div>
    ${sg.length?`<div class="suggest">${sg.map(x=>`<div><b>${esc(x.label)}:</b> ${esc(x.info)} → <b>${inr(x.amount)}</b> <button type="button" class="btn sm" data-act="suggest-add" data-label="${esc(x.label)}" data-amount="${x.amount}" data-note="${esc(x.note)}">Add charge</button></div>`).join("")}</div>`:""}
    <div class="grid" style="margin-top:14px">
      ${selectHTML("x_label","Charge",EXTRA_LABELS[0],EXTRA_LABELS.map(l=>[l,l]))}
      ${fieldHTML("x_amount","Amount (₹)","",{type:"number",attrs:'min="1" inputmode="numeric"'})}
      ${fieldHTML("x_note","Details","",{hint:"e.g. challan no., 120 km"})}
    </div>
    <div id="xerr"></div>
    <div class="actions" style="margin-top:10px"><button type="button" class="btn" data-act="add-extra">Add charge</button></div>
    ${L.extras.length?`<div class="tablewrap"><table class="ptable num"><tbody>${L.extras.map(x=>`<tr><td>${esc(x.label)}${x.note?`<br><small class="muted">${esc(x.note)}</small>`:""}</td><td style="text-align:right">${inr(x.amount)}</td><td class="rowact"><button class="btn sm" data-act="del-extra" data-id="${esc(x.id)}">Remove</button></td></tr>`).join("")}</tbody></table></div>`:""}
    ${depType(b)!=="cash"?`<div class="settle"><div><b>Security:</b> ${esc(depShort(b))} · ${b.dep_returned_at?`returned ${esc(fmtD(b.dep_returned_at))}`:"with DriveKaro"}</div><button class="btn sm" data-act="dep-return">${b.dep_returned_at?"Undo returned":"Mark returned"}</button></div>`:""}
    ${L.depHeld>0?`<div class="settle"><div><b>Settle deposit:</b> use ${inr(use)} for the balance and refund ${inr(refund)}.</div>
      ${S.confirmSettle?`<div class="actions"><button class="btn sm primary" data-act="do-settle" data-use="${use}" data-refund="${refund}">Record it</button><button class="btn sm" data-act="cancel-settle">Not now</button></div>`:`<button class="btn sm" data-act="ask-settle">Settle deposit</button>`}</div>`:""}
  </section>

  <section class="pcard"><div class="paper-bar" style="margin:0 0 12px">
      <div><h3 style="margin:0">Invoice</h3><div class="muted" style="font-size:13px">${b.invoice?.no?`No. ${esc(b.invoice.no)} · amounts update with new entries`:"Generate to give it a number from the DK/"+fyOf(new Date())+" series"}</div></div>
      <div class="actions">
        ${b.invoice?.no?"":`<button class="btn primary" data-act="gen-invoice">Generate invoice</button>`}
        ${S.downloads&&window.jspdf?`<button class="btn sm" data-act="inv-pdf">Save PDF</button>`:""}
        <button class="btn sm" data-act="copy-invoice">Copy text</button>
        ${waButton(b.phone, invoiceText(b), "Send on WhatsApp", "btn sm primary")}
      </div></div>
    <p class="note" style="margin:0 0 12px">WhatsApp opens with the invoice written into the message. To send the PDF as well, save it first and attach it in the chat.</p>
    <article class="paper">${invoiceHTML(b)}</article>
  </section>`;
}

function isMobile(){ return window.matchMedia && window.matchMedia("(max-width:900px)").matches; }
function viewDetail(){
  const b=S.bookings.find(x=>x.id===S.selected);
  if(!b){ S.selected=null; return viewList(); }
  const car=carOf(b)||{}; const c=calc(b); const st=STATUS[b.status]||STATUS.draft;
  const vErr = validate(b,true); const missing = Object.keys(vErr);
  const idx = FLOW.indexOf(b.status);
  const stepLabels={draft:"Details entered",ready:"Agreement ready",sent:"Sent for Aadhaar eSign",signed:"Signed by both",handed:"Car handed over",returned:"Car returned"};
  const canDownload = !!S.downloads && !!window.jspdf;
  return `
  <div class="head-row"><div><button class="btn sm" data-act="back">← All bookings</button></div></div>
  <div class="dtabs" role="tablist">
    <button role="tab" class="dtab only-m" aria-selected="${S.detailTab==="overview"}" data-dtab="overview">Overview</button>
    <button role="tab" class="dtab" aria-selected="${S.detailTab==="agreement"||(S.detailTab==="overview"&&!isMobile())}" data-dtab="agreement">Agreement</button>
    <button role="tab" class="dtab" aria-selected="${S.detailTab==="payments"}" data-dtab="payments">Payments</button>
  </div>
  <div class="detail t-${S.detailTab}">
    <div class="side">
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px">
          ${car.plate?`<span class="plate">${esc(car.plate)}</span>`:""}<span class="pill ${st.cls}">${st.label}</span>
        </div>
        <h3 style="font-size:20px;margin-bottom:2px">${esc(b.name||"Unnamed")} ${b.example?'<span class="ex">Example</span>':""}</h3>
        <div class="muted" style="font-size:14px;margin-bottom:12px">${esc(car.make_model||"")} · ${esc(b.phone||"")}</div>
        <dl class="kv num">
          <dt>Pickup</dt><dd>${esc(fmtDT(b.pickup))}</dd>
          <dt>Drop-off</dt><dd>${esc(fmtDT(b.drop))}</dd>
          <dt>Duration</dt><dd>${esc(durText(c))}</dd>
          <dt>Rental</dt><dd>${c.days?inr(c.rental):"—"}</dd>
          ${c.delivery?`<dt>Delivery</dt><dd>${inr(c.delivery)}</dd>`:""}
          <dt>Security deposit</dt><dd>${esc(depShort(b))}</dd>
          <dt class="total">Collect before handover</dt><dd class="total">${c.days?inr(c.collected):"—"}</dd>
          <dt>Km included</dt><dd>${c.km} km</dd>
        </dl>
        ${(()=>{ const L=ledger(b); return `<div class="moneyline"><span>Paid <b class="num">${inr(L.settled)}</b></span><span class="${L.balance>0?"bad":"ok"}">${L.balance>0?`Due <b class="num">${inr(L.balance)}</b>`:"Paid in full"}</span><button class="btn sm" data-dtab="payments">Payments</button></div>`; })()}
      </div>
      <div class="card"><h3>Progress</h3>
        ${b.status==="cancelled"? `<p class="muted" style="margin:0">This booking was cancelled.</p>` : `<ul class="steps">${FLOW.map((k,i)=>`<li class="${i<idx?"done":i===idx?"now":""}"><i></i>${stepLabels[k]}</li>`).join("")}</ul>`}
      </div>
      <div class="card"><h3>Next step</h3>${nextStep(b, missing)}${b.status==="draft"&&missing.length?`<div class="errors"><ul>${Object.values(vErr).map(m=>`<li>${esc(m)}</li>`).join("")}</ul></div>`:""}</div>
      <div class="card">
        <div class="actions">
          <button class="btn" data-act="edit" ${["handed","returned"].includes(b.status)?"disabled":""}>Edit details and charges</button>
          ${custOfBooking(b)?`<button class="btn" data-custview="${esc(custOfBooking(b).id)}">Customer profile</button>`:""}
          ${waButton(b.phone, summaryText(b), "WhatsApp booking details")}
          <button class="btn" data-act="copy-wa">Copy booking summary</button>
          ${b.status!=="cancelled" && !["handed","returned"].includes(b.status) ? `<button class="btn danger" data-act="cancel-booking">Cancel booking</button>`:""}
          <button class="btn danger" data-act="ask-delete">Delete</button>
        </div>
        ${S.confirmDelete===b.id?`<div class="confirm" style="margin-top:10px">Delete this booking permanently? <button class="btn sm danger" data-act="delete">Delete</button><button class="btn sm" data-act="keep">Keep</button></div>`:""}
      </div>
    </div>
    <div class="paper-wrap">
      ${S.detailTab==="payments" ? viewPayments(b) : `
      <div class="paper-bar">
        <div><div class="label">Agreement preview · v2.0</div>${missing.length?`<div class="warnline">${missing.length} thing${missing.length>1?"s":""} to fix before signing (see Next step)</div>`:softMissing(b).length?`<div class="muted" style="font-size:13px">${softMissing(b).length} optional detail${softMissing(b).length>1?"s":""} blank</div>`:`<div class="muted" style="font-size:13px">All details filled</div>`}</div>
        <div class="actions">${canDownload?`<button class="btn sm" data-act="pdf">Save PDF</button>`:""}<button class="btn sm" data-act="copy-agreement">Copy text</button></div>
      </div>
      <article class="paper">${agreementHTML(b)}</article>`}
    </div>
  </div>`;
}
/* ---------- Aadhaar eSign (Leegality) ---------- */
async function api(path, payload){
  const { data:{ session } } = await supabase.auth.getSession();
  let r;
  try{ r = await fetch(path,{ method:"POST", headers:{ "Content-Type":"application/json", Authorization:"Bearer "+(session?.access_token||"") }, body:JSON.stringify(payload) }); }
  catch(e){ throw new Error("No connection. Check your internet and try again."); }
  let j={}; try{ j=await r.json(); }catch(e){}
  if(!r.ok) throw new Error(j.error || `Server error (${r.status}). Try again.`);
  return j;
}
function blobToBase64(blob){ return new Promise((res,rej)=>{ const fr=new FileReader(); fr.onload=()=>res(String(fr.result).split(",")[1]||""); fr.onerror=()=>rej(new Error("Couldn't read the PDF.")); fr.readAsDataURL(blob); }); }
function signLinkText(b, url){ return `Hello ${b.name}, please sign your ${S.settings.business_name} rental agreement (${b.id}) with Aadhaar OTP:\n${url}\n\nIt takes 2 minutes. Keep the mobile number linked to your Aadhaar handy for the OTP.\n\n${S.settings.support_phone}`; }
function esignNotice(b){
  const e=b.esign; if(!e?.last_error || !["rejected","expired"].includes(e.state)) return "";
  return `<div class="errors" style="margin:0 0 10px">${esc(e.last_error)} Fix anything needed, then send again.</div>`;
}
function esignPanelHTML(b){
  const e=b.esign||{}; const inv=e.invitees||[];
  const cust=inv.find(i=>i.role==="customer")||inv[0];
  const last=(e.events||[]).slice(-1)[0];
  return `<p style="margin:0 0 8px;font-size:14px">Sent for Aadhaar eSign ${e.sent_at?esc(fmtDT(e.sent_at)):""}${e.env==="sandbox"?` <span class="pill s-sent">Sandbox test</span>`:""}</p>
    <div class="signers">${inv.map(i=>`<div class="signer"><span><b>${esc(i.name||"")}</b><small class="muted">${i.role==="customer"?"Customer":"DriveKaro"}</small></span><span class="pill ${i.signed?"s-signed":i.rejected?"s-cancelled":"s-sent"}">${i.signed?"Signed":i.rejected?"Rejected":"Waiting"}</span></div>`).join("")}</div>
    ${e.last_error?`<div class="warnline" style="margin:8px 0">${esc(e.last_error)}</div>`:""}
    ${last?`<p class="muted" style="font-size:12.5px;margin:6px 0 10px">Last update: ${esc([last.name,last.action||last.documentStatus].filter(Boolean).join(" · "))}, ${esc(fmtDT(last.at))}</p>`:""}
    <div class="actions">
      ${cust && cust.sign_url && !cust.signed ? waButton(b.phone, signLinkText(b, cust.sign_url), "WhatsApp signing link", "btn primary") : ""}
      ${cust && cust.sign_url && !cust.signed ? `<button class="btn" data-act="copy-signlink" data-url="${esc(cust.sign_url)}">Copy link</button>`:""}
      <button class="btn" data-act="esign-refresh" ${S.esignBusy?"disabled":""}>${S.esignBusy?"Checking…":"Refresh status"}</button>
    </div>
    ${inv.find(i=>i.role==="owner" && !i.signed && i.sign_url) && cust?.signed ? `<p class="note" style="margin:10px 0 0">Customer has signed. Now sign for DriveKaro: <a href="${esc(inv.find(i=>i.role==="owner").sign_url)}" target="_blank" rel="noopener">open your signing link</a>.</p>`:""}
    <details class="more"><summary>Problems? Send again or record manually</summary>
      <div class="actions" style="margin-top:10px"><button class="btn" data-act="esign-send" ${S.esignBusy?"disabled":""}>Send a new signing request</button><button class="btn" data-act="status" data-to="signed">Mark as signed manually</button></div>
      <p class="note" style="margin:10px 0 0">Sending again creates a new Leegality document and uses credits again.</p></details>`;
}
function signedFilesHTML(b){
  const f=b.esign?.files||{};
  if(!f.signed) return `<p class="note" style="margin:0 0 10px">Signed on Leegality${b.esign?.file_error?`, but the signed PDF couldn't be saved yet (${esc(b.esign.file_error)})`:""}. <button class="btn sm" data-act="esign-refresh">Fetch signed PDF</button></p>`;
  return `<div class="actions" style="margin-bottom:10px"><button class="btn" data-act="esign-file" data-type="signed">Signed agreement PDF</button>${f.audit?`<button class="btn" data-act="esign-file" data-type="audit">Audit trail</button>`:""}</div>`;
}

function nextStep(b, missing){
  if(b.status==="draft") return missing.length
    ? `<p style="margin:0 0 10px;font-size:14px">Fill the missing details to make the agreement ready for signing.</p><button class="btn primary" data-act="edit">Complete details</button>`
    : `${softNote(b)}<p style="margin:0 0 10px;font-size:14px">The essentials are filled. You can send this agreement now.</p><div class="actions"><button class="btn primary" data-act="status" data-to="ready">Make agreement ready</button><button class="btn" data-act="edit">Add more details</button></div>`;
  if(b.status==="ready") return `${esignNotice(b)}${softNote(b)}<p style="margin:0 0 10px;font-size:14px">Send the agreement to ${esc(b.name)} for Aadhaar OTP signing through Leegality.</p>
    <div class="actions"><button class="btn primary" data-act="esign-send" ${S.esignBusy?"disabled":""}>${S.esignBusy?"Sending…":"Send for Aadhaar eSign"}</button>${S.downloads&&window.jspdf?`<button class="btn" data-act="pdf">Save agreement PDF</button>`:""}</div>
    <details class="more"><summary>Signed outside the desk? Record it manually</summary>
      ${fieldHTML("es_doc","Leegality document ID (optional)",b.esign_doc_id||"")}
      <div class="actions" style="margin-top:10px"><button class="btn" data-act="mark-sent">Mark as sent for eSign</button></div></details>`;
  if(b.status==="sent") return b.esign?.document_id ? esignPanelHTML(b) : `<p style="margin:0 0 10px;font-size:14px">Waiting for signatures${b.esign_doc_id?` on Leegality document ${esc(b.esign_doc_id)}`:""}. Mark it signed only after Leegality shows every signer as signed.</p><div class="actions"><button class="btn primary" data-act="status" data-to="signed">Mark as signed</button><button class="btn" data-act="status" data-to="ready">Back to ready</button></div>`;
  if(b.status==="signed") return `${b.esign?.document_id?signedFilesHTML(b):""}<p style="margin:0 0 10px;font-size:14px">Check the original DL, take handover photos, record odometer and fuel, then hand over the keys.</p><button class="btn primary" data-act="status" data-to="handed">Mark car handed over</button>`;
  if(b.status==="handed") return `<p style="margin:0 0 10px;font-size:14px">Inspect with the customer at return and settle the deposit.</p><button class="btn primary" data-act="status" data-to="returned">Mark car returned</button>`;
  if(b.status==="returned") return `<p style="margin:0;font-size:14px">Trip complete.</p>`;
  if(b.status==="cancelled") return `<button class="btn" data-act="status" data-to="${missing.length?"draft":"ready"}">Restore booking</button>`;
  return "";
}

function fieldHTML(id,label,val,opts={}){
  const {type="text",req=false,hint="",wide=false,err="",attrs=""}=opts;
  const control = type==="textarea" ? `<textarea id="${id}" ${attrs}>${esc(val)}</textarea>` : `<input id="${id}" type="${type}" value="${esc(val)}" ${attrs} ${err?'aria-invalid="true"':""}>`;
  return `<div class="field${wide?" wide":""}"><label for="${id}">${label}${req?" <em>*</em>":""}</label>${control}${err?`<span class="err">${esc(err)}</span>`:hint?`<span class="hint">${hint}</span>`:""}</div>`;
}
function selectHTML(id,label,val,options,opts={}){
  const {req=false,err="",hint=""}=opts;
  return `<div class="field"><label for="${id}">${label}${req?" <em>*</em>":""}</label><select id="${id}" ${err?'aria-invalid="true"':""}>${options.map(o=>`<option value="${esc(o[0])}" ${String(o[0])===String(val??"")?"selected":""}>${esc(o[1])}</option>`).join("")}</select>${err?`<span class="err">${esc(err)}</span>`:hint?`<span class="hint">${hint}</span>`:""}</div>`;
}
function chargeFieldsHTML(prefix, values){
  return CHARGE_FIELDS.map(([k,label,kind,hint])=>fieldHTML(prefix+k,label,values[k]??"",{type:kind==="text"?"textarea":"number",wide:kind==="text",hint,attrs:kind==="text"?'rows="2"':'min="0" inputmode="numeric"'})).join("");
}
function readCharges(prefix){
  const o={}; for(const [k,,kind] of CHARGE_FIELDS){ const el=$("#"+prefix+k); if(!el) continue; const v=el.value.trim(); o[k]= kind==="text" ? v : (v===""?"":Number(v)); } return o;
}
function docStatus(dateStr, until){
  if(!dateStr) return {cls:"s-draft", label:"Not added", bad:false, missing:true};
  const d=new Date(dateStr+"T23:59"), now=new Date();
  if(d<now) return {cls:"s-cancelled", label:"Expired", bad:true};
  if(until && d<new Date(until)) return {cls:"s-cancelled", label:"Expires before drop-off", bad:true};
  const days=Math.ceil((d-now)/864e5);
  if(days<=30) return {cls:"s-sent", label:`Expires in ${days} day${days>1?"s":""}`, bad:false};
  return {cls:"s-signed", label:"Valid", bad:false};
}
function carWarnings(c){
  const w=[];
  const ins=docStatus(c.insurance_till), puc=docStatus(c.puc_till);
  if(!c.insurance_no) w.push("Insurance policy number not added");
  if(ins.missing) w.push("Insurance expiry date not added"); else if(ins.bad || ins.cls==="s-sent") w.push("Insurance: "+ins.label.toLowerCase());
  if(puc.missing) w.push("PUC expiry date not added"); else if(puc.bad || puc.cls==="s-sent") w.push("PUC: "+puc.label.toLowerCase());
  if(!c.idv) w.push("IDV not added (used for total-loss claims)");
  return w;
}
function carNow(c){
  const now=new Date();
  const out=S.bookings.find(b=>b.car_id===c.id && b.status==="handed");
  if(out) return {cls:"s-handed", label:`Out with ${(out.name||"").split(" ")[0]} until ${fmtDT(out.drop)}`};
  if(c.active===false) return {cls:"s-draft", label:"Hidden from bookings"};
  const next=S.bookings.filter(b=>b.car_id===c.id && !["cancelled","returned","handed"].includes(b.status) && new Date(b.drop)>now).sort((a,b)=>new Date(a.pickup)-new Date(b.pickup))[0];
  if(next) return {cls:"s-ready", label:`Available · next booking ${fmtDT(next.pickup)}`};
  return {cls:"s-signed", label:"Available"};
}
function clashFor(carId, pickup, drop, exceptId){
  if(!carId||!pickup||!drop) return null; const p=new Date(pickup), d=new Date(drop); if(isNaN(p)||isNaN(d)||d<=p) return null;
  return S.bookings.find(x=>x.id!==exceptId && x.car_id===carId && !["cancelled","returned"].includes(x.status) && new Date(x.pickup)<d && new Date(x.drop)>p) || null;
}

/* car picker in the booking form */
function pickGridHTML(selId, pickup, drop){
  const cars=S.fleet.filter(c=>c.active!==false || c.id===selId);
  if(!cars.length) return `<div class="note">No cars yet. <button type="button" class="btn sm" data-act="goto-fleet">Add a car in Fleet</button></div>`;
  return `<div class="pick" role="radiogroup" aria-label="Car">${cars.map(c=>{
    const clash=clashFor(c.id,pickup,drop,S.editId); const w=carWarnings(c).length;
    return `<button type="button" class="pickcard" role="radio" aria-checked="${c.id===selId}" data-pickcar="${esc(c.id)}">
      <span class="plate">${esc(c.plate)}</span>
      <b>${esc(c.make_model)}</b>
      <span class="muted num">${inr(c.rate)}/day · ${esc(c.category||"")}</span>
      ${clash?`<span class="pickflag bad">Booked: ${esc(clash.name)}</span>`: w?`<span class="pickflag warn">${w} paper${w>1?"s":""} to check</span>`:`<span class="pickflag ok">Ready</span>`}
    </button>`;}).join("")}</div>`;
}
function carInfoHTML(carId, drop){
  const c=S.fleet.find(x=>x.id===carId); if(!c) return "";
  const ins=docStatus(c.insurance_till, drop), puc=docStatus(c.puc_till, drop);
  return `<div class="carinfo">
    <div class="carinfo-h"><span class="label">From fleet profile</span><button type="button" class="btn sm" data-carview="${esc(c.id)}" data-keepdraft="1">Open profile</button></div>
    <dl class="kv-grid">
      <div><dt>Registration</dt><dd>${esc(c.reg_type||"—")}${c.permit_no?` · permit ${esc(c.permit_no)}`:""}</dd></div>
      <div><dt>Insurance</dt><dd>${esc(c.insurer||"")} ${esc(c.insurance_no||"—")} <span class="pill ${ins.cls}">${ins.label}</span></dd></div>
      <div><dt>PUC valid till</dt><dd>${esc(fmtD(c.puc_till)||"—")} <span class="pill ${puc.cls}">${puc.label}</span></dd></div>
      <div><dt>IDV</dt><dd>${c.idv?inr(c.idv):"—"}</dd></div>
      <div><dt>Fuel / seats</dt><dd>${esc(c.fuel||"—")} · ${esc(c.seats||"—")} seats</dd></div>
      <div><dt>FASTag</dt><dd>${esc(c.fastag||"—")}</dd></div>
    </dl>
  </div>`;
}
function refreshCarOptions(){
  const box=$("#carpick"); if(!box) return;
  const v=$("#f_car")?.value||""; box.innerHTML=pickGridHTML(v, $("#f_pickup")?.value, $("#f_drop")?.value);
  const info=$("#carinfo"); if(info) info.innerHTML=carInfoHTML(v, $("#f_drop")?.value);
}
function pickCar(id){
  const car=S.fleet.find(c=>c.id===id); if(!car) return;
  $("#f_car").value=id;
  const r=$("#f_rate"), d=$("#f_deposit");
  if(r && (!r.value || r.dataset.auto)){ r.value=car.rate||""; r.dataset.auto="1"; }
  if(d && (!d.value || d.dataset.auto)){ d.value=car.deposit??""; d.dataset.auto="1"; }
  refreshCarOptions(); updateSummary();
}

const FORM_MAP={name:"f_name",father:"f_father",dob:"f_dob",phone:"f_phone",alt_phone:"f_alt",email:"f_email",address:"f_address",emergency:"f_emergency",
  dl:"f_dl",dl_till:"f_dl_till",rto:"f_rto",id_type:"f_idtype",aadhaar4:"f_aadhaar4",
  addl_name:"f_addl_name",addl_dob:"f_addl_dob",addl_phone:"f_addl_phone",addl_dl:"f_addl_dl",addl_dl_till:"f_addl_dl_till",
  customer_id:"f_custid",car_id:"f_car",pickup:"f_pickup",drop:"f_drop",location:"f_location",rate:"f_rate",deposit_type:"f_deptype",deposit:"f_deposit",dep_bike_no:"f_depbike",dep_bike_model:"f_depbikemodel",dep_doc_type:"f_depdoc",dep_doc_details:"f_depdocdet",paymode:"f_paymode",payref:"f_payref",
  odo:"f_odo",fuel:"f_fuel",keys:"f_keys",ext_damage:"f_ext",int_damage:"f_int",notes:"f_notes"};

function viewForm(errs={}){
  const b = S.draft || (S.editId ? (S.bookings.find(x=>x.id===S.editId)||{}) : {});
  const g=k=>b[k]??"";
  const charges = {...defaultCharges(), ...(b.charges||{})};
  const sub = t => `<span class="muted" style="font:400 13px var(--f-body)">${t}</span>`;
  const fc = custById(b.customer_id) || (b.phone ? custById(normPhone(b.phone)) : null);
  const kycErr = Object.keys(errs).some(k=>KYC_FIELDS.includes(k));
  const showFields = (fc || g("phone")) && (!fc || kycErr);
  S.formCust = fc ? fc.id : (g("phone") ? "new:"+normPhone(g("phone")) : null);
  return `
  <div class="head-row"><h2>${S.editId?"Edit booking "+esc(S.editId):"New booking"}</h2>${S.editId?`<button class="btn sm" data-act="cancel-edit">Discard changes</button>`:""}</div>
  <form id="bform" class="form" novalidate>
    <div>
      <fieldset><legend>1 · Car</legend>
        <input type="hidden" id="f_car" value="${esc(g("car_id"))}">
        ${errs.car_id?`<div class="err" style="margin-bottom:8px">${esc(errs.car_id)}</div>`:""}
        <div id="carpick">${pickGridHTML(g("car_id"), g("pickup"), g("drop"))}</div>
        <div id="carinfo">${carInfoHTML(g("car_id"), g("drop"))}</div>
      </fieldset>
      <fieldset><legend>2 · Dates</legend><div class="grid">
        ${fieldHTML("f_pickup","Pickup",g("pickup"),{type:"datetime-local",req:1,err:errs.pickup})}
        ${fieldHTML("f_drop","Drop-off",g("drop"),{type:"datetime-local",req:1,err:errs.drop})}
        <div class="field wide"><div id="durline" class="durline"></div></div>
        ${fieldHTML("f_location","Handover and return location",g("location")||S.settings.designated_location,{wide:1})}
        ${selectHTML("f_delivery","Delivery or collection",b.with_delivery?"yes":"no",[["no","No, customer comes to us"],["yes","Yes, add delivery charge"]])}
      </div></fieldset>
      <fieldset><legend>3 · Price and charges ${sub("(for this booking only)")}</legend>
        <div class="grid">
          ${fieldHTML("f_rate","Daily rate (₹)",g("rate"),{type:"number",err:errs.rate,attrs:'min="0" step="50" inputmode="numeric"',hint:"Fills from the car; change it for a deal."})}
          ${depFieldsHTML(g, errs)}
        </div>
        <details class="more" ${b.charges?"open":""}>
          <summary>Other charges: km, late fee, cleaning and more</summary>
          <p class="note" style="margin:10px 0 12px">Filled from your default charges. Changes here print in Schedule III of this booking's agreement only. <button type="button" class="btn sm" data-act="reset-charges" style="margin-left:6px">Reset to defaults</button></p>
          <div class="grid">${chargeFieldsHTML("fc_", charges)}</div>
        </details>
      </fieldset>
      <fieldset><legend>4 · Customer</legend>
        <div class="field wide custsearch">
          <label for="f_phone">Customer mobile <em>*</em></label>
          <div class="dd-wrap"><input id="f_phone" type="tel" inputmode="tel" autocomplete="off" placeholder="Type mobile number or name" value="${esc(fc?fmtPhone(fc.phone):g("phone"))}" ${errs.phone?'aria-invalid="true"':""}>
          <div id="custdd" class="dd" role="listbox" hidden></div></div>
          ${errs.phone?`<span class="err">${esc(errs.phone)}</span>`:`<span class="hint">Existing customers fill in automatically. New number? Pick "Add new customer".</span>`}
        </div>
        <input type="hidden" id="f_custid" value="${esc(fc?fc.id:"")}">
        <div id="custcard">${fc?custCardHTML(fc):(g("phone")?custCardHTML(null,true):"")}</div>
        <div id="custfields" ${showFields?"":"hidden"}>
          <div class="grid" style="margin-top:12px">
            ${fieldHTML("f_name","Full name (as on licence)",g("name"),{req:1,err:errs.name,attrs:'autocomplete="off"'})}
            ${fieldHTML("f_father","Father's / spouse's name",g("father"),{err:errs.father})}
            ${fieldHTML("f_dob","Date of birth",g("dob"),{type:"date",err:errs.dob})}
            ${fieldHTML("f_alt","Alternate mobile",g("alt_phone"),{type:"tel",err:errs.alt_phone,attrs:'inputmode="tel"'})}
            ${fieldHTML("f_email","Email",g("email"),{type:"email",err:errs.email})}
            ${fieldHTML("f_address","Permanent address",g("address"),{type:"textarea",wide:1,err:errs.address})}
            ${fieldHTML("f_emergency","Emergency contact (name, relation, number)",g("emergency"),{wide:1,err:errs.emergency})}
          </div>
          <h4 class="subh">Licence and ID</h4>
          <div class="grid">
            ${fieldHTML("f_dl","Driving licence number",g("dl"),{err:errs.dl,attrs:'placeholder="MH12 20200012345" style="text-transform:uppercase"'})}
            ${fieldHTML("f_dl_till","Licence valid till",g("dl_till"),{type:"date",err:errs.dl_till})}
            ${fieldHTML("f_rto","Issuing RTO",g("rto"),{attrs:'placeholder="Pune (MH12)"'})}
            ${selectHTML("f_idtype","Photo ID type",g("id_type")||IDTYPES[0],IDTYPES.map(x=>[x,x]))}
            ${fieldHTML("f_aadhaar4","ID number, last 4 digits",g("aadhaar4"),{err:errs.aadhaar4,hint:"Only the last 4. The full Aadhaar is entered by the customer on the eSign page.",attrs:'inputmode="numeric" maxlength="4"'})}
          </div>
        </div>
      </fieldset>
      <fieldset><legend>5 · Additional driver ${sub("(leave blank if none)")}</legend><div class="grid">
        ${fieldHTML("f_addl_name","Full name",g("addl_name"))}
        ${fieldHTML("f_addl_dob","Date of birth",g("addl_dob"),{type:"date",err:errs.addl_dob})}
        ${fieldHTML("f_addl_phone","Mobile",g("addl_phone"),{type:"tel",err:errs.addl_phone})}
        ${fieldHTML("f_addl_dl","Driving licence number",g("addl_dl"),{err:errs.addl_dl,attrs:'style="text-transform:uppercase"'})}
        ${fieldHTML("f_addl_dl_till","Licence valid till",g("addl_dl_till"),{type:"date",err:errs.addl_dl_till})}
      </div></fieldset>
      <fieldset><legend>6 · Payment and handover ${sub("(can be filled at pickup)")}</legend><div class="grid">
        ${selectHTML("f_paymode","Payment mode",g("paymode"),[["",""],...PAYMODES.map(p=>[p,p])])}
        ${fieldHTML("f_payref","Payment reference",g("payref"),{hint:"UPI or bank reference, if paid"})}
        ${fieldHTML("f_odo","Odometer (km)",g("odo"),{type:"number",attrs:'min="0" inputmode="numeric"'})}
        ${selectHTML("f_fuel","Fuel level",g("fuel"),[["",""],...FUEL.map(f=>[f,f])])}
        ${selectHTML("f_keys","Keys handed over",g("keys"),[["",""],["1","1"],["2","2"]])}
        ${fieldHTML("f_ext","Existing exterior damage",g("ext_damage"),{type:"textarea",wide:1,attrs:'placeholder="e.g. scratch on rear bumper, left side"'})}
        ${fieldHTML("f_int","Existing interior damage",g("int_damage"),{type:"textarea",wide:1})}
        ${fieldHTML("f_notes","Internal notes",g("notes"),{type:"textarea",wide:1,hint:"Not printed on the agreement."})}
      </div></fieldset>
    </div>
    <div class="mobilebar"><div><span class="label">To collect</span><b id="mbtotal" class="num">—</b></div><button type="submit" class="btn primary">Save booking</button></div>
    <aside class="summary card">
      <h3>Booking total</h3>
      <dl class="kv num" id="sumbox"></dl>
      <div id="formerrs"></div>
      <div class="actions" style="margin-top:14px">
        <button type="submit" class="btn primary" id="f_submit">Save and prepare agreement</button>
        <button type="button" class="btn" data-act="save-draft">Save as draft</button>
      </div>
      <p class="note" style="margin:12px 0 0">Customer name, mobile, car, dates and rate are enough for <b>Agreement ready</b>. KYC and deposit details can be added later.</p>
    </aside>
  </form>`;
}
function readForm(){
  const o={}; for(const k in FORM_MAP){ o[k]=($("#"+FORM_MAP[k])?.value??"").trim(); }
  o.dl=o.dl.toUpperCase(); o.addl_dl=o.addl_dl.toUpperCase(); o.dep_bike_no=o.dep_bike_no.toUpperCase();
  if(o.deposit_type!=="cash") o.deposit="";
  o.with_delivery = $("#f_delivery")?.value==="yes";
  o.charges = readCharges("fc_");
  return o;
}
function updateSummary(){
  const box=$("#sumbox"); if(!box) return;
  const b=readForm(); const c=calc(b); const car=S.fleet.find(x=>x.id===b.car_id);
  const dl=$("#durline");
  if(dl){
    const clash=clashFor(b.car_id,b.pickup,b.drop,S.editId);
    dl.innerHTML = !b.pickup||!b.drop ? `<span class="muted">Set pickup and drop-off to see the duration.</span>`
      : new Date(b.drop)<=new Date(b.pickup) ? `<span class="err">Drop-off must be after pickup.</span>`
      : `<b>${esc(durText(c))}</b> · billed as ${c.days} × 24 hrs · ${c.km} km included${clash?` · <span class="err">This car is booked for ${esc(clash.name)} in these dates</span>`:""}`;
  }
  const mb=$("#mbtotal"); if(mb) mb.textContent = c.days&&b.rate ? inr(c.collected) : "—";
  box.innerHTML = `
    <dt>Car</dt><dd>${car?`<span class="plate">${esc(car.plate)}</span>`:"—"}</dd>
    <dt>Duration</dt><dd>${esc(durText(c))||"—"}</dd>
    <dt>Rental</dt><dd>${c.days&&b.rate?`${c.days} × ${inr(b.rate)} = ${inr(c.rental)}`:"—"}</dd>
    ${c.delivery?`<dt>Delivery</dt><dd>${inr(c.delivery)}</dd>`:""}
    <dt>Security deposit</dt><dd>${esc(depShort(b))}</dd>
    <dt class="total">Collect before handover</dt><dd class="total">${c.days&&b.rate?inr(c.collected):"—"}</dd>
    <dt>Km included</dt><dd>${c.km?c.km+" km":"—"}</dd>
    <dt>Extra km</dt><dd>${money(b,"extra_km")}/km</dd>
`;
}

/* ---------- fleet ---------- */
function viewFleet(){
  if(S.carEdit) return viewCarForm();
  if(S.carView){ const c=S.fleet.find(x=>x.id===S.carView); if(c) return viewCarProfile(c); S.carView=null; }
  return `
  <div class="head-row"><div><h2>Fleet</h2><div class="muted" style="font-size:14px">Open a car to see its papers and bookings. Its details fill every agreement automatically.</div></div><button class="btn primary" data-act="add-car">+ Add car</button></div>
  ${S.dbState==="loading"?`<div class="empty">Loading cars…</div>`: S.fleet.length? `<div class="fleet">${S.fleet.map(carCard).join("")}</div>` : `<div class="list"><div class="empty"><h3>No cars yet</h3>Add each car once with its insurance and PUC details.</div></div>`}`;
}
function carCard(c){
  const w=carWarnings(c), now=carNow(c);
  return `<button class="car" data-carview="${esc(c.id)}">
    <span class="top-line"><span class="plate">${esc(c.plate)}</span>${c.example?'<span class="ex">Example</span>':""}</span>
    <span><b class="car-name">${esc(c.make_model)}</b><span class="meta">${esc([c.category,c.reg_type,c.fuel,c.transmission].filter(Boolean).join(" · "))}</span></span>
    <span class="rate num">${inr(c.rate)} <small>/ day · deposit ${inr(c.deposit)}</small></span>
    <span class="pill ${now.cls}" style="align-self:flex-start">${esc(now.label)}</span>
    ${w.length?`<span class="warnline">${w.length} paper${w.length>1?"s":""} to check</span>`:`<span class="okline">Papers in order</span>`}
  </button>`;
}
function viewCarProfile(c){
  const now=carNow(c), w=carWarnings(c);
  const ins=docStatus(c.insurance_till), puc=docStatus(c.puc_till);
  const bk=S.bookings.filter(b=>b.car_id===c.id);
  const upcoming=bk.filter(b=>!["cancelled","returned"].includes(b.status)).sort((a,b)=>new Date(a.pickup)-new Date(b.pickup));
  const past=bk.filter(b=>["returned","cancelled"].includes(b.status)).sort((a,b)=>new Date(b.pickup)-new Date(a.pickup));
  const done=bk.filter(b=>["returned","handed"].includes(b.status));
  const days=done.reduce((s,b)=>s+calc(b).days,0), revenue=done.reduce((s,b)=>s+calc(b).rental,0);
  const row=(k,v)=>`<div><dt>${k}</dt><dd>${v}</dd></div>`;
  return `
  <div class="head-row">
    <div><button class="btn sm" data-act="close-carview">← Fleet</button></div>
    <div class="actions"><button class="btn" data-editcar="${esc(c.id)}">Edit car</button><button class="btn" data-act="car-revenue" data-car="${esc(c.id)}">Revenue &amp; bookings</button><button class="btn primary" data-act="book-car" data-car="${esc(c.id)}">New booking with this car</button></div>
  </div>
  <div class="profile">
    <div class="card profile-top">
      <span class="plate plate-lg">${esc(c.plate)}</span>
      <div style="min-width:0"><h2 style="font-size:24px">${esc(c.make_model)} ${c.example?'<span class="ex">Example</span>':""}</h2>
        <div class="muted">${esc([c.category,c.colour,c.year].filter(Boolean).join(" · "))}</div></div>
      <div class="profile-rate"><div class="rate num">${inr(c.rate)} <small>/ day</small></div><div class="muted num">Deposit ${inr(c.deposit)}</div></div>
      <span class="pill ${now.cls}">${esc(now.label)}</span>
    </div>
    ${w.length?`<div class="banner" style="margin:0">${w.map(esc).join(" · ")}</div>`:""}
    <div class="profile-grid">
      <div class="card"><h3>Papers</h3><dl class="kv-grid">
        ${row("Registration type", esc(c.reg_type||"—"))}
        ${row("Permit no.", esc(c.permit_no||"None"))}
        ${row("Insurance", `${esc(c.insurer||"")} ${esc(c.insurance_no||"—")}`)}
        ${row("Insurance valid till", `${esc(fmtD(c.insurance_till)||"—")} <span class="pill ${ins.cls}">${ins.label}</span>`)}
        ${row("Insured Declared Value", c.idv?inr(c.idv):"—")}
        ${row("PUC valid till", `${esc(fmtD(c.puc_till)||"—")} <span class="pill ${puc.cls}">${puc.label}</span>`)}
        ${row("FASTag", esc(c.fastag||"—"))}
        ${row("Chassis (last 5)", esc(c.chassis_last5||"—"))}
      </dl></div>
      <div class="card"><h3>Specifications</h3><dl class="kv-grid">
        ${row("Fuel", esc(c.fuel||"—"))}
        ${row("Transmission", esc(c.transmission||"—"))}
        ${row("Seats", esc(c.seats||"—"))}
        ${row("Colour", esc(c.colour||"—"))}
        ${row("Year", esc(c.year||"—"))}
        ${row("Available for booking", c.active===false?"No":"Yes")}
      </dl></div>
      <div class="card"><h3>Usage</h3><dl class="kv-grid num">
        ${row("Trips completed or running", String(done.length))}
        ${row("Days rented", String(days))}
        ${row("Rental earned", inr(revenue))}
        ${row("Upcoming bookings", String(upcoming.filter(b=>b.status!=="handed").length))}
      </dl></div>
    </div>
    <div><h3 style="font-size:17px;margin:4px 0 10px">Current and upcoming</h3>
      <div class="list">${upcoming.length? upcoming.map(rowHTML).join("") : `<div class="empty">No upcoming bookings for this car.</div>`}</div></div>
    ${past.length?`<div><h3 style="font-size:17px;margin:4px 0 10px">Past</h3><div class="list">${past.slice(0,20).map(rowHTML).join("")}</div></div>`:""}
  </div>`;
}
function viewCarForm(){
  const c = S.carEdit==="new" ? {active:true, deposit:5000, fuel:"Petrol", category:"Hatchback", transmission:"Manual", reg_type:"Private", seats:5, fastag:"Yes"} : (S.fleet.find(x=>x.id===S.carEdit)||{});
  const g=k=>c[k]??"";
  return `
  <div class="head-row"><h2>${S.carEdit==="new"?"Add car":"Edit "+esc(c.plate)}</h2><button class="btn sm" data-act="close-car">Back to fleet</button></div>
  <form id="cform" novalidate>
    <fieldset><legend>Car</legend><div class="grid">
      ${fieldHTML("c_make","Make and model",g("make_model"),{req:1,attrs:'placeholder="Hyundai Creta SX"'})}
      ${fieldHTML("c_plate","Registration number",g("plate"),{req:1,attrs:'placeholder="MH12 AB 1234" style="text-transform:uppercase"'})}
      ${fieldHTML("c_chassis","Chassis number, last 5",g("chassis_last5"),{attrs:'maxlength="5" style="text-transform:uppercase"'})}
      ${selectHTML("c_cat","Category",g("category"),["Hatchback","Sedan","Compact SUV","SUV","MUV","Luxury"].map(x=>[x,x]),{hint:"SUV and Luxury need age 25+."})}
      ${fieldHTML("c_colour","Colour",g("colour"))}
      ${fieldHTML("c_year","Year",g("year"),{type:"number",attrs:'min="2000" max="2035"'})}
      ${selectHTML("c_fuel","Fuel",g("fuel"),["Petrol","Diesel","CNG","Petrol + CNG","Electric","Hybrid"].map(x=>[x,x]))}
      ${selectHTML("c_trans","Transmission",g("transmission"),["Manual","Automatic"].map(x=>[x,x]))}
      ${fieldHTML("c_seats","Seating capacity",g("seats"),{type:"number",attrs:'min="2" max="9"'})}
      ${selectHTML("c_fastag","FASTag fitted",g("fastag"),[["Yes","Yes"],["No","No"]])}
    </div></fieldset>
    <fieldset><legend>Papers</legend><div class="grid">
      ${selectHTML("c_regtype","Registration type",g("reg_type"),[["Private","Private"],["Commercial","Commercial"]])}
      ${fieldHTML("c_permit","Permit number, if any",g("permit_no"))}
      ${fieldHTML("c_ins","Insurance policy number",g("insurance_no"))}
      ${fieldHTML("c_insurer","Insurer",g("insurer"))}
      ${fieldHTML("c_ins_till","Insurance valid till",g("insurance_till"),{type:"date"})}
      ${fieldHTML("c_idv","Insured Declared Value (₹)",g("idv"),{type:"number",attrs:'min="0"'})}
      ${fieldHTML("c_puc","PUC valid till",g("puc_till"),{type:"date"})}
    </div></fieldset>
    <fieldset><legend>Pricing</legend><div class="grid">
      ${fieldHTML("c_rate","Daily rate (₹)",g("rate"),{type:"number",req:1,attrs:'min="0" step="50"'})}
      ${fieldHTML("c_dep","Security deposit (₹)",g("deposit"),{type:"number",attrs:'min="0" step="500"'})}
      ${selectHTML("c_active","Available for booking",c.active===false?"no":"yes",[["yes","Yes"],["no","No, keep hidden"]])}
    </div></fieldset>
    <div id="carerr"></div>
    <div class="actions">
      <button type="submit" class="btn primary">Save car</button>
      ${S.carEdit!=="new"?`<button type="button" class="btn danger" data-act="ask-del-car">Remove car</button>`:""}
    </div>
    ${S.confirmCar?`<div class="confirm" style="margin-top:10px">Remove this car from the fleet? Old bookings keep their details. <button type="button" class="btn sm danger" data-act="del-car">Remove</button><button type="button" class="btn sm" data-act="keep-car">Keep</button></div>`:""}
  </form>`;
}

function viewSettings(){
  const s=S.settings; const g=k=>s[k]??"";
  const num=(id,label,k,hint="")=>fieldHTML(id,label,g(k),{type:"number",hint});
  return `
  <div class="head-row"><div><h2>Business &amp; charges</h2><div class="muted" style="font-size:14px">Used on every agreement. Default charges fill each new booking, where you can change them.</div></div></div>
  <form id="sform" novalidate>
    <fieldset><legend>Business details</legend><div class="grid">
      ${fieldHTML("s_legal","Legal name (as on Shop Act)",g("legal_name"),{req:1})}
      ${fieldHTML("s_sign","Proprietor",g("signatory"))}
      ${fieldHTML("s_shop","Shop Act registration no.",g("shop_act"))}
      ${fieldHTML("s_udyam","Udyam registration no.",g("udyam"))}
      ${fieldHTML("s_phone","Support phone",g("support_phone"))}
      ${fieldHTML("s_email","Support email",g("support_email"))}
      ${fieldHTML("s_griev","Grievance email",g("grievance_email"),{hint:"For data and dispute requests."})}
      ${fieldHTML("s_upi","Official UPI ID",g("official_upi"),{hint:"Printed so customers pay only here."})}
      ${fieldHTML("s_bank","Official bank account",g("official_bank"),{hint:"Account no. and IFSC"})}
      ${fieldHTML("s_address","Business address",g("address"),{type:"textarea",wide:1})}
      ${fieldHTML("s_loc","Default handover location",g("designated_location"),{wide:1})}
    </div></fieldset>
    <fieldset><legend>Default charges for new bookings</legend><div class="grid">${chargeFieldsHTML("sc_", {...DEFAULT_CHARGES, ...(s.charges||{})})}</div></fieldset>
    <fieldset><legend>Agreement terms</legend><div class="grid">
      ${num("s_nonret","Non-return after (hours)","non_return_hours","Recovery steps start after this")}
      ${num("s_unreach","Unreachable for (hours)","unreachable_hours","Grounds to end the rental")}
      ${num("s_retinsp","Unattended return inspection (hours)","return_inspection_hours")}
      ${num("s_repair","Emergency repair limit (₹)","emergency_repair_limit")}
      ${num("s_interest","Late payment interest (% a year)","late_interest")}
      ${num("s_track","Delete tracking data after (days)","tracking_retention_days")}
      ${num("s_fast","Fast-track arbitration up to (₹)","fast_track_limit")}
    </div></fieldset>
    <fieldset><legend>Eligibility</legend><div class="grid">
      ${num("s_age","Minimum age","min_age")}
      ${num("s_age2","Minimum age for SUV / Luxury","min_age_premium")}
      ${num("s_dlm","Licence held for at least (months)","dl_min_months")}
    </div></fieldset>
    <div class="actions"><button type="submit" class="btn primary">Save settings</button></div>
  </form>`;
}

/* ---------- actions ---------- */
/* ---------- customers ---------- */
const KYC_FIELDS = ["name","father","dob","alt_phone","email","address","emergency","dl","dl_till","rto","id_type","aadhaar4"];
const KYC_REQUIRED = [["name","Full name"],["father","Father's / spouse's name"],["dob","Date of birth"],["address","Address"],["emergency","Emergency contact"],["dl","Licence number"],["dl_till","Licence expiry"],["aadhaar4","ID last 4 digits"]];
const DOC_TYPES = ["DL front","DL back","Aadhaar (masked) front","Aadhaar (masked) back","Address proof","PAN","Passport","Selfie with DL","Other"];
const DOC_CHECK = [["DL front",["DL front"]],["DL back",["DL back"]],["ID / address proof",["Aadhaar (masked) front","Aadhaar (masked) back","Address proof","Passport"]]];
const normPhone = p => String(p||"").replace(/\D/g,"").slice(-10);
const fmtPhone = p => { const d=normPhone(p); return d.length===10 ? `${d.slice(0,5)} ${d.slice(5)}` : String(p||""); };
function custById(id){ return id ? S.customers.find(c=>c.id===id) || null : null; }
function custOfBooking(b){ return custById(b.customer_id) || custById(normPhone(b.phone)); }
function custBookings(c){ return S.bookings.filter(b=>b.customer_id===c.id || normPhone(b.phone)===c.id); }
function kycMissing(c){ return KYC_REQUIRED.filter(([k])=>!String(c?.[k]??"").trim()).map(([,l])=>l); }
function docCheck(c){ const types=new Set((c.docs||[]).map(d=>d.type)); return DOC_CHECK.map(([label,opts])=>({label, ok:opts.some(o=>types.has(o))})); }
function dlState(c){ if(!c.dl_till) return null; const d=new Date(c.dl_till+"T23:59"); if(d<new Date()) return {cls:"s-cancelled",label:"DL expired"}; if((d-new Date())/864e5<60) return {cls:"s-sent",label:"DL expires soon"}; return {cls:"s-signed",label:"DL valid"}; }
function custChips(c){
  const out=[]; if(c.blocked) out.push(`<span class="pill s-cancelled">Do not rent</span>`);
  const miss=kycMissing(c); out.push(miss.length?`<span class="pill s-sent">KYC: ${miss.length} missing</span>`:`<span class="pill s-signed">KYC complete</span>`);
  const dc=docCheck(c), n=dc.filter(x=>x.ok).length; out.push(`<span class="pill ${n===dc.length?"s-signed":"s-draft"}">Docs ${n}/${dc.length}</span>`);
  const dl=dlState(c); if(dl && dl.cls!=="s-signed") out.push(`<span class="pill ${dl.cls}">${dl.label}</span>`);
  return out.join("");
}

// Customer record built from a booking form (only non-empty values overwrite what's saved).
async function upsertCustomerFrom(f){
  const id=normPhone(f.phone); if(id.length!==10) return null;
  const prev=custById(id)||{}; const now=new Date().toISOString();
  const doc={...prev, id, phone:fmtPhone(f.phone), created_at:prev.created_at||now, updated_at:now, source:prev.source||"desk"};
  for(const k of KYC_FIELDS){ const v=String(f[k]??"").trim(); if(v) doc[k]= k==="dl" ? v.toUpperCase() : v; }
  if(!(await write("customers/"+id, doc))) return null;
  localUpsert(S.customers, doc); return doc;
}

// One-time: create customer records from bookings made before customer profiles existed.
async function syncCustomersFromBookings(){
  if(S._synced || !S._custLoaded || !S._bkLoaded) return; S._synced=true;
  const latest=new Map();
  for(const b of S.bookings){ const id=normPhone(b.phone); if(id.length!==10 || custById(id)) continue; const p=latest.get(id); if(!p || String(b.updated_at||"")>String(p.updated_at||"")) latest.set(id,b); }
  for(const b of latest.values()){ const c=await upsertCustomerFrom(b); if(c && !b.customer_id){ await write("bookings/"+b.id,{...b, customer_id:c.id}); } }
  if(latest.size) softRender();
}

/* website enquiries (old customers table), used only to suggest name/email */
let webTimer=null;
function searchWebsite(digits){
  clearTimeout(webTimer);
  if(digits.length<5){ S.webMatches=[]; return; }
  webTimer=setTimeout(async ()=>{
    try{
      const { data, error } = await supabase.from("customers").select("full_name, phone, email").ilike("phone", `%${digits}%`).limit(5);
      if(error) return;
      S.webMatches=(data||[]).filter(w=>normPhone(w.phone).length===10 && !custById(normPhone(w.phone)));
      renderCustDropdown();
    }catch(e){ /* optional source */ }
  },250);
}

/* booking form: mobile search */
function custMatches(term){
  const t=term.trim().toLowerCase(), d=term.replace(/\D/g,"");
  if(!t) return [];
  return S.customers.filter(c=> (d.length>=3 && c.id.includes(d)) || (/[a-z]/i.test(t) && (c.name||"").toLowerCase().includes(t)) ).sort((a,b)=>String(b.updated_at||"").localeCompare(String(a.updated_at||""))).slice(0,6);
}
function renderCustDropdown(){
  const dd=$("#custdd"), inp=$("#f_phone"); if(!dd||!inp) return;
  if(document.activeElement!==inp){ dd.hidden=true; return; }
  const term=inp.value, d=normPhone(term), ms=custMatches(term);
  const exact=ms.find(c=>c.id===d);
  const rows=ms.map(c=>`<button type="button" class="dd-row" data-pickcust="${esc(c.id)}"><span><b>${esc(c.name||"No name")}</b><small class="muted num">${esc(fmtPhone(c.phone))}${c.dl?` · ${esc(c.dl)}`:""}</small></span><span class="dd-chips">${c.blocked?`<span class="pill s-cancelled">Do not rent</span>`:kycMissing(c).length?`<span class="pill s-sent">KYC incomplete</span>`:`<span class="pill s-signed">KYC complete</span>`}</span></button>`);
  (S.webMatches||[]).forEach(w=>rows.push(`<button type="button" class="dd-row" data-webcust="${esc(normPhone(w.phone))}" data-name="${esc(w.full_name||"")}" data-email="${esc(w.email||"")}"><span><b>${esc(w.full_name||"Website customer")}</b><small class="muted num">${esc(fmtPhone(w.phone))} · from website enquiry</small></span><span class="dd-chips"><span class="pill s-draft">New</span></span></button>`));
  if(d.length===10 && !exact) rows.push(`<button type="button" class="dd-row dd-new" data-newcust="${d}"><span><b>+ Add new customer</b><small class="muted num">${esc(fmtPhone(d))}</small></span></button>`);
  if(!rows.length){ dd.innerHTML = d.length && d.length<10 ? `<div class="dd-empty">Keep typing the 10-digit number…</div>` : `<div class="dd-empty">Type a mobile number or name</div>`; }
  else dd.innerHTML=rows.join("");
  dd.hidden=false;
}
function setKycFields(src){ for(const k of KYC_FIELDS){ const el=$("#"+FORM_MAP[k]); if(el) el.value = k==="id_type" ? (src[k]||IDTYPES[0]) : (src[k]??""); } }
function custCardHTML(c, isNew){
  if(isNew) return `<div class="custcard new"><div><b>New customer</b><div class="muted" style="font-size:13px">Fill the details below. A customer profile is created when you save the booking.</div></div><button type="button" class="btn sm" data-act="cust-change">Change</button></div>`;
  if(!c) return "";
  const miss=kycMissing(c), n=custBookings(c).filter(b=>b.status!=="cancelled").length;
  return `<div class="custcard ${c.blocked?"blocked":""}">
    <div class="cc-main"><b>${esc(c.name||"No name")}</b><span class="muted num">${esc(fmtPhone(c.phone))}${c.dl?` · DL ${esc(c.dl)}`:""} · ${n} booking${n===1?"":"s"}</span>
      <div class="chips">${custChips(c)}</div>
      ${c.blocked?`<div class="err" style="margin-top:4px">Do not rent${c.block_reason?`: ${esc(c.block_reason)}`:""}</div>`:""}
      ${miss.length?`<div class="warnline" style="margin-top:4px">Missing: ${esc(miss.join(", "))}</div>`:""}</div>
    <div class="cc-links"><button type="button" class="linkbtn" data-act="cust-fields" id="cc_edit">Edit</button><button type="button" class="linkbtn" data-custview="${esc(c.id)}" data-keepdraft="1">Profile</button><button type="button" class="linkbtn" data-act="cust-change">Change</button></div>
  </div>`;
}
function applyCustomer(c){
  setKycFields(c); $("#f_custid").value=c.id; $("#f_phone").value=fmtPhone(c.phone);
  $("#custcard").innerHTML=custCardHTML(c); $("#custfields").hidden = true;
  $("#custdd").hidden=true; S.formCust=c.id; updateSummary();
}
function startNewCustomer(phone, name, email){
  setKycFields({}); $("#f_custid").value=""; $("#f_phone").value=fmtPhone(phone);
  if(name) $("#f_name").value=name; if(email) $("#f_email").value=email;
  $("#custcard").innerHTML=custCardHTML(null,true); $("#custfields").hidden=false; $("#custdd").hidden=true; S.formCust="new:"+normPhone(phone);
  (name? $("#f_father") : $("#f_name")).focus(); updateSummary();
}
function clearCustomer(){
  setKycFields({}); $("#f_custid").value=""; $("#f_phone").value=""; $("#custcard").innerHTML=""; $("#custfields").hidden=true; S.formCust=null;
  $("#f_phone").focus(); renderCustDropdown();
}
function onPhoneInput(){
  const d=normPhone($("#f_phone").value);
  if(S.formCust && S.formCust!==d && S.formCust!=="new:"+d){ // number changed after picking someone
    setKycFields({}); $("#f_custid").value=""; $("#custcard").innerHTML=""; $("#custfields").hidden=true; S.formCust=null;
  }
  if(!S.formCust && d.length===10){ const c=custById(d); if(c){ applyCustomer(c); return; } }
  searchWebsite(d); renderCustDropdown();
}

/* customers tab */
function viewCustomers(){
  if(S.custEdit) return viewCustForm();
  if(S.custView){ const c=custById(S.custView); if(c) return viewCustProfile(c); S.custView=null; }
  return `
  <div class="head-row"><div><h2>Customers</h2><div class="muted" style="font-size:14px">${S.customers.length} customer${S.customers.length===1?"":"s"}. Profiles fill in automatically from bookings.</div></div><button class="btn primary" data-act="add-customer">+ Add customer</button></div>
  <div class="field" style="margin-bottom:12px"><label for="cust_q" class="sr">Search customers</label><input id="cust_q" type="search" placeholder="Search by name, mobile or licence no." value="${esc(S.custQuery||"")}" autocomplete="off"></div>
  <div class="list" id="custlist">${custListHTML()}</div>`;
}
function custListHTML(){
  if(S.dbState==="loading" || !S._custLoaded) return `<div class="empty">Loading customers…</div>`;
  const t=(S.custQuery||"").trim().toLowerCase(), d=t.replace(/\D/g,"");
  const list=S.customers.filter(c=>!t || (c.name||"").toLowerCase().includes(t) || (d.length>=3 && c.id.includes(d)) || (c.dl||"").toLowerCase().replace(/\s/g,"").includes(t.replace(/\s/g,"")))
    .sort((a,b)=>String(b.updated_at||"").localeCompare(String(a.updated_at||"")));
  if(!list.length) return `<div class="empty"><h3>${t?"No match":"No customers yet"}</h3>${t?"Try another name or number.":"Customers appear here when you save a booking, or add one now."}</div>`;
  return list.map(c=>{ const bk=custBookings(c).filter(b=>b.status!=="cancelled"); const last=bk.map(b=>b.pickup).sort().slice(-1)[0];
    return `<button class="row crow" data-custview="${esc(c.id)}">
      <span class="who"><b>${esc(c.name||"No name")}</b><small class="num">${esc(fmtPhone(c.phone))}</small></span>
      <span class="when num"><small>${bk.length} booking${bk.length===1?"":"s"}${last?` · last ${esc(fmtD(last))}`:""}</small></span>
      <span class="chips">${custChips(c)}</span>
    </button>`; }).join("");
}
function viewCustProfile(c){
  const bk=custBookings(c).sort((a,b)=>new Date(b.pickup)-new Date(a.pickup));
  const live=bk.filter(b=>b.status!=="cancelled");
  const paid=live.reduce((s,b)=>s+ledger(b).settled,0), due=live.filter(b=>["handed","returned"].includes(b.status)).reduce((s,b)=>s+Math.max(0,ledger(b).balance),0);
  const days=live.filter(b=>["handed","returned"].includes(b.status)).reduce((s,b)=>s+calc(b).days,0);
  const row=(k,v)=>`<div><dt>${k}</dt><dd>${v||"—"}</dd></div>`;
  const miss=kycMissing(c);
  return `
  <div class="head-row">
    <div><button class="btn sm" data-act="close-cust">← Customers</button></div>
    <div class="actions"><button class="btn" data-act="edit-cust">Edit</button>${c.blocked?"":`<button class="btn primary" data-act="book-cust" data-cust="${esc(c.id)}">New booking</button>`}</div>
  </div>
  <div class="profile">
    <div class="card profile-top">
      <div style="min-width:0"><h2 style="font-size:24px">${esc(c.name||"No name")}</h2><div class="muted num">${esc(fmtPhone(c.phone))}${c.email?` · ${esc(c.email)}`:""}</div><div class="chips" style="margin-top:8px">${custChips(c)}</div></div>
      <div class="actions profile-rate">${waButton(c.phone, `Hello ${c.name||""}, this is ${S.settings.business_name}.`, "WhatsApp", "btn sm")}</div>
    </div>
    ${c.blocked?`<div class="banner" style="margin:0;background:var(--bad-soft);color:var(--bad)">Do not rent${c.block_reason?`: ${esc(c.block_reason)}`:""}</div>`:""}
    ${miss.length?`<div class="banner" style="margin:0">Missing for the agreement: ${esc(miss.join(", "))}</div>`:""}
    <div class="profile-grid">
      <div class="card"><h3>Personal</h3><dl class="kv-grid">
        ${row("Father's / spouse's name", esc(c.father))}
        ${row("Date of birth", esc(fmtD(c.dob)) + (c.dob?` <span class="muted">(${ageOn(c.dob,new Date())} yrs)</span>`:""))}
        ${row("Alternate mobile", esc(c.alt_phone))}
        ${row("Email", esc(c.email))}
        ${row("Emergency contact", esc(c.emergency))}
        ${row("Address", esc(c.address))}
      </dl></div>
      <div class="card"><h3>Licence and ID</h3><dl class="kv-grid">
        ${row("Driving licence no.", esc(c.dl))}
        ${row("Licence valid till", c.dl_till? `${esc(fmtD(c.dl_till))} ${dlState(c)?`<span class="pill ${dlState(c).cls}">${dlState(c).label}</span>`:""}`:"")}
        ${row("Issuing RTO", esc(c.rto))}
        ${row("Photo ID", c.aadhaar4? `${esc(c.id_type||"Aadhaar (masked)")}, XXXX ${esc(c.aadhaar4)}`:"")}
      </dl></div>
      <div class="card"><h3>History</h3><dl class="kv-grid num">
        ${row("Bookings", String(live.length))}
        ${row("Days rented", String(days))}
        ${row("Total paid", inr(paid))}
        ${row("Outstanding", due?`<span class="err">${inr(due)}</span>`:inr(0))}
        ${row("Customer since", esc(fmtD(c.created_at)))}
      </dl>${c.notes?`<p class="note" style="margin:10px 0 0">${esc(c.notes)}</p>`:""}</div>
    </div>
    ${docsSectionHTML(c)}
    <div><h3 style="font-size:17px;margin:4px 0 10px">Bookings</h3>
      <div class="list">${bk.length? bk.map(rowHTML).join("") : `<div class="empty">No bookings yet.</div>`}</div></div>
    ${bk.length?"":`<div>${S.confirmCustDel===c.id?`<div class="confirm">Delete this customer? Their files stay in Google Drive. <button class="btn sm danger" data-act="del-cust">Delete</button><button class="btn sm" data-act="keep-cust">Keep</button></div>`:`<button class="btn danger" data-act="ask-del-cust">Delete customer</button>`}</div>`}
  </div>`;
}
function docsSectionHTML(c){
  const docs=(c.docs||[]).slice().sort((a,b)=>String(b.at).localeCompare(String(a.at)));
  const checks=docCheck(c).map(x=>`<span class="pill ${x.ok?"s-signed":"s-draft"}">${esc(x.label)}${x.ok?"":" missing"}</span>`).join("");
  let body;
  if(!driveConfigured()) body=`<p class="note" style="margin:0">Google Drive isn't set up yet. Once the Google client ID is added to Vercel, you can upload DL, Aadhaar and address proof here.</p>`;
  else if(!driveConnected()) body=`<div class="actions"><button class="btn primary" data-act="drive-connect">Connect Google Drive</button></div><p class="note" style="margin:10px 0 0">Sign in with the Google account where DriveKaro's KYC files should be kept. Files go to <b>My Drive › DriveKaro Customer KYC › ${esc(c.name||"Customer")} - ${esc(c.id)}</b>.</p>`;
  else body=`<div class="grid">
      ${selectHTML("doc_type","Document",S.docType||DOC_TYPES[0],DOC_TYPES.map(x=>[x,x]))}
      <div class="field"><label for="doc_file">File (photo or PDF)</label><input id="doc_file" type="file" accept="image/*,application/pdf"></div>
    </div>
    <div class="actions" style="margin-top:10px"><button class="btn primary" data-act="upload-doc" ${S.uploading?"disabled":""}>${S.uploading?"Uploading…":"Upload to Drive"}</button>${c.drive_folder_id?`<a class="btn sm" href="${esc(folderUrl(c.drive_folder_id))}" target="_blank" rel="noopener">Open folder in Drive</a>`:""}</div>
    <p class="note" style="margin:10px 0 0">For Aadhaar, upload the masked Aadhaar (only last 4 digits visible), downloadable from the UIDAI site.</p>`;
  return `<div class="card"><div class="paper-bar" style="margin:0 0 10px"><h3 style="margin:0">KYC documents</h3><div class="chips">${checks}</div></div>
    ${body}
    ${docs.length?`<div class="doclist">${docs.map(d=>`<div class="docrow"><div style="min-width:0"><b>${esc(d.type)}</b><small class="muted"> · ${esc(fmtD(d.at))}${d.size?` · ${Math.max(1,Math.round(d.size/1024))} KB`:""}</small><div class="muted doc-name">${esc(d.name)}</div></div>
      <div class="actions"><a class="btn sm" href="${esc(d.link||"")}" target="_blank" rel="noopener">Open</a>${S.confirmDoc===d.id?`<button class="btn sm danger" data-act="del-doc" data-id="${esc(d.id)}">Confirm remove</button><button class="btn sm" data-act="keep-doc">Keep</button>`:`<button class="btn sm" data-act="ask-del-doc" data-id="${esc(d.id)}">Remove</button>`}</div></div>`).join("")}</div>`:`<p class="muted" style="font-size:14px;margin:12px 0 0">No documents uploaded yet.</p>`}
  </div>`;
}
function viewCustForm(){
  const isNew=S.custEdit==="new"; const c=isNew?{id_type:IDTYPES[0]}:(custById(S.custEdit)||{});
  const g=k=>c[k]??"";
  return `
  <div class="head-row"><h2>${isNew?"Add customer":"Edit "+esc(c.name||"customer")}</h2><button class="btn sm" data-act="close-custform">Cancel</button></div>
  <form id="custform" novalidate>
    <fieldset><legend>Customer</legend><div class="grid">
      ${isNew?fieldHTML("k_phone","Mobile",fmtPhone(S.newCustPhone||""),{req:1,type:"tel",attrs:'inputmode="tel"'}):`<div class="field"><label>Mobile</label><div class="num" style="padding:10px 0">${esc(fmtPhone(c.phone))}</div><span class="hint">To use a different number, add a new customer.</span></div>`}
      ${fieldHTML("k_name","Full name (as on licence)",g("name"),{req:1})}
      ${fieldHTML("k_father","Father's / spouse's name",g("father"))}
      ${fieldHTML("k_dob","Date of birth",g("dob"),{type:"date"})}
      ${fieldHTML("k_alt","Alternate mobile",g("alt_phone"),{type:"tel"})}
      ${fieldHTML("k_email","Email",g("email"),{type:"email"})}
      ${fieldHTML("k_address","Permanent address",g("address"),{type:"textarea",wide:1})}
      ${fieldHTML("k_emergency","Emergency contact (name, relation, number)",g("emergency"),{wide:1})}
    </div></fieldset>
    <fieldset><legend>Licence and ID</legend><div class="grid">
      ${fieldHTML("k_dl","Driving licence number",g("dl"),{attrs:'style="text-transform:uppercase"'})}
      ${fieldHTML("k_dl_till","Licence valid till",g("dl_till"),{type:"date"})}
      ${fieldHTML("k_rto","Issuing RTO",g("rto"))}
      ${selectHTML("k_idtype","Photo ID type",g("id_type")||IDTYPES[0],IDTYPES.map(x=>[x,x]))}
      ${fieldHTML("k_aadhaar4","ID number, last 4 digits",g("aadhaar4"),{attrs:'inputmode="numeric" maxlength="4"'})}
    </div></fieldset>
    <fieldset><legend>Notes and status</legend><div class="grid">
      ${fieldHTML("k_notes","Internal notes",g("notes"),{type:"textarea",wide:1,hint:"Only you see this."})}
      ${selectHTML("k_blocked","Rent to this customer?",c.blocked?"no":"yes",[["yes","Yes"],["no","No, mark do not rent"]])}
      ${fieldHTML("k_reason","Reason (if do not rent)",g("block_reason"))}
    </div></fieldset>
    <div id="custerr"></div>
    <div class="actions"><button type="submit" class="btn primary">Save customer</button></div>
  </form>`;
}
async function saveCustomerForm(){
  const v=id=>($("#"+id)?.value??"").trim();
  const isNew=S.custEdit==="new"; const errs=[];
  const id=isNew? normPhone(v("k_phone")) : S.custEdit;
  if(isNew && !PHONE_RE.test(v("k_phone"))) errs.push("Enter a 10-digit Indian mobile number.");
  if(isNew && custById(id)) errs.push("A customer with this mobile number already exists.");
  if(!v("k_name")) errs.push("Enter the customer's name.");
  if(v("k_aadhaar4") && !/^\d{4}$/.test(v("k_aadhaar4"))) errs.push("ID number: enter only the last 4 digits.");
  if(v("k_email") && !/^\S+@\S+\.\S+$/.test(v("k_email"))) errs.push("Enter a valid email or leave it blank.");
  if(errs.length){ $("#custerr").innerHTML=`<div class="errors" style="margin-bottom:12px"><ul>${errs.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div>`; return; }
  const prev=isNew?{}:(custById(id)||{}); const now=new Date().toISOString();
  const doc={...prev, id, phone: isNew? fmtPhone(v("k_phone")) : prev.phone, name:v("k_name"), father:v("k_father"), dob:v("k_dob"), alt_phone:v("k_alt"), email:v("k_email"), address:v("k_address"), emergency:v("k_emergency"),
    dl:v("k_dl").toUpperCase(), dl_till:v("k_dl_till"), rto:v("k_rto"), id_type:v("k_idtype"), aadhaar4:v("k_aadhaar4"), notes:v("k_notes"), blocked:v("k_blocked")==="no", block_reason:v("k_blocked")==="no"?v("k_reason"):"",
    created_at:prev.created_at||now, updated_at:now, source:prev.source||"desk"};
  if(!(await write("customers/"+id, doc))) return;
  localUpsert(S.customers, doc); S.custEdit=null; S.custView=id; S.newCustPhone=""; render(); window.scrollTo(0,0); toast("Customer saved.");
}
async function uploadDoc(c){
  const input=$("#doc_file"); const file=input?.files?.[0];
  if(!file){ toast("Choose a photo or PDF first."); return; }
  if(file.size>25*1024*1024){ toast("That file is over 25 MB. Choose a smaller one."); return; }
  const type=$("#doc_type").value; S.docType=type;
  S.uploading=true; render();
  try{
    const meta=S.driveMeta || (S.driveMeta = (await S.db.doc("meta/drive").get()).data() || {});
    const {rootId, folderId} = await ensureCustomerFolder({ rootId:meta.root_id, folderId:c.drive_folder_id, folderName:`${c.name||"Customer"} - ${c.id}` });
    if(rootId!==meta.root_id){ S.driveMeta={...meta, root_id:rootId}; await S.db.doc("meta/drive").set(S.driveMeta); }
    const small=await shrinkImage(file);
    const ext=(small.name.match(/\.(\w+)$/)||[,"pdf"])[1].toLowerCase();
    const f=await uploadFile(small, `${type} - ${c.name||c.id} - ${toLocalInput().slice(0,10)}.${ext}`, folderId);
    const fresh=custById(c.id)||c;
    const entry={id:f.id, type, name:f.name, link:f.webViewLink, mime:f.mimeType, size:Number(f.size)||small.size, at:new Date().toISOString()};
    const doc={...fresh, drive_folder_id:folderId, docs:[...(fresh.docs||[]), entry], updated_at:new Date().toISOString()};
    if(await write("customers/"+c.id, doc)){ localUpsert(S.customers, doc); toast(`${type} uploaded to Drive.`); }
  }catch(e){ toast(e.message || "Upload failed. Try again."); }
  S.uploading=false; render();
}
async function removeDoc(c, fileId){
  try{ await trashFile(fileId); }catch(e){ if(e.code==="auth"){ toast(e.message); render(); return; } toast("Couldn't remove it from Drive: "+e.message); return; }
  const doc={...c, docs:(c.docs||[]).filter(d=>d.id!==fileId), updated_at:new Date().toISOString()};
  if(await write("customers/"+c.id, doc)){ localUpsert(S.customers, doc); S.confirmDoc=null; render(); toast("Removed. It's in Drive's bin for 30 days."); }
}

/* ---------- security deposit ---------- */
const DEP_TYPES=[["cash","Cash / UPI"],["bike","Bike"],["document","Document"]];
const DEP_DOCS=["Office ID card","College ID card","Voter ID","PAN card","Other"];
function depType(b){ return b.deposit_type||"cash"; }
function depCash(b){ return depType(b)==="cash" ? (Number(b.deposit)||0) : 0; }
// Wording used in the agreement's Schedule III
function depText(b){
  const t=depType(b);
  if(t==="bike") return b.dep_bike_no ? `Two-wheeler ${b.dep_bike_no}${b.dep_bike_model?` (${b.dep_bike_model})`:""}, with its keys and a copy of its registration certificate` : null;
  if(t==="document") return b.dep_doc_type ? `Original ${b.dep_doc_type}${b.dep_doc_details?` (${b.dep_doc_details})`:""}` : null;
  return (b.deposit!==""&&b.deposit!=null) ? `${inr(b.deposit)}, paid in cash or UPI` : null;
}
// Short label for screens and WhatsApp
function depShort(b){
  const t=depType(b);
  if(t==="bike") return b.dep_bike_no ? `Bike ${b.dep_bike_no}` : "Bike (number not added)";
  if(t==="document") return b.dep_doc_type ? b.dep_doc_type : "Document (not chosen)";
  return (b.deposit!==""&&b.deposit!=null) ? inr(b.deposit) : "—";
}
function depFieldsHTML(g, errs){
  const t=g("deposit_type")||"cash";
  return `${selectHTML("f_deptype","Security deposit",t,DEP_TYPES)}
    <div class="field depf" data-dep="cash" ${t==="cash"?"":"hidden"}><label for="f_deposit">Deposit amount (₹)</label><input id="f_deposit" type="number" value="${esc(g("deposit"))}" min="0" step="500" inputmode="numeric" ${errs.deposit?'aria-invalid="true"':""}>${errs.deposit?`<span class="err">${esc(errs.deposit)}</span>`:`<span class="hint">Fills from the car.</span>`}</div>
    <div class="field depf" data-dep="bike" ${t==="bike"?"":"hidden"}><label for="f_depbike">Bike number</label><input id="f_depbike" value="${esc(g("dep_bike_no"))}" placeholder="MH12 AB 1234" style="text-transform:uppercase" ${errs.dep_bike_no?'aria-invalid="true"':""}>${errs.dep_bike_no?`<span class="err">${esc(errs.dep_bike_no)}</span>`:""}</div>
    <div class="field depf" data-dep="bike" ${t==="bike"?"":"hidden"}><label for="f_depbikemodel">Bike make and model</label><input id="f_depbikemodel" value="${esc(g("dep_bike_model"))}" placeholder="Honda Activa"></div>
    <div class="field depf" data-dep="document" ${t==="document"?"":"hidden"}><label for="f_depdoc">Which document</label><select id="f_depdoc" ${errs.dep_doc_type?'aria-invalid="true"':""}>${[["",""],...DEP_DOCS.map(x=>[x,x])].map(o=>`<option value="${esc(o[0])}" ${o[0]===(g("dep_doc_type")||"")?"selected":""}>${esc(o[1])}</option>`).join("")}</select>${errs.dep_doc_type?`<span class="err">${esc(errs.dep_doc_type)}</span>`:`<span class="hint">Don't keep original Aadhaar or passport.</span>`}</div>
    <div class="field depf" data-dep="document" ${t==="document"?"":"hidden"}><label for="f_depdocdet">Document details</label><input id="f_depdocdet" value="${esc(g("dep_doc_details"))}" placeholder="e.g. Infosys ID, no. 123456"></div>`;
}
function showDepFields(){ const t=$("#f_deptype")?.value||"cash"; document.querySelectorAll(".depf").forEach(el=>el.hidden = el.dataset.dep!==t); }

/* ---------- revenue ---------- */
const MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const EARNED=["handed","returned"], UPCOMING=["ready","sent","signed"];
function ym(d){ const x=new Date(d); return isNaN(x)?"":`${x.getFullYear()}-${pad(x.getMonth()+1)}`; }
function fyStartYear(d){ const x=new Date(d); return x.getMonth()>=3 ? x.getFullYear() : x.getFullYear()-1; }
function fyName(y){ return `FY ${String(y).slice(2)}-${String(y+1).slice(2)}`; }
function monthName(k){ const [y,m]=k.split("-").map(Number); return `${MONTHS[m-1]} ${y}`; }
function sumUp(list){ let rev=0,rec=0,days=0,out=0; for(const b of list){ const L=ledger(b); rev+=L.total; rec+=L.settled; days+=L.c.days; out+=Math.max(0,L.balance); } return {n:list.length,rev,rec,days,out}; }
function revModel(){
  const car = S.repCar && S.repCar!=="all" ? S.fleet.find(c=>c.id===S.repCar) || (S.bookings.find(b=>b.car_id===S.repCar)?.car_snapshot) : null;
  const month = S.repMonth || ym(new Date());
  const [yy,mm]=month.split("-").map(Number);
  const fyY = fyStartYear(new Date(yy,mm-1,1));
  const all = S.bookings.filter(b=> !S.repCar || S.repCar==="all" || b.car_id===S.repCar);
  const inFY = b=>{ const d=new Date(b.pickup); return !isNaN(d) && fyStartYear(d)===fyY; };
  const earned = all.filter(b=>EARNED.includes(b.status));
  const range = S.repRange||"month";
  const list = (range==="month" ? all.filter(b=>ym(b.pickup)===month) : range==="fy" ? all.filter(inFY) : all)
    .filter(b=>!["cancelled","draft"].includes(b.status)).sort((a,b)=>new Date(b.pickup)-new Date(a.pickup));
  const rangeLabel = range==="month" ? monthName(month) : range==="fy" ? fyName(fyY) : "All time";
  return { car, month, fyY, all, earned, inFY, list, range, rangeLabel };
}
function viewRevenue(){
  const R=revModel(); const {car, month, fyY, earned, inFY, list, range}=R;
  const M=sumUp(earned.filter(b=>ym(b.pickup)===month)), F=sumUp(earned.filter(inFY));
  const now=new Date(); const U=sumUp(R.all.filter(b=>UPCOMING.includes(b.status) && new Date(b.drop)>=now));
  const months=[...Array(12)].map((_,i)=>{ const d=new Date(fyY,3+i,1); const k=ym(d); return {k, label:`${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, ...sumUp(earned.filter(b=>ym(b.pickup)===k))}; });
  const maxRev=Math.max(1,...months.map(m=>m.rev));
  const cars=[...S.fleet];
  S.bookings.forEach(b=>{ if(b.car_id && !cars.some(c=>c.id===b.car_id) && b.car_snapshot) cars.push({id:b.car_id, ...b.car_snapshot, removed:true}); });
  const perCar = (!S.repCar||S.repCar==="all") ? cars.map(c=>({c, ...sumUp(earned.filter(b=>b.car_id===c.id && inFY(b)))})).sort((a,b)=>b.rev-a.rev) : [];
  const maxCar=Math.max(1,...perCar.map(x=>x.rev));
  return `
  <div class="head-row"><div><h2>Revenue</h2><div class="muted" style="font-size:14px">Revenue counts trips that have started (car handed over or returned), by pickup date. Deposits are not revenue.</div></div></div>
  <div class="carchips" role="group" aria-label="Car">
    <button class="chip" aria-pressed="${!S.repCar||S.repCar==="all"}" data-repcar="all">All cars</button>
    ${cars.map(c=>`<button class="chip" aria-pressed="${S.repCar===c.id}" data-repcar="${esc(c.id)}"><span class="num">${esc(c.plate||c.id)}</span> · ${esc((c.make_model||"").split(" ").slice(0,2).join(" "))}</button>`).join("")}
  </div>
  <div class="rep-controls">
    <div class="field"><label for="rep_month">Month</label><input id="rep_month" type="month" value="${esc(month)}"></div>
    <div class="muted" style="font-size:13px;align-self:end;padding-bottom:10px">Financial year: <b>${fyName(fyY)}</b> (Apr–Mar)</div>
  </div>
  <div class="money">
    <div class="tile"><span class="label">${esc(monthName(month))}</span><b class="num">${inr(M.rev)}</b><small>${M.n} trip${M.n===1?"":"s"} · ${M.days} day${M.days===1?"":"s"}</small></div>
    <div class="tile"><span class="label">${fyName(fyY)}</span><b class="num">${inr(F.rev)}</b><small>${F.n} trip${F.n===1?"":"s"} · ${F.days} days</small></div>
    <div class="tile"><span class="label">Received · ${fyName(fyY)}</span><b class="num">${inr(F.rec)}</b><small class="${F.out>0?"err":""}">${F.out>0?`${inr(F.out)} still to collect`:"nothing pending"}</small></div>
    <div class="tile"><span class="label">Upcoming bookings</span><b class="num">${inr(U.rev)}</b><small>${U.n} confirmed, not started</small></div>
  </div>
  <div class="rep-grid">
    <section class="pcard"><h3>Month by month · ${fyName(fyY)}${car?` · ${esc(car.plate||"")}`:""}</h3>
      <div class="mtable" role="table" aria-label="Revenue by month">
        <div class="mrow mhead" role="row"><span role="columnheader">Month</span><span role="columnheader">Trips</span><span role="columnheader">Days</span><span role="columnheader" class="r">Revenue</span></div>
        ${months.map(m=>`<button class="mrow ${m.k===month?"on":""}" role="row" data-repmonth="${m.k}"><span role="cell">${m.label}</span><span role="cell" class="num">${m.n||"–"}</span><span role="cell" class="num">${m.days||"–"}</span><span role="cell" class="r num">${m.rev?inr(m.rev):"–"}<i class="bar" style="width:${Math.round(m.rev/maxRev*100)}%"></i></span></button>`).join("")}
        <div class="mrow mfoot" role="row"><span role="cell">Total</span><span role="cell" class="num">${F.n}</span><span role="cell" class="num">${F.days}</span><span role="cell" class="r num">${inr(F.rev)}</span></div>
      </div>
    </section>
    ${perCar.length?`<section class="pcard"><h3>By car · ${fyName(fyY)}</h3>
      <div class="mtable">
        <div class="mrow mhead"><span>Car</span><span>Trips</span><span>Days</span><span class="r">Revenue</span></div>
        ${perCar.map(x=>`<button class="mrow" data-repcar="${esc(x.c.id)}"><span><span class="plate">${esc(x.c.plate||x.c.id)}</span></span><span class="num">${x.n||"–"}</span><span class="num">${x.days||"–"}</span><span class="r num">${x.rev?inr(x.rev):"–"}<i class="bar" style="width:${Math.round(x.rev/maxCar*100)}%"></i></span></button>`).join("")}
      </div></section>`:""}
  </div>
  <div class="head-row" style="margin-top:18px;align-items:center">
    <h3 style="font-size:17px;margin:0">Bookings${car?` · ${esc(car.plate||"")} ${esc(car.make_model||"")}`:""}</h3>
    <div class="actions">${S.downloads?`<button class="btn sm primary" data-act="rep-export">Export sheet (CSV)</button>`:""}</div>
  </div>
  <div class="filters" role="group" aria-label="Period">
    ${[["month",monthName(month)],["fy",fyName(fyY)],["all","All time"]].map(([k,l])=>`<button class="chip" aria-pressed="${range===k}" data-reprange="${k}">${esc(l)}</button>`).join("")}
  </div>
  <div class="list">${list.length? list.map(b=>{ const L=ledger(b); const st=STATUS[b.status]||STATUS.draft; const c2=carOf(b)||{};
      return `<button class="row rrow" data-open="${esc(b.id)}">
        <span class="who"><b>${esc(b.name||"")}</b><small>${esc(fmtD(b.pickup))} → ${esc(fmtD(b.drop))} · ${L.c.days} day${L.c.days===1?"":"s"}${car?"":` · ${esc(c2.plate||"")}`}</small></span>
        <span class="amt num">${inr(L.total)}<br><small class="${L.balance>0&&EARNED.includes(b.status)?"err":"muted"}">${L.balance>0&&EARNED.includes(b.status)?`${inr(L.balance)} due`:`paid ${inr(L.settled)}`}</small></span>
        <span class="st"><span class="pill ${st.cls}">${st.label}</span></span>
      </button>`; }).join("") : `<div class="empty">No bookings in ${esc(R.rangeLabel)}.</div>`}</div>`;
}
function csvCell(v){ const s=String(v??""); return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; }
function exportRevenueCsv(){
  const R=revModel();
  const head=["Booking ID","Status","Car","Plate","Customer","Mobile","Pickup","Drop-off","Days","Daily rate","Rental","Delivery","Extra charges","Invoice total","Received","Balance","Security deposit","Invoice no."];
  const dt=s=>{ const d=new Date(s); return isNaN(d)?"":`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const rows=R.list.map(b=>{ const L=ledger(b), c=carOf(b)||{}; return [b.id,(STATUS[b.status]||{}).label||b.status,c.make_model||"",c.plate||"",b.name||"",b.phone||"",dt(b.pickup),dt(b.drop),L.c.days,Number(b.rate)||0,L.c.rental,L.c.delivery,L.extrasTotal,L.total,L.settled,L.balance,depShort(b).replace("₹",""),b.invoice?.no||""]; });
  const earned=R.list.filter(b=>EARNED.includes(b.status)); const T=sumUp(earned);
  rows.push([]); rows.push(["Total (trips started)","","","","","","","",T.days,"","","","",T.rev,T.rec,T.out,"",""]);
  const csv="﻿"+[head,...rows].map(r=>r.map(csvCell).join(",")).join("\r\n");
  const who = R.car ? (R.car.plate||"car").replace(/\s+/g,"") : "All-cars";
  return { filename:`DriveKaro-Revenue-${who}-${R.rangeLabel.replace(/\s+/g,"-")}.csv`, blob:new Blob([csv],{type:"text/csv"}) };
}

async function saveBooking(asDraft){
  const f=readForm();
  const errsFull=validate({...f,id:S.editId},true);
  const errsMin=validate({...f,id:S.editId},false);
  if(Object.keys(errsMin).length){ showFormErrors(errsMin); return; }
  const prev = S.editId ? S.bookings.find(x=>x.id===S.editId) : null;
  const car = S.fleet.find(c=>c.id===f.car_id);
  const complete = Object.keys(errsFull).length===0;
  let status = prev?.status || "draft";
  if(["draft","ready"].includes(status)) status = (!asDraft && complete) ? "ready" : "draft";
  const id = prev?.id || newId();
  const cust = await upsertCustomerFrom(f); if(cust) f.customer_id = cust.id;
  const doc = {...(prev||{}), ...f, phone: fmtPhone(f.phone), id, status,
    rate:f.rate===""?"":Number(f.rate), deposit:f.deposit===""?"":Number(f.deposit),
    car_snapshot: car ? {make_model:car.make_model, plate:car.plate, colour:car.colour||"", year:car.year||"", fuel:car.fuel||"", transmission:car.transmission||"", category:car.category||"", seats:car.seats||"", chassis_last5:car.chassis_last5||"", reg_type:car.reg_type||"", permit_no:car.permit_no||"", insurance_no:car.insurance_no||"", insurer:car.insurer||"", insurance_till:car.insurance_till||"", idv:car.idv||"", puc_till:car.puc_till||"", fastag:car.fastag||""} : (prev?.car_snapshot||null),
    created_at: prev?.created_at || new Date().toISOString(), updated_at:new Date().toISOString(),
    agreement_date: prev?.agreement_date || toLocalInput().slice(0,10), template_version:"2.0"};
  delete doc.example;
  if(!(await write("bookings/"+id, doc))) return;
  localUpsert(S.bookings, doc);
  S.editId=null; S.draft=null; S.view="bookings"; S.selected=id; S.detailTab=isMobile()?"overview":"agreement"; render(); window.scrollTo(0,0);
  toast(status==="ready" ? "Saved. Agreement is ready for signing." : `Saved as draft. ${Object.keys(errsFull).length} detail(s) still missing.`);
}
function showFormErrors(errs){
  S.draft=readForm();
  $("#main").innerHTML=viewForm(errs); updateSummary();
  const n=Object.keys(errs).length;
  $("#formerrs").innerHTML=`<div class="errors">Fix ${n} field${n>1?"s":""} before saving.</div>`;
  const first=document.querySelector('[aria-invalid="true"]'); if(first) first.focus();
}
async function setStatus(id,to){
  const b=S.bookings.find(x=>x.id===id); if(!b) return;
  const doc={...b,status:to,updated_at:new Date().toISOString(),[to+"_at"]:new Date().toISOString()};
  if(!(await write("bookings/"+id,doc))) return;
  localUpsert(S.bookings,doc); render(); toast(`Marked as ${STATUS[to].label.toLowerCase()}.`);
}
async function patchBooking(b, patch){
  const doc={...b, ...patch, updated_at:new Date().toISOString()};
  if(!(await write("bookings/"+b.id, doc))) return false;
  localUpsert(S.bookings, doc); render(); return true;
}
async function nextInvoiceNo(){
  const fy=fyOf(new Date());
  const seq = await S.db.nextInvoiceSeq(fy);
  return `DK/${fy}/${String(seq).padStart(4,"0")}`;
}
function summaryText(b){
  const car=carOf(b)||{}; const c=calc(b); const s=S.settings;
  return [`*${s.business_name} booking ${b.id}*`,`Name: ${b.name}`,`Car: ${car.make_model||""} (${car.plate||""})`,`Pickup: ${fmtDT(b.pickup)}`,`Drop-off: ${fmtDT(b.drop)}`,`Pickup point: ${b.location||s.designated_location}`,`Duration: ${durText(c)}`,`Rental: ${inr(c.rental)}`,...(c.delivery?[`Delivery: ${inr(c.delivery)}`]:[]),depType(b)==="cash"?`Refundable deposit: ${inr(c.deposit)}`:`Security deposit: ${depShort(b)} (returned after the trip)`,`Total before handover: ${inr(c.collected)}`,`Includes ${c.km} km. Extra ${money(b,"extra_km")}/km.`,`Please carry your original driving licence. Your rental agreement will come for Aadhaar eSign before pickup.`,`Questions: ${s.support_phone}`].join("\n");
}
function agreementText(b){
  const A=buildAgreement(b); const out=[`SELF-DRIVE VEHICLE RENTAL AGREEMENT`,`${S.settings.legal_name} | Agreement No. ${b.id} | Template v2.0`,""];
  for(const sec of A.sections){ out.push(sec.h.toUpperCase()); for(const blk of sec.body){ if(blk.t==="p") out.push(blk.text); else if(blk.t==="kv"){ if(blk.title) out.push(blk.title); blk.rows.forEach(r=>out.push(`${r[0]}: ${r[1]??"__________"}`)); } else blk.items.forEach((it,i)=>out.push(`${blk.t==="ol"?"("+String.fromCharCode(97+i)+")":"-"} ${it}`)); } if(sec.sig) sigParties(b,A).forEach(p=>out.push(`${p[0]}: ${p[1]}`)); out.push(""); }
  return out.join("\n");
}
async function copy(text, done){
  try{ await navigator.clipboard.writeText(text); toast(done); }
  catch(e){ const ta=document.createElement("textarea"); ta.value=text; ta.style.cssText="position:fixed;left:16px;right:16px;bottom:16px;height:40vh;z-index:20"; document.body.appendChild(ta); ta.focus(); ta.select(); toast("Press Ctrl+C / Copy, then tap outside to close."); ta.addEventListener("blur",()=>ta.remove()); }
}

document.addEventListener("click", async e=>{
  const t=e.target.closest("button"); if(!t) return;
  if(t.classList.contains("tab")){ const keepDraft = t.dataset.view==="new" && !S.editId; S.view=t.dataset.view; S.selected=null; S.carEdit=null; S.carView=null; S.custView=null; S.custEdit=null; S.confirmDelete=null; if(!keepDraft){ S.editId=null; S.draft=null; } render(); window.scrollTo(0,0); return; }
  if(t.dataset.pickcar){ pickCar(t.dataset.pickcar); return; }
  if(t.dataset.repcar){ S.repCar=t.dataset.repcar; S.view="revenue"; render(); return; }
  if(t.dataset.repmonth){ S.repMonth=t.dataset.repmonth; S.repRange="month"; render(); return; }
  if(t.dataset.reprange){ S.repRange=t.dataset.reprange; render(); return; }
  if(t.dataset.pickcust){ const c=custById(t.dataset.pickcust); if(c) applyCustomer(c); return; }
  if(t.dataset.webcust){ startNewCustomer(t.dataset.webcust, t.dataset.name, t.dataset.email); return; }
  if(t.dataset.newcust){ startNewCustomer(t.dataset.newcust); return; }
  if(t.dataset.custview){ if(t.dataset.keepdraft && !S.editId) S.draft=readForm(); S.view="customers"; S.custView=t.dataset.custview; S.custEdit=null; S.selected=null; S.confirmDoc=null; S.confirmCustDel=null; render(); window.scrollTo(0,0); return; }
  if(t.dataset.carview){ if(t.dataset.keepdraft && !S.editId) S.draft=readForm(); S.view="fleet"; S.carView=t.dataset.carview; S.carEdit=null; render(); window.scrollTo(0,0); return; }
  if(t.dataset.filter){ S.filter=t.dataset.filter; render(); return; }
  if(t.dataset.dtab){ S.detailTab=t.dataset.dtab; render(); return; }
  if(t.dataset.open){ S.view="bookings"; S.detailTab=isMobile()?"overview":"agreement"; S.confirmPay=null; S.confirmSettle=false; S.selected=t.dataset.open; S.confirmDelete=null; render(); window.scrollTo(0,0); return; }
  if(t.dataset.editcar){ S.carEdit=t.dataset.editcar; S.confirmCar=false; render(); return; }
  const act=t.dataset.act; if(!act) return;
  const b = S.selected ? S.bookings.find(x=>x.id===S.selected) : null;
  switch(act){
    case "new": S.editId=null; S.draft=null; S.view="new"; render(); break;
    case "back": S.selected=null; S.confirmDelete=null; render(); break;
    case "edit": S.editId=S.selected; S.draft=null; S.view="new"; render(); window.scrollTo(0,0); break;
    case "cancel-edit": S.view="bookings"; S.editId=null; S.draft=null; render(); break;
    case "save-draft": saveBooking(true); break;
    case "reset-charges": { const d=defaultCharges(); for(const [k] of CHARGE_FIELDS){ const el=$("#fc_"+k); if(el) el.value=d[k]??""; } updateSummary(); toast("Charges reset to your defaults."); break; }
    case "status": setStatus(S.selected,t.dataset.to); break;
    case "cancel-booking": setStatus(S.selected,"cancelled"); break;
    case "ask-delete": S.confirmDelete=S.selected; render(); break;
    case "keep": S.confirmDelete=null; render(); break;
    case "delete": { const id=S.selected; if(await remove("bookings/"+id)){ S.bookings=S.bookings.filter(x=>x.id!==id); S.selected=null; S.confirmDelete=null; render(); toast("Booking deleted."); } break; }
    case "copy-wa": if(b) copy(summaryText(b),"Booking summary copied. Paste it in WhatsApp."); break;
    case "rep-export": {
      try{ const {filename, blob}=exportRevenueCsv(); await S.downloads.save({filename, data:blob}); }
      catch(err){ if(err && err.code==="declined") break; toast("Couldn't export. Try again."); }
      break; }
    case "car-revenue": S.repCar=t.dataset.car; S.repRange="all"; S.view="revenue"; S.carView=null; render(); window.scrollTo(0,0); break;
    case "dep-return": { if(b && await patchBooking(b,{dep_returned_at: b.dep_returned_at ? "" : new Date().toISOString()})) toast(b.dep_returned_at?"Marked as not returned.":"Security marked returned."); break; }
    case "esign-send": {
      if(!b || S.esignBusy) break;
      if(b.esign?.document_id && !S.confirmResend){ S.confirmResend=true; toast("Tap again to send a new request. This uses Leegality credits again."); setTimeout(()=>S.confirmResend=false,6000); break; }
      S.confirmResend=false; S.esignBusy=true; render();
      try{
        const blob=buildPdf(b,{esign:true}); const pdfBase64=await blobToBase64(blob);
        const r=await api("/api/esign/send",{bookingId:b.id, pdfBase64});
        localUpsert(S.bookings, r.booking); S.detailTab=isMobile()?"overview":S.detailTab;
        toast("Sent for Aadhaar eSign. Share the link on WhatsApp.");
      }catch(err){ toast(err.message); }
      S.esignBusy=false; render(); break; }
    case "esign-refresh": {
      if(!b || S.esignBusy) break; S.esignBusy=true; render();
      try{ const r=await api("/api/esign/status",{bookingId:b.id}); localUpsert(S.bookings, r.booking); toast(r.booking.status==="signed"?"Signed by everyone.":"Status updated."); }
      catch(err){ toast(err.message); }
      S.esignBusy=false; render(); break; }
    case "esign-file": {
      if(!b) break;
      try{
        const r=await api("/api/esign/file",{bookingId:b.id, type:t.dataset.type});
        const f=await fetch(r.url); if(!f.ok) throw new Error("Download failed. Try again.");
        const blob=await f.blob(); const safe=(b.name||"customer").replace(/[^a-z0-9]+/gi,"-").replace(/^-|-$/g,"");
        await S.downloads.save({filename:`DriveKaro-${t.dataset.type==="audit"?"Audit-Trail":"Signed-Agreement"}-${b.id}-${safe}.pdf`, data:blob});
      }catch(err){ if(err && err.code==="declined") break; toast(err.message||"Download failed."); }
      break; }
    case "copy-signlink": copy(t.dataset.url, "Signing link copied."); break;
    case "mark-sent": { const id=($("#es_doc")?.value||"").trim(); if(await patchBooking(b,{status:"sent", sent_at:new Date().toISOString(), esign_doc_id:id})) toast("Marked as sent for eSign."); break; }
    case "quick-pay": { $("#p_kind").value=t.dataset.kind; $("#p_amount").value=t.dataset.amount; $("#p_amount").focus(); break; }
    case "add-pay": {
      const amt=Number($("#p_amount").value); const errBox=$("#payerr");
      if(!(amt>0)){ errBox.innerHTML=`<div class="err" style="margin-top:8px">Enter an amount above zero.</div>`; $("#p_amount").setAttribute("aria-invalid","true"); break; }
      const at=$("#p_at").value||toLocalInput();
      const entry={id:"p"+Date.now().toString(36), kind:$("#p_kind").value, amount:amt, mode:$("#p_mode").value, ref:$("#p_ref").value.trim(), at};
      const patch={payments:[...(b.payments||[]), entry]};
      if(entry.kind==="payment" && !b.paymode){ patch.paymode=entry.mode; patch.payref=entry.ref; }
      if(await patchBooking(b,patch)) toast(`${PAY_KINDS[entry.kind]}: ${inr(amt)} recorded.`);
      break; }
    case "ask-del-pay": S.confirmPay=t.dataset.id; render(); break;
    case "keep-pay": S.confirmPay=null; render(); break;
    case "del-pay": { S.confirmPay=null; if(await patchBooking(b,{payments:(b.payments||[]).filter(p=>p.id!==t.dataset.id)})) toast("Entry deleted."); break; }
    case "save-return": { if(await patchBooking(b,{odo_return:$("#r_odo").value.trim(), return_at:$("#r_at").value, fuel_return:$("#r_fuel").value})) toast("Return details saved."); break; }
    case "suggest-add": { const x={id:"x"+Date.now().toString(36), label:t.dataset.label, amount:Number(t.dataset.amount), note:t.dataset.note}; if(await patchBooking(b,{extras:[...(b.extras||[]),x]})) toast(`${x.label} added.`); break; }
    case "add-extra": {
      const amt=Number($("#x_amount").value);
      if(!(amt>0)){ $("#xerr").innerHTML=`<div class="err" style="margin-top:8px">Enter an amount above zero.</div>`; break; }
      const x={id:"x"+Date.now().toString(36), label:$("#x_label").value, amount:amt, note:$("#x_note").value.trim()};
      if(await patchBooking(b,{extras:[...(b.extras||[]),x]})) toast(`${x.label} added.`); break; }
    case "del-extra": { if(await patchBooking(b,{extras:(b.extras||[]).filter(x=>x.id!==t.dataset.id)})) toast("Charge removed."); break; }
    case "ask-settle": S.confirmSettle=true; render(); break;
    case "cancel-settle": S.confirmSettle=false; render(); break;
    case "do-settle": {
      S.confirmSettle=false; const use=Number(t.dataset.use), refund=Number(t.dataset.refund), at=toLocalInput();
      const mode=((b.payments||[]).filter(p=>p.kind==="deposit_in").slice(-1)[0]||{}).mode||"UPI";
      const add=[]; if(use>0) add.push({id:"p"+Date.now().toString(36)+"u", kind:"deposit_used", amount:use, mode:"Deposit", ref:"", at}); if(refund>0) add.push({id:"p"+Date.now().toString(36)+"r", kind:"deposit_refund", amount:refund, mode, ref:"", at});
      if(await patchBooking(b,{payments:[...(b.payments||[]),...add]})) toast("Deposit settled. Add the refund reference if you have it."); break; }
    case "gen-invoice": {
      t.disabled=true;
      try{ const no=await nextInvoiceNo(); if(await patchBooking(b,{invoice:{no, date:toLocalInput().slice(0,10)}})) toast(`Invoice ${no} generated.`); }
      catch(e){ toast("Couldn't generate the invoice number. Try again."); t.disabled=false; }
      break; }
    case "inv-pdf": {
      if(!b||!S.downloads) break;
      try{ const blob=invoicePdf(b); const safe=(b.invoice?.no||b.id).replace(/[^a-z0-9]+/gi,"-"); await S.downloads.save({filename:`DriveKaro-Invoice-${safe}.pdf`, data:blob}); }
      catch(err){ if(err && err.code==="declined") return; toast("Couldn't save the PDF here. Use Copy text instead."); }
      break; }
    case "copy-invoice": if(b) copy(invoiceText(b),"Invoice text copied."); break;
    case "copy-agreement": if(b) copy(agreementText(b),"Agreement text copied."); break;
    case "pdf": {
      if(!b||!S.downloads) break;
      try{ const blob=buildPdf(b); const safe=(b.name||"customer").replace(/[^a-z0-9]+/gi,"-").replace(/^-|-$/g,""); await S.downloads.save({filename:`DriveKaro-Agreement-${b.id}-${safe}.pdf`, data:blob}); }
      catch(err){ if(err && err.code==="declined") return; toast(err && err.code ? "Couldn't save the PDF here. Use Copy text instead." : "Couldn't build the PDF."); }
      break;
    }
    case "cust-change": clearCustomer(); break;
    case "cust-fields": { const f=$("#custfields"); f.hidden=!f.hidden; const bt=$("#cc_edit"); if(bt) bt.textContent=f.hidden?"Edit":"Hide details"; if(!f.hidden) $("#f_name").focus(); break; }
    case "add-customer": S.custEdit="new"; S.newCustPhone=""; render(); window.scrollTo(0,0); break;
    case "edit-cust": S.custEdit=S.custView; render(); window.scrollTo(0,0); break;
    case "close-cust": S.custView=null; render(); break;
    case "close-custform": S.custEdit=null; render(); break;
    case "book-cust": { const c=custById(t.dataset.cust); if(!c) break; const d={customer_id:c.id, phone:c.phone}; KYC_FIELDS.forEach(k=>{ if(c[k]) d[k]=c[k]; }); S.editId=null; S.draft=d; S.view="new"; S.custView=null; render(); window.scrollTo(0,0); break; }
    case "ask-del-cust": S.confirmCustDel=S.custView; render(); break;
    case "keep-cust": S.confirmCustDel=null; render(); break;
    case "del-cust": { const id=S.custView; if(await remove("customers/"+id)){ S.customers=S.customers.filter(x=>x.id!==id); S.custView=null; S.confirmCustDel=null; render(); toast("Customer deleted."); } break; }
    case "drive-connect": { connectDrive().then(()=>{ render(); toast("Google Drive connected."); }).catch(err=>toast(err.message)); break; }
    case "upload-doc": { const c=custById(S.custView); if(c) uploadDoc(c); break; }
    case "ask-del-doc": S.confirmDoc=t.dataset.id; render(); break;
    case "keep-doc": S.confirmDoc=null; render(); break;
    case "del-doc": { const c=custById(S.custView); if(c) removeDoc(c, t.dataset.id); break; }
    case "add-car": S.carEdit="new"; S.confirmCar=false; render(); break;
    case "close-car": S.carEdit=null; render(); break;
    case "close-carview": S.carView=null; render(); break;
    case "goto-fleet": S.draft=readForm(); S.view="fleet"; S.carView=null; S.carEdit="new"; render(); break;
    case "book-car": { const car=S.fleet.find(c=>c.id===t.dataset.car); S.editId=null; S.draft={car_id:car.id, rate:car.rate, deposit:car.deposit}; S.view="new"; S.carView=null; render(); window.scrollTo(0,0); break; }
    case "ask-del-car": S.confirmCar=true; render(); break;
    case "keep-car": S.confirmCar=false; render(); break;
    case "del-car": { const id=S.carEdit; if(await remove("fleet/"+id)){ S.fleet=S.fleet.filter(x=>x.id!==id); S.carEdit=null; S.confirmCar=false; render(); toast("Car removed."); } break; }
  }
});
document.addEventListener("input", e=>{
  if(e.target.id==="f_phone") onPhoneInput();
  if(e.target.id==="cust_q"){ S.custQuery=e.target.value; const l=$("#custlist"); if(l) l.innerHTML=custListHTML(); return; }
  if(e.target.id==="doc_type") S.docType=e.target.value;
  if(e.target.closest("#bform")) updateSummary();
});
document.addEventListener("focusin", e=>{ if(e.target.id==="f_phone") renderCustDropdown(); });
document.addEventListener("focusout", e=>{ if(e.target.id==="f_phone") setTimeout(()=>{ const dd=$("#custdd"); if(dd && document.activeElement!==$("#f_phone")) dd.hidden=true; },150); });
document.addEventListener("mousedown", e=>{ if(e.target.closest(".dd")) e.preventDefault(); });
document.addEventListener("keydown", e=>{ if(e.target.id==="f_phone" && e.key==="Enter"){ e.preventDefault(); const first=$("#custdd .dd-row"); if(first) first.click(); } if(e.key==="Escape"){ const dd=$("#custdd"); if(dd) dd.hidden=true; } });
document.addEventListener("change", e=>{
  if(e.target.id==="f_pickup"||e.target.id==="f_drop") refreshCarOptions();
  if(e.target.id==="f_deptype") showDepFields();
  if(e.target.id==="rep_month" && e.target.value){ S.repMonth=e.target.value; S.repRange="month"; render(); return; }
  if(e.target.id==="f_car"){ const car=S.fleet.find(c=>c.id===e.target.value); if(car){ const r=$("#f_rate"), d=$("#f_deposit"); if(r && (!r.value || r.dataset.auto)){ r.value=car.rate||""; r.dataset.auto="1"; } if(d && (!d.value || d.dataset.auto)){ d.value=car.deposit??""; d.dataset.auto="1"; } } }
  if(e.target.id==="f_rate"||e.target.id==="f_deposit") delete e.target.dataset.auto;
  if(e.target.closest("#bform")) updateSummary();
});
document.addEventListener("submit", async e=>{
  e.preventDefault();
  if(e.target.id==="bform"){ saveBooking(false); }
  else if(e.target.id==="custform"){ saveCustomerForm(); }
  else if(e.target.id==="cform"){
    const v=id=>($("#"+id)?.value??"").trim();
    const make=v("c_make"), plate=v("c_plate").toUpperCase().replace(/\s+/g," "), rate=v("c_rate");
    const errs=[]; if(!make) errs.push("Enter the make and model."); if(!plate) errs.push("Enter the registration number."); if(!(Number(rate)>0)) errs.push("Enter the daily rate.");
    const dup=S.fleet.find(c=>c.plate.replace(/\s/g,"")===plate.replace(/\s/g,"") && c.id!==S.carEdit); if(dup) errs.push("A car with this registration number already exists.");
    if(errs.length){ $("#carerr").innerHTML=`<div class="errors" style="margin-bottom:12px"><ul>${errs.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div>`; return; }
    const prev=S.carEdit==="new"?null:S.fleet.find(c=>c.id===S.carEdit);
    const id=prev?.id || plate.replace(/[^A-Z0-9]/g,"");
    const doc={...(prev||{}), id, make_model:make, plate, chassis_last5:v("c_chassis").toUpperCase(), category:v("c_cat"), colour:v("c_colour"), year:v("c_year"), fuel:v("c_fuel"), transmission:v("c_trans"), seats:v("c_seats"), fastag:v("c_fastag"),
      reg_type:v("c_regtype"), permit_no:v("c_permit"), insurance_no:v("c_ins"), insurer:v("c_insurer"), insurance_till:v("c_ins_till"), idv:v("c_idv")?Number(v("c_idv")):"", puc_till:v("c_puc"),
      rate:Number(rate), deposit:Number(v("c_dep")||0), active:v("c_active")!=="no"};
    delete doc.example;
    if(!(await write("fleet/"+id,doc))) return;
    localUpsert(S.fleet,doc); S.carEdit=null; S.carView=id; render(); toast("Car saved.");
  }
  else if(e.target.id==="sform"){
    const v=id=>($("#"+id)?.value??"").trim(); const n=id=>Number(v(id))||0;
    const doc={...S.settings, legal_name:v("s_legal")||DEFAULT_SETTINGS.legal_name, signatory:v("s_sign"), shop_act:v("s_shop"), udyam:v("s_udyam"),
      support_phone:v("s_phone"), support_email:v("s_email"), grievance_email:v("s_griev"), official_upi:v("s_upi"), official_bank:v("s_bank"), address:v("s_address"), designated_location:v("s_loc"),
      non_return_hours:n("s_nonret"), unreachable_hours:n("s_unreach"), return_inspection_hours:n("s_retinsp"), emergency_repair_limit:n("s_repair"), late_interest:n("s_interest"), tracking_retention_days:n("s_track"), fast_track_limit:n("s_fast"),
      min_age:n("s_age"), min_age_premium:n("s_age2"), dl_min_months:n("s_dlm"), charges:readCharges("sc_")};
    if(!(await write("settings/business",doc))) return;
    S.settings=doc; toast("Settings saved.");
  }
});

boot();

})();
