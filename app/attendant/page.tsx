"use client";
import { useEffect, useMemo, useState } from "react";
import { branding } from "@/config/branding";
import { api, uid } from "@/lib/client";
import { TABS } from "@/lib/tabs";
import { attendantCommission, attendantTips, money } from "@/lib/data";
import type { Attendant, Sale, Booking, AttendanceRecord } from "@/lib/types";
import { Spinner, Banner, Stat, SectionTitle, Empty } from "@/components/ui/primitives";

export default function AttendantPage() {
  const [attendants, setAttendants] = useState<Attendant[]>([]);
  const [selected, setSelected] = useState<Attendant | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try { setAttendants((await api.attendants()).filter((a) => a.active)); }
      catch (e) { setErr(e instanceof Error ? e.message : "Failed to load"); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <Spinner />;
  if (err) return <Banner kind="error">{err}</Banner>;

  if (!selected) {
    return (
      <div>
        <SectionTitle>Who&apos;s clocking in?</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {attendants.map((a) => (
            <button
              key={a.id}
              onClick={() => setSelected(a)}
              className="panel p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-glow"
            >
              <div className="font-display text-base font-semibold text-text">{a.name}</div>
              <div className="text-sm text-textMuted">{a.role}</div>
            </button>
          ))}
          {attendants.length === 0 && <Empty>No attendants set up yet. Add them in Admin.</Empty>}
        </div>
      </div>
    );
  }

  return <AttendantDashboard attendant={selected} onSwitch={() => setSelected(null)} />;
}

function AttendantDashboard({ attendant, onSwitch }: { attendant: Attendant; onSwitch: () => void }) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [clocking, setClocking] = useState(false);

  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 14); return d.toISOString().slice(0, 10); });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  async function load() {
    setLoading(true);
    try {
      const [s, b, at] = await Promise.all([api.sales(), api.bookings(), api.attendance()]);
      setSales(s); setBookings(b); setAttendance(at);
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const periodSales = useMemo(
    () => sales.filter((s) => s.datetime.slice(0, 10) >= from && s.datetime.slice(0, 10) <= to),
    [sales, from, to]
  );

  // Lines this attendant worked on
  const myLines = useMemo(() => {
    const rows: { date: string; service: string; price: number; share: number; comm: number }[] = [];
    for (const s of periodSales) {
      if (s.status !== "paid") continue;
      for (const l of s.lines) {
        if (l.attendantIds.includes(attendant.id)) {
          const split = l.attendantIds.length;
          rows.push({
            date: s.datetime,
            service: l.serviceName,
            price: l.price,
            share: split,
            comm: l.commissionTotal / split,
          });
        }
      }
    }
    return rows.sort((a, b) => b.date.localeCompare(a.date));
  }, [periodSales, attendant.id]);

  const commission = attendantCommission(periodSales, attendant.id);
  const tips = attendantTips(periodSales, attendant.id);

  const myRecords = attendance.filter((r) => r.attendantId === attendant.id && r.date >= from && r.date <= to);
  const daysPresent = new Set(myRecords.map((r) => r.date)).size;
  const hours = myRecords.reduce((s, r) => s + r.hours, 0);
  const base = attendant.payType === "hourly" ? hours * attendant.baseRate : daysPresent * attendant.baseRate;
  const gross = base + commission + tips;

  const today = new Date().toISOString().slice(0, 10);
  const openRecord = attendance.find((r) => r.attendantId === attendant.id && r.date === today && !r.clockOut);

  const myJobs = bookings
    .filter((b) => b.attendantId === attendant.id && b.status !== "cancelled" && b.status !== "done")
    .sort((a, b) => a.datetime.localeCompare(b.datetime));

  async function clockIn() {
    setClocking(true);
    try {
      await api.append(TABS.attendance, {
        id: uid("A-"), attendantId: attendant.id, date: today,
        clockIn: new Date().toISOString(), clockOut: "", hours: 0,
      });
      await load();
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setClocking(false); }
  }

  async function clockOut() {
    if (!openRecord) return;
    setClocking(true);
    try {
      const out = new Date();
      const hrs = Math.max(0, (out.getTime() - new Date(openRecord.clockIn).getTime()) / 3.6e6);
      await api.update(TABS.attendance, openRecord.id, {
        id: openRecord.id, attendantId: attendant.id, date: openRecord.date,
        clockIn: openRecord.clockIn, clockOut: out.toISOString(), hours: Math.round(hrs * 100) / 100,
      });
      await load();
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setClocking(false); }
  }

  if (loading) return <Spinner />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-text">{attendant.name}</h1>
          <p className="text-sm text-textMuted">{attendant.role}</p>
        </div>
        <div className="flex items-center gap-2">
          {openRecord ? (
            <button className="btn-danger" disabled={clocking} onClick={clockOut}>
              {clocking ? "…" : "Clock out"}
            </button>
          ) : (
            <button className="btn-primary" disabled={clocking} onClick={clockIn}>
              {clocking ? "…" : "Clock in"}
            </button>
          )}
          <button className="btn-ghost" onClick={onSwitch}>Switch</button>
        </div>
      </div>

      {err && <Banner kind="error">{err}</Banner>}

      <div className="flex flex-wrap items-end gap-2">
        <div><span className="label">From</span><input type="date" className="input w-auto" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><span className="label">To</span><input type="date" className="input w-auto" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Commission" value={money(commission)} accent />
        <Stat label="Tips" value={money(tips)} />
        <Stat label="Base pay" value={money(base)} />
        <Stat label="Gross pay" value={money(gross)} accent />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Assigned jobs */}
        <div className="panel p-5">
          <SectionTitle>Assigned jobs</SectionTitle>
          {myJobs.length === 0 ? (
            <p className="text-sm text-textMuted">No upcoming jobs assigned to you.</p>
          ) : (
            <div className="space-y-2">
              {myJobs.map((b) => (
                <div key={b.id} className="flex items-center justify-between rounded-lg border border-border bg-bg p-3">
                  <div>
                    <span className="text-sm font-medium text-text">{b.customer}</span>
                    <span className="ml-2 text-xs text-textMuted">{b.vehicle || "—"}</span>
                  </div>
                  <span className="text-xs text-textMuted">
                    {new Date(b.datetime).toLocaleString(branding.locale, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payroll snapshot */}
        <div className="panel p-5">
          <SectionTitle>Payroll snapshot</SectionTitle>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border">
              <tr><td className="py-2 text-textMuted">Days present</td><td className="py-2 text-right text-text">{daysPresent}</td></tr>
              <tr><td className="py-2 text-textMuted">Hours logged</td><td className="py-2 text-right text-text">{hours.toFixed(1)}</td></tr>
              <tr><td className="py-2 text-textMuted">Base ({attendant.payType})</td><td className="py-2 text-right text-text">{money(base)}</td></tr>
              <tr><td className="py-2 text-textMuted">Commission</td><td className="py-2 text-right text-text">{money(commission)}</td></tr>
              <tr><td className="py-2 text-textMuted">Tips</td><td className="py-2 text-right text-text">{money(tips)}</td></tr>
              <tr className="font-semibold"><td className="py-2 text-text">Gross pay</td><td className="py-2 text-right" style={{ color: "var(--primary)" }}>{money(gross)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Services rendered */}
      <div className="panel p-5">
        <SectionTitle>Services I rendered</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-textMuted">
              <th className="py-2 pr-4">Date</th><th className="py-2 pr-4">Service</th>
              <th className="py-2 pr-4">Split</th><th className="py-2 pr-4 text-right">My commission</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {myLines.map((l, i) => (
                <tr key={i}>
                  <td className="py-2 pr-4 text-textMuted">{new Date(l.date).toLocaleDateString(branding.locale)}</td>
                  <td className="py-2 pr-4 text-text">{l.service}</td>
                  <td className="py-2 pr-4 text-textMuted">{l.share > 1 ? `1/${l.share}` : "solo"}</td>
                  <td className="py-2 pr-4 text-right" style={{ color: "var(--primary)" }}>{money(l.comm)}</td>
                </tr>
              ))}
              {myLines.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-textMuted">No services in this period.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
