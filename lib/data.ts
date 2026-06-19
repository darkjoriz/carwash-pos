// ============================================================
//  DATA MAPPERS + BUSINESS LOGIC
//  Converts raw sheet rows <-> typed domain objects, and holds
//  pure functions for commission / P&L math (easy to unit test).
// ============================================================
import { branding } from "@/config/branding";
import type {
  Service,
  Attendant,
  Sale,
  SaleLine,
  InventoryItem,
  Booking,
  AttendanceRecord,
  Expense,
  PnL,
} from "./types";

const num = (v: unknown, d = 0) => {
  const n = parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? d : n;
};
const bool = (v: unknown) => String(v).toLowerCase() === "true" || v === "1";
const list = (v: unknown) =>
  String(v ?? "")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);

// ---------- Services ----------
export function toService(r: Record<string, string>): Service {
  return {
    id: r.id,
    name: r.name,
    category: r.category || "General",
    price: num(r.price),
    commissionRate: r.commissionRate ? num(r.commissionRate) : branding.defaultCommissionRate,
    durationMin: num(r.durationMin, 30),
    active: r.active === "" ? true : bool(r.active),
  };
}

// ---------- Attendants ----------
export function toAttendant(r: Record<string, string>): Attendant {
  return {
    id: r.id,
    name: r.name,
    role: r.role || "Attendant",
    baseRate: num(r.baseRate),
    payType: (r.payType as "daily" | "hourly") || "daily",
    active: r.active === "" ? true : bool(r.active),
    pin: r.pin || undefined,
  };
}

// ---------- Sales ----------
// Sale lines are stored JSON-encoded in a single "lines" cell to keep
// the sheet flat while preserving structure.
export function toSale(r: Record<string, string>): Sale {
  let lines: SaleLine[] = [];
  try {
    lines = JSON.parse(r.lines || "[]");
  } catch {
    lines = [];
  }
  return {
    id: r.id,
    datetime: r.datetime,
    lines,
    subtotal: num(r.subtotal),
    tax: num(r.tax),
    tip: num(r.tip),
    tipAttendantId: r.tipAttendantId || "",
    total: num(r.total),
    paymentMethod: r.paymentMethod || "Cash",
    commissionTotal: num(r.commissionTotal),
    customer: r.customer || undefined,
    vehicle: r.vehicle || undefined,
    status: (r.status as "paid" | "void") || "paid",
  };
}

export function saleToRow(s: Sale): Record<string, string | number> {
  return {
    id: s.id,
    datetime: s.datetime,
    lines: JSON.stringify(s.lines),
    subtotal: s.subtotal,
    tax: s.tax,
    tip: s.tip,
    tipAttendantId: s.tipAttendantId,
    total: s.total,
    paymentMethod: s.paymentMethod,
    commissionTotal: s.commissionTotal,
    customer: s.customer || "",
    vehicle: s.vehicle || "",
    status: s.status,
  };
}

// ---------- Inventory ----------
export function toInventory(r: Record<string, string>): InventoryItem {
  return {
    id: r.id,
    category: r.category || "Uncategorized",
    subcategory: r.subcategory || "",
    name: r.name,
    qty: num(r.qty),
    unitCost: num(r.unitCost),
    reorderLevel: num(r.reorderLevel),
  };
}

// ---------- Bookings ----------
export function toBooking(r: Record<string, string>): Booking {
  return {
    id: r.id,
    datetime: r.datetime,
    customer: r.customer,
    phone: r.phone || "",
    vehicle: r.vehicle || "",
    serviceIds: list(r.serviceIds),
    attendantId: r.attendantId || "",
    status: (r.status as Booking["status"]) || "booked",
    notes: r.notes || "",
  };
}

export function bookingToRow(b: Booking): Record<string, string | number> {
  return {
    id: b.id,
    datetime: b.datetime,
    customer: b.customer,
    phone: b.phone,
    vehicle: b.vehicle,
    serviceIds: b.serviceIds.join("|"),
    attendantId: b.attendantId,
    status: b.status,
    notes: b.notes || "",
  };
}

// ---------- Attendance ----------
export function toAttendance(r: Record<string, string>): AttendanceRecord {
  return {
    id: r.id,
    attendantId: r.attendantId,
    date: r.date,
    clockIn: r.clockIn || "",
    clockOut: r.clockOut || "",
    hours: num(r.hours),
  };
}

// ---------- Expenses ----------
export function toExpense(r: Record<string, string>): Expense {
  return {
    id: r.id,
    date: r.date,
    category: r.category || "Other",
    amount: num(r.amount),
    note: r.note || "",
  };
}

// ============================================================
//  PURE BUSINESS CALCULATIONS
// ============================================================

/** Build sale lines with commission computed per service. */
export function buildSaleLines(
  selected: { service: Service; attendantIds: string[] }[]
): SaleLine[] {
  return selected.map(({ service, attendantIds }) => {
    const commissionTotal = round2((service.price * service.commissionRate) / 100);
    return {
      serviceId: service.id,
      serviceName: service.name,
      price: service.price,
      attendantIds,
      commissionRate: service.commissionRate,
      commissionTotal,
    };
  });
}

export function summarizeSale(
  lines: SaleLine[],
  tip: number,
  taxRate = branding.taxRate
) {
  const subtotal = round2(lines.reduce((s, l) => s + l.price, 0));
  const tax = round2((subtotal * taxRate) / 100);
  const commissionTotal = round2(lines.reduce((s, l) => s + l.commissionTotal, 0));
  const total = round2(subtotal + tax + tip);
  return { subtotal, tax, commissionTotal, total };
}

/** Commission earned by a specific attendant across sales (split evenly per line). */
export function attendantCommission(sales: Sale[], attendantId: string): number {
  let total = 0;
  for (const sale of sales) {
    if (sale.status !== "paid") continue;
    for (const line of sale.lines) {
      if (line.attendantIds.includes(attendantId)) {
        total += line.commissionTotal / line.attendantIds.length;
      }
    }
  }
  return round2(total);
}

/** Tips earned by an attendant (direct tips + even split of unassigned tips). */
export function attendantTips(sales: Sale[], attendantId: string): number {
  let total = 0;
  for (const sale of sales) {
    if (sale.status !== "paid" || sale.tip <= 0) continue;
    if (sale.tipAttendantId === attendantId) {
      total += sale.tip;
    } else if (!sale.tipAttendantId) {
      // unassigned tip -> split among all attendants on the sale
      const ids = new Set(sale.lines.flatMap((l) => l.attendantIds));
      if (ids.has(attendantId) && ids.size > 0) total += sale.tip / ids.size;
    }
  }
  return round2(total);
}

export function computePnL(
  sales: Sale[],
  expenses: Expense[],
  cogs = 0
): PnL {
  const paid = sales.filter((s) => s.status === "paid");
  const revenue = round2(paid.reduce((s, x) => s + x.subtotal + x.tax, 0));
  const tips = round2(paid.reduce((s, x) => s + x.tip, 0));
  const commissionsPaid = round2(paid.reduce((s, x) => s + x.commissionTotal, 0));
  const expenseTotal = round2(expenses.reduce((s, x) => s + x.amount, 0));
  const grossProfit = round2(revenue - cogs);
  const netProfit = round2(grossProfit - commissionsPaid - expenseTotal);
  return {
    revenue,
    tips,
    commissionsPaid,
    cogs: round2(cogs),
    expenses: expenseTotal,
    grossProfit,
    netProfit,
  };
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function money(n: number): string {
  return `${branding.currencySymbol}${n.toLocaleString(branding.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
