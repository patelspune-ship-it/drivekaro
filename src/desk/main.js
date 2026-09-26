// DriveKaro booking desk (drivekaro.in/desk).
// Same workflow as the prototype: fleet profiles, car-first bookings, auto-filled
// rental agreement (template v2.0), payments, invoices and WhatsApp messages.
import { supabase } from "../supabaseClient.js";
import { jsPDF } from "jspdf";
import { createStore } from "./store.js";

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
  ["deductible","Deductible per incident (₹)","money","What the customer pays per accident"],
  ["loss_of_use_per_day","Loss of use (₹ per day)","money","0 = not charged"],
  ["loss_of_use_max_days","Loss of use, max days","num",""],
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
  deductible:10000, loss_of_use_per_day:0, loss_of_use_max_days:7,
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
  fleet:[], bookings:[], settings:JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
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
  const rate=Number(b.rate)||0, dep=Number(b.deposit)||0, delivery=Number(b.with_delivery? ch(b,"delivery_charge"):0)||0;
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
    const file=new File([data], filename, {type:"application/pdf"});
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
  db.collection("bookings").onSnapshot(snap=>{ S.bookings = snap.docs.map(d=>({id:d.id,...d.data()})); softRender(); }, onErr);
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
function softRender(){ if(["new","settings"].includes(S.view) || S.carEdit){ refreshCarOptions(); updateSummary(); return; } render(); }
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
  const dep = b.deposit!==""&&b.deposit!=null ? inr(b.deposit) : null;
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
      '"Deductible" means the amount per incident stated in Schedule III that the Hirer pays towards damage to or loss of the Vehicle in an incident that is not an Excluded Event.',
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
    {t:"p", text:"3.4 Only an Authorised Driver may drive the Vehicle. The Hirer and each Additional Driver are jointly and severally liable under this Agreement, and any act or omission of an Additional Driver is treated as the act or omission of the Hirer."},
    {t:"p", text:"3.5 DriveKaro may refuse or stop handover if verification cannot be completed, a document appears altered or does not match the person, or an Authorised Driver appears unfit to drive. DriveKaro will then refund all Charges and the Security Deposit paid, except where the refusal is due to a forged document or false information."}
  ]});
  T.push({h:"4. Charges, Security Deposit and Payment", body:[
    {t:"p", text:"4.1 The Hirer shall pay the Rental Charges and other Charges stated in Schedule III. Rental Charges and the Security Deposit are payable in full before handover unless Schedule III states otherwise."},
    {t:"p", text:"4.2 Rental Charges are calculated in blocks of 24 hours from the Start Time. A part block is charged as stated in Schedule III."},
    {t:"p", text:"4.3 The Rental Charges include the kilometre allowance stated in Schedule III. Distance beyond the allowance is charged at the excess kilometre rate in Schedule III, measured by the odometer readings in the Handover Record and the Return Record. If the odometer is faulty or has been tampered with, the distance recorded by the Tracking Device is used."},
    {t:"p", text:"4.4 The fixed charges in Schedule III for late return, fuel shortfall, cleaning, night handling, lost keys or documents and similar matters are a genuine pre-estimate of the loss DriveKaro is likely to suffer from each event and are not penalties. They do not cover damage to or loss of the Vehicle, which is dealt with in clause 10."},
    {t:"p", text:"4.5 Where DriveKaro pays any toll, fine, fuel, inter-state tax, permit fee or other amount that is the Hirer's responsibility, the Hirer shall reimburse it on demand together with the processing charge stated in Schedule III."},
    {t:"p", text:"4.6 DriveKaro is not registered under the Goods and Services Tax laws on the date of this Agreement and does not charge GST. If DriveKaro becomes registered, GST at the applicable rate shall be payable in addition to the Charges for bookings made after registration, and DriveKaro shall issue a tax invoice. DriveKaro shall issue a receipt for every amount collected."},
    {t:"p", text:"4.7 The Security Deposit is interest-free and is held as security for the Hirer's obligations. It is not a limit on the Hirer's liability. After return of the Vehicle, DriveKaro shall refund the Security Deposit, less amounts due under this Agreement, within the period stated in Schedule III. DriveKaro may hold back the amount stated in Schedule III as the Challan Holdback for up to the period stated there, to cover traffic challans and tolls that are notified after return, and shall then refund any unused balance."},
    {t:"p", text:`4.8 DriveKaro shall give the Hirer an itemised statement of any deduction, with supporting photographs, invoices or challan copies. The Hirer may dispute a deduction in writing within 7 days of receiving the statement. Any amount due in excess of the Security Deposit is payable within 7 days of the statement; unpaid amounts carry simple interest at ${s.late_interest} per cent per annum from the due date until payment.`},
    {t:"p", text:"4.9 Payments are valid only when made to DriveKaro's official bank account or UPI ID stated in Schedule III, or in cash against a DriveKaro receipt. A payment made to any other account or person does not discharge the Hirer."}
  ]});
  T.push({h:"5. Handover and Inspection", body:[
    {t:"p", text:"5.1 DriveKaro shall hand over the Vehicle at the Designated Location to an Authorised Driver in person, on production of the original driving licence."},
    {t:"p", text:"5.2 Before handover, the Parties shall inspect the Vehicle together. DriveKaro shall record the odometer reading, fuel or charge level, keys, accessories and all existing damage in the Handover Record, and shall share the time-stamped photographs and video with the Hirer before the keys are handed over."},
    {t:"p", text:"5.3 The Hirer shall point out any damage or defect not recorded before accepting the Vehicle. On acceptance, the Vehicle is treated as received in the condition shown in the Handover Record, except for defects that a reasonable inspection could not have revealed."},
    {t:"p", text:"5.4 DriveKaro shall provide the Vehicle Documents in the Vehicle, in physical form or through DigiLocker or mParivahan. The Hirer shall keep them safe and return them with the Vehicle."},
    {t:"p", text:"5.5 DriveKaro is not required to hand over the Vehicle until this Agreement has been signed by both Parties, the Charges and Security Deposit due before handover have been paid, and verification under clause 3 is complete."}
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
    {t:"p", text:"6.4 Any breach of this clause 6 is a material breach of this Agreement."}
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
    {t:"p", text:`8.3 DriveKaro may use the immobiliser function only where: (a) the Vehicle has not been returned within ${s.non_return_hours} hours after the End Time without a confirmed extension and the Hirer cannot be reached; (b) DriveKaro reasonably believes the Vehicle has been stolen or is being driven by a person who is not an Authorised Driver; or (c) the Vehicle has been taken outside the Permitted Territory. DriveKaro shall first try to contact the Hirer where practicable, and shall use the function only in a way that stops the engine from restarting once switched off, never while the Vehicle is moving.`}
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
    {t:"p", text:"9.3 Towing, repair and loss-of-use costs of a breakdown caused by the Hirer's misuse, including wrong fuel, running out of fuel, ignoring warning lights or driving through water, are payable by the Hirer."}
  ]});
  T.push({h:"10. Insurance and Liability for Damage or Loss", body:[
    {t:"p", text:"10.1 DriveKaro shall keep the Vehicle covered throughout the Booking Period by a comprehensive motor insurance policy covering own damage, theft and third-party liability as required by the Motor Vehicles Act, 1988. The policy number and validity are stated in Schedule II. The Hirer shall do nothing that gives the insurer grounds to refuse a claim, and shall give true and complete information to the police, the insurer and its surveyor."},
    {t:"p", text:"10.2 Claims by third parties for death, bodily injury or property damage arising from the use of the Vehicle shall be handled under that policy. The Hirer shall cooperate fully in the defence of any such claim."},
    {t:"p", text:"10.3 For damage to or loss of the Vehicle in an incident that is not an Excluded Event, the Hirer's liability is limited to:"},
    {t:"ol", items:[
      "the Deductible for each incident;",
      "damage the policy does not cover, being damage to tyres and wheels not caused in an insured accident, interior damage from spills, burns or stains, and loss of or damage to keys, Vehicle Documents and accessories;",
      "the loss-of-use charge stated in Schedule III for each day the Vehicle is off the road for repair, up to the maximum number of days stated there; and",
      "where DriveKaro, acting reasonably, does not make an insurance claim because the repair cost is less than the Deductible, the actual repair cost up to the Deductible."
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
    {t:"p", text:"10.6 If the Vehicle is stolen or declared a total loss in an incident that is not an Excluded Event, the Hirer shall pay only the Deductible and any Charges due up to the date of the incident, provided the Hirer has complied with clause 9.1."},
    {t:"p", text:"10.7 Repairs shall be carried out at an authorised or reputable workshop. DriveKaro shall give the Hirer a copy of the estimate or invoice and the photographs relied on. The Hirer may, at the Hirer's cost, have the damage inspected by an independent surveyor within 3 days of being notified."},
    {t:"p", text:"10.8 The Vehicle's insurance may not cover personal accident for the Hirer or passengers, or personal belongings. DriveKaro is not liable for loss of belongings left in the Vehicle, except where caused by DriveKaro's own negligence."}
  ]});
  T.push({h:"11. Traffic Offences, Tolls and Seizure", body:[
    {t:"p", text:"11.1 The Hirer is responsible for all traffic challans, fines, penalties, compounding fees, tolls, parking charges and inter-state taxes or permit fees relating to the Vehicle during the Booking Period, including those notified after the Vehicle is returned."},
    {t:"p", text:"11.2 DriveKaro shall send the Hirer a copy of each challan it receives. The Hirer shall pay it within 7 days and send proof, failing which DriveKaro may pay it and recover the amount under clause 4.5, including from the Challan Holdback. The Hirer consents to DriveKaro giving the Authorised Driver's name, address and licence details to any authority entitled to them, including under section 133 of the Motor Vehicles Act, 1988, and shall attend any court or authority where required."},
    {t:"p", text:"11.3 Tolls paid through the FASTag fitted to the Vehicle are recoverable from the Hirer at the amount deducted."},
    {t:"p", text:"11.4 If the Vehicle is detained, seized or impounded by any authority during the Booking Period because of an act or omission of an Authorised Driver, the Hirer shall inform DriveKaro within 1 hour, take all steps to secure its release, and pay all fines, release charges, towing and storage costs and the loss-of-use charge in Schedule III for each day until release. If the seizure is caused by a defect in the Vehicle Documents or any failure of DriveKaro, DriveKaro shall bear those costs and refund the Rental Charges for the lost period."}
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
    {t:"p", text:"13.1 The Hirer may cancel the booking before the Start Time, and refunds of the Rental Charges are made as stated in Schedule III. If the Vehicle is not handed over, the Security Deposit is refunded in full."},
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
      ["Deductible per incident", money(b,"deductible")],
      ["Loss-of-use charge", Number(ch(b,"loss_of_use_per_day"))>0 ? `${money(b,"loss_of_use_per_day")} per day, up to ${ch(b,"loss_of_use_max_days")} days` : "Not charged"],
      ["Lost key", money(b,"lost_key")],
      ["Lost Vehicle Document", money(b,"lost_doc")],
      ["Tracking Device tampering", money(b,"gps_tamper")],
      ["Processing charge for challans and tolls paid by DriveKaro", `${money(b,"challan_fee")} per item`],
      ["Challan Holdback", `${money(b,"challan_holdback")} for up to ${ch(b,"challan_days")} days`],
      ["Security Deposit refund", `Within ${ch(b,"deposit_refund_days")} days of return`],
      ["Restricted areas", V(ch(b,"restricted_areas"))],
      ["Cancellation by Hirer", V(ch(b,"cancellation_terms"))]
    ]}
  ]});
  T.push({h:"Schedule IV: Return Record", body:[
    {t:"p", text:"Completed at return: return date and time, odometer and distance driven, excess kilometres, fuel level, new damage, missing items, cleaning condition, known challans or tolls, deductions with reasons, final amount refunded or payable, photo and video reference, and the Hirer's acknowledgement or objection."}
  ]});
  T.push({h:"Schedule V: Declaration and Signatures", sig:true, body:[
    {t:"p", text:`I, ${b.name||"________"}, the Hirer, confirm that I have read this Agreement and its Schedules in full; that the information and documents I have given are true; that I${hasAddl?" and the Additional Driver":""} meet the requirements of clause 3.1; that I have inspected the Vehicle and accept the Handover Record; that I consent to tracking under clause 8 and to the use of my data under clause 16; and that I sign voluntarily.`},
    {t:"p", text:"No signed Agreement, no handover."}
  ]});
  return {sections:T, car, calc:c, hasAddl};
}

