import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Car, Menu, X, ArrowRight, ArrowUpRight, Calendar, MapPin, Users, Fuel,
  Settings, Star, Plus, Search, Filter, Download, Edit3, Trash2, Eye,
  TrendingUp, IndianRupee, Activity, CheckCircle2, Clock, AlertCircle,
  FileText, Receipt, BarChart3, LayoutGrid, Wrench, Bell, LogOut,
  ChevronRight, Cog, Shield, Zap, Award, Phone, Mail, ChevronDown,
  CreditCard, Lock, Sparkles, Gauge, Sliders
} from "lucide-react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

import { supabase } from './supabaseClient';

/* ========================== DESIGN SYSTEM ========================== */
const COLORS = {
  bg: "#1a130c",
  surface: "#241b12",
  surfaceAlt: "#2e2318",
  border: "#3a2d20",
  borderBright: "#4d3d2c",
  ink: "#f5e9d2",
  inkMuted: "#b8a484",
  accent: "#c1272d",   // electric lime — racing
  accentDim: "#9f1f24",
  warn: "#ff7a45",
  ok: "#4ade80",
};

/* ========================== MOCK DATA ========================== */
const FLEET = [
  { id: "DK-01", brand: "Mahindra", model: "Thar ROXX", year: 2024, category: "SUV", seats: 5, transmission: "Manual", fuel: "Diesel", pricePerDay: 4500, status: "available", plate: "MH15 KR 0001", odometer: 12450, rating: 4.9, trips: 42, gradient: "from-orange-900/40 via-red-900/30 to-zinc-900" },
  { id: "DK-02", brand: "Hyundai", model: "Creta", year: 2024, category: "SUV", seats: 5, transmission: "Automatic", fuel: "Petrol", pricePerDay: 3200, status: "rented", plate: "MH15 KR 0002", odometer: 8930, rating: 4.8, trips: 31, gradient: "from-blue-900/40 via-indigo-900/30 to-zinc-900" },
  { id: "DK-03", brand: "Toyota", model: "Innova Crysta", year: 2023, category: "MPV", seats: 7, transmission: "Manual", fuel: "Diesel", pricePerDay: 3800, status: "available", plate: "MH15 KR 0003", odometer: 24100, rating: 4.7, trips: 67, gradient: "from-stone-800/50 via-zinc-800/40 to-zinc-900" },
  { id: "DK-04", brand: "Maruti Suzuki", model: "Swift", year: 2024, category: "Hatchback", seats: 5, transmission: "Manual", fuel: "Petrol", pricePerDay: 1500, status: "available", plate: "MH15 KR 0004", odometer: 5400, rating: 4.6, trips: 89, gradient: "from-rose-900/30 via-pink-900/20 to-zinc-900" },
  { id: "DK-05", brand: "Honda", model: "City", year: 2023, category: "Sedan", seats: 5, transmission: "Automatic", fuel: "Petrol", pricePerDay: 2800, status: "maintenance", plate: "MH15 KR 0005", odometer: 31200, rating: 4.5, trips: 54, gradient: "from-cyan-900/30 via-teal-900/20 to-zinc-900" },
  { id: "DK-06", brand: "Kia", model: "Seltos", year: 2024, category: "SUV", seats: 5, transmission: "Automatic", fuel: "Petrol", pricePerDay: 3400, status: "rented", plate: "MH15 KR 0006", odometer: 7800, rating: 4.8, trips: 28, gradient: "from-violet-900/30 via-purple-900/20 to-zinc-900" },
  { id: "DK-07", brand: "Tata", model: "Nexon EV", year: 2024, category: "Electric", seats: 5, transmission: "Automatic", fuel: "Electric", pricePerDay: 2900, status: "available", plate: "MH15 KR 0007", odometer: 4200, rating: 4.9, trips: 19, gradient: "from-lime-900/30 via-emerald-900/20 to-zinc-900" },
  { id: "DK-08", brand: "BMW", model: "3 Series", year: 2023, category: "Luxury", seats: 5, transmission: "Automatic", fuel: "Petrol", pricePerDay: 8500, status: "available", plate: "MH15 KR 0008", odometer: 14600, rating: 5.0, trips: 22, gradient: "from-slate-700/40 via-zinc-800/30 to-zinc-900" },
];

const BOOKINGS = [
  { id: "BK-2841", customer: "Rahul Deshmukh", phone: "+91 98220 12345", carId: "DK-02", from: "2026-05-04", to: "2026-05-08", days: 4, total: 12800, status: "active", source: "online", paid: true },
  { id: "BK-2840", customer: "Priya Sharma", phone: "+91 99875 33421", carId: "DK-06", from: "2026-05-03", to: "2026-05-09", days: 6, total: 20400, status: "active", source: "online", paid: true },
  { id: "BK-2839", customer: "Amit Patil", phone: "+91 90111 88299", carId: "DK-01", from: "2026-04-28", to: "2026-05-02", days: 4, total: 18000, status: "completed", source: "offline", paid: true },
  { id: "BK-2838", customer: "Sneha Kulkarni", phone: "+91 88505 66442", carId: "DK-04", from: "2026-04-25", to: "2026-04-27", days: 2, total: 3000, status: "completed", source: "online", paid: true },
  { id: "BK-2837", customer: "Vikram Joshi", phone: "+91 97645 11220", carId: "DK-03", from: "2026-05-09", to: "2026-05-13", days: 4, total: 15200, status: "upcoming", source: "online", paid: false },
  { id: "BK-2836", customer: "Anjali Mehta", phone: "+91 99300 77118", carId: "DK-08", from: "2026-04-20", to: "2026-04-22", days: 2, total: 17000, status: "completed", source: "offline", paid: true },
];

const REVENUE_DATA = [
  { month: "Nov", revenue: 285000, bookings: 42 },
  { month: "Dec", revenue: 410000, bookings: 58 },
  { month: "Jan", revenue: 365000, bookings: 51 },
  { month: "Feb", revenue: 445000, bookings: 63 },
  { month: "Mar", revenue: 520000, bookings: 71 },
  { month: "Apr", revenue: 612000, bookings: 84 },
  { month: "May", revenue: 187000, bookings: 28 },
];

const CATEGORY_DATA = [
  { name: "SUV", value: 38, color: "#c1272d" },
  { name: "Sedan", value: 22, color: "#9f1f24" },
  { name: "Hatchback", value: 18, color: "#7a181c" },
  { name: "MPV", value: 14, color: "#5a1014" },
  { name: "Luxury", value: 8, color: "#3a0a0c" },
];

/* ========================== UTILITIES ========================== */
const formatINR = (n) => "₹" + n.toLocaleString("en-IN");

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] }
};

const stagger = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }
});

/* ========================== SHARED COMPONENTS ========================== */
function StatusDot({ status }) {
  const config = {
    available: { color: "bg-emerald-400", text: "Available", ring: "shadow-[0_0_12px_rgba(74,222,128,0.6)]" },
    rented: { color: "bg-orange-400", text: "On Trip", ring: "" },
    maintenance: { color: "bg-[#6a5a48]", text: "Servicing", ring: "" },
    active: { color: "bg-emerald-400", text: "Active", ring: "shadow-[0_0_8px_rgba(74,222,128,0.5)]" },
    completed: { color: "bg-[#6a5a48]", text: "Completed", ring: "" },
    upcoming: { color: "bg-blue-400", text: "Upcoming", ring: "" },
  };
  const c = config[status] || config.available;
  return (
    <span className="inline-flex items-center gap-2 text-xs uppercase tracking-wider">
      <span className={`w-1.5 h-1.5 rounded-full ${c.color} ${c.ring}`} />
      {c.text}
    </span>
  );
}

function NoiseOverlay() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 opacity-[0.025] mix-blend-overlay"
      style={{
        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.7'/></svg>")`,
      }}
    />
  );
}

function CarVisual({ car, large = false }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${car.gradient} ${large ? "h-72" : "h-44"} group`}>
      {/* Grid texture */}
      <div className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: "linear-gradient(rgba(245,233,210,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(245,233,210,0.05) 1px, transparent 1px)",
          backgroundSize: "40px 40px"
        }} />
      {/* Glow */}
      <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-[#c1272d]/15 blur-3xl rounded-full" />
      {/* Brand */}
      <div className="absolute top-4 left-5 text-[10px] uppercase tracking-[0.2em] text-white/50 font-medium">
        {car.brand}
      </div>
      <div className="absolute top-4 right-5">
        <StatusDot status={car.status} />
      </div>
      {/* Car icon centerpiece */}
      <div className="absolute inset-0 flex items-center justify-center">
        <Car
          className={`text-white/15 group-hover:text-white/25 transition-all duration-700 group-hover:scale-110 ${large ? "w-40 h-40" : "w-28 h-28"}`}
          strokeWidth={1}
        />
      </div>
      {/* Model name */}
      <div className="absolute bottom-4 left-5 right-5">
        <div className={`text-white font-serif italic ${large ? "text-4xl" : "text-2xl"} leading-none tracking-tight`}>
          {car.model}
        </div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 mt-1">
          {car.category} · {car.year}
        </div>
      </div>
      {/* Plate */}
      <div className="absolute bottom-4 right-5 px-2 py-1 bg-black/40 border border-white/10 rounded text-[9px] font-mono text-white/60">
        {car.plate}
      </div>
    </div>
  );
}

/* ========================== TOP NAV ========================== */
function Nav({ view, setView, mode, setMode }) {
  const customerNav = [
    { id: "home", label: "Home" },
    { id: "fleet", label: "Fleet" },
    { id: "customer-dash", label: "My Trips" },
  ];
  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-black/60 border-b border-[#3a2d20]">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
        <button onClick={() => setView("home")} className="flex items-center gap-2 group">
          <div className="relative">
            <div className="w-8 h-8 bg-[#c1272d] rounded-md flex items-center justify-center transition-transform group-hover:rotate-6">
              <Car className="w-4 h-4 text-[#f5e9d2]" strokeWidth={2.5} />
            </div>
            <div className="absolute inset-0 bg-[#c1272d] rounded-md blur-md opacity-50 -z-10" />
          </div>
          <div>
            <div className="font-serif italic text-xl text-[#f5e9d2] leading-none">DriveKaro</div>
            <div className="text-[8px] uppercase tracking-[0.3em] text-[#8a7860] mt-0.5">Self drive · since '24</div>
          </div>
        </button>

        <nav className="hidden md:flex items-center gap-1">
          {customerNav.map(n => (
            <button
              key={n.id}
              onClick={() => setView(n.id)}
              className={`px-4 py-2 text-sm rounded-full transition-all ${
                view === n.id
                  ? "text-[#f5e9d2] bg-[#2e2318]"
                  : "text-[#b8a484] hover:text-[#f5e9d2]"
              }`}
            >
              {n.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setView("admin-dash")}
            className={`hidden sm:inline-flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-wider rounded-full border transition-all ${
              view === "admin-dash"
                ? "bg-[#c1272d] border-[#c1272d] text-[#f5e9d2]"
                : "border-[#4d3d2c] text-[#d4c4a8] hover:border-[#c1272d] hover:text-[#dc3545]"
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            Owner Panel
          </button>
          <button className="px-4 py-2 text-xs uppercase tracking-wider rounded-full bg-[#e8d9bc] text-[#1a130c] hover:bg-[#c1272d] hover:text-[#f5e9d2] transition-colors">
            Sign in
          </button>
        </div>
      </div>
    </header>
  );
}

