// ============================================================
//  /api/queue — stateful queue operations (rules enforced here)
//
//  Actions (POST { action, ... }):
//   add_walkin     { entry }            cashier adds a walk-in
//   create_booking_entries              sync scheduled bookings -> arriving
//   check_in       { id }               arriving -> waiting (live queue)
//   assign         { id, attendantIds } set/replace assigned attendants
//   add_attendant  { id, attendantId }  add one attendant to a job
//   accept         { id, attendantId }  attendant accepts (gated)
//   complete       { id }               mark done, free attendants
//   requeue        { id, source }       no-show/again -> back to waiting/arriving
//   no_show        { id }               mark no_show
//   cancel         { id }               cancel
//   update         { id, patch }        cashier edits fields
//   set_paid       { id, saleId }       link sale + mark paid
//
//  GET -> all queue rows (mapped client-side).
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import { readTable, appendRow, updateRowById, deleteRowById, TABS } from "@/lib/sheets";
import {
  toQueueEntry, queueEntryToRow, toBooking, canAccept, statusAfterAccept,
  isAttendantBusy, defaultPriority,
} from "@/lib/data";
import type { QueueEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

function uid(prefix = ""): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
const nowISO = () => new Date().toISOString();

async function loadQueue(): Promise<QueueEntry[]> {
  return (await readTable(TABS.queue)).map(toQueueEntry);
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
      case "add_walkin": return await addWalkin(body);
      case "create_booking_entries": return await createBookingEntries();
      case "check_in": return await checkIn(body);
      case "assign": return await assign(body);
      case "add_attendant": return await addAttendant(body);
      case "accept": return await accept(body);
      case "complete": return await complete(body);
      case "requeue": return await requeue(body);
      case "no_show": return await setStatus(body, "no_show");
      case "cancel": return await setStatus(body, "cancelled");
      case "set_paid": return await setPaid(body);
      case "update": return await update(body);
      default:
        return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}

// ---- handlers ----

async function addWalkin(body: Record<string, unknown>) {
  const e = (body.entry || {}) as Partial<QueueEntry>;
  const entry: QueueEntry = {
    id: uid("Q-"),
    createdAt: nowISO(),
    source: "walk_in",
    bookingId: "",
    scheduledTime: "",
    checkedInAt: nowISO(), // walk-ins are present immediately
    customer: e.customer || "Walk-in",
    phone: e.phone || "",
    vehicle: e.vehicle || "",
    serviceIds: e.serviceIds || [],
    assignedAttendantIds: e.assignedAttendantIds || [],
    acceptedAttendantIds: [],
    status: "waiting",
    priority: defaultPriority("walk_in"),
    saleId: "",
    paid: false,
    startedAt: "",
    completedAt: "",
    notes: e.notes || "",
  };
  await appendRow(TABS.queue, queueEntryToRow(entry));
  return ok({ id: entry.id });
}

// Pull scheduled bookings that aren't yet represented in the queue and add
// them as "arriving" entries. Idempotent: skips bookings already linked.
async function createBookingEntries() {
  const [bookingsRaw, queue] = await Promise.all([
    readTable(TABS.bookings),
    loadQueue(),
  ]);
  const bookings = bookingsRaw.map(toBooking);
  const linked = new Set(queue.map((q) => q.bookingId).filter(Boolean));
  const today = new Date().toISOString().slice(0, 10);

  let added = 0;
  for (const b of bookings) {
    if (linked.has(b.id)) continue;
    if (b.status === "cancelled" || b.status === "no_show" || b.status === "done") continue;
    if ((b.datetime || "").slice(0, 10) !== today) continue; // only today's
    const entry: QueueEntry = {
      id: uid("Q-"),
      createdAt: nowISO(),
      source: "scheduled",
      bookingId: b.id,
      scheduledTime: b.datetime,
      checkedInAt: "",
      customer: b.customer,
      phone: b.phone,
      vehicle: b.vehicle,
      serviceIds: b.serviceIds,
      assignedAttendantIds: b.attendantId ? [b.attendantId] : [],
      acceptedAttendantIds: [],
      status: "arriving",
      priority: defaultPriority("scheduled"),
      saleId: "",
      paid: false,
      startedAt: "",
      completedAt: "",
      notes: b.notes || "",
    };
    await appendRow(TABS.queue, queueEntryToRow(entry));
    added++;
  }
  return ok({ added });
}

async function checkIn(body: Record<string, unknown>) {
  const id = String(body.id || "");
  const queue = await loadQueue();
  const entry = queue.find((q) => q.id === id);
  if (!entry) return notFound();
  entry.status = "waiting";
  entry.checkedInAt = nowISO();
  await updateRowById(TABS.queue, id, queueEntryToRow(entry));
  return ok();
}

async function assign(body: Record<string, unknown>) {
  const id = String(body.id || "");
  const attendantIds = (body.attendantIds as string[]) || [];
  const queue = await loadQueue();
  const entry = queue.find((q) => q.id === id);
  if (!entry) return notFound();
  entry.assignedAttendantIds = attendantIds;
  // keep only accepts that are still assigned
  entry.acceptedAttendantIds = entry.acceptedAttendantIds.filter((a) => attendantIds.includes(a));
  if (entry.status === "in_progress" || entry.status === "assigned") {
    entry.status = statusAfterAccept(entry);
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
  // added attendant must be free elsewhere
  const others = queue.filter((q) => q.id !== id);
  if (isAttendantBusy(others, attendantId)) {
    return NextResponse.json({ ok: false, error: "That attendant is busy on another job." }, { status: 409 });
  }
  if (!entry.assignedAttendantIds.includes(attendantId)) {
    entry.assignedAttendantIds.push(attendantId);
  }
  // adding a new attendant means the job needs their acceptance again
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

async function complete(body: Record<string, unknown>) {
  const id = String(body.id || "");
  const queue = await loadQueue();
  const entry = queue.find((q) => q.id === id);
  if (!entry) return notFound();
  entry.status = "done";
  entry.completedAt = nowISO();
  await updateRowById(TABS.queue, id, queueEntryToRow(entry));
  return ok();
}

async function requeue(body: Record<string, unknown>) {
  const id = String(body.id || "");
  const source = String(body.source || "walk_in");
  const queue = await loadQueue();
  const entry = queue.find((q) => q.id === id);
  if (!entry) return notFound();
  entry.acceptedAttendantIds = [];
  entry.startedAt = "";
  entry.completedAt = "";
  if (source === "scheduled") {
    entry.status = "arriving";
    entry.checkedInAt = "";
  } else {
    entry.status = "waiting";
    entry.checkedInAt = nowISO();
    entry.priority = defaultPriority("walk_in");
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
  entry.paid = true;
  entry.saleId = saleId;
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

// ---- helpers ----
function ok(extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: true, ...extra });
}
function notFound() {
  return NextResponse.json({ ok: false, error: "Queue entry not found" }, { status: 404 });
}
function msg(e: unknown) {
  return e instanceof Error ? e.message : "Queue operation failed";
}

// allow cashier to hard-delete via DELETE ?id=
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
