// ============================================================
//  DATA MAPPERS + BUSINESS LOGIC
//  Converts raw sheet rows <-> typed domain objects, and holds
//  pure functions for commission / inventory / payroll / P&L.
// ============================================================
import { branding } from "@/config/branding";
import type {
  User, Service, Recipe, Attendant, Sale, SaleLine,
  InventoryItem, StockMovement, InventoryStatus,
  Booking, AttendanceRecord, Expense, PayrollSettings, PnL,
  QueueEntry, QueueStatus, QueueSource,
} from "./types";

const num = (v: unknown, d = 0) => {
  const n = parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? d : n;
};
const bool = (v: unknown) => String(v).toLowerCase() === "true" || v === "1";
const list = (v: unknown) =>
  String(v ?? "").split("|").map((s) => s.trim()).filter(Boolean);

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
export function money(n: number): string {
  return `${branding.currencySymbol}${n.toLocaleString(branding.locale, {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })}`;
}

// ---------- Users ----------
export function toUser(r: Record<string, string>): User {
  return {
    id: r.id,
    username: r.username,
    passwordHash: r.passwordHash || "",
    role: (r.role as User["role"]) || "cashier",
    attendantId: r.attendantId || "",
    displayName: r.displayName || r.username,
    active: r.active === "" ? true : bool(r.active),
  };
}

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

// ---------- Recipes ----------
export function toRecipe(r: Record<string, string>): Recipe {
  return {
    id: r.id,
    serviceId: r.serviceId,
    itemId: r.itemId,
    qtyPerService: num(r.qtyPerService),
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
    otRatePerHour: num(r.otRatePerHour),
    active: r.active === "" ? true : bool(r.active),
    pin: r.pin || undefined,
    phone: r.phone || "",
    email: r.email || "",
    address: r.address || "",
    birthdate: r.birthdate || "",
    emergencyContact: r.emergencyContact || "",
    bankName: r.bankName || "",
    bankAccountName: r.bankAccountName || "",
    bankAccountNumber: r.bankAccountNumber || "",
    documentsUrl: r.documentsUrl || "",
    notes: r.notes || "",
  };
}

export function attendantToRow(a: Attendant): Record<string, string | number> {
  return {
    id: a.id, name: a.name, role: a.role, baseRate: a.baseRate,
    payType: a.payType, otRatePerHour: a.otRatePerHour, active: String(a.active),
    pin: a.pin || "", phone: a.phone, email: a.email, address: a.address,
    birthdate: a.birthdate, emergencyContact: a.emergencyContact,
    bankName: a.bankName, bankAccountName: a.bankAccountName,
    bankAccountNumber: a.bankAccountNumber, documentsUrl: a.documentsUrl, notes: a.notes,
  };
}

// ---------- Sales ----------
export function toSale(r: Record<string, string>): Sale {
  let lines: SaleLine[] = [];
  try { lines = JSON.parse(r.lines || "[]"); } catch { lines = []; }
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
    customerPhone: r.customerPhone || undefined,
    customerEmail: r.customerEmail || undefined,
    vehicle: r.vehicle || undefined,
    carPhotoUrl: r.carPhotoUrl || undefined,
    signatureUrl: r.signatureUrl || undefined,
    cashierId: r.cashierId || undefined,
    status: (r.status as "paid" | "void") || "paid",
  };
}

export function saleToRow(s: Sale): Record<string, string | number> {
  return {
    id: s.id, datetime: s.datetime, lines: JSON.stringify(s.lines),
    subtotal: s.subtotal, tax: s.tax, tip: s.tip, tipAttendantId: s.tipAttendantId,
    total: s.total, paymentMethod: s.paymentMethod, commissionTotal: s.commissionTotal,
    customer: s.customer || "", customerPhone: s.customerPhone || "",
    customerEmail: s.customerEmail || "", vehicle: s.vehicle || "",
    carPhotoUrl: s.carPhotoUrl || "", signatureUrl: s.signatureUrl || "",
    cashierId: s.cashierId || "", status: s.status,
  };
}

// ---------- Inventory ----------
export function toInventory(r: Record<string, string>): InventoryItem {
  return {
    id: r.id,
    category: r.category || "Uncategorized",
    subcategory: r.subcategory || "",
    name: r.name,
    unit: r.unit || "pcs",
    unitCost: num(r.unitCost),
    reorderLevel: num(r.reorderLevel),
  };
}

