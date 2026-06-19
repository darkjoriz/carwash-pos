import Link from "next/link";
import { branding } from "@/config/branding";

const ROLES = [
  {
    href: "/pos",
    title: "POS",
    desc: "Ring up services, assign attendants, take payments, log tips & commission.",
  },
  {
    href: "/admin",
    title: "Admin",
    desc: "Sales & P&L, inventory, services, attendance, commission rates, bookings.",
  },
  {
    href: "/attendant",
    title: "Attendant",
    desc: "See assigned jobs, services rendered, commission, tips, and payroll.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-16">
      <div className="mb-12 text-center">
        <div
          className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl font-display text-2xl font-bold"
          style={{
            background: "var(--primary)",
            color: "var(--primary-text)",
            boxShadow: "0 0 28px -4px var(--primary-glow)",
          }}
        >
          {branding.businessName.slice(0, 1)}
        </div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-text">
          {branding.businessName}
        </h1>
        <p className="mt-2 text-sm uppercase tracking-[0.25em] text-textMuted">
          {branding.tagline}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {ROLES.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="panel group p-5 transition-all hover:-translate-y-0.5 hover:shadow-glow"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="font-display text-lg font-semibold text-text">{r.title}</span>
              <span className="text-textMuted transition-transform group-hover:translate-x-1">→</span>
            </div>
            <p className="text-sm leading-relaxed text-textMuted">{r.desc}</p>
          </Link>
        ))}
      </div>

      <div className="mt-10 text-center">
        <Link
          href="/setup"
          className="text-xs text-textMuted underline decoration-dotted underline-offset-4 hover:text-text"
        >
          First time here? Run setup →
        </Link>
        <p className="mt-3 text-xs text-textMuted">
          Standalone template · Google Sheets backend · Re-skin in{" "}
          <code className="rounded bg-surfaceAlt px-1.5 py-0.5">config/branding.ts</code>
        </p>
      </div>
    </main>
  );
}
