// ============================================================
//  /api/queue — stateful queue operations (rules enforced here)
//  Now with clock-in-aware AUTO-ASSIGNMENT.
//
//  Actions (POST { action, ... }):
//   add_walkin     { entry }            cashier adds a walk-in (auto-assigns)
//   self_queue     { entry }            public self-service (auto-assigns)
//   create_booking_entries              sync scheduled bookings -> arriving
//   check_in       { id }               arriving -> waiting (auto-assigns)
//   assign         { id, attendantIds } manual set/replace (override)
//   add_attendant  { id, attendantId }  add one attendant to a job
//   accept         { id, attendantId }  attendant accepts (gated)
//   decline        { id, attendantId }  attendant passes -> flag + reassign
//   complete       { id }               mark done, free + auto-assign next
//   requeue        { id, source }       no-show/again -> back to queue
//   no_show        { id }
//   cancel         { id }
//   reassign       { id, attendantIds } cashier reassign (e.g. to free clock-out)
//   set_paid       { id, saleId }
//   update         { id, patch }
//   autoassign_sweep                    assign any waiting/unassigned jobs
//
//  GET -> all queue rows.
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import { readTable, appendRow, updateRowById, deleteRowById, TABS } from "@/lib/sheets";
import {
  toQueueEntry, queueEntryToRow, toBooking, toAttendant, toAttendance,
  canAccept, statusAfterAccept, isAttendantBusy, defaultPriority, pickAutoAssignee,
} from "@/lib/data";
import type { QueueEntry, Attendant, AttendanceRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

function uid(prefix = ""): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
const nowISO = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);

async function loadQueue(): Promise<QueueEntry[]> {
  return (await readTable(TABS.queue)).map(toQueueEntry);
}
async function loadAttendants(): Promise<Attendant[]> {
  return (await readTable(TABS.attendants)).map(toAttendant);
}
async function loadAttendance(): Promise<AttendanceRecord[]> {
  return (await readTable(TABS.attendance)).map(toAttendance);
}