export function toMovement(r: Record<string, string>): StockMovement {
  return {
    id: r.id,
    datetime: r.datetime,
    itemId: r.itemId,
    type: (r.type as StockMovement["type"]) || "ADJUST",
    qty: num(r.qty),
    unitCost: num(r.unitCost),
    reason: r.reason || "",
    reference: r.reference || "",
    receiptUrl: r.receiptUrl || "",
  };
}

// ---------- Bookings ----------
export function toBooking(r: Record<string, string>): Booking {
  return {
    id: r.id, datetime: r.datetime, customer: r.customer, phone: r.phone || "",
    vehicle: r.vehicle || "", serviceIds: list(r.serviceIds),
    attendantId: r.attendantId || "",
    status: (r.status as Booking["status"]) || "booked", notes: r.notes || "",
  };
}
export function bookingToRow(b: Booking): Record<string, string | number> {
  return {
    id: b.id, datetime: b.datetime, customer: b.customer, phone: b.phone,
    vehicle: b.vehicle, serviceIds: b.serviceIds.join("|"),
    attendantId: b.attendantId, status: b.status, notes: b.notes || "",
  };
}

// ---------- Attendance ----------
export function toAttendance(r: Record<string, string>): AttendanceRecord {
  return {
    id: r.id, attendantId: r.attendantId, date: r.date,
    clockIn: r.clockIn || "", clockOut: r.clockOut || "",
    hours: num(r.hours), otHours: num(r.otHours), note: r.note || "",
  };
}

// ---------- Expenses ----------
export function toExpense(r: Record<string, string>): Expense {
  return {
    id: r.id, date: r.date, kind: (r.kind as Expense["kind"]) || "additional",
    category: r.category || "Other", amount: num(r.amount),
    note: r.note || "", receiptUrl: r.receiptUrl || "",
  };
}

// ---------- Settings ----------
export function toPayrollSettings(rows: Record<string, string>[]): PayrollSettings {
  const map: Record<string, string> = {};
  rows.forEach((r) => { if (r.key) map[r.key] = r.value; });
  return {
    defaultExpectedHours: num(map.defaultExpectedHours, 8),
    defaultOtRatePerHour: num(map.defaultOtRatePerHour, 0),
    maxOtHoursPerDay: num(map.maxOtHoursPerDay, 4),
  };
}

// ============================================================
//  COMMISSION
// ============================================================
export function buildSaleLines(
  selected: { service: Service; attendantIds: string[] }[]
): SaleLine[] {
  return selected.map(({ service, attendantIds }) => ({
    serviceId: service.id,
    serviceName: service.name,
    price: service.price,
    attendantIds,
    commissionRate: service.commissionRate,
    commissionTotal: round2((service.price * service.commissionRate) / 100),
  }));
}

export function summarizeSale(lines: SaleLine[], tip: number, taxRate = branding.taxRate) {
  const subtotal = round2(lines.reduce((s, l) => s + l.price, 0));
  const tax = round2((subtotal * taxRate) / 100);
  const commissionTotal = round2(lines.reduce((s, l) => s + l.commissionTotal, 0));
  const total = round2(subtotal + tax + tip);
  return { subtotal, tax, commissionTotal, total };
}

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

export function attendantTips(sales: Sale[], attendantId: string): number {
  let total = 0;
  for (const sale of sales) {
    if (sale.status !== "paid" || sale.tip <= 0) continue;
    if (sale.tipAttendantId === attendantId) total += sale.tip;
    else if (!sale.tipAttendantId) {
      const ids = new Set(sale.lines.flatMap((l) => l.attendantIds));
      if (ids.has(attendantId) && ids.size > 0) total += sale.tip / ids.size;
    }
  }
  return round2(total);
}