function sigParties(b, A){
  const s=S.settings;
  const out=[["HIRER", `Aadhaar eSign by ${b.name||"________"}`]];
  if(A.hasAddl) out.push(["ADDITIONAL DRIVER", `Aadhaar eSign by ${b.addl_name}`]);
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
function buildPdf(b){
  const {jsPDF} = window.jspdf; const doc=new jsPDF({unit:"mm",format:"a4"});
  const s=S.settings, A=buildAgreement(b);
  const W=210, M=18, CW=W-2*M; let y=M;
  const ensure = hNeed => { if(y+hNeed>297-18){ doc.addPage(); y=M; } };
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
  for(let i=1;i<=n;i++){ doc.setPage(i); doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(120); doc.text(pdfSafe(`${s.legal_name} | ${s.support_phone} | Agreement ${b.id}`),M,297-9); doc.text(`Page ${i} of ${n}`,W-M,297-9,{align:"right"}); doc.setTextColor(0); }
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
  need("pickup","Set the pickup date and time.");
  need("drop","Set the drop-off date and time.");
  if(b.pickup && b.drop && new Date(b.drop)<=new Date(b.pickup)) e.drop="Drop-off must be after pickup.";
  if(b.rate!=="" && b.rate!=null && !(Number(b.rate)>0)) e.rate="Enter the daily rate.";
  if(forReady){
    need("father","Needed for the agreement.");
    need("dob","Needed to check the age rule.");
    need("address","Needed for the agreement.");
    need("aadhaar4","Enter the last 4 digits of the ID.");
    need("dl","Enter the licence number.");
    need("dl_till","Enter the licence expiry date.");
    need("emergency","Add an emergency contact.");
    need("rate","Enter the daily rate.");
    if(b.deposit===""||b.deposit==null) e.deposit="Enter the security deposit.";
    if((b.addl_name||"").trim()){ need("addl_dl","Enter the additional driver's licence number."); need("addl_dl_till","Enter the licence expiry date."); need("addl_dob","Needed to check the age rule."); }
  }
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
    else if(!car.insurance_no || ins.missing) e.car_id=`Add ${car.plate}'s insurance details in its fleet profile.`;
  }
  return e;
}

