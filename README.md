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
