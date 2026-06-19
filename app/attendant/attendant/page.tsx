"use client";
import { useEffect, useMemo, useState } from "react";
import { branding } from "@/config/branding";
import { api, uid } from "@/lib/client";
import { TABS } from "@/lib/tabs";
import { computePay, splitHours, money } from "@/lib/data";
import type { Attendant, AttendanceRecord, Sale, Booking, PayrollSettings } from "@/lib/types";
import { Spinner, Banner, Stat, SectionTitle, Empty } from "@/components/ui/primitives";
import { TopBar } from "@/components/TopBar";
import { Guard } from "@/components/Guard";

export default function AttendantPage() {
  return (
    <Guard allow={["attendant", "admin"]}>
      {(s) => <AttendantInner attendantId={s.attendantId} role={s.role} name={s.displayName} />}
    </Guard>
  );
}

function AttendantInner({ attendantId, role, name }: { attendantId: string; role: string; name: string }) {
  const [attendant, setAttendant] = useState<Attendant | null>(null);
  const [allAttendants, setAllAttendants] = useState<Attendant[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [settings, setSettings] = useState<PayrollSettings>({ defaultExpectedHours: 8, defaultOtRatePerHour: 0, maxOtHoursPerDay: 4 });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [selectedId, setSelectedId] = useState(attendantId);

  async function load() {
    setLoading(true);
    try {
      const [a, r, s, b, set] = await Promise.all([
        api.attendants(), api.attendance(), api.sales(), api.bookings(), api.settings(),
      ]);
      setAllAttendants(a); setRecords(r); setSales(s); setBookings(b); setSettings(set);
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  // Admins viewing this page can pick an attendant; attendants are locked to themselves.
  const effectiveId = role === "admin" ? (selectedId || allAttendants[0]?.id || "") : attendantId;
  useEffect(() => { setAttendant(allAttendants.find((a) => a.id === effectiveId) ?? null); }, [allAttendants, effectiveId]);

  if (loading) return (<><TopBar role={role} name={name} /><main className="mx-auto max-w-5xl px-4 py-6"><Spinner label="Loading dashboard…" /></main></>);

  return (
    <>
      <TopBar role={role} name={name} />
      <main className="mx-auto max-w-5xl px-4 py-6">
        {err && <Banner kind="error">{err}</Banner>}
        {role === "admin" && (
          <div className="mb-4">
            <span className="label">Viewing attendant (admin)</span>
            <select className="input w-auto" value={effectiveId} onChange={(e) => setSelectedId(e.target.value)}>
              {allAttendants.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        )}
        {!attendant ? (
          <Banner kind="info">No attendant profile is linked to this login. Ask an admin to link your user to an attendant in the Users tab.</Banner>
        ) : (
          <Dashboard attendant={attendant} records={records} sales={sales} bookings={bookings} settings={settings} onChange={load} canClock={role !== "admin" || effectiveId === attendantId} />
        )}
      </main>
    </>
  );
}

function Dashboard({ attendant, records, sales, bookings, settings, onChange, canClock }: {
  attendant: Attendant; records: AttendanceRecord[]; sales: Sale[]; bookings: Booking[];
  settings: PayrollSettings; onChange: () => void; canClock: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const myRecords = useMemo(() => records.filter((r) => r.attendantId === attendant.id), [records, attendant.id]);
  const openToday = myRecords.find((r) => r.date === today && r.clockIn && !r.clockOut);

  // This-month window for the payroll snapshot.
  const monthStart = today.slice(0, 8) + "01";
  const monthRecords = myRecords.filter((r) => r.date >= monthStart && r.date <= today);
  const monthSales = sales.filter((s) => s.datetime.slice(0, 10) >= monthStart && s.datetime.slice(0, 10) <= today);
  const pay = useMemo(() => computePay(attendant, monthRecords, monthSales, settings), [attendant, monthRecords, monthSales, settings]);

  // Services rendered this month (lines where this attendant is assigned).
  const myServices = useMemo(() => {
    const out: { date: string; name: string; share: number }[] = [];
    for (const s of monthSales) {
      if (s.status !== "paid") continue;
      for (const l of s.lines) {
        if (l.attendantIds.includes(attendant.id)) {
          out.push({ date: s.datetime.slice(0, 10), name: l.serviceName, share: l.commissionTotal / l.attendantIds.length });
        }
      }
    }
    return out.reverse();
  }, [monthSales, attendant.id]);

  const myJobs = useMemo(
    () => bookings.filter((b) => b.attendantId === attendant.id && ["booked", "in_progress"].includes(b.status))
      .sort((a, b) => a.datetime.localeCompare(b.datetime)),
    [bookings, attendant.id]
  );

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function clockIn() {
    setBusy(true); setErr("");
    try {
      await api.append(TABS.attendance, {
        id: uid("A-"), attendantId: attendant.id, date: today,
        clockIn: new Date().toISOString(), clockOut: "", hours: 0, otHours: 0, note: "",
      });
      onChange();
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  async function clockOut() {
    if (!openToday) return;
    setBusy(true); setErr("");
    try {
      const out = new Date();
      const hours = Math.round(((out.getTime() - new Date(openToday.clockIn).getTime()) / 3.6e6) * 100) / 100;
      const { regular, ot } = splitHours(hours, settings);
      await api.update(TABS.attendance, openToday.id, {
        id: openToday.id, attendantId: attendant.id, date: openToday.date,
        clockIn: openToday.clockIn, clockOut: out.toISOString(), hours: regular + ot, otHours: ot, note: openToday.note || "",
      });
      onChange();
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-5">
      <div className="panel flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h2 className="font-display text-lg font-semibold text-text">{attendant.name}</h2>
          <p className="text-sm text-textMuted">{attendant.role} · {money(attendant.baseRate)}/{attendant.payType === "daily" ? "day" : "hr"}</p>
        </div>
        {canClock && (
          openToday
            ? <button className="btn-primary" disabled={busy} onClick={clockOut}>{busy ? "…" : "Clock out"}</button>
            : <button className="btn-primary" disabled={busy} onClick={clockIn}>{busy ? "…" : "Clock in"}</button>
        )}
      </div>
      {err && <Banner kind="error">{err}</Banner>}
      {openToday && <Banner kind="info">Clocked in at {new Date(openToday.clockIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. Don&apos;t forget to clock out.</Banner>}

      <div>
        <h3 className="mb-2 font-display text-sm font-semibold uppercase tracking-wide text-textMuted">This month</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Days present" value={String(pay.daysPresent)} />
          <Stat label="Hours (reg + OT)" value={`${pay.regularHours.toFixed(1)} + ${pay.otHours.toFixed(1)}`} />
          <Stat label="Commission + tips" value={money(pay.commission + pay.tips)} />
          <Stat label="Estimated gross" value={money(pay.gross)} accent />
        </div>
        <p className="mt-2 text-xs text-textMuted">
          Base {money(pay.basePay)} · OT {money(pay.otPay)} · Commission {money(pay.commission)} · Tips {money(pay.tips)}. Estimate only — final pay is confirmed by your manager.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="panel p-5">
          <SectionTitle>Assigned jobs</SectionTitle>
          {myJobs.length === 0 ? <Empty>No upcoming jobs assigned.</Empty> : (
            <div className="space-y-2">
              {myJobs.map((b) => (
                <div key={b.id} className="rounded-lg border border-border bg-bg p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium text-text">{b.customer}</span>
                    <span className="text-textMuted">{new Date(b.datetime).toLocaleString(branding.locale, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                  </div>
                  <div className="text-xs text-textMuted">{b.vehicle} · <span className="chip">{b.status.replace("_", " ")}</span></div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel p-5">
          <SectionTitle>Services rendered</SectionTitle>
          {myServices.length === 0 ? <Empty>No services recorded this month yet.</Empty> : (
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs uppercase tracking-wide text-textMuted">
                  <th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Service</th><th className="py-2 pr-3 text-right">Your commission</th>
                </tr></thead>
                <tbody className="divide-y divide-border">
                  {myServices.map((s, i) => (
                    <tr key={i}>
                      <td className="py-2 pr-3 text-textMuted">{s.date}</td>
                      <td className="py-2 pr-3 text-text">{s.name}</td>
                      <td className="py-2 pr-3 text-right" style={{ color: "var(--primary)" }}>{money(s.share)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