// ============================================================
//  INVENTORY ENGINE
//  On-hand = sum of signed movement qty. Avg daily use from
//  recent OUT movements. Days-left projection for reordering.
// ============================================================
export function computeInventoryStatus(
  items: InventoryItem[],
  movements: StockMovement[],
  windowDays = 30
): InventoryStatus[] {
  const now = Date.now();
  const windowMs = windowDays * 86400000;

  return items.map((item) => {
    const mine = movements.filter((m) => m.itemId === item.id);
    const onHand = round2(mine.reduce((s, m) => s + m.qty, 0));

    // average daily usage from OUT movements in the window
    const recentOut = mine.filter(
      (m) => m.qty < 0 && now - new Date(m.datetime).getTime() <= windowMs
    );
    const usedInWindow = Math.abs(recentOut.reduce((s, m) => s + m.qty, 0));
    const avgDailyUse = round2(usedInWindow / windowDays);
    const daysLeft = avgDailyUse > 0 ? Math.floor(onHand / avgDailyUse) : null;

    return {
      item,
      onHand,
      value: round2(onHand * item.unitCost),
      low: onHand <= item.reorderLevel,
      avgDailyUse,
      daysLeft,
    };
  });
}

/**
 * Build OUT movements for the consumables used by a set of sold services.
 * Each service performed consumes its recipe amounts once.
 */
export function buildConsumptionMovements(
  soldServiceIds: string[],
  recipes: Recipe[],
  items: InventoryItem[],
  saleId: string,
  mkId: () => string,
  serviceNameById: (id: string) => string
): Omit<StockMovement, "datetime">[] {
  const movements: Omit<StockMovement, "datetime">[] = [];
  for (const svcId of soldServiceIds) {
    const svcRecipes = recipes.filter((r) => r.serviceId === svcId);
    for (const rec of svcRecipes) {
      const item = items.find((i) => i.id === rec.itemId);
      if (!item || rec.qtyPerService <= 0) continue;
      movements.push({
        id: mkId(),
        itemId: rec.itemId,
        type: "OUT",
        qty: -Math.abs(rec.qtyPerService),
        unitCost: item.unitCost,
        reason: `Auto: ${serviceNameById(svcId)}`,
        reference: saleId,
        receiptUrl: "",
      });
    }
  }
  return movements;
}

/** Total cost of goods consumed (from OUT movements) within a date range. */
export function cogsFromMovements(movements: StockMovement[], from: string, to: string): number {
  const cost = movements
    .filter((m) => m.qty < 0 && m.datetime.slice(0, 10) >= from && m.datetime.slice(0, 10) <= to)
    .reduce((s, m) => s + Math.abs(m.qty) * m.unitCost, 0);
  return round2(cost);
}

// ============================================================
//  PAYROLL (with OT)
// ============================================================
export interface PayBreakdown {
  daysPresent: number;
  regularHours: number;
  otHours: number;
  basePay: number;
  otPay: number;
  commission: number;
  tips: number;
  gross: number;
}

export function computePay(
  attendant: Attendant,
  records: AttendanceRecord[],
  sales: Sale[],
  settings: PayrollSettings
): PayBreakdown {
  const mine = records.filter((r) => r.attendantId === attendant.id);
  const daysPresent = new Set(mine.map((r) => r.date)).size;
  const regularHours = round2(mine.reduce((s, r) => s + r.hours, 0));
  const otHours = round2(mine.reduce((s, r) => s + r.otHours, 0));

  const basePay =
    attendant.payType === "hourly"
      ? round2(regularHours * attendant.baseRate)
      : round2(daysPresent * attendant.baseRate);

  const otRate = attendant.otRatePerHour > 0 ? attendant.otRatePerHour : settings.defaultOtRatePerHour;
  const otPay = round2(otHours * otRate);

  const commission = attendantCommission(sales, attendant.id);
  const tips = attendantTips(sales, attendant.id);
  const gross = round2(basePay + otPay + commission + tips);

  return { daysPresent, regularHours, otHours, basePay, otPay, commission, tips, gross };
}

/** Split worked hours into regular vs OT given expected hours + daily OT cap. */
export function splitHours(totalHours: number, settings: PayrollSettings) {
  const expected = settings.defaultExpectedHours;
  const regular = Math.min(totalHours, expected);
  const otRaw = Math.max(0, totalHours - expected);
  const ot = Math.min(otRaw, settings.maxOtHoursPerDay);
  return { regular: round2(regular), ot: round2(ot) };
}

