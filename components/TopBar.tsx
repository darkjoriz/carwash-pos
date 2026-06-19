"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { branding } from "@/config/branding";

const TABS = [
  { href: "/pos", label: "POS" },
  { href: "/admin", label: "Admin" },
  { href: "/attendant", label: "Attendant" },
];

export function TopBar() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur supports-[backdrop-filter]:bg-bg/60">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-3">
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logoUrl} alt={branding.businessName} className="h-8 w-auto" />
          ) : (
            <div className="flex items-center gap-2">
              <span
                className="grid h-8 w-8 place-items-center rounded-lg font-display text-sm font-bold"
                style={{
                  background: "var(--primary)",
                  color: "var(--primary-text)",
                  boxShadow: "0 0 16px -3px var(--primary-glow)",
                }}
              >
                {branding.businessName.slice(0, 1)}
              </span>
              <div className="leading-tight">
                <div className="font-display text-sm font-semibold tracking-tight text-text">
                  {branding.businessName}
                </div>
                <div className="text-[10px] uppercase tracking-widest text-textMuted">
                  {branding.tagline}
                </div>
              </div>
            </div>
          )}
        </Link>

        <nav className="flex items-center gap-1 rounded-xl border border-border bg-surface p-1">
          {TABS.map((t) => {
            const active = path?.startsWith(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary text-primaryText"
                    : "text-textMuted hover:text-text"
                }`}
                style={active ? { boxShadow: "0 0 14px -4px var(--primary-glow)" } : undefined}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
