// ============================================================
//  DOMAIN TYPES — shared across all views
// ============================================================

export type ViewRole = "pos" | "admin" | "attendant";
export type UserRole = "admin" | "cashier" | "attendant";

// ---------- Auth / Users ----------
export interface User {
  id: string;
  username: string;
  passwordHash: string;   // salted hash, never plain text
  role: UserRole;
  attendantId: string;    // links attendant users to their profile
  displayName: string;
  active: boolean;
}

// ---------- Services ----------
export interface Service {
  id: string;
  name: string;
  category: string;
  price: number;
  commissionRate: number;
  durationMin: number;
  active: boolean;
}

// ---------- Service recipes (consumption per service) ----------
export interface Recipe {
  id: string;
  serviceId: string;
  itemId: string;
  qtyPerService: number;  // amount in the item's base unit (e.g. 50 ml)
}

// ---------- Attendants (full HR profile) ----------
export interface Attendant {
  id: string;
  name: string;
  role: string;
  baseRate: number;
  payType: "daily" | "hourly";
  otRatePerHour: number;
  active: boolean;
  pin?: string;
  phone: string;
  email: string;
  address: string;
  birthdate: string;
  emergencyContact: string;
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  documentsUrl: string;
  notes: string;
}

// ---------- Sale lines & sales ----------
export interface SaleLine {
  serviceId: string;
  serviceName: string;
  price: number;
  attendantIds: string[];
  commissionRate: number;
  commissionTotal: number;
}

export interface Sale {
  id: string;
  datetime: string;
  lines: SaleLine[];
  subtotal: number;
  tax: number;
  tip: number;
  tipAttendantId: string;
  total: number;
  paymentMethod: string;
  commissionTotal: number;
  customer?: string;
  customerPhone?: string;
  customerEmail?: string;
  vehicle?: string;
  carPhotoUrl?: string;
  signatureUrl?: string;
  cashierId?: string;
  status: "paid" | "void";
}

// ---------- Inventory ----------
export interface InventoryItem {
  id: string;
  category: string;
  subcategory: string;
  name: string;
  unit: string;           // ml, L, g, kg, pcs
  unitCost: number;
  reorderLevel: number;
}

export type MovementType = "IN" | "OUT" | "ADJUST";

export interface StockMovement {
  id: string;
  datetime: string;
  itemId: string;
  type: MovementType;
  qty: number;            // signed: + for IN, - for OUT
  unitCost: number;
  reason: string;
  reference: string;
  receiptUrl: string;
}

export interface InventoryStatus {
  item: InventoryItem;
  onHand: number;
  value: number;
  low: boolean;
  avgDailyUse: number;
  daysLeft: number | null;
}

// ---------- Bookings ----------
export interface Booking {
  id: string;
  datetime: string;
  customer: string;
  phone: string;
  vehicle: string;
  serviceIds: string[];
  attendantId: string;
  status: "booked" | "in_progress" | "done" | "cancelled" | "no_show";
  notes?: string;
}

// ---------- Attendance ----------
export interface AttendanceRecord {
  id: string;
  attendantId: string;
  date: string;
  clockIn: string;
  clockOut: string;
  hours: number;
  otHours: number;
  note: string;
}

// ---------- Expenses ----------
export type ExpenseKind = "fixed" | "additional";

export interface Expense {
  id: string;
  date: string;
  kind: ExpenseKind;
  category: string;
  amount: number;
  note: string;
  receiptUrl: string;
}

// ---------- Settings ----------
export interface PayrollSettings {
  defaultExpectedHours: number;
  defaultOtRatePerHour: number;
  maxOtHoursPerDay: number;
}

// ---------- P&L ----------
export interface PnL {
  revenue: number;
  tips: number;
  commissionsPaid: number;
  cogs: number;
  expenses: number;
  grossProfit: number;
  netProfit: number;
}

export interface ApiResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}