// ============================================================
//  P&L
// ============================================================
export function computePnL(sales: Sale[], expenses: Expense[], cogs = 0): PnL {
  const paid = sales.filter((s) => s.status === "paid");
  const revenue = round2(paid.reduce((s, x) => s + x.subtotal + x.tax, 0));
  const tips = round2(paid.reduce((s, x) => s + x.tip, 0));
  const commissionsPaid = round2(paid.reduce((s, x) => s + x.commissionTotal, 0));
  const expenseTotal = round2(expenses.reduce((s, x) => s + x.amount, 0));
  const grossProfit = round2(revenue - cogs);
  const netProfit = round2(grossProfit - commissionsPaid - expenseTotal);
  return { revenue, tips, commissionsPaid, cogs: round2(cogs), expenses: expenseTotal, grossProfit, netProfit };
}

// ============================================================
//  QUEUE — mappers + engine
//  Priority sorting (scheduled over walk-in), load-balanced
//  attendant suggestion, free/busy detection, accept gating.
// ============================================================

const PRIORITY_SCHEDULED = 0;
const PRIORITY_WALKIN = 1;

export function toQueueEntry(r: Record<string, string>): QueueEntry {
  return {
    id: r.id,
    createdAt: r.createdAt || "",
    source: (r.source as QueueEntry["source"]) || "walk_in",
    bookingId: r.bookingId || "",
    scheduledTime: r.scheduledTime || "",
    checkedInAt: r.checkedInAt || "",
    customer: r.customer || "",
    phone: r.phone || "",
    vehicle: r.vehicle || "",
    serviceIds: list(r.serviceIds),
    assignedAttendantIds: list(r.assignedAttendantIds),
    acceptedAttendantIds: list(r.acceptedAttendantIds),
    declinedAttendantIds: list(r.declinedAttendantIds),
    preferredAttendantId: r.preferredAttendantId || "",
    autoAssigned: bool(r.autoAssigned),
    status: (r.status as QueueStatus) || "waiting",
    priority: r.priority === "" || r.priority == null ? PRIORITY_WALKIN : num(r.priority),
    saleId: r.saleId || "",
    paid: bool(r.paid),
    startedAt: r.startedAt || "",
    completedAt: r.completedAt || "",
    notes: r.notes || "",
  };
}

export function queueEntryToRow(q: QueueEntry): Record<string, string | number> {
  return {
    id: q.id,
    createdAt: q.createdAt,
    source: q.source,
    bookingId: q.bookingId,
    scheduledTime: q.scheduledTime,
    checkedInAt: q.checkedInAt,
    customer: q.customer,
    phone: q.phone,
    vehicle: q.vehicle,
    serviceIds: q.serviceIds.join("|"),
    assignedAttendantIds: q.assignedAttendantIds.join("|"),
    acceptedAttendantIds: q.acceptedAttendantIds.join("|"),
    declinedAttendantIds: q.declinedAttendantIds.join("|"),
    preferredAttendantId: q.preferredAttendantId,
    autoAssigned: String(q.autoAssigned),
    status: q.status,
    priority: q.priority,
    saleId: q.saleId,
    paid: String(q.paid),
    startedAt: q.startedAt,
    completedAt: q.completedAt,
    notes: q.notes,
  };
}

export function defaultPriority(source: QueueSource): number {
  return source === "scheduled" ? PRIORITY_SCHEDULED : PRIORITY_WALKIN;
}

// Entries that are actively in the live queue (excludes arriving/terminal).
export function liveQueue(entries: QueueEntry[]): QueueEntry[] {
  const active = entries.filter((e) =>
    e.status === "waiting" || e.status === "assigned" || e.status === "in_progress"
  );
  // Sort: priority asc (scheduled first), then check-in/created time asc.
  return active.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    const at = a.checkedInAt || a.createdAt;
    const bt = b.checkedInAt || b.createdAt;
    return at.localeCompare(bt);
  });
}

// Scheduled bookings not yet checked in (the "arriving soon" staging list).
export function arrivingSoon(entries: QueueEntry[]): QueueEntry[] {
  return entries
    .filter((e) => e.status === "arriving")
    .sort((a, b) => (a.scheduledTime || "").localeCompare(b.scheduledTime || ""));
}

