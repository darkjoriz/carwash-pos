# Carwash & Detailing POS + Manager — Template

A standalone, fully re-skinnable point-of-sale and management web app for carwash
and auto-detailing businesses. Built with **Next.js 14** (App Router) and backed by
**Google Sheets** — no database to host. Deploy free on **Vercel**, clone it for
every new location or client.

Three role-based views:

| View | What it does |
|------|--------------|
| **POS** | Ring up services, assign attendant(s) per service, take payment, track tips, preview commission, take bookings. |
| **Admin** | Sales & P&L, payment mix, low-stock alerts, services CRUD, inventory (category + subcategory), attendance → payroll, commission % per service, bookings overview, expenses. |
| **Attendant** | Clock in/out, see services rendered, commission, tips, base + gross pay, and assigned jobs. |

---

## 1. Quick start (local)

```bash
npm install
cp .env.example .env.local   # then fill in your Google credentials (step 2)
npm run seed                 # creates the tabs + demo data in your Sheet
npm run dev                  # http://localhost:3000
```

## 2. Google Sheets backend setup

1. Create a Google Sheet. Copy its ID from the URL:
   `docs.google.com/spreadsheets/d/`**`<SHEET_ID>`**`/edit`
2. In [Google Cloud Console](https://console.cloud.google.com): create a project,
   **enable the Google Sheets API**.
3. Create a **Service Account**, then add a **JSON key** to it. Download the JSON.
4. From that JSON, copy `client_email` and `private_key` into `.env.local`:
   ```
   GOOGLE_SERVICE_ACCOUNT_EMAIL=...@...iam.gserviceaccount.com
   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   GOOGLE_SHEET_ID=<SHEET_ID>
   ```
   Keep the `\n` escapes — they're restored at runtime.
5. **Share the Sheet** with the service-account email as **Editor**.
6. Run `npm run seed` to auto-create all tabs, headers, and demo rows.

### Tabs & columns the app expects

| Tab | Columns |
|-----|---------|
| `Services` | id, name, category, price, commissionRate, durationMin, active |
| `Attendants` | id, name, role, baseRate, payType, active, pin |
| `Sales` | id, datetime, lines, subtotal, tax, tip, tipAttendantId, total, paymentMethod, commissionTotal, customer, vehicle, status |
| `Inventory` | id, category, subcategory, name, qty, unitCost, reorderLevel |
| `Bookings` | id, datetime, customer, phone, vehicle, serviceIds, attendantId, status, notes |
| `Attendance` | id, attendantId, date, clockIn, clockOut, hours |
| `Expenses` | id, date, category, amount, note |

`lines` (Sales) and `serviceIds` (Bookings) are encoded — the app handles it. Don't
edit those cells by hand.

## 3. Deploy to Vercel

1. Push this folder to a GitHub repo.
2. Import it at [vercel.com/new](https://vercel.com/new).
3. Add the three env vars (`GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`,
   `GOOGLE_SHEET_ID`) under **Project → Settings → Environment Variables**.
   Paste the private key with real newlines or keep the `\n` form — both work.
4. Deploy. That's it.

---

## 4. Re-branding (the whole point of the template)

Everything visual and business-specific lives in **one file**:
**`config/branding.ts`**

```ts
export const branding = {
  businessName: "Apex Auto Spa",
  tagline: "Wash · Detail · Protect",
  logoUrl: "",                       // drop a file in /public, e.g. "/logo.svg"
  colors: { bg, surface, primary, ... },   // full palette
  currency, currencySymbol, locale,
  defaultCommissionRate, taxRate,
  paymentMethods: ["Cash", "Card", "GCash", ...],
};
```

- **Colors** are injected as CSS variables at runtime, so changing a hex value
  re-skins every screen — no rebuild logic to touch.
- **Logo**: set `logoUrl` to a file in `/public`. Empty = text logo from `businessName`.
- **Currency / locale / tax / payment methods / default commission** all live here.

To spin up a new client: copy the repo, edit `config/branding.ts`, point it at a
fresh Google Sheet, deploy. Done.

The current palette is a futuristic dark/red automotive theme
(signal red `#E11D2A` on charcoal `#0E0F11` with chrome accents).

---

## 5. How the money math works

- **Commission** is `price × commissionRate%` per service. When multiple attendants
  are assigned to one service, the commission is split evenly among them.
- **Tips** can be assigned to one attendant or left as a pool (split across everyone
  on the ticket). Tips are pass-through and excluded from business profit.
- **Payroll (per period)** = base pay (daily × days present, or hourly × hours logged)
  + commission + tips.
- **P&L**: Revenue − COGS = Gross profit; − commissions − operating expenses = Net profit.

All calculation logic is pure and centralized in `lib/data.ts` (easy to audit/adjust).

---

## 6. Project structure

```
config/branding.ts      ← edit this to rebrand
app/
  page.tsx              ← role picker (landing)
  pos/                  ← POS view + booking calendar
  admin/                ← reports, services, inventory, attendance, commission, bookings
  attendant/            ← attendant dashboard + clock in/out
  api/sheets/route.ts   ← single backend endpoint (read/append/update)
lib/
  types.ts              ← domain types
  tabs.ts               ← tab names (shared, no deps)
  sheets.ts             ← Google Sheets client (server only)
  data.ts               ← mappers + commission/P&L math
  client.ts             ← browser-side fetch helpers
components/             ← TopBar, BrandStyle, UI primitives
scripts/seed-sheet.mjs  ← one-shot Sheet setup + demo data
```

## Notes & next steps you may want

- **Auth**: the attendant view uses a simple name picker (a `pin` column exists in
  the Attendants tab if you want to enforce a code). For real production, add proper
  auth (e.g. NextAuth) before exposing Admin publicly.
- **Caching**: the API uses `no-store` for fresh reads. For high traffic, add a short
  revalidate window.
- **Void/refunds**: sales carry a `status` field (`paid`/`void`); wire a void button
  in Admin if needed.
