"use client";
import { useEffect, useMemo, useState } from "react";
import { api, uid } from "@/lib/client";
import { TABS } from "@/lib/tabs";
import { computePay, money } from "@/lib/data";
import type { Attendant, AttendanceRecord, Sale, PayrollSettings } from "@/lib/types";
import { Spinner, Banner, SectionTitle, Modal } from "@/components/ui/primitives";

export function AttendanceTab() {
  const [view, setView] = useState<"payroll" | "records" | "settings">("payroll");
  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-xl border border-border bg-surface p-1 w-fit">
        {([["payroll", "Payroll"], ["records", "Time records"], ["settings", "Pay settings"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setView(id)}
            className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${view === id ? "bg-primary text-primaryText" : "text-textMuted hover:text-text"}`}>{label}</button>
        ))}
      </div>
      {view === "payroll" && <PayrollView />}
      {view === "records" && <RecordsView />}
      {view === "settings" && <SettingsView />}
    </div>
  );
}

function useRange() {
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 14); return d.toISOString().slice(0, 10); });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  return { from, to, setFrom, setTo };
}

function PayrollView() {
  const { from, to, setFrom, setTo } = useRange();
  const [attendants, setAttendants] = useState<Attendant[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [settings, setSettings] = useState<PayrollSettings>({ defaultExpectedHours: 8, defaultOtRatePerHour: 0, maxOtHoursPerDay: 4 });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [a, r, s, set] = await Promise.all([api.attendants(), api.attendance(), api.sales(), api.settings()]);
        setAttendants(a); setRecords(r); setSales(s); setSettings(set);
      } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
      finally { setLoading(false); }
    })();
  }, []);

  const periodRecords = useMemo(() => records.filter((r) => r.date >= from && r.date <= to), [records, from, to]);
  const periodSales = useMemo(() => sales.filter((s) => s.datetime.slice(0, 10) >= from && s.datetime.slice(0, 10) <= to), [sales, from, to]);

  if (loading) return <Spinner />;
  if (err) return <Banner kind="error">{err}</Banner>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div><span className="label">From</span><input type="date" className="input w-auto" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><span className="label">To</span><input type="date" className="input w-auto" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </div>
      <div className="panel p-5">
        <SectionTitle>Payroll summary</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-textMuted">
              <th className="py-2 pr-3">Attendant</th><th className="py-2 pr-3">Days</th><th className="py-2 pr-3">Reg hrs</th>
              <th className="py-2 pr-3">OT hrs</th><th className="py-2 pr-3 text-right">Base</th><th className="py-2 pr-3 text-right">OT pay</th>
              <th className="py-2 pr-3 text-right">Comm.</th><th className="py-2 pr-3 text-right">Tips</th><th className="py-2 pr-3 text-right">Gross</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {attendants.map((a) => {
                const p = computePay(a, periodRecords, periodSales, settings);
                return (
                  <tr key={a.id}>
                    <td className="py-2 pr-3 text-text">{a.name}<span className="ml-1 text-xs text-textMuted">{a.role}</span></td>
                    <td className="py-2 pr-3 text-textMuted">{p.daysPresent}</td>
                    <td className="py-2 pr-3 text-textMuted">{p.regularHours.toFixed(1)}</td>
                    <td className="py-2 pr-3 text-textMuted">{p.otHours.toFixed(1)}</td>
                    <td className="py-2 pr-3 text-right text-textMuted">{money(p.basePay)}</td>
                    <td className="py-2 pr-3 text-right text-textMuted">{money(p.otPay)}</td>
                    <td className="py-2 pr-3 text-right text-textMuted">{money(p.commission)}</td>
                    <td className="py-2 pr-3 text-right text-textMuted">{money(p.tips)}</td>
                    <td className="py-2 pr-3 text-right font-semibold" style={{ color: "var(--primary)" }}>{money(p.gross)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RecordsView() {
  const { from, to, setFrom, setTo } = useRange();
  const [attendants, setAttendants] = useState<Attendant[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState<AttendanceRecord | null>(null);
  const [adding, setAdding] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [a, r] = await Promise.all([api.attendants(), api.attendance()]);
      setAttendants(a); setRecords(r);
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function remove(r: AttendanceRecord) {
    if (!confirm("Delete this time record?")) return;
    try { await api.remove(TABS.attendance, r.id); load(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Delete failed"); }
  }

  if (loading) return <Spinner />;
  if (err) return <Banner kind="error">{err}</Banner>;
  const name = (id: string) => attendants.find((a) => a.id === id)?.name ?? id;
  const inRange = records.filter((r) => r.date >= from && r.date <= to).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div><span className="label">From</span><input type="date" className="input w-auto" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><span className="label">To</span><input type="date" className="input w-auto" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <button className="btn-primary" onClick={() => setAdding(true)}>+ Add record</button>
      </div>
      <div className="panel p-5">
        <SectionTitle>Time records (editable)</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-textMuted">
              <th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Attendant</th><th className="py-2 pr-3">In</th>
              <th className="py-2 pr-3">Out</th><th className="py-2 pr-3 text-right">Hours</th><th className="py-2 pr-3 text-right">OT</th><th className="py-2 pr-3 text-right">Edit</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {inRange.map((r) => (
                <tr key={r.id}>
                  <td className="py-2 pr-3 text-textMuted">{r.date}</td>
                  <td className="py-2 pr-3 text-text">{name(r.attendantId)}</td>
                  <td className="py-2 pr-3 text-textMuted">{r.clockIn ? new Date(r.clockIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                  <td className="py-2 pr-3 text-textMuted">{r.clockOut ? new Date(r.clockOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                  <td className="py-2 pr-3 text-right text-text">{r.hours.toFixed(1)}</td>
                  <td className="py-2 pr-3 text-right text-textMuted">{r.otHours.toFixed(1)}</td>
                  <td className="py-2 pr-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button className="btn-ghost text-xs" onClick={() => setEditing(r)}>Edit</button>
                      <button className="btn-danger text-xs" onClick={() => remove(r)}>Del</button>
                    </div>
                  </td>
                </tr>
              ))}
              {inRange.length === 0 && <tr><td colSpan={7} className="py-4 text-center text-textMuted">No records in range.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {(adding || editing) && <RecordModal record={editing} attendants={attendants} onClose={() => { setAdding(false); setEditing(null); }} onSaved={() => { setAdding(false); setEditing(null); load(); }} />}
    </div>
  );
}

function RecordModal({ record, attendants, onClose, onSaved }: { record: AttendanceRecord | null; attendants: Attendant[]; onClose: () => void; onSaved: () => void }) {
  const [attendantId, setAttendantId] = useState(record?.attendantId ?? attendants[0]?.id ?? "");
  const [date, setDate] = useState(record?.date ?? new Date().toISOString().slice(0, 10));
  const [inTime, setInTime] = useState(record?.clockIn ? new Date(record.clockIn).toTimeString().slice(0, 5) : "08:00");
  const [outTime, setOutTime] = useState(record?.clockOut ? new Date(record.clockOut).toTimeString().slice(0, 5) : "17:00");
  const [hours, setHours] = useState(record?.hours ?? 0);
  const [otHours, setOtHours] = useState(record?.otHours ?? 0);
  const [note, setNote] = useState(record?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  function autoHours() {
    if (!date || !inTime || !outTime) return;
    const diff = (new Date(`${date}T${outTime}`).getTime() - new Date(`${date}T${inTime}`).getTime()) / 3.6e6;
    if (diff > 0) setHours(Math.round(diff * 100) / 100);
  }

  async function save() {
    setErr("");
    if (!attendantId) return setErr("Pick an attendant.");
    setSaving(true);
    try {
      const clockIn = inTime ? new Date(`${date}T${inTime}`).toISOString() : "";
      const clockOut = outTime ? new Date(`${date}T${outTime}`).toISOString() : "";
      const record2 = { id: record?.id ?? uid("A-"), attendantId, date, clockIn, clockOut, hours, otHours, note };
      if (record) await api.update(TABS.attendance, record.id, record2);
      else await api.append(TABS.attendance, record2);
      onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  return (
    <Modal open onClose={onClose} title={record ? "Edit time record" : "Add time record"}>
      <div className="space-y-3">
        <div><span className="label">Attendant</span>
          <select className="input" value={attendantId} onChange={(e) => setAttendantId(e.target.value)}>
            {attendants.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div><span className="label">Date</span><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div><span className="label">In</span><input type="time" className="input" value={inTime} onChange={(e) => setInTime(e.target.value)} onBlur={autoHours} /></div>
          <div><span className="label">Out</span><input type="time" className="input" value={outTime} onChange={(e) => setOutTime(e.target.value)} onBlur={autoHours} /></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><span className="label">Hours</span><input type="number" className="input" value={hours} onChange={(e) => setHours(parseFloat(e.target.value) || 0)} /></div>
          <div><span className="label">OT hours</span><input type="number" className="input" value={otHours} onChange={(e) => setOtHours(parseFloat(e.target.value) || 0)} /></div>
        </div>
        <div><span className="label">Note</span><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></div>
        {err && <Banner kind="error">{err}</Banner>}
        <button className="btn-primary w-full" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save record"}</button>
      </div>
    </Modal>
  );
}

function SettingsView() {
  const [s, setS] = useState<PayrollSettings>({ defaultExpectedHours: 8, defaultOtRatePerHour: 0, maxOtHoursPerDay: 4 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => { (async () => { try { setS(await api.settings()); } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); } finally { setLoading(false); } })(); }, []);

  async function save() {
    setSaving(true); setErr(""); setMsg("");
    try {
      await api.setSetting("defaultExpectedHours", s.defaultExpectedHours);
      await api.setSetting("defaultOtRatePerHour", s.defaultOtRatePerHour);
      await api.setSetting("maxOtHoursPerDay", s.maxOtHoursPerDay);
      setMsg("Saved.");
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  if (loading) return <Spinner />;

  return (
    <div className="panel max-w-lg p-5">
      <SectionTitle>Pay &amp; overtime settings</SectionTitle>
      <div className="space-y-3">
        <div><span className="label">Expected hours per day (before OT)</span><input type="number" className="input" value={s.defaultExpectedHours} onChange={(e) => setS({ ...s, defaultExpectedHours: parseFloat(e.target.value) || 0 })} /></div>
        <div><span className="label">Default OT rate per hour</span><input type="number" className="input" value={s.defaultOtRatePerHour} onChange={(e) => setS({ ...s, defaultOtRatePerHour: parseFloat(e.target.value) || 0 })} /></div>
        <div><span className="label">Max allowable OT hours per day</span><input type="number" className="input" value={s.maxOtHoursPerDay} onChange={(e) => setS({ ...s, maxOtHoursPerDay: parseFloat(e.target.value) || 0 })} /></div>
        <p className="text-xs text-textMuted">Each attendant can override the OT rate in their profile. OT beyond the daily cap is not counted.</p>
        {err && <Banner kind="error">{err}</Banner>}
        {msg && <Banner kind="info">{msg}</Banner>}
        <button className="btn-primary w-full" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save settings"}</button>
      </div>
    </div>
  );
}