// An attendant is BUSY if they're an assigned member of any entry that is
// assigned or in_progress (one active service at a time).
export function busyAttendantIds(entries: QueueEntry[]): Set<string> {
  const busy = new Set<string>();
  for (const e of entries) {
    if (e.status === "assigned" || e.status === "in_progress") {
      e.assignedAttendantIds.forEach((id) => busy.add(id));
    }
  }
  return busy;
}

export function isAttendantBusy(entries: QueueEntry[], attendantId: string): boolean {
  return busyAttendantIds(entries).has(attendantId);
}

// Count of jobs done today per attendant (for load balancing / display).
export function jobsHandledToday(entries: QueueEntry[], attendantId: string, day: string): number {
  return entries.filter(
    (e) =>
      e.assignedAttendantIds.includes(attendantId) &&
      (e.completedAt || "").slice(0, 10) === day
  ).length;
}

export interface AttendantLoad {
  attendant: Attendant;
  busy: boolean;
  activeJobs: number;
  jobsToday: number;
  lastFreedAt: string; // last completedAt; "" if never → idle longest
}

// Build a load snapshot used for suggestions and the turn-order display.
export function attendantLoads(
  attendants: Attendant[],
  entries: QueueEntry[],
  day: string
): AttendantLoad[] {
  const busy = busyAttendantIds(entries);
  return attendants
    .filter((a) => a.active)
    .map((a) => {
      const mine = entries.filter((e) => e.assignedAttendantIds.includes(a.id));
      const completed = mine
        .filter((e) => e.completedAt)
        .map((e) => e.completedAt)
        .sort();
      return {
        attendant: a,
        busy: busy.has(a.id),
        activeJobs: mine.filter((e) => e.status === "assigned" || e.status === "in_progress").length,
        jobsToday: mine.filter((e) => (e.completedAt || "").slice(0, 10) === day).length,
        lastFreedAt: completed.length ? completed[completed.length - 1] : "",
      };
    });
}

// Turn order: free attendants first, ordered by fewest active jobs, then
// fewest jobs today, then idle longest (oldest lastFreedAt first).
export function attendantTurnOrder(loads: AttendantLoad[]): AttendantLoad[] {
  return [...loads].sort((a, b) => {
    if (a.busy !== b.busy) return a.busy ? 1 : -1;
    if (a.activeJobs !== b.activeJobs) return a.activeJobs - b.activeJobs;
    if (a.jobsToday !== b.jobsToday) return a.jobsToday - b.jobsToday;
    return (a.lastFreedAt || "").localeCompare(b.lastFreedAt || "");
  });
}

// Who should be suggested the next waiting job (top free attendant).
export function suggestNextAttendant(loads: AttendantLoad[]): Attendant | null {
  const order = attendantTurnOrder(loads).filter((l) => !l.busy);
  return order.length ? order[0].attendant : null;
}

// Can this attendant accept this entry? Only if not busy elsewhere and they
// are an assigned member who hasn't yet accepted.
export function canAccept(entries: QueueEntry[], entry: QueueEntry, attendantId: string): boolean {
  if (entry.status !== "waiting" && entry.status !== "assigned") return false;
  if (!entry.assignedAttendantIds.includes(attendantId)) return false;
  if (entry.acceptedAttendantIds.includes(attendantId)) return false;
  // busy check excluding THIS entry (in case they're assigned here already)
  const others = entries.filter((e) => e.id !== entry.id);
  return !isAttendantBusy(others, attendantId);
}

// After an accept, decide the resulting status: in_progress only when all
// assigned attendants have accepted.
export function statusAfterAccept(entry: QueueEntry): QueueStatus {
  const allAccepted =
    entry.assignedAttendantIds.length > 0 &&
    entry.assignedAttendantIds.every((id) => entry.acceptedAttendantIds.includes(id));
  return allAccepted ? "in_progress" : "assigned";
}

export function queueWaitMinutes(entry: QueueEntry, now = Date.now()): number {
  const start = entry.checkedInAt || entry.createdAt;
  if (!start) return 0;
  return Math.max(0, Math.round((now - new Date(start).getTime()) / 60000));
}

// ============================================================
//  CLOCK-IN AWARE AUTO-ASSIGNMENT
//  Only clocked-in attendants are in rotation. First round uses
//  clock-in order; afterwards load-balanced. Preferred attendant
//  is honored only if free.
// ============================================================

