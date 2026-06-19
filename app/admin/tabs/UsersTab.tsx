"use client";
import { useEffect, useState } from "react";
import { api, uid } from "@/lib/client";
import { TABS } from "@/lib/tabs";
import type { User, Attendant } from "@/lib/types";
import { Spinner, Banner, SectionTitle, Modal, Empty } from "@/components/ui/primitives";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin — full access",
  cashier: "Cashier — POS + daily reports",
  attendant: "Attendant — own dashboard only",
};

export function UsersTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [attendants, setAttendants] = useState<Attendant[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState<User | null>(null);
  const [adding, setAdding] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [u, a] = await Promise.all([api.users(), api.attendants()]);
      setUsers(u); setAttendants(a);
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function remove(u: User) {
    if (!confirm(`Delete login "${u.username}"?`)) return;
    try { await api.remove(TABS.users, u.id); load(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Delete failed"); }
  }

  if (loading) return <Spinner />;
  if (err) return <Banner kind="error">{err}</Banner>;

  return (
    <div className="space-y-4">
      <Banner kind="info">Create logins and assign roles. Admins see everything; cashiers get the POS and a daily report; attendants only see their own dashboard.</Banner>
      <SectionTitle action={<button className="btn-primary" onClick={() => setAdding(true)}>+ Add user</button>}>Users &amp; roles</SectionTitle>
      <div className="panel p-5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-textMuted">
              <th className="py-2 pr-3">Username</th><th className="py-2 pr-3">Name</th><th className="py-2 pr-3">Role</th>
              <th className="py-2 pr-3">Linked attendant</th><th className="py-2 pr-3 text-right">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="py-2 pr-3 text-text">{u.username}{!u.active && <span className="chip ml-2 text-danger">off</span>}</td>
                  <td className="py-2 pr-3 text-textMuted">{u.displayName}</td>
                  <td className="py-2 pr-3"><span className="chip">{u.role}</span></td>
                  <td className="py-2 pr-3 text-textMuted">{attendants.find((a) => a.id === u.attendantId)?.name ?? "—"}</td>
                  <td className="py-2 pr-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button className="btn-ghost text-xs" onClick={() => setEditing(u)}>Edit</button>
                      <button className="btn-danger text-xs" onClick={() => remove(u)}>Del</button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan={5}><Empty>No users yet.</Empty></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {(adding || editing) && <UserModal user={editing} attendants={attendants} onClose={() => { setAdding(false); setEditing(null); }} onSaved={() => { setAdding(false); setEditing(null); load(); }} />}
    </div>
  );
}

function UserModal({ user, attendants, onClose, onSaved }: { user: User | null; attendants: Attendant[]; onClose: () => void; onSaved: () => void }) {
  const [username, setUsername] = useState(user?.username ?? "");
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [role, setRole] = useState<User["role"]>(user?.role ?? "cashier");
  const [attendantId, setAttendantId] = useState(user?.attendantId ?? "");
  const [password, setPassword] = useState("");
  const [active, setActive] = useState(user?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    setErr("");
    if (!username) return setErr("Username required.");
    if (!user && !password) return setErr("Set a password for the new user.");
    if (role === "attendant" && !attendantId) return setErr("Link this login to an attendant profile.");
    setSaving(true);
    try {
      // Hash the password server-side via the dedicated endpoint.
      let passwordHash = user?.passwordHash ?? "";
      if (password) {
        const res = await fetch("/api/users", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "hash", password }),
        });
        const j = await res.json();
        if (!j.ok) throw new Error(j.error || "Could not set password");
        passwordHash = j.hash;
      }
      const record = {
        id: user?.id ?? uid("U-"), username, passwordHash, role,
        attendantId: role === "attendant" ? attendantId : "", displayName: displayName || username, active: String(active),
      };
      if (user) await api.update(TABS.users, user.id, record);
      else await api.append(TABS.users, record);
      onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  return (
    <Modal open onClose={onClose} title={user ? "Edit user" : "Add user"}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div><span className="label">Username</span><input className="input" value={username} onChange={(e) => setUsername(e.target.value)} /></div>
          <div><span className="label">Display name</span><input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></div>
        </div>
        <div><span className="label">Role</span>
          <select className="input" value={role} onChange={(e) => setRole(e.target.value as User["role"])}>
            {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        {role === "attendant" && (
          <div><span className="label">Link to attendant profile</span>
            <select className="input" value={attendantId} onChange={(e) => setAttendantId(e.target.value)}>
              <option value="">Select…</option>
              {attendants.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        )}
        <div><span className="label">{user ? "New password (leave blank to keep)" : "Password"}</span>
          <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm text-text">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" /> Active (can sign in)
        </label>
        {err && <Banner kind="error">{err}</Banner>}
        <button className="btn-primary w-full" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save user"}</button>
      </div>
    </Modal>
  );
}
