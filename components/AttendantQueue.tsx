"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import { api, queueApi } from "@/lib/client";
import {
  toQueueEntry, liveQueue, attendantLoads, attendantTurnOrder,
  suggestNextAttendant, canAccept, queueWaitMinutes,
} from "@/lib/data";
import type { Service, Attendant, QueueEntry } from "@/lib/types";
import { Spinner, Banner, SectionTitle, Empty } from "@/components/ui/primitives";

const today = () => new Date().toISOString().slice(0, 10);

export function AttendantQueue({ attendantId }: { attendantId: string }) {
  const [services, setServices] = useState<Service[]>([]);
  const [attendants, setAttendants] = useState<Attendant[]>([]);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    try {
      const [s, a, q] = await Promise.all([api.services(), api.attendants(), queueApi.list()]);
      setServices(s); setAttendants(a.filter((x) => x.active)); setQueue(q.map(toQueueEntry));
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed to load queue"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setInterval(load, 8000); return () => clearInterval(t); }, [load]);

  const live = useMemo(() => liveQueue(queue), [queue]);
  const loads = useMemo(() => attendantTurnOrder(attendantLoads(attendants, queue, today())), [attendants, queue]);
  const suggested = useMemo(() => suggestNextAttendant(loads), [loads]);
  const serviceName = useCallback((id: string) => services.find((s) => s.id === id)?.name ?? id, [services]);
  const attName = useCallback((id: string) => attendants.find((a) => a.id === id)?.name ?? id, [attendants]);

  // my current active job (assigned + accepted, in progress/assigned)
  const myActive = useMemo(
    () => queue.find((e) => (e.status === "assigned" || e.status === "in_progress") && e.assignedAttendantIds.includes(attendantId)),
    [queue, attendantId]
  );
  const iAmBusy = !!myActive && myActive.acceptedAttendantIds.includes(attendantId);

  // jobs I can accept right now
  const acceptable = useMemo(
    () => live.filter((e) => canAccept(queue, e, attendantId)),
    [live, queue, attendantId]
  );
  const isMyTurn = suggested?.id === attendantId;

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
            <div className="mt-3 flex gap-2">
              {!myActive.acceptedAttendantIds.includes(attendantId) ? (
                <button className="btn-primary text-sm" disabled={busyId === myActive.id} onClick={() => act("accept", myActive.id)}>Accept</button>
              ) : (
                <button className="btn-primary text-sm" disabled={busyId === myActive.id} onClick={() => act("complete", myActive.id)}>Mark complete</button>
              )}
            </div>
            {myActive.status === "assigned" && myActive.acceptedAttendantIds.includes(attendantId) && (
              <p className="mt-2 text-xs text-textMuted">Waiting for teammates to accept before work starts.</p>
            )}
          </div>
        ) : (
          <Empty>You have no active job. Accept one below when it&apos;s your turn.</Empty>
        )}
      </div>

      {/* Turn order */}
      <div className="panel p-4">
        <SectionTitle>Attendant turn order</SectionTitle>
        {isMyTurn && !iAmBusy && <Banner kind="info">You&apos;re next in line — accept the top waiting job.</Banner>}
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
        </div>
      </div>

      {/* Live queue */}
      <div className="panel p-4">
        <SectionTitle>Live queue</SectionTitle>
        {iAmBusy && <p className="mb-2 text-xs text-textMuted">Finish your current job before accepting a new one.</p>}
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
                    {mine && <span className="chip" style={{ color: "var(--primary)" }}>assigned to you</span>}
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
        {acceptable.length === 0 && live.length > 0 && !iAmBusy && (
          <p className="mt-2 text-xs text-textMuted">No jobs assigned to you to accept yet — the cashier assigns jobs, or wait for your turn.</p>
        )}
      </div>
    </div>
  );
}
