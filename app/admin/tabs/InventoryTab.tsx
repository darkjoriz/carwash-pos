"use client";
import { useEffect, useMemo, useState } from "react";
import { api, uid } from "@/lib/client";
import { TABS } from "@/lib/tabs";
import { computeInventoryStatus, money } from "@/lib/data";
import type { InventoryItem, StockMovement, InventoryStatus, Service, Recipe } from "@/lib/types";
import { Spinner, Banner, Stat, SectionTitle, Modal, Empty } from "@/components/ui/primitives";
import { DocUpload } from "@/components/Capture";

const UNITS = ["ml", "L", "g", "kg", "pcs"];

export function InventoryTab() {
  const [view, setView] = useState<"stock" | "movements" | "recipes">("stock");
  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-xl border border-border bg-surface p-1 w-fit">
        {([["stock", "Stock"], ["movements", "Movement log"], ["recipes", "Usage recipes"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setView(id)}
            className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${view === id ? "bg-primary text-primaryText" : "text-textMuted hover:text-text"}`}>{label}</button>
        ))}
      </div>
      {view === "stock" && <StockView />}
      {view === "movements" && <MovementsView />}
      {view === "recipes" && <RecipesView />}
    </div>
  );
}

// ---------- STOCK ----------
function StockView() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [adding, setAdding] = useState(false);
  const [moveItem, setMoveItem] = useState<{ item: InventoryItem; dir: "IN" | "OUT" } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [it, mv] = await Promise.all([api.inventory(), api.movements()]);
      setItems(it); setMovements(mv);
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const statuses = useMemo(() => computeInventoryStatus(items, movements), [items, movements]);
  const lowItems = statuses.filter((s) => s.low);
  const totalValue = statuses.reduce((s, x) => s + x.value, 0);

  async function remove(item: InventoryItem) {
    if (!confirm(`Delete "${item.name}"? Movement history stays in the log.`)) return;
    try { await api.remove(TABS.inventory, item.id); load(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Delete failed"); }
  }

  if (loading) return <Spinner />;
  if (err) return <Banner kind="error">{err}</Banner>;

  const byCat = statuses.reduce<Record<string, InventoryStatus[]>>((acc, s) => { (acc[s.item.category] ||= []).push(s); return acc; }, {});

  return (
    <div className="space-y-4">
      {lowItems.length > 0 && (
        <Banner kind="error">
          Low stock: {lowItems.map((s) => `${s.item.name} (${s.onHand}${s.item.unit})`).join(", ")}. Time to reorder.
        </Banner>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Items tracked" value={String(items.length)} />
        <Stat label="Low-stock items" value={String(lowItems.length)} accent={lowItems.length > 0} />
        <Stat label="Stock value" value={money(totalValue)} />
      </div>

      <SectionTitle action={<button className="btn-primary" onClick={() => setAdding(true)}>+ Add item</button>}>Inventory</SectionTitle>

      {Object.entries(byCat).map(([cat, list]) => (
        <div key={cat} className="panel p-5">
          <h3 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-textMuted">{cat}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-textMuted">
                <th className="py-2 pr-3">Item</th><th className="py-2 pr-3">On hand</th>
                <th className="py-2 pr-3">Avg/day</th><th className="py-2 pr-3">Days left</th>
                <th className="py-2 pr-3 text-right">Value</th><th className="py-2 pr-3 text-right">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {list.map((s) => (
                  <tr key={s.item.id}>
                    <td className="py-2 pr-3">
                      <span className="text-text">{s.item.name}</span>
                      {s.item.subcategory && <span className="ml-1 text-xs text-textMuted">/ {s.item.subcategory}</span>}
                    </td>
                    <td className="py-2 pr-3" style={s.low ? { color: "var(--danger)" } : { color: "var(--text)" }}>
                      {s.onHand} {s.item.unit}{s.low && " ⚠"}
                    </td>
                    <td className="py-2 pr-3 text-textMuted">{s.avgDailyUse} {s.item.unit}</td>
                    <td className="py-2 pr-3 text-textMuted">{s.daysLeft == null ? "—" : `${s.daysLeft}d`}</td>
                    <td className="py-2 pr-3 text-right text-textMuted">{money(s.value)}</td>
                    <td className="py-2 pr-3">
                      <div className="flex justify-end gap-1">
                        <button className="btn-ghost text-xs" onClick={() => setMoveItem({ item: s.item, dir: "IN" })}>+ Stock</button>
                        <button className="btn-ghost text-xs" onClick={() => setMoveItem({ item: s.item, dir: "OUT" })}>− Use</button>
                        <button className="btn-ghost text-xs" onClick={() => setEditing(s.item)}>Edit</button>
                        <button className="btn-danger text-xs" onClick={() => remove(s.item)}>Del</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {items.length === 0 && <Empty>No inventory yet.</Empty>}

      {(adding || editing) && <ItemModal item={editing} onClose={() => { setAdding(false); setEditing(null); }} onSaved={() => { setAdding(false); setEditing(null); load(); }} />}
      {moveItem && <MoveModal item={moveItem.item} dir={moveItem.dir} onClose={() => setMoveItem(null)} onSaved={() => { setMoveItem(null); load(); }} />}
    </div>
  );
}

function ItemModal({ item, onClose, onSaved }: { item: InventoryItem | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    category: item?.category ?? "", subcategory: item?.subcategory ?? "", name: item?.name ?? "",
    unit: item?.unit ?? "ml", unitCost: item?.unitCost ?? 0, reorderLevel: item?.reorderLevel ?? 0,
  });
  const [openingQty, setOpeningQty] = useState(0);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: keyof typeof f, v: string | number) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    setErr("");
    if (!f.name || !f.category) return setErr("Category and item name required.");
    setSaving(true);
    try {
      const id = item?.id ?? uid("I-");
      const record = { id, ...f };
      if (item) await api.update(TABS.inventory, item.id, record);
      else {
        await api.append(TABS.inventory, record);
        if (openingQty > 0) {
          await api.append(TABS.movements, {
            id: uid("M-"), datetime: new Date().toISOString(), itemId: id, type: "IN",
            qty: openingQty, unitCost: f.unitCost, reason: "Opening stock", reference: "", receiptUrl: "",
          });
        }
      }
      onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  return (
    <Modal open onClose={onClose} title={item ? "Edit item" : "Add item"}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div><span className="label">Category</span><input className="input" value={f.category} onChange={(e) => set("category", e.target.value)} placeholder="Chemicals" /></div>
          <div><span className="label">Subcategory</span><input className="input" value={f.subcategory} onChange={(e) => set("subcategory", e.target.value)} placeholder="Soap" /></div>
        </div>
        <div><span className="label">Item name</span><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} /></div>
        <div className="grid grid-cols-3 gap-2">
          <div><span className="label">Unit</span>
            <select className="input" value={f.unit} onChange={(e) => set("unit", e.target.value)}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select>
          </div>
          <div><span className="label">Cost / unit</span><input type="number" className="input" value={f.unitCost || ""} onChange={(e) => set("unitCost", parseFloat(e.target.value) || 0)} /></div>
          <div><span className="label">Reorder at</span><input type="number" className="input" value={f.reorderLevel || ""} onChange={(e) => set("reorderLevel", parseFloat(e.target.value) || 0)} /></div>
        </div>
        {!item && <div><span className="label">Opening stock ({f.unit})</span><input type="number" className="input" value={openingQty || ""} onChange={(e) => setOpeningQty(parseFloat(e.target.value) || 0)} /></div>}
        {err && <Banner kind="error">{err}</Banner>}
        <button className="btn-primary w-full" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save item"}</button>
      </div>
    </Modal>
  );
}

function MoveModal({ item, dir, onClose, onSaved }: { item: InventoryItem; dir: "IN" | "OUT"; onClose: () => void; onSaved: () => void }) {
  const [qty, setQty] = useState(0);
  const [unitCost, setUnitCost] = useState(item.unitCost);
  const [reason, setReason] = useState(dir === "IN" ? "Purchase" : "Manual use");
  const [reference, setReference] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    setErr("");
    if (qty <= 0) return setErr("Enter a quantity.");
    setSaving(true);
    try {
      const signed = dir === "IN" ? Math.abs(qty) : -Math.abs(qty);
      await api.append(TABS.movements, {
        id: uid("M-"), datetime: new Date().toISOString(), itemId: item.id, type: dir,
        qty: signed, unitCost: dir === "IN" ? unitCost : item.unitCost, reason, reference, receiptUrl,
      });
      onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  return (
    <Modal open onClose={onClose} title={`${dir === "IN" ? "Add stock (purchase)" : "Deduct stock (usage)"} — ${item.name}`}>
      <div className="space-y-3">
        <div><span className="label">Quantity ({item.unit})</span><input type="number" className="input" value={qty || ""} onChange={(e) => setQty(parseFloat(e.target.value) || 0)} autoFocus /></div>
        {dir === "IN" && <div><span className="label">Cost per {item.unit}</span><input type="number" className="input" value={unitCost || ""} onChange={(e) => setUnitCost(parseFloat(e.target.value) || 0)} /></div>}
        <div><span className="label">Reason</span><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        <div><span className="label">Reference (PO #, supplier)</span><input className="input" value={reference} onChange={(e) => setReference(e.target.value)} /></div>
        {dir === "IN" && <DocUpload label="Receipt (optional)" value={receiptUrl} onChange={setReceiptUrl} />}
        {err && <Banner kind="error">{err}</Banner>}
        <button className="btn-primary w-full" disabled={saving} onClick={save}>{saving ? "Saving…" : dir === "IN" ? "Add to stock" : "Deduct from stock"}</button>
      </div>
    </Modal>
  );
}

// ---------- MOVEMENTS LOG ----------
function MovementsView() {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [mv, it] = await Promise.all([api.movements(), api.inventory()]);
        setMovements(mv.sort((a, b) => b.datetime.localeCompare(a.datetime))); setItems(it);
      } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <Spinner />;
  if (err) return <Banner kind="error">{err}</Banner>;
  const itemName = (id: string) => items.find((i) => i.id === id)?.name ?? id;
  const unit = (id: string) => items.find((i) => i.id === id)?.unit ?? "";

  return (
    <div className="panel p-5">
      <SectionTitle>Movement log (audit trail)</SectionTitle>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase tracking-wide text-textMuted">
            <th className="py-2 pr-3">When</th><th className="py-2 pr-3">Item</th><th className="py-2 pr-3">Type</th>
            <th className="py-2 pr-3 text-right">Qty</th><th className="py-2 pr-3">Reason</th><th className="py-2 pr-3">Ref</th>
          </tr></thead>
          <tbody className="divide-y divide-border">
            {movements.slice(0, 200).map((m) => (
              <tr key={m.id}>
                <td className="py-2 pr-3 text-textMuted">{new Date(m.datetime).toLocaleString()}</td>
                <td className="py-2 pr-3 text-text">{itemName(m.itemId)}</td>
                <td className="py-2 pr-3"><span className="chip" style={{ color: m.qty >= 0 ? "var(--success)" : "var(--warning)" }}>{m.type}</span></td>
                <td className="py-2 pr-3 text-right" style={{ color: m.qty >= 0 ? "var(--success)" : "var(--warning)" }}>{m.qty > 0 ? "+" : ""}{m.qty} {unit(m.itemId)}</td>
                <td className="py-2 pr-3 text-textMuted">{m.reason}</td>
                <td className="py-2 pr-3 text-textMuted">{m.receiptUrl ? <a href={m.receiptUrl} target="_blank" rel="noreferrer" className="underline">{m.reference || "receipt"} ↗</a> : m.reference || "—"}</td>
              </tr>
            ))}
            {movements.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-textMuted">No movements yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- RECIPES (consumption per service) ----------
function RecipesView() {
  const [services, setServices] = useState<Service[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [addFor, setAddFor] = useState<Service | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [s, i, r] = await Promise.all([api.services(), api.inventory(), api.recipes()]);
      setServices(s); setItems(i); setRecipes(r);
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function removeRecipe(r: Recipe) {
    try { await api.remove(TABS.recipes, r.id); load(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Delete failed"); }
  }

  if (loading) return <Spinner />;
  if (err) return <Banner kind="error">{err}</Banner>;
  const itemById = (id: string) => items.find((i) => i.id === id);

  return (
    <div className="space-y-4">
      <Banner kind="info">
        Define how much of each supply a service uses. When that service is sold in POS, stock is deducted automatically.
        Example: Express Wash → 50 ml Foam Shampoo.
      </Banner>
      {services.map((svc) => {
        const svcRecipes = recipes.filter((r) => r.serviceId === svc.id);
        return (
          <div key={svc.id} className="panel p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold text-text">{svc.name}</h3>
              <button className="btn-ghost text-xs" onClick={() => setAddFor(svc)}>+ Add consumable</button>
            </div>
            {svcRecipes.length === 0 ? <p className="text-xs text-textMuted">No consumables defined — this service won&apos;t deduct stock.</p> : (
              <div className="space-y-1.5">
                {svcRecipes.map((r) => {
                  const it = itemById(r.itemId);
                  return (
                    <div key={r.id} className="flex items-center justify-between rounded-lg border border-border bg-bg px-3 py-2 text-sm">
                      <span className="text-text">{it?.name ?? r.itemId}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-textMuted">{r.qtyPerService} {it?.unit ?? ""} per service</span>
                        <button className="text-textMuted hover:text-danger" onClick={() => removeRecipe(r)}>✕</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      {addFor && <RecipeModal service={addFor} items={items} onClose={() => setAddFor(null)} onSaved={() => { setAddFor(null); load(); }} />}
    </div>
  );
}

function RecipeModal({ service, items, onClose, onSaved }: { service: Service; items: InventoryItem[]; onClose: () => void; onSaved: () => void }) {
  const [itemId, setItemId] = useState(items[0]?.id ?? "");
  const [qty, setQty] = useState(0);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const unit = items.find((i) => i.id === itemId)?.unit ?? "";

  async function save() {
    setErr("");
    if (!itemId || qty <= 0) return setErr("Pick an item and amount.");
    setSaving(true);
    try {
      await api.append(TABS.recipes, { id: uid("R-"), serviceId: service.id, itemId, qtyPerService: qty });
      onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  return (
    <Modal open onClose={onClose} title={`Add consumable — ${service.name}`}>
      <div className="space-y-3">
        <div><span className="label">Inventory item</span>
          <select className="input" value={itemId} onChange={(e) => setItemId(e.target.value)}>
            {items.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
          </select>
        </div>
        <div><span className="label">Amount used per service ({unit})</span><input type="number" className="input" value={qty || ""} onChange={(e) => setQty(parseFloat(e.target.value) || 0)} /></div>
        {err && <Banner kind="error">{err}</Banner>}
        <button className="btn-primary w-full" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save"}</button>
      </div>
    </Modal>
  );
}
