"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { branding } from "@/config/branding";
import { auth } from "@/lib/client";

const ALL_TABS = [
  { href: "/pos", label: "POS", roles: ["admin", "cashier"] },
  { href: "/queue", label: "Queue", roles: ["admin", "cashier"] },
  { href: "/admin", label: "Admin", roles: ["admin"] },
  { href: "/reports", label: "Reports", roles: ["cashier"] },
  { href: "/attendant", label: "My Dashboard", roles: ["attendant", "admin"] },
];

export function TopBar({ role, name }: { role?: string; name?: string }) {
  const path = usePathname();
  const router = useRouter();
  const tabs = ALL_TABS.filter((t) => !role || t.roles.includes(role));

  async function logout() {
    await auth.logout();
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur supports-[backdrop-filter]:bg-bg/60">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logoUrl} alt={branding.businessName} className="h-8 w-auto" />
          ) : (
            <>
              <span className="grid h-8 w-8 place-items-center rounded-lg font-display text-sm font-bold"
                style={{ background: "var(--primary)", color: "var(--primary-text)", boxShadow: "0 0 16px -3px var(--primary-glow)" }}>
                {branding.businessName.slice(0, 1)}
              </span>
              <div className="leading-tight">
                <div className="font-display text-sm font-semibold tracking-tight text-text">{branding.businessName}</div>
                <div className="text-[10px] uppercase tracking-widest text-textMuted">{branding.tagline}</div>
              </div>
            </>
          )}
        </Link>

        <div className="flex items-center gap-3">
          <nav className="flex items-center gap-1 rounded-xl border border-border bg-surface p-1">
            {tabs.map((t) => {
              const active = path?.startsWith(t.href);
              return (
                <Link key={t.href} href={t.href}
                  className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${active ? "bg-primary text-primaryText" : "text-textMuted hover:text-text"}`}
                  style={active ? { boxShadow: "0 0 14px -4px var(--primary-glow)" } : undefined}>
                  {t.label}
                </Link>
              );
            })}
          </nav>
          {name && (
            <div className="flex items-center gap-2">
              <span className="hidden text-xs text-textMuted sm:inline">{name}</span>
              <button onClick={logout} className="btn-ghost text-xs">Sign out</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
