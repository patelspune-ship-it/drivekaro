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
