"use client";
import { useEffect, useState } from "react";
import { api, uid } from "@/lib/client";
import { TABS } from "@/lib/tabs";
import { attendantToRow, money } from "@/lib/data";
import type { Attendant } from "@/lib/types";
import { Spinner, Banner, SectionTitle, Modal, Empty } from "@/components/ui/primitives";
import { DocUpload } from "@/components/Capture";

const BLANK: Attendant = {
  id: "", name: "", role: "Attendant", baseRate: 0, payType: "daily", otRatePerHour: 0,
  active: true, pin: "", phone: "", email: "", address: "", birthdate: "",
  emergencyContact: "", bankName: "", bankAccountName: "", bankAccountNumber: "", documentsUrl: "", notes: "",
};

export function AttendantsTab() {
  const [attendants, setAttendants] = useState<Attendant[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState<Attendant | null>(null);
  const [adding, setAdding] = useState(false);

  async function load() {
    setLoading(true);
    try { setAttendants(await api.attendants()); }
    catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function remove(a: Attendant) {
    if (!confirm(`Delete ${a.name}? Their past sales/commission stay recorded.`)) return;
    try { await api.remove(TABS.attendants, a.id); load(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Delete failed"); }
  }

  if (loading) return <Spinner />;
  if (err) return <Banner kind="error">{err}</Banner>;

  return (
    <div className="space-y-4">
      <SectionTitle action={<button className="btn-primary" onClick={() => setAdding(true)}>+ Add attendant</button>}>Attendants</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {attendants.map((a) => (
          <div key={a.id} className="panel p-4">
            <div className="flex items-center justify-between">
              <span className="font-display text-sm font-semibold text-text">{a.name}</span>
              {!a.active && <span className="chip text-danger">inactive</span>}
            </div>
            <p className="text-xs text-textMuted">{a.role}</p>
            <div className="mt-2 space-y-0.5 text-xs text-textMuted">
              <div>{money(a.baseRate)} / {a.payType === "daily" ? "day" : "hr"}{a.otRatePerHour > 0 ? ` · OT ${money(a.otRatePerHour)}/hr` : ""}</div>
              {a.phone && <div>📱 {a.phone}</div>}
              {a.bankName && <div>🏦 {a.bankName} ••{a.bankAccountNumber.slice(-4)}</div>}
              {a.documentsUrl && <a href={a.documentsUrl} target="_blank" rel="noreferrer" className="underline">Documents ↗</a>}
            </div>
            <div className="mt-3 flex gap-2">
              <button className="btn-ghost text-xs flex-1" onClick={() => setEditing(a)}>Edit</button>
              <button className="btn-danger text-xs" onClick={() => remove(a)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
      {attendants.length === 0 && <Empty>No attendants yet.</Empty>}
      {(adding || editing) && <AttendantModal attendant={editing} onClose={() => { setAdding(false); setEditing(null); }} onSaved={() => { setAdding(false); setEditing(null); load(); }} />}
    </div>
  );
}

function AttendantModal({ attendant, onClose, onSaved }: { attendant: Attendant | null; onClose: () => void; onSaved: () => void }) {
  const [a, setA] = useState<Attendant>(attendant ?? { ...BLANK });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const set = <K extends keyof Attendant>(k: K, v: Attendant[K]) => setA((p) => ({ ...p, [k]: v }));

  async function save() {
    setErr("");
    if (!a.name) return setErr("Name required.");
    setSaving(true);
    try {
      const id = attendant?.id ?? uid("AT-");
      const record = attendantToRow({ ...a, id });
      if (attendant) await api.update(TABS.attendants, attendant.id, record);
      else await api.append(TABS.attendants, record);
      onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  return (
    <Modal open onClose={onClose} title={attendant ? "Edit attendant" : "Add attendant"}>
      <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-2">
          <div><span className="label">Name</span><input className="input" value={a.name} onChange={(e) => set("name", e.target.value)} /></div>
          <div><span className="label">Job title</span><input className="input" value={a.role} onChange={(e) => set("role", e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div><span className="label">Base pay</span><input type="number" className="input" value={a.baseRate || ""} onChange={(e) => set("baseRate", parseFloat(e.target.value) || 0)} /></div>
          <div><span className="label">Pay type</span>
            <select className="input" value={a.payType} onChange={(e) => set("payType", e.target.value as Attendant["payType"])}>
              <option value="daily">daily</option><option value="hourly">hourly</option>
            </select>
          </div>
          <div><span className="label">OT /hr (0=default)</span><input type="number" className="input" value={a.otRatePerHour || ""} onChange={(e) => set("otRatePerHour", parseFloat(e.target.value) || 0)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><span className="label">Phone</span><input className="input" value={a.phone} onChange={(e) => set("phone", e.target.value)} /></div>
          <div><span className="label">Email</span><input className="input" value={a.email} onChange={(e) => set("email", e.target.value)} /></div>
        </div>
        <div><span className="label">Address</span><input className="input" value={a.address} onChange={(e) => set("address", e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><span className="label">Birthdate</span><input type="date" className="input" value={a.birthdate} onChange={(e) => set("birthdate", e.target.value)} /></div>
          <div><span className="label">Emergency contact</span><input className="input" value={a.emergencyContact} onChange={(e) => set("emergencyContact", e.target.value)} /></div>
        </div>
        <div className="border-t border-border pt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-textMuted">Bank details (payroll)</p>
          <div className="grid grid-cols-3 gap-2">
            <div><span className="label">Bank</span><input className="input" value={a.bankName} onChange={(e) => set("bankName", e.target.value)} /></div>
            <div><span className="label">Account name</span><input className="input" value={a.bankAccountName} onChange={(e) => set("bankAccountName", e.target.value)} /></div>
            <div><span className="label">Account #</span><input className="input" value={a.bankAccountNumber} onChange={(e) => set("bankAccountNumber", e.target.value)} /></div>
          </div>
        </div>
        <DocUpload label="Requirement documents (ID, contract, etc.)" value={a.documentsUrl} onChange={(link) => set("documentsUrl", link)} />
        <div><span className="label">Notes</span><input className="input" value={a.notes} onChange={(e) => set("notes", e.target.value)} /></div>
        <label className="flex items-center gap-2 text-sm text-text">
          <input type="checkbox" checked={a.active} onChange={(e) => set("active", e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" /> Active
        </label>
        {err && <Banner kind="error">{err}</Banner>}
        <button className="btn-primary w-full" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save attendant"}</button>
      </div>
    </Modal>
  );
}
