import { useState, useEffect, useMemo, useCallback } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring, useReducedMotion } from "framer-motion";
import {
  Car, Menu, X, ArrowRight, ArrowUpRight, Calendar, MapPin, Users, Fuel,
  Settings, Star, Plus, Search, Filter, Download, Edit3, Trash2, Eye,
  TrendingUp, IndianRupee, Activity, CheckCircle2, Clock, AlertCircle,
  FileText, Receipt, BarChart3, LayoutGrid, Wrench, Bell, LogOut, CalendarDays,
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
  bg: "#f4e8d0",
  surface: "#fffaf4",
  surfaceAlt: "#ede3d5",
  border: "#d6c8b2",
  borderBright: "#bfaf9a",
  ink: "#1a120c",
  inkMuted: "#5a4838",
  accent: "#c74132",   // brand red
  accentDim: "#a33628",
  warn: "#ff7a45",
  ok: "#4ade80",
};

/* ========================== MOCK DATA ========================== */
const FLEET = [
  { id: "DK-01", brand: "Mahindra", model: "Thar ROXX", year: 2024, category: "SUV", seats: 5, transmission: "Manual", fuel: "Diesel", pricePerDay: 4500, status: "available", plate: "MH12 KR 0001", odometer: 12450, rating: 4.9, trips: 42, gradient: "from-orange-900/40 via-red-900/30 to-zinc-900" },
  { id: "DK-02", brand: "Hyundai", model: "Creta", year: 2024, category: "SUV", seats: 5, transmission: "Automatic", fuel: "Petrol", pricePerDay: 3200, status: "rented", plate: "MH12 KR 0002", odometer: 8930, rating: 4.8, trips: 31, gradient: "from-blue-900/40 via-indigo-900/30 to-zinc-900" },
  { id: "DK-03", brand: "Toyota", model: "Innova Crysta", year: 2023, category: "MPV", seats: 7, transmission: "Manual", fuel: "Diesel", pricePerDay: 3800, status: "available", plate: "MH12 KR 0003", odometer: 24100, rating: 4.7, trips: 67, gradient: "from-stone-800/50 via-zinc-800/40 to-zinc-900" },
  { id: "DK-04", brand: "Maruti Suzuki", model: "Swift", year: 2024, category: "Hatchback", seats: 5, transmission: "Manual", fuel: "Petrol", pricePerDay: 1500, status: "available", plate: "MH12 KR 0004", odometer: 5400, rating: 4.6, trips: 89, gradient: "from-rose-900/30 via-pink-900/20 to-zinc-900" },
  { id: "DK-05", brand: "Honda", model: "City", year: 2023, category: "Sedan", seats: 5, transmission: "Automatic", fuel: "Petrol", pricePerDay: 2800, status: "maintenance", plate: "MH12 KR 0005", odometer: 31200, rating: 4.5, trips: 54, gradient: "from-cyan-900/30 via-teal-900/20 to-zinc-900" },
  { id: "DK-06", brand: "Kia", model: "Seltos", year: 2024, category: "SUV", seats: 5, transmission: "Automatic", fuel: "Petrol", pricePerDay: 3400, status: "rented", plate: "MH12 KR 0006", odometer: 7800, rating: 4.8, trips: 28, gradient: "from-violet-900/30 via-purple-900/20 to-zinc-900" },
  { id: "DK-07", brand: "Tata", model: "Nexon EV", year: 2024, category: "Electric", seats: 5, transmission: "Automatic", fuel: "Electric", pricePerDay: 2900, status: "available", plate: "MH12 KR 0007", odometer: 4200, rating: 4.9, trips: 19, gradient: "from-lime-900/30 via-emerald-900/20 to-zinc-900" },
  { id: "DK-08", brand: "BMW", model: "3 Series", year: 2023, category: "Luxury", seats: 5, transmission: "Automatic", fuel: "Petrol", pricePerDay: 8500, status: "available", plate: "MH12 KR 0008", odometer: 14600, rating: 5.0, trips: 22, gradient: "from-slate-700/40 via-zinc-800/30 to-zinc-900" },
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
  { name: "SUV", value: 38, color: "#c74132" },
  { name: "Sedan", value: 22, color: "#a33628" },
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

/* ========================== ANIMATION UTILITIES ========================== */

// Animated number counter — counts from 0 to `value` over `duration`ms
function CountUpNumber({ value, format = v => String(v), duration = 1200 }) {
  const shouldReduce = useReducedMotion();
  const [displayed, setDisplayed] = useState(shouldReduce ? value : 0);
  useEffect(() => {
    if (shouldReduce || value === 0) { setDisplayed(value); return; }
    let start;
    let raf;
    function tick(now) {
      if (!start) start = now;
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // cubic ease-out
      setDisplayed(Math.round(eased * value));
      if (t < 1) raf = requestAnimationFrame(tick);
      else setDisplayed(value);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, shouldReduce]);
  return <span>{format(displayed)}</span>;
}

// Skeleton placeholder with shimmer — matches warm linen palette
function Skeleton({ className = "" }) {
  return (
    <div className={`relative overflow-hidden bg-[#ede3d5] ${className}`}>
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%)',
        animation: 'shimmer 1.4s infinite',
      }} />
    </div>
  );
}

// 3D tilt card — max 5° each axis, spring physics, disabled on touch/reduced-motion
function TiltCard({ children, disabled = false }) {
  const shouldReduce = useReducedMotion();
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => { setIsTouch(window.matchMedia('(hover: none)').matches); }, []);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [5, -5]), { stiffness: 300, damping: 30 });
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-5, 5]), { stiffness: 300, damping: 30 });
  const active = !disabled && !shouldReduce && !isTouch;
  function onMouseMove(e) {
    if (!active) return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  }
  function onMouseLeave() { mx.set(0); my.set(0); }
  return (
    <motion.div
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={active ? { rotateX, rotateY, transformStyle: 'preserve-3d' } : {}}
    >
      {children}
    </motion.div>
  );
}

