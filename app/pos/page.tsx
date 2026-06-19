"use client";
import { useEffect, useMemo, useState } from "react";
import { branding } from "@/config/branding";
import { api, uid } from "@/lib/client";
import { TABS } from "@/lib/tabs";
import { buildSaleLines, summarizeSale, money } from "@/lib/data";
import type { Service, Attendant, Booking } from "@/lib/types";
import { Spinner, Banner, Modal, SectionTitle } from "@/components/ui/primitives";

type CartItem = { service: Service; attendantIds: string[] };

export default function PosPage() {
  const [tab, setTab] = useState<"register" | "booking">("register");
  const [services, setServices] = useState<Service[]>([]);
  const [attendants, setAttendants] = useState<Attendant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [s, a] = await Promise.all([api.services(), api.attendants()]);
        setServices(s.filter((x) => x.active));
        setAttendants(a.filter((x) => x.active));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Spinner label="Loading register…" />;
  if (error) return <Banner kind="error">{error} — check your Google Sheets connection &amp; env vars.</Banner>;

  return (
    <div>
      <div className="mb-5 flex gap-1 rounded-xl border border-border bg-surface p-1 w-fit">
        {(["register", "booking"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
              tab === t ? "bg-primary text-primaryText" : "text-textMuted hover:text-text"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "register" ? (
        <Register services={services} attendants={attendants} />
      ) : (
        <BookingCalendar services={services} attendants={attendants} />
      )}
    </div>
  );
}

// ============================================================
//  REGISTER
// ============================================================
function Register({ services, attendants }: { services: Service[]; attendants: Attendant[] }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [tip, setTip] = useState(0);
  const [tipAttendant, setTipAttendant] = useState("");
  const [payment, setPayment] = useState<string>(branding.paymentMethods[0]);
  const [customer, setCustomer] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  const categories = useMemo(
    () => Array.from(new Set(services.map((s) => s.category))),
    [services]
  );
  const [activeCat, setActiveCat] = useState<string>(categories[0] ?? "");

  const summary = useMemo(() => {
    const lines = buildSaleLines(cart);
    return { lines, ...summarizeSale(lines, tip) };
  }, [cart, tip]);

  function addService(s: Service) {
    setCart((c) => [...c, { service: s, attendantIds: [] }]);
  }
  function removeItem(i: number) {
    setCart((c) => c.filter((_, idx) => idx !== i));
  }
  function toggleAttendant(itemIdx: number, attId: string) {
    setCart((c) =>
      c.map((item, idx) => {
        if (idx !== itemIdx) return item;
        const has = item.attendantIds.includes(attId);
        return {
          ...item,
          attendantIds: has
            ? item.attendantIds.filter((x) => x !== attId)
            : [...item.attendantIds, attId],
        };
      })
    );
  }

  async function checkout() {
    setErr("");
    if (cart.length === 0) return setErr("Add at least one service.");
    if (cart.some((i) => i.attendantIds.length === 0))
      return setErr("Assign an attendant to every service.");
    setSaving(true);
    try {
      const sale = {
        id: uid("S-"),
        datetime: new Date().toISOString(),
        lines: summary.lines,
        subtotal: summary.subtotal,
        tax: summary.tax,
        tip,
        tipAttendantId: tipAttendant,
        total: summary.total,
        paymentMethod: payment,
        commissionTotal: summary.commissionTotal,
        customer,
        vehicle,
        status: "paid" as const,
      };
      await api.append(TABS.sales, {
        id: sale.id,
        datetime: sale.datetime,
        lines: JSON.stringify(sale.lines),
        subtotal: sale.subtotal,
        tax: sale.tax,
        tip: sale.tip,
        tipAttendantId: sale.tipAttendantId,
        total: sale.total,
        paymentMethod: sale.paymentMethod,
        commissionTotal: sale.commissionTotal,
        customer: sale.customer,
        vehicle: sale.vehicle,
        status: sale.status,
      });
      setDone(true);
      setCart([]);
      setTip(0);
      setTipAttendant("");
      setCustomer("");
      setVehicle("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setSaving(false);
    }
  }

  const attName = (id: string) => attendants.find((a) => a.id === id)?.name ?? "—";

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
      {/* LEFT: services */}
      <div>
        <div className="mb-4 flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setActiveCat(c)}
              className={`chip ${activeCat === c ? "glow-active text-text" : ""}`}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {services
            .filter((s) => s.category === activeCat)
            .map((s) => (
              <button
                key={s.id}
                onClick={() => addService(s)}
                className="panel p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-glow"
              >
                <div className="font-display text-sm font-semibold text-text">{s.name}</div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-base font-semibold" style={{ color: "var(--primary)" }}>
                    {money(s.price)}
                  </span>
                  <span className="text-[11px] text-textMuted">{s.commissionRate}% comm</span>
                </div>
              </button>
            ))}
          {services.filter((s) => s.category === activeCat).length === 0 && (
            <p className="text-sm text-textMuted">No services in this category.</p>
          )}
        </div>
      </div>

      {/* RIGHT: cart */}
      <aside className="panel flex h-fit flex-col gap-4 p-5 lg:sticky lg:top-20">
        <SectionTitle>Ticket</SectionTitle>

        {cart.length === 0 && <p className="text-sm text-textMuted">Tap a service to add it.</p>}

        <div className="flex flex-col gap-3">
          {cart.map((item, i) => (
            <div key={i} className="rounded-lg border border-border bg-bg p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-text">{item.service.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm" style={{ color: "var(--primary)" }}>
                    {money(item.service.price)}
                  </span>
                  <button onClick={() => removeItem(i)} className="text-textMuted hover:text-danger">✕</button>
                </div>
              </div>
              <div className="mt-2">
                <span className="label">Attendant(s)</span>
                <div className="flex flex-wrap gap-1.5">
                  {attendants.map((a) => {
                    const on = item.attendantIds.includes(a.id);
                    return (
                      <button
                        key={a.id}
                        onClick={() => toggleAttendant(i, a.id)}
                        className={`chip ${on ? "glow-active text-text" : ""}`}
                      >
                        {a.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* customer / vehicle */}
        <div className="grid grid-cols-2 gap-2">
          <input className="input" placeholder="Customer" value={customer} onChange={(e) => setCustomer(e.target.value)} />
          <input className="input" placeholder="Vehicle / plate" value={vehicle} onChange={(e) => setVehicle(e.target.value)} />
        </div>

        {/* tip */}
        <div>
          <span className="label">Tip</span>
          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              className="input"
              value={tip || ""}
              placeholder="0.00"
              onChange={(e) => setTip(Math.max(0, parseFloat(e.target.value) || 0))}
            />
            <select className="input" value={tipAttendant} onChange={(e) => setTipAttendant(e.target.value)}>
              <option value="">Split / pool</option>
              {attendants.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* payment */}
        <div>
          <span className="label">Payment</span>
          <div className="flex flex-wrap gap-1.5">
            {branding.paymentMethods.map((p) => (
              <button
                key={p}
                onClick={() => setPayment(p)}
                className={`chip ${payment === p ? "glow-active text-text" : ""}`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* totals */}
        <div className="space-y-1.5 border-t border-border pt-3 text-sm">
          <Row label="Subtotal" value={money(summary.subtotal)} />
          {branding.taxRate > 0 && <Row label={`Tax (${branding.taxRate}%)`} value={money(summary.tax)} />}
          <Row label="Tip" value={money(tip)} />
          <Row label="Commission (preview)" value={money(summary.commissionTotal)} muted />
          <div className="flex items-center justify-between border-t border-border pt-2 text-base font-semibold">
            <span>Total</span>
            <span style={{ color: "var(--primary)" }}>{money(summary.total)}</span>
          </div>
        </div>

        {err && <Banner kind="error">{err}</Banner>}

        <button className="btn-primary w-full text-base" disabled={saving} onClick={checkout}>
          {saving ? "Processing…" : `Charge ${money(summary.total)}`}
        </button>
      </aside>

      <Modal open={done} onClose={() => setDone(false)} title="Payment recorded">
        <p className="text-sm text-textMuted">
          Sale saved to your Google Sheet. Commission and tips are now reflected in the
          attendant and admin views.
        </p>
        <button className="btn-primary mt-4 w-full" onClick={() => setDone(false)}>
          New ticket
        </button>
      </Modal>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? "text-textMuted" : "text-text"}>{label}</span>
      <span className={muted ? "text-textMuted" : "text-text"}>{value}</span>
    </div>
  );
}

// ============================================================
//  BOOKING CALENDAR (lightweight day agenda)
// ============================================================
function BookingCalendar({ services, attendants }: { services: Service[]; attendants: Attendant[] }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    setLoading(true);
    try {
      setBookings(await api.bookings());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const dayBookings = bookings
    .filter((b) => b.datetime.slice(0, 10) === date && b.status !== "cancelled")
    .sort((a, b) => a.datetime.localeCompare(b.datetime));

  // Agenda hours 7am - 8pm
  const hours = Array.from({ length: 14 }, (_, i) => 7 + i);

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <div className="panel p-5">
        <SectionTitle
          action={
            <input type="date" className="input w-auto" value={date} onChange={(e) => setDate(e.target.value)} />
          }
        >
          Day agenda
        </SectionTitle>
        {loading ? (
          <Spinner />
        ) : (
          <div className="divide-y divide-border">
            {hours.map((h) => {
              const slot = dayBookings.filter((b) => new Date(b.datetime).getHours() === h);
              return (
                <div key={h} className="flex gap-3 py-2">
                  <span className="w-14 shrink-0 pt-1 text-xs text-textMuted">
                    {h % 12 === 0 ? 12 : h % 12}:00 {h < 12 ? "AM" : "PM"}
                  </span>
                  <div className="flex flex-1 flex-wrap gap-2">
                    {slot.map((b) => (
                      <div key={b.id} className="rounded-lg border border-border bg-bg px-3 py-1.5 text-xs">
                        <span className="font-medium text-text">{b.customer}</span>
                        <span className="text-textMuted"> · {b.vehicle || "—"}</span>
                        <span className="ml-1 text-textMuted">
                          ({b.serviceIds.length} svc)
                        </span>
                      </div>
                    ))}
                    {slot.length === 0 && <span className="pt-1 text-xs text-textMuted opacity-50">—</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <aside className="panel h-fit p-5">
        <SectionTitle>New booking</SectionTitle>
        {err && <Banner kind="error">{err}</Banner>}
        <button className="btn-primary w-full" onClick={() => setOpen(true)}>+ Add booking</button>
        <p className="mt-3 text-xs text-textMuted">
          Bookings appear on the agenda and in the attendant&apos;s assigned jobs.
        </p>
      </aside>

      <NewBookingModal
        open={open}
        onClose={() => setOpen(false)}
        services={services}
        attendants={attendants}
        defaultDate={date}
        onSaved={() => { setOpen(false); load(); }}
      />
    </div>
  );
}

function NewBookingModal({
  open, onClose, services, attendants, defaultDate, onSaved,
}: {
  open: boolean; onClose: () => void;
  services: Service[]; attendants: Attendant[];
  defaultDate: string; onSaved: () => void;
}) {
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("09:00");
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [attendantId, setAttendantId] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => setDate(defaultDate), [defaultDate]);

  async function save() {
    setErr("");
    if (!customer) return setErr("Customer name required.");
    if (serviceIds.length === 0) return setErr("Select at least one service.");
    setSaving(true);
    try {
      const iso = new Date(`${date}T${time}:00`).toISOString();
      await api.append(TABS.bookings, {
        id: uid("B-"),
        datetime: iso,
        customer,
        phone,
        vehicle,
        serviceIds: serviceIds.join("|"),
        attendantId,
        status: "booked",
        notes: "",
      });
      onSaved();
      setCustomer(""); setPhone(""); setVehicle(""); setServiceIds([]); setAttendantId("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New booking">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div><span className="label">Customer</span><input className="input" value={customer} onChange={(e) => setCustomer(e.target.value)} /></div>
          <div><span className="label">Phone</span><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        </div>
        <div><span className="label">Vehicle / plate</span><input className="input" value={vehicle} onChange={(e) => setVehicle(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><span className="label">Date</span><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div><span className="label">Time</span><input type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} /></div>
        </div>
        <div>
          <span className="label">Services</span>
          <div className="flex flex-wrap gap-1.5">
            {services.map((s) => {
              const on = serviceIds.includes(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => setServiceIds((v) => on ? v.filter((x) => x !== s.id) : [...v, s.id])}
                  className={`chip ${on ? "glow-active text-text" : ""}`}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <span className="label">Assign attendant</span>
          <select className="input" value={attendantId} onChange={(e) => setAttendantId(e.target.value)}>
            <option value="">Unassigned</option>
            {attendants.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        {err && <Banner kind="error">{err}</Banner>}
        <button className="btn-primary w-full" disabled={saving} onClick={save}>
          {saving ? "Saving…" : "Save booking"}
        </button>
      </div>
    </Modal>
  );
}