export interface ClockState {
  attendantId: string;
  clockInISO: string;   // most recent clock-in for the day
  clockedIn: boolean;   // clocked in and not yet out
}

// Derive who is currently clocked in (today) and their clock-in time.
// An attendance row with clockIn and no clockOut = currently clocked in.
export function clockStates(records: AttendanceRecord[], day: string): ClockState[] {
  const todays = records.filter((r) => r.date === day && r.clockIn);
  const byAtt: Record<string, AttendanceRecord[]> = {};
  for (const r of todays) (byAtt[r.attendantId] ||= []).push(r);
  const out: ClockState[] = [];
  for (const [attendantId, rows] of Object.entries(byAtt)) {
    // sort by clockIn; "open" row (no clockOut) means currently in
    rows.sort((a, b) => a.clockIn.localeCompare(b.clockIn));
    const open = rows.find((r) => r.clockIn && !r.clockOut);
    out.push({
      attendantId,
      clockInISO: rows[0].clockIn,
      clockedIn: !!open,
    });
  }
  return out;
}

export function isClockedIn(records: AttendanceRecord[], attendantId: string, day: string): boolean {
  return clockStates(records, day).some((c) => c.attendantId === attendantId && c.clockedIn);
}

// Pick the attendant a new job should auto-assign to.
//  - Only clocked-in + currently free attendants are eligible.
//  - If a preferred attendant is given and they're eligible, use them.
//  - First round (attendant has 0 jobs today): order by clock-in time.
//  - Otherwise: load-balanced (fewest active, fewest today, idle longest).
//  - Skip attendants who already declined this entry.
export function pickAutoAssignee(
  attendants: Attendant[],
  entries: QueueEntry[],
  records: AttendanceRecord[],
  day: string,
  opts: { preferredAttendantId?: string; excludeIds?: string[] } = {}
): Attendant | null {
  const clocks = clockStates(records, day);
  const clockedInIds = new Set(clocks.filter((c) => c.clockedIn).map((c) => c.attendantId));
  const clockInTime: Record<string, string> = {};
  clocks.forEach((c) => { clockInTime[c.attendantId] = c.clockInISO; });

  const busy = busyAttendantIds(entries);
  const exclude = new Set(opts.excludeIds || []);

  const eligible = attendants.filter((a) =>
    a.active && clockedInIds.has(a.id) && !busy.has(a.id) && !exclude.has(a.id)
  );
  if (eligible.length === 0) return null;

  // Preferred attendant wins if eligible.
  if (opts.preferredAttendantId) {
    const pref = eligible.find((a) => a.id === opts.preferredAttendantId);
    if (pref) return pref;
  }

  const jobsToday = (id: string) =>
    entries.filter((e) => e.assignedAttendantIds.includes(id) && (e.completedAt || "").slice(0, 10) === day).length;
  const activeJobs = (id: string) =>
    entries.filter((e) => e.assignedAttendantIds.includes(id) && (e.status === "assigned" || e.status === "in_progress")).length;

  const sorted = [...eligible].sort((a, b) => {
    const aTotal = jobsToday(a.id) + activeJobs(a.id);
    const bTotal = jobsToday(b.id) + activeJobs(b.id);
    // First round: nobody has any jobs yet → both totals 0 → clock-in order.
    if (aTotal === 0 && bTotal === 0) {
      return (clockInTime[a.id] || "").localeCompare(clockInTime[b.id] || "");
    }
    // Otherwise load-balance by total jobs, then clock-in as tiebreaker.
    if (aTotal !== bTotal) return aTotal - bTotal;
    return (clockInTime[a.id] || "").localeCompare(clockInTime[b.id] || "");
  });

  return sorted[0] || null;
}

// Sum a single attendant's commission share for a specific day (completed work).
export function attendantCommissionForDay(
  sales: Sale[], attendantId: string, day: string
): number {
  let total = 0;
  for (const sale of sales) {
    if (sale.status !== "paid") continue;
    if (sale.datetime.slice(0, 10) !== day) continue;
    for (const line of sale.lines) {
      if (line.attendantIds.includes(attendantId)) {
        total += line.commissionTotal / line.attendantIds.length;
      }
    }
  }
  return round2(total);
}
