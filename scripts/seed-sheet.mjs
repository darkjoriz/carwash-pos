/**
 * Seed your Google Sheet with the required tabs, headers, and demo rows.
 * Usage:  node scripts/seed-sheet.mjs
 * Requires the same env vars as the app (.env.local).
 */
import { google } from "googleapis";
import { readFileSync, existsSync } from "node:fs";

// Minimal .env.local loader (no extra deps)
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] ??= m[2].replace(/^"(.*)"$/, "$1");
  }
}

const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const key = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
const sheetId = process.env.GOOGLE_SHEET_ID;
if (!email || !key || !sheetId) {
  console.error("Missing env vars. Fill .env.local first.");
  process.exit(1);
}

const auth = new google.auth.JWT({ email, key, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
const sheets = google.sheets({ version: "v4", auth });

const SCHEMA = {
  Services: ["id", "name", "category", "price", "commissionRate", "durationMin", "active"],
  Attendants: ["id", "name", "role", "baseRate", "payType", "active", "pin"],
  Sales: ["id", "datetime", "lines", "subtotal", "tax", "tip", "tipAttendantId", "total", "paymentMethod", "commissionTotal", "customer", "vehicle", "status"],
  Inventory: ["id", "category", "subcategory", "name", "qty", "unitCost", "reorderLevel"],
  Bookings: ["id", "datetime", "customer", "phone", "vehicle", "serviceIds", "attendantId", "status", "notes"],
  Attendance: ["id", "attendantId", "date", "clockIn", "clockOut", "hours"],
  Expenses: ["id", "date", "category", "amount", "note"],
};

const DEMO = {
  Services: [
    ["SV-1", "Express Wash", "Wash", 250, 10, 20, "true"],
    ["SV-2", "Premium Wash & Wax", "Wash", 550, 12, 45, "true"],
    ["SV-3", "Interior Detail", "Detailing", 1200, 15, 90, "true"],
    ["SV-4", "Full Detail", "Detailing", 2500, 18, 180, "true"],
    ["SV-5", "Ceramic Coating", "Detailing", 8000, 20, 300, "true"],
    ["SV-6", "Tire Shine", "Add-on", 150, 10, 10, "true"],
    ["SV-7", "Engine Bay Clean", "Add-on", 600, 15, 40, "true"],
  ],
  Attendants: [
    ["AT-1", "Marco Reyes", "Lead Detailer", 750, "daily", "true", "1111"],
    ["AT-2", "Jun Santos", "Washer", 600, "daily", "true", "2222"],
    ["AT-3", "Pia Cruz", "Detailer", 650, "daily", "true", "3333"],
  ],
  Inventory: [
    ["I-1", "Chemicals", "Soap", "Foam Shampoo 5L", 8, 450, 3],
    ["I-2", "Chemicals", "Wax", "Carnauba Wax 1L", 4, 800, 2],
    ["I-3", "Chemicals", "Coating", "Ceramic Coating Kit", 2, 3500, 1],
    ["I-4", "Supplies", "Cloth", "Microfiber Towels (pk)", 12, 250, 5],
    ["I-5", "Supplies", "Applicator", "Foam Applicators (pk)", 2, 180, 4],
  ],
  Expenses: [
    ["E-1", new Date().toISOString().slice(0, 10), "Utilities", 3500, "Water + electricity"],
    ["E-2", new Date().toISOString().slice(0, 10), "Rent", 25000, "Monthly bay rent"],
  ],
};

async function getExistingTabs() {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  return new Map(meta.data.sheets.map((s) => [s.properties.title, s.properties.sheetId]));
}

async function run() {
  const existing = await getExistingTabs();
  const requests = [];
  for (const tab of Object.keys(SCHEMA)) {
    if (!existing.has(tab)) requests.push({ addSheet: { properties: { title: tab } } });
  }
  if (requests.length) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: sheetId, requestBody: { requests } });
    console.log("Created tabs:", requests.map((r) => r.addSheet.properties.title).join(", "));
  }
  for (const [tab, headers] of Object.entries(SCHEMA)) {
    const values = [headers, ...(DEMO[tab] || [])];
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${tab}!A1`,
      valueInputOption: "RAW",
      requestBody: { values },
    });
    console.log(`Seeded ${tab} (${(DEMO[tab] || []).length} demo rows)`);
  }
  console.log("\nDone. Your sheet is ready.");
}
run().catch((e) => { console.error(e.message); process.exit(1); });