/* ========================== LANDING PAGE ========================== */
function Landing({ setView, setSelectedCar }) {
  const [pickup, setPickup] = useState("Nashik");
  const [from, setFrom] = useState("2026-05-08");
  const [to, setTo] = useState("2026-05-12");

  return (
    <motion.div {...fadeUp} className="relative">
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(193,39,45,0.20),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(232,170,90,0.10),transparent_60%)]" />

        <div className="relative max-w-[1400px] mx-auto px-6 lg:px-10 pt-20 pb-32">
          {/* Top label */}
          <motion.div {...stagger(0)} className="flex items-center gap-3 mb-12">
            <div className="h-px w-12 bg-[#4d3d2c]" />
            <span className="text-xs uppercase tracking-[0.3em] text-[#8a7860]">Issue 04 · Self drive rentals</span>
            <div className="h-px flex-1 bg-[#2e2318] max-w-32" />
            <span className="text-xs text-[#6a5a48] font-mono">NSK · IND</span>
          </motion.div>

          {/* Headline */}
          <div className="grid lg:grid-cols-12 gap-8 items-end">
            <motion.h1 {...stagger(0.1)} className="lg:col-span-9 text-[12vw] lg:text-[8.5rem] leading-[0.85] tracking-tight font-serif text-[#f5e9d2]">
              Keys in hand.
              <br />
              <span className="italic text-[#dc3545]">Open road</span>
              <span className="text-[#6a5a48]"> ahead.</span>
            </motion.h1>
            <motion.div {...stagger(0.2)} className="lg:col-span-3 lg:pb-6">
              <p className="text-[#b8a484] text-base leading-relaxed border-l border-[#4d3d2c] pl-4">
                A curated fleet of 24 self-drive cars from Nashik. No driver, no schedule, no compromise. Pick a car. Drive away.
              </p>
            </motion.div>
          </div>

          {/* Booking widget */}
          <motion.div {...stagger(0.3)} className="mt-16 bg-[#241b12]/85 backdrop-blur border border-[#3a2d20] rounded-2xl p-2">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-px bg-[#2e2318] rounded-xl overflow-hidden">
              <div className="bg-[#241b12] p-5">
                <label className="text-[10px] uppercase tracking-[0.2em] text-[#8a7860] flex items-center gap-1.5">
                  <MapPin className="w-3 h-3" /> Pick up
                </label>
                <select value={pickup} onChange={e => setPickup(e.target.value)} className="mt-2 w-full bg-transparent text-[#f5e9d2] text-lg outline-none cursor-pointer">
                  <option>Nashik</option>
                  <option>Pune</option>
                  <option>Mumbai</option>
                  <option>Aurangabad</option>
                </select>
              </div>
              <div className="bg-[#241b12] p-5">
                <label className="text-[10px] uppercase tracking-[0.2em] text-[#8a7860] flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" /> From
                </label>
                <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="mt-2 w-full bg-transparent text-[#f5e9d2] text-lg outline-none [color-scheme:dark]" />
              </div>
              <div className="bg-[#241b12] p-5">
                <label className="text-[10px] uppercase tracking-[0.2em] text-[#8a7860] flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" /> Until
                </label>
                <input type="date" value={to} onChange={e => setTo(e.target.value)} className="mt-2 w-full bg-transparent text-[#f5e9d2] text-lg outline-none [color-scheme:dark]" />
              </div>
              <button
                onClick={() => setView("fleet")}
                className="bg-[#c1272d] hover:bg-[#d63239] text-[#f5e9d2] p-5 flex items-center justify-between group transition-colors"
              >
                <div className="text-left">
                  <div className="text-[10px] uppercase tracking-[0.2em] opacity-70">Continue</div>
                  <div className="text-lg font-medium">Find a car</div>
                </div>
                <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </motion.div>

          {/* Marquee stats */}
          <motion.div {...stagger(0.4)} className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8 border-t border-[#3a2d20] pt-10">
            {[
              { num: "24", label: "Cars in fleet" },
              { num: "1.2k+", label: "Trips completed" },
              { num: "4.9", label: "Avg. rating", suffix: "★" },
              { num: "24/7", label: "Roadside support" },
            ].map((s, i) => (
              <div key={i}>
                <div className="text-5xl font-serif text-[#f5e9d2] flex items-baseline gap-1">
                  {s.num}
                  {s.suffix && <span className="text-[#dc3545] text-2xl">{s.suffix}</span>}
                </div>
                <div className="text-xs uppercase tracking-[0.2em] text-[#8a7860] mt-2">{s.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* FEATURED FLEET */}
      <section className="relative max-w-[1400px] mx-auto px-6 lg:px-10 py-24">
        <div className="flex items-end justify-between mb-12 flex-wrap gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-[#dc3545] mb-3">— The Fleet</div>
            <h2 className="text-5xl md:text-6xl font-serif italic text-[#f5e9d2] leading-none">
              Built for <span className="not-italic text-[#6a5a48]">every</span> mile.
            </h2>
          </div>
          <button onClick={() => setView("fleet")} className="text-sm uppercase tracking-wider text-[#b8a484] hover:text-[#dc3545] inline-flex items-center gap-2 group">
            View all 24 cars
            <ArrowUpRight className="w-4 h-4 group-hover:rotate-45 transition-transform" />
          </button>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FLEET.slice(0, 6).map((car, i) => (
            <motion.div
              key={car.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.6, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
              onClick={() => { setSelectedCar(car); setView("booking"); }}
              className="cursor-pointer group"
            >
              <CarVisual car={car} />
              <div className="mt-4 flex items-start justify-between">
                <div>
                  <div className="text-xs text-[#8a7860] uppercase tracking-wider">{car.brand}</div>
                  <div className="text-lg text-[#f5e9d2] font-medium">{car.model}</div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-[#8a7860]">
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" />{car.seats}</span>
                    <span className="flex items-center gap-1"><Settings className="w-3 h-3" />{car.transmission.slice(0, 4)}</span>
                    <span className="flex items-center gap-1"><Fuel className="w-3 h-3" />{car.fuel}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl text-[#f5e9d2] font-serif">{formatINR(car.pricePerDay)}</div>
                  <div className="text-[10px] uppercase tracking-wider text-[#8a7860]">per day</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="relative bg-[#241b12] border-y border-[#3a2d20] py-24">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10">
          <div className="text-xs uppercase tracking-[0.3em] text-[#dc3545] mb-3">— Process</div>
          <h2 className="text-5xl md:text-6xl font-serif italic text-[#f5e9d2] leading-none mb-16">
            Four steps. <span className="not-italic text-[#6a5a48]">Then drive.</span>
          </h2>

          <div className="grid md:grid-cols-4 gap-px bg-[#2e2318] rounded-xl overflow-hidden">
            {[
              { n: "01", t: "Pick a car", d: "Browse the fleet, filter by your needs, lock dates." },
              { n: "02", t: "Verify yourself", d: "Aadhaar + driving licence. Done in under 2 minutes." },
              { n: "03", t: "Pay deposit", d: "Refundable security held securely. UPI, card, anything." },
              { n: "04", t: "Drive away", d: "Pickup from our hub or get the car delivered." },
            ].map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.6 }}
                className="bg-[#241b12] p-8 hover:bg-[#2e2318]/60 transition-colors group"
              >
                <div className="text-[#dc3545] font-mono text-xs mb-6">{step.n} / 04</div>
                <div className="text-2xl text-[#f5e9d2] font-serif mb-3">{step.t}</div>
                <div className="text-sm text-[#8a7860] leading-relaxed">{step.d}</div>
                <div className="mt-8 h-px bg-[#3a2d20] group-hover:bg-[#c1272d] transition-colors" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIAL */}
      <section className="relative max-w-[1400px] mx-auto px-6 lg:px-10 py-32">
        <div className="grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7">
            <div className="text-7xl text-[#dc3545] font-serif leading-none mb-6">"</div>
            <p className="text-3xl md:text-4xl text-[#f5e9d2] font-serif italic leading-tight">
              Booked the Thar at 11pm for a Sunday morning trip to Saputara. Got a call at 7am, keys at 8am, hills by 11. The car was spotless. This is how rentals should feel.
            </p>
            <div className="mt-8 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#c1272d] to-orange-400" />
              <div>
                <div className="text-[#f5e9d2]">Rohan M.</div>
                <div className="text-xs text-[#8a7860] uppercase tracking-wider">Nashik · Repeat customer</div>
              </div>
            </div>
          </div>
          <div className="lg:col-span-5 space-y-3">
            {[
              { i: Zap, t: "Instant confirmation", d: "Book and confirm in 90 seconds." },
              { i: Award, t: "Sanitised between trips", d: "Detailed checklist on every handover." },
              { i: Shield, t: "Zero hidden fees", d: "What you see is what you pay." },
            ].map((f, i) => {
              const Icon = f.i;
              return (
                <div key={i} className="border border-[#3a2d20] rounded-xl p-5 flex items-start gap-4 hover:border-[#c1272d]/40 transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-[#c1272d]/15 border border-[#c1272d]/30 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-[#dc3545]" />
                  </div>
                  <div>
                    <div className="text-[#f5e9d2] font-medium">{f.t}</div>
                    <div className="text-sm text-[#8a7860] mt-1">{f.d}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-[#3a2d20]">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-16">
          <div className="grid md:grid-cols-4 gap-12">
            <div className="md:col-span-2">
              <div className="font-serif italic text-4xl text-[#f5e9d2]">DriveKaro</div>
              <p className="text-[#8a7860] text-sm mt-4 max-w-sm leading-relaxed">
                Self-drive car rentals based in Nashik, Maharashtra. Built for travellers who'd rather hold the wheel themselves.
              </p>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-[#6a5a48] mb-4">Contact</div>
              <div className="text-sm text-[#d4c4a8] space-y-2">
                <div className="flex items-center gap-2"><Phone className="w-3 h-3" /> +91 99999 99999</div>
                <div className="flex items-center gap-2"><Mail className="w-3 h-3" /> hi@drivekaro.in</div>
                <div className="flex items-center gap-2"><MapPin className="w-3 h-3" /> Nashik, MH 422001</div>
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-[#6a5a48] mb-4">Company</div>
              <div className="text-sm text-[#d4c4a8] space-y-2">
                <div>About</div>
                <div>Terms</div>
                <div>Privacy</div>
                <div>FAQs</div>
              </div>
            </div>
          </div>
          <div className="mt-16 pt-8 border-t border-[#3a2d20] flex flex-wrap items-center justify-between gap-4 text-xs text-[#6a5a48]">
            <div>© 2026 DriveKaro Mobility Pvt. Ltd.</div>
            <div className="font-mono">v1.0.0 · Built in Nashik</div>
          </div>
        </div>
      </footer>
    </motion.div>
  );
}

/* ========================== FLEET PAGE ========================== */
function FleetPage({ setView, setSelectedCar }) {
  const [filter, setFilter] = useState("All");
  const [transmission, setTransmission] = useState("All");
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const categories = ["All", "SUV", "Sedan", "Hatchback", "MPV", "Electric", "Luxury"];

  const gradients = [
    "from-orange-900/40 via-red-900/30 to-zinc-900",
    "from-blue-900/40 via-indigo-900/30 to-zinc-900",
    "from-stone-800/50 via-zinc-800/40 to-zinc-900",
    "from-rose-900/30 via-pink-900/20 to-zinc-900",
    "from-cyan-900/30 via-teal-900/20 to-zinc-900",
    "from-violet-900/30 via-purple-900/20 to-zinc-900",
    "from-lime-900/30 via-emerald-900/20 to-zinc-900",
    "from-slate-700/40 via-zinc-800/30 to-zinc-900",
  ];

  useEffect(() => {
    async function loadCars() {
      const { data, error } = await supabase
        .from('cars')
        .select('*')
        .order('price_per_day', { ascending: false });

      if (error) {
        console.error('Error loading cars:', error);
        setLoading(false);
        return;
      }

      const mapped = data.map((c, i) => ({
        id: c.id,
        brand: c.brand,
        model: c.model,
        year: c.year,
        category: c.category,
        seats: c.seats,
        transmission: c.transmission,
        fuel: c.fuel,
        pricePerDay: c.price_per_day,
        status: c.status,
        plate: c.plate_number,
        odometer: c.odometer,
        rating: c.rating,
        trips: c.total_trips,
        gradient: gradients[i % gradients.length]
      }));
      setCars(mapped);
      setLoading(false);
    }
    loadCars();
  }, []);

  const filtered = cars.filter(c =>
    (filter === "All" || c.category === filter) &&
    (transmission === "All" || c.transmission === transmission)
  );

  if (loading) {
    return (
      <div className="max-w-[1400px] mx-auto px-6 py-32 text-center">
        <div className="text-[#b8a484] text-sm uppercase tracking-widest">Loading fleet from database…</div>
      </div>
    );
  }

  return (
    <motion.div {...fadeUp} className="max-w-[1400px] mx-auto px-6 lg:px-10 py-16">
      <div className="flex items-end justify-between flex-wrap gap-6 mb-12">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-[#dc3545] mb-3">— The Fleet</div>
          <h1 className="text-6xl md:text-7xl font-serif italic text-[#f5e9d2] leading-none">
            All cars. <span className="not-italic text-[#6a5a48]">One garage.</span>
          </h1>
        </div>
        <div className="text-right">
          <div className="text-4xl font-serif text-[#f5e9d2]">{filtered.length}</div>
          <div className="text-xs uppercase tracking-wider text-[#8a7860]">cars match</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-6 mb-10 pb-6 border-b border-[#3a2d20]">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#8a7860] mb-2">Category</div>
          <div className="flex flex-wrap gap-2">
            {categories.map(c => (
              <button key={c} onClick={() => setFilter(c)}
                className={`px-4 py-1.5 text-xs uppercase tracking-wider rounded-full border transition-all ${
                  filter === c ? "bg-[#c1272d] border-[#c1272d] text-[#f5e9d2]" : "border-[#4d3d2c] text-[#b8a484] hover:border-[#6a5a48]"
                }`}>{c}</button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#8a7860] mb-2">Transmission</div>
          <div className="flex gap-2">
            {["All", "Manual", "Automatic"].map(t => (
              <button key={t} onClick={() => setTransmission(t)}
                className={`px-4 py-1.5 text-xs uppercase tracking-wider rounded-full border transition-all ${
                  transmission === t ? "bg-[#c1272d] border-[#c1272d] text-[#f5e9d2]" : "border-[#4d3d2c] text-[#b8a484] hover:border-[#6a5a48]"
                }`}>{t}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {filtered.map((car, i) => (
            <motion.div key={car.id} layout
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4, delay: i * 0.04 }}
              onClick={() => { setSelectedCar(car); setView("booking"); }}
              className="cursor-pointer group">
              <CarVisual car={car} />
              <div className="mt-4 p-4 border border-[#3a2d20] rounded-xl hover:border-[#c1272d]/40 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-xs text-[#8a7860] uppercase tracking-wider">{car.brand}</div>
                    <div className="text-lg text-[#f5e9d2] font-medium">{car.model}</div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-[#b8a484]">
                    <Star className="w-3 h-3 fill-[#dc3545] text-[#dc3545]" />{car.rating}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 py-3 border-y border-[#3a2d20] text-center">
                  <div><Users className="w-3.5 h-3.5 text-[#8a7860] mx-auto mb-1" /><div className="text-[10px] uppercase tracking-wider text-[#8a7860]">{car.seats} seats</div></div>
                  <div><Settings className="w-3.5 h-3.5 text-[#8a7860] mx-auto mb-1" /><div className="text-[10px] uppercase tracking-wider text-[#8a7860]">{car.transmission}</div></div>
                  <div><Fuel className="w-3.5 h-3.5 text-[#8a7860] mx-auto mb-1" /><div className="text-[10px] uppercase tracking-wider text-[#8a7860]">{car.fuel}</div></div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div>
                    <span className="text-2xl text-[#f5e9d2] font-serif">{formatINR(car.pricePerDay)}</span>
                    <span className="text-xs text-[#8a7860] ml-1">/day</span>
                  </div>
                  <button className="text-xs uppercase tracking-wider text-[#dc3545] inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                    Book <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* ========================== BOOKING PAGE ========================== */
function BookingPage({ car, setView }) {
  const [step, setStep] = useState(1);
  const [from, setFrom] = useState("2026-05-08");
  const [to, setTo] = useState("2026-05-12");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [success, setSuccess] = useState(false);
  const [bookingCode, setBookingCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!car) {
    return (
      <div className="max-w-md mx-auto py-32 text-center">
        <div className="text-[#b8a484]">No car selected.</div>
        <button onClick={() => setView("fleet")} className="mt-4 text-[#dc3545]">Browse fleet →</button>
      </div>
    );
  }

  const days = Math.max(1, Math.ceil((new Date(to) - new Date(from)) / 86400000));
  const subtotal = days * car.pricePerDay;
  const tax = Math.round(subtotal * 0.18);
  const deposit = 5000;
  const total = subtotal + tax + deposit;

  // ====== THIS IS THE NEW PART — saves to Supabase ======
  async function handleBookingSubmit() {
    setSubmitting(true);
    setError("");

    try {
      // 1. Find or create the customer
      let customerId;
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('phone', phone)
        .maybeSingle();

      if (existingCustomer) {
        customerId = existingCustomer.id;
      } else {
        const { data: newCustomer, error: custErr } = await supabase
          .from('customers')
          .insert({ full_name: name, email: email, phone: phone })
          .select('id')
          .single();
        if (custErr) throw custErr;
        customerId = newCustomer.id;
      }

      // 2. Generate a booking code like BK-2842
      const code = "BK-" + Math.floor(1000 + Math.random() * 9000);

      // 3. Insert the booking
      const { data: booking, error: bookErr } = await supabase
        .from('bookings')
        .insert({
          booking_code: code,
          customer_id: customerId,
          car_id: car.id,
          from_date: from,
          to_date: to,
          days: days,
          daily_rate: car.pricePerDay,
          subtotal: subtotal,
          tax: tax,
          deposit: deposit,
          total: total,
          status: 'upcoming',
          source: 'online',
          payment_status: 'pending'
        })
        .select('id')
        .single();
      if (bookErr) throw bookErr;

      // 4. Auto-generate the invoice
      const invoiceNum = "INV-" + code.slice(3);
      const cgst = Math.round(subtotal * 0.09);
      const sgst = Math.round(subtotal * 0.09);

      await supabase
        .from('invoices')
        .insert({
          invoice_number: invoiceNum,
          booking_id: booking.id,
          customer_id: customerId,
          amount: subtotal,
          cgst: cgst,
          sgst: sgst,
          total: subtotal + cgst + sgst,
          status: 'pending'
        });

      setBookingCode(code);
      setSuccess(true);
    } catch (err) {
      console.error('Booking failed:', err);
      setError(err.message || "Booking failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }
  // =====================================================

  if (success) {
    return (
      <motion.div {...fadeUp} className="max-w-2xl mx-auto px-6 py-32 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", duration: 0.7 }}
          className="w-24 h-24 rounded-full bg-[#c1272d] mx-auto flex items-center justify-center mb-8">
          <CheckCircle2 className="w-12 h-12 text-[#f5e9d2]" />
        </motion.div>
        <h1 className="text-5xl font-serif italic text-[#f5e9d2] mb-4">Booking confirmed.</h1>
        <p className="text-[#b8a484] mb-2">Reference <span className="text-[#dc3545] font-mono">{bookingCode}</span></p>
        <p className="text-[#8a7860] max-w-md mx-auto">Your {car.brand} {car.model} is reserved. Saved to database — check Supabase to confirm!</p>
        <div className="mt-12 flex gap-3 justify-center">
          <button onClick={() => setView("admin-dash")} className="px-6 py-3 bg-[#c1272d] text-[#f5e9d2] rounded-full text-sm uppercase tracking-wider">View in admin</button>
          <button onClick={() => setView("home")} className="px-6 py-3 border border-[#4d3d2c] text-[#d4c4a8] rounded-full text-sm uppercase tracking-wider">Home</button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div {...fadeUp} className="max-w-[1400px] mx-auto px-6 lg:px-10 py-12">
      <button onClick={() => setView("fleet")} className="text-xs uppercase tracking-wider text-[#8a7860] hover:text-[#dc3545] mb-8">← Back to fleet</button>

      <div className="grid lg:grid-cols-12 gap-10">
        <div className="lg:col-span-7">
          <CarVisual car={car} large />
          <div className="mt-6 flex items-start justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-[#8a7860]">{car.brand}</div>
              <h1 className="text-5xl font-serif italic text-[#f5e9d2]">{car.model}</h1>
              <div className="flex items-center gap-1 mt-2 text-sm text-[#b8a484]">
                <Star className="w-4 h-4 fill-[#dc3545] text-[#dc3545]" />{car.rating} · {car.trips} trips
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-serif text-[#f5e9d2]">{formatINR(car.pricePerDay)}</div>
              <div className="text-xs uppercase tracking-wider text-[#8a7860]">per day</div>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-4 gap-4">
            {[{ l: "Seats", v: car.seats, i: Users },{ l: "Transmission", v: car.transmission, i: Settings },{ l: "Fuel", v: car.fuel, i: Fuel },{ l: "Year", v: car.year, i: Gauge }].map((s, i) => {
              const Icon = s.i;
              return (
                <div key={i} className="border border-[#3a2d20] rounded-xl p-4">
                  <Icon className="w-4 h-4 text-[#dc3545] mb-3" />
                  <div className="text-[10px] uppercase tracking-wider text-[#8a7860]">{s.l}</div>
                  <div className="text-[#f5e9d2] mt-1">{s.v}</div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 border border-[#3a2d20] rounded-xl p-6">
            <div className="text-xs uppercase tracking-wider text-[#8a7860] mb-4">What's included</div>
            <div className="grid grid-cols-2 gap-3">
              {["Unlimited km up to 250/day","24/7 roadside assistance","Comprehensive insurance","Sanitised before pickup","Fuel level marked at start","GPS tracking enabled"].map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-[#d4c4a8]">
                  <CheckCircle2 className="w-4 h-4 text-[#dc3545] flex-shrink-0" />{f}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="sticky top-24 border border-[#3a2d20] rounded-2xl p-6 bg-[#241b12]/60">
            <div className="flex items-center gap-2 mb-6">
              {[1, 2, 3].map(s => (
                <div key={s} className="flex-1">
                  <div className={`h-1 rounded-full transition-all ${step >= s ? "bg-[#c1272d]" : "bg-[#3a2d20]"}`} />
                  <div className={`text-[10px] uppercase tracking-wider mt-2 ${step >= s ? "text-[#dc3545]" : "text-[#6a5a48]"}`}>
                    {s === 1 ? "Dates" : s === 2 ? "Details" : "Payment"}
                  </div>
                </div>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div key="s1" {...fadeUp}>
                  <div className="text-2xl font-serif text-[#f5e9d2] mb-6">When do you need it?</div>
                  <label className="text-[10px] uppercase tracking-wider text-[#8a7860]">Pickup date</label>
                  <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-full mt-2 mb-5 bg-[#241b12] border border-[#4d3d2c] rounded-lg px-4 py-3 text-[#f5e9d2] [color-scheme:dark]" />
                  <label className="text-[10px] uppercase tracking-wider text-[#8a7860]">Return date</label>
                  <input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-full mt-2 bg-[#241b12] border border-[#4d3d2c] rounded-lg px-4 py-3 text-[#f5e9d2] [color-scheme:dark]" />
                  <div className="mt-6 p-4 bg-[#241b12] rounded-xl border border-[#3a2d20]">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#b8a484]">{days} day{days > 1 ? "s" : ""} × {formatINR(car.pricePerDay)}</span>
                      <span className="text-[#f5e9d2] font-mono">{formatINR(subtotal)}</span>
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div key="s2" {...fadeUp}>
                  <div className="text-2xl font-serif text-[#f5e9d2] mb-6">Tell us about you</div>
                  <label className="text-[10px] uppercase tracking-wider text-[#8a7860]">Full name</label>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="As on driving licence" className="w-full mt-2 mb-4 bg-[#241b12] border border-[#4d3d2c] rounded-lg px-4 py-3 text-[#f5e9d2] placeholder-[#6a5a48] outline-none focus:border-[#c1272d]/60" />
                  <label className="text-[10px] uppercase tracking-wider text-[#8a7860]">Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" className="w-full mt-2 mb-4 bg-[#241b12] border border-[#4d3d2c] rounded-lg px-4 py-3 text-[#f5e9d2] placeholder-[#6a5a48] outline-none focus:border-[#c1272d]/60" />
                  <label className="text-[10px] uppercase tracking-wider text-[#8a7860]">Phone</label>
                  <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91" className="w-full mt-2 bg-[#241b12] border border-[#4d3d2c] rounded-lg px-4 py-3 text-[#f5e9d2] placeholder-[#6a5a48] outline-none focus:border-[#c1272d]/60" />
                </motion.div>
              )}

              {step === 3 && (
                <motion.div key="s3" {...fadeUp}>
                  <div className="text-2xl font-serif text-[#f5e9d2] mb-6">Almost there</div>
                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between text-sm"><span className="text-[#b8a484]">Rental ({days} days)</span><span className="text-[#f5e9d2] font-mono">{formatINR(subtotal)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-[#b8a484]">GST (18%)</span><span className="text-[#f5e9d2] font-mono">{formatINR(tax)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-[#b8a484]">Refundable deposit</span><span className="text-[#f5e9d2] font-mono">{formatINR(deposit)}</span></div>
                    <div className="border-t border-[#4d3d2c] pt-3 flex justify-between"><span className="text-[#f5e9d2] uppercase tracking-wider text-xs">Total</span><span className="text-[#f5e9d2] font-serif text-2xl">{formatINR(total)}</span></div>
                  </div>
                  {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-3 rounded-lg mb-3">{error}</div>}
                  <div className="flex items-center gap-2 text-xs text-[#8a7860]"><Lock className="w-3 h-3" /> Razorpay payment integration coming next</div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex gap-3 mt-8">
              {step > 1 && <button onClick={() => setStep(step - 1)} disabled={submitting} className="px-5 py-3 border border-[#4d3d2c] text-[#d4c4a8] rounded-full text-xs uppercase tracking-wider disabled:opacity-50">Back</button>}
              <button
                onClick={() => step < 3 ? setStep(step + 1) : handleBookingSubmit()}
                disabled={submitting || (step === 2 && (!name || !phone))}
                className="flex-1 bg-[#c1272d] hover:bg-[#d63239] text-[#f5e9d2] px-5 py-3 rounded-full text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {submitting ? "Saving..." : step === 3 ? `Confirm booking ${formatINR(total)}` : "Continue"}
                {!submitting && <ArrowRight className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ========================== CUSTOMER DASHBOARD ========================== */
function CustomerDashboard({ setView, setSelectedCar }) {
  const myBookings = BOOKINGS.slice(0, 4);

  return (
    <motion.div {...fadeUp} className="max-w-[1400px] mx-auto px-6 lg:px-10 py-12">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-12">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-[#dc3545] mb-3">— Your space</div>
          <h1 className="text-5xl md:text-6xl font-serif italic text-[#f5e9d2] leading-none">
            Hello, <span className="text-[#6a5a48]">Rahul.</span>
          </h1>
        </div>
        <button onClick={() => setView("fleet")} className="px-5 py-3 bg-[#c1272d] text-[#f5e9d2] rounded-full text-xs uppercase tracking-wider inline-flex items-center gap-2">
          <Plus className="w-4 h-4" /> Book another car
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {[
          { l: "Trips taken", v: "7", s: "Since Sep '25" },
          { l: "Cities visited", v: "4", s: "Maharashtra & Goa" },
          { l: "Loyalty status", v: "Gold", s: "10% off all rides" },
          { l: "Saved cars", v: "3", s: "View list" },
        ].map((s, i) => (
          <div key={i} className="border border-[#3a2d20] rounded-xl p-5 hover:border-[#c1272d]/40 transition-colors">
            <div className="text-xs uppercase tracking-wider text-[#8a7860]">{s.l}</div>
            <div className="text-3xl font-serif text-[#f5e9d2] mt-2">{s.v}</div>
            <div className="text-[10px] uppercase tracking-wider text-[#6a5a48] mt-2">{s.s}</div>
          </div>
        ))}
      </div>

      {/* Active booking highlight */}
      <div className="border border-[#c1272d]/40 rounded-2xl p-6 bg-gradient-to-br from-[#c1272d]/[0.08] to-transparent mb-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#c1272d] animate-pulse" />
            <span className="text-xs uppercase tracking-wider text-[#dc3545]">Trip in progress</span>
          </div>
          <span className="text-xs text-[#8a7860] font-mono">BK-2841</span>
        </div>
        <div className="grid lg:grid-cols-3 gap-6 items-center">
          <div className="lg:col-span-2">
            <div className="text-xs uppercase tracking-wider text-[#8a7860]">Hyundai</div>
            <div className="text-3xl font-serif italic text-[#f5e9d2]">Creta</div>
            <div className="mt-4 flex flex-wrap gap-6 text-sm">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[#8a7860]">From</div>
                <div className="text-[#f5e9d2]">04 May 2026</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[#8a7860]">Until</div>
                <div className="text-[#f5e9d2]">08 May 2026</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[#8a7860]">Plate</div>
                <div className="text-[#f5e9d2] font-mono">MH15 KR 0002</div>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <button className="px-5 py-3 bg-[#c1272d] text-[#f5e9d2] rounded-full text-xs uppercase tracking-wider inline-flex items-center justify-center gap-2">
              <Phone className="w-3 h-3" /> Roadside help
            </button>
            <button className="px-5 py-3 border border-[#4d3d2c] text-[#d4c4a8] rounded-full text-xs uppercase tracking-wider">Extend trip</button>
          </div>
        </div>
      </div>

      {/* Trips list */}
      <div className="grid lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2">
          <div className="flex items-end justify-between mb-6">
            <div className="text-2xl font-serif italic text-[#f5e9d2]">All your trips</div>
            <div className="text-xs uppercase tracking-wider text-[#8a7860]">{myBookings.length} total</div>
          </div>
          <div className="space-y-3">
            {myBookings.map((b, i) => {
              const car = FLEET.find(c => c.id === b.carId);
              return (
                <motion.div
                  key={b.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="border border-[#3a2d20] rounded-xl p-5 flex items-center gap-5 hover:border-[#c1272d]/40 transition-colors"
                >
                  <div className={`w-20 h-16 rounded-lg bg-gradient-to-br ${car?.gradient} flex items-center justify-center flex-shrink-0`}>
                    <Car className="w-6 h-6 text-white/40" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="text-[#f5e9d2] font-medium">{car?.brand} {car?.model}</div>
                      <StatusDot status={b.status} />
                    </div>
                    <div className="text-xs text-[#8a7860] mt-1">{b.from} → {b.to} · {b.days} days</div>
                  </div>
                  <div className="text-right hidden sm:block">
                    <div className="text-[#f5e9d2] font-serif text-lg">{formatINR(b.total)}</div>
                    <div className="text-[10px] uppercase tracking-wider text-[#8a7860] font-mono">{b.id}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#6a5a48]" />
                </motion.div>
              );
            })}
          </div>
        </div>

        <div>
          <div className="text-2xl font-serif italic text-[#f5e9d2] mb-6">Saved for later</div>
          <div className="space-y-3">
            {FLEET.slice(0, 3).map(car => (
              <div key={car.id} onClick={() => { setSelectedCar(car); setView("booking"); }} className="border border-[#3a2d20] rounded-xl p-3 flex items-center gap-3 hover:border-[#c1272d]/40 transition-colors cursor-pointer group">
                <div className={`w-14 h-14 rounded-lg bg-gradient-to-br ${car.gradient} flex items-center justify-center flex-shrink-0`}>
                  <Car className="w-5 h-5 text-white/40" strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[#f5e9d2] text-sm">{car.model}</div>
                  <div className="text-xs text-[#8a7860]">{formatINR(car.pricePerDay)}/day</div>
                </div>
                <ArrowRight className="w-4 h-4 text-[#6a5a48] group-hover:text-[#dc3545] group-hover:translate-x-1 transition-all" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ========================== ADMIN DASHBOARD ========================== */
function AdminDashboard({ setView }) {
  const [section, setSection] = useState("overview");
  const sections = [
    { id: "overview", label: "Overview", icon: LayoutGrid },
    { id: "fleet", label: "Fleet", icon: Car },
    { id: "bookings", label: "Bookings", icon: Calendar },
    { id: "invoices", label: "Invoices", icon: Receipt },
    { id: "customers", label: "Customers", icon: Users },
    { id: "maintenance", label: "Service", icon: Wrench },
  ];

  return (
    <motion.div {...fadeUp} className="max-w-[1500px] mx-auto px-4 lg:px-8 py-8">
      <div className="grid lg:grid-cols-[240px_1fr] gap-8">
        {/* Sidebar */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="border border-[#3a2d20] rounded-2xl p-5 bg-[#241b12]/60">
            <div className="flex items-center gap-2 pb-4 border-b border-[#3a2d20] mb-4">
              <div className="w-8 h-8 rounded-lg bg-[#c1272d] flex items-center justify-center">
                <Shield className="w-4 h-4 text-[#f5e9d2]" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-[#8a7860]">Owner</div>
                <div className="text-sm text-[#f5e9d2]">Admin Panel</div>
              </div>
            </div>
            <nav className="space-y-1">
              {sections.map(s => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSection(s.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      section === s.id
                        ? "bg-[#c1272d] text-[#f5e9d2]"
                        : "text-[#b8a484] hover:text-[#f5e9d2] hover:bg-[#2e2318]"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {s.label}
                  </button>
                );
              })}
            </nav>
            <div className="mt-6 pt-4 border-t border-[#3a2d20]">
              <button className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-[#8a7860] hover:text-[#f5e9d2] transition-colors">
                <LogOut className="w-4 h-4" /> Sign out
              </button>
            </div>
          </div>
        </aside>

        {/* Content */}
        <div className="min-h-screen">
          <AnimatePresence mode="wait">
            {section === "overview" && <AdminOverview key="ov" />}
            {section === "fleet" && <AdminFleet key="fl" />}
            {section === "bookings" && <AdminBookings key="bk" />}
            {section === "invoices" && <AdminInvoices key="iv" />}
            {section === "customers" && <AdminCustomers key="cu" />}
            {section === "maintenance" && <AdminMaintenance key="mt" />}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

function AdminOverview() {
  const [stats, setStats] = useState({
    totalRevenue: 0,
    activeTrips: 0,
    totalCars: 0,
    availableCars: 0,
    monthRevenue: 0,
    totalBookings: 0,
    utilization: 0
  });
  const [recentBookings, setRecentBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      // Pull all bookings & cars in parallel
      const [bookingsRes, carsRes] = await Promise.all([
        supabase.from('bookings').select('*, customers(full_name), cars(model)').order('created_at', { ascending: false }),
        supabase.from('cars').select('*')
      ]);

      const allBookings = bookingsRes.data || [];
      const allCars = carsRes.data || [];

      // Calculate metrics
      const totalRevenue = allBookings.reduce((sum, b) => sum + (b.total || 0), 0);
      const activeTrips = allBookings.filter(b => b.status === 'active').length;
      const availableCars = allCars.filter(c => c.status === 'available').length;
      const rentedCars = allCars.filter(c => c.status === 'rented').length;
      const utilization = allCars.length > 0 ? Math.round((rentedCars / allCars.length) * 100) : 0;

      // This month's revenue
      const thisMonth = new Date().toISOString().slice(0, 7);
      const monthRevenue = allBookings
        .filter(b => b.created_at?.startsWith(thisMonth))
        .reduce((sum, b) => sum + (b.total || 0), 0);

      setStats({
        totalRevenue,
        activeTrips,
        totalCars: allCars.length,
        availableCars,
        monthRevenue,
        totalBookings: allBookings.length,
        utilization
      });
      setRecentBookings(allBookings.slice(0, 5));
      setLoading(false);
    }
    loadStats();
  }, []);

  // Build revenue trend from bookings
  const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const revenueByMonth = {};
  recentBookings.forEach(b => {
    if (b.created_at) {
      const m = monthLabels[new Date(b.created_at).getMonth()];
      revenueByMonth[m] = (revenueByMonth[m] || 0) + b.total;
    }
  });
  const trendData = Object.keys(revenueByMonth).length > 0
    ? Object.entries(revenueByMonth).map(([month, revenue]) => ({ month, revenue }))
    : [{ month: "Now", revenue: stats.totalRevenue }];

  if (loading) {
    return <div className="text-center py-32 text-[#b8a484]">Loading dashboard…</div>;
  }

  return (
    <motion.div {...fadeUp}>
      <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
        <div>
          <div className="text-xs uppercase tracking-wider text-[#8a7860]">{new Date().toDateString()} · live data</div>
          <h1 className="text-4xl font-serif italic text-[#f5e9d2] mt-1">Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}.</h1>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 border border-[#4d3d2c] text-[#d4c4a8] rounded-full text-xs uppercase tracking-wider inline-flex items-center gap-2 hover:border-[#c1272d]/60">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { l: "Total revenue", v: formatINR(stats.totalRevenue), c: `from ${stats.totalBookings} bookings`, icon: IndianRupee },
          { l: "Active trips", v: stats.activeTrips, c: `of ${stats.totalCars} cars on road`, icon: Activity },
          { l: "This month", v: formatINR(stats.monthRevenue), c: "revenue so far", icon: TrendingUp },
          { l: "Fleet utilisation", v: stats.utilization + "%", c: `${stats.availableCars} available now`, icon: BarChart3 },
        ].map((k, i) => {
          const Icon = k.icon;
          return (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="border border-[#3a2d20] rounded-xl p-5 bg-[#241b12]/60 hover:border-[#c1272d]/40 transition-colors">
              <div className="flex items-center justify-between mb-4">
                <Icon className="w-4 h-4 text-[#8a7860]" />
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#c1272d]/15 text-[#dc3545]">live</span>
              </div>
              <div className="text-3xl font-serif text-[#f5e9d2]">{k.v}</div>
              <div className="text-xs text-[#8a7860] mt-1">{k.l}</div>
              <div className="text-[10px] uppercase tracking-wider text-[#6a5a48] mt-3">{k.c}</div>
            </motion.div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-8">
        <div className="lg:col-span-2 border border-[#3a2d20] rounded-xl p-5 bg-[#241b12]/60">
          <div className="flex items-end justify-between mb-6">
            <div>
              <div className="text-xs uppercase tracking-wider text-[#8a7860]">Revenue trend</div>
              <div className="text-2xl font-serif text-[#f5e9d2] mt-1">All time</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-serif text-[#dc3545]">{formatINR(stats.totalRevenue)}</div>
              <div className="text-[10px] uppercase tracking-wider text-[#8a7860]">total</div>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#c1272d" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#c1272d" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#3a2d20" vertical={false} />
                <XAxis dataKey="month" stroke="#8a7860" fontSize={11} />
                <YAxis stroke="#8a7860" fontSize={11} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ backgroundColor: "#1a130c", border: "1px solid #3a2d20", borderRadius: 8 }} formatter={v => [formatINR(v), "Revenue"]} />
                <Area type="monotone" dataKey="revenue" stroke="#c1272d" strokeWidth={2} fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="border border-[#3a2d20] rounded-xl p-5 bg-[#241b12]/60">
          <div className="text-xs uppercase tracking-wider text-[#8a7860]">Fleet status</div>
          <div className="text-2xl font-serif text-[#f5e9d2] mt-1 mb-4">Right now</div>
          <div className="space-y-3 mt-6">
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-[#b8a484]">Available</span>
                <span className="text-[#f5e9d2] font-mono">{stats.availableCars}/{stats.totalCars}</span>
              </div>
              <div className="h-2 bg-[#2e2318] rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${stats.totalCars ? (stats.availableCars/stats.totalCars)*100 : 0}%` }} transition={{ duration: 1 }} className="h-full bg-emerald-400" />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-[#b8a484]">On trip</span>
                <span className="text-[#f5e9d2] font-mono">{stats.utilization}%</span>
              </div>
              <div className="h-2 bg-[#2e2318] rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${stats.utilization}%` }} transition={{ duration: 1, delay: 0.2 }} className="h-full bg-[#c1272d]" />
              </div>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-[#3a2d20]">
            <div className="text-[10px] uppercase tracking-wider text-[#8a7860]">Total bookings recorded</div>
            <div className="text-3xl font-serif text-[#f5e9d2] mt-1">{stats.totalBookings}</div>
          </div>
        </div>
      </div>

      <div className="border border-[#3a2d20] rounded-xl p-5 bg-[#241b12]/60">
        <div className="flex items-center justify-between mb-5">
          <div className="text-2xl font-serif italic text-[#f5e9d2]">Recent bookings</div>
          <span className="text-[10px] uppercase tracking-wider text-[#dc3545]">Live</span>
        </div>
        {recentBookings.length === 0 ? (
          <div className="text-center py-8 text-[#8a7860]">No bookings yet. Make one from the customer site!</div>
        ) : (
          <div className="space-y-2">
            {recentBookings.map(b => (
              <div key={b.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#2e2318]/40 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-900/40 via-red-900/30 to-zinc-900 flex items-center justify-center flex-shrink-0">
                  <Car className="w-4 h-4 text-white/40" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-[#f5e9d2] truncate">{b.customers?.full_name || "Customer"}</div>
                  <div className="text-xs text-[#8a7860]">{b.cars?.model || "Car"} · {b.days}d · {b.booking_code}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-[#f5e9d2] font-mono">{formatINR(b.total)}</div>
                  <StatusDot status={b.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function AdminFleet() {
  const [showAdd, setShowAdd] = useState(false);
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state for adding a new car
  const [form, setForm] = useState({
    brand: "", model: "", year: 2024, plate_number: "",
    price_per_day: 2500, seats: 5, category: "SUV",
    transmission: "Manual", fuel: "Petrol", odometer: 0
  });

  async function loadCars() {
    setLoading(true);
    const { data, error } = await supabase
      .from('cars').select('*').order('created_at', { ascending: false });
    if (error) console.error(error);
    else setCars(data || []);
    setLoading(false);
  }

  useEffect(() => { loadCars(); }, []);

  async function handleAddCar() {
    if (!form.brand || !form.model || !form.plate_number) {
      alert("Brand, Model and Plate are required");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('cars').insert({
      ...form,
      year: parseInt(form.year),
      price_per_day: parseInt(form.price_per_day),
      seats: parseInt(form.seats),
      odometer: parseInt(form.odometer),
      status: 'available'
    });
    setSaving(false);
    if (error) {
      alert("Error: " + error.message);
      return;
    }
    setShowAdd(false);
    setForm({ brand: "", model: "", year: 2024, plate_number: "", price_per_day: 2500, seats: 5, category: "SUV", transmission: "Manual", fuel: "Petrol", odometer: 0 });
    loadCars();
  }

  async function handleDeleteCar(id, name) {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    const { error } = await supabase.from('cars').delete().eq('id', id);
    if (error) alert("Error: " + error.message);
    else loadCars();
  }

  async function toggleStatus(car) {
    const newStatus = car.status === "available" ? "maintenance" : "available";
    const { error } = await supabase.from('cars').update({ status: newStatus }).eq('id', car.id);
    if (error) alert("Error: " + error.message);
    else loadCars();
  }

  return (
    <motion.div {...fadeUp}>
      <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
        <div>
          <div className="text-xs uppercase tracking-wider text-[#8a7860]">Manage your cars · live from database</div>
          <h1 className="text-4xl font-serif italic text-[#f5e9d2] mt-1">Fleet</h1>
        </div>
        <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-[#c1272d] text-[#f5e9d2] rounded-full text-xs uppercase tracking-wider inline-flex items-center gap-2">
          <Plus className="w-3.5 h-3.5" /> Add a car
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="border border-[#3a2d20] rounded-xl p-4"><div className="text-xs uppercase tracking-wider text-[#8a7860]">Total</div><div className="text-3xl font-serif text-[#f5e9d2] mt-1">{cars.length}</div></div>
        <div className="border border-[#3a2d20] rounded-xl p-4"><div className="text-xs uppercase tracking-wider text-[#dc3545]">Available</div><div className="text-3xl font-serif text-[#f5e9d2] mt-1">{cars.filter(c => c.status === "available").length}</div></div>
        <div className="border border-[#3a2d20] rounded-xl p-4"><div className="text-xs uppercase tracking-wider text-orange-300">On trip</div><div className="text-3xl font-serif text-[#f5e9d2] mt-1">{cars.filter(c => c.status === "rented").length}</div></div>
        <div className="border border-[#3a2d20] rounded-xl p-4"><div className="text-xs uppercase tracking-wider text-[#8a7860]">In service</div><div className="text-3xl font-serif text-[#f5e9d2] mt-1">{cars.filter(c => c.status === "maintenance").length}</div></div>
      </div>

      {loading ? (
        <div className="border border-[#3a2d20] rounded-xl p-12 text-center text-[#b8a484]">Loading…</div>
      ) : (
        <div className="border border-[#3a2d20] rounded-xl bg-[#241b12]/60 overflow-hidden">
          <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-[#3a2d20] text-[10px] uppercase tracking-wider text-[#8a7860]">
            <div className="col-span-4">Vehicle</div>
            <div className="col-span-2">Plate</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-1">Trips</div>
            <div className="col-span-2">Daily rate</div>
            <div className="col-span-1 text-right">Actions</div>
          </div>
          {cars.map((car, i) => (
            <motion.div key={car.id}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
              className="grid grid-cols-12 gap-4 items-center px-5 py-4 border-b border-[#3a2d20] last:border-0 hover:bg-[#2e2318]/40 transition-colors">
              <div className="col-span-4 flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-900/40 via-red-900/30 to-zinc-900 flex items-center justify-center flex-shrink-0">
                  <Car className="w-5 h-5 text-white/40" />
                </div>
                <div className="min-w-0">
                  <div className="text-[#f5e9d2] truncate">{car.brand} {car.model}</div>
                  <div className="text-xs text-[#8a7860]">{car.year} · {car.category}</div>
                </div>
              </div>
              <div className="col-span-2 text-xs font-mono text-[#d4c4a8]">{car.plate_number}</div>
              <div className="col-span-2">
                <button onClick={() => toggleStatus(car)} className="hover:opacity-80">
                  <StatusDot status={car.status} />
                </button>
              </div>
              <div className="col-span-1 text-[#f5e9d2] font-mono text-sm">{car.total_trips}</div>
              <div className="col-span-2 text-[#f5e9d2] font-mono">{formatINR(car.price_per_day)}</div>
              <div className="col-span-1 flex justify-end gap-1">
                <button onClick={() => handleDeleteCar(car.id, `${car.brand} ${car.model}`)}
                  className="w-8 h-8 rounded-lg border border-[#4d3d2c] hover:border-red-500/60 hover:text-red-400 flex items-center justify-center transition-colors">
                  <Trash2 className="w-3.5 h-3.5 text-[#b8a484]" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowAdd(false)}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-[#241b12] border border-[#4d3d2c] rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-serif italic text-[#f5e9d2]">Add a new car</h2>
                <button onClick={() => setShowAdd(false)} className="w-9 h-9 rounded-full border border-[#4d3d2c] flex items-center justify-center">
                  <X className="w-4 h-4 text-[#b8a484]" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { k: "brand", l: "Brand", p: "e.g. Maruti Suzuki" },
                  { k: "model", l: "Model", p: "e.g. Brezza" },
                  { k: "year", l: "Year", p: "2024", type: "number" },
                  { k: "plate_number", l: "Number plate", p: "MH15 KR 0009" },
                  { k: "price_per_day", l: "Daily rate (₹)", p: "2500", type: "number" },
                  { k: "seats", l: "Seats", p: "5", type: "number" },
                  { k: "odometer", l: "Odometer (km)", p: "0", type: "number" },
                ].map(f => (
                  <div key={f.k}>
                    <label className="text-[10px] uppercase tracking-wider text-[#8a7860]">{f.l}</label>
                    <input type={f.type || "text"} placeholder={f.p}
                      value={form[f.k]}
                      onChange={e => setForm({ ...form, [f.k]: e.target.value })}
                      className="w-full mt-1.5 bg-[#2e2318] border border-[#4d3d2c] rounded-lg px-4 py-2.5 text-[#f5e9d2] placeholder-[#6a5a48] outline-none focus:border-[#c1272d]/60" />
                  </div>
                ))}
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-[#8a7860]">Category</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                    className="w-full mt-1.5 bg-[#2e2318] border border-[#4d3d2c] rounded-lg px-4 py-2.5 text-[#f5e9d2]">
                    <option>SUV</option><option>Sedan</option><option>Hatchback</option><option>MPV</option><option>Electric</option><option>Luxury</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-[#8a7860]">Transmission</label>
                  <select value={form.transmission} onChange={e => setForm({ ...form, transmission: e.target.value })}
                    className="w-full mt-1.5 bg-[#2e2318] border border-[#4d3d2c] rounded-lg px-4 py-2.5 text-[#f5e9d2]">
                    <option>Manual</option><option>Automatic</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-[#8a7860]">Fuel</label>
                  <select value={form.fuel} onChange={e => setForm({ ...form, fuel: e.target.value })}
                    className="w-full mt-1.5 bg-[#2e2318] border border-[#4d3d2c] rounded-lg px-4 py-2.5 text-[#f5e9d2]">
                    <option>Petrol</option><option>Diesel</option><option>Electric</option><option>CNG</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-8">
                <button onClick={() => setShowAdd(false)} disabled={saving} className="px-5 py-2.5 border border-[#4d3d2c] text-[#d4c4a8] rounded-full text-xs uppercase tracking-wider disabled:opacity-50">Cancel</button>
                <button onClick={handleAddCar} disabled={saving} className="flex-1 bg-[#c1272d] hover:bg-[#d63239] text-[#f5e9d2] px-5 py-2.5 rounded-full text-xs uppercase tracking-wider disabled:opacity-50">
                  {saving ? "Saving..." : "Add to fleet"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function AdminBookings() {
  const [tab, setTab] = useState("all");
  const [showOffline, setShowOffline] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadBookings() {
    setLoading(true);
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        id, booking_code, from_date, to_date, days, total, status, source, payment_status,
        customers ( full_name, phone ),
        cars ( brand, model, plate_number )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading bookings:', error);
    } else {
      setBookings(data || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadBookings();
  }, []);

  const filtered = tab === "all" ? bookings : bookings.filter(b => b.status === tab);

  return (
    <motion.div {...fadeUp}>
      <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
        <div>
          <div className="text-xs uppercase tracking-wider text-[#8a7860]">All trips · live from database</div>
          <h1 className="text-4xl font-serif italic text-[#f5e9d2] mt-1">Bookings</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={loadBookings} className="px-4 py-2 border border-[#4d3d2c] text-[#d4c4a8] rounded-full text-xs uppercase tracking-wider hover:border-[#c1272d]/60">
            Refresh
          </button>
          <button onClick={() => setShowOffline(true)} className="px-4 py-2 bg-[#c1272d] text-[#f5e9d2] rounded-full text-xs uppercase tracking-wider inline-flex items-center gap-2">
            <Plus className="w-3.5 h-3.5" /> Add offline booking
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-6 border-b border-[#3a2d20] pb-3">
        {[
          { id: "all", l: "All", n: bookings.length },
          { id: "active", l: "Active", n: bookings.filter(b => b.status === "active").length },
          { id: "upcoming", l: "Upcoming", n: bookings.filter(b => b.status === "upcoming").length },
          { id: "completed", l: "Completed", n: bookings.filter(b => b.status === "completed").length },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-xs uppercase tracking-wider rounded-full transition-all ${
              tab === t.id ? "bg-[#2e2318] text-[#f5e9d2]" : "text-[#8a7860] hover:text-[#f5e9d2]"
            }`}>
            {t.l} <span className="text-[#6a5a48] ml-1">({t.n})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="border border-[#3a2d20] rounded-xl p-12 text-center">
          <div className="text-[#b8a484] text-sm uppercase tracking-widest">Loading bookings…</div>
        </div>
      ) : bookings.length === 0 ? (
        <div className="border border-[#3a2d20] rounded-xl p-12 text-center">
          <div className="text-[#b8a484]">No bookings yet. Make a test booking from the customer site!</div>
        </div>
      ) : (
        <div className="border border-[#3a2d20] rounded-xl bg-[#241b12]/60 overflow-hidden">
          <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-[#3a2d20] text-[10px] uppercase tracking-wider text-[#8a7860]">
            <div className="col-span-2">Booking</div>
            <div className="col-span-3">Customer</div>
            <div className="col-span-2">Vehicle</div>
            <div className="col-span-2">Dates</div>
            <div className="col-span-1">Source</div>
            <div className="col-span-1">Total</div>
            <div className="col-span-1 text-right">Status</div>
          </div>
          {filtered.map((b, i) => (
            <motion.div key={b.id}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
              className="grid grid-cols-12 gap-4 items-center px-5 py-4 border-b border-[#3a2d20] last:border-0 hover:bg-[#2e2318]/40 transition-colors text-sm">
              <div className="col-span-2 font-mono text-xs text-[#dc3545]">{b.booking_code}</div>
              <div className="col-span-3 min-w-0">
                <div className="text-[#f5e9d2] truncate">{b.customers?.full_name || "—"}</div>
                <div className="text-xs text-[#8a7860]">{b.customers?.phone || ""}</div>
              </div>
              <div className="col-span-2 text-[#d4c4a8] truncate">{b.cars?.model || "—"}</div>
              <div className="col-span-2 text-[#b8a484] text-xs font-mono">
                <div>{b.from_date}</div>
                <div className="text-[#6a5a48]">→ {b.to_date}</div>
              </div>
              <div className="col-span-1">
                <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${b.source === "offline" ? "bg-orange-300/10 text-orange-300" : "bg-blue-300/10 text-blue-300"}`}>
                  {b.source}
                </span>
              </div>
              <div className="col-span-1 text-[#f5e9d2] font-mono">{formatINR(b.total)}</div>
              <div className="col-span-1 flex justify-end"><StatusDot status={b.status} /></div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function AdminInvoices() {
  return (
    <motion.div {...fadeUp}>
      <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
        <div>
          <div className="text-xs uppercase tracking-wider text-[#8a7860]">GST-compliant invoicing</div>
          <h1 className="text-4xl font-serif italic text-[#f5e9d2] mt-1">Invoices</h1>
        </div>
        <button className="px-4 py-2 bg-[#c1272d] text-[#f5e9d2] rounded-full text-xs uppercase tracking-wider inline-flex items-center gap-2">
          <Plus className="w-3.5 h-3.5" /> Create manually
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-8">
        <div className="border border-[#3a2d20] rounded-xl p-5 bg-[#241b12]/60">
          <div className="text-xs uppercase tracking-wider text-[#8a7860]">Outstanding</div>
          <div className="text-3xl font-serif text-orange-300 mt-1">₹15,200</div>
          <div className="text-[10px] uppercase tracking-wider text-[#6a5a48] mt-2">1 invoice</div>
        </div>
        <div className="border border-[#3a2d20] rounded-xl p-5 bg-[#241b12]/60">
          <div className="text-xs uppercase tracking-wider text-[#8a7860]">Paid this month</div>
          <div className="text-3xl font-serif text-[#dc3545] mt-1">₹71,200</div>
          <div className="text-[10px] uppercase tracking-wider text-[#6a5a48] mt-2">5 invoices</div>
        </div>
        <div className="border border-[#3a2d20] rounded-xl p-5 bg-[#241b12]/60">
          <div className="text-xs uppercase tracking-wider text-[#8a7860]">GST collected (Apr)</div>
          <div className="text-3xl font-serif text-[#f5e9d2] mt-1">₹1.10L</div>
          <div className="text-[10px] uppercase tracking-wider text-[#6a5a48] mt-2">Auto-filed</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_400px] gap-6">
        <div className="border border-[#3a2d20] rounded-xl bg-[#241b12]/60 overflow-hidden">
          <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-[#3a2d20] text-[10px] uppercase tracking-wider text-[#8a7860]">
            <div className="col-span-3">Invoice #</div>
            <div className="col-span-3">Customer</div>
            <div className="col-span-2">Date</div>
            <div className="col-span-2">Amount</div>
            <div className="col-span-2 text-right">Status</div>
          </div>
          {BOOKINGS.map((b, i) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
              className="grid grid-cols-12 gap-4 items-center px-5 py-4 border-b border-[#3a2d20] last:border-0 hover:bg-[#2e2318]/40 cursor-pointer text-sm"
            >
              <div className="col-span-3 font-mono text-xs">
                <div className="text-[#dc3545]">INV-{b.id.slice(3)}</div>
                <div className="text-[#6a5a48] mt-0.5">linked to {b.id}</div>
              </div>
              <div className="col-span-3 text-[#f5e9d2] truncate">{b.customer}</div>
              <div className="col-span-2 text-[#b8a484] font-mono text-xs">{b.from}</div>
              <div className="col-span-2 text-[#f5e9d2] font-mono">{formatINR(b.total)}</div>
              <div className="col-span-2 flex justify-end items-center gap-2">
                <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${b.paid ? "bg-[#c1272d]/15 text-[#dc3545]" : "bg-orange-300/10 text-orange-300"}`}>
                  {b.paid ? "Paid" : "Pending"}
                </span>
                <button className="w-7 h-7 rounded-lg border border-[#4d3d2c] hover:border-[#c1272d]/50 flex items-center justify-center">
                  <Download className="w-3 h-3 text-[#b8a484]" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Invoice preview */}
        <div className="border border-[#3a2d20] rounded-xl bg-stone-50 text-[#1a130c] p-6 sticky top-24 self-start">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="font-serif italic text-2xl">DriveKaro</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-[#8a7860] mt-0.5">Self drive · Nashik</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-[#8a7860]">Invoice</div>
              <div className="text-sm font-mono text-[#1a130c]">INV-2841</div>
            </div>
          </div>
          <div className="border-t border-zinc-200 pt-4 mb-4">
            <div className="text-[10px] uppercase tracking-wider text-[#8a7860]">Bill to</div>
            <div className="text-[#1a130c] mt-1">Rahul Deshmukh</div>
            <div className="text-xs text-[#8a7860]">+91 98220 12345</div>
          </div>
          <div className="space-y-2 text-sm border-t border-zinc-200 pt-4">
            <div className="flex justify-between">
              <span className="text-[#6a5a48]">Hyundai Creta · 4 days</span>
              <span className="font-mono">₹12,800</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6a5a48]">CGST 9%</span>
              <span className="font-mono">₹1,152</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6a5a48]">SGST 9%</span>
              <span className="font-mono">₹1,152</span>
            </div>
            <div className="border-t border-zinc-200 pt-2 mt-2 flex justify-between">
              <span className="font-medium uppercase tracking-wider text-xs">Total</span>
              <span className="font-serif text-xl">₹15,104</span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-zinc-200 text-[10px] text-[#8a7860]">
            GSTIN 27AABCD1234E1Z5 · Payment via UPI/Razorpay · Auto-generated · Valid without signature.
          </div>
          <button className="w-full mt-4 bg-[#2e2318] text-[#f5e9d2] py-2.5 rounded-full text-xs uppercase tracking-wider inline-flex items-center justify-center gap-2 hover:bg-[#c1272d] hover:text-[#1a130c] transition-colors">
            <Download className="w-3.5 h-3.5" /> Download PDF
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function AdminCustomers() {
  const customers = [
    { name: "Rahul Deshmukh", phone: "+91 98220 12345", trips: 7, spent: 84200, status: "Gold", joined: "Sep 2025" },
    { name: "Priya Sharma", phone: "+91 99875 33421", trips: 4, spent: 41600, status: "Silver", joined: "Dec 2025" },
    { name: "Amit Patil", phone: "+91 90111 88299", trips: 3, spent: 32400, status: "Silver", joined: "Jan 2026" },
    { name: "Sneha Kulkarni", phone: "+91 88505 66442", trips: 1, spent: 3000, status: "New", joined: "Apr 2026" },
    { name: "Vikram Joshi", phone: "+91 97645 11220", trips: 2, spent: 18800, status: "New", joined: "Mar 2026" },
    { name: "Anjali Mehta", phone: "+91 99300 77118", trips: 5, spent: 67500, status: "Gold", joined: "Aug 2025" },
  ];

  return (
    <motion.div {...fadeUp}>
      <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
        <div>
          <div className="text-xs uppercase tracking-wider text-[#8a7860]">CRM</div>
          <h1 className="text-4xl font-serif italic text-[#f5e9d2] mt-1">Customers</h1>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 text-[#8a7860] absolute left-3 top-1/2 -translate-y-1/2" />
          <input placeholder="Search customers..." className="bg-[#241b12] border border-[#4d3d2c] rounded-full pl-10 pr-4 py-2 text-sm text-[#f5e9d2] placeholder-[#6a5a48] outline-none focus:border-[#c1272d]/60 w-64" />
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {customers.map((c, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="border border-[#3a2d20] rounded-xl p-5 bg-[#241b12]/60 hover:border-[#c1272d]/40 transition-colors"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#c1272d] to-orange-400 flex items-center justify-center text-[#f5e9d2] font-medium">
                  {c.name.split(" ").map(n => n[0]).join("")}
                </div>
                <div>
                  <div className="text-[#f5e9d2]">{c.name}</div>
                  <div className="text-xs text-[#8a7860]">{c.phone}</div>
                </div>
              </div>
              <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-full ${
                c.status === "Gold" ? "bg-[#c1272d]/15 text-[#dc3545]" :
                c.status === "Silver" ? "bg-[#d4c4a8]/15 text-[#d4c4a8]" :
                "bg-blue-300/10 text-blue-300"
              }`}>{c.status}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-[#3a2d20]">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[#8a7860]">Trips</div>
                <div className="text-xl font-serif text-[#f5e9d2] mt-1">{c.trips}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[#8a7860]">Lifetime</div>
                <div className="text-xl font-serif text-[#f5e9d2] mt-1">{formatINR(c.spent)}</div>
              </div>
            </div>
            <div className="mt-3 text-[10px] uppercase tracking-wider text-[#6a5a48]">Since {c.joined}</div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function AdminMaintenance() {
  const services = [
    { car: "Honda City", plate: "MH15 KR 0005", type: "Servicing", due: "Today", priority: "high" },
    { car: "Mahindra Thar ROXX", plate: "MH15 KR 0001", type: "Tyre rotation", due: "12 May", priority: "med" },
    { car: "Toyota Innova", plate: "MH15 KR 0003", type: "Insurance renewal", due: "20 May", priority: "med" },
    { car: "Maruti Swift", plate: "MH15 KR 0004", type: "Pollution check", due: "28 May", priority: "low" },
    { car: "BMW 3 Series", plate: "MH15 KR 0008", type: "Premium service", due: "05 Jun", priority: "low" },
  ];

  return (
    <motion.div {...fadeUp}>
      <div className="mb-8">
        <div className="text-xs uppercase tracking-wider text-[#8a7860]">Vehicle health</div>
        <h1 className="text-4xl font-serif italic text-[#f5e9d2] mt-1">Service & maintenance</h1>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-8">
        <div className="border border-orange-400/30 rounded-xl p-5 bg-orange-400/5">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-orange-400" />
            <div className="text-xs uppercase tracking-wider text-orange-400">Action needed</div>
          </div>
          <div className="text-3xl font-serif text-[#f5e9d2] mt-2">1</div>
          <div className="text-[10px] uppercase tracking-wider text-[#8a7860] mt-1">Due today</div>
        </div>
        <div className="border border-[#3a2d20] rounded-xl p-5 bg-[#241b12]/60">
          <div className="text-xs uppercase tracking-wider text-[#8a7860]">Upcoming this month</div>
          <div className="text-3xl font-serif text-[#f5e9d2] mt-2">4</div>
        </div>
        <div className="border border-[#3a2d20] rounded-xl p-5 bg-[#241b12]/60">
          <div className="text-xs uppercase tracking-wider text-[#8a7860]">Service spend YTD</div>
          <div className="text-3xl font-serif text-[#f5e9d2] mt-2">₹84,300</div>
        </div>
      </div>

      <div className="border border-[#3a2d20] rounded-xl bg-[#241b12]/60 overflow-hidden">
        {services.map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
            className="flex items-center gap-4 p-5 border-b border-[#3a2d20] last:border-0 hover:bg-[#2e2318]/40 transition-colors"
          >
            <div className={`w-1 h-12 rounded-full ${
              s.priority === "high" ? "bg-orange-400" :
              s.priority === "med" ? "bg-[#c1272d]" : "bg-[#6a5a48]"
            }`} />
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <div className="text-[#f5e9d2]">{s.car}</div>
                <span className="text-xs text-[#8a7860] font-mono">{s.plate}</span>
              </div>
              <div className="text-xs text-[#8a7860] mt-1">{s.type}</div>
            </div>
            <div className="text-right">
              <div className={`text-sm ${s.priority === "high" ? "text-orange-400" : "text-[#f5e9d2]"}`}>{s.due}</div>
              <div className="text-[10px] uppercase tracking-wider text-[#6a5a48]">due date</div>
            </div>
            <button className="px-4 py-2 border border-[#4d3d2c] hover:border-[#c1272d]/60 text-xs uppercase tracking-wider text-[#d4c4a8] rounded-full transition-colors">
              Schedule
            </button>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

/* ========================== ROOT ========================== */
export default function App() {
  const [view, setView] = useState("home");
  const [selectedCar, setSelectedCar] = useState(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [view]);

  return (
    <div className="min-h-screen bg-[#1a130c] text-[#f5e9d2]" style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <style>{`
        body { background: #1a130c; }
        .font-serif { font-family: 'Cormorant Garamond', 'Times New Roman', Georgia, serif; font-weight: 500; letter-spacing: -0.02em; }
        .font-mono { font-family: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: #1a130c; }
        ::-webkit-scrollbar-thumb { background: #3a2d20; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #4d3d2c; }
        input::placeholder { color: #6a5a48; }
        @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
      `}</style>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500;1,600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />

      <NoiseOverlay />
      <Nav view={view} setView={setView} />

      <main className="relative z-10">
        <AnimatePresence mode="wait">
          {view === "home" && <Landing key="home" setView={setView} setSelectedCar={setSelectedCar} />}
          {view === "fleet" && <FleetPage key="fleet" setView={setView} setSelectedCar={setSelectedCar} />}
          {view === "booking" && <BookingPage key="booking" car={selectedCar} setView={setView} />}
          {view === "customer-dash" && <CustomerDashboard key="cust" setView={setView} setSelectedCar={setSelectedCar} />}
          {view === "admin-dash" && <AdminDashboard key="admin" setView={setView} />}
        </AnimatePresence>
      </main>
    </div>
  );
}