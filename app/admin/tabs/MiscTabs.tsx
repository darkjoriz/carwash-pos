"use client";
import { useEffect, useState } from "react";
import { branding } from "@/config/branding";
import { api } from "@/lib/client";
import { TABS } from "@/lib/tabs";
import { money } from "@/lib/data";
import type { Service, Booking, Attendant } from "@/lib/types";
import { Spinner, Banner, SectionTitle } from "@/components/ui/primitives";

export function CommissionTab() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [savingId, setSavingId] = useState("");

  async function load() {
    setLoading(true);
    try { setServices(await api.services()); }
    catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function setRate(s: Service, rate: number) {
    setSavingId(s.id);
    try {
      await api.update(TABS.services, s.id, {
        id: s.id, name: s.name, category: s.category, price: s.price,
        commissionRate: rate, durationMin: s.durationMin, active: String(s.active),
      });
      setServices((prev) => prev.map((x) => x.id === s.id ? { ...x, commissionRate: rate } : x));
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setSavingId(""); }
  }

  if (loading) return <Spinner />;
  if (err) return <Banner kind="error">{err}</Banner>;

  return (
    <div className="panel p-5">
      <SectionTitle>Commission rate per service</SectionTitle>
      <p className="mb-4 text-sm text-textMuted">Default is {branding.defaultCommissionRate}%. Override per service — changes save to the sheet on blur.</p>
      <div className="space-y-2">
        {services.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-lg border border-border bg-bg p-3">
            <div><span className="text-sm font-medium text-text">{s.name}</span><span className="ml-2 text-xs text-textMuted">{s.category} · {money(s.price)}</span></div>
            <div className="flex items-center gap-2">
              <input type="number" min={0} max={100} className="input w-20 text-right" defaultValue={s.commissionRate}
                onBlur={(e) => { const v = parseFloat(e.target.value) || 0; if (v !== s.commissionRate) setRate(s, v); }} />
              <span className="text-sm text-textMuted">%</span>
              <span className="w-20 text-right text-xs" style={{ color: "var(--primary)" }}>{savingId === s.id ? "saving…" : money((s.price * s.commissionRate) / 100)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BookingsTab() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [attendants, setAttendants] = useState<Attendant[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [b, a] = await Promise.all([api.bookings(), api.attendants()]);
      setBookings(b); setAttendants(a);
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function setStatus(b: Booking, status: Booking["status"]) {
    try {
      await api.update(TABS.bookings, b.id, {
        id: b.id, datetime: b.datetime, customer: b.customer, phone: b.phone, vehicle: b.vehicle,
        serviceIds: b.serviceIds.join("|"), attendantId: b.attendantId, status, notes: b.notes || "",
      });
      load();
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
  }

  if (loading) return <Spinner />;
  if (err) return <Banner kind="error">{err}</Banner>;
  const name = (id: string) => attendants.find((a) => a.id === id)?.name ?? "Unassigned";
  const upcoming = bookings.sort((a, b) => a.datetime.localeCompare(b.datetime));

  return (
    <div className="panel p-5">
      <SectionTitle>All bookings</SectionTitle>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase tracking-wide text-textMuted">
            <th className="py-2 pr-3">When</th><th className="py-2 pr-3">Customer</th><th className="py-2 pr-3">Vehicle</th>
            <th className="py-2 pr-3">Attendant</th><th className="py-2 pr-3">Status</th>
          </tr></thead>
          <tbody className="divide-y divide-border">
            {upcoming.map((b) => (
              <tr key={b.id}>
                <td className="py-2 pr-3 text-textMuted">{new Date(b.datetime).toLocaleString(branding.locale, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                <td className="py-2 pr-3 text-text">{b.customer}</td>
                <td className="py-2 pr-3 text-textMuted">{b.vehicle || "—"}</td>
                <td className="py-2 pr-3 text-textMuted">{name(b.attendantId)}</td>
                <td className="py-2 pr-3">
                  <select className="input w-auto py-1 text-xs" value={b.status} onChange={(e) => setStatus(b, e.target.value as Booking["status"])}>
                    {["booked", "in_progress", "done", "cancelled", "no_show"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {upcoming.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-textMuted">No bookings.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