/* ========================== SHARED COMPONENTS ========================== */
function StatusDot({ status }) {
  const config = {
    available: { color: "bg-emerald-400", text: "Available", ring: "shadow-[0_0_12px_rgba(74,222,128,0.6)]" },
    rented: { color: "bg-orange-400", text: "On Trip", ring: "" },
    maintenance: { color: "bg-[#9e8e7e]", text: "Servicing", ring: "" },
    active: { color: "bg-emerald-400", text: "Active", ring: "shadow-[0_0_8px_rgba(74,222,128,0.5)]" },
    completed: { color: "bg-[#9e8e7e]", text: "Completed", ring: "" },
    upcoming: { color: "bg-blue-400", text: "Upcoming", ring: "" },
    enquiry: { color: "bg-amber-400", text: "Pending confirmation", ring: "" },
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
  const allImages = (car.image_urls?.length > 0 ? car.image_urls : [car.image_url]).filter(Boolean);
  const hasPhotos = allImages.length > 0;
  const [idx, setIdx] = useState(0);
  const currentImg = allImages[Math.min(idx, allImages.length - 1)];

  return (
    <div className={`relative overflow-hidden rounded-2xl ${hasPhotos ? "bg-zinc-900" : `bg-gradient-to-br ${car.gradient}`} ${large ? "h-[26rem]" : "h-64"} group`}>
      {hasPhotos ? (
        <>
          <img src={currentImg} alt={car.model} className="absolute inset-0 w-full h-full object-cover transition-all duration-500" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/20" />
          {allImages.length > 1 && (
            <>
              <button onClick={e => { e.stopPropagation(); setIdx(i => (i - 1 + allImages.length) % allImages.length); }}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white text-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70 z-10">‹</button>
              <button onClick={e => { e.stopPropagation(); setIdx(i => (i + 1) % allImages.length); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white text-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70 z-10">›</button>
              <div className="absolute bottom-14 left-0 right-0 flex justify-center gap-1.5 z-10">
                {allImages.map((_, i) => (
                  <button key={i} onClick={e => { e.stopPropagation(); setIdx(i); }}
                    className={`rounded-full transition-all ${i === idx ? 'w-4 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/50'}`} />
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "linear-gradient(rgba(245,233,210,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(245,233,210,0.05) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
          <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-[#c74132]/15 blur-3xl rounded-full" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Car className={`text-white/15 group-hover:text-white/25 transition-all duration-700 group-hover:scale-110 ${large ? "w-40 h-40" : "w-28 h-28"}`} strokeWidth={1} />
          </div>
        </>
      )}
      <div className="absolute top-4 left-5 text-[10px] uppercase tracking-[0.2em] text-white/60 font-medium">{car.brand}</div>
      <div className="absolute top-4 right-5"><StatusDot status={car.status} /></div>
      <div className="absolute bottom-4 left-5 right-5">
        <div className={`text-white font-serif italic ${large ? "text-4xl" : "text-2xl"} leading-none tracking-tight`}>{car.model}</div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 mt-1">{car.category} · {car.year}</div>
      </div>
      <div className="absolute bottom-4 right-5 px-2 py-1 bg-black/40 border border-white/10 rounded text-[9px] font-mono text-white/60">{car.plate}</div>
    </div>
  );
}

/* ========================== TOP NAV ========================== */
function Nav({ ownerSession, customerProfile, onScrollTo, onCustomerSignIn, onCustomerSignOut }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const customerNav = [
    { id: "home", label: "Home", path: "/" },
    { id: "fleet", label: "Fleet", path: "/fleet" },
    { id: "customer-dash", label: "My Trips", path: "/my-trips" },
    { id: "faq", label: "FAQs", scroll: true },
    { id: "contact", label: "Contact", scroll: true },
  ];
  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#f4e8d0]/92 border-b border-[#d6c8b2]">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
        <button onClick={() => navigate("/")} className="flex items-center group">
          <img src="/logo-transparent.png" alt="DriveKaro" className="h-8 w-auto" />
        </button>

        <nav className="hidden md:flex items-center gap-1">
          {customerNav.map(n => (
            <button
              key={n.id}
              onClick={() => n.scroll ? onScrollTo(n.id) : navigate(n.path)}
              className={`px-4 py-2 text-sm rounded-full transition-all ${
                !n.scroll && pathname === n.path
                  ? "text-[#1a120c] bg-[#ede3d5]"
                  : "text-[#5a4838] hover:text-[#1a120c]"
              }`}
            >
              {n.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {ownerSession && (
            <button
              onClick={() => navigate("/admin")}
              className={`hidden sm:inline-flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-wider rounded-full border transition-all ${
                pathname === "/admin"
                  ? "bg-[#c74132] border-[#c74132] text-[#1a120c]"
                  : "border-[#bfaf9a] text-[#3d2e1e] hover:border-[#c74132] hover:text-[#d4483b]"
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              Admin
            </button>
          )}
          {customerProfile ? (
            <div className="flex items-center gap-2">
              <button onClick={() => navigate("/my-trips")}
                className="px-4 py-2 text-xs uppercase tracking-wider rounded-full bg-[#ede3d5] text-[#1a120c] hover:bg-[#d6c8b2] transition-colors">
                {customerProfile.full_name?.split(' ')[0] || 'My Trips'}
              </button>
              <button onClick={onCustomerSignOut}
                className="w-8 h-8 rounded-full border border-[#d6c8b2] flex items-center justify-center hover:border-[#c74132]/50 transition-colors" title="Sign out">
                <LogOut className="w-3.5 h-3.5 text-[#7a6858]" />
              </button>
            </div>
          ) : (
            <button onClick={onCustomerSignIn}
              className="px-4 py-2 text-xs uppercase tracking-wider rounded-full bg-[#0e0a06] text-[#f4e8d0] hover:bg-[#c74132] hover:text-[#1a120c] transition-colors">
              Sign in
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

/* ========================== PAGE MODAL (About / Terms / Privacy) ========================== */
const PAGE_DEFAULTS = {
  about: {
    title: 'About DriveKaro',
    content: `DriveKaro is a self-drive car rental service based in Pune, Maharashtra, India. Founded in 2024, we give people the freedom to drive on their own schedule — no driver, no compromise.

Our Fleet
We maintain a curated fleet of well-serviced vehicles ranging from compact hatchbacks to powerful SUVs. Every car is thoroughly cleaned, sanitised, and inspected before each rental.

Why DriveKaro?
• No driver required — you are in full control
• Transparent pricing with no hidden charges
• 24/7 availability and roadside support
• Home delivery and pickup across Pune

Our Location
Kool Homes Solitaire, Kausar Baugh, Kondhwa, Pune 411048
Phone: +91 76663 98984
Email: hi@drivekaro.in`,
  },
  terms: {
    title: 'Terms & Conditions',
    content: `Last updated: May 2026

1. ELIGIBILITY
Valid Indian driving licence required. Minimum age 21 years.

2. BOOKING & CONFIRMATION
Bookings are confirmed only after a call or message from our team.

3. RENTAL PERIOD
Midnight to midnight. A booking for May 9 to May 10 means the vehicle must be returned by 12:00 AM on May 10. Late returns are charged as an extra day.

4. SECURITY DEPOSIT
A refundable deposit is collected at handover and returned within 24 hours of a clean return.

5. FUEL POLICY
Vehicles are handed over with a marked fuel level and must be returned at the same level.

6. DAMAGE & LIABILITY
The renter is responsible for any damage during the rental period.

7. CANCELLATION
Full deposit refund for cancellations made 24+ hours before pickup.

8. PROHIBITED USE
No illegal use, racing, or sub-letting to third parties.

9. JURISDICTION
Laws of Maharashtra, India. Disputes subject to courts in Pune.`,
  },
  privacy: {
    title: 'Privacy Policy',
    content: `Last updated: May 2026

1. INFORMATION WE COLLECT
We collect your name, mobile number, email address, and booking details when you enquire or book through our platform.

2. HOW WE USE YOUR INFORMATION
Used solely to process your booking and contact you about your rental. Not shared with third parties.

3. DATA STORAGE
Stored securely. Booking records retained for accounting and legal purposes.

4. COMMUNICATIONS
By sharing your number, you consent to calls or WhatsApp messages from DriveKaro.

5. YOUR RIGHTS
Request data deletion at any time: hi@drivekaro.in

6. COOKIES
Minimal functional cookies only. No tracking or advertising cookies.

7. CONTACT
hi@drivekaro.in | +91 76663 98984`,
  },
};

function PageModal({ slug, onClose }) {
  const [page, setPage] = useState(PAGE_DEFAULTS[slug] || null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Try to load from Supabase (admin edits override defaults)
    supabase.from('site_pages').select('title, content').eq('slug', slug).maybeSingle()
      .then(({ data }) => {
        if (data?.content) setPage(data);
      });
  }, [slug]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="bg-[#fffaf4] border border-[#d6c8b2] rounded-2xl max-w-2xl w-full my-8">
        <div className="flex items-center justify-between px-8 py-6 border-b border-[#d6c8b2] sticky top-0 bg-[#fffaf4] rounded-t-2xl">
          <h2 className="text-2xl font-serif italic text-[#1a120c]">{loading ? '…' : page?.title}</h2>
          <button onClick={onClose} className="w-9 h-9 rounded-full border border-[#d6c8b2] flex items-center justify-center">
            <X className="w-4 h-4 text-[#7a6858]" />
          </button>
        </div>
        <div className="px-8 py-6">
          <div className="text-sm text-[#3d2e1e] leading-relaxed whitespace-pre-line">
            {page?.content || ''}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ========================== LANDING PAGE ========================== */
function Landing({ goToBooking, searchFrom, searchTo, setSearchFrom, setSearchTo }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [pickup, setPickup] = useState("Pune Hub (NIBM Road)");
  const [openFaq, setOpenFaq] = useState(null);
  const [featuredCars, setFeaturedCars] = useState([]);
  const [showPage, setShowPage] = useState(null);

  // Handle scroll-to from navigation state (e.g. FAQ/Contact from other pages)
  useEffect(() => {
    const scrollTo = location.state?.scrollTo;
    if (scrollTo) {
      setTimeout(() => document.getElementById(scrollTo)?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, []);

  useEffect(() => {
    const gradients = [
      "from-orange-900/40 via-red-900/30 to-zinc-900",
      "from-blue-900/40 via-indigo-900/30 to-zinc-900",
      "from-stone-800/50 via-zinc-800/40 to-zinc-900",
      "from-rose-900/30 via-pink-900/20 to-zinc-900",
      "from-violet-900/30 via-purple-900/20 to-zinc-900",
      "from-lime-900/30 via-emerald-900/20 to-zinc-900",
    ];
    supabase
      .from('cars')
      .select('id, brand, model, year, category, seats, transmission, fuel, price_per_day, status, plate_number, rating, total_trips, image_url, image_urls')
      .eq('status', 'available')
      .order('price_per_day', { ascending: false })
      .limit(6)
      .then(({ data }) => {
        if (data) setFeaturedCars(data.map((c, i) => ({
          id: c.id, brand: c.brand, model: c.model, year: c.year,
          category: c.category, seats: c.seats, transmission: c.transmission,
          fuel: c.fuel, pricePerDay: c.price_per_day, status: c.status,
          plate: c.plate_number, rating: c.rating, trips: c.total_trips,
          image_url: c.image_url || null,
          image_urls: c.image_urls || [],
          online_booking: c.online_booking !== false,
          gradient: gradients[i % gradients.length],
        })));
      });
  }, []);

  return (
    <motion.div {...fadeUp} className="relative">
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(193,39,45,0.20),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(232,170,90,0.10),transparent_60%)]" />

        <div className="relative max-w-[1400px] mx-auto px-6 lg:px-10 pt-20 pb-32">
          {/* Top label */}
          <motion.div {...stagger(0)} className="flex items-center gap-3 mb-12">
            <div className="h-px w-12 bg-[#bfaf9a]" />
            <span className="text-xs uppercase tracking-[0.3em] text-[#7a6858]">Issue 04 · Self drive rentals</span>
            <div className="h-px flex-1 bg-[#ede3d5] max-w-32" />
            <span className="text-xs text-[#9e8e7e] font-mono">PNE · IND</span>
          </motion.div>

          {/* Headline */}
          <div className="grid lg:grid-cols-12 gap-8 items-end">
            <motion.h1 {...stagger(0.1)} className="lg:col-span-9 text-[12vw] lg:text-[8.5rem] leading-[0.85] tracking-tight font-serif text-[#1a120c]">
              Keys in hand.
              <br />
              <span className="italic text-[#d4483b]">Open road</span>
              <span className="text-[#9e8e7e]"> ahead.</span>
            </motion.h1>
            <motion.div {...stagger(0.2)} className="lg:col-span-3 lg:pb-6">
              <p className="text-[#5a4838] text-base leading-relaxed border-l border-[#bfaf9a] pl-4">
                A curated fleet of self-drive cars from Pune. No driver, no schedule, no compromise. Pick a car. Drive away.
              </p>
            </motion.div>
          </div>

          {/* Booking widget */}
          <motion.div {...stagger(0.3)} className="mt-16 bg-[#fffaf4]/85 backdrop-blur border border-[#d6c8b2] rounded-2xl p-2">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-px bg-[#ede3d5] rounded-xl overflow-hidden">
              <div className="bg-[#fffaf4] p-5">
                <label className="text-[10px] uppercase tracking-[0.2em] text-[#7a6858] flex items-center gap-1.5">
                  <MapPin className="w-3 h-3" /> Pick up
                </label>
                <select value={pickup} onChange={e => setPickup(e.target.value)} className="mt-2 w-full bg-transparent text-[#1a120c] text-lg outline-none cursor-pointer">
                  <option>Pune Hub (NIBM Road)</option>
                </select>
              </div>
              <div className="bg-[#fffaf4] p-5">
                <label className="text-[10px] uppercase tracking-[0.2em] text-[#7a6858] flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" /> From
                </label>
                <input type="date" value={searchFrom} min={todayStr()} onChange={e => setSearchFrom(e.target.value)} className="mt-2 w-full bg-transparent text-[#1a120c] text-lg outline-none [color-scheme:light]" />
              </div>
              <div className="bg-[#fffaf4] p-5">
                <label className="text-[10px] uppercase tracking-[0.2em] text-[#7a6858] flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" /> Until
                </label>
                <input type="date" value={searchTo} min={searchFrom} onChange={e => setSearchTo(e.target.value)} className="mt-2 w-full bg-transparent text-[#1a120c] text-lg outline-none [color-scheme:light]" />
              </div>
              <button
                onClick={() => navigate("/fleet")}
                className="bg-[#c74132] hover:bg-[#d63239] text-[#1a120c] p-5 flex items-center justify-between group transition-colors"
              >
                <div className="text-left">
                  <div className="text-[10px] uppercase tracking-[0.2em] opacity-70">Continue</div>
                  <div className="text-lg font-medium">Find a car</div>
                </div>
                <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </motion.div>

          {/* Stats + trust signals */}
          <motion.div {...stagger(0.4)} className="mt-20 border-t border-[#d6c8b2] pt-10">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
              {[
                { num: "4", label: "Cars in fleet" },
                { num: "150+", label: "Trips completed" },
                { num: "4.9", label: "Google rating", suffix: "★" },
                { num: "24/7", label: "Always available" },
              ].map((s, i) => (
                <div key={i}>
                  <div className="text-5xl font-serif text-[#1a120c] flex items-baseline gap-1">
                    {s.num}
                    {s.suffix && <span className="text-[#d4483b] text-2xl">{s.suffix}</span>}
                  </div>
                  <div className="text-xs uppercase tracking-[0.2em] text-[#7a6858] mt-2">{s.label}</div>
                </div>
              ))}
            </div>
            {/* Trust badges */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#d6c8b2] bg-[#fffaf4]/60 text-xs text-[#3d2e1e]">
                <span className="text-yellow-400">★</span> 4.9 on Google · 37 verified reviews
              </div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#d6c8b2] bg-[#fffaf4]/60 text-xs text-[#3d2e1e]">
                <Clock className="w-3.5 h-3.5 text-[#c74132]" /> Open 24 hours
              </div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#d6c8b2] bg-[#fffaf4]/60 text-xs text-[#3d2e1e]">
                <Shield className="w-3.5 h-3.5 text-[#c74132]" /> Fully insured fleet
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FEATURED FLEET */}
      <section className="relative max-w-[1400px] mx-auto px-6 lg:px-10 py-24">
        <div className="flex items-end justify-between mb-12 flex-wrap gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
            <div className="text-xs uppercase tracking-[0.3em] text-[#d4483b] mb-3">— The Fleet</div>
            <h2 className="text-5xl md:text-6xl font-serif italic text-[#1a120c] leading-none">
              Built for <span className="not-italic text-[#9e8e7e]">every</span> mile.
            </h2>
            <motion.div className="h-px bg-[#c74132] mt-4 origin-left"
              initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }}
              viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.35, ease: [0.22, 1, 0.36, 1] }} />
          </motion.div>
          <button onClick={() => navigate("/fleet")} className="text-sm uppercase tracking-wider text-[#5a4838] hover:text-[#d4483b] inline-flex items-center gap-2 group">
            View all cars
            <ArrowUpRight className="w-4 h-4 group-hover:rotate-45 transition-transform" />
          </button>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {featuredCars.length === 0
            ? [...Array(6)].map((_, i) => (
                <div key={i}>
                  <Skeleton className="h-44 rounded-2xl" />
                  <div className="mt-4 space-y-2">
                    <Skeleton className="h-3 w-1/3 rounded" />
                    <Skeleton className="h-5 w-2/3 rounded" />
                    <Skeleton className="h-3 w-1/2 rounded" />
                  </div>
                </div>
              ))
            : featuredCars.map((car, i) => (
                <motion.div
                  key={car.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.6, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
                  onClick={() => goToBooking(car)}
                  className="cursor-pointer group"
                >
                  <CarVisual car={car} />
                  <div className="mt-4 flex items-start justify-between">
                    <div>
                      <div className="text-xs text-[#7a6858] uppercase tracking-wider">{car.brand}</div>
                      <div className="text-lg text-[#1a120c] font-medium break-words">{car.model}</div>
                      <div className="flex items-center gap-3 mt-2 text-xs text-[#7a6858]">
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" />{car.seats}</span>
                        <span className="flex items-center gap-1"><Settings className="w-3 h-3" />{car.transmission === 'Automatic' ? 'Auto' : 'Manual'}</span>
                        <span className="flex items-center gap-1"><Fuel className="w-3 h-3" />{car.fuel}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl text-[#1a120c] font-serif">{formatINR(car.pricePerDay)}</div>
                      <div className="text-[10px] uppercase tracking-wider text-[#7a6858]">per day</div>
                    </div>
                  </div>
                </motion.div>
              ))
          }
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="relative bg-[#ede3d5] border-y border-[#d6c8b2] py-24">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
            <div className="text-xs uppercase tracking-[0.3em] text-[#d4483b] mb-3">— Process</div>
            <h2 className="text-5xl md:text-6xl font-serif italic text-[#1a120c] leading-none mb-4">
              Four steps. <span className="not-italic text-[#9e8e7e]">Then drive.</span>
            </h2>
            <motion.div className="h-px bg-[#c74132] mb-12 origin-left"
              initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }}
              viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.35, ease: [0.22, 1, 0.36, 1] }} />
          </motion.div>

          <div className="grid md:grid-cols-4 gap-px bg-[#ede3d5] rounded-xl overflow-hidden">
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
                className="bg-[#fffaf4] p-8 hover:bg-[#ede3d5]/60 transition-colors group"
              >
                <div className="text-[#d4483b] font-mono text-xs mb-6">{step.n} / 04</div>
                <div className="text-2xl text-[#1a120c] font-serif mb-3">{step.t}</div>
                <div className="text-sm text-[#7a6858] leading-relaxed">{step.d}</div>
                <div className="mt-8 h-px bg-[#d6c8b2] group-hover:bg-[#c74132] transition-colors" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* REVIEWS */}
      <section className="relative max-w-[1400px] mx-auto px-6 lg:px-10 py-24">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
            <div className="text-xs uppercase tracking-[0.3em] text-[#d4483b] mb-3">— Google reviews</div>
            <h2 className="text-5xl md:text-6xl font-serif italic text-[#1a120c] leading-none">
              What customers say.
            </h2>
            <motion.div className="h-px bg-[#c74132] mt-4 origin-left"
              initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }}
              viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.35, ease: [0.22, 1, 0.36, 1] }} />
          </motion.div>
          <div className="flex items-center gap-3 px-5 py-3 border border-[#d6c8b2] rounded-full bg-[#fffaf4]">
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              ))}
            </div>
            <span className="text-[#1a120c] font-medium">4.9</span>
            <span className="text-[#9e8e7e] text-sm">· 37 reviews on Google</span>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Review 1 — Mahesh Singh */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.6 }}
            className="border border-[#d6c8b2] rounded-2xl p-7 bg-[#fffaf4] flex flex-col">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                  MS
                </div>
                <div>
                  <div className="text-[#1a120c] font-medium">Mahesh Singh</div>
                  <div className="text-xs text-[#7a6858]">Local Guide · 14 reviews · 3 photos</div>
                </div>
              </div>
              <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            </div>
            <div className="flex items-center gap-2 mb-4">
              {[...Array(5)].map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />)}
              <span className="text-xs text-[#9e8e7e] ml-1">8 weeks ago</span>
            </div>
            <p className="text-sm text-[#3d2e1e] leading-relaxed flex-1">
              I found Drive Karo via Google — and had the smoothest experience renting from them! Amaan was very courteous, helpful and prompt in handling all my queries about the rental. He delivered the car at home and picked it up as well. The car itself was quite good and served our purpose very well — we drove from Pune to Navsari, to Mumbai and back to Pune — and I enjoyed driving it. I will recommend Drive Karo for anyone looking to rent a self-drive car in Pune 👍🏼
            </p>
          </motion.div>

          {/* Review 2 — Riyaz Ali Munsoori */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.1 }}
            className="border border-[#d6c8b2] rounded-2xl p-7 bg-[#fffaf4] flex flex-col">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                  RA
                </div>
                <div>
                  <div className="text-[#1a120c] font-medium">Riyaz Ali Munsoori</div>
                  <div className="text-xs text-[#7a6858]">11 reviews · 2 photos</div>
                </div>
              </div>
              <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            </div>
            <div className="flex items-center gap-2 mb-4">
              {[...Array(5)].map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />)}
              <span className="text-xs text-[#9e8e7e] ml-1">24 weeks ago</span>
            </div>
            <p className="text-sm text-[#3d2e1e] leading-relaxed flex-1">
              Great experience. Cars are well maintained and host is super understanding and friendly. Better rates than Zoomcar for less than 7 days drive. I have already used their car for 3 different trips and all went smooth.
            </p>
          </motion.div>
        </div>

        {/* Feature strips */}
        <div className="grid md:grid-cols-3 gap-4 mt-8">
          {[
            { i: Zap, t: "Instant confirmation", d: "Book and confirm in under 2 minutes." },
            { i: Award, t: "Sanitised between trips", d: "Detailed checklist on every handover." },
            { i: Shield, t: "Zero hidden fees", d: "What you see is what you pay." },
          ].map((f, i) => {
            const Icon = f.i;
            return (
              <div key={i} className="border border-[#d6c8b2] rounded-xl p-5 flex items-start gap-4 hover:border-[#c74132]/40 transition-colors">
                <div className="w-9 h-9 rounded-lg bg-[#c74132]/10 border border-[#c74132]/20 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-[#d4483b]" />
                </div>
                <div>
                  <div className="text-[#1a120c] font-medium text-sm">{f.t}</div>
                  <div className="text-xs text-[#7a6858] mt-1">{f.d}</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="relative bg-[#ede3d5] border-y border-[#d6c8b2] py-24">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10">
          <div className="grid lg:grid-cols-12 gap-16 items-start">
            <div className="lg:col-span-4">
              <div className="text-xs uppercase tracking-[0.3em] text-[#d4483b] mb-3">— FAQ</div>
              <h2 className="text-5xl font-serif italic text-[#1a120c] leading-none mb-6">
                Common questions.
              </h2>
              <p className="text-sm text-[#7a6858] leading-relaxed mb-8">
                Still have questions? Call us any time — we're open 24 hours.
              </p>
              <a href="tel:+917666398984"
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#c74132] text-[#1a120c] rounded-full text-sm uppercase tracking-wider hover:bg-[#a33628] transition-colors">
                <Phone className="w-4 h-4" /> +91 76663 98984
              </a>
            </div>

            <div className="lg:col-span-8 space-y-2">
              {[
                {
                  q: "What documents do I need to rent a car?",
                  a: "A valid driving licence (original), Aadhaar card, and a refundable security deposit. That's it — no lengthy paperwork."
                },
                {
                  q: "How does the rental period work?",
                  a: "Each rental day runs midnight to midnight (12:00 AM – 12:00 AM). A booking for May 9 → May 10 means you pick up any time on May 9 and must return by 12:00 AM on May 10. Late returns are charged as an extra day."
                },
                {
                  q: "Is there a minimum rental period?",
                  a: "Minimum rental is 1 day (midnight to midnight). We offer daily, weekly, and monthly rates — the longer you rent, the better the rate."
                },
                {
                  q: "Do you offer home delivery and pickup?",
                  a: "Yes! We deliver and collect the car at your doorstep anywhere in Pune. Delivery charges may apply based on distance."
                },
                {
                  q: "Is fuel included in the rental price?",
                  a: "No, fuel is not included. You receive the car with a marked fuel level and must return it at the same level."
                },
                {
                  q: "What is the security deposit?",
                  a: "A refundable security deposit of ₹5,000 is collected at the time of handover and returned within 24 hours of the car being returned in good condition."
                },
                {
                  q: "Can I take the car outside Pune / out of Maharashtra?",
                  a: "Interstate travel is allowed with prior intimation. Additional charges may apply. Please inform us before you plan an outstation trip."
                },
                {
                  q: "What happens if the car breaks down?",
                  a: "We provide 24/7 roadside assistance. Call us immediately — we'll arrange a replacement or help on the spot at no extra cost for mechanical failures."
                },
                {
                  q: "How do I confirm my booking?",
                  a: "Submit your enquiry on the site and call us on +91 76663 98984. We'll confirm availability, collect the deposit, and schedule delivery — all in one call."
                },
              ].map((f, i) => (
                <div key={i} className="border border-[#d6c8b2] rounded-xl bg-[#fffaf4] overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between px-6 py-4 text-left gap-4 hover:bg-[#f5ede0] transition-colors">
                    <span className="text-[#1a120c] font-medium text-sm">{f.q}</span>
                    <ChevronDown className={`w-4 h-4 text-[#c74132] flex-shrink-0 transition-transform duration-300 ${openFaq === i ? "rotate-180" : ""}`} />
                  </button>
                  <AnimatePresence>
                    {openFaq === i && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}>
                        <div className="px-6 pb-5 text-sm text-[#5a4838] leading-relaxed border-t border-[#d6c8b2] pt-4">
                          {f.a}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CONTACT US */}
      <section id="contact" className="relative max-w-[1400px] mx-auto px-6 lg:px-10 py-24">
        <div className="text-xs uppercase tracking-[0.3em] text-[#d4483b] mb-3">— Contact us</div>
        <h2 className="text-5xl md:text-6xl font-serif italic text-[#1a120c] leading-none mb-16">
          Let's talk.
        </h2>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left — call + details */}
          <div className="space-y-6">
            <div className="border border-[#d6c8b2] rounded-2xl p-8 bg-[#fffaf4]">
              <div className="text-xs uppercase tracking-wider text-[#7a6858] mb-2">Call or WhatsApp</div>
              <a href="tel:+917666398984"
                className="text-5xl font-serif text-[#c74132] hover:text-[#a33628] transition-colors block mb-1">
                +91 76663 98984
              </a>
              <div className="text-xs text-[#9e8e7e] uppercase tracking-wider">Open 24 hours · 7 days a week</div>
              <div className="flex gap-3 mt-6">
                <a href="tel:+917666398984"
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#c74132] text-[#1a120c] rounded-full text-xs uppercase tracking-wider hover:bg-[#a33628] transition-colors">
                  <Phone className="w-3.5 h-3.5" /> Call now
                </a>
                <a href="https://wa.me/917666398984" target="_blank" rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 py-3 border border-[#bfaf9a] text-[#3d2e1e] rounded-full text-xs uppercase tracking-wider hover:border-[#c74132]/50 transition-colors">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  WhatsApp
                </a>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="border border-[#d6c8b2] rounded-xl p-5 bg-[#fffaf4]">
                <Mail className="w-4 h-4 text-[#c74132] mb-3" />
                <div className="text-xs uppercase tracking-wider text-[#7a6858] mb-1">Email</div>
                <a href="mailto:hi@drivekaro.in" className="text-sm text-[#1a120c] hover:text-[#c74132] transition-colors">hi@drivekaro.in</a>
              </div>
              <div className="border border-[#d6c8b2] rounded-xl p-5 bg-[#fffaf4]">
                <Clock className="w-4 h-4 text-[#c74132] mb-3" />
                <div className="text-xs uppercase tracking-wider text-[#7a6858] mb-1">Hours</div>
                <div className="text-sm text-[#1a120c]">Open 24 hours</div>
              </div>
            </div>
          </div>

          {/* Right — address + map link + social */}
          <div className="space-y-4">
            <div className="border border-[#d6c8b2] rounded-2xl p-8 bg-[#fffaf4]">
              <MapPin className="w-5 h-5 text-[#c74132] mb-4" />
              <div className="text-xs uppercase tracking-wider text-[#7a6858] mb-2">Find us</div>
              <div className="text-[#1a120c] text-lg font-serif italic leading-snug mb-1">
                Kool Homes Solitaire
              </div>
              <div className="text-sm text-[#5a4838] leading-relaxed mb-6">
                Kausar Baugh, Kondhwa<br />Pune, Maharashtra 411048
              </div>
              <a href="https://maps.google.com/?q=Kool+Homes+Solitaire+Kondhwa+Pune" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 border border-[#bfaf9a] text-[#3d2e1e] rounded-full text-xs uppercase tracking-wider hover:border-[#c74132]/50 transition-colors">
                <ArrowUpRight className="w-3.5 h-3.5" /> Open in Google Maps
              </a>
            </div>

            <div className="border border-[#d6c8b2] rounded-xl p-6 bg-[#fffaf4] flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </div>
              <div className="flex-1">
                <div className="text-xs uppercase tracking-wider text-[#7a6858] mb-0.5">Follow us</div>
                <a href="https://www.instagram.com/drivekaro.in" target="_blank" rel="noopener noreferrer"
                  className="text-[#1a120c] font-medium hover:text-[#c74132] transition-colors">@drivekaro.in</a>
              </div>
              <ArrowUpRight className="w-4 h-4 text-[#9e8e7e]" />
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-[#d6c8b2]">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-16">
          <div className="grid md:grid-cols-4 gap-12">
            <div className="md:col-span-2">
              <img src="/logo-transparent.png" alt="DriveKaro" className="h-12 w-auto mb-4" />
              <p className="text-[#7a6858] text-sm max-w-sm leading-relaxed">
                Self-drive car rentals based in Pune, Maharashtra. Built for travellers who'd rather hold the wheel themselves.
              </p>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-[#9e8e7e] mb-4">Contact</div>
              <div className="text-sm text-[#3d2e1e] space-y-2">
                <div className="flex items-center gap-2"><Phone className="w-3 h-3" /> +91 76663 98984</div>
                <div className="flex items-center gap-2"><Mail className="w-3 h-3" /> hi@drivekaro.in</div>
                <div className="flex items-start gap-2">
                  <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span className="leading-snug">Kool Homes Solitaire,<br />Kausar Baugh, Kondhwa,<br />Pune 411048</span>
                </div>
                <a href="https://www.instagram.com/drivekaro.in" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:text-[#c74132] transition-colors">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                  @drivekaro.in
                </a>
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-[#9e8e7e] mb-4">Company</div>
              <div className="text-sm text-[#3d2e1e] space-y-2">
                {[
                  { label: 'About', action: () => setShowPage('about') },
                  { label: 'Terms', action: () => setShowPage('terms') },
                  { label: 'Privacy', action: () => setShowPage('privacy') },
                  { label: 'FAQs', action: () => document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' }) },
                ].map(({ label, action }) => (
                  <button key={label} onClick={action}
                    className="block hover:text-[#c74132] transition-colors">
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-16 pt-8 border-t border-[#d6c8b2] flex flex-wrap items-center justify-between gap-4 text-xs text-[#9e8e7e]">
            <div>© 2026 DriveKaro · Pune, Maharashtra</div>
            <button
              onClick={() => window.__dk_admin?.()}
              className="font-mono opacity-20 hover:opacity-60 transition-opacity cursor-default select-none"
            >
              v1.0.0
            </button>
          </div>
        </div>
      </footer>

      <AnimatePresence>
        {showPage && <PageModal slug={showPage} onClose={() => setShowPage(null)} />}
      </AnimatePresence>
    </motion.div>
  );
}

/* ========================== FLEET PAGE ========================== */
function FleetPage({ setView, goToBooking, searchFrom, searchTo, setSearchFrom, setSearchTo }) {
  const [filter, setFilter] = useState("All");
  const [transmission, setTransmission] = useState("All");
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bookedCarIds, setBookedCarIds] = useState(new Set());
  const [checkingDates, setCheckingDates] = useState(false);
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
        image_url: c.image_url || null,
        image_urls: c.image_urls || [],
        online_booking: c.online_booking !== false,
        gradient: gradients[i % gradients.length]
      }));
      setCars(mapped);
      setLoading(false);
    }
    loadCars();
  }, []);

  useEffect(() => {
    if (!searchFrom || !searchTo) return;
    async function checkAvailability() {
      setCheckingDates(true);
      const { data } = await supabase
        .from('bookings')
        .select('car_id')
        .not('status', 'in', '("completed","cancelled","enquiry")')
        .lte('from_date', searchTo)
        .gte('to_date', searchFrom);
      setBookedCarIds(new Set((data || []).map(b => b.car_id)));
      setCheckingDates(false);
    }
    checkAvailability();
  }, [searchFrom, searchTo]);

  const filtered = cars.filter(c =>
    (filter === "All" || c.category === filter) &&
    (transmission === "All" || c.transmission === transmission)
  );
  const availableCount = filtered.filter(c => !bookedCarIds.has(c.id) && c.status !== 'maintenance').length;

  if (loading) {
    return (
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-16">
        <div className="flex items-end justify-between mb-8">
          <div className="space-y-2"><Skeleton className="h-5 w-32 rounded" /><Skeleton className="h-10 w-64 rounded-lg" /></div>
          <Skeleton className="h-8 w-24 rounded-full" />
        </div>
        <div className="flex gap-3 mb-10"><Skeleton className="h-8 w-16 rounded-full" /><Skeleton className="h-8 w-16 rounded-full" /><Skeleton className="h-8 w-24 rounded-full" /></div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i}>
              <Skeleton className="h-44 rounded-2xl" />
              <div className="mt-4 p-4 border border-[#d6c8b2] rounded-xl space-y-3">
                <Skeleton className="h-3 w-1/3 rounded" />
                <Skeleton className="h-5 w-2/3 rounded" />
                <Skeleton className="h-10 rounded-lg" />
                <div className="flex justify-between"><Skeleton className="h-6 w-1/3 rounded" /><Skeleton className="h-4 w-16 rounded" /></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const fmt = d => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

  return (
    <motion.div {...fadeUp} className="max-w-[1400px] mx-auto px-6 lg:px-10 py-16">
      <div className="flex items-end justify-between flex-wrap gap-6 mb-8">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-[#d4483b] mb-3">— The Fleet</div>
          <h1 className="text-6xl md:text-7xl font-serif italic text-[#1a120c] leading-none">
            All cars. <span className="not-italic text-[#9e8e7e]">One garage.</span>
          </h1>
        </div>
        <div className="text-right">
          <div className="text-4xl font-serif text-[#1a120c]">{checkingDates ? "—" : `${availableCount}/${filtered.length}`}</div>
          <div className="text-xs uppercase tracking-wider text-[#7a6858]">
            {checkingDates ? "checking…" : "free for your dates"}
          </div>
        </div>
      </div>

      {/* Date selector */}
      <div className="flex flex-wrap items-center gap-3 mb-8 p-4 bg-[#fffaf4] border border-[#d6c8b2] rounded-xl">
        <Calendar className="w-4 h-4 text-[#c74132] flex-shrink-0" />
        <span className="text-xs uppercase tracking-wider text-[#7a6858]">Showing availability for</span>
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          <input type="date" value={searchFrom} min={todayStr()} onChange={e => setSearchFrom(e.target.value)}
            className="bg-[#ede3d5] border border-[#bfaf9a] rounded-lg px-3 py-1.5 text-sm text-[#1a120c] outline-none focus:border-[#c74132]/60 [color-scheme:light]" />
          <span className="text-[#9e8e7e]">→</span>
          <input type="date" value={searchTo} min={searchFrom} onChange={e => setSearchTo(e.target.value)}
            className="bg-[#ede3d5] border border-[#bfaf9a] rounded-lg px-3 py-1.5 text-sm text-[#1a120c] outline-none focus:border-[#c74132]/60 [color-scheme:light]" />
        </div>
        {!checkingDates && (
          <span className="text-xs text-[#5a4838] font-medium">
            {availableCount === 0
              ? `All cars booked · ${fmt(searchFrom)} → ${fmt(searchTo)}`
              : `${availableCount} of ${filtered.length} free · ${fmt(searchFrom)} → ${fmt(searchTo)}`}
          </span>
        )}
        {checkingDates && <span className="text-xs text-[#9e8e7e]">Checking bookings…</span>}
      </div>

      <div className="flex flex-wrap gap-6 mb-10 pb-6 border-b border-[#d6c8b2]">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#7a6858] mb-2">Category</div>
          <div className="flex flex-wrap gap-2">
            {categories.map(c => (
              <button key={c} onClick={() => setFilter(c)}
                className={`px-4 py-1.5 text-xs uppercase tracking-wider rounded-full border transition-all ${
                  filter === c ? "bg-[#c74132] border-[#c74132] text-[#1a120c]" : "border-[#bfaf9a] text-[#5a4838] hover:border-[#9e8e7e]"
                }`}>{c}</button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#7a6858] mb-2">Transmission</div>
          <div className="flex gap-2">
            {["All", "Manual", "Automatic"].map(t => (
              <button key={t} onClick={() => setTransmission(t)}
                className={`px-4 py-1.5 text-xs uppercase tracking-wider rounded-full border transition-all ${
                  transmission === t ? "bg-[#c74132] border-[#c74132] text-[#1a120c]" : "border-[#bfaf9a] text-[#5a4838] hover:border-[#9e8e7e]"
                }`}>{t}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {filtered.map((car, i) => {
            const isBooked = bookedCarIds.has(car.id);
            const isMaint = car.status === 'maintenance';
            const unavailable = isBooked || isMaint;
            const badgeLabel = isBooked ? "Booked" : isMaint ? "In service" : null;

            return (
              <TiltCard key={car.id} disabled={unavailable}>
              <motion.div layout
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.4, delay: i * 0.04 }}
                onClick={unavailable ? undefined : () => goToBooking(car)}
                className={unavailable ? "cursor-not-allowed" : "cursor-pointer group"}>

                {/* Car visual — greyed if unavailable */}
                <div className={`relative transition-all duration-300 ${unavailable ? "grayscale opacity-50" : ""}`}>
                  <CarVisual car={car} />
                  {badgeLabel && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-2xl">
                      <span className="bg-black/75 backdrop-blur-sm text-white text-xs uppercase tracking-[0.2em] px-5 py-2 rounded-full font-medium">
                        {badgeLabel}
                      </span>
                    </div>
                  )}
                </div>

                {/* Info card */}
                <div className={`mt-4 p-4 border rounded-xl transition-colors ${
                  unavailable
                    ? "border-[#d6c8b2] opacity-50"
                    : "border-[#d6c8b2] hover:border-[#c74132]/40"
                }`}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="text-xs text-[#7a6858] uppercase tracking-wider">{car.brand}</div>
                      <div className="text-lg text-[#1a120c] font-medium">{car.model}</div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-[#5a4838]">
                      <Star className="w-3 h-3 fill-[#d4483b] text-[#d4483b]" />{car.rating}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 py-3 border-y border-[#d6c8b2] text-center">
                    <div><Users className="w-3.5 h-3.5 text-[#7a6858] mx-auto mb-1" /><div className="text-[10px] uppercase tracking-wider text-[#7a6858]">{car.seats} seats</div></div>
                    <div><Settings className="w-3.5 h-3.5 text-[#7a6858] mx-auto mb-1" /><div className="text-[10px] uppercase tracking-wider text-[#7a6858]">{car.transmission === 'Automatic' ? 'Auto' : 'Manual'}</div></div>
                    <div><Fuel className="w-3.5 h-3.5 text-[#7a6858] mx-auto mb-1" /><div className="text-[10px] uppercase tracking-wider text-[#7a6858]">{car.fuel}</div></div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div>
                      <span className="text-2xl text-[#1a120c] font-serif">{formatINR(car.pricePerDay)}</span>
                      <span className="text-xs text-[#7a6858] ml-1">/day</span>
                    </div>
                    {unavailable ? (
                      <span className="text-xs uppercase tracking-wider text-[#9e8e7e]">{badgeLabel}</span>
                    ) : !car.online_booking ? (
                      <span className="text-xs uppercase tracking-wider text-[#7a6858] inline-flex items-center gap-1">
                        <Phone className="w-3 h-3" /> Contact to book
                      </span>
                    ) : (
                      <span className="text-xs uppercase tracking-wider text-[#d4483b] inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                        Book <ArrowRight className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
              </TiltCard>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* ========================== BOOKING PAGE ========================== */
function BookingPage({ setView, searchFrom, searchTo }) {
  const { state } = useLocation();
  const car = state?.car;
  const [step, setStep] = useState(1);
  const [stepDir, setStepDir] = useState(1); // 1=forward, -1=backward
  const [from, setFrom] = useState(searchFrom || todayStr());
  const [to, setTo] = useState(searchTo || plusDays(3));
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [success, setSuccess] = useState(false);
  const [enquiryCode, setEnquiryCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [availabilityChecking, setAvailabilityChecking] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");

  async function checkAvailability() {
    setAvailabilityChecking(true);
    setAvailabilityError("");
    if (from < todayStr()) {
      setAvailabilityError("Pickup date cannot be in the past. Please choose today or a future date.");
      setAvailabilityChecking(false);
      return false;
    }
    if (to <= from) {
      setAvailabilityError("Return date must be after the pickup date.");
      setAvailabilityChecking(false);
      return false;
    }
    const { data, error: qErr } = await supabase
      .from('bookings')
      .select('booking_code, from_date, to_date')
      .eq('car_id', car.id)
      .not('status', 'in', '("completed","cancelled","enquiry")')
      .lte('from_date', to)
      .gte('to_date', from);
    setAvailabilityChecking(false);
    if (qErr) return true;
    if (data && data.length > 0) {
      const clash = data[0];
      setAvailabilityError(
        `Already booked ${clash.from_date} → ${clash.to_date} (${clash.booking_code}). Choose different dates.`
      );
      return false;
    }
    return true;
  }

  if (!car) {
    return (
      <div className="max-w-md mx-auto py-32 text-center">
        <div className="text-[#5a4838]">No car selected.</div>
        <button onClick={() => setView("fleet")} className="mt-4 text-[#d4483b]">Browse fleet →</button>
      </div>
    );
  }

  // Online booking is off — show full car details + contact instead of enquiry form
  if (car.online_booking === false) {
    return (
      <motion.div {...fadeUp} className="max-w-[1400px] mx-auto px-6 lg:px-10 py-12">
        <button onClick={() => setView("fleet")} className="text-xs uppercase tracking-wider text-[#7a6858] hover:text-[#d4483b] mb-8">← Back to fleet</button>
        <div className="grid lg:grid-cols-12 gap-10">
          {/* Left — identical to regular booking page */}
          <div className="lg:col-span-7">
            <CarVisual car={car} large />
            <div className="mt-6 flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-[#7a6858]">{car.brand}</div>
                <h1 className="text-5xl font-serif italic text-[#1a120c]">{car.model}</h1>
                {car.rating && (
                  <div className="flex items-center gap-1 mt-2 text-sm text-[#5a4838]">
                    <Star className="w-4 h-4 fill-[#d4483b] text-[#d4483b]" />{car.rating} · {car.trips} trips
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-3xl font-serif text-[#1a120c]">{formatINR(car.pricePerDay)}</div>
                <div className="text-xs uppercase tracking-wider text-[#7a6858]">per day</div>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[{ l: "Seats", v: car.seats, i: Users }, { l: "Gearbox", v: car.transmission === 'Automatic' ? 'Auto' : 'Manual', i: Settings }, { l: "Fuel", v: car.fuel, i: Fuel }, { l: "Year", v: car.year, i: Gauge }].map((s, i) => {
                const Icon = s.i;
                return (
                  <div key={i} className="border border-[#d6c8b2] rounded-xl p-4">
                    <Icon className="w-4 h-4 text-[#d4483b] mb-3" />
                    <div className="text-[10px] uppercase tracking-wider text-[#7a6858]">{s.l}</div>
                    <div className="text-[#1a120c] mt-1 break-words">{s.v}</div>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 border border-[#d6c8b2] rounded-xl p-6">
              <div className="text-xs uppercase tracking-wider text-[#7a6858] mb-4">What's included</div>
              <div className="grid grid-cols-2 gap-3">
                {["350 km per day included", "Midnight to midnight billing", "Sanitised before pickup", "Fuel level marked at start"].map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-[#3d2e1e]">
                    <CheckCircle2 className="w-4 h-4 text-[#d4483b] flex-shrink-0" />{f}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right — contact section */}
          <div className="lg:col-span-5">
            <div className="sticky top-24 border-2 border-[#c74132]/30 rounded-2xl p-8 bg-[#fffaf4]">
              <div className="text-xs uppercase tracking-wider text-[#7a6858] mb-2">Interested in this car?</div>
              <div className="text-2xl font-serif italic text-[#1a120c] mb-6">Call or WhatsApp to book</div>
              <a href="tel:+917666398984"
                className="text-4xl font-serif text-[#c74132] hover:text-[#a33628] transition-colors block mb-1">
                +91 76663 98984
              </a>
              <div className="text-xs text-[#9e8e7e] uppercase tracking-wider mb-8">Open 24 hours · 7 days a week</div>
              <div className="flex gap-3">
                <a href="tel:+917666398984"
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#c74132] text-[#1a120c] rounded-full text-xs uppercase tracking-wider hover:bg-[#a33628] transition-colors">
                  <Phone className="w-3.5 h-3.5" /> Call now
                </a>
                <a href={`https://wa.me/917666398984?text=${encodeURIComponent(`Hi! I'm interested in booking the ${car.brand} ${car.model}. Please let me know the availability.`)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 py-3 border border-[#bfaf9a] text-[#3d2e1e] rounded-full text-xs uppercase tracking-wider hover:border-[#c74132]/50 transition-colors">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  WhatsApp
                </a>
              </div>
              <p className="text-xs text-[#9e8e7e] mt-6 leading-relaxed">
                Tell us which dates you need and we'll confirm availability immediately.
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  const days = Math.max(1, Math.ceil((new Date(to) - new Date(from)) / 86400000));
  const subtotal = days * car.pricePerDay;
  const fmtD = d => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

  async function handleEnquirySubmit() {
    setSubmitting(true);
    setError("");
    try {
      let customerId;
      const { data: existing } = await supabase.from('customers').select('id').eq('phone', phone).maybeSingle();
      if (existing) {
        customerId = existing.id;
      } else {
        const { data: newCust, error: custErr } = await supabase
          .from('customers').insert({ full_name: name, phone: phone }).select('id').single();
        if (custErr) throw custErr;
        customerId = newCust.id;
      }
      const code = "ENQ-" + Math.floor(1000 + Math.random() * 9000);
      const { error: bookErr } = await supabase.from('bookings').insert({
        booking_code: code, customer_id: customerId, car_id: car.id,
        from_date: from, to_date: to, days, daily_rate: car.pricePerDay,
        subtotal, tax: 0, deposit: 0, total: subtotal,
        status: 'enquiry', source: 'online', payment_status: 'pending',
      });
      if (bookErr) throw bookErr;
      setEnquiryCode(code);
      setSuccess(true);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <motion.div {...fadeUp} className="max-w-lg mx-auto px-6 py-24 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="w-20 h-20 rounded-full bg-[#c74132] mx-auto flex items-center justify-center mb-8">
          <svg viewBox="0 0 52 52" className="w-10 h-10" fill="none" xmlns="http://www.w3.org/2000/svg">
            <motion.path
              d="M14 27 L22 35 L38 17"
              stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.35, ease: "easeOut" }}
            />
          </svg>
        </motion.div>
        <div className="text-xs uppercase tracking-[0.3em] text-[#d4483b] mb-3">Enquiry received</div>
        <h1 className="text-4xl font-serif italic text-[#1a120c] mb-3">We've got your request!</h1>
        <p className="text-[#5a4838] mb-1">{car.brand} {car.model} · {days} day{days > 1 ? "s" : ""}</p>
        <p className="text-[#7a6858] mb-1">{fmtD(from)} → {fmtD(to)}</p>
        <p className="text-xs text-[#9e8e7e] mb-1">12:00 AM pick-up · Return by 12:00 AM on {fmtD(to)}</p>
        <p className="text-xs text-[#9e8e7e] font-mono mb-10">{enquiryCode}</p>

        <div className="border-2 border-[#c74132]/30 rounded-2xl p-8 bg-[#fffaf4] mb-6">
          <div className="text-xs uppercase tracking-wider text-[#7a6858] mb-3">Call to confirm your booking</div>
          <a href="tel:+917666398984"
            className="text-4xl font-serif text-[#c74132] hover:text-[#a33628] transition-colors block mb-2">
            +91 76663 98984
          </a>
          <div className="text-xs text-[#9e8e7e] uppercase tracking-wider">Open 24 hours</div>
        </div>

        <p className="text-sm text-[#7a6858] mb-8">
          Hi {name}, we've saved your enquiry and will reach out shortly on {phone}.
        </p>
        <button onClick={() => setView("fleet")}
          className="px-6 py-3 border border-[#bfaf9a] text-[#3d2e1e] rounded-full text-sm uppercase tracking-wider hover:border-[#c74132]/50 transition-colors">
          Browse more cars
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div {...fadeUp} className="max-w-[1400px] mx-auto px-6 lg:px-10 py-12">
      <button onClick={() => setView("fleet")} className="text-xs uppercase tracking-wider text-[#7a6858] hover:text-[#d4483b] mb-8">← Back to fleet</button>

      <div className="grid lg:grid-cols-12 gap-10">
        <div className="lg:col-span-7">
          <CarVisual car={car} large />
          <div className="mt-6 flex items-start justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-[#7a6858]">{car.brand}</div>
              <h1 className="text-5xl font-serif italic text-[#1a120c]">{car.model}</h1>
              <div className="flex items-center gap-1 mt-2 text-sm text-[#5a4838]">
                <Star className="w-4 h-4 fill-[#d4483b] text-[#d4483b]" />{car.rating} · {car.trips} trips
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-serif text-[#1a120c]">{formatINR(car.pricePerDay)}</div>
              <div className="text-xs uppercase tracking-wider text-[#7a6858]">per day</div>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[{ l: "Seats", v: car.seats, i: Users },{ l: "Gearbox", v: car.transmission === 'Automatic' ? 'Auto' : 'Manual', i: Settings },{ l: "Fuel", v: car.fuel, i: Fuel },{ l: "Year", v: car.year, i: Gauge }].map((s, i) => {
              const Icon = s.i;
              return (
                <div key={i} className="border border-[#d6c8b2] rounded-xl p-4">
                  <Icon className="w-4 h-4 text-[#d4483b] mb-3" />
                  <div className="text-[10px] uppercase tracking-wider text-[#7a6858]">{s.l}</div>
                  <div className="text-[#1a120c] mt-1 break-words">{s.v}</div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 border border-[#d6c8b2] rounded-xl p-6">
            <div className="text-xs uppercase tracking-wider text-[#7a6858] mb-4">What's included</div>
            <div className="grid grid-cols-2 gap-3">
              {["350 km per day included","Midnight to midnight billing","Sanitised before pickup","Fuel level marked at start"].map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-[#3d2e1e]">
                  <CheckCircle2 className="w-4 h-4 text-[#d4483b] flex-shrink-0" />{f}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="sticky top-24 border border-[#d6c8b2] rounded-2xl p-6 bg-[#fffaf4]/60">
            {/* 2-step bar */}
            <div className="flex items-center gap-2 mb-6">
              {[1, 2].map(s => (
                <div key={s} className="flex-1">
                  <div className={`h-1 rounded-full transition-all ${step >= s ? "bg-[#c74132]" : "bg-[#d6c8b2]"}`} />
                  <div className={`text-[10px] uppercase tracking-wider mt-2 ${step >= s ? "text-[#d4483b]" : "text-[#9e8e7e]"}`}>
                    {s === 1 ? "Dates" : "Your details"}
                  </div>
                </div>
              ))}
            </div>

            <AnimatePresence mode="wait" custom={stepDir}>
              {step === 1 && (
                <motion.div key="s1"
                  custom={stepDir}
                  initial={{ opacity: 0, x: stepDir * 40 }}
                  animate={{ opacity: 1, x: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } }}
                  exit={{ opacity: 0, x: stepDir * -40, transition: { duration: 0.2 } }}
                >
                  <div className="text-2xl font-serif text-[#1a120c] mb-6">When do you need it?</div>
                  <label className="text-[10px] uppercase tracking-wider text-[#7a6858]">Pickup date</label>
                  <input type="date" value={from} min={todayStr()} onChange={e => { setFrom(e.target.value); setAvailabilityError(""); }} className="w-full mt-2 mb-5 bg-[#fffaf4] border border-[#bfaf9a] rounded-lg px-4 py-3 text-[#1a120c] [color-scheme:light]" />
                  <label className="text-[10px] uppercase tracking-wider text-[#7a6858]">Return date</label>
                  <input type="date" value={to} min={from} onChange={e => { setTo(e.target.value); setAvailabilityError(""); }} className="w-full mt-2 bg-[#fffaf4] border border-[#bfaf9a] rounded-lg px-4 py-3 text-[#1a120c] [color-scheme:light]" />
                  <div className="mt-6 p-4 bg-[#fffaf4] rounded-xl border border-[#d6c8b2]">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#5a4838]">{days} day{days > 1 ? "s" : ""} × {formatINR(car.pricePerDay)}</span>
                      <span className="text-[#1a120c] font-mono">{formatINR(subtotal)}</span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-[#d6c8b2] flex items-center gap-1.5 text-[10px] text-[#9e8e7e] uppercase tracking-wider">
                      <Clock className="w-3 h-3 flex-shrink-0" />
                      Pick-up from 12:00 AM · Return by 12:00 AM on end date
                    </div>
                  </div>
                  {availabilityError && (
                    <div className="mt-4 flex items-start gap-2 bg-orange-500/10 border border-orange-500/30 text-orange-600 text-xs p-3 rounded-lg">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      {availabilityError}
                    </div>
                  )}
                </motion.div>
              )}

              {step === 2 && (
                <motion.div key="s2"
                  custom={stepDir}
                  initial={{ opacity: 0, x: stepDir * 40 }}
                  animate={{ opacity: 1, x: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } }}
                  exit={{ opacity: 0, x: stepDir * -40, transition: { duration: 0.2 } }}
                >
                  <div className="text-2xl font-serif text-[#1a120c] mb-1">Almost done</div>
                  <p className="text-sm text-[#7a6858] mb-6">No payment now — we'll call to confirm.</p>
                  <label className="text-[10px] uppercase tracking-wider text-[#7a6858]">Full name</label>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="As on driving licence"
                    className="w-full mt-2 mb-4 bg-[#fffaf4] border border-[#bfaf9a] rounded-lg px-4 py-3 text-[#1a120c] placeholder-[#9e8e7e] outline-none focus:border-[#c74132]/60" />
                  <label className="text-[10px] uppercase tracking-wider text-[#7a6858]">Mobile number</label>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210"
                    className="w-full mt-2 bg-[#fffaf4] border border-[#bfaf9a] rounded-lg px-4 py-3 text-[#1a120c] placeholder-[#9e8e7e] outline-none focus:border-[#c74132]/60" />
                  {error && <div className="mt-3 bg-red-500/10 border border-red-500/30 text-red-600 text-xs p-3 rounded-lg">{error}</div>}
                  <div className="mt-5 p-4 bg-[#ede3d5] rounded-xl border border-[#d6c8b2] flex items-center gap-3">
                    <Phone className="w-4 h-4 text-[#c74132] flex-shrink-0" />
                    <div>
                      <div className="text-sm text-[#1a120c] font-medium">+91 76663 98984</div>
                      <div className="text-xs text-[#7a6858]">We'll call you to confirm · Open 24 hours</div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex gap-3 mt-8">
              {step > 1 && (
                <button onClick={() => { setStepDir(-1); setStep(1); }} disabled={submitting || availabilityChecking}
                  className="px-5 py-3 border border-[#bfaf9a] text-[#3d2e1e] rounded-full text-xs uppercase tracking-wider disabled:opacity-50">
                  Back
                </button>
              )}
              <button
                onClick={async () => {
                  if (step === 1) {
                    const ok = await checkAvailability();
                    if (ok) { setStepDir(1); setStep(2); }
                  } else {
                    handleEnquirySubmit();
                  }
                }}
                disabled={submitting || availabilityChecking || (step === 2 && (!name || !phone))}
                className="flex-1 bg-[#c74132] hover:bg-[#a33628] text-[#1a120c] px-5 py-3 rounded-full text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {availabilityChecking ? "Checking…" : submitting ? "Sending…" : step === 1 ? "Check availability" : "Send enquiry"}
                {!submitting && !availabilityChecking && <ArrowRight className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ========================== PASSWORD RESET MODAL ========================== */
function PasswordResetModal({ onClose }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handleReset() {
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setDone(true);
    setTimeout(onClose, 2500);
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-[#fffaf4] border border-[#d6c8b2] rounded-2xl p-8 max-w-sm w-full">
        {done ? (
          <div className="text-center">
            <div className="text-emerald-600 text-lg font-medium mb-2">Password updated!</div>
            <div className="text-sm text-[#7a6858]">You can now sign in with your new password.</div>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-serif italic text-[#1a120c] mb-2">Set new password</h2>
            <p className="text-sm text-[#7a6858] mb-5">Choose a new password for your account.</p>
            <label className="text-[10px] uppercase tracking-wider text-[#7a6858]">New password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Min. 6 characters" autoFocus
              className="w-full mt-1.5 mb-4 bg-[#fffaf4] border border-[#bfaf9a] rounded-lg px-4 py-3 text-[#1a120c] outline-none focus:border-[#c74132]/60 text-sm"
              onKeyDown={e => e.key === 'Enter' && handleReset()} />
            {error && <div className="text-red-600 text-xs mb-3">{error}</div>}
            <button onClick={handleReset} disabled={loading || !password}
              className="w-full bg-[#c74132] hover:bg-[#a33628] text-[#1a120c] py-3 rounded-full text-xs uppercase tracking-wider disabled:opacity-50 transition-colors">
              {loading ? "Updating…" : "Update password"}
            </button>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

/* ========================== CUSTOMER AUTH ========================== */
function CustomerAuthModal({ onClose }) {
  const [mode, setMode] = useState("signin");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function reset() { setError(""); setNotice(""); }

  async function handleForgotPassword() {
    if (!email) { setError("Enter your email first."); return; }
    setLoading(true); reset();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setNotice("Password reset link sent to " + email + ". Check your inbox.");
  }

  async function handleSignIn() {
    setLoading(true); reset();
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.message.toLowerCase().includes('email not confirmed') || error.message.toLowerCase().includes('invalid login')) {
          setError("Email or password incorrect, or email not yet confirmed. Check your inbox for a confirmation link.");
        } else {
          setError(error.message);
        }
        setLoading(false);
        return;
      }
      if (!data.session) {
        setError("Sign-in failed. Please try again.");
        setLoading(false);
        return;
      }
      setLoading(false);
      onClose();
    } catch (e) {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  async function handleSignUp() {
    if (!name.trim()) { setError("Please enter your name."); return; }
    if (phone.replace(/\D/g, '').length !== 10) { setError("Enter a valid 10-digit mobile number."); return; }
    setLoading(true); reset();
    const fullPhone = '+91' + phone.replace(/\D/g, '');
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { role: 'customer', full_name: name, phone: fullPhone } },
    });
    if (error) { setError(error.message); setLoading(false); return; }
    if (data.user) {
      await supabase.from('customers').upsert({ full_name: name, email, phone: fullPhone }, { onConflict: 'email', ignoreDuplicates: false });
    }
    setLoading(false);
    if (data.session) { onClose(); return; }
    setMode("signin");
    setNotice("Account created! A confirmation link was sent to " + email + ". Confirm it, then sign in here.\n\nAlternatively, ask the DriveKaro team to disable email confirmation in settings.");
  }

  const inputCls = "w-full mt-1.5 bg-[#fffaf4] border border-[#bfaf9a] rounded-lg px-4 py-3 text-[#1a120c] placeholder-[#9e8e7e] outline-none focus:border-[#c74132]/60 text-sm";

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="bg-[#fffaf4] border border-[#d6c8b2] rounded-2xl p-8 max-w-sm w-full">

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-serif italic text-[#1a120c]">My Trips</h2>
          <button onClick={onClose} className="w-9 h-9 rounded-full border border-[#d6c8b2] flex items-center justify-center">
            <X className="w-4 h-4 text-[#7a6858]" />
          </button>
        </div>

        {/* Mode tabs */}
        {mode !== 'forgot' && (
          <div className="flex mb-6 bg-[#ede3d5] rounded-full p-1">
            {["signin", "signup"].map(m => (
              <button key={m} onClick={() => { setMode(m); reset(); }}
                className={`flex-1 py-2 rounded-full text-xs uppercase tracking-wider transition-all ${mode === m ? "bg-[#fffaf4] text-[#1a120c] shadow-sm" : "text-[#7a6858]"}`}>
                {m === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>
        )}
        {mode === 'forgot' && (
          <div className="mb-6">
            <button onClick={() => { setMode('signin'); reset(); }} className="text-xs text-[#7a6858] hover:text-[#1a120c] flex items-center gap-1">
              ← Back to sign in
            </button>
            <div className="text-base font-medium text-[#1a120c] mt-2">Reset your password</div>
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div key={mode} {...fadeUp} className="space-y-3">
            {mode === "signup" && (
              <>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-[#7a6858]">Full name</label>
                  <input value={name} onChange={e => { setName(e.target.value); reset(); }} placeholder="Rahul Deshmukh" className={inputCls} />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-[#7a6858]">Mobile number <span className="text-[#c74132]">*</span></label>
                  <div className="flex mt-1.5">
                    <span className="flex items-center px-3 bg-[#ede3d5] border border-r-0 border-[#bfaf9a] rounded-l-lg text-sm text-[#5a4838]">+91</span>
                    <input type="tel" value={phone} maxLength={10}
                      onChange={e => { setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); reset(); }}
                      placeholder="98765 43210"
                      className="flex-1 bg-[#fffaf4] border border-[#bfaf9a] rounded-r-lg px-4 py-3 text-[#1a120c] placeholder-[#9e8e7e] outline-none focus:border-[#c74132]/60 text-sm" />
                  </div>
                </div>
              </>
            )}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#7a6858]">Email</label>
              <input type="email" value={email} onChange={e => { setEmail(e.target.value); reset(); }} placeholder="you@email.com" className={inputCls} />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#7a6858]">Password</label>
              <input type="password" value={password} onChange={e => { setPassword(e.target.value); reset(); }}
                placeholder={mode === "signup" ? "Min. 6 characters" : "••••••••"} className={inputCls}
                onKeyDown={e => e.key === 'Enter' && (mode === "signin" ? handleSignIn() : handleSignUp())} />
            </div>

            {error && (
              <div className="flex items-start gap-2 text-red-700 text-xs bg-red-50 border border-red-300 rounded-lg px-3 py-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            {notice && (
              <div className="text-emerald-800 text-xs bg-emerald-50 border border-emerald-300 rounded-lg px-3 py-3 whitespace-pre-line">
                {notice}
              </div>
            )}

            {mode === 'forgot' ? (
              <button onClick={handleForgotPassword} disabled={loading || !email}
                className="w-full bg-[#c74132] hover:bg-[#a33628] text-[#1a120c] py-3 rounded-full text-xs uppercase tracking-wider disabled:opacity-50 transition-colors mt-2">
                {loading ? "Sending…" : "Send reset link"}
              </button>
            ) : (
              <>
                <button
                  onClick={mode === "signin" ? handleSignIn : handleSignUp}
                  disabled={loading || !email || !password || (mode === "signup" && (!name || phone.replace(/\D/g,'').length !== 10))}
                  className="w-full bg-[#c74132] hover:bg-[#a33628] text-[#1a120c] py-3 rounded-full text-xs uppercase tracking-wider disabled:opacity-50 transition-colors mt-2">
                  {loading ? (mode === "signin" ? "Signing in…" : "Creating account…") : (mode === "signin" ? "Sign in" : "Create account")}
                </button>
                {mode === "signin" && (
                  <button onClick={() => { setMode('forgot'); reset(); }}
                    className="w-full text-center text-xs text-[#9e8e7e] hover:text-[#5a4838] mt-2 transition-colors">
                    Forgot password?
                  </button>
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

/* ========================== CUSTOMER DASHBOARD ========================== */
function CustomerDashboard({ setView, goToBooking, customerProfile, customerSession, onSignIn }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customerProfile?.id) { setLoading(false); return; }
    supabase
      .from('bookings')
      .select('id, booking_code, from_date, to_date, days, total, actual_amount_paid, status, cars(brand, model, plate_number, image_url)')
      .eq('customer_id', customerProfile.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setBookings(data || []); setLoading(false); });
  }, [customerProfile]);

  if (!customerSession) {
    return (
      <motion.div {...fadeUp} className="max-w-md mx-auto px-6 py-32 text-center">
        <div className="w-20 h-20 rounded-full bg-[#ede3d5] mx-auto flex items-center justify-center mb-8">
          <Lock className="w-8 h-8 text-[#c74132]" />
        </div>
        <h1 className="text-4xl font-serif italic text-[#1a120c] mb-3">My Trips</h1>
        <p className="text-[#7a6858] mb-8 text-sm">Sign in with your mobile number to see all your bookings and enquiries.</p>
        <button onClick={onSignIn} className="px-8 py-3 bg-[#c74132] hover:bg-[#a33628] text-[#1a120c] rounded-full text-sm uppercase tracking-wider transition-colors">
          Sign in with OTP
        </button>
      </motion.div>
    );
  }

  const active = bookings.find(b => b.status === 'active');
  const firstName = customerProfile?.full_name?.split(' ')[0] || 'there';
  const tier = bookings.length >= 5 ? 'Gold' : bookings.length >= 2 ? 'Silver' : 'New';

  return (
    <motion.div {...fadeUp} className="max-w-[1400px] mx-auto px-6 lg:px-10 py-12">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-10">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-[#d4483b] mb-3">— Your space</div>
          <h1 className="text-5xl md:text-6xl font-serif italic text-[#1a120c] leading-none">
            Hello, <span className="text-[#9e8e7e]">{firstName}.</span>
          </h1>
          <div className="text-sm text-[#7a6858] mt-2">{customerProfile?.phone}</div>
        </div>
        <button onClick={() => setView("fleet")} className="px-5 py-3 bg-[#c74132] text-[#1a120c] rounded-full text-xs uppercase tracking-wider inline-flex items-center gap-2">
          <Plus className="w-4 h-4" /> Book a car
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        <div className="border border-[#d6c8b2] rounded-xl p-5">
          <div className="text-xs uppercase tracking-wider text-[#7a6858]">Total trips</div>
          <div className="text-3xl font-serif text-[#1a120c] mt-2">{bookings.filter(b => b.status !== 'enquiry').length}</div>
        </div>
        <div className="border border-[#d6c8b2] rounded-xl p-5">
          <div className="text-xs uppercase tracking-wider text-[#7a6858]">Lifetime spend</div>
          <div className="text-3xl font-serif text-[#1a120c] mt-2">{formatINR(bookings.filter(b => b.status === 'completed').reduce((s, b) => s + (b.actual_amount_paid || b.total || 0), 0))}</div>
        </div>
        <div className="border border-[#d6c8b2] rounded-xl p-5 col-span-2 lg:col-span-1">
          <div className="text-xs uppercase tracking-wider text-[#7a6858]">Member tier</div>
          <div className="text-3xl font-serif text-[#1a120c] mt-2">{tier}</div>
        </div>
      </div>

      {active && (
        <div className="border border-[#c74132]/40 rounded-2xl p-6 bg-gradient-to-br from-[#c74132]/[0.08] to-transparent mb-10">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-[#c74132] animate-pulse" />
            <span className="text-xs uppercase tracking-wider text-[#d4483b]">Trip in progress</span>
            <span className="text-xs text-[#7a6858] font-mono ml-auto">{active.booking_code}</span>
          </div>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-[#7a6858]">{active.cars?.brand}</div>
              <div className="text-3xl font-serif italic text-[#1a120c]">{active.cars?.model}</div>
              <div className="text-sm text-[#5a4838] mt-2">{active.from_date} → {active.to_date} · {active.days} days</div>
            </div>
            <a href="tel:+917666398984" className="px-5 py-3 bg-[#c74132] text-[#1a120c] rounded-full text-xs uppercase tracking-wider inline-flex items-center gap-2">
              <Phone className="w-3 h-3" /> Roadside help
            </a>
          </div>
        </div>
      )}

      <div>
        <div className="flex items-end justify-between mb-6">
          <div className="text-2xl font-serif italic text-[#1a120c]">All bookings</div>
          <div className="text-xs uppercase tracking-wider text-[#7a6858]">{bookings.length} total</div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-[#7a6858]">Loading your trips…</div>
        ) : bookings.length === 0 ? (
          <div className="py-16 text-center border border-dashed border-[#d6c8b2] rounded-2xl">
            <div className="text-[#9e8e7e] mb-4">No bookings yet.</div>
            <button onClick={() => setView("fleet")} className="px-6 py-3 bg-[#c74132] text-[#1a120c] rounded-full text-xs uppercase tracking-wider">Browse fleet</button>
          </div>
        ) : (
          <div className="space-y-3">
            {bookings.map((b, i) => (
              <motion.div key={b.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="border border-[#d6c8b2] rounded-xl p-5 flex items-center gap-5 hover:border-[#c74132]/40 transition-colors">
                <div className="w-20 h-16 rounded-lg bg-zinc-800 overflow-hidden flex-shrink-0">
                  {b.cars?.image_url
                    ? <img src={b.cars.image_url} alt={b.cars.model} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center"><Car className="w-6 h-6 text-white/30" strokeWidth={1.5} /></div>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="text-[#1a120c] font-medium">{b.cars?.brand} {b.cars?.model}</div>
                    <StatusDot status={b.status} />
                  </div>
                  <div className="text-xs text-[#7a6858] mt-1 font-mono">{b.from_date} → {b.to_date} · {b.days} day{b.days !== 1 ? 's' : ''}</div>
                </div>
                <div className="text-right hidden sm:block flex-shrink-0">
                  <div className="text-[#1a120c] font-serif">{formatINR(b.total)}</div>
                  <div className="text-[10px] uppercase tracking-wider text-[#9e8e7e] font-mono">{b.booking_code}</div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ========================== OWNER LOGIN ========================== */
function OwnerLoginScreen({ onSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      if (authError.message.toLowerCase().includes('confirm')) {
        setError("Email not confirmed yet. Go to Supabase Dashboard → Authentication → Users → click the user → Send confirmation email.");
      } else {
        setError("Invalid email or password. (" + authError.message + ")");
      }
      setLoading(false);
      return;
    }

    // Whitelist check — must be in the owners table
    const { data: ownerRow, error: ownerErr } = await supabase
      .from('owners')
      .select('email')
      .eq('email', email)
      .maybeSingle();

    if (ownerErr) {
      // Table probably not created yet — allow through and show reminder
      console.warn('owners table missing or RLS error:', ownerErr.message);
    } else if (!ownerRow) {
      await supabase.auth.signOut();
      setError("This account is not in the owners list. Add your email via Supabase SQL Editor.");
      setLoading(false);
      return;
    }

    setLoading(false);
    onSuccess();
  }

  return (
    <motion.div {...fadeUp} className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/logo-transparent.png" alt="DriveKaro" className="h-12 w-auto mx-auto mb-6" />
          <h1 className="font-serif italic text-3xl text-[#1a120c] leading-none">Owner Access</h1>
          <p className="text-sm text-[#7a6858] mt-2">Sign in to manage your fleet</p>
        </div>

        <form onSubmit={handleLogin} className="border border-[#d6c8b2] rounded-2xl p-7 bg-[#fffaf4] space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wider text-[#7a6858] block mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full bg-[#f4e8d0] border border-[#d6c8b2] rounded-lg px-4 py-3 text-sm text-[#1a120c] focus:outline-none focus:border-[#c74132] transition-colors"
              placeholder="owner@drivekaro.in"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-[#7a6858] block mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full bg-[#f4e8d0] border border-[#d6c8b2] rounded-lg px-4 py-3 text-sm text-[#1a120c] focus:outline-none focus:border-[#c74132] transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#c74132] hover:bg-[#a33628] disabled:opacity-50 text-[#1a120c] py-3 rounded-lg text-sm uppercase tracking-wider transition-colors font-medium"
          >
            {loading ? "Checking…" : "Sign In"}
          </button>
        </form>
      </div>
    </motion.div>
  );
}

/* ========================== ADMIN DASHBOARD ========================== */
function AdminDashboard({ setView, onLogout, ownerEmail }) {
  const [section, setSection] = useState("overview");
  const sections = [
    { id: "overview", label: "Overview", icon: LayoutGrid },
    { id: "fleet", label: "Fleet", icon: Car },
    { id: "bookings", label: "Bookings", icon: Calendar },
    { id: "invoices", label: "Invoices", icon: Receipt },
    { id: "customers", label: "Customers", icon: Users },
    { id: "maintenance", label: "Service", icon: Wrench },
    { id: "pages", label: "Pages", icon: FileText },
  ];

  return (
    <motion.div {...fadeUp} className="max-w-[1500px] mx-auto px-4 lg:px-8 py-8">
      <div className="grid lg:grid-cols-[240px_1fr] gap-8">
        {/* Sidebar */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="border border-[#d6c8b2] rounded-2xl p-5 bg-[#fffaf4]/60">
            <div className="pb-4 border-b border-[#d6c8b2] mb-4">
              <img src="/logo-transparent.png" alt="DriveKaro" className="h-7 w-auto mb-3" />
              <div className="text-[10px] uppercase tracking-wider text-[#7a6858]">Signed in as</div>
              <div className="text-xs text-[#1a120c] font-mono truncate mt-0.5">{ownerEmail || "Owner"}</div>
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
                        ? "bg-[#c74132] text-[#1a120c]"
                        : "text-[#5a4838] hover:text-[#1a120c] hover:bg-[#ede3d5]"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {s.label}
                  </button>
                );
              })}
            </nav>
            <div className="mt-6 pt-4 border-t border-[#d6c8b2]">
              <button
                onClick={onLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-[#7a6858] hover:text-[#1a120c] transition-colors"
              >
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
            {section === "pages" && <AdminPages key="pg" />}
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

      // Revenue = only completed trips with actual payment collected
      const completed = allBookings.filter(b => b.status === 'completed');
      const active = allBookings.filter(b => b.status === 'active');

      const totalRevenue = completed.reduce((sum, b) => sum + (b.actual_amount_paid || b.total || 0), 0);
      const activeTrips = active.length;
      const availableCars = allCars.filter(c => c.status === 'available').length;
      const rentedCars = allCars.filter(c => c.status === 'rented').length;
      const utilization = allCars.length > 0 ? Math.round((rentedCars / allCars.length) * 100) : 0;

      const thisMonth = new Date().toISOString().slice(0, 7);
      const monthRevenue = completed
        .filter(b => b.created_at?.startsWith(thisMonth))
        .reduce((sum, b) => sum + (b.actual_amount_paid || b.total || 0), 0);

      const confirmedCount = allBookings.filter(b => !['enquiry'].includes(b.status)).length;

      setStats({
        totalRevenue,
        activeTrips,
        totalCars: allCars.length,
        availableCars,
        monthRevenue,
        totalBookings: confirmedCount,
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
    return (
      <div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <div className="grid lg:grid-cols-[1fr_300px] gap-6 mb-6">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  return (
    <motion.div {...fadeUp}>
      <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
        <div>
          <div className="text-xs uppercase tracking-wider text-[#7a6858]">{new Date().toDateString()} · live data</div>
          <h1 className="text-4xl font-serif italic text-[#1a120c] mt-1">Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}.</h1>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 border border-[#bfaf9a] text-[#3d2e1e] rounded-full text-xs uppercase tracking-wider inline-flex items-center gap-2 hover:border-[#c74132]/60">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { l: "Total revenue", raw: stats.totalRevenue, fmt: formatINR, c: `from ${stats.totalBookings} bookings`, icon: IndianRupee },
          { l: "Active trips", raw: stats.activeTrips, fmt: v => String(v), c: `of ${stats.totalCars} cars on road`, icon: Activity },
          { l: "This month", raw: stats.monthRevenue, fmt: formatINR, c: "revenue so far", icon: TrendingUp },
          { l: "Fleet utilisation", raw: stats.utilization, fmt: v => v + "%", c: `${stats.availableCars} available now`, icon: BarChart3 },
        ].map((k, i) => {
          const Icon = k.icon;
          return (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="border border-[#d6c8b2] rounded-xl p-5 bg-[#fffaf4]/60 hover:border-[#c74132]/40 transition-colors">
              <div className="flex items-center justify-between mb-4">
                <Icon className="w-4 h-4 text-[#7a6858]" />
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#c74132]/15 text-[#d4483b]">live</span>
              </div>
              <div className="text-3xl font-serif text-[#1a120c]">
                <CountUpNumber value={k.raw} format={k.fmt} />
              </div>
              <div className="text-xs text-[#7a6858] mt-1">{k.l}</div>
              <div className="text-[10px] uppercase tracking-wider text-[#9e8e7e] mt-3">{k.c}</div>
            </motion.div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-8">
        <div className="lg:col-span-2 border border-[#d6c8b2] rounded-xl p-5 bg-[#fffaf4]/60">
          <div className="flex items-end justify-between mb-6">
            <div>
              <div className="text-xs uppercase tracking-wider text-[#7a6858]">Revenue trend</div>
              <div className="text-2xl font-serif text-[#1a120c] mt-1">All time</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-serif text-[#d4483b]">{formatINR(stats.totalRevenue)}</div>
              <div className="text-[10px] uppercase tracking-wider text-[#7a6858]">total</div>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#c74132" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#c74132" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#d6c8b2" vertical={false} />
                <XAxis dataKey="month" stroke="#7a6858" fontSize={11} />
                <YAxis stroke="#7a6858" fontSize={11} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ backgroundColor: "#f4e8d0", border: "1px solid #d6c8b2", borderRadius: 8 }} formatter={v => [formatINR(v), "Revenue"]} />
                <Area type="monotone" dataKey="revenue" stroke="#c74132" strokeWidth={2} fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="border border-[#d6c8b2] rounded-xl p-5 bg-[#fffaf4]/60">
          <div className="text-xs uppercase tracking-wider text-[#7a6858]">Fleet status</div>
          <div className="text-2xl font-serif text-[#1a120c] mt-1 mb-4">Right now</div>
          <div className="space-y-3 mt-6">
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-[#5a4838]">Available</span>
                <span className="text-[#1a120c] font-mono">{stats.availableCars}/{stats.totalCars}</span>
              </div>
              <div className="h-2 bg-[#ede3d5] rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${stats.totalCars ? (stats.availableCars/stats.totalCars)*100 : 0}%` }} transition={{ duration: 1 }} className="h-full bg-emerald-400" />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-[#5a4838]">On trip</span>
                <span className="text-[#1a120c] font-mono">{stats.utilization}%</span>
              </div>
              <div className="h-2 bg-[#ede3d5] rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${stats.utilization}%` }} transition={{ duration: 1, delay: 0.2 }} className="h-full bg-[#c74132]" />
              </div>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-[#d6c8b2]">
            <div className="text-[10px] uppercase tracking-wider text-[#7a6858]">Total bookings recorded</div>
            <div className="text-3xl font-serif text-[#1a120c] mt-1">{stats.totalBookings}</div>
          </div>
        </div>
      </div>

      <div className="border border-[#d6c8b2] rounded-xl p-5 bg-[#fffaf4]/60">
        <div className="flex items-center justify-between mb-5">
          <div className="text-2xl font-serif italic text-[#1a120c]">Recent bookings</div>
          <span className="text-[10px] uppercase tracking-wider text-[#d4483b]">Live</span>
        </div>
        {recentBookings.length === 0 ? (
          <div className="text-center py-8 text-[#7a6858]">No bookings yet. Make one from the customer site!</div>
        ) : (
          <div className="space-y-2">
            {recentBookings.map(b => (
              <div key={b.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#ede3d5]/40 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-900/40 via-red-900/30 to-zinc-900 flex items-center justify-center flex-shrink-0">
                  <Car className="w-4 h-4 text-white/40" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-[#1a120c] truncate">{b.customers?.full_name || "Customer"}</div>
                  <div className="text-xs text-[#7a6858]">{b.cars?.model || "Car"} · {b.days}d · {b.booking_code}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-[#1a120c] font-mono">{formatINR(b.total)}</div>
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

/* ========================== CAR EDIT MODAL ========================== */
function CarEditModal({ car, onClose, onSaved }) {
  const [form, setForm] = useState({
    brand: car.brand || "",
    model: car.model || "",
    year: car.year || 2024,
    plate_number: car.plate_number || "",
    category: car.category || "SUV",
    transmission: car.transmission || "Manual",
    fuel: car.fuel || "Petrol",
    seats: car.seats || 5,
    price_per_day: car.price_per_day || 2500,
    odometer: car.odometer || 0,
    status: car.status || "available",
  });

  // Existing saved photos (URLs from DB)
  const [savedPhotos, setSavedPhotos] = useState(() => {
    const all = [...(car.image_urls || [])];
    if (car.image_url && !all.includes(car.image_url)) all.unshift(car.image_url);
    return all.filter(Boolean);
  });
  // New files picked by user (not yet uploaded)
  const [newFiles, setNewFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [uploadProgress, setUploadProgress] = useState("");

  const totalPhotos = savedPhotos.length + newFiles.length;

  function handleFilesChange(e) {
    const files = Array.from(e.target.files);
    const canAdd = Math.min(files.length, 5 - totalPhotos);
    const toAdd = files.slice(0, canAdd).map(f => ({ file: f, preview: URL.createObjectURL(f) }));
    setNewFiles(prev => [...prev, ...toAdd]);
    e.target.value = "";
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      setUploadProgress(newFiles.length > 0 ? `Uploading ${newFiles.length} photo${newFiles.length > 1 ? 's' : ''}…` : "");
      const uploadedUrls = await Promise.all(newFiles.map(async ({ file }) => {
        const ext = file.name.split('.').pop().toLowerCase();
        const path = `${car.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage.from('car-images').upload(path, file, { contentType: file.type });
        if (upErr) throw new Error("Upload failed: " + upErr.message);
        return supabase.storage.from('car-images').getPublicUrl(path).data.publicUrl;
      }));

      const allUrls = [...savedPhotos, ...uploadedUrls];
      const { error: updateErr } = await supabase.from('cars').update({
        brand: form.brand, model: form.model, year: parseInt(form.year),
        plate_number: form.plate_number, category: form.category,
        transmission: form.transmission, fuel: form.fuel,
        seats: parseInt(form.seats), price_per_day: parseInt(form.price_per_day),
        odometer: parseInt(form.odometer), status: form.status,
        image_url: allUrls[0] || null,
        image_urls: allUrls,
      }).eq('id', car.id);

      if (updateErr) throw updateErr;
      onSaved();
    } catch (err) {
      setError(err.message);
      setUploadProgress("");
    }
    setSaving(false);
  }

  const fields = [
    { k: "brand", l: "Brand", p: "e.g. Maruti Suzuki" },
    { k: "model", l: "Model", p: "e.g. Brezza" },
    { k: "year", l: "Year", p: "2024", type: "number" },
    { k: "plate_number", l: "Number plate", p: "MH12 KR 0001" },
    { k: "price_per_day", l: "Daily rate (₹)", p: "2500", type: "number" },
    { k: "seats", l: "Seats", p: "5", type: "number" },
    { k: "odometer", l: "Odometer (km)", p: "0", type: "number" },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="bg-[#fffaf4] border border-[#bfaf9a] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-8 pb-6 border-b border-[#d6c8b2]">
          <div>
            <div className="text-xs uppercase tracking-wider text-[#7a6858]">Admin · Edit</div>
            <h2 className="text-2xl font-serif italic text-[#1a120c] mt-0.5">{car.brand} {car.model}</h2>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full border border-[#bfaf9a] flex items-center justify-center hover:border-[#c74132]/50 transition-colors">
            <X className="w-4 h-4 text-[#5a4838]" />
          </button>
        </div>

        <div className="px-8 py-6 space-y-6">
          {/* Photo upload — multiple */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] uppercase tracking-wider text-[#7a6858]">Car photos ({totalPhotos}/5)</div>
              <div className="text-[10px] text-[#9e8e7e]">First photo shown as main. Tap arrows on card to browse.</div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {/* Existing saved photos */}
              {savedPhotos.map((url, i) => (
                <div key={url} className="relative aspect-[4/3] rounded-xl overflow-hidden group border border-[#bfaf9a]">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  {i === 0 && <div className="absolute top-1.5 left-1.5 bg-[#c74132] text-white text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full">Main</div>}
                  <button onClick={() => setSavedPhotos(p => p.filter((_, j) => j !== i))}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ))}
              {/* New files (not yet uploaded) */}
              {newFiles.map((f, i) => (
                <div key={i} className="relative aspect-[4/3] rounded-xl overflow-hidden group border-2 border-dashed border-[#c74132]/40">
                  <img src={f.preview} alt="" className="w-full h-full object-cover opacity-80" />
                  <div className="absolute bottom-1 left-1 bg-[#c74132]/80 text-white text-[9px] px-1.5 py-0.5 rounded-full">New</div>
                  <button onClick={() => setNewFiles(p => p.filter((_, j) => j !== i))}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ))}
              {/* Add button */}
              {totalPhotos < 5 && (
                <label className="aspect-[4/3] rounded-xl border-2 border-dashed border-[#bfaf9a] hover:border-[#c74132] flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors text-[#9e8e7e] hover:text-[#c74132]">
                  <Plus className="w-6 h-6" />
                  <span className="text-[10px] uppercase tracking-wider">Add photo</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={handleFilesChange} />
                </label>
              )}
            </div>
          </div>

          {/* Fields */}
          <div className="grid grid-cols-2 gap-4">
            {fields.map(f => (
              <div key={f.k}>
                <label className="text-[10px] uppercase tracking-wider text-[#7a6858]">{f.l}</label>
                <input
                  type={f.type || "text"}
                  placeholder={f.p}
                  value={form[f.k]}
                  onChange={e => setForm({ ...form, [f.k]: e.target.value })}
                  className="w-full mt-1.5 bg-[#ede3d5] border border-[#bfaf9a] rounded-lg px-4 py-2.5 text-[#1a120c] placeholder-[#9e8e7e] outline-none focus:border-[#c74132]/60"
                />
              </div>
            ))}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#7a6858]">Category</label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                className="w-full mt-1.5 bg-[#ede3d5] border border-[#bfaf9a] rounded-lg px-4 py-2.5 text-[#1a120c]">
                {["SUV","Sedan","Hatchback","MPV","Electric","Luxury"].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#7a6858]">Transmission</label>
              <select value={form.transmission} onChange={e => setForm({ ...form, transmission: e.target.value })}
                className="w-full mt-1.5 bg-[#ede3d5] border border-[#bfaf9a] rounded-lg px-4 py-2.5 text-[#1a120c]">
                <option>Manual</option><option>Automatic</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#7a6858]">Fuel</label>
              <select value={form.fuel} onChange={e => setForm({ ...form, fuel: e.target.value })}
                className="w-full mt-1.5 bg-[#ede3d5] border border-[#bfaf9a] rounded-lg px-4 py-2.5 text-[#1a120c]">
                <option>Petrol</option><option>Diesel</option><option>Electric</option><option>CNG</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-[10px] uppercase tracking-wider text-[#7a6858]">Car status</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                className="w-full mt-1.5 bg-[#ede3d5] border border-[#bfaf9a] rounded-lg px-4 py-2.5 text-[#1a120c]">
                <option value="available">Available — visible to customers</option>
                <option value="maintenance">In Service — hidden from customers</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 text-red-600 text-xs p-3 rounded-lg">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} disabled={saving}
              className="px-6 py-3 border border-[#bfaf9a] text-[#5a4838] rounded-full text-xs uppercase tracking-wider disabled:opacity-50">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 bg-[#c74132] hover:bg-[#a33628] text-[#1a120c] px-6 py-3 rounded-full text-xs uppercase tracking-wider disabled:opacity-50 transition-colors">
              {saving ? (uploadProgress || "Saving…") : "Save changes"}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function AdminFleet() {
  const [showAdd, setShowAdd] = useState(false);
  const [editingCar, setEditingCar] = useState(null);
  const [calendarCar, setCalendarCar] = useState(null);
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

    // Block if car has live bookings
    const { data: live } = await supabase
      .from('bookings')
      .select('id')
      .eq('car_id', id)
      .in('status', ['active', 'upcoming', 'enquiry'])
      .limit(1);

    if (live && live.length > 0) {
      alert(`Cannot delete ${name} — it has active or upcoming bookings. Complete or cancel those first.`);
      return;
    }

    const { error } = await supabase.from('cars').delete().eq('id', id);
    if (error) alert("Error: " + error.message);
    else loadCars();
  }

  async function toggleOnlineBooking(car) {
    const { error } = await supabase.from('cars')
      .update({ online_booking: !car.online_booking })
      .eq('id', car.id);
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
          <div className="text-xs uppercase tracking-wider text-[#7a6858]">Manage your cars · live from database</div>
          <h1 className="text-4xl font-serif italic text-[#1a120c] mt-1">Fleet</h1>
        </div>
        <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-[#c74132] text-[#1a120c] rounded-full text-xs uppercase tracking-wider inline-flex items-center gap-2">
          <Plus className="w-3.5 h-3.5" /> Add a car
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="border border-[#d6c8b2] rounded-xl p-4"><div className="text-xs uppercase tracking-wider text-[#7a6858]">Total</div><div className="text-3xl font-serif text-[#1a120c] mt-1">{cars.length}</div></div>
        <div className="border border-[#d6c8b2] rounded-xl p-4"><div className="text-xs uppercase tracking-wider text-[#d4483b]">Available</div><div className="text-3xl font-serif text-[#1a120c] mt-1">{cars.filter(c => c.status === "available").length}</div></div>
        <div className="border border-[#d6c8b2] rounded-xl p-4"><div className="text-xs uppercase tracking-wider text-orange-300">On trip</div><div className="text-3xl font-serif text-[#1a120c] mt-1">{cars.filter(c => c.status === "rented").length}</div></div>
        <div className="border border-[#d6c8b2] rounded-xl p-4"><div className="text-xs uppercase tracking-wider text-[#7a6858]">In service</div><div className="text-3xl font-serif text-[#1a120c] mt-1">{cars.filter(c => c.status === "maintenance").length}</div></div>
      </div>

      {loading ? (
        <div className="border border-[#d6c8b2] rounded-xl bg-[#fffaf4]/60 overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="grid grid-cols-12 gap-4 px-5 py-4 border-b border-[#d6c8b2] last:border-0">
              <div className="col-span-4 flex items-center gap-3"><Skeleton className="h-12 w-12 rounded-lg flex-shrink-0" /><Skeleton className="h-4 flex-1 rounded" /></div>
              <Skeleton className="col-span-2 h-4 rounded self-center" />
              <Skeleton className="col-span-2 h-4 rounded self-center" />
              <Skeleton className="col-span-1 h-4 rounded self-center" />
              <Skeleton className="col-span-2 h-4 rounded self-center" />
              <Skeleton className="col-span-1 h-6 w-6 rounded-full self-center justify-self-end" />
            </div>
          ))}
        </div>
      ) : (
        <div className="border border-[#d6c8b2] rounded-xl bg-[#fffaf4]/60 overflow-hidden">
          <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-[#d6c8b2] text-[10px] uppercase tracking-wider text-[#7a6858]">
            <div className="col-span-3">Vehicle</div>
            <div className="col-span-2">Plate</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-1">Trips</div>
            <div className="col-span-2">Daily rate</div>
            <div className="col-span-2">Online booking</div>
            <div className="col-span-1 text-right">Actions</div>
          </div>
          {cars.map((car, i) => (
            <motion.div key={car.id}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
              className="grid grid-cols-12 gap-4 items-center px-5 py-4 border-b border-[#d6c8b2] last:border-0 hover:bg-[#ede3d5]/40 transition-colors">
              <div className="col-span-3 flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-900/40 via-red-900/30 to-zinc-900 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {car.image_url
                    ? <img src={car.image_url} alt={car.model} className="w-full h-full object-cover" />
                    : <Car className="w-5 h-5 text-white/40" />
                  }
                </div>
                <div className="min-w-0">
                  <div className="text-[#1a120c] truncate">{car.brand} {car.model}</div>
                  <div className="text-xs text-[#7a6858]">{car.year} · {car.category}</div>
                </div>
              </div>
              <div className="col-span-2 text-xs font-mono text-[#3d2e1e]">{car.plate_number}</div>
              <div className="col-span-1">
                <StatusDot status={car.status} />
              </div>
              <div className="col-span-1 text-[#1a120c] font-mono text-sm">{car.total_trips}</div>
              <div className="col-span-2 text-[#1a120c] font-mono">{formatINR(car.price_per_day)}</div>
              {/* Online booking toggle */}
              <div className="col-span-2 flex items-center gap-2">
                <button onClick={() => toggleOnlineBooking(car)}
                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${car.online_booking !== false ? 'bg-emerald-500' : 'bg-[#d6c8b2]'}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${car.online_booking !== false ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
                <span className={`text-[10px] uppercase tracking-wider ${car.online_booking !== false ? 'text-emerald-600' : 'text-[#9e8e7e]'}`}>
                  {car.online_booking !== false ? 'On' : 'Off'}
                </span>
              </div>
              <div className="col-span-1 flex justify-end gap-1">
                <button onClick={() => setCalendarCar(car)}
                  className="w-8 h-8 rounded-lg border border-[#bfaf9a] hover:border-[#c74132]/60 flex items-center justify-center transition-colors">
                  <CalendarDays className="w-3.5 h-3.5 text-[#5a4838]" />
                </button>
                <button onClick={() => setEditingCar(car)}
                  className="w-8 h-8 rounded-lg border border-[#bfaf9a] hover:border-[#c74132]/60 flex items-center justify-center transition-colors">
                  <Edit3 className="w-3.5 h-3.5 text-[#5a4838]" />
                </button>
                <button onClick={() => handleDeleteCar(car.id, `${car.brand} ${car.model}`)}
                  className="w-8 h-8 rounded-lg border border-[#bfaf9a] hover:border-red-500/60 hover:text-red-400 flex items-center justify-center transition-colors">
                  <Trash2 className="w-3.5 h-3.5 text-[#5a4838]" />
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
              className="bg-[#fffaf4] border border-[#bfaf9a] rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-serif italic text-[#1a120c]">Add a new car</h2>
                <button onClick={() => setShowAdd(false)} className="w-9 h-9 rounded-full border border-[#bfaf9a] flex items-center justify-center">
                  <X className="w-4 h-4 text-[#5a4838]" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { k: "brand", l: "Brand", p: "e.g. Maruti Suzuki" },
                  { k: "model", l: "Model", p: "e.g. Brezza" },
                  { k: "year", l: "Year", p: "2024", type: "number" },
                  { k: "plate_number", l: "Number plate", p: "MH12 KR 0009" },
                  { k: "price_per_day", l: "Daily rate (₹)", p: "2500", type: "number" },
                  { k: "seats", l: "Seats", p: "5", type: "number" },
                  { k: "odometer", l: "Odometer (km)", p: "0", type: "number" },
                ].map(f => (
                  <div key={f.k}>
                    <label className="text-[10px] uppercase tracking-wider text-[#7a6858]">{f.l}</label>
                    <input type={f.type || "text"} placeholder={f.p}
                      value={form[f.k]}
                      onChange={e => setForm({ ...form, [f.k]: e.target.value })}
                      className="w-full mt-1.5 bg-[#ede3d5] border border-[#bfaf9a] rounded-lg px-4 py-2.5 text-[#1a120c] placeholder-[#9e8e7e] outline-none focus:border-[#c74132]/60" />
                  </div>
                ))}
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-[#7a6858]">Category</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                    className="w-full mt-1.5 bg-[#ede3d5] border border-[#bfaf9a] rounded-lg px-4 py-2.5 text-[#1a120c]">
                    <option>SUV</option><option>Sedan</option><option>Hatchback</option><option>MPV</option><option>Electric</option><option>Luxury</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-[#7a6858]">Transmission</label>
                  <select value={form.transmission} onChange={e => setForm({ ...form, transmission: e.target.value })}
                    className="w-full mt-1.5 bg-[#ede3d5] border border-[#bfaf9a] rounded-lg px-4 py-2.5 text-[#1a120c]">
                    <option>Manual</option><option>Automatic</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-[#7a6858]">Fuel</label>
                  <select value={form.fuel} onChange={e => setForm({ ...form, fuel: e.target.value })}
                    className="w-full mt-1.5 bg-[#ede3d5] border border-[#bfaf9a] rounded-lg px-4 py-2.5 text-[#1a120c]">
                    <option>Petrol</option><option>Diesel</option><option>Electric</option><option>CNG</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-8">
                <button onClick={() => setShowAdd(false)} disabled={saving} className="px-5 py-2.5 border border-[#bfaf9a] text-[#3d2e1e] rounded-full text-xs uppercase tracking-wider disabled:opacity-50">Cancel</button>
                <button onClick={handleAddCar} disabled={saving} className="flex-1 bg-[#c74132] hover:bg-[#d63239] text-[#1a120c] px-5 py-2.5 rounded-full text-xs uppercase tracking-wider disabled:opacity-50">
                  {saving ? "Saving..." : "Add to fleet"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingCar && (
          <CarEditModal
            car={editingCar}
            onClose={() => setEditingCar(null)}
            onSaved={() => { setEditingCar(null); loadCars(); }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {calendarCar && (
          <CarCalendarModal car={calendarCar} onClose={() => setCalendarCar(null)} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function BookingEditModal({ booking: b, onClose, onSaved }) {
  const [form, setForm] = useState({
    from_date: b.from_date || '',
    to_date: b.to_date || '',
    status: b.status || 'upcoming',
    total: String(b.total || ''),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    setSaving(true);
    const newTotal = parseFloat(form.total) || b.total;
    const { error: err } = await supabase.from('bookings').update({
      from_date: form.from_date,
      to_date: form.to_date,
      status: form.status,
      total: newTotal,
      subtotal: newTotal,
    }).eq('id', b.id);
    setSaving(false);
    if (err) { setError(err.message); return; }
    onSaved();
  }

  const inputCls = "w-full mt-1.5 bg-[#ede3d5] border border-[#bfaf9a] rounded-lg px-4 py-2.5 text-[#1a120c] outline-none focus:border-[#c74132]/60";

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="bg-[#fffaf4] border border-[#d6c8b2] rounded-2xl p-7 max-w-sm w-full">
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="text-xs uppercase tracking-wider text-[#7a6858]">Edit booking</div>
            <div className="text-xl font-serif italic text-[#1a120c] mt-0.5">{b.customers?.full_name}</div>
            <div className="text-xs font-mono text-[#9e8e7e]">{b.booking_code} · {b.cars?.model}</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full border border-[#d6c8b2] flex items-center justify-center">
            <X className="w-3.5 h-3.5 text-[#7a6858]" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#7a6858]">From date</label>
              <input type="date" value={form.from_date} onChange={e => setForm({ ...form, from_date: e.target.value })}
                className={inputCls + " [color-scheme:light]"} />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#7a6858]">To date</label>
              <input type="date" value={form.to_date} onChange={e => setForm({ ...form, to_date: e.target.value })}
                className={inputCls + " [color-scheme:light]"} />
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[#7a6858]">Total amount (₹)</label>
            <input type="number" value={form.total} onChange={e => setForm({ ...form, total: e.target.value })}
              className={inputCls + " font-mono"} />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[#7a6858]">Status</label>
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={inputCls}>
              <option value="enquiry">Enquiry</option>
              <option value="upcoming">Upcoming</option>
              <option value="active">Active (on trip)</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          {error && <div className="text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="px-5 py-2.5 border border-[#bfaf9a] text-[#5a4838] rounded-full text-xs uppercase tracking-wider">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 bg-[#c74132] hover:bg-[#a33628] text-[#1a120c] py-2.5 rounded-full text-xs uppercase tracking-wider disabled:opacity-50 transition-colors">
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function AdminBookings() {
  const [tab, setTab] = useState("all");
  const [showOffline, setShowOffline] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState(null);
  const [cars, setCars] = useState([]);
  const [offlineForm, setOfflineForm] = useState({ car_id: "", customer_name: "", customer_phone: "", from_date: "", to_date: "", status: "upcoming", amount: "" });
  const [offlineError, setOfflineError] = useState("");
  const [offlineSaving, setOfflineSaving] = useState(false);
  const [endingTrip, setEndingTrip] = useState(null);
  const [actualPayment, setActualPayment] = useState("");
  const [tripLoading, setTripLoading] = useState(false);
  const [whatsappCta, setWhatsappCta] = useState(null);
  const [editingBooking, setEditingBooking] = useState(null);
  const [deletingBookingId, setDeletingBookingId] = useState(null);

  async function loadBookings() {
    setLoading(true);
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        id, booking_code, car_id, from_date, to_date, days, subtotal, total, actual_amount_paid, status, source, payment_status, customer_id,
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

  async function deleteBooking(id) {
    await supabase.from('invoices').delete().eq('booking_id', id);
    const { error } = await supabase.from('bookings').delete().eq('id', id);
    if (error) { alert('Delete failed: ' + error.message); return; }
    setDeletingBookingId(null);
    loadBookings();
  }

  function waUrl(phone, msg) {
    const num = (phone || '').replace(/\D/g, '');
    return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
  }
  function fmtDate(d) {
    return d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : d;
  }

  async function confirmEnquiry(b) {
    // Block if another confirmed booking already covers these dates for this car
    const { data: conflicts } = await supabase
      .from('bookings')
      .select('booking_code, from_date, to_date')
      .eq('car_id', b.car_id)
      .neq('id', b.id)
      .not('status', 'in', '("enquiry","cancelled","completed")')
      .lte('from_date', b.to_date)
      .gte('to_date', b.from_date);

    if (conflicts && conflicts.length > 0) {
      const clash = conflicts[0];
      setConfirmingId(null);
      alert(`Cannot confirm — ${b.cars?.model} is already booked ${clash.from_date} → ${clash.to_date} (${clash.booking_code}).\n\nCancel or end that booking first, then confirm this one.`);
      return;
    }

    const { error: updateErr } = await supabase
      .from('bookings')
      .update({ status: 'upcoming' })
      .eq('id', b.id);
    if (updateErr) {
      setConfirmingId(null);
      alert("Could not confirm: " + updateErr.message + "\n\nMake sure you have run the RLS policy SQL in Supabase.");
      return;
    }

    const subtotal = b.subtotal || 0;
    const cgst = Math.round(subtotal * 0.09);
    const sgst = Math.round(subtotal * 0.09);
    const invoiceNum = "INV-" + b.booking_code.replace(/^[A-Z]+-/, '');
    await supabase.from('invoices').insert({
      invoice_number: invoiceNum,
      booking_id: b.id,
      customer_id: b.customer_id,
      amount: subtotal,
      cgst,
      sgst,
      total: subtotal + cgst + sgst,
      status: 'pending',
    });

    // Auto-reject other enquiries for the same car & overlapping dates
    await supabase.from('bookings')
      .update({ status: 'cancelled' })
      .eq('car_id', b.car_id)
      .eq('status', 'enquiry')
      .neq('id', b.id)
      .lte('from_date', b.to_date)
      .gte('to_date', b.from_date);

    // WhatsApp CTA for customer
    const firstName = b.customers?.full_name?.split(' ')[0] || 'there';
    const msg = `Hi ${firstName}! ✅ Your DriveKaro booking is confirmed!\n\n🚗 Car: ${b.cars?.model}\n📅 Pickup: ${fmtDate(b.from_date)} at 12:00 AM\n📅 Return by: ${fmtDate(b.to_date)} at 12:00 AM\n📍 Pune Hub, NIBM Road\n\nRef: ${b.booking_code}\nQuestions? Call +91 76663 98984\n\n- DriveKaro 🚘`;
    setWhatsappCta({ url: waUrl(b.customers?.phone, msg), label: `WhatsApp ${b.customers?.full_name?.split(' ')[0] || 'customer'} — booking confirmed` });

    setConfirmingId(null);
    loadBookings();
  }

  async function startTrip(b) {
    setTripLoading(true);
    const { error } = await supabase.from('bookings').update({ status: 'active' }).eq('id', b.id);
    if (error) { alert("Could not start trip: " + error.message); setTripLoading(false); return; }
    setTripLoading(false);
    loadBookings();
    const firstName = b.customers?.full_name?.split(' ')[0] || 'there';
    const msg = `Hi ${firstName}! 🚗 Your DriveKaro trip has started!\n\nCar: ${b.cars?.model}\nReturn by: ${fmtDate(b.to_date)} at 12:00 AM\n\nDrive safe! For any help: +91 76663 98984\n- DriveKaro`;
    setWhatsappCta({ url: waUrl(b.customers?.phone, msg), label: `WhatsApp ${firstName} — trip started` });
  }

  async function endTrip() {
    const paid = parseFloat(actualPayment);
    if (!paid || paid <= 0) return;
    setTripLoading(true);
    const { error } = await supabase.from('bookings').update({
      status: 'completed',
      actual_amount_paid: paid,
      payment_status: 'paid',
    }).eq('id', endingTrip.id);
    if (error) { alert("Could not end trip: " + error.message); setTripLoading(false); return; }
    const b = endingTrip;
    setTripLoading(false);
    setEndingTrip(null);
    setActualPayment("");
    loadBookings();
    const firstName = b.customers?.full_name?.split(' ')[0] || 'there';
    const msg = `Hi ${firstName}! 🙏 Thank you for choosing DriveKaro!\n\nYour ${b.cars?.model} trip is complete. Hope you had a great drive!\n\nPlease leave us a review on Google — it means a lot! ⭐\nSee you next time! - DriveKaro`;
    setWhatsappCta({ url: waUrl(b.customers?.phone, msg), label: `WhatsApp ${firstName} — trip completed` });
  }

  useEffect(() => {
    loadBookings();
    supabase.from('cars').select('id, brand, model, plate_number, price_per_day').then(({ data }) => setCars(data || []));
  }, []);

  // Auto-fill amount when car + dates are selected
  useEffect(() => {
    const { car_id, from_date, to_date } = offlineForm;
    if (!car_id || !from_date || !to_date) return;
    const carInfo = cars.find(c => c.id === car_id);
    if (!carInfo) return;
    const days = Math.max(1, Math.ceil((new Date(to_date) - new Date(from_date)) / 86400000));
    setOfflineForm(f => ({ ...f, amount: String(carInfo.price_per_day * days) }));
  }, [offlineForm.car_id, offlineForm.from_date, offlineForm.to_date]);

  async function handleOfflineSubmit(e) {
    e.preventDefault();
    setOfflineError("");
    const { car_id, customer_name, customer_phone, from_date, to_date, status } = offlineForm;
    const days = Math.max(1, Math.ceil((new Date(to_date) - new Date(from_date)) / 86400000));
    const carInfo = cars.find(c => c.id === car_id);
    const daily = carInfo?.price_per_day || 0;

    // Check availability
    setOfflineSaving(true);
    const { data: conflicts } = await supabase
      .from('bookings')
      .select('booking_code, from_date, to_date')
      .eq('car_id', car_id)
      .not('status', 'in', '("completed","cancelled")')
      .lte('from_date', to_date)
      .gte('to_date', from_date);

    if (conflicts && conflicts.length > 0) {
      const c = conflicts[0];
      setOfflineError(`${carInfo?.model || "Car"} is already booked ${c.from_date} → ${c.to_date} (${c.booking_code}).`);
      setOfflineSaving(false);
      return;
    }

    // Find or create customer
    let customerId;
    const { data: existing } = await supabase.from('customers').select('id').eq('phone', customer_phone).maybeSingle();
    if (existing) {
      customerId = existing.id;
    } else {
      const { data: newCust, error: custErr } = await supabase.from('customers').insert({ full_name: customer_name, phone: customer_phone }).select('id').single();
      if (custErr) { setOfflineError("Failed to save customer: " + custErr.message); setOfflineSaving(false); return; }
      customerId = newCust.id;
    }

    const code = "BK-" + Math.floor(1000 + Math.random() * 9000);
    const enteredAmount = parseFloat(offlineForm.amount) || (daily * days);

    const { data: savedBooking, error: bookErr } = await supabase.from('bookings').insert({
      booking_code: code,
      customer_id: customerId,
      car_id,
      from_date,
      to_date,
      days,
      daily_rate: daily,
      subtotal: enteredAmount,
      tax: 0,
      deposit: 0,
      total: enteredAmount,
      status,
      source: 'offline',
      payment_status: status === 'completed' ? 'paid' : 'pending',
    }).select('id').single();

    if (bookErr) { setOfflineError("Failed to save: " + bookErr.message); setOfflineSaving(false); return; }

    // Auto-generate invoice with the exact amount entered
    const { error: invErr } = await supabase.from('invoices').insert({
      invoice_number: "INV-" + code.slice(3),
      booking_id: savedBooking.id,
      customer_id: customerId,
      amount: enteredAmount,
      cgst: 0,
      sgst: 0,
      total: enteredAmount,
      status: status === 'completed' ? 'paid' : 'pending',
    });
    if (invErr) { setOfflineError("Booking saved but invoice failed: " + invErr.message); setOfflineSaving(false); return; }

    setOfflineSaving(false);
    setShowOffline(false);
    setOfflineForm({ car_id: "", customer_name: "", customer_phone: "", from_date: "", to_date: "", status: "upcoming", amount: "" });
    setOfflineError("");
    loadBookings();
  }

  const filtered = tab === "all" ? bookings : bookings.filter(b => b.status === tab);

  return (
    <motion.div {...fadeUp}>
      <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
        <div>
          <div className="text-xs uppercase tracking-wider text-[#7a6858]">All trips · live from database</div>
          <h1 className="text-4xl font-serif italic text-[#1a120c] mt-1">Bookings</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={loadBookings} className="px-4 py-2 border border-[#bfaf9a] text-[#3d2e1e] rounded-full text-xs uppercase tracking-wider hover:border-[#c74132]/60">
            Refresh
          </button>
          <button onClick={() => setShowOffline(true)} className="px-4 py-2 bg-[#c74132] text-[#1a120c] rounded-full text-xs uppercase tracking-wider inline-flex items-center gap-2">
            <Plus className="w-3.5 h-3.5" /> Add offline booking
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-6 border-b border-[#d6c8b2] pb-3 flex-wrap">
        {[
          { id: "all", l: "All", n: bookings.length },
          { id: "enquiry", l: "Enquiries", n: bookings.filter(b => b.status === "enquiry").length },
          { id: "active", l: "Active", n: bookings.filter(b => b.status === "active").length },
          { id: "upcoming", l: "Upcoming", n: bookings.filter(b => b.status === "upcoming").length },
          { id: "completed", l: "Completed", n: bookings.filter(b => b.status === "completed").length },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-xs uppercase tracking-wider rounded-full transition-all ${
              tab === t.id ? "bg-[#ede3d5] text-[#1a120c]" : "text-[#7a6858] hover:text-[#1a120c]"
            }`}>
            {t.l} <span className="text-[#9e8e7e] ml-1">({t.n})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="border border-[#d6c8b2] rounded-xl bg-[#fffaf4]/60 overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="grid grid-cols-12 gap-4 px-5 py-4 border-b border-[#d6c8b2] last:border-0">
              <Skeleton className="col-span-2 h-4 rounded self-center" />
              <div className="col-span-3 space-y-2 self-center"><Skeleton className="h-4 rounded" /><Skeleton className="h-3 w-2/3 rounded" /></div>
              <Skeleton className="col-span-2 h-4 rounded self-center" />
              <div className="col-span-2 space-y-1.5 self-center"><Skeleton className="h-3 rounded" /><Skeleton className="h-3 rounded" /></div>
              <Skeleton className="col-span-1 h-4 rounded self-center" />
              <Skeleton className="col-span-1 h-4 rounded self-center" />
              <Skeleton className="col-span-1 h-5 w-16 rounded-full self-center justify-self-end" />
            </div>
          ))}
        </div>
      ) : bookings.length === 0 ? (
        <div className="border border-[#d6c8b2] rounded-xl p-12 text-center">
          <div className="text-[#5a4838]">No bookings yet. Make a test booking from the customer site!</div>
        </div>
      ) : (
        <div className="border border-[#d6c8b2] rounded-xl bg-[#fffaf4]/60 overflow-hidden">
          <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-[#d6c8b2] text-[10px] uppercase tracking-wider text-[#7a6858]">
            <div className="col-span-2">Booking</div>
            <div className="col-span-3">Customer</div>
            <div className="col-span-2">Vehicle</div>
            <div className="col-span-2">Dates</div>
            <div className="col-span-1">Total</div>
            <div className="col-span-2 text-right">Status / Action</div>
          </div>
          {filtered.map((b, i) => (
            <motion.div key={b.id}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
              className={`grid grid-cols-12 gap-4 items-center px-5 py-4 border-b border-[#d6c8b2] last:border-0 hover:bg-[#ede3d5]/40 transition-colors text-sm ${b.status === 'enquiry' ? 'bg-[#c74132]/5' : ''}`}>
              <div className="col-span-2 min-w-0">
                <div className={`font-mono text-xs ${b.status === 'enquiry' ? 'text-[#c74132]' : 'text-[#d4483b]'}`}>{b.booking_code}</div>
                <div className="text-[10px] text-[#9e8e7e] mt-0.5">{b.source}</div>
              </div>
              <div className="col-span-3 min-w-0">
                <div className="text-[#1a120c] truncate">{b.customers?.full_name || "—"}</div>
                <div className="text-xs text-[#7a6858]">{b.customers?.phone || ""}</div>
              </div>
              <div className="col-span-2 text-[#3d2e1e] truncate">{b.cars?.model || "—"}</div>
              <div className="col-span-2 text-[#5a4838] text-xs font-mono">
                <div>{b.from_date}</div>
                <div className="text-[#9e8e7e]">→ {b.to_date}</div>
              </div>
              <div className="col-span-1 text-[#1a120c] font-mono text-xs">{formatINR(b.total)}</div>
              <div className="col-span-2 flex items-center justify-end gap-1.5 flex-wrap">
                {deletingBookingId === b.id ? (
                  <div className="flex items-center gap-1 mr-1">
                    <span className="text-[10px] text-[#5a4838]">Delete?</span>
                    <button onClick={() => deleteBooking(b.id)}
                      className="px-2 py-1 bg-red-500 text-white rounded-full text-[10px] font-medium">Yes</button>
                    <button onClick={() => setDeletingBookingId(null)}
                      className="px-2 py-1 border border-[#bfaf9a] text-[#5a4838] rounded-full text-[10px]">No</button>
                  </div>
                ) : (
                  <>
                    <button onClick={() => setEditingBooking(b)} title="Edit booking"
                      className="w-7 h-7 rounded-lg border border-[#bfaf9a] hover:border-[#c74132]/50 flex items-center justify-center transition-colors flex-shrink-0">
                      <Edit3 className="w-3 h-3 text-[#5a4838]" />
                    </button>
                    <button onClick={() => setDeletingBookingId(b.id)} title="Delete booking"
                      className="w-7 h-7 rounded-lg border border-[#bfaf9a] hover:border-red-400/60 flex items-center justify-center transition-colors flex-shrink-0">
                      <Trash2 className="w-3 h-3 text-[#5a4838]" />
                    </button>
                  </>
                )}
                {deletingBookingId !== b.id && (b.status === 'enquiry' ? (
                  <div className="flex items-center gap-1.5">
                    {confirmingId === b.id ? (
                      <>
                        <span className="text-[10px] text-[#5a4838] whitespace-nowrap">Sure?</span>
                        <button onClick={() => confirmEnquiry(b)}
                          className="px-3 py-1.5 bg-[#c74132] hover:bg-[#a33628] text-[#1a120c] rounded-full text-[10px] uppercase tracking-wider font-medium transition-colors">
                          Yes
                        </button>
                        <button onClick={() => setConfirmingId(null)}
                          className="px-3 py-1.5 border border-[#bfaf9a] text-[#5a4838] rounded-full text-[10px] uppercase tracking-wider transition-colors">
                          No
                        </button>
                      </>
                    ) : (
                    <button
                      onClick={() => setConfirmingId(b.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#c74132] hover:bg-[#a33628] text-[#1a120c] rounded-full text-[10px] uppercase tracking-wider transition-colors font-medium whitespace-nowrap"
                    >
                      <CheckCircle2 className="w-3 h-3" /> Confirm
                    </button>
                    )}
                    {b.customers?.phone && (
                      <a
                        href={`https://wa.me/${b.customers.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi ${b.customers.full_name?.split(' ')[0] || 'there'}! Your booking enquiry for ${b.cars?.model} (${b.from_date} → ${b.to_date}) is confirmed. Please contact us at +91 76663 98984. - DriveKaro`)}`}
                        target="_blank" rel="noopener noreferrer"
                        className="w-7 h-7 rounded-full bg-[#25D366] flex items-center justify-center flex-shrink-0" title="WhatsApp customer">
                        <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                      </a>
                    )}
                  </div>
                ) : b.status === 'upcoming' ? (
                  <button onClick={() => startTrip(b)} disabled={tripLoading}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full text-[10px] uppercase tracking-wider font-medium transition-colors disabled:opacity-50 whitespace-nowrap">
                    <Activity className="w-3 h-3" /> Start trip
                  </button>
                ) : b.status === 'active' ? (
                  <button onClick={() => { setEndingTrip(b); setActualPayment(String(b.total || "")); }} disabled={tripLoading}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#1a120c] hover:bg-[#3d2e1e] text-[#f4e8d0] rounded-full text-[10px] uppercase tracking-wider font-medium transition-colors whitespace-nowrap">
                    <CheckCircle2 className="w-3 h-3" /> End trip
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <StatusDot status={b.status} />
                    {b.status === 'completed' && b.actual_amount_paid && (
                      <span className="text-[10px] text-emerald-600 font-mono font-medium">{formatINR(b.actual_amount_paid)}</span>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Booking edit modal */}
      <AnimatePresence>
        {editingBooking && (
          <BookingEditModal
            booking={editingBooking}
            onClose={() => setEditingBooking(null)}
            onSaved={() => { setEditingBooking(null); loadBookings(); }}
          />
        )}
      </AnimatePresence>

      {/* WhatsApp CTA toast */}
      <AnimatePresence>
        {whatsappCta && (
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[#1a120c] text-[#f4e8d0] px-5 py-3 rounded-2xl shadow-2xl max-w-sm w-full mx-4">
            <a href={whatsappCta.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 flex-1 text-sm font-medium">
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="#25D366">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              {whatsappCta.label}
            </a>
            <button onClick={() => setWhatsappCta(null)} className="text-[#f4e8d0]/50 hover:text-[#f4e8d0] ml-2">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* End Trip — payment modal */}
      <AnimatePresence>
        {endingTrip && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setEndingTrip(null)}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-[#fffaf4] border border-[#d6c8b2] rounded-2xl p-8 max-w-sm w-full">
              <h2 className="text-2xl font-serif italic text-[#1a120c] mb-1">End trip</h2>
              <p className="text-sm text-[#7a6858] mb-6">
                {endingTrip.customers?.full_name} · {endingTrip.cars?.model}<br />
                {endingTrip.from_date} → {endingTrip.to_date}
              </p>
              <label className="text-[10px] uppercase tracking-wider text-[#7a6858]">Amount collected from customer (₹)</label>
              <input
                type="number"
                value={actualPayment}
                onChange={e => setActualPayment(e.target.value)}
                placeholder={`Estimate: ${endingTrip.total || 0}`}
                className="w-full mt-2 mb-1 bg-[#f4e8d0] border border-[#d6c8b2] rounded-lg px-4 py-3 text-[#1a120c] text-xl font-mono focus:outline-none focus:border-[#c74132] transition-colors"
                autoFocus
              />
              <p className="text-[10px] text-[#9e8e7e] mb-6">This is the actual cash/UPI you received — it's what counts as revenue.</p>
              <div className="flex gap-3">
                <button onClick={() => setEndingTrip(null)}
                  className="px-5 py-3 border border-[#bfaf9a] text-[#5a4838] rounded-full text-xs uppercase tracking-wider">
                  Cancel
                </button>
                <button onClick={endTrip} disabled={tripLoading || !actualPayment || parseFloat(actualPayment) <= 0}
                  className="flex-1 bg-[#c74132] hover:bg-[#a33628] text-[#1a120c] py-3 rounded-full text-xs uppercase tracking-wider disabled:opacity-50 transition-colors font-medium">
                  {tripLoading ? "Saving…" : "Confirm payment & close trip"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Offline booking modal */}
      <AnimatePresence>
        {showOffline && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowOffline(false)}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-[#fffaf4] border border-[#bfaf9a] rounded-2xl p-8 max-w-lg w-full">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-serif italic text-[#1a120c]">Add offline booking</h2>
                <button onClick={() => setShowOffline(false)} className="w-9 h-9 rounded-full border border-[#bfaf9a] flex items-center justify-center">
                  <X className="w-4 h-4 text-[#5a4838]" />
                </button>
              </div>
              <form onSubmit={handleOfflineSubmit} className="space-y-4">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-[#7a6858]">Vehicle</label>
                  <select required value={offlineForm.car_id} onChange={e => setOfflineForm({ ...offlineForm, car_id: e.target.value })}
                    className="w-full mt-1.5 bg-[#ede3d5] border border-[#bfaf9a] rounded-lg px-4 py-2.5 text-[#1a120c] outline-none focus:border-[#c74132]/60">
                    <option value="">Select a car…</option>
                    {cars.map(c => <option key={c.id} value={c.id}>{c.brand} {c.model} · {c.plate_number}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-[#7a6858]">Customer name</label>
                    <input required value={offlineForm.customer_name} onChange={e => setOfflineForm({ ...offlineForm, customer_name: e.target.value })}
                      placeholder="Full name" className="w-full mt-1.5 bg-[#ede3d5] border border-[#bfaf9a] rounded-lg px-4 py-2.5 text-[#1a120c] placeholder-[#9e8e7e] outline-none focus:border-[#c74132]/60" />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-[#7a6858]">Phone</label>
                    <input required value={offlineForm.customer_phone} onChange={e => setOfflineForm({ ...offlineForm, customer_phone: e.target.value })}
                      placeholder="+91" className="w-full mt-1.5 bg-[#ede3d5] border border-[#bfaf9a] rounded-lg px-4 py-2.5 text-[#1a120c] placeholder-[#9e8e7e] outline-none focus:border-[#c74132]/60" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-[#7a6858]">From date</label>
                    <input required type="date" value={offlineForm.from_date} onChange={e => setOfflineForm({ ...offlineForm, from_date: e.target.value })}
                      className="w-full mt-1.5 bg-[#ede3d5] border border-[#bfaf9a] rounded-lg px-4 py-2.5 text-[#1a120c] [color-scheme:light] outline-none focus:border-[#c74132]/60" />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-[#7a6858]">To date</label>
                    <input required type="date" value={offlineForm.to_date} onChange={e => setOfflineForm({ ...offlineForm, to_date: e.target.value })}
                      className="w-full mt-1.5 bg-[#ede3d5] border border-[#bfaf9a] rounded-lg px-4 py-2.5 text-[#1a120c] [color-scheme:light] outline-none focus:border-[#c74132]/60" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-[#7a6858]">Total amount (₹) <span className="text-[#9e8e7e] normal-case tracking-normal">— what you charged</span></label>
                  <input required type="number" value={offlineForm.amount}
                    onChange={e => setOfflineForm({ ...offlineForm, amount: e.target.value })}
                    placeholder="e.g. 6600"
                    className="w-full mt-1.5 bg-[#ede3d5] border border-[#bfaf9a] rounded-lg px-4 py-2.5 text-[#1a120c] placeholder-[#9e8e7e] outline-none focus:border-[#c74132]/60 text-lg font-mono" />
                  <div className="text-[10px] text-[#9e8e7e] mt-1">Auto-filled from car rate × days. Edit if you charged differently.</div>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-[#7a6858]">Status</label>
                  <select value={offlineForm.status} onChange={e => setOfflineForm({ ...offlineForm, status: e.target.value })}
                    className="w-full mt-1.5 bg-[#ede3d5] border border-[#bfaf9a] rounded-lg px-4 py-2.5 text-[#1a120c]">
                    <option value="upcoming">Upcoming</option>
                    <option value="active">Active (on trip now)</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
                {offlineError && (
                  <div className="flex items-start gap-2 bg-orange-500/10 border border-orange-500/30 text-orange-300 text-xs p-3 rounded-lg">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    {offlineError}
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowOffline(false)} disabled={offlineSaving}
                    className="px-5 py-2.5 border border-[#bfaf9a] text-[#3d2e1e] rounded-full text-xs uppercase tracking-wider disabled:opacity-50">
                    Cancel
                  </button>
                  <button type="submit" disabled={offlineSaving}
                    className="flex-1 bg-[#c74132] hover:bg-[#d63239] text-[#1a120c] px-5 py-2.5 rounded-full text-xs uppercase tracking-wider disabled:opacity-50">
                    {offlineSaving ? "Checking & saving…" : "Save booking"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function printInvoice(inv) {
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>${inv.invoice_number}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a1a; background: #fff; padding: 40px; max-width: 600px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 2px solid #c74132; }
    .brand { font-size: 24px; font-weight: 700; color: #c74132; letter-spacing: -0.5px; }
    .brand-sub { font-size: 11px; color: #888; margin-top: 2px; }
    .inv-meta { text-align: right; }
    .inv-num { font-size: 18px; font-weight: 700; font-family: monospace; }
    .inv-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 2px; }
    .bill-to { margin-bottom: 28px; }
    .section-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 6px; }
    .customer-name { font-size: 18px; font-weight: 600; }
    .customer-meta { font-size: 13px; color: #555; margin-top: 2px; }
    .trip-box { background: #f9f5f0; border-radius: 8px; padding: 16px; margin-bottom: 28px; }
    .trip-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px; }
    .trip-label { color: #666; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #888; text-align: left; padding: 8px 0; border-bottom: 1px solid #eee; }
    td { padding: 10px 0; font-size: 14px; border-bottom: 1px solid #f0f0f0; }
    td.amount { text-align: right; font-family: monospace; }
    .total-row td { font-weight: 700; font-size: 16px; border-top: 2px solid #1a1a1a; border-bottom: none; padding-top: 12px; }
    .status { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; background: ${inv.status === 'paid' ? '#e8f5e9' : '#fff3e0'}; color: ${inv.status === 'paid' ? '#2e7d32' : '#e65100'}; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #eee; font-size: 11px; color: #999; line-height: 1.6; }
    @media print { body { padding: 20px; } }
  </style></head><body>
  <div class="header">
    <div><div class="brand">DriveKaro</div><div class="brand-sub">Self Drive · Pune</div></div>
    <div class="inv-meta">
      <div class="inv-label">Invoice</div>
      <div class="inv-num">${inv.invoice_number}</div>
      <div style="font-size:12px;color:#888;margin-top:4px;">${inv.bookings?.from_date || ''}</div>
      <div style="margin-top:6px"><span class="status">${inv.status}</span></div>
    </div>
  </div>
  <div class="bill-to">
    <div class="section-label">Bill to</div>
    <div class="customer-name">${inv.customers?.full_name || '—'}</div>
    <div class="customer-meta">${inv.customers?.phone || ''}</div>
  </div>
  ${inv.bookings ? `<div class="trip-box">
    <div class="section-label">Trip details</div>
    <div class="trip-row"><span class="trip-label">Vehicle</span><span>${inv.bookings.cars?.brand || ''} ${inv.bookings.cars?.model || ''}</span></div>
    <div class="trip-row"><span class="trip-label">Pickup</span><span>${inv.bookings.from_date}</span></div>
    <div class="trip-row"><span class="trip-label">Return</span><span>${inv.bookings.to_date}</span></div>
    <div class="trip-row"><span class="trip-label">Duration</span><span>${inv.bookings.days} day${inv.bookings.days !== 1 ? 's' : ''}</span></div>
    <div class="trip-row"><span class="trip-label">Ref</span><span>${inv.bookings.booking_code}</span></div>
  </div>` : ''}
  <table>
    <thead><tr><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>
      <tr><td>Rental charge</td><td class="amount">₹${(inv.amount || 0).toLocaleString('en-IN')}</td></tr>
      ${inv.cgst ? `<tr><td>CGST 9%</td><td class="amount">₹${(inv.cgst).toLocaleString('en-IN')}</td></tr>` : ''}
      ${inv.sgst ? `<tr><td>SGST 9%</td><td class="amount">₹${(inv.sgst).toLocaleString('en-IN')}</td></tr>` : ''}
      <tr class="total-row"><td>Total</td><td class="amount">₹${(inv.total || 0).toLocaleString('en-IN')}</td></tr>
    </tbody>
  </table>
  <div class="footer">
    <div>DriveKaro · Kool Homes Solitaire, Kausar Baugh, Kondhwa, Pune 411048</div>
    <div>+91 76663 98984 · hi@drivekaro.in · instagram.com/drivekaro.in</div>
    <div style="margin-top:4px">Auto-generated invoice · Valid without signature.</div>
  </div>
  <script>window.onload = () => { window.print(); }<\/script>
  </body></html>`;
  const w = window.open('', '_blank', 'width=700,height=900');
  w.document.write(html);
  w.document.close();
}

function AdminInvoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  async function loadInvoices() {
    setLoading(true);
    const { data, error } = await supabase
      .from('invoices')
      .select(`
        id, invoice_number, amount, cgst, sgst, total, status,
        customers ( full_name, phone ),
        bookings ( booking_code, from_date, to_date, days, cars ( brand, model ) )
      `)
      .order('id', { ascending: false });
    if (error) {
      console.error('Invoices load error:', error.message);
    }
    const rows = data || [];
    setInvoices(rows);
    if (rows.length > 0) setSelected(rows[0]);
    setLoading(false);
  }

  useEffect(() => { loadInvoices(); }, []);

  const thisMonth = new Date().toISOString().slice(0, 7);
  const outstanding = invoices.filter(i => i.status === 'pending');
  const paidThisMonth = invoices.filter(i => i.status === 'paid' && i.created_at?.startsWith(thisMonth));
  const gstTotal = invoices.reduce((s, i) => s + (i.cgst || 0) + (i.sgst || 0), 0);

  const inv = selected;

  return (
    <motion.div {...fadeUp}>
      <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
        <div>
          <div className="text-xs uppercase tracking-wider text-[#7a6858]">GST-compliant invoicing · live</div>
          <h1 className="text-4xl font-serif italic text-[#1a120c] mt-1">Invoices</h1>
        </div>
        <button onClick={loadInvoices} className="px-4 py-2 border border-[#bfaf9a] text-[#3d2e1e] rounded-full text-xs uppercase tracking-wider hover:border-[#c74132]/60">
          Refresh
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-8">
        <div className="border border-[#d6c8b2] rounded-xl p-5 bg-[#fffaf4]/60">
          <div className="text-xs uppercase tracking-wider text-[#7a6858]">Outstanding</div>
          <div className="text-3xl font-serif text-orange-300 mt-1">{formatINR(outstanding.reduce((s, i) => s + i.total, 0))}</div>
          <div className="text-[10px] uppercase tracking-wider text-[#9e8e7e] mt-2">{outstanding.length} invoice{outstanding.length !== 1 ? "s" : ""}</div>
        </div>
        <div className="border border-[#d6c8b2] rounded-xl p-5 bg-[#fffaf4]/60">
          <div className="text-xs uppercase tracking-wider text-[#7a6858]">Paid this month</div>
          <div className="text-3xl font-serif text-[#d4483b] mt-1">{formatINR(paidThisMonth.reduce((s, i) => s + i.total, 0))}</div>
          <div className="text-[10px] uppercase tracking-wider text-[#9e8e7e] mt-2">{paidThisMonth.length} invoice{paidThisMonth.length !== 1 ? "s" : ""}</div>
        </div>
        <div className="border border-[#d6c8b2] rounded-xl p-5 bg-[#fffaf4]/60">
          <div className="text-xs uppercase tracking-wider text-[#7a6858]">GST collected (all time)</div>
          <div className="text-3xl font-serif text-[#1a120c] mt-1">{formatINR(gstTotal)}</div>
          <div className="text-[10px] uppercase tracking-wider text-[#9e8e7e] mt-2">CGST + SGST</div>
        </div>
      </div>

      {loading ? (
        <div className="border border-[#d6c8b2] rounded-xl p-12 text-center">
          <div className="text-[#5a4838] text-sm uppercase tracking-widest">Loading invoices…</div>
        </div>
      ) : invoices.length === 0 ? (
        <div className="border border-[#d6c8b2] rounded-xl p-12 text-center">
          <div className="text-[#5a4838]">No invoices yet. Make a booking from the customer site!</div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[1fr_380px] gap-6">
          <div className="border border-[#d6c8b2] rounded-xl bg-[#fffaf4]/60 overflow-hidden">
            <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-[#d6c8b2] text-[10px] uppercase tracking-wider text-[#7a6858]">
              <div className="col-span-3">Invoice #</div>
              <div className="col-span-3">Customer</div>
              <div className="col-span-2">Date</div>
              <div className="col-span-2">Amount</div>
              <div className="col-span-2 text-right">Status</div>
            </div>
            {invoices.map((inv, i) => (
              <motion.div
                key={inv.id}
                onClick={() => setSelected(inv)}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                className={`grid grid-cols-12 gap-4 items-center px-5 py-4 border-b border-[#d6c8b2] last:border-0 cursor-pointer text-sm transition-colors ${
                  selected?.id === inv.id ? "bg-[#ede3d5]" : "hover:bg-[#ede3d5]/40"
                }`}
              >
                <div className="col-span-3 font-mono text-xs">
                  <div className="text-[#d4483b]">{inv.invoice_number}</div>
                  <div className="text-[#9e8e7e] mt-0.5">{inv.bookings?.booking_code || "—"}</div>
                </div>
                <div className="col-span-3 text-[#1a120c] truncate">{inv.customers?.full_name || "—"}</div>
                <div className="col-span-2 text-[#5a4838] font-mono text-xs">{inv.bookings?.from_date || '—'}</div>
                <div className="col-span-2 text-[#1a120c] font-mono">{formatINR(inv.total)}</div>
                <div className="col-span-2 flex justify-end items-center gap-2">
                  <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${inv.status === "paid" ? "bg-[#c74132]/15 text-[#d4483b]" : "bg-orange-300/10 text-orange-300"}`}>
                    {inv.status}
                  </span>
                  <button onClick={() => printInvoice(inv)} title="Download / Print"
                    className="w-7 h-7 rounded-lg border border-[#bfaf9a] hover:border-[#c74132]/50 flex items-center justify-center transition-colors">
                    <Download className="w-3 h-3 text-[#5a4838]" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Invoice preview */}
          {inv && (
            <div className="border-2 border-[#d6c8b2] rounded-xl bg-white text-zinc-800 p-6 sticky top-24 self-start shadow-sm">
              <div className="flex items-start justify-between mb-6">
                <img src="/logo-transparent.png" alt="DriveKaro" className="h-8 w-auto" style={{ filter: "invert(1) brightness(0)" }} />
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-400">Invoice</div>
                  <div className="text-sm font-mono text-zinc-800">{inv.invoice_number}</div>
                  <div className="text-[10px] text-zinc-400 mt-0.5">{inv.bookings?.from_date || '—'}</div>
                </div>
              </div>
              <div className="border-t border-zinc-100 pt-4 mb-4">
                <div className="text-[10px] uppercase tracking-wider text-zinc-400">Bill to</div>
                <div className="text-zinc-800 mt-1 font-medium">{inv.customers?.full_name || "—"}</div>
                <div className="text-xs text-zinc-500">{inv.customers?.phone || ""}</div>
              </div>
              <div className="space-y-2 text-sm border-t border-zinc-200 pt-4">
                <div className="flex justify-between">
                  <span className="text-zinc-500">
                    {inv.bookings?.cars
                      ? `${inv.bookings.cars.brand} ${inv.bookings.cars.model} · ${inv.bookings?.days || "?"} days`
                      : "Rental"}
                  </span>
                  <span className="font-mono">{formatINR(inv.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">CGST 9%</span>
                  <span className="font-mono">{formatINR(inv.cgst)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">SGST 9%</span>
                  <span className="font-mono">{formatINR(inv.sgst)}</span>
                </div>
                <div className="border-t border-zinc-200 pt-2 mt-2 flex justify-between">
                  <span className="font-medium uppercase tracking-wider text-xs">Total</span>
                  <span className="font-serif text-xl">{formatINR(inv.total)}</span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-zinc-200 text-[10px] text-zinc-400 space-y-0.5">
                <div>Kool Homes Solitaire, Kausar Baugh, Kondhwa, Pune 411048</div>
                <div>+91 76663 98984 · hi@drivekaro.in</div>
                <div>Auto-generated · Valid without signature.</div>
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={() => printInvoice(inv)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#1a120c] hover:bg-[#c74132] text-[#f4e8d0] rounded-full text-xs uppercase tracking-wider transition-colors">
                  <Download className="w-3.5 h-3.5" /> Download PDF
                </button>
                {inv.customers?.phone && (
                  <a
                    href={`https://wa.me/${inv.customers.phone.replace(/\D/g,'')}?text=${encodeURIComponent(
`Hi ${inv.customers.full_name?.split(' ')[0] || 'there'}! 🧾 Here are your invoice details from DriveKaro:

Invoice No: ${inv.invoice_number}
${inv.bookings?.cars ? `Car: ${inv.bookings.cars.brand} ${inv.bookings.cars.model}` : ''}
${inv.bookings?.from_date ? `Trip: ${inv.bookings.from_date} → ${inv.bookings.to_date}` : ''}
Amount: ₹${(inv.total || 0).toLocaleString('en-IN')}
Status: ${inv.status === 'paid' ? '✅ Paid' : '⏳ Pending'}

Thank you for choosing DriveKaro! 🚗
+91 76663 98984`)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#25D366] hover:bg-[#20b858] text-white rounded-full text-xs uppercase tracking-wider transition-colors">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    Send
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

function AdminCustomers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function loadCustomers() {
      const { data, error } = await supabase
        .from('customers')
        .select(`id, full_name, phone, email, created_at, bookings ( total, status )`)
        .order('created_at', { ascending: false });
      if (!error) setCustomers(data || []);
      setLoading(false);
    }
    loadCustomers();
  }, []);

  const enriched = customers.map(c => {
    const trips = c.bookings?.length || 0;
    const spent = c.bookings?.reduce((s, b) => s + (b.total || 0), 0) || 0;
    const tier = trips >= 5 ? "Gold" : trips >= 2 ? "Silver" : "New";
    const joined = c.created_at
      ? new Date(c.created_at).toLocaleDateString("en-IN", { month: "short", year: "numeric" })
      : "—";
    return { ...c, trips, spent, tier, joined };
  });

  const filtered = enriched.filter(c =>
    search === "" ||
    c.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search)
  );

  return (
    <motion.div {...fadeUp}>
      <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
        <div>
          <div className="text-xs uppercase tracking-wider text-[#7a6858]">CRM · live</div>
          <h1 className="text-4xl font-serif italic text-[#1a120c] mt-1">Customers</h1>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 text-[#7a6858] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or phone…"
            className="bg-[#fffaf4] border border-[#bfaf9a] rounded-full pl-10 pr-4 py-2 text-sm text-[#1a120c] placeholder-[#9e8e7e] outline-none focus:border-[#c74132]/60 w-64"
          />
        </div>
      </div>

      {loading ? (
        <div className="border border-[#d6c8b2] rounded-xl p-12 text-center">
          <div className="text-[#5a4838] text-sm uppercase tracking-widest">Loading customers…</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-[#d6c8b2] rounded-xl p-12 text-center">
          <div className="text-[#5a4838]">{search ? "No customers match your search." : "No customers yet."}</div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="border border-[#d6c8b2] rounded-xl p-5 bg-[#fffaf4]/60 hover:border-[#c74132]/40 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#c74132] to-orange-400 flex items-center justify-center text-[#1a120c] font-medium">
                    {c.full_name?.split(" ").map(n => n[0]).join("") || "?"}
                  </div>
                  <div>
                    <div className="text-[#1a120c]">{c.full_name}</div>
                    <div className="text-xs text-[#7a6858]">{c.phone}</div>
                  </div>
                </div>
                <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-full ${
                  c.tier === "Gold" ? "bg-[#c74132]/15 text-[#d4483b]" :
                  c.tier === "Silver" ? "bg-[#3d2e1e]/15 text-[#3d2e1e]" :
                  "bg-blue-300/10 text-blue-300"
                }`}>{c.tier}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-[#d6c8b2]">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-[#7a6858]">Trips</div>
                  <div className="text-xl font-serif text-[#1a120c] mt-1">{c.trips}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-[#7a6858]">Lifetime</div>
                  <div className="text-xl font-serif text-[#1a120c] mt-1">{formatINR(c.spent)}</div>
                </div>
              </div>
              <div className="mt-3 text-[10px] uppercase tracking-wider text-[#9e8e7e]">Since {c.joined}</div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

/* ========================== CAR CALENDAR MODAL ========================== */
function CarCalendarModal({ car, onClose }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const today = new Date();
  const viewDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const pad = n => String(n).padStart(2, '0');
  const monthStart = `${year}-${pad(month + 1)}-01`;
  const monthEnd = `${year}-${pad(month + 1)}-${pad(daysInMonth)}`;
  const monthLabel = viewDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const todayDay = today.getMonth() === month && today.getFullYear() === year ? today.getDate() : null;

  // Monday-first offset
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0
  const cells = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  useEffect(() => {
    setLoading(true);
    supabase.from('bookings')
      .select('id, booking_code, from_date, to_date, status, customers(full_name, phone)')
      .eq('car_id', car.id)
      .not('status', 'eq', 'cancelled')
      .lte('from_date', monthEnd)
      .gte('to_date', monthStart)
      .then(({ data }) => { setBookings(data || []); setLoading(false); });
  }, [monthOffset]);

  function bookingForDay(day) {
    const date = `${year}-${pad(month + 1)}-${pad(day)}`;
    // block from_date inclusive, to_date exclusive (midnight-to-midnight policy)
    return bookings.find(b => date >= b.from_date && date < b.to_date);
  }

  const cfg = {
    enquiry:   { bg: 'bg-amber-100 text-amber-800',   dot: 'bg-amber-400',   label: 'Enquiry' },
    upcoming:  { bg: 'bg-blue-100 text-blue-800',     dot: 'bg-blue-500',    label: 'Upcoming' },
    active:    { bg: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-500', label: 'On Trip' },
    completed: { bg: 'bg-[#ede3d5] text-[#7a6858]',   dot: 'bg-[#bfaf9a]',  label: 'Done' },
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="bg-[#fffaf4] border border-[#d6c8b2] rounded-2xl p-6 w-full max-w-md">

        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="text-xs uppercase tracking-wider text-[#7a6858]">Availability</div>
            <div className="text-xl font-serif italic text-[#1a120c]">{car.brand} {car.model}</div>
            <div className="text-[10px] font-mono text-[#9e8e7e]">{car.plate_number}</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full border border-[#d6c8b2] flex items-center justify-center">
            <X className="w-3.5 h-3.5 text-[#7a6858]" />
          </button>
        </div>

        {/* Month nav */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setMonthOffset(o => o - 1)}
            className="w-8 h-8 rounded-full border border-[#d6c8b2] flex items-center justify-center text-[#5a4838] hover:border-[#c74132]/50 transition-colors text-sm">‹</button>
          <span className="text-sm font-medium text-[#1a120c]">{monthLabel}</span>
          <button onClick={() => setMonthOffset(o => o + 1)}
            className="w-8 h-8 rounded-full border border-[#d6c8b2] flex items-center justify-center text-[#5a4838] hover:border-[#c74132]/50 transition-colors text-sm">›</button>
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 mb-1">
          {['Mo','Tu','We','Th','Fr','Sa','Su'].map(d => (
            <div key={d} className="text-center text-[10px] uppercase tracking-wider text-[#9e8e7e] py-1">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        {loading ? (
          <div className="grid grid-cols-7 gap-1">
            {[...Array(35)].map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (!day) return <div key={i} />;
              const b = bookingForDay(day);
              const isToday = day === todayDay;
              const style = b ? cfg[b.status] : null;
              return (
                <button key={i}
                  onClick={() => b && setSelected(b)}
                  className={`h-10 rounded-xl text-sm font-medium transition-all relative flex items-center justify-center
                    ${b ? `${style.bg} cursor-pointer hover:opacity-80` : 'text-[#1a120c] hover:bg-[#ede3d5]'}
                    ${isToday && !b ? 'ring-2 ring-[#c74132] ring-offset-1' : ''}
                    ${isToday && b ? 'ring-2 ring-[#c74132]' : ''}
                  `}>
                  {day}
                  {b && <div className={`absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${style.dot}`} />}
                </button>
              );
            })}
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-5 pt-4 border-t border-[#d6c8b2]">
          {Object.entries(cfg).map(([k, v]) => (
            <div key={k} className="flex items-center gap-1.5 text-[10px] text-[#7a6858]">
              <div className={`w-2.5 h-2.5 rounded-sm ${v.dot}`} />{v.label}
            </div>
          ))}
        </div>
      </motion.div>

      {/* Booking detail */}
      <AnimatePresence>
        {selected && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
            onClick={() => setSelected(null)}
            className="fixed inset-0 z-60 flex items-center justify-center p-4">
            <div onClick={e => e.stopPropagation()} className="bg-[#fffaf4] border border-[#d6c8b2] rounded-2xl p-6 max-w-xs w-full shadow-xl">
              <div className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full inline-block mb-3 ${cfg[selected.status]?.bg}`}>{selected.status}</div>
              <div className="text-lg font-serif italic text-[#1a120c] mb-1">{selected.customers?.full_name || '—'}</div>
              <div className="text-sm text-[#7a6858] mb-3">{selected.customers?.phone}</div>
              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                <div><div className="text-[#9e8e7e] mb-0.5">From</div><div className="font-mono text-[#1a120c]">{selected.from_date}</div></div>
                <div><div className="text-[#9e8e7e] mb-0.5">Until</div><div className="font-mono text-[#1a120c]">{selected.to_date}</div></div>
              </div>
              <div className="text-[10px] font-mono text-[#9e8e7e]">{selected.booking_code}</div>
              <button onClick={() => setSelected(null)} className="mt-4 w-full py-2 border border-[#d6c8b2] rounded-full text-xs text-[#5a4838]">Close</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ========================== ADMIN PAGES ========================== */
function AdminPages() {
  const slugs = [
    { slug: 'about', label: 'About DriveKaro' },
    { slug: 'terms', label: 'Terms & Conditions' },
    { slug: 'privacy', label: 'Privacy Policy' },
  ];
  const [pages, setPages] = useState({});
  const [saving, setSaving] = useState({});
  const [saved, setSaved] = useState({});
  const [saveError, setSaveError] = useState({});

  useEffect(() => {
    supabase.from('site_pages').select('slug, title, content')
      .then(({ data, error }) => {
        if (error) { console.error('site_pages load error:', error.message); return; }
        const map = {};
        (data || []).forEach(p => { map[p.slug] = { title: p.title, content: p.content }; });
        setPages(map);
      });
  }, []);

  async function savePage(slug) {
    setSaving(s => ({ ...s, [slug]: true }));
    setSaveError(e => ({ ...e, [slug]: '' }));

    const { error } = await supabase.from('site_pages')
      .update({
        title: pages[slug]?.title || slug,
        content: pages[slug]?.content || '',
        updated_at: new Date().toISOString(),
      })
      .eq('slug', slug);

    setSaving(s => ({ ...s, [slug]: false }));
    if (error) {
      setSaveError(e => ({ ...e, [slug]: error.message }));
      return;
    }
    setSaved(s => ({ ...s, [slug]: true }));
    setTimeout(() => setSaved(s => ({ ...s, [slug]: false })), 2500);
  }

  return (
    <motion.div {...fadeUp}>
      <div className="mb-8">
        <div className="text-xs uppercase tracking-wider text-[#7a6858]">Footer pages · visible to customers</div>
        <h1 className="text-4xl font-serif italic text-[#1a120c] mt-1">Pages</h1>
      </div>

      <div className="space-y-6">
        {slugs.map(({ slug, label }) => (
          <div key={slug} className="border border-[#d6c8b2] rounded-2xl bg-[#fffaf4] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#d6c8b2] bg-[#f4e8d0]">
              <div>
                <div className="text-xs uppercase tracking-wider text-[#7a6858]">Footer → {label}</div>
                <input
                  value={pages[slug]?.title || ''}
                  onChange={e => setPages(p => ({ ...p, [slug]: { ...p[slug], title: e.target.value } }))}
                  className="text-lg font-serif italic text-[#1a120c] bg-transparent outline-none border-b border-transparent focus:border-[#c74132] mt-0.5"
                />
              </div>
              <div className="flex items-center gap-3">
                {saveError[slug] && (
                  <span className="text-xs text-red-600 max-w-xs">{saveError[slug]}</span>
                )}
                <button onClick={() => savePage(slug)} disabled={saving[slug]}
                  className={`px-5 py-2 rounded-full text-xs uppercase tracking-wider transition-colors flex-shrink-0 ${saved[slug] ? 'bg-emerald-500 text-white' : 'bg-[#c74132] hover:bg-[#a33628] text-[#1a120c]'} disabled:opacity-50`}>
                  {saving[slug] ? 'Saving…' : saved[slug] ? '✓ Saved' : 'Save'}
                </button>
              </div>
            </div>
            <div className="p-6">
              <textarea
                value={pages[slug]?.content || ''}
                onChange={e => setPages(p => ({ ...p, [slug]: { ...p[slug], content: e.target.value } }))}
                rows={12}
                className="w-full bg-[#fffaf4] text-sm text-[#3d2e1e] leading-relaxed outline-none resize-y font-mono placeholder-[#9e8e7e]"
                placeholder={`Enter ${label} content here…`}
              />
              <div className="text-[10px] text-[#9e8e7e] mt-2">Plain text. Use blank lines to separate paragraphs. Changes are visible to customers immediately after saving.</div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ========================== ADMIN CALENDAR ========================== */
function AdminCalendar() {
  const [monthOffset, setMonthOffset] = useState(0);
  const [cars, setCars] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // selected booking for detail

  const today = new Date();
  const viewDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const pad = n => String(n).padStart(2, '0');
  const monthStart = `${year}-${pad(month + 1)}-01`;
  const monthEnd = `${year}-${pad(month + 1)}-${pad(daysInMonth)}`;
  const todayDay = today.getMonth() === month && today.getFullYear() === year ? today.getDate() : null;
  const monthLabel = viewDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  useEffect(() => {
    setLoading(true);
    Promise.all([
      supabase.from('cars').select('id, brand, model, plate_number').order('price_per_day', { ascending: false }),
      supabase.from('bookings')
        .select('id, booking_code, car_id, from_date, to_date, status, customers(full_name, phone)')
        .not('status', 'eq', 'cancelled')
        .lte('from_date', monthEnd)
        .gte('to_date', monthStart),
    ]).then(([c, b]) => {
      setCars(c.data || []);
      setBookings(b.data || []);
      setLoading(false);
    });
  }, [monthOffset]);

  function bookingForDay(carId, day) {
    const date = `${year}-${pad(month + 1)}-${pad(day)}`;
    return bookings.find(b => b.car_id === carId && date >= b.from_date && date < b.to_date);
  }

  const barColor = {
    enquiry:   'bg-amber-400',
    upcoming:  'bg-blue-400',
    active:    'bg-emerald-500',
    completed: 'bg-[#bfaf9a]',
  };

  const dayWidth = 32; // px per day cell

  return (
    <motion.div {...fadeUp}>
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          <div className="text-xs uppercase tracking-wider text-[#7a6858]">Fleet availability</div>
          <h1 className="text-4xl font-serif italic text-[#1a120c] mt-1">Calendar</h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setMonthOffset(o => o - 1)}
            className="px-4 py-2 border border-[#bfaf9a] text-[#5a4838] rounded-full text-xs uppercase tracking-wider hover:border-[#c74132]/50 transition-colors">
            ← Prev
          </button>
          <span className="text-sm font-medium text-[#1a120c] min-w-[140px] text-center">{monthLabel}</span>
          <button onClick={() => setMonthOffset(o => o + 1)}
            className="px-4 py-2 border border-[#bfaf9a] text-[#5a4838] rounded-full text-xs uppercase tracking-wider hover:border-[#c74132]/50 transition-colors">
            Next →
          </button>
          {monthOffset !== 0 && (
            <button onClick={() => setMonthOffset(0)}
              className="px-4 py-2 bg-[#ede3d5] text-[#5a4838] rounded-full text-xs uppercase tracking-wider">
              Today
            </button>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mb-6">
        {[['bg-amber-400','Enquiry'],['bg-blue-400','Upcoming'],['bg-emerald-500','Active / On Trip'],['bg-[#bfaf9a]','Completed']].map(([c, l]) => (
          <div key={l} className="flex items-center gap-1.5 text-xs text-[#7a6858]">
            <div className={`w-3 h-3 rounded-sm ${c} opacity-90`} />
            {l}
          </div>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 rounded-xl" />)}
        </div>
      ) : (
        <div className="border border-[#d6c8b2] rounded-2xl bg-[#fffaf4] overflow-hidden">
          <div className="overflow-x-auto">
            <div style={{ minWidth: `${180 + daysInMonth * dayWidth}px` }}>

              {/* Day header */}
              <div className="flex border-b border-[#d6c8b2] bg-[#f4e8d0] sticky top-0 z-10">
                <div className="flex-shrink-0 px-4 py-3 text-[10px] uppercase tracking-wider text-[#9e8e7e]" style={{ width: 180 }}>
                  Vehicle
                </div>
                {days.map(d => {
                  const isToday = d === todayDay;
                  const dow = new Date(year, month, d).toLocaleDateString('en-IN', { weekday: 'short' }).slice(0, 2);
                  return (
                    <div key={d} className={`flex-shrink-0 text-center py-2 border-l border-[#d6c8b2]/50 ${isToday ? 'bg-[#c74132]/10' : ''}`} style={{ width: dayWidth }}>
                      <div className={`text-[10px] font-mono leading-none ${isToday ? 'text-[#c74132] font-bold' : 'text-[#9e8e7e]'}`}>{d}</div>
                      <div className={`text-[9px] uppercase mt-0.5 ${isToday ? 'text-[#c74132]' : 'text-[#bfaf9a]'}`}>{dow}</div>
                    </div>
                  );
                })}
              </div>

              {/* Car rows */}
              {cars.map(car => (
                <div key={car.id} className="flex items-center border-b border-[#d6c8b2]/50 last:border-0 hover:bg-[#ede3d5]/30 transition-colors">
                  <div className="flex-shrink-0 px-4 py-3" style={{ width: 180 }}>
                    <div className="text-xs text-[#1a120c] font-medium truncate">{car.brand} {car.model}</div>
                    <div className="text-[10px] text-[#9e8e7e] font-mono mt-0.5">{car.plate_number}</div>
                  </div>
                  {days.map(d => {
                    const b = bookingForDay(car.id, d);
                    const isToday = d === todayDay;
                    const date = `${year}-${pad(month + 1)}-${pad(d)}`;
                    const isStart = b && b.from_date === date;
                    const prevDate = `${year}-${pad(month + 1)}-${pad(d - 1)}`;
                    const isFirstInView = b && d === 1 && b.from_date < monthStart;
                    const nextDate = `${year}-${pad(month + 1)}-${pad(d + 1)}`;
                    const isEnd = b && (b.to_date === nextDate || d === daysInMonth);

                    return (
                      <div key={d}
                        className={`flex-shrink-0 h-10 border-l border-[#d6c8b2]/50 relative ${isToday ? 'bg-[#c74132]/5' : ''} ${b ? 'cursor-pointer' : ''}`}
                        style={{ width: dayWidth }}
                        onClick={() => b && setSelected(b)}
                      >
                        {b && (
                          <div className={`absolute top-2 bottom-2 ${barColor[b.status] || 'bg-[#d6c8b2]'} opacity-85
                            ${(isStart || isFirstInView) ? 'left-1.5 rounded-l-full' : 'left-0'}
                            ${isEnd ? 'right-1.5 rounded-r-full' : 'right-0'}`}
                          />
                        )}
                        {isToday && (
                          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#c74132]" />
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Booking detail card */}
      <AnimatePresence>
        {selected && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setSelected(null)}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-[#fffaf4] border border-[#d6c8b2] rounded-2xl p-7 max-w-xs w-full">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full inline-block mb-2 ${
                    selected.status === 'enquiry' ? 'bg-amber-100 text-amber-700' :
                    selected.status === 'upcoming' ? 'bg-blue-100 text-blue-700' :
                    selected.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                    'bg-[#ede3d5] text-[#7a6858]'}`}>{selected.status}</div>
                  <div className="text-xs font-mono text-[#9e8e7e]">{selected.booking_code}</div>
                </div>
                <button onClick={() => setSelected(null)} className="w-8 h-8 rounded-full border border-[#d6c8b2] flex items-center justify-center">
                  <X className="w-3.5 h-3.5 text-[#7a6858]" />
                </button>
              </div>
              <div className="text-xl font-serif italic text-[#1a120c] mb-1">{selected.customers?.full_name || '—'}</div>
              <div className="text-sm text-[#7a6858] mb-4">{selected.customers?.phone || ''}</div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-[#9e8e7e]">From</div>
                  <div className="text-[#1a120c] font-mono mt-0.5">{selected.from_date}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-[#9e8e7e]">Until</div>
                  <div className="text-[#1a120c] font-mono mt-0.5">{selected.to_date}</div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function AdminMaintenance() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [cars, setCars] = useState([]);
  const [form, setForm] = useState({ car_id: "", service_type: "", due_date: "", priority: "medium", notes: "" });
  const [saving, setSaving] = useState(false);

  async function loadRecords() {
    setLoading(true);
    const { data, error } = await supabase
      .from('maintenance')
      .select(`id, service_type, due_date, priority, status, cost, notes, created_at, cars ( brand, model, plate_number )`)
      .order('due_date', { ascending: true });
    if (!error) setRecords(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadRecords();
    supabase.from('cars').select('id, brand, model, plate_number').then(({ data }) => setCars(data || []));
  }, []);

  async function handleAdd(e) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from('maintenance').insert({
      car_id: form.car_id,
      service_type: form.service_type,
      due_date: form.due_date,
      priority: form.priority,
      notes: form.notes,
      status: 'pending',
    });
    if (error) { alert("Error: " + error.message); }
    else {
      setShowAdd(false);
      setForm({ car_id: "", service_type: "", due_date: "", priority: "medium", notes: "" });
      loadRecords();
    }
    setSaving(false);
  }

  const today = new Date().toISOString().slice(0, 10);
  const thisMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10);

  const dueToday = records.filter(r => r.due_date === today && r.status !== 'completed');
  const upcomingMonth = records.filter(r => r.due_date > today && r.due_date <= thisMonthEnd && r.status !== 'completed');
  const spendYTD = records.filter(r => r.status === 'completed').reduce((s, r) => s + (r.cost || 0), 0);

  function dueDateLabel(d) {
    if (!d) return "—";
    if (d === today) return "Today";
    const diff = Math.round((new Date(d) - new Date(today)) / 86400000);
    if (diff < 0) return `${Math.abs(diff)}d overdue`;
    if (diff === 1) return "Tomorrow";
    return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  }

  return (
    <motion.div {...fadeUp}>
      <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
        <div>
          <div className="text-xs uppercase tracking-wider text-[#7a6858]">Vehicle health · live</div>
          <h1 className="text-4xl font-serif italic text-[#1a120c] mt-1">Service & maintenance</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={loadRecords} className="px-4 py-2 border border-[#bfaf9a] text-[#3d2e1e] rounded-full text-xs uppercase tracking-wider hover:border-[#c74132]/60">
            Refresh
          </button>
          <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-[#c74132] text-[#1a120c] rounded-full text-xs uppercase tracking-wider inline-flex items-center gap-2">
            <Plus className="w-3.5 h-3.5" /> Add record
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-8">
        <div className={`border rounded-xl p-5 ${dueToday.length > 0 ? "border-orange-400/30 bg-orange-400/5" : "border-[#d6c8b2] bg-[#fffaf4]/60"}`}>
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className={`w-4 h-4 ${dueToday.length > 0 ? "text-orange-400" : "text-[#7a6858]"}`} />
            <div className={`text-xs uppercase tracking-wider ${dueToday.length > 0 ? "text-orange-400" : "text-[#7a6858]"}`}>
              {dueToday.length > 0 ? "Action needed" : "All clear today"}
            </div>
          </div>
          <div className="text-3xl font-serif text-[#1a120c] mt-2">{dueToday.length}</div>
          <div className="text-[10px] uppercase tracking-wider text-[#7a6858] mt-1">Due today</div>
        </div>
        <div className="border border-[#d6c8b2] rounded-xl p-5 bg-[#fffaf4]/60">
          <div className="text-xs uppercase tracking-wider text-[#7a6858]">Upcoming this month</div>
          <div className="text-3xl font-serif text-[#1a120c] mt-2">{upcomingMonth.length}</div>
        </div>
        <div className="border border-[#d6c8b2] rounded-xl p-5 bg-[#fffaf4]/60">
          <div className="text-xs uppercase tracking-wider text-[#7a6858]">Service spend (completed)</div>
          <div className="text-3xl font-serif text-[#1a120c] mt-2">{formatINR(spendYTD)}</div>
        </div>
      </div>

      {loading ? (
        <div className="border border-[#d6c8b2] rounded-xl p-12 text-center">
          <div className="text-[#5a4838] text-sm uppercase tracking-widest">Loading records…</div>
        </div>
      ) : records.length === 0 ? (
        <div className="border border-[#d6c8b2] rounded-xl p-12 text-center">
          <div className="text-[#5a4838]">No maintenance records yet.</div>
        </div>
      ) : (
        <div className="border border-[#d6c8b2] rounded-xl bg-[#fffaf4]/60 overflow-hidden">
          {records.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
              className="flex items-center gap-4 p-5 border-b border-[#d6c8b2] last:border-0 hover:bg-[#ede3d5]/40 transition-colors"
            >
              <div className={`w-1 h-12 rounded-full flex-shrink-0 ${
                s.priority === "high" ? "bg-orange-400" :
                s.priority === "medium" ? "bg-[#c74132]" : "bg-[#9e8e7e]"
              }`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <div className="text-[#1a120c]">
                    {s.cars ? `${s.cars.brand} ${s.cars.model}` : "—"}
                  </div>
                  <span className="text-xs text-[#7a6858] font-mono">{s.cars?.plate_number || ""}</span>
                </div>
                <div className="text-xs text-[#7a6858] mt-1">{s.service_type}</div>
              </div>
              {s.status === 'completed' && (
                <span className="text-[10px] uppercase tracking-wider text-[#4ade80] bg-[#4ade80]/10 px-2 py-0.5 rounded-full">Done</span>
              )}
              <div className="text-right">
                <div className={`text-sm ${s.due_date === today ? "text-orange-400" : "text-[#1a120c]"}`}>
                  {dueDateLabel(s.due_date)}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-[#9e8e7e]">due date</div>
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
              className="bg-[#fffaf4] border border-[#bfaf9a] rounded-2xl p-8 max-w-lg w-full">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-serif italic text-[#1a120c]">Add maintenance record</h2>
                <button onClick={() => setShowAdd(false)} className="w-9 h-9 rounded-full border border-[#bfaf9a] flex items-center justify-center">
                  <X className="w-4 h-4 text-[#5a4838]" />
                </button>
              </div>
              <form onSubmit={handleAdd} className="space-y-4">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-[#7a6858]">Vehicle</label>
                  <select required value={form.car_id} onChange={e => setForm({ ...form, car_id: e.target.value })}
                    className="w-full mt-1.5 bg-[#ede3d5] border border-[#bfaf9a] rounded-lg px-4 py-2.5 text-[#1a120c]">
                    <option value="">Select a car…</option>
                    {cars.map(c => (
                      <option key={c.id} value={c.id}>{c.brand} {c.model} · {c.plate_number}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-[#7a6858]">Service type</label>
                  <input required value={form.service_type} onChange={e => setForm({ ...form, service_type: e.target.value })}
                    placeholder="e.g. Oil change, Tyre rotation…"
                    className="w-full mt-1.5 bg-[#ede3d5] border border-[#bfaf9a] rounded-lg px-4 py-2.5 text-[#1a120c] placeholder-[#9e8e7e] outline-none focus:border-[#c74132]/60" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-[#7a6858]">Due date</label>
                    <input required type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })}
                      className="w-full mt-1.5 bg-[#ede3d5] border border-[#bfaf9a] rounded-lg px-4 py-2.5 text-[#1a120c] outline-none focus:border-[#c74132]/60" />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-[#7a6858]">Priority</label>
                    <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}
                      className="w-full mt-1.5 bg-[#ede3d5] border border-[#bfaf9a] rounded-lg px-4 py-2.5 text-[#1a120c]">
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-[#7a6858]">Notes (optional)</label>
                  <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                    placeholder="Any additional details…"
                    className="w-full mt-1.5 bg-[#ede3d5] border border-[#bfaf9a] rounded-lg px-4 py-2.5 text-[#1a120c] placeholder-[#9e8e7e] outline-none focus:border-[#c74132]/60" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowAdd(false)} disabled={saving}
                    className="px-5 py-2.5 border border-[#bfaf9a] text-[#3d2e1e] rounded-full text-xs uppercase tracking-wider disabled:opacity-50">
                    Cancel
                  </button>
                  <button type="submit" disabled={saving}
                    className="flex-1 bg-[#c74132] hover:bg-[#d63239] text-[#1a120c] px-5 py-2.5 rounded-full text-xs uppercase tracking-wider disabled:opacity-50">
                    {saving ? "Saving…" : "Add record"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ========================== ROOT ========================== */
function todayStr() { return new Date().toISOString().slice(0, 10); }
function plusDays(n) { return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10); }

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [ownerSession, setOwnerSession] = useState(null);
  const [customerSession, setCustomerSession] = useState(null);
  const [customerProfile, setCustomerProfile] = useState(null);
  const [showCustomerAuth, setShowCustomerAuth] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [searchFrom, setSearchFrom] = useState(todayStr);
  const [searchTo, setSearchTo] = useState(() => plusDays(3));

  // setView wrapper — keeps old call-sites working
  const setView = useCallback((v) => {
    const routes = { home: '/', fleet: '/fleet', booking: '/booking', 'customer-dash': '/my-trips', 'admin-dash': '/admin' };
    navigate(routes[v] ?? '/');
  }, [navigate]);

  // goToBooking — navigate to /booking passing car via router state
  const goToBooking = useCallback((car) => {
    navigate('/booking', { state: { car } });
  }, [navigate]);

  async function applySession(session) {
    if (!session) {
      setOwnerSession(null); setCustomerSession(null); setCustomerProfile(null);
    } else if (session.user.user_metadata?.role === 'customer') {
      setOwnerSession(null); setCustomerSession(session);
      const { data } = await supabase.from('customers').select('*').eq('email', session.user.email).maybeSingle();
      setCustomerProfile(data || { full_name: session.user.user_metadata?.full_name, email: session.user.email });
    } else {
      // Must be in the owners whitelist table
      const { data: ownerRow } = await supabase
        .from('owners').select('email, name').eq('email', session.user.email).maybeSingle();
      if (ownerRow) {
        setOwnerSession(session);
      } else {
        await supabase.auth.signOut();
        setOwnerSession(null);
      }
      setCustomerSession(null); setCustomerProfile(null);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      applySession(session).then(() => setAuthLoading(false));
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === 'PASSWORD_RECOVERY') { setShowPasswordReset(true); return; }
      applySession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [location.pathname]);

  function handleScrollTo(sectionId) {
    if (location.pathname === '/') {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      navigate('/', { state: { scrollTo: sectionId } });
    }
  }

  useEffect(() => {
    window.__dk_admin = () => navigate('/admin');
    return () => { delete window.__dk_admin; };
  }, [navigate]);

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate('/');
  }

  const sharedProps = { setView, searchFrom, searchTo, setSearchFrom, setSearchTo };

  return (
    <div className="min-h-screen bg-[#f4e8d0] text-[#1a120c]" style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <style>{`
        body { background: #f4e8d0; }
        .font-serif { font-family: 'Cormorant Garamond', 'Times New Roman', Georgia, serif; font-weight: 500; letter-spacing: -0.02em; }
        .font-mono { font-family: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: #f4e8d0; }
        ::-webkit-scrollbar-thumb { background: #d6c8b2; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #bfaf9a; }
        input::placeholder { color: #9e8e7e; }
        @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
      `}</style>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500;1,600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />

      <NoiseOverlay />
      <Nav ownerSession={ownerSession} customerProfile={customerProfile} onScrollTo={handleScrollTo} onCustomerSignIn={() => setShowCustomerAuth(true)} onCustomerSignOut={async () => { await supabase.auth.signOut(); }} />
      <AnimatePresence>
        {showCustomerAuth && <CustomerAuthModal onClose={() => setShowCustomerAuth(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {showPasswordReset && <PasswordResetModal onClose={() => setShowPasswordReset(false)} />}
      </AnimatePresence>

      <main className="relative z-10">
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Landing key="home" goToBooking={goToBooking} {...sharedProps} />} />
            <Route path="/fleet" element={<FleetPage key="fleet" goToBooking={goToBooking} {...sharedProps} />} />
            <Route path="/booking" element={<BookingPage key="booking" setView={setView} searchFrom={searchFrom} searchTo={searchTo} />} />
            <Route path="/my-trips" element={<CustomerDashboard key="cust" setView={setView} goToBooking={goToBooking} customerProfile={customerProfile} customerSession={customerSession} onSignIn={() => setShowCustomerAuth(true)} />} />
            <Route path="/admin" element={
              !authLoading ? (
                ownerSession
                  ? <AdminDashboard key="admin" setView={setView} onLogout={handleLogout} ownerEmail={ownerSession?.user?.email} />
                  : <OwnerLoginScreen key="owner-login" onSuccess={() => {}} />
              ) : null
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AnimatePresence>
      </main>
    </div>
  );
}