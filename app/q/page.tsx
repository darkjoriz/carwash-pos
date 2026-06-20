"use client";
import { useEffect, useMemo, useState } from "react";
import { branding } from "@/config/branding";
import { Banner } from "@/components/ui/primitives";

type Svc = { id: string; name: string; category: string; price: number };
type Att = { id: string; name: string };

const money = (n: number) =>
  `${branding.currencySymbol}${n.toLocaleString(branding.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function SelfQueuePage() {
  const [services, setServices] = useState<Svc[]>([]);
  const [attendants, setAttendants] = useState<Att[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState("");

  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [preferred, setPreferred] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/public-menu", { cache: "no-store" });
        const j = await res.json();
        if (!j.ok) throw new Error(j.error || "Failed to load");
        setServices(j.services); setAttendants(j.attendants);
      } catch (e) { setLoadErr(e instanceof Error ? e.message : "Failed to load"); }
      finally { setLoading(false); }
    })();
  }, []);

  const categories = useMemo(() => Array.from(new Set(services.map((s) => s.category))), [services]);

  async function submit() {
    setErr("");
    if (!customer.trim()) return setErr("Please enter your name.");
    if (serviceIds.length === 0) return setErr("Please select at least one service.");
    setSubmitting(true);
    try {
      const res = await fetch("/api/queue", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "self_queue",
          entry: { customer: customer.trim(), phone: phone.trim(), vehicle: vehicle.trim(), serviceIds, preferredAttendantId: preferred },
        }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || "Could not join the queue");
      setDone(true);
    } catch (e) { setErr(e instanceof Error ? e.message : "Could not join the queue"); }
    finally { setSubmitting(false); }
  }

  if (done) {
    return (
      <main className="grid min-h-screen place-items-center px-4">
        <div className="panel w-full max-w-md p-8 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl text-2xl"
            style={{ background: "var(--primary)", color: "var(--primary-text)", boxShadow: "0 0 28px -4px var(--primary-glow)" }}>✓</div>
          <h1 className="font-display text-xl font-semibold text-text">You&apos;re in the queue!</h1>
          <p className="mt-2 text-sm text-textMuted">
            Thanks{customer ? `, ${customer.split(" ")[0]}` : ""}. Please proceed to the counter. An attendant will be assigned to your vehicle shortly.
          </p>
          <button className="btn-ghost mt-6" onClick={() => {
            setDone(false); setCustomer(""); setPhone(""); setVehicle(""); setServiceIds([]); setPreferred("");
          }}>Add another</button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl font-display text-xl font-bold"
          style={{ background: "var(--primary)", color: "var(--primary-text)", boxShadow: "0 0 24px -4px var(--primary-glow)" }}>
          {branding.businessName.slice(0, 1)}
        </div>
        <h1 className="font-display text-xl font-semibold text-text">{branding.businessName}</h1>
        <p className="text-xs uppercase tracking-[0.2em] text-textMuted">Join the queue</p>
      </div>

      {loading ? (
        <div className="grid place-items-center py-10"><span className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" /></div>
      ) : loadErr ? <Banner kind="error">{loadErr}</Banner> : (
        <div className="panel space-y-4 p-5">
          <div>
            <span className="label">Your name</span>
            <input className="input" value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Juan dela Cruz" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><span className="label">Phone (optional)</span><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <div><span className="label">Vehicle / plate</span><input className="input" value={vehicle} onChange={(e) => setVehicle(e.target.value)} /></div>
          </div>
          <div>
            <span className="label">Choose service(s)</span>
            {categories.map((cat) => (
              <div key={cat} className="mb-2">
                <p className="mb-1 text-[11px] uppercase tracking-wide text-textMuted">{cat}</p>
                <div className="flex flex-wrap gap-1.5">
                  {services.filter((s) => s.category === cat).map((s) => (
                    <button key={s.id} type="button"
                      onClick={() => setServiceIds((v) => v.includes(s.id) ? v.filter((x) => x !== s.id) : [...v, s.id])}
                      className={`chip ${serviceIds.includes(s.id) ? "glow-active text-text" : ""}`}>
                      {s.name} · {money(s.price)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div>
            <span className="label">Preferred attendant (optional)</span>
            <select className="input" value={preferred} onChange={(e) => setPreferred(e.target.value)}>
              <option value="">No preference</option>
              {attendants.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <p className="mt-1 text-xs text-textMuted">If they&apos;re busy, the next available attendant will take care of you.</p>
          </div>
          {err && <Banner kind="error">{err}</Banner>}
          <button className="btn-primary w-full text-base" disabled={submitting} onClick={submit}>
            {submitting ? "Joining…" : "Join the queue"}
          </button>
        </div>
      )}
    </main>
  );
}
