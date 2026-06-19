"use client";
import { useEffect, useState } from "react";
import { branding } from "@/config/branding";
import { api, uid } from "@/lib/client";
import { TABS } from "@/lib/tabs";
import { money } from "@/lib/data";
import type { Service } from "@/lib/types";
import { Spinner, Banner, SectionTitle, Modal, Empty } from "@/components/ui/primitives";

export function ServicesTab() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState<Service | null>(null);
  const [adding, setAdding] = useState(false);

  async function load() {
    setLoading(true);
    try { setServices(await api.services()); }
    catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function remove(s: Service) {
    if (!confirm(`Delete "${s.name}"? This cannot be undone.`)) return;
    try { await api.remove(TABS.services, s.id); load(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Delete failed"); }
  }

  if (loading) return <Spinner />;
  if (err) return <Banner kind="error">{err}</Banner>;

  const byCat = services.reduce<Record<string, Service[]>>((acc, s) => { (acc[s.category] ||= []).push(s); return acc; }, {});

  return (
    <div className="space-y-4">
      <SectionTitle action={<button className="btn-primary" onClick={() => setAdding(true)}>+ Add service</button>}>Service catalog</SectionTitle>
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
                <div className="mt-2 flex gap-2">
                  <button className="btn-ghost text-xs flex-1" onClick={() => setEditing(s)}>Edit</button>
                  <button className="btn-danger text-xs" onClick={() => remove(s)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {services.length === 0 && <Empty>No services yet. Add your first one.</Empty>}
      {(adding || editing) && (
        <ServiceModal service={editing} onClose={() => { setAdding(false); setEditing(null); }}
          onSaved={() => { setAdding(false); setEditing(null); load(); }} />
      )}
    </div>
  );
}

function ServiceModal({ service, onClose, onSaved }: { service: Service | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(service?.name ?? "");
  const [category, setCategory] = useState(service?.category ?? "Wash");
  const [price, setPrice] = useState(service?.price ?? 0);
  const [commissionRate, setCommissionRate] = useState<number>(service?.commissionRate ?? branding.defaultCommissionRate);
  const [durationMin, setDurationMin] = useState(service?.durationMin ?? 30);
  const [active, setActive] = useState(service?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    setErr("");
    if (!name) return setErr("Name required.");
    setSaving(true);
    try {
      const record = { id: service?.id ?? uid("SV-"), name, category, price, commissionRate, durationMin, active: String(active) };
      if (service) await api.update(TABS.services, service.id, record);
      else await api.append(TABS.services, record);
      onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  return (
    <Modal open onClose={onClose} title={service ? "Edit service" : "Add service"}>
      <div className="space-y-3">
        <div><span className="label">Name</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><span className="label">Category</span><input className="input" value={category} onChange={(e) => setCategory(e.target.value)} /></div>
          <div><span className="label">Price</span><input type="number" className="input" value={price || ""} onChange={(e) => setPrice(parseFloat(e.target.value) || 0)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><span className="label">Commission %</span><input type="number" className="input" value={commissionRate} onChange={(e) => setCommissionRate(parseFloat(e.target.value) || 0)} /></div>
          <div><span className="label">Duration (min)</span><input type="number" className="input" value={durationMin} onChange={(e) => setDurationMin(parseInt(e.target.value) || 0)} /></div>
        </div>
        <label className="flex items-center gap-2 text-sm text-text">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
          Active (shown in POS)
        </label>
        {err && <Banner kind="error">{err}</Banner>}
        <button className="btn-primary w-full" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save service"}</button>
      </div>
    </Modal>
  );
}
