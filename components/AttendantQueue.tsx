"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import { branding } from "@/config/branding";
import { api, queueApi } from "@/lib/client";
import {
  toQueueEntry, liveQueue, attendantLoads, attendantTurnOrder,
  suggestNextAttendant, canAccept, queueWaitMinutes,
  attendantCommissionForDay, money,
} from "@/lib/data";
import type { Service, Attendant, QueueEntry, Sale } from "@/lib/types";
import { Spinner, Banner, SectionTitle, Empty, Stat } from "@/components/ui/primitives";

const today = () => new Date().toISOString().slice(0, 10);

export function AttendantQueue({ attendantId }: { attendantId: string }) {
  const [services, setServices] = useState<Service[]>([]);
  const [attendants, setAttendants] = useState<Attendant[]>([]);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busyId, setBusyId] = useState("");
  const [viewDate, setViewDate] = useState(today());

  const load = useCallback(async () => {
    try {
      const [s, a, q, sl] = await Promise.all([api.services(), api.attendants(), queueApi.list(), api.sales()]);
      setServices(s); setAttendants(a.filter((x) => x.active)); setQueue(q.map(toQueueEntry)); setSales(sl);
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed to load queue"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  // near real-time refresh
  useEffect(() => { const t = setInterval(load, 2000); return () => clearInterval(t); }, [load]);

  const live = useMemo(() => liveQueue(queue), [queue]);
  const loads = useMemo(() => attendantTurnOrder(attendantLoads(attendants, queue, today())), [attendants, queue]);
  const suggested = useMemo(() => suggestNextAttendant(loads), [loads]);
  const serviceName = useCallback((id: string) => services.find((s) => s.id === id)?.name ?? id, [services]);
  const attName = useCallback((id: string) => attendants.find((a) => a.id === id)?.name ?? id, [attendants]);

  const myActive = useMemo(
    () => queue.find((e) => (e.status === "assigned" || e.status === "in_progress") && e.assignedAttendantIds.includes(attendantId)),
    [queue, attendantId]
  );
  const iAmBusy = !!myActive && myActive.acceptedAttendantIds.includes(attendantId);
  const isMyTurn = suggested?.id === attendantId;

  // ----- date-filtered completed jobs + commission -----
  const myCompletedOnDate = useMemo(
    () => queue
      .filter((e) => e.assignedAttendantIds.includes(attendantId) && e.status === "done" && (e.completedAt || "").slice(0, 10) === viewDate)
      .sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || "")),
    [queue, attendantId, viewDate]
  );
  const commissionOnDate = useMemo(
    () => attendantCommissionForDay(sales, attendantId, viewDate),
    [sales, attendantId, viewDate]
  );

  async function act(action: string, id: string) {
    setBusyId(id); setErr("");
    try { await queueApi.action(action, { id, attendantId }); await load(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Action failed"); }
    finally { setBusyId(""); }
  }

  if (loading) return <Spinner label="Loading queue…" />;

  return (
    <div className="space-y-5">
      {err && <Banner kind="error">{err}</Banner>}

      {/* My current job */}
      <div className="panel p-4">
        <SectionTitle>My current job</SectionTitle>
        {myActive ? (
          <div className="rounded-lg border border-border bg-bg p-3">
            <div className="flex items-center justify-between">
              <span className="font-display text-sm font-semibold text-text">{myActive.customer}</span>
              <span className="chip" style={{ color: "var(--primary)" }}>{myActive.status.replace("_", " ")}</span>
            </div>
            <div className="mt-1 text-xs text-textMuted">{myActive.vehicle || "—"} · {myActive.serviceIds.map(serviceName).join(", ")}</div>
            <div className="mt-1 text-xs text-textMuted">
              Team: {myActive.assignedAttendantIds.map((id) => `${attName(id)}${myActive.acceptedAttendantIds.includes(id) ? " ✓" : " (pending)"}`).join(", ")}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {!myActive.acceptedAttendantIds.includes(attendantId) ? (
                <>
                  <button className="btn-primary text-sm" disabled={busyId === myActive.id} onClick={() => act("accept", myActive.id)}>Accept</button>
                  <button className="btn-ghost text-sm" disabled={busyId === myActive.id} onClick={() => act("decline", myActive.id)}>Decline</button>
                </>
              ) : (
                <button className="btn-primary text-sm" disabled={busyId === myActive.id} onClick={() => act("complete", myActive.id)}>Mark complete</button>
              )}
            </div>
            {myActive.autoAssigned && !myActive.acceptedAttendantIds.includes(attendantId) && (
              <p className="mt-2 text-xs text-textMuted">This job was auto-assigned to you. Accept to start, or decline to pass it on.</p>
            )}
            {myActive.status === "assigned" && myActive.acceptedAttendantIds.includes(attendantId) && (
              <p className="mt-2 text-xs text-textMuted">Waiting for teammates to accept before work starts.</p>
            )}
          </div>
        ) : (
          <Empty>You have no active job. One will be assigned to you automatically when it&apos;s your turn.</Empty>
        )}
      </div>

      {/* Turn order */}
      <div className="panel p-4">
        <SectionTitle>Attendant turn order</SectionTitle>
        {isMyTurn && !iAmBusy && <Banner kind="info">You&apos;re next in line — the next job will come to you.</Banner>}
        <div className="mt-2 space-y-1.5">
          {loads.map((l, i) => (
            <div key={l.attendant.id}
              className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${l.attendant.id === attendantId ? "border-primary" : "border-border"} bg-bg`}>
              <span className="flex items-center gap-2">
                <span className="text-xs text-textMuted">{i + 1}.</span>
                <span className="text-text">{l.attendant.name}{l.attendant.id === attendantId ? " (you)" : ""}</span>
              </span>
              <span className="text-xs" style={{ color: l.busy ? "var(--warning)" : "var(--success)" }}>{l.busy ? "busy" : "free"} · {l.jobsToday} today</span>
            </div>
          ))}
          {loads.length === 0 && <p className="text-xs text-textMuted">No attendants clocked in / active.</p>}
        </div>
      </div>

      {/* Live queue */}
      <div className="panel p-4">
        <SectionTitle>Live queue</SectionTitle>
        {iAmBusy && <p className="mb-2 text-xs text-textMuted">Finish your current job before taking another.</p>}
        <div className="space-y-2">
          {live.length === 0 && <Empty>Queue is empty.</Empty>}
          {live.map((e, idx) => {
            const mine = e.assignedAttendantIds.includes(attendantId);
            const canTake = canAccept(queue, e, attendantId);
            return (
              <div key={e.id} className="rounded-lg border border-border bg-bg p-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm">
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-surface text-xs text-textMuted">{idx + 1}</span>
                    <span className="text-text">{e.customer}</span>
                    {e.source === "scheduled" && <span className="chip" style={{ color: "var(--primary)" }}>scheduled</span>}
                    {mine && <span className="chip" style={{ color: "var(--primary)" }}>yours</span>}
                  </span>
                  <span className="text-xs text-textMuted">{queueWaitMinutes(e)}m</span>
                </div>
                <div className="mt-1 text-xs text-textMuted">{e.vehicle || "—"} · {e.serviceIds.map(serviceName).join(", ")}</div>
                {canTake && (
                  <button className="btn-primary mt-2 text-xs" disabled={busyId === e.id} onClick={() => act("accept", e.id)}>Accept this job</button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Date-filtered history: completed jobs + commission */}
      <div className="panel p-4">
        <SectionTitle action={
          <div className="flex items-center gap-2">
            <input type="date" className="input w-auto py-1 text-xs" value={viewDate} onChange={(e) => setViewDate(e.target.value)} />
            <button className="btn-ghost text-xs" onClick={() => setViewDate(today())}>Today</button>
          </div>
        }>
          My jobs &amp; commission
        </SectionTitle>
        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          <Stat label={`Jobs completed (${viewDate === today() ? "today" : viewDate})`} value={String(myCompletedOnDate.length)} />
          <Stat label="Commission earned" value={money(commissionOnDate)} accent />
        </div>
        {myCompletedOnDate.length === 0 ? (
          <Empty>No completed jobs on this date.</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-textMuted">
              <th className="py-2 pr-3">Done</th><th className="py-2 pr-3">Customer</th><th className="py-2 pr-3">Services</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {myCompletedOnDate.map((e) => (
                <tr key={e.id}>
                  <td className="py-2 pr-3 text-textMuted">{e.completedAt ? new Date(e.completedAt).toLocaleTimeString(branding.locale, { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                  <td className="py-2 pr-3 text-text">{e.customer}</td>
                  <td className="py-2 pr-3 text-textMuted">{e.serviceIds.map(serviceName).join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