export async function GET() {
  try {
    const data = await readTable(TABS.queue);
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 }); }

  const action = String(body.action || "");
  try {
    switch (action) {
      case "add_walkin": return await addEntry(body, "walk_in");
      case "self_queue": return await addEntry(body, "walk_in", true);
      case "create_booking_entries": return await createBookingEntries();
      case "check_in": return await checkIn(body);
      case "assign": return await assign(body, false);
      case "reassign": return await assign(body, true);
      case "add_attendant": return await addAttendant(body);
      case "accept": return await accept(body);
      case "decline": return await decline(body);
      case "complete": return await complete(body);
      case "requeue": return await requeue(body);
      case "no_show": return await setStatus(body, "no_show");
      case "cancel": return await setStatus(body, "cancelled");
      case "set_paid": return await setPaid(body);
      case "update": return await update(body);
      case "autoassign_sweep": return await autoAssignSweep();
      default:
        return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}

// ---- core: try to auto-assign a single entry; returns possibly-mutated entry ----
function autoAssignEntry(
  entry: QueueEntry,
  attendants: Attendant[],
  allEntries: QueueEntry[],
  records: AttendanceRecord[]
): QueueEntry {
  if (entry.assignedAttendantIds.length > 0) return entry; // already assigned
  if (entry.status !== "waiting") return entry;
  const pick = pickAutoAssignee(attendants, allEntries, records, today(), {
    preferredAttendantId: entry.preferredAttendantId || undefined,
    excludeIds: entry.declinedAttendantIds,
  });
  if (!pick) return entry; // nobody free/clocked-in → leave waiting
  entry.assignedAttendantIds = [pick.id];
  entry.autoAssigned = true;
  return entry;
}

// ---- handlers ----

async function addEntry(body: Record<string, unknown>, source: "walk_in", isPublic = false) {
  const e = (body.entry || {}) as Partial<QueueEntry>;
  // basic validation for public submissions
  if (isPublic) {
    if (!e.serviceIds || e.serviceIds.length === 0) {
      return NextResponse.json({ ok: false, error: "Please select at least one service." }, { status: 400 });
    }
  }
  const entry: QueueEntry = {
    id: uid("Q-"),
    createdAt: nowISO(),
    source,
    bookingId: "",
    scheduledTime: "",
    checkedInAt: nowISO(),
    customer: (e.customer || "Walk-in").toString().slice(0, 80),
    phone: (e.phone || "").toString().slice(0, 40),
    vehicle: (e.vehicle || "").toString().slice(0, 60),
    serviceIds: e.serviceIds || [],
    assignedAttendantIds: e.assignedAttendantIds || [],
    acceptedAttendantIds: [],
    declinedAttendantIds: [],
    preferredAttendantId: e.preferredAttendantId || "",
    autoAssigned: false,
    status: "waiting",
    priority: defaultPriority(source),
    saleId: "",
    paid: false,
    startedAt: "",
    completedAt: "",
    notes: e.notes || "",
  };

  // Auto-assign if cashier didn't pre-assign.
  if (entry.assignedAttendantIds.length === 0) {
    const [attendants, queue, records] = await Promise.all([loadAttendants(), loadQueue(), loadAttendance()]);
    autoAssignEntry(entry, attendants, queue, records);
  }
  await appendRow(TABS.queue, queueEntryToRow(entry));
  return ok({ id: entry.id, assignedTo: entry.assignedAttendantIds });
}

async function createBookingEntries() {
  const [bookingsRaw, queue] = await Promise.all([readTable(TABS.bookings), loadQueue()]);
  const bookings = bookingsRaw.map(toBooking);
  const linked = new Set(queue.map((q) => q.bookingId).filter(Boolean));
  const day = today();
  let added = 0;
  for (const b of bookings) {
    if (linked.has(b.id)) continue;
    if (b.status === "cancelled" || b.status === "no_show" || b.status === "done") continue;
    if ((b.datetime || "").slice(0, 10) !== day) continue;
    const entry: QueueEntry = {
      id: uid("Q-"), createdAt: nowISO(), source: "scheduled", bookingId: b.id,
      scheduledTime: b.datetime, checkedInAt: "", customer: b.customer, phone: b.phone, vehicle: b.vehicle,
      serviceIds: b.serviceIds, assignedAttendantIds: b.attendantId ? [b.attendantId] : [],
      acceptedAttendantIds: [], declinedAttendantIds: [], preferredAttendantId: b.attendantId || "",
      autoAssigned: false, status: "arriving", priority: defaultPriority("scheduled"),
      saleId: "", paid: false, startedAt: "", completedAt: "", notes: b.notes || "",
    };
    await appendRow(TABS.queue, queueEntryToRow(entry));
    added++;
  }
  return ok({ added });
}

async function checkIn(body: Record<string, unknown>) {
  const id = String(body.id || "");
  const [queue, attendants, records] = await Promise.all([loadQueue(), loadAttendants(), loadAttendance()]);
  const entry = queue.find((q) => q.id === id);
  if (!entry) return notFound();
  entry.status = "waiting";
  entry.checkedInAt = nowISO();
  if (entry.assignedAttendantIds.length === 0) autoAssignEntry(entry, attendants, queue, records);
  await updateRowById(TABS.queue, id, queueEntryToRow(entry));
  return ok();
}

async function assign(body: Record<string, unknown>, isReassign: boolean) {
  const id = String(body.id || "");
  const attendantIds = (body.attendantIds as string[]) || [];
  const queue = await loadQueue();
  const entry = queue.find((q) => q.id === id);
  if (!entry) return notFound();
  entry.assignedAttendantIds = attendantIds;
  entry.acceptedAttendantIds = entry.acceptedAttendantIds.filter((a) => attendantIds.includes(a));
  entry.autoAssigned = false; // manual override
  if (isReassign) { entry.declinedAttendantIds = []; }
  if (entry.status === "in_progress" || entry.status === "assigned") {
    entry.status = statusAfterAccept(entry);
  } else if (entry.status === "waiting" && attendantIds.length > 0) {
    entry.status = "assigned";
  }
  await updateRowById(TABS.queue, id, queueEntryToRow(entry));
  return ok();
}

async function addAttendant(body: Record<string, unknown>) {
  const id = String(body.id || "");
  const attendantId = String(body.attendantId || "");
  const queue = await loadQueue();
  const entry = queue.find((q) => q.id === id);
  if (!entry) return notFound();
  const others = queue.filter((q) => q.id !== id);
  if (isAttendantBusy(others, attendantId)) {
    return NextResponse.json({ ok: false, error: "That attendant is busy on another job." }, { status: 409 });
  }
  if (!entry.assignedAttendantIds.includes(attendantId)) entry.assignedAttendantIds.push(attendantId);
  if (entry.status === "in_progress") entry.status = "assigned";
  await updateRowById(TABS.queue, id, queueEntryToRow(entry));
  return ok();
}

async function accept(body: Record<string, unknown>) {
  const id = String(body.id || "");
  const attendantId = String(body.attendantId || "");
  const queue = await loadQueue();
  const entry = queue.find((q) => q.id === id);
  if (!entry) return notFound();
  if (!canAccept(queue, entry, attendantId)) {
    return NextResponse.json(
      { ok: false, error: "Cannot accept — you may already have an active job, or you're not assigned to this one." },
      { status: 409 }
    );
  }
  entry.acceptedAttendantIds.push(attendantId);
  entry.status = statusAfterAccept(entry);
  if (entry.status === "in_progress" && !entry.startedAt) entry.startedAt = nowISO();
  await updateRowById(TABS.queue, id, queueEntryToRow(entry));
  return ok({ status: entry.status });
}

// Attendant passes on an auto-assigned job → record decline, clear them,
// try to auto-assign someone else; if nobody, leave for cashier (flagged).
async function decline(body: Record<string, unknown>) {
  const id = String(body.id || "");
  const attendantId = String(body.attendantId || "");
  const [queue, attendants, records] = await Promise.all([loadQueue(), loadAttendants(), loadAttendance()]);
  const entry = queue.find((q) => q.id === id);
  if (!entry) return notFound();
  if (!entry.declinedAttendantIds.includes(attendantId)) entry.declinedAttendantIds.push(attendantId);
  entry.assignedAttendantIds = entry.assignedAttendantIds.filter((a) => a !== attendantId);
  entry.acceptedAttendantIds = entry.acceptedAttendantIds.filter((a) => a !== attendantId);
  // try to reassign to next eligible
  if (entry.assignedAttendantIds.length === 0) {
    entry.status = "waiting";
    entry.autoAssigned = false;
    autoAssignEntry(entry, attendants, queue, records);
  }
  await updateRowById(TABS.queue, id, queueEntryToRow(entry));
  return ok({ reassignedTo: entry.assignedAttendantIds });
}

async function complete(body: Record<string, unknown>) {
  const id = String(body.id || "");
  const entry0 = (await loadQueue()).find((q) => q.id === id);
  if (!entry0) return notFound();
  entry0.status = "done";
  entry0.completedAt = nowISO();
  await updateRowById(TABS.queue, id, queueEntryToRow(entry0));
  // Freed attendant(s) → sweep waiting jobs to auto-assign next.
  await autoAssignSweep();
  return ok();
}

async function requeue(body: Record<string, unknown>) {
  const id = String(body.id || "");
  const source = String(body.source || "walk_in");
  const [queue, attendants, records] = await Promise.all([loadQueue(), loadAttendants(), loadAttendance()]);
  const entry = queue.find((q) => q.id === id);
  if (!entry) return notFound();
  entry.acceptedAttendantIds = [];
  entry.declinedAttendantIds = [];
  entry.assignedAttendantIds = [];
  entry.startedAt = "";
  entry.completedAt = "";
  entry.autoAssigned = false;
  if (source === "scheduled") {
    entry.status = "arriving"; entry.checkedInAt = "";
  } else {
    entry.status = "waiting"; entry.checkedInAt = nowISO(); entry.priority = defaultPriority("walk_in");
    autoAssignEntry(entry, attendants, queue, records);
  }
  await updateRowById(TABS.queue, id, queueEntryToRow(entry));
  return ok();
}

async function setStatus(body: Record<string, unknown>, status: QueueEntry["status"]) {
  const id = String(body.id || "");
  const queue = await loadQueue();
  const entry = queue.find((q) => q.id === id);
  if (!entry) return notFound();
  entry.status = status;
  await updateRowById(TABS.queue, id, queueEntryToRow(entry));
  return ok();
}

async function setPaid(body: Record<string, unknown>) {
  const id = String(body.id || "");
  const saleId = String(body.saleId || "");
  const queue = await loadQueue();
  const entry = queue.find((q) => q.id === id);
  if (!entry) return notFound();
  entry.paid = true; entry.saleId = saleId;
  await updateRowById(TABS.queue, id, queueEntryToRow(entry));
  return ok();
}

async function update(body: Record<string, unknown>) {
  const id = String(body.id || "");
  const patch = (body.patch || {}) as Partial<QueueEntry>;
  const queue = await loadQueue();
  const entry = queue.find((q) => q.id === id);
  if (!entry) return notFound();
  const merged: QueueEntry = { ...entry, ...patch, id: entry.id };
  await updateRowById(TABS.queue, id, queueEntryToRow(merged));
  return ok();
}

// Assign any waiting + unassigned jobs to free clocked-in attendants,
// in priority order. Called after completes and can be called periodically.
async function autoAssignSweep() {
  const [attendants, records] = await Promise.all([loadAttendants(), loadAttendance()]);
  let queue = await loadQueue();
  // priority: scheduled first, then check-in/created time
  const waiting = queue
    .filter((e) => e.status === "waiting" && e.assignedAttendantIds.length === 0)
    .sort((a, b) => (a.priority - b.priority) || ((a.checkedInAt || a.createdAt).localeCompare(b.checkedInAt || b.createdAt)));
  let assigned = 0;
  for (const entry of waiting) {
    const pick = pickAutoAssignee(attendants, queue, records, today(), {
      preferredAttendantId: entry.preferredAttendantId || undefined,
      excludeIds: entry.declinedAttendantIds,
    });
    if (!pick) continue;
    entry.assignedAttendantIds = [pick.id];
    entry.autoAssigned = true;
    await updateRowById(TABS.queue, entry.id, queueEntryToRow(entry));
    // reflect in local copy so next pick sees them busy
    queue = queue.map((q) => (q.id === entry.id ? entry : q));
    assigned++;
  }
  return ok({ assigned });
}

// ---- helpers ----
function ok(extra: Record<string, unknown> = {}) { return NextResponse.json({ ok: true, ...extra }); }
function notFound() { return NextResponse.json({ ok: false, error: "Queue entry not found" }, { status: 404 }); }
function msg(e: unknown) { return e instanceof Error ? e.message : "Queue operation failed"; }

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
  try {
    const okDel = await deleteRowById(TABS.queue, id);
    return okDel ? ok() : notFound();
  } catch (e) {
    return NextResponse.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
