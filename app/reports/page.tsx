"use client";
import { useEffect, useMemo, useState } from "react";
import { branding } from "@/config/branding";
import { api } from "@/lib/client";
import { money } from "@/lib/data";
import type { Sale } from "@/lib/types";
import { Spinner, Banner, Stat, SectionTitle } from "@/components/ui/primitives";
import { TopBar } from "@/components/TopBar";
import { Guard } from "@/components/Guard";

export default function ReportsPage() {
  return (
    <Guard allow={["cashier", "admin"]}>
      {(s) => <ReportsInner role={s.role} name={s.displayName} />}
    </Guard>
  );
}

function ReportsInner({ role, name }: { role: string; name: string }) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [from, setFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    (async () => {
      try { setSales(await api.sales()); }
      catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
      finally { setLoading(false); }
    })();
  }, []);

  const inRange = useMemo(
    () => sales.filter((s) => s.status === "paid" && s.datetime.slice(0, 10) >= from && s.datetime.slice(0, 10) <= to),
    [sales, from, to]
  );
  const gross = inRange.reduce((s, x) => s + x.total, 0);
  const tips = inRange.reduce((s, x) => s + x.tip, 0);
  const count = inRange.length;
  const byMethod = useMemo(() => {
    const m: Record<string, number> = {};
    inRange.forEach((s) => { m[s.paymentMethod] = (m[s.paymentMethod] || 0) + s.total; });
    return m;
  }, [inRange]);

  return (
    <>
      <TopBar role={role} name={name} />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <SectionTitle>Daily reports</SectionTitle>
        {loading ? <Spinner /> : err ? <Banner kind="error">{err}</Banner> : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-end gap-2">
              <div><span className="label">From</span><input type="date" className="input w-auto" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
              <div><span className="label">To</span><input type="date" className="input w-auto" value={to} onChange={(e) => setTo(e.target.value)} /></div>
              <button className="btn-ghost" onClick={() => { const t = new Date().toISOString().slice(0, 10); setFrom(t); setTo(t); }}>Today</button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Sales count" value={String(count)} />
              <Stat label="Gross sales" value={money(gross)} accent />
              <Stat label="Tips" value={money(tips)} />
            </div>
            <div className="panel p-5">
              <SectionTitle>By payment method</SectionTitle>
              {Object.keys(byMethod).length === 0 ? <p className="text-sm text-textMuted">No sales in range.</p> : (
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-border">
                    {Object.entries(byMethod).map(([m, v]) => (
                      <tr key={m}><td className="py-2 text-text">{m}</td><td className="py-2 text-right text-textMuted">{money(v)}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="panel p-5">
              <SectionTitle>Transactions</SectionTitle>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs uppercase tracking-wide text-textMuted">
                    <th className="py-2 pr-3">Time</th><th className="py-2 pr-3">Customer</th><th className="py-2 pr-3">Items</th>
                    <th className="py-2 pr-3">Payment</th><th className="py-2 pr-3 text-right">Total</th>
                  </tr></thead>
                  <tbody className="divide-y divide-border">
                    {inRange.slice().reverse().map((s) => (
                      <tr key={s.id}>
                        <td className="py-2 pr-3 text-textMuted">{new Date(s.datetime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                        <td className="py-2 pr-3 text-text">{s.customer || "Walk-in"}</td>
                        <td className="py-2 pr-3 text-textMuted">{s.lines.map((l) => l.serviceName).join(", ")}</td>
                        <td className="py-2 pr-3 text-textMuted">{s.paymentMethod}</td>
                        <td className="py-2 pr-3 text-right font-medium" style={{ color: "var(--primary)" }}>{money(s.total)}</td>
                      </tr>
                    ))}
                    {count === 0 && <tr><td colSpan={5} className="py-4 text-center text-textMuted">No transactions.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
