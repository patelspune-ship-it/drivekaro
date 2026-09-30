# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Booking desk (`/desk`)

A separate owner-only panel at **drivekaro.in/desk** for fleet profiles, bookings,
auto-filled rental agreements (template v2.0), payments, invoices and WhatsApp messages.
The old `/admin` dashboard is untouched.

- Page: `desk.html` → `src/desk/main.js` (UI) and `src/desk/store.js` (Supabase storage)
- Data: one table, `public.desk_docs`, locked to emails in `public.owners`
- One-time setup: run `supabase/desk_setup.sql` in Supabase → SQL Editor
- Local dev: `npm run dev`, then open http://localhost:5173/desk.html
- On a phone: open drivekaro.in/desk → Share → Add to Home Screen

### Customers and KYC documents

- Customers are stored in `desk_docs` (collection `customers`, id = 10-digit mobile).
- In a new booking, type the mobile number: existing customers fill in automatically;
  website enquiry customers (old `customers` table) are suggested too.
- KYC files (DL, masked Aadhaar, address proof) upload from the customer profile to the
  owner's Google Drive: `My Drive / DriveKaro Customer KYC / <Name - mobile>`.
  Needs `VITE_GOOGLE_CLIENT_ID` (Google OAuth web client, Drive API enabled, scope `drive.file`).

### Aadhaar eSign (Leegality)

Serverless routes in `api/esign/` (Vercel functions):
`send` (owner-only, creates the Leegality signing request), `webhook` (Leegality → verifies
HMAC-SHA1 `mac`, updates the booking, stores signed PDF + audit trail), `status` (manual refresh),
`file` (short-lived download link). Signed files live in the private Supabase bucket `esign`
(`supabase/esign_setup.sql`).

Vercel env (Secret, not `VITE_`): `LEEGALITY_AUTH_TOKEN`, `LEEGALITY_PRIVATE_SALT`,
`LEEGALITY_PROFILE_ID` (workflow ID), `LEEGALITY_BASE_URL`
(`https://app1.leegality.com/api` or `https://sandbox.leegality.com/api`),
`SUPABASE_SERVICE_ROLE_KEY`. Optional: `LEEGALITY_OWNER_SIGNS=no` if the workflow has only the
customer as signer. Webhook URL for the workflow: `https://www.drivekaro.in/api/esign/webhook`.

### UPI payments (`/pay`)

- Set **Official UPI ID** in Desk → Settings. The desk then shows a UPI QR on each booking's Payments tab and on invoices, and adds a pay link to WhatsApp messages.
- `drivekaro.in/pay?b=<booking id>&a=<amount>` is a public page with the QR and a "Pay with a UPI app" button. The UPI ID always comes from Settings via `/api/pay-info`, never from the link.

### Daily summary email (Vercel Cron + Resend)

- `vercel.json` runs `/api/cron/daily` at 01:30 UTC (about 7 AM IST; Hobby plans may run it any time within that hour).
- Vercel env vars (mark as **Secret**, no `VITE_` prefix):
  - `CRON_SECRET`: any long random string. Vercel sends it to the cron route automatically.
  - `RESEND_API_KEY`: from resend.com (free tier).
  - Optional `RESEND_FROM` (e.g. `DriveKaro Desk <desk@drivekaro.in>`) once the domain is verified in Resend. Without it, mail is sent from `onboarding@resend.dev`, which Resend only delivers to the email you signed up with.
- Recipient: Desk → Settings → "Daily summary email" (or env `SUMMARY_EMAIL`). "Send test email now" in Settings sends one immediately.
- The same summary shows at the top of Bookings ("Today"), with "Summary to my WhatsApp".

### Reminders, service, utilisation

- Pickup / return reminders and Google review requests open WhatsApp with the message ready (free, one tap). Set the Google review link in Settings.
- Service by km: each car has "Service every (km)" (default 10,000) and "Last service at (km)"; the odometer updates from booking pickup and return readings.
- Revenue → "Car utilisation": days on rent vs available, revenue per rented day and profit per day.

## Handover (for the next developer)

The owner's plain-language guide ("DriveKaro System Handover Guide") covers accounts, renewals, settings and troubleshooting. Technical summary:

| Path | What it is |
| --- | --- |
| `index.html`, `src/App.jsx` | Public website and old `/admin` (React) |
| `desk.html`, `src/desk/main.js` | Booking desk (all views, agreement template v2.0, PDFs via jsPDF) |
| `src/desk/store.js` | Document store over `desk_docs` with realtime refresh |
| `src/desk/summary.js` | Shared maths/texts for desk and morning email (money, due now, service by km, day summary, UPI links) |
| `src/desk/drive.js` | Google Drive KYC uploads (`drive.file` scope) |
| `pay.html`, `src/pay.js` | Public UPI pay page |
| `api/esign/*` | Leegality: send, webhook, status, file |
| `api/pay-info.js` | Public: UPI ID + business name only |
| `api/cron/daily.js` | Morning email (Vercel Cron 01:30 UTC) |
| `supabase/*.sql` | One-time DB setup (already run in production) |

