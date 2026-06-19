"use client";
import { useEffect, useMemo, useState } from "react";
import { branding } from "@/config/branding";
import { api, uid } from "@/lib/client";
import { TABS } from "@/lib/tabs";
import {
  computePnL,
  attendantCommission,
  attendantTips,
  money,
} from "@/lib/data";
import type {
  Service, Attendant, Sale, InventoryItem, AttendanceRecord, Expense,
} from "@/lib/types";
import { Spinner, Banner, Stat, SectionTitle, Modal, Empty } from "@/components/ui/primitives";

type AdminTab = "reports" | "services" | "inventory" | "attendance" | "commission" | "bookings";

const ADMIN_TABS: { id: AdminTab; label: string }[] = [
  { id: "reports", label: "Sales & P&L" },
  { id: "services", label: "Services" },
  { id: "inventory", label: "Inventory" },
  { id: "attendance", label: "Attendance" },
  { id: "commission", label: "Commission" },
  { id: "bookings", label: "Bookings" },
];

export default function AdminPage() {
  const [tab, setTab] = useState<AdminTab>("reports");
  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-1 rounded-xl border border-border bg-surface p-1 w-fit">
        {ADMIN_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
              tab === t.id ? "bg-primary text-primaryText" : "text-textMuted hover:text-text"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "reports" && <Reports />}
      {tab === "services" && <ServicesAdmin />}
      {tab === "inventory" && <InventoryAdmin />}
      {tab === "attendance" && <AttendanceAdmin />}
      {tab === "commission" && <CommissionAdmin />}
      {tab === "bookings" && <BookingsAdmin />}
    </div>
  );
}