/* ---------- views ---------- */
function setTabs(){ document.querySelectorAll(".tab").forEach(t=>t.setAttribute("aria-current", t.dataset.view===S.view?"page":"false")); }
function render(){
  setTabs();
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
const EXTRA_LABELS = ["Extra kilometres","Late return","Fuel shortfall","Extra cleaning","Night handling","Traffic challan / toll","Damage (deductible)","Lost key or document","Other"];
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
  if(Number(b.deposit)>0 && L.depIn<Number(b.deposit)) quick.push(`<button type="button" class="btn sm" data-act="quick-pay" data-kind="deposit_in" data-amount="${Number(b.deposit)-L.depIn}">Deposit ${inr(Number(b.deposit)-L.depIn)}</button>`);
  const use=Math.min(L.depHeld, Math.max(L.balance,0)), refund=L.depHeld-use;
  return `
  <div class="money">
    <div class="tile"><span class="label">Invoice total</span><b class="num">${inr(L.total)}</b><small>${L.extras.length?`incl. ${inr(L.extrasTotal)} extra charges`:"rental"+(L.c.delivery?" + delivery":"")}</small></div>
    <div class="tile"><span class="label">Paid</span><b class="num">${inr(L.settled)}</b><small>${L.depUsed?`incl. ${inr(L.depUsed)} from deposit`:"&nbsp;"}</small></div>
    <div class="tile ${L.balance>0?"t-bad":"t-ok"}"><span class="label">${L.balance<0?"Excess paid":"Balance due"}</span><b class="num">${inr(Math.abs(L.balance))}</b><small>${L.balance>0?"to collect":L.balance<0?"refund to customer":"paid in full"}</small></div>
    <div class="tile"><span class="label">Deposit held</span><b class="num">${inr(L.depHeld)}</b><small>${L.depIn?`of ${inr(L.depIn)} received`:"not received yet"}</small></div>
  </div>
  ${["signed","ready","sent"].includes(b.status) && due ? `<p class="note">Collect before handover: <b>${inr(due)}</b> (rental ${inr(L.c.rental+L.c.delivery)} + deposit ${inr(L.c.deposit)}).</p>`:""}

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
          <dt>Deposit</dt><dd>${inr(c.deposit)}</dd>
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
        <div><div class="label">Agreement preview · v2.0</div>${missing.length?`<div class="warnline">${missing.length} thing${missing.length>1?"s":""} to fix before signing (see Next step)</div>`:`<div class="muted" style="font-size:13px">All details filled</div>`}</div>
        <div class="actions">${canDownload?`<button class="btn sm" data-act="pdf">Save PDF</button>`:""}<button class="btn sm" data-act="copy-agreement">Copy text</button></div>
      </div>
      <article class="paper">${agreementHTML(b)}</article>`}
    </div>
  </div>`;
}
function nextStep(b, missing){
  if(b.status==="draft") return `<p style="margin:0 0 10px;font-size:14px">Fill the missing details to make the agreement ready for signing.</p><button class="btn primary" data-act="edit">Complete details</button>`;
  if(b.status==="ready") return `<p style="margin:0 0 10px;font-size:14px">Send the agreement to ${esc(b.name)} for Aadhaar OTP signing.</p><div class="actions">${S.downloads&&window.jspdf?`<button class="btn" data-act="pdf">Save agreement PDF</button>`:""}</div>
    <p class="note" style="margin:10px 0">Upload this PDF in your Leegality dashboard with ${esc(b.name)} and yourself as signers. Then record it here.</p>
    ${fieldHTML("es_doc","Leegality document ID (optional)",b.esign_doc_id||"")}
    <div class="actions" style="margin-top:10px"><button class="btn primary" data-act="mark-sent">Mark as sent for eSign</button></div>`;
  if(b.status==="sent") return `<p style="margin:0 0 10px;font-size:14px">Waiting for signatures${b.esign_doc_id?` on Leegality document ${esc(b.esign_doc_id)}`:""}. Mark it signed only after Leegality shows every signer as signed and you have the signed PDF.</p><div class="actions"><button class="btn primary" data-act="status" data-to="signed">Mark as signed</button><button class="btn" data-act="status" data-to="ready">Back to ready</button></div>`;
  if(b.status==="signed") return `<p style="margin:0 0 10px;font-size:14px">Check the original DL, take handover photos, record odometer and fuel, then hand over the keys.</p><button class="btn primary" data-act="status" data-to="handed">Mark car handed over</button>`;
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
  car_id:"f_car",pickup:"f_pickup",drop:"f_drop",location:"f_location",rate:"f_rate",deposit:"f_deposit",paymode:"f_paymode",payref:"f_payref",
  odo:"f_odo",fuel:"f_fuel",keys:"f_keys",ext_damage:"f_ext",int_damage:"f_int",notes:"f_notes"};

function viewForm(errs={}){
  const b = S.draft || (S.editId ? (S.bookings.find(x=>x.id===S.editId)||{}) : {});
  const g=k=>b[k]??"";
  const charges = {...defaultCharges(), ...(b.charges||{})};
  const sub = t => `<span class="muted" style="font:400 13px var(--f-body)">${t}</span>`;
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
          ${fieldHTML("f_deposit","Security deposit (₹)",g("deposit"),{type:"number",err:errs.deposit,attrs:'min="0" step="500" inputmode="numeric"',hint:"Fills from the car."})}
        </div>
        <details class="more" ${b.charges?"open":""}>
          <summary>Other charges: km, late fee, cleaning, deductible and more</summary>
          <p class="note" style="margin:10px 0 12px">Filled from your default charges. Changes here print in Schedule III of this booking's agreement only. <button type="button" class="btn sm" data-act="reset-charges" style="margin-left:6px">Reset to defaults</button></p>
          <div class="grid">${chargeFieldsHTML("fc_", charges)}</div>
        </details>
      </fieldset>
      <fieldset><legend>4 · Customer</legend><div class="grid">
        ${fieldHTML("f_name","Full name (as on licence)",g("name"),{req:1,err:errs.name,attrs:'autocomplete="off"'})}
        ${fieldHTML("f_father","Father's / spouse's name",g("father"),{err:errs.father})}
        ${fieldHTML("f_dob","Date of birth",g("dob"),{type:"date",err:errs.dob})}
        ${fieldHTML("f_phone","Mobile",g("phone"),{req:1,type:"tel",err:errs.phone,attrs:'inputmode="tel" placeholder="98220 12345"'})}
        ${fieldHTML("f_alt","Alternate mobile",g("alt_phone"),{type:"tel",err:errs.alt_phone,attrs:'inputmode="tel"'})}
        ${fieldHTML("f_email","Email",g("email"),{type:"email",err:errs.email})}
        ${fieldHTML("f_address","Permanent address",g("address"),{type:"textarea",wide:1,err:errs.address})}
        ${fieldHTML("f_emergency","Emergency contact (name, relation, number)",g("emergency"),{wide:1,err:errs.emergency})}
      </div></fieldset>
      <fieldset><legend>5 · Licence and ID</legend><div class="grid">
        ${fieldHTML("f_dl","Driving licence number",g("dl"),{err:errs.dl,attrs:'placeholder="MH12 20200012345" style="text-transform:uppercase"'})}
        ${fieldHTML("f_dl_till","Licence valid till",g("dl_till"),{type:"date",err:errs.dl_till})}
        ${fieldHTML("f_rto","Issuing RTO",g("rto"),{attrs:'placeholder="Pune (MH12)"'})}
        ${selectHTML("f_idtype","Photo ID type",g("id_type")||IDTYPES[0],IDTYPES.map(x=>[x,x]))}
        ${fieldHTML("f_aadhaar4","ID number, last 4 digits",g("aadhaar4"),{err:errs.aadhaar4,hint:"Only the last 4. The full Aadhaar is entered by the customer on the eSign page.",attrs:'inputmode="numeric" maxlength="4"'})}
      </div></fieldset>
      <fieldset><legend>6 · Additional driver ${sub("(leave blank if none)")}</legend><div class="grid">
        ${fieldHTML("f_addl_name","Full name",g("addl_name"))}
        ${fieldHTML("f_addl_dob","Date of birth",g("addl_dob"),{type:"date",err:errs.addl_dob})}
        ${fieldHTML("f_addl_phone","Mobile",g("addl_phone"),{type:"tel",err:errs.addl_phone})}
        ${fieldHTML("f_addl_dl","Driving licence number",g("addl_dl"),{err:errs.addl_dl,attrs:'style="text-transform:uppercase"'})}
        ${fieldHTML("f_addl_dl_till","Licence valid till",g("addl_dl_till"),{type:"date",err:errs.addl_dl_till})}
      </div></fieldset>
      <fieldset><legend>7 · Payment and handover ${sub("(can be filled at pickup)")}</legend><div class="grid">
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
      <p class="note" style="margin:12px 0 0">A booking with every detail filled becomes <b>Agreement ready</b>. Missing details keep it as a draft.</p>
    </aside>
  </form>`;
}
function readForm(){
  const o={}; for(const k in FORM_MAP){ o[k]=($("#"+FORM_MAP[k])?.value??"").trim(); }
  o.dl=o.dl.toUpperCase(); o.addl_dl=o.addl_dl.toUpperCase();
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
    <dt>Deposit</dt><dd>${b.deposit!==""?inr(b.deposit):"—"}</dd>
    <dt class="total">Collect before handover</dt><dd class="total">${c.days&&b.rate?inr(c.collected):"—"}</dd>
    <dt>Km included</dt><dd>${c.km?c.km+" km":"—"}</dd>
    <dt>Extra km</dt><dd>${money(b,"extra_km")}/km</dd>
    <dt>Deductible</dt><dd>${money(b,"deductible")}</dd>`;
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
    <div class="actions"><button class="btn" data-editcar="${esc(c.id)}">Edit car</button><button class="btn primary" data-act="book-car" data-car="${esc(c.id)}">New booking with this car</button></div>
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
  const doc = {...(prev||{}), ...f, id, status,
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
  return [`*${s.business_name} booking ${b.id}*`,`Name: ${b.name}`,`Car: ${car.make_model||""} (${car.plate||""})`,`Pickup: ${fmtDT(b.pickup)}`,`Drop-off: ${fmtDT(b.drop)}`,`Pickup point: ${b.location||s.designated_location}`,`Duration: ${durText(c)}`,`Rental: ${inr(c.rental)}`,...(c.delivery?[`Delivery: ${inr(c.delivery)}`]:[]),`Refundable deposit: ${inr(c.deposit)}`,`Total before handover: ${inr(c.collected)}`,`Includes ${c.km} km. Extra ${money(b,"extra_km")}/km.`,`Please carry your original driving licence. Your rental agreement will come for Aadhaar eSign before pickup.`,`Questions: ${s.support_phone}`].join("\n");
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
  if(t.classList.contains("tab")){ const keepDraft = t.dataset.view==="new" && !S.editId; S.view=t.dataset.view; S.selected=null; S.carEdit=null; S.carView=null; S.confirmDelete=null; if(!keepDraft){ S.editId=null; S.draft=null; } render(); window.scrollTo(0,0); return; }
  if(t.dataset.pickcar){ pickCar(t.dataset.pickcar); return; }
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
document.addEventListener("input", e=>{ if(e.target.closest("#bform")) updateSummary(); });
document.addEventListener("change", e=>{
  if(e.target.id==="f_pickup"||e.target.id==="f_drop") refreshCarOptions();
  if(e.target.id==="f_car"){ const car=S.fleet.find(c=>c.id===e.target.value); if(car){ const r=$("#f_rate"), d=$("#f_deposit"); if(r && (!r.value || r.dataset.auto)){ r.value=car.rate||""; r.dataset.auto="1"; } if(d && (!d.value || d.dataset.auto)){ d.value=car.deposit??""; d.dataset.auto="1"; } } }
  if(e.target.id==="f_rate"||e.target.id==="f_deposit") delete e.target.dataset.auto;
  if(e.target.closest("#bform")) updateSummary();
});
document.addEventListener("submit", async e=>{
  e.preventDefault();
  if(e.target.id==="bform"){ saveBooking(false); }
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