- **Data:** `desk_docs(collection, id, data jsonb)`; RLS via `is_desk_owner()` (emails in `public.owners`). Collections: `bookings`, `customers` (id = 10-digit mobile), `fleet`, `expenses`, `settings/business`, `meta/invoice_counter`. Gap-free invoice numbers: RPC `desk_next_invoice(p_fy)`.
- **Statuses:** `confirmed` (quick booking with advance) → `draft` → `ready` → `sent` → `signed` → `handed` → `returned` | `cancelled`. Datetimes are stored without a zone and mean IST (`summary.js` `parseLocal`).
- **Env vars** (Vercel): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GOOGLE_CLIENT_ID`; Secret: `SUPABASE_SERVICE_ROLE_KEY`, `LEEGALITY_AUTH_TOKEN`, `LEEGALITY_PRIVATE_SALT`, `RESEND_API_KEY`, `CRON_SECRET`; plain: `LEEGALITY_PROFILE_ID`, `LEEGALITY_BASE_URL`, optional `LEEGALITY_OWNER_SIGNS`, `RESEND_FROM`, `SUMMARY_EMAIL`, `SITE_URL`.
- **Rules:** store only Aadhaar last 4 digits; no secrets in code or `VITE_` vars; the WhatsApp confirmation terms (`confirmText`) must match the agreement (`buildAgreement`) — both read the same charges.
- **Known gaps:** the public site still uses the old `cars`/`bookings` tables for availability and enquiries (a desk booking can look free online); Supabase caps queries at 1,000 rows (add paging in `store.js` when bookings grow).
- **Workflow:** test at 390 px width; push to `main` deploys via Vercel.

### Staff logins (pickup and drop)

- Owner adds staff in Desk → Settings → Staff logins (name, mobile, password). This creates a Supabase Auth user `s<mobile>@staff.drivekaro.in`; staff sign in at `/desk` with their mobile number.
- Staff never query the database: `api/staff.js` returns only bookings in scope (pickups yesterday–tomorrow, cars out, today's returns) without `commission`, `op_payouts` or `notes`, and accepts only whitelisted fields and steps (`api/_lib/staff.js` `applyStaffPatch`). eSign send/status also accept staff.
- Staff photos go to the owner's Google Drive through a server-side refresh token (Settings → Connect Google Drive for staff). Needs Vercel Secret `GOOGLE_CLIENT_SECRET` (the OAuth web client's secret); the refresh token is stored in `desk_docs` `secrets/drive_server`.

## AI Marketer (`/marketer`)

A separate owner-only page (not linked from the desk yet). It plans a month of Instagram and Google Business Profile posts, draws branded images, writes captions and can post them automatically.

**Files:** `marketer.html`, `src/marketer/` (`calendar.js` holidays and long weekends, `planner.js` monthly plan, `copy.js` captions, `render.js` canvas images, `main.js` UI), `api/marketer.js` (server + autopilot cron), `supabase/marketer_setup.sql`.

**Data (desk_docs):** `mk_settings/brand`, `mk_posts`, `mk_photos`, `mk_events` (your own days), `mk_cache` (holiday feeds, 7 days), `secrets/gbp` (Google Business connection). Images live in the public Supabase Storage bucket `marketing` (car photos in `photos/`, finished posts in `posts/<id>/`). Never put KYC documents in that bucket.

**Holidays:** the server reads Google's public "Holidays in India" calendar and, if `CALENDARIFIC_API_KEY` is set, Calendarific (Maharashtra). Built-in Maharashtra holiday lists (2026, 2027, marked ≈) fill gaps and cover outages. Special days (Valentine's, Mother's Day, Friendship Day…) are computed. The owner can hide wrong dates and add their own days in the Holidays tab. Add the next year's built-in list in `calendar.js` (`FALLBACK`) each year.

**Setup**
1. Supabase → SQL Editor: run `supabase/marketer_setup.sql` (creates the public `marketing` bucket and owner-only upload rules).
2. Vercel env (Secret / Sensitive, no `VITE_` prefix), all optional except where noted:
   - `IG_USER_ID`, `META_ACCESS_TOKEN`: Instagram posting. Needs an Instagram **Business or Creator** account. Create a Meta app (developers.facebook.com), add the Instagram product, and generate a long-lived token with `instagram_business_content_publish` (Instagram login, then also set `IG_GRAPH_HOST=graph.instagram.com`) or `instagram_content_publish` + `pages_show_list` via a Facebook Page (default host `graph.facebook.com`). `META_GRAPH_VERSION` defaults to `v23.0`. Long-lived tokens expire after 60 days unless you use a System User token.
   - Google Business Profile: uses the existing Google OAuth client (`VITE_GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`). In Google Cloud enable "My Business Account Management API", "My Business Business Information API" and "Google My Business API", and request Business Profile API access (form at developers.google.com/my-business, approval can take days; until then quota is 0). Then press Connect in Brand & connections and choose the location.
   - `ANTHROPIC_API_KEY`: turns on "Rewrite with AI" (model `claude-haiku-4-5-20251001`, change with `MARKETER_AI_MODEL`). Without it captions come from templates.
   - `CALENDARIFIC_API_KEY`: second holiday source (free plan is enough).
   - `REMOVE_BG_API_KEY`: one-tap "Remove background" on photos (remove.bg). Cut-outs (transparent PNG, also accepted as uploads) are placed on the designs with a shadow. `REMOVE_BG_SIZE` defaults to `auto`.
   - `CRON_SECRET` (already set for the daily email) is required for autopilot.
3. Autopilot: Vercel Cron calls `GET /api/marketer` daily at 03:00 UTC (8:30–9:30 AM IST on the Hobby plan). It posts only **approved** posts dated today (or yesterday if they failed) and only when Autopilot is ticked. Failures are emailed to the daily-summary address.

**Flow:** Plan → Make plan → check/edit each post → Approve (renders post 1080×1350, story 1080×1920 and square 1080×1080 and uploads them) → autopilot or "Post now". Without Meta/Google set up, use Copy caption + Download image and post by hand.
