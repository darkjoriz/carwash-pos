// ============================================================
//  SHEET SETUP (browser-triggered, no terminal needed)
//  Creates every required tab, writes headers, adds demo rows.
//  Safe to re-run: existing tabs reused; demo rows only added
//  when a tab has no data yet.
// ============================================================
import { sheetsClient } from "./sheets";
import { hashPassword } from "./auth";

const SCHEMA: Record<string, string[]> = {
  Users: ["id", "username", "passwordHash", "role", "attendantId", "displayName", "active"],
  Services: ["id", "name", "category", "price", "commissionRate", "durationMin", "active"],
  Recipes: ["id", "serviceId", "itemId", "qtyPerService"],
  Attendants: ["id", "name", "role", "baseRate", "payType", "otRatePerHour", "active", "pin",
    "phone", "email", "address", "birthdate", "emergencyContact",
    "bankName", "bankAccountName", "bankAccountNumber", "documentsUrl", "notes"],
  Sales: ["id", "datetime", "lines", "subtotal", "tax", "tip", "tipAttendantId", "total",
    "paymentMethod", "commissionTotal", "customer", "customerPhone", "customerEmail",
    "vehicle", "carPhotoUrl", "signatureUrl", "cashierId", "status"],
  Inventory: ["id", "category", "subcategory", "name", "unit", "unitCost", "reorderLevel"],
  StockMovements: ["id", "datetime", "itemId", "type", "qty", "unitCost", "reason", "reference", "receiptUrl"],
  Bookings: ["id", "datetime", "customer", "phone", "vehicle", "serviceIds", "attendantId", "status", "notes"],
  Attendance: ["id", "attendantId", "date", "clockIn", "clockOut", "hours", "otHours", "note"],
  Expenses: ["id", "date", "kind", "category", "amount", "note", "receiptUrl"],
  Settings: ["key", "value"],
};

const today = () => new Date().toISOString().slice(0, 10);
const nowISO = () => new Date().toISOString();

function demo(): Record<string, (string | number)[][]> {
  return {
    Users: [
      ["U-1", "admin", hashPassword("admin123"), "admin", "", "Owner", "true"],
      ["U-2", "cashier", hashPassword("cashier123"), "cashier", "", "Front Desk", "true"],
      ["U-3", "marco", hashPassword("marco123"), "attendant", "AT-1", "Marco Reyes", "true"],
    ],
    Services: [
      ["SV-1", "Express Wash", "Wash", 250, 10, 20, "true"],
      ["SV-2", "Premium Wash & Wax", "Wash", 550, 12, 45, "true"],
      ["SV-3", "Interior Detail", "Detailing", 1200, 15, 90, "true"],
      ["SV-4", "Full Detail", "Detailing", 2500, 18, 180, "true"],
      ["SV-5", "Ceramic Coating", "Detailing", 8000, 20, 300, "true"],
      ["SV-6", "Tire Shine", "Add-on", 150, 10, 10, "true"],
      ["SV-7", "Engine Bay Clean", "Add-on", 600, 15, 40, "true"],
    ],
    Inventory: [
      ["I-1", "Chemicals", "Soap", "Foam Shampoo", "ml", 0.09, 1000],
      ["I-2", "Chemicals", "Wax", "Carnauba Wax", "ml", 0.8, 500],
      ["I-3", "Chemicals", "Coating", "Ceramic Coating", "ml", 17.5, 100],
      ["I-4", "Chemicals", "Tire", "Tire Shine", "ml", 0.25, 500],
      ["I-5", "Supplies", "Cloth", "Microfiber Towels", "pcs", 25, 20],
    ],
    // Recipes: how much each service consumes (item base unit)
    Recipes: [
      ["R-1", "SV-1", "I-1", 50],   // Express Wash -> 50 ml shampoo
      ["R-2", "SV-1", "I-4", 20],   // Express Wash -> 20 ml tire shine
      ["R-3", "SV-2", "I-1", 80],   // Premium -> 80 ml shampoo
      ["R-4", "SV-2", "I-2", 30],   // Premium -> 30 ml wax
      ["R-5", "SV-2", "I-4", 20],
      ["R-6", "SV-5", "I-3", 60],   // Ceramic -> 60 ml coating
      ["R-7", "SV-6", "I-4", 25],   // Tire Shine add-on -> 25 ml
    ],
    StockMovements: [
      ["M-1", nowISO(), "I-1", "IN", 5000, 0.09, "Opening stock", "PO-001", ""],
      ["M-2", nowISO(), "I-2", "IN", 1000, 0.8, "Opening stock", "PO-001", ""],
      ["M-3", nowISO(), "I-3", "IN", 500, 17.5, "Opening stock", "PO-002", ""],
      ["M-4", nowISO(), "I-4", "IN", 2000, 0.25, "Opening stock", "PO-001", ""],
      ["M-5", nowISO(), "I-5", "IN", 100, 25, "Opening stock", "PO-003", ""],
    ],
    Attendants: [
      ["AT-1", "Marco Reyes", "Lead Detailer", 750, "daily", 80, "true", "1111",
        "09170000001", "marco@example.com", "", "", "", "BDO", "Marco Reyes", "0012-3456-7890", "", ""],
      ["AT-2", "Jun Santos", "Washer", 600, "daily", 70, "true", "2222",
        "09170000002", "", "", "", "", "", "", "", "", ""],
      ["AT-3", "Pia Cruz", "Detailer", 650, "daily", 75, "true", "3333",
        "09170000003", "", "", "", "", "", "", "", "", ""],
    ],
    Expenses: [
      ["E-1", today(), "fixed", "Rent", 25000, "Monthly bay rent", ""],
      ["E-2", today(), "fixed", "Utilities", 3500, "Water + electricity", ""],
    ],
    Settings: [
      ["defaultExpectedHours", "8"],
      ["defaultOtRatePerHour", "75"],
      ["maxOtHoursPerDay", "4"],
    ],
  };
}

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
  const DEMO = demo();

  const meta = await sheets.spreadsheets.get({ spreadsheetId: id });
  const existing = new Set((meta.data.sheets ?? []).map((s) => s.properties?.title ?? ""));

  const toCreate = Object.keys(SCHEMA).filter((t) => !existing.has(t));
  if (toCreate.length) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: id,
      requestBody: { requests: toCreate.map((title) => ({ addSheet: { properties: { title } } })) },
    });
  }

  const seededTabs: string[] = [];
  const skippedTabs: string[] = [];

  for (const [tab, headers] of Object.entries(SCHEMA)) {
    const cur = await sheets.spreadsheets.values.get({
      spreadsheetId: id, range: `${tab}!A1:Z10000`,
    });
    const rows = cur.data.values ?? [];
    const hasData = rows.length > 1;

    const values: (string | number)[][] = [headers];
    if (includeDemo && !hasData && DEMO[tab]) {
      values.push(...DEMO[tab]);
      seededTabs.push(tab);
    } else if (hasData) {
      skippedTabs.push(tab);
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId: id, range: `${tab}!A1`, valueInputOption: "RAW",
      requestBody: { values },
    });
  }

  return { createdTabs: toCreate, seededTabs, skippedTabs };
}
