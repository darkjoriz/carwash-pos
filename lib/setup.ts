// ============================================================
//  SHEET SETUP (browser-triggered, no terminal needed)
//  Creates every required tab, writes headers, and adds demo
//  rows. Safe to run more than once: existing tabs are reused
//  and only get headers re-written (data rows are appended only
//  if the tab has no data yet).
// ============================================================
import { sheetsClient } from "./sheets";

const SCHEMA: Record<string, string[]> = {
  Services: ["id", "name", "category", "price", "commissionRate", "durationMin", "active"],
  Attendants: ["id", "name", "role", "baseRate", "payType", "active", "pin"],
  Sales: ["id", "datetime", "lines", "subtotal", "tax", "tip", "tipAttendantId", "total", "paymentMethod", "commissionTotal", "customer", "vehicle", "status"],
  Inventory: ["id", "category", "subcategory", "name", "qty", "unitCost", "reorderLevel"],
  Bookings: ["id", "datetime", "customer", "phone", "vehicle", "serviceIds", "attendantId", "status", "notes"],
  Attendance: ["id", "attendantId", "date", "clockIn", "clockOut", "hours"],
  Expenses: ["id", "date", "category", "amount", "note"],
};

const today = () => new Date().toISOString().slice(0, 10);

const DEMO: Record<string, (string | number)[][]> = {
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
    ["E-1", today(), "Utilities", 3500, "Water + electricity"],
    ["E-2", today(), "Rent", 25000, "Monthly bay rent"],
  ],
};

export interface SetupResult {
  createdTabs: string[];
  seededTabs: string[];
  skippedTabs: string[];
}

function spreadsheetId(): string {
  const id = process.env.GOOGLE_SHEET_ID;
  if (!id) throw new Error("Missing GOOGLE_SHEET_ID env var.");
  return id;
}

export async function setupSheet(includeDemo: boolean): Promise<SetupResult> {
  const sheets = sheetsClient();
  const id = spreadsheetId();

  // 1. Which tabs already exist?
  const meta = await sheets.spreadsheets.get({ spreadsheetId: id });
  const existing = new Set(
    (meta.data.sheets ?? []).map((s) => s.properties?.title ?? "")
  );

  // 2. Create any missing tabs.
  const toCreate = Object.keys(SCHEMA).filter((t) => !existing.has(t));
  if (toCreate.length) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: id,
      requestBody: {
        requests: toCreate.map((title) => ({ addSheet: { properties: { title } } })),
      },
    });
  }

  const seededTabs: string[] = [];
  const skippedTabs: string[] = [];

  // 3. For each tab: write headers; add demo rows only if empty.
  for (const [tab, headers] of Object.entries(SCHEMA)) {
    // current contents
    const cur = await sheets.spreadsheets.values.get({
      spreadsheetId: id,
      range: `${tab}!A1:Z10000`,
    });
    const rows = cur.data.values ?? [];
    const hasData = rows.length > 1; // more than just a header row

    const values: (string | number)[][] = [headers];
    if (includeDemo && !hasData && DEMO[tab]) {
      values.push(...DEMO[tab]);
      seededTabs.push(tab);
    } else if (hasData) {
      skippedTabs.push(tab);
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId: id,
      range: `${tab}!A1`,
      valueInputOption: "RAW",
      requestBody: { values },
    });
  }

  return { createdTabs: toCreate, seededTabs, skippedTabs };
}
