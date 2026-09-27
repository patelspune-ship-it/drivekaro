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