// ============================================================
//  REPORTS + P&L
// ============================================================
function Reports() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [openExpense, setOpenExpense] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [s, e, inv] = await Promise.all([api.sales(), api.expenses(), api.inventory()]);
      setSales(s); setExpenses(e); setInventory(inv);
    } catch (er) {
      setErr(er instanceof Error ? er.message : "Failed to load");
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const inRange = useMemo(() => {
    const f = from, t = to;
    return {
      sales: sales.filter((x) => x.datetime.slice(0, 10) >= f && x.datetime.slice(0, 10) <= t),
      expenses: expenses.filter((x) => x.date >= f && x.date <= t),
    };
  }, [sales, expenses, from, to]);

  const pnl = useMemo(() => computePnL(inRange.sales, inRange.expenses), [inRange]);

  // Payment method breakdown
  const byMethod = useMemo(() => {
    const m: Record<string, number> = {};
    inRange.sales.filter((s) => s.status === "paid").forEach((s) => {
      m[s.paymentMethod] = (m[s.paymentMethod] || 0) + s.total;
    });
    return m;
  }, [inRange]);

  const lowStock = inventory.filter((i) => i.qty <= i.reorderLevel);

  if (loading) return <Spinner label="Crunching numbers…" />;
  if (err) return <Banner kind="error">{err}</Banner>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-2">
        <div><span className="label">From</span><input type="date" className="input w-auto" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><span className="label">To</span><input type="date" className="input w-auto" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <button className="btn-ghost" onClick={() => setOpenExpense(true)}>+ Expense</button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Revenue" value={money(pnl.revenue)} accent />
        <Stat label="Tips collected" value={money(pnl.tips)} />
        <Stat label="Commissions" value={money(pnl.commissionsPaid)} />
        <Stat label="Expenses" value={money(pnl.expenses)} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* P&L statement */}
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
          <p className="mt-3 text-xs text-textMuted">
            Tips are pass-through to attendants and excluded from profit.
          </p>
        </div>

        {/* payment mix + low stock */}
        <div className="space-y-5">
          <div className="panel p-5">
            <SectionTitle>Payment mix</SectionTitle>
            {Object.keys(byMethod).length === 0 ? (
              <p className="text-sm text-textMuted">No sales in range.</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(byMethod).map(([m, v]) => {
                  const pct = pnl.revenue + pnl.tips > 0 ? (v / Object.values(byMethod).reduce((a, b) => a + b, 0)) * 100 : 0;
                  return (
                    <div key={m}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="text-text">{m}</span>
                        <span className="text-textMuted">{money(v)}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-bg">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--primary)" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="panel p-5">
            <SectionTitle>Low stock</SectionTitle>
            {lowStock.length === 0 ? (
              <p className="text-sm text-textMuted">Everything is above reorder level.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {lowStock.map((i) => (
                  <li key={i.id} className="flex justify-between">
                    <span className="text-text">{i.name}</span>
                    <span className="text-danger">{i.qty} left</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* recent sales */}
      <div className="panel p-5">
        <SectionTitle>Recent sales</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-textMuted">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Items</th>
                <th className="py-2 pr-4">Payment</th>
                <th className="py-2 pr-4">Tip</th>
                <th className="py-2 pr-4 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {inRange.sales.slice(-15).reverse().map((s) => (
                <tr key={s.id}>
                  <td className="py-2 pr-4 text-textMuted">{new Date(s.datetime).toLocaleDateString(branding.locale)}</td>
                  <td className="py-2 pr-4 text-text">{s.lines.map((l) => l.serviceName).join(", ")}</td>
                  <td className="py-2 pr-4 text-textMuted">{s.paymentMethod}</td>
                  <td className="py-2 pr-4 text-textMuted">{money(s.tip)}</td>
                  <td className="py-2 pr-4 text-right font-medium" style={{ color: "var(--primary)" }}>{money(s.total)}</td>
                </tr>
              ))}
              {inRange.sales.length === 0 && (
                <tr><td colSpan={5} className="py-4 text-center text-textMuted">No sales in range.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ExpenseModal open={openExpense} onClose={() => setOpenExpense(false)} onSaved={() => { setOpenExpense(false); load(); }} />
    </div>
  );
}

function PnlRow({ label, value, bold, accent }: { label: string; value: number; bold?: boolean; accent?: boolean }) {
  return (
    <tr className={bold ? "font-semibold" : ""}>
      <td className="py-2 text-text">{label}</td>
      <td className="py-2 text-right" style={accent ? { color: "var(--primary)" } : value < 0 ? { color: "var(--text-muted)" } : undefined}>
        {money(value)}
      </td>
    </tr>
  );
}

function ExpenseModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState("Supplies");
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    setErr("");
    if (amount <= 0) return setErr("Enter an amount.");
    setSaving(true);
    try {
      await api.append(TABS.expenses, { id: uid("E-"), date, category, amount, note });
      onSaved(); setAmount(0); setNote("");
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add expense">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div><span className="label">Date</span><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div><span className="label">Category</span>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {["Supplies", "Rent", "Utilities", "Payroll", "Equipment", "Marketing", "Other"].map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div><span className="label">Amount</span><input type="number" className="input" value={amount || ""} onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} /></div>
        <div><span className="label">Note</span><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></div>
        {err && <Banner kind="error">{err}</Banner>}
        <button className="btn-primary w-full" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save expense"}</button>
      </div>
    </Modal>
  );
}

// ============================================================
//  SERVICES
// ============================================================
function ServicesAdmin() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(false);

  async function load() {
    setLoading(true);
    try { setServices(await api.services()); }
    catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  if (loading) return <Spinner />;
  if (err) return <Banner kind="error">{err}</Banner>;

  const byCat = services.reduce<Record<string, Service[]>>((acc, s) => {
    (acc[s.category] ||= []).push(s); return acc;
  }, {});

  return (
    <div className="space-y-4">
      <SectionTitle action={<button className="btn-primary" onClick={() => setOpen(true)}>+ Add service</button>}>
        Service catalog
      </SectionTitle>
      {Object.entries(byCat).map(([cat, items]) => (
        <div key={cat} className="panel p-5">
          <h3 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-textMuted">{cat}</h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((s) => (
              <div key={s.id} className="rounded-lg border border-border bg-bg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-text">{s.name}</span>
                  {!s.active && <span className="chip text-danger">off</span>}
                </div>
                <div className="mt-1 flex justify-between text-xs text-textMuted">
                  <span style={{ color: "var(--primary)" }}>{money(s.price)}</span>
                  <span>{s.commissionRate}% · {s.durationMin}min</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {services.length === 0 && <Empty>No services yet. Add your first one.</Empty>}
      <ServiceModal open={open} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); load(); }} />
    </div>
  );
}

function ServiceModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Wash");
  const [price, setPrice] = useState(0);
  const [commissionRate, setCommissionRate] = useState<number>(branding.defaultCommissionRate);
  const [durationMin, setDurationMin] = useState(30);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    setErr("");
    if (!name) return setErr("Name required.");
    setSaving(true);
    try {
      await api.append(TABS.services, {
        id: uid("SV-"), name, category, price, commissionRate, durationMin, active: "true",
      });
      onSaved(); setName(""); setPrice(0);
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add service">
      <div className="space-y-3">
        <div><span className="label">Name</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><span className="label">Category</span><input className="input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Wash / Detailing / Add-on" /></div>
          <div><span className="label">Price</span><input type="number" className="input" value={price || ""} onChange={(e) => setPrice(parseFloat(e.target.value) || 0)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><span className="label">Commission %</span><input type="number" className="input" value={commissionRate} onChange={(e) => setCommissionRate(parseFloat(e.target.value) || 0)} /></div>
          <div><span className="label">Duration (min)</span><input type="number" className="input" value={durationMin} onChange={(e) => setDurationMin(parseInt(e.target.value) || 0)} /></div>
        </div>
        {err && <Banner kind="error">{err}</Banner>}
        <button className="btn-primary w-full" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save service"}</button>
      </div>
    </Modal>
  );
}

// ============================================================
//  INVENTORY (category + subcategory)
// ============================================================
function InventoryAdmin() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(false);

  async function load() {
    setLoading(true);
    try { setItems(await api.inventory()); }
    catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  if (loading) return <Spinner />;
  if (err) return <Banner kind="error">{err}</Banner>;

  const byCat = items.reduce<Record<string, InventoryItem[]>>((acc, i) => {
    (acc[i.category] ||= []).push(i); return acc;
  }, {});

  return (
    <div className="space-y-4">
      <SectionTitle action={<button className="btn-primary" onClick={() => setOpen(true)}>+ Add item</button>}>
        Inventory
      </SectionTitle>
      {Object.entries(byCat).map(([cat, list]) => (
        <div key={cat} className="panel p-5">
          <h3 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-textMuted">{cat}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-textMuted">
                <th className="py-2 pr-4">Item</th><th className="py-2 pr-4">Subcategory</th>
                <th className="py-2 pr-4 text-right">Qty</th><th className="py-2 pr-4 text-right">Unit cost</th>
                <th className="py-2 pr-4 text-right">Value</th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {list.map((i) => (
                  <tr key={i.id}>
                    <td className="py-2 pr-4 text-text">{i.name}</td>
                    <td className="py-2 pr-4 text-textMuted">{i.subcategory || "—"}</td>
                    <td className="py-2 pr-4 text-right" style={i.qty <= i.reorderLevel ? { color: "var(--danger)" } : undefined}>{i.qty}</td>
                    <td className="py-2 pr-4 text-right text-textMuted">{money(i.unitCost)}</td>
                    <td className="py-2 pr-4 text-right text-text">{money(i.qty * i.unitCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {items.length === 0 && <Empty>No inventory yet.</Empty>}
      <InventoryModal open={open} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); load(); }} />
    </div>
  );
}

function InventoryModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ category: "", subcategory: "", name: "", qty: 0, unitCost: 0, reorderLevel: 0 });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: keyof typeof f, v: string | number) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    setErr("");
    if (!f.name || !f.category) return setErr("Category and item name required.");
    setSaving(true);
    try {
      await api.append(TABS.inventory, { id: uid("I-"), ...f });
      onSaved(); setF({ category: "", subcategory: "", name: "", qty: 0, unitCost: 0, reorderLevel: 0 });
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add inventory item">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div><span className="label">Category</span><input className="input" value={f.category} onChange={(e) => set("category", e.target.value)} placeholder="Chemicals" /></div>
          <div><span className="label">Subcategory</span><input className="input" value={f.subcategory} onChange={(e) => set("subcategory", e.target.value)} placeholder="Wax" /></div>
        </div>
        <div><span className="label">Item name</span><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} /></div>
        <div className="grid grid-cols-3 gap-2">
          <div><span className="label">Qty</span><input type="number" className="input" value={f.qty || ""} onChange={(e) => set("qty", parseFloat(e.target.value) || 0)} /></div>
          <div><span className="label">Unit cost</span><input type="number" className="input" value={f.unitCost || ""} onChange={(e) => set("unitCost", parseFloat(e.target.value) || 0)} /></div>
          <div><span className="label">Reorder at</span><input type="number" className="input" value={f.reorderLevel || ""} onChange={(e) => set("reorderLevel", parseFloat(e.target.value) || 0)} /></div>
        </div>
        {err && <Banner kind="error">{err}</Banner>}
        <button className="btn-primary w-full" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save item"}</button>
      </div>
    </Modal>
  );
}

// ============================================================
//  ATTENDANCE (payroll basis)
// ============================================================
function AttendanceAdmin() {
  const [attendants, setAttendants] = useState<Attendant[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 14); return d.toISOString().slice(0, 10); });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  async function load() {
    setLoading(true);
    try {
      const [a, r, s] = await Promise.all([api.attendants(), api.attendance(), api.sales()]);
      setAttendants(a); setRecords(r); setSales(s);
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  if (loading) return <Spinner />;
  if (err) return <Banner kind="error">{err}</Banner>;

  const periodRecords = records.filter((r) => r.date >= from && r.date <= to);
  const periodSales = sales.filter((s) => s.datetime.slice(0, 10) >= from && s.datetime.slice(0, 10) <= to);

  const payroll = attendants.map((a) => {
    const recs = periodRecords.filter((r) => r.attendantId === a.id);
    const hours = recs.reduce((sum, r) => sum + r.hours, 0);
    const daysPresent = new Set(recs.map((r) => r.date)).size;
    const base = a.payType === "hourly" ? hours * a.baseRate : daysPresent * a.baseRate;
    const commission = attendantCommission(periodSales, a.id);
    const tips = attendantTips(periodSales, a.id);
    return { a, hours, daysPresent, base, commission, tips, gross: base + commission + tips };
  });

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
              <th className="py-2 pr-4">Attendant</th><th className="py-2 pr-4">Days</th>
              <th className="py-2 pr-4">Hours</th><th className="py-2 pr-4 text-right">Base</th>
              <th className="py-2 pr-4 text-right">Commission</th><th className="py-2 pr-4 text-right">Tips</th>
              <th className="py-2 pr-4 text-right">Gross pay</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {payroll.map(({ a, hours, daysPresent, base, commission, tips, gross }) => (
                <tr key={a.id}>
                  <td className="py-2 pr-4 text-text">{a.name}<span className="ml-2 text-xs text-textMuted">{a.role}</span></td>
                  <td className="py-2 pr-4 text-textMuted">{daysPresent}</td>
                  <td className="py-2 pr-4 text-textMuted">{hours.toFixed(1)}</td>
                  <td className="py-2 pr-4 text-right text-textMuted">{money(base)}</td>
                  <td className="py-2 pr-4 text-right text-textMuted">{money(commission)}</td>
                  <td className="py-2 pr-4 text-right text-textMuted">{money(tips)}</td>
                  <td className="py-2 pr-4 text-right font-semibold" style={{ color: "var(--primary)" }}>{money(gross)}</td>
                </tr>
              ))}
              {payroll.length === 0 && <tr><td colSpan={7} className="py-4 text-center text-textMuted">No attendants.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============================================================
//  COMMISSION RATES (% per service)
// ============================================================
function CommissionAdmin() {
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
      <p className="mb-4 text-sm text-textMuted">
        Default is {branding.defaultCommissionRate}%. Override per service below — changes save to the sheet instantly.
      </p>
      <div className="space-y-2">
        {services.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-lg border border-border bg-bg p-3">
            <div>
              <span className="text-sm font-medium text-text">{s.name}</span>
              <span className="ml-2 text-xs text-textMuted">{s.category} · {money(s.price)}</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number" min={0} max={100}
                className="input w-20 text-right"
                defaultValue={s.commissionRate}
                onBlur={(e) => {
                  const v = parseFloat(e.target.value) || 0;
                  if (v !== s.commissionRate) setRate(s, v);
                }}
              />
              <span className="text-sm text-textMuted">%</span>
              <span className="w-20 text-right text-xs" style={{ color: "var(--primary)" }}>
                {savingId === s.id ? "saving…" : money((s.price * s.commissionRate) / 100)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
//  BOOKINGS (admin overview)
// ============================================================
function BookingsAdmin() {
  const [bookings, setBookings] = useState<import("@/lib/types").Booking[]>([]);
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

  if (loading) return <Spinner />;
  if (err) return <Banner kind="error">{err}</Banner>;

  const upcoming = bookings
    .filter((b) => b.status !== "cancelled")
    .sort((a, b) => a.datetime.localeCompare(b.datetime));
  const attName = (id: string) => attendants.find((a) => a.id === id)?.name ?? "Unassigned";

  return (
    <div className="panel p-5">
      <SectionTitle>All bookings</SectionTitle>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase tracking-wide text-textMuted">
            <th className="py-2 pr-4">When</th><th className="py-2 pr-4">Customer</th>
            <th className="py-2 pr-4">Vehicle</th><th className="py-2 pr-4">Attendant</th>
            <th className="py-2 pr-4">Status</th>
          </tr></thead>
          <tbody className="divide-y divide-border">
            {upcoming.map((b) => (
              <tr key={b.id}>
                <td className="py-2 pr-4 text-textMuted">{new Date(b.datetime).toLocaleString(branding.locale, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                <td className="py-2 pr-4 text-text">{b.customer}</td>
                <td className="py-2 pr-4 text-textMuted">{b.vehicle || "—"}</td>
                <td className="py-2 pr-4 text-textMuted">{attName(b.attendantId)}</td>
                <td className="py-2 pr-4"><span className="chip capitalize">{b.status.replace("_", " ")}</span></td>
              </tr>
            ))}
            {upcoming.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-textMuted">No bookings.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
