"use client";
import { useEffect } from "react";

export function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value" style={accent ? { color: "var(--primary)" } : undefined}>
        {value}
      </span>
    </div>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="font-display text-lg font-semibold tracking-tight text-text">{children}</h2>
      {action}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="panel w-full max-w-lg p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-text">{title}</h3>
          <button onClick={onClose} className="text-textMuted hover:text-text" aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="panel grid place-items-center p-10 text-center text-sm text-textMuted">
      {children}
    </div>
  );
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 p-6 text-sm text-textMuted">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-primary" />
      {label}
    </div>
  );
}

export function Banner({ kind, children }: { kind: "error" | "info"; children: React.ReactNode }) {
  const color = kind === "error" ? "var(--danger)" : "var(--primary)";
  return (
    <div
      className="rounded-lg border px-4 py-3 text-sm"
      style={{ borderColor: `color-mix(in srgb, ${color} 40%, transparent)`, color, background: `color-mix(in srgb, ${color} 8%, transparent)` }}
    >
      {children}
    </div>
  );
}
