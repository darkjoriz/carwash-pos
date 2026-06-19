"use client";
import { useEffect, useMemo, useState } from "react";
import { api, uid } from "@/lib/client";
import { TABS } from "@/lib/tabs";
import { money } from "@/lib/data";
import type { Expense } from "@/lib/types";
import { Spinner, Banner, Stat, SectionTitle, Modal } from "@/components/ui/primitives";
import { DocUpload } from "@/components/Capture";

export function ExpensesTab() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState<Expense | null>(null);
  const [adding, setAdding] = useState(false);
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  async function load() {
    setLoading(true);
    try { setExpenses(await api.expenses()); }
    catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function remove(x: Expense) {
    if (!confirm("Delete this expense?")) return;
    try { await api.remove(TABS.expenses, x.id); load(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Delete failed"); }
  }

  const inRange = useMemo(() => expenses.filter((x) => x.date >= from && x.date <= to), [expenses, from, to]);
  const fixed = inRange.filter((x) => x.kind === "fixed");
  const additional = inRange.filter((x) => x.kind === "additional");
  const fixedTotal = fixed.reduce((s, x) => s + x.amount, 0);
  const addlTotal = additional.reduce((s, x) => s + x.amount, 0);

  if (loading) return <Spinner />;
  if (err) return <Banner kind="error">{err}</Banner>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div><span className="label">From</span><input type="date" className="input w-auto" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><span className="label">To</span><input type="date" className="input w-auto" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <button className="btn-primary" onClick={() => setAdding(true)}>+ Add expense</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Fixed expenses" value={money(fixedTotal)} />
        <Stat label="Additional expenses" value={money(addlTotal)} />
        <Stat label="Total" value={money(fixedTotal + addlTotal)} accent />
      </div>
      {[["Fixed expenses", fixed], ["Additional expenses", additional]].map(([title, list]) => (
        <div key={title as string} className="panel p-5">
          <SectionTitle>{title as string}</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-textMuted">
                <th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Category</th><th className="py-2 pr-3">Note</th>
                <th className="py-2 pr-3 text-right">Amount</th><th className="py-2 pr-3 text-right">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {(list as Expense[]).map((x) => (
                  <tr key={x.id}>
                    <td className="py-2 pr-3 text-textMuted">{x.date}</td>
                    <td className="py-2 pr-3 text-text">{x.category}</td>
                    <td className="py-2 pr-3 text-textMuted">{x.note}{x.receiptUrl && <> · <a href={x.receiptUrl} target="_blank" rel="noreferrer" className="underline">receipt ↗</a></>}</td>
                    <td className="py-2 pr-3 text-right text-text">{money(x.amount)}</td>
                    <td className="py-2 pr-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button className="btn-ghost text-xs" onClick={() => setEditing(x)}>Edit</button>
                        <button className="btn-danger text-xs" onClick={() => remove(x)}>Del</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {(list as Expense[]).length === 0 && <tr><td colSpan={5} className="py-3 text-center text-textMuted">None.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {(adding || editing) && <ExpenseModal expense={editing} onClose={() => { setAdding(false); setEditing(null); }} onSaved={() => { setAdding(false); setEditing(null); load(); }} />}
    </div>
  );
}

function ExpenseModal({ expense, onClose, onSaved }: { expense: Expense | null; onClose: () => void; onSaved: () => void }) {
  const [date, setDate] = useState(expense?.date ?? new Date().toISOString().slice(0, 10));
  const [kind, setKind] = useState<Expense["kind"]>(expense?.kind ?? "additional");
  const [category, setCategory] = useState(expense?.category ?? "Supplies");
  const [amount, setAmount] = useState(expense?.amount ?? 0);
  const [note, setNote] = useState(expense?.note ?? "");
  const [receiptUrl, setReceiptUrl] = useState(expense?.receiptUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    setErr("");
    if (amount <= 0) return setErr("Enter an amount.");
    setSaving(true);
    try {
      const record = { id: expense?.id ?? uid("E-"), date, kind, category, amount, note, receiptUrl };
      if (expense) await api.update(TABS.expenses, expense.id, record);
      else await api.append(TABS.expenses, record);
      onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  return (
    <Modal open onClose={onClose} title={expense ? "Edit expense" : "Add expense"}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div><span className="label">Date</span><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div><span className="label">Type</span>
            <select className="input" value={kind} onChange={(e) => setKind(e.target.value as Expense["kind"])}>
              <option value="fixed">Fixed</option><option value="additional">Additional</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><span className="label">Category</span><input className="input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Rent / Supplies / Utilities" /></div>
          <div><span className="label">Amount</span><input type="number" className="input" value={amount || ""} onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} /></div>
        </div>
        <div><span className="label">Note</span><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></div>
        <DocUpload label="Receipt / document" value={receiptUrl} onChange={setReceiptUrl} />
        {err && <Banner kind="error">{err}</Banner>}
        <button className="btn-primary w-full" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save expense"}</button>
      </div>
    </Modal>
  );
}
