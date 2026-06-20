"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import { branding } from "@/config/branding";
import { api, queueApi, uid } from "@/lib/client";
import {
  toQueueEntry, liveQueue, arrivingSoon, attendantLoads, attendantTurnOrder,
  buildSaleLines, summarizeSale, money, queueWaitMinutes,
} from "@/lib/data";
import type { Service, Attendant, QueueEntry } from "@/lib/types";
import { Spinner, Banner, SectionTitle, Modal, Empty, Stat } from "@/components/ui/primitives";
import { PhotoCapture, SignaturePad } from "@/components/Capture";

const today = () => new Date().toISOString().slice(0, 10);

export function QueueManager({ cashierId }: { cashierId: string }) {
  const [services, setServices] = useState<Service[]>([]);
  const [attendants, setAttendants] = useState<Attendant[]>([]);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busyId, setBusyId] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [assignFor, setAssignFor] = useState<QueueEntry | null>(null);
  const [payFor, setPayFor] = useState<QueueEntry | null>(null);

  const load = useCallback(async (sync = false) => {
    try {
      if (sync) { try { await queueApi.action("create_booking_entries"); } catch { /* non-fatal */ } }
      const [s, a, q] = await Promise.all([api.services(), api.attendants(), queueApi.list()]);
      setServices(s.filter((x) => x.active));
      setAttendants(a.filter((x) => x.active));
      setQueue(q.map(toQueueEntry));
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  }, []);

  // initial load syncs bookings → queue; then gentle auto-refresh
  useEffect(() => { load(true); }, [load]);
  useEffect(() => {
    const t = setInterval(() => load(false), 2000);
    return () => clearInterval(t);
  }, [load]);

  const live = useMemo(() => liveQueue(queue), [queue]);
  const needsAttention = useMemo(
    () => live.filter((e) => e.status === "waiting" && e.assignedAttendantIds.length === 0 && e.declinedAttendantIds.length > 0),
    [live]
  );
  const arriving = useMemo(() => arrivingSoon(queue), [queue]);
  const loads = useMemo(() => attendantTurnOrder(attendantLoads(attendants, queue, today())), [attendants, queue]);
  const serviceName = useCallback((id: string) => services.find((s) => s.id === id)?.name ?? id, [services]);
  const attName = useCallback((id: string) => attendants.find((a) => a.id === id)?.name ?? id, [attendants]);

  async function act(action: string, payload: Record<string, unknown>, id = "") {
    setBusyId(id); setErr("");
    try { await queueApi.action(action, payload); await load(false); }
    catch (e) { setErr(e instanceof Error ? e.message : "Action failed"); }
    finally { setBusyId(""); }
  }
  async function del(id: string) {
    if (!confirm("Remove this customer from the queue?")) return;
    setBusyId(id); setErr("");
    try { await queueApi.remove(id); await load(false); }
    catch (e) { setErr(e instanceof Error ? e.message : "Delete failed"); }
    finally { setBusyId(""); }
  }

  if (loading) return <Spinner label="Loading queue…" />;

  const waitingCount = live.filter((e) => e.status === "waiting").length;
  const inProgressCount = live.filter((e) => e.status === "in_progress").length;
  const freeCount = loads.filter((l) => !l.busy).length;

  return (
    <div className="space-y-5">
      {err && <Banner kind="error">{err}</Banner>}

      {needsAttention.length > 0 && (
        <Banner kind="error">
          {needsAttention.length} job(s) need a manual assignment (no attendant available or it was declined). Use the <b>Assign</b> button on those entries.
        </Banner>
      )}

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Waiting" value={String(waitingCount)} accent={waitingCount > 0} />
        <Stat label="In progress" value={String(inProgressCount)} />
        <Stat label="Arriving (scheduled)" value={String(arriving.length)} />
        <Stat label="Free attendants" value={String(freeCount)} />
      </div>

      <SectionTitle action={<button className="btn-primary" onClick={() => setAddOpen(true)}>+ Add walk-in</button>}>
        Live queue
      </SectionTitle>

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="space-y-3">
          {live.length === 0 && <Empty>No one in the queue right now.</Empty>}
          {live.map((e, idx) => (
            <div key={e.id} className="panel p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-bg text-xs text-textMuted">{idx + 1}</span>
                    <span className="font-display text-sm font-semibold text-text">{e.customer}</span>
                    {e.source === "scheduled" && <span className="chip" style={{ color: "var(--primary)" }}>scheduled</span>}
                    <StatusChip status={e.status} />
                    {e.paid && <span className="chip" style={{ color: "var(--success)" }}>paid</span>}
                  </div>
                  <div className="mt-1 text-xs text-textMuted">
                    {e.vehicle || "—"}{e.phone ? ` · ${e.phone}` : ""} · waiting {queueWaitMinutes(e)}m
                  </div>
                  <div className="mt-1 text-xs text-textMuted">
                    {e.serviceIds.map(serviceName).join(", ") || "No services"}
                  </div>
                  <div className="mt-1 text-xs">
                    {e.assignedAttendantIds.length === 0
                      ? <span className="text-textMuted opacity-70">Unassigned</span>
                      : e.assignedAttendantIds.map((id) => (
                        <span key={id} className="mr-1 inline-flex items-center gap-1">
                          <span className={e.acceptedAttendantIds.includes(id) ? "text-text" : "text-textMuted"}>
                            {attName(id)}{e.acceptedAttendantIds.includes(id) ? " ✓" : " (pending)"}
                          </span>
                        </span>
                      ))}
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-1.5">
                  <button className="btn-ghost text-xs" disabled={busyId === e.id} onClick={() => setAssignFor(e)}>Assign</button>
                  {!e.paid && <button className="btn-ghost text-xs" disabled={busyId === e.id} onClick={() => setPayFor(e)}>Take payment</button>}
                  {e.status !== "done" && <button className="btn-ghost text-xs" disabled={busyId === e.id} onClick={() => act("complete", { id: e.id }, e.id)}>Complete</button>}
                  <button className="btn-ghost text-xs" disabled={busyId === e.id} onClick={() => act("requeue", { id: e.id, source: "walk_in" }, e.id)}>Requeue</button>
                  <button className="btn-danger text-xs" disabled={busyId === e.id} onClick={() => del(e.id)}>Remove</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* attendant turn order panel */}
        <aside className="panel h-fit p-4">
          <SectionTitle>Attendant turn order</SectionTitle>
          <p className="mb-2 text-xs text-textMuted">Next free attendant is suggested the top waiting job.</p>
          <div className="space-y-1.5">
            {loads.map((l, i) => (
              <div key={l.attendant.id} className="flex items-center justify-between rounded-lg border border-border bg-bg px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <span className="text-xs text-textMuted">{i + 1}.</span>
                  <span className="text-text">{l.attendant.name}</span>
                </span>
                <span className="text-xs" style={{ color: l.busy ? "var(--warning)" : "var(--success)" }}>
                  {l.busy ? "busy" : "free"} · {l.jobsToday} today
                </span>
              </div>
            ))}
            {loads.length === 0 && <p className="text-xs text-textMuted">No active attendants.</p>}
          </div>
        </aside>
      </div>

      {/* Arriving soon (scheduled, not yet checked in) */}
      <SectionTitle>Arriving soon (scheduled)</SectionTitle>
      <div className="space-y-2">
        {arriving.length === 0 && <Empty>No scheduled arrivals pending check-in.</Empty>}
        {arriving.map((e) => (
          <div key={e.id} className="panel flex flex-wrap items-center justify-between gap-2 p-3">
            <div>
              <span className="text-sm font-medium text-text">{e.customer}</span>
              <span className="ml-2 text-xs text-textMuted">
                {e.scheduledTime ? new Date(e.scheduledTime).toLocaleTimeString(branding.locale, { hour: "numeric", minute: "2-digit" }) : ""}
                {e.vehicle ? ` · ${e.vehicle}` : ""} · {e.serviceIds.map(serviceName).join(", ")}
              </span>
            </div>
            <div className="flex gap-1.5">
              <button className="btn-primary text-xs" disabled={busyId === e.id} onClick={() => act("check_in", { id: e.id }, e.id)}>Check in</button>
              <button className="btn-ghost text-xs" disabled={busyId === e.id} onClick={() => act("no_show", { id: e.id }, e.id)}>No-show</button>
              <button className="btn-danger text-xs" disabled={busyId === e.id} onClick={() => del(e.id)}>Remove</button>
            </div>
          </div>
        ))}
      </div>

      {addOpen && (
        <AddWalkinModal services={services} attendants={attendants} onClose={() => setAddOpen(false)}
          onSaved={() => { setAddOpen(false); load(false); }} />
      )}
      {assignFor && (
        <AssignModal entry={assignFor} attendants={attendants} queue={queue} attName={attName}
          onClose={() => setAssignFor(null)} onSaved={() => { setAssignFor(null); load(false); }} />
      )}
      {payFor && (
        <PaymentModal entry={payFor} services={services} attendants={attendants} cashierId={cashierId}
          serviceName={serviceName} onClose={() => setPayFor(null)} onSaved={() => { setPayFor(null); load(false); }} />
      )}
    </div>
  );
}

function StatusChip({ status }: { status: QueueEntry["status"] }) {
  const map: Record<string, string> = {
    waiting: "var(--text-muted)", assigned: "var(--warning)", in_progress: "var(--primary)",
    done: "var(--success)", arriving: "var(--text-muted)", no_show: "var(--danger)", cancelled: "var(--danger)",
  };
  return <span className="chip" style={{ color: map[status] || "var(--text-muted)" }}>{status.replace("_", " ")}</span>;
}

function AddWalkinModal({ services, attendants, onClose, onSaved }: {
  services: Service[]; attendants: Attendant[]; onClose: () => void; onSaved: () => void;
}) {
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [attendantIds, setAttendantIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    setErr("");
    if (serviceIds.length === 0) return setErr("Pick at least one service.");
    setSaving(true);
    try {
      await queueApi.action("add_walkin", {
        entry: { customer: customer || "Walk-in", phone, vehicle, serviceIds, assignedAttendantIds: attendantIds },
      });
      onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  return (
    <Modal open onClose={onClose} title="Add walk-in to queue">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div><span className="label">Customer</span><input className="input" value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Walk-in" /></div>
          <div><span className="label">Phone</span><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        </div>
        <div><span className="label">Vehicle / plate</span><input className="input" value={vehicle} onChange={(e) => setVehicle(e.target.value)} /></div>
        <div>
          <span className="label">Services</span>
          <div className="flex flex-wrap gap-1.5">
            {services.map((s) => (
              <button key={s.id} onClick={() => setServiceIds((v) => v.includes(s.id) ? v.filter((x) => x !== s.id) : [...v, s.id])}
                className={`chip ${serviceIds.includes(s.id) ? "glow-active text-text" : ""}`}>{s.name}</button>
            ))}
          </div>
        </div>
        <div>
          <span className="label">Pre-assign attendants (optional)</span>
          <div className="flex flex-wrap gap-1.5">
            {attendants.map((a) => (
              <button key={a.id} onClick={() => setAttendantIds((v) => v.includes(a.id) ? v.filter((x) => x !== a.id) : [...v, a.id])}
                className={`chip ${attendantIds.includes(a.id) ? "glow-active text-text" : ""}`}>{a.name}</button>
            ))}
          </div>
          <p className="mt-1 text-xs text-textMuted">Leave empty to let attendants pick it up by turn order.</p>
        </div>
        {err && <Banner kind="error">{err}</Banner>}
        <button className="btn-primary w-full" disabled={saving} onClick={save}>{saving ? "Adding…" : "Add to queue"}</button>
      </div>
    </Modal>
  );
}

function AssignModal({ entry, attendants, queue, attName, onClose, onSaved }: {
  entry: QueueEntry; attendants: Attendant[]; queue: QueueEntry[];
  attName: (id: string) => string; onClose: () => void; onSaved: () => void;
}) {
  const [selected, setSelected] = useState<string[]>(entry.assignedAttendantIds);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  // who's busy elsewhere
  const busyElsewhere = useMemo(() => {
    const set = new Set<string>();
    queue.filter((q) => q.id !== entry.id).forEach((q) => {
      if (q.status === "assigned" || q.status === "in_progress") q.assignedAttendantIds.forEach((id) => set.add(id));
    });
    return set;
  }, [queue, entry.id]);

  async function save() {
    setSaving(true); setErr("");
    try { await queueApi.action("assign", { id: entry.id, attendantIds: selected }); onSaved(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  return (
    <Modal open onClose={onClose} title={`Assign attendants — ${entry.customer}`}>
      <div className="space-y-3">
        <p className="text-xs text-textMuted">Select who should work this job. Busy attendants are marked — assigning them is allowed but they can&apos;t accept until free.</p>
        <div className="flex flex-wrap gap-1.5">
          {attendants.map((a) => (
            <button key={a.id} onClick={() => setSelected((v) => v.includes(a.id) ? v.filter((x) => x !== a.id) : [...v, a.id])}
              className={`chip ${selected.includes(a.id) ? "glow-active text-text" : ""}`}>
              {a.name}{busyElsewhere.has(a.id) ? " · busy" : ""}
            </button>
          ))}
        </div>
        {entry.acceptedAttendantIds.length > 0 && (
          <p className="text-xs text-textMuted">Accepted: {entry.acceptedAttendantIds.map(attName).join(", ")}</p>
        )}
        {err && <Banner kind="error">{err}</Banner>}
        <button className="btn-primary w-full" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save assignment"}</button>
      </div>
    </Modal>
  );
}

function PaymentModal({ entry, services, attendants, cashierId, serviceName, onClose, onSaved }: {
  entry: QueueEntry; services: Service[]; attendants: Attendant[]; cashierId: string;
  serviceName: (id: string) => string; onClose: () => void; onSaved: () => void;
}) {
  const [tip, setTip] = useState(0);
  const [tipAttendant, setTipAttendant] = useState("");
  const [payment, setPayment] = useState<string>(branding.paymentMethods[0]);
  const [carPhotoUrl, setCarPhotoUrl] = useState("");
  const [signatureUrl, setSignatureUrl] = useState("");
  const [complete, setComplete] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // build cart from the queue entry's services + assigned attendants
  const cart = useMemo(() => entry.serviceIds.map((sid) => {
    const svc = services.find((s) => s.id === sid);
    return svc ? { service: svc, attendantIds: entry.assignedAttendantIds } : null;
  }).filter(Boolean) as { service: Service; attendantIds: string[] }[], [entry, services]);

  const summary = useMemo(() => {
    const lines = buildSaleLines(cart);
    return { lines, ...summarizeSale(lines, tip) };
  }, [cart, tip]);

  async function pay() {
    setErr("");
    if (cart.length === 0) return setErr("This queue entry has no valid services.");
    setSaving(true);
    try {
      const sale = {
        id: uid("S-"), datetime: new Date().toISOString(), lines: summary.lines,
        subtotal: summary.subtotal, tax: summary.tax, tip, tipAttendantId: tipAttendant,
        total: summary.total, paymentMethod: payment, commissionTotal: summary.commissionTotal,
        customer: entry.customer, customerPhone: entry.phone, customerEmail: "", vehicle: entry.vehicle,
        carPhotoUrl, signatureUrl, cashierId, status: "paid" as const,
      };
      await api.checkout(sale); // records sale + deducts inventory
      await queueApi.action("set_paid", { id: entry.id, saleId: sale.id });
      if (complete) await queueApi.action("complete", { id: entry.id });
      onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : "Payment failed"); }
    finally { setSaving(false); }
  }

  return (
    <Modal open onClose={onClose} title={`Take payment — ${entry.customer}`}>
      <div className="space-y-3">
        <div className="rounded-lg border border-border bg-bg p-3 text-sm">
          {cart.map((c, i) => (
            <div key={i} className="flex justify-between"><span className="text-text">{c.service.name}</span><span style={{ color: "var(--primary)" }}>{money(c.service.price)}</span></div>
          ))}
          {cart.length === 0 && <span className="text-textMuted">No services on this entry.</span>}
        </div>
        <div>
          <span className="label">Tip</span>
          <div className="flex gap-2">
            <input type="number" min={0} className="input" value={tip || ""} placeholder="0.00" onChange={(e) => setTip(Math.max(0, parseFloat(e.target.value) || 0))} />
            <select className="input" value={tipAttendant} onChange={(e) => setTipAttendant(e.target.value)}>
              <option value="">Split / pool</option>
              {attendants.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <span className="label">Payment method</span>
          <div className="flex flex-wrap gap-1.5">
            {branding.paymentMethods.map((p) => (
              <button key={p} onClick={() => setPayment(p)} className={`chip ${payment === p ? "glow-active text-text" : ""}`}>{p}</button>
            ))}
          </div>
        </div>
        <PhotoCapture label="Car photo (optional)" value={carPhotoUrl} onChange={setCarPhotoUrl} />
        <SignaturePad value={signatureUrl} onChange={setSignatureUrl} />
        <label className="flex items-center gap-2 text-sm text-text">
          <input type="checkbox" checked={complete} onChange={(e) => setComplete(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
          Mark job complete after payment
        </label>
        <div className="flex items-center justify-between border-t border-border pt-2 text-base font-semibold">
          <span>Total</span><span style={{ color: "var(--primary)" }}>{money(summary.total)}</span>
        </div>
        {err && <Banner kind="error">{err}</Banner>}
        <button className="btn-primary w-full" disabled={saving} onClick={pay}>{saving ? "Processing…" : `Charge ${money(summary.total)}`}</button>
      </div>
    </Modal>
  );
}
