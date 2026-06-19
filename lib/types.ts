// ============================================================
//  DOMAIN TYPES — shared across POS / Admin / Attendant views
// ============================================================

export type Role = "pos" | "admin" | "attendant";

export interface Service {
  id: string;
  name: string;
  category: string;       // e.g. "Wash", "Detailing", "Add-on"
  price: number;
  commissionRate: number; // percent, overrides default
  durationMin: number;    // for booking calendar
  active: boolean;
}

export interface Attendant {
  id: string;
  name: string;
  role: string;           // e.g. "Detailer", "Washer", "Lead"
  baseRate: number;       // daily or hourly base pay
  payType: "daily" | "hourly";
  active: boolean;
  pin?: string;           // simple login pin for attendant view
}

// A single line on a sale (one service performed by one or more attendants)
export interface SaleLine {
  serviceId: string;
  serviceName: string;
  price: number;
  attendantIds: string[]; // attendants splitting this service
  commissionRate: number;
  commissionTotal: number;
}

export interface Sale {
  id: string;
  datetime: string;       // ISO
  lines: SaleLine[];
  subtotal: number;
  tax: number;
  tip: number;
  tipAttendantId: string; // who the tip goes to ("" = split)
  total: number;
  paymentMethod: string;
  commissionTotal: number;
  customer?: string;
  vehicle?: string;
  status: "paid" | "void";
}

export interface InventoryItem {
  id: string;
  category: string;
  subcategory: string;
  name: string;
  qty: number;
  unitCost: number;
  reorderLevel: number;
}

export interface Booking {
  id: string;
  datetime: string;       // ISO start
  customer: string;
  phone: string;
  vehicle: string;
  serviceIds: string[];
  attendantId: string;
  status: "booked" | "in_progress" | "done" | "cancelled" | "no_show";
  notes?: string;
}

export interface AttendanceRecord {
  id: string;
  attendantId: string;
  date: string;           // YYYY-MM-DD
  clockIn: string;        // ISO
  clockOut: string;       // ISO or ""
  hours: number;
}

export interface Expense {
  id: string;
  date: string;           // YYYY-MM-DD
  category: string;       // e.g. "Supplies", "Rent", "Utilities", "Payroll"
  amount: number;
  note: string;
}

export interface PnL {
  revenue: number;
  tips: number;
  commissionsPaid: number;
  cogs: number;           // cost of goods sold (inventory consumed)
  expenses: number;
  grossProfit: number;
  netProfit: number;
}

// Generic API response
export interface ApiResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}
