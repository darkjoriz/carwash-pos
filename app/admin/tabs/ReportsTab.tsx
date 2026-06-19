"use client";
import { useEffect, useMemo, useState } from "react";
import { branding } from "@/config/branding";
import { api, uid } from "@/lib/client";
import { TABS } from "@/lib/tabs";
import { computePnL, cogsFromMovements, money, saleToRow } from "@/lib/data";
import type { Sale, Expense, StockMovement } from "@/lib/types";
import { Spinner, Banner, Stat, SectionTitle, Modal } from "@/components/ui/primitives";

export function ReportsTab() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [editing, setEditing] = useState<Sale | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [s, e, m] = await Promise.all([api.sales(), api.expenses(), api.movements()]);
      setSales(s); setExpenses(e); setMovements(m);
    } catch (er) { setErr(er instanceof Error ? er.message : "Failed to load"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const inRange = useMemo(() => ({
    sales: sales.filter((x) => x.datetime.slice(0, 10) >= from && x.datetime.slice(0, 10) <= to),
    expenses: expenses.filter((x) => x.date >= from && x.date <= to),
  }), [sales, expenses, from, to]);

  const cogs = useMemo(() => cogsFromMovements(movements, from, to), [movements, from, to]);
  const pnl = useMemo(() => computePnL(inRange.sales, inRange.expenses, cogs), [inRange, cogs]);

  const byMethod = useMemo(() => {
    const m: Record<string, number> = {};
    inRange.sales.filter((s) => s.status === "paid").forEach((s) => { m[s.paymentMethod] = (m[s.paymentMethod] || 0) + s.total; });
    return m;
  }, [inRange]);
  const methodTotal = Object.values(byMethod).reduce((a, b) => a + b, 0);

  if (loading) return <Spinner label="Crunching numbers…" />;
  if (err) return <Banner kind="error">{err}</Banner>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-2">
        <div><span className="label">From</span><input type="date" className="input w-auto" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><span className="label">To</span><input type="date" className="input w-auto" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Revenue" value={money(pnl.revenue)} accent />
        <Stat label="COGS (supplies used)" value={money(pnl.cogs)} />
        <Stat label="Commissions" value={money(pnl.commissionsPaid)} />
        <Stat label="Net profit" value={money(pnl.netProfit)} accent />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="panel p-5">
          <SectionTitle>Profit &amp; Loss</SectionTitle>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border">
              <PnlRow label="Revenue (incl. tax)" value={pnl.revenue} />
              <PnlRow label="Cost of goods sold" value={-pnl.cogs} />
              <PnlRow label="Gross profit" value={pnl.grossProfit} bold />
              <PnlRow label="Commissions paid" value={-pnl.commissionsPaid} />
              <PnlRow label="Operating expenses" value={-pnl.expenses} />
              <PnlRow label="Net profit" value={pnl.netProfit} bold accent />
            </tbody>
          </table>
          <p className="mt-3 text-xs text-textMuted">COGS is computed from inventory actually consumed (auto-deductions + manual usage). Tips are pass-through and excluded.</p>
        </div>

        <div className="panel p-5">
          <SectionTitle>Payment mix</SectionTitle>
          {methodTotal === 0 ? <p className="text-sm text-textMuted">No sales in range.</p> : (
            <div className="space-y-2">
              {Object.entries(byMethod).map(([m, v]) => (
                <div key={m}>
                  <div className="mb-1 flex justify-between text-sm"><span className="text-text">{m}</span><span className="text-textMuted">{money(v)}</span></div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-bg">
                    <div className="h-full rounded-full" style={{ width: `${(v / methodTotal) * 100}%`, background: "var(--primary)" }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="panel p-5">
        <SectionTitle>Recent sales</SectionTitle>
        <div className="space-y-3">
          {inRange.sales.slice(-15).reverse().map((s) => (
            <div key={s.id} className="rounded-lg border border-border bg-bg p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm">
                  <span className="text-textMuted">{new Date(s.datetime).toLocaleString(branding.locale, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                  <span className="ml-2 text-text">{s.customer || "Walk-in"}</span>
                  <span className="ml-2 text-textMuted">{s.vehicle || ""}</span>
                  {s.status === "void" && <span className="chip ml-2 text-danger">void</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium" style={{ color: "var(--primary)" }}>{money(s.total)}</span>
                  <button className="btn-ghost text-xs" onClick={() => setEditing(s)}>Edit</button>
                </div>
              </div>
              <table className="w-full text-xs">
                <thead><tr className="text-left text-textMuted">
                  <th className="py-1 pr-3">Service</th><th className="py-1 pr-3 text-right">Price</th>
                  <th className="py-1 pr-3 text-right">Commission</th><th className="py-1 pr-3 text-right">Net of comm.</th>
                </tr></thead>
                <tbody>
                  {s.lines.map((l, i) => (
                    <tr key={i} className="border-t border-border/50">
                      <td className="py-1 pr-3 text-text">{l.serviceName}</td>
                      <td className="py-1 pr-3 text-right text-textMuted">{money(l.price)}</td>
                      <td className="py-1 pr-3 text-right" style={{ color: "var(--warning)" }}>−{money(l.commissionTotal)}</td>
                      <td className="py-1 pr-3 text-right text-text">{money(l.price - l.commissionTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(s.carPhotoUrl || s.signatureUrl) && (
                <div className="mt-2 flex gap-2">
                  {s.carPhotoUrl && <a href={s.carPhotoUrl} target="_blank" rel="noreferrer" className="chip text-text">Car photo ↗</a>}
                  {s.signatureUrl && <a href={s.signatureUrl} target="_blank" rel="noreferrer" className="chip text-text">Signature ↗</a>}
                </div>
              )}
            </div>
          ))}
          {inRange.sales.length === 0 && <p className="text-sm text-textMuted">No sales in range.</p>}
        </div>
      </div>

      {editing && <EditSaleModal sale={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function PnlRow({ label, value, bold, accent }: { label: string; value: number; bold?: boolean; accent?: boolean }) {
  return (
    <tr className={bold ? "font-semibold" : ""}>
      <td className="py-2 text-text">{label}</td>
      <td className="py-2 text-right" style={accent ? { color: "var(--primary)" } : value < 0 ? { color: "var(--text-muted)" } : undefined}>{money(value)}</td>
    </tr>
  );
}

function EditSaleModal({ sale, onClose, onSaved }: { sale: Sale; onClose: () => void; onSaved: () => void }) {
  const [tip, setTip] = useState(sale.tip);
  const [payment, setPayment] = useState(sale.paymentMethod);
  const [status, setStatus] = useState(sale.status);
  const [lines, setLines] = useState(sale.lines.map((l) => ({ ...l })));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  function setPrice(i: number, price: number) {
    setLines((ls) => ls.map((l, idx) => {
      if (idx !== i) return l;
      const commissionTotal = Math.round(((price * l.commissionRate) / 100) * 100) / 100;
      return { ...l, price, commissionTotal };
    }));
  }

  async function save() {
    setSaving(true); setErr("");
    try {
      const subtotal = Math.round(lines.reduce((s, l) => s + l.price, 0) * 100) / 100;
      const tax = Math.round((subtotal * branding.taxRate) / 100 * 100) / 100;
      const commissionTotal = Math.round(lines.reduce((s, l) => s + l.commissionTotal, 0) * 100) / 100;
      const total = Math.round((subtotal + tax + tip) * 100) / 100;
      const updated: Sale = { ...sale, lines, tip, paymentMethod: payment, status, subtotal, tax, commissionTotal, total };
      await api.update(TABS.sales, sale.id, saleToRow(updated));
      onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }

  return (
    <Modal open onClose={onClose} title="Edit sale">
      <div className="space-y-3">
        {lines.map((l, i) => (
          <div key={i} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-bg p-2">
            <span className="text-sm text-text">{l.serviceName}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-textMuted">{branding.currencySymbol}</span>
              <input type="number" className="input w-24 text-right" value={l.price}
                onChange={(e) => setPrice(i, parseFloat(e.target.value) || 0)} />
            </div>
          </div>
        ))}
        <div className="grid grid-cols-2 gap-2">
          <div><span className="label">Tip</span><input type="number" className="input" value={tip} onChange={(e) => setTip(parseFloat(e.target.value) || 0)} /></div>
          <div><span className="label">Payment</span>
            <select className="input" value={payment} onChange={(e) => setPayment(e.target.value)}>
              {branding.paymentMethods.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <div>
          <span className="label">Status</span>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value as Sale["status"])}>
            <option value="paid">paid</option>
            <option value="void">void</option>
          </select>
        </div>
        {err && <Banner kind="error">{err}</Banner>}
        <button className="btn-primary w-full" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save changes"}</button>
      </div>
    </Modal>
  );
}
