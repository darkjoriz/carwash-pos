"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { branding } from "@/config/branding";
import { TopBar } from "@/components/TopBar";
import { Spinner, Banner, SectionTitle } from "@/components/ui/primitives";

type Status =
  | { state: "checking" }
  | { state: "env"; hasEmail: boolean; hasKey: boolean; hasSheet: boolean }
  | { state: "connect"; error: string }
  | { state: "connected"; sheetTitle: string; tabs: string[] };

export default function SetupPage() {
  const [status, setStatus] = useState<Status>({ state: "checking" });
  const [running, setRunning] = useState(false);
  const [includeDemo, setIncludeDemo] = useState(true);
  const [done, setDone] = useState<null | { createdTabs: string[]; seededTabs: string[] }>(null);
  const [err, setErr] = useState("");

  async function check() {
    setStatus({ state: "checking" });
    setErr("");
    try {
      const res = await fetch("/api/setup", { cache: "no-store" });
      const j = await res.json();
      if (j.ok) setStatus({ state: "connected", sheetTitle: j.sheetTitle, tabs: j.tabs });
      else if (j.stage === "env") setStatus({ state: "env", hasEmail: j.hasEmail, hasKey: j.hasKey, hasSheet: j.hasSheet });
      else setStatus({ state: "connect", error: j.error });
    } catch {
      setStatus({ state: "connect", error: "Couldn't reach the server." });
    }
  }
  useEffect(() => { check(); }, []);

  async function initialize() {
    setRunning(true);
    setErr("");
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ includeDemo }),
      });
      const j = await res.json();
      if (!j.ok) { setErr(j.error || "Setup failed"); }
      else { setDone({ createdTabs: j.createdTabs, seededTabs: j.seededTabs }); await check(); }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Setup failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <SectionTitle>Setup &amp; connection</SectionTitle>
        <p className="mb-6 text-sm text-textMuted">
          This page checks that {branding.businessName} can talk to your Google Sheet, then
          builds all the tabs you need with one click. No spreadsheet editing required.
        </p>

        {/* STEP 1: connection check */}
        <div className="panel mb-4 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-base font-semibold text-text">1 · Connection</h3>
            <button className="btn-ghost text-xs" onClick={check} disabled={status.state === "checking"}>
              Re-check
            </button>
          </div>

          {status.state === "checking" && <Spinner label="Checking connection…" />}

          {status.state === "env" && (
            <div className="space-y-3">
              <Banner kind="error">Some environment variables are missing on Vercel.</Banner>
              <ul className="space-y-1.5 text-sm">
                <EnvRow label="GOOGLE_SERVICE_ACCOUNT_EMAIL" ok={status.hasEmail} />
                <EnvRow label="GOOGLE_PRIVATE_KEY" ok={status.hasKey} />
                <EnvRow label="GOOGLE_SHEET_ID" ok={status.hasSheet} />
              </ul>
              <p className="text-xs text-textMuted">
                Add the missing ones in Vercel → your project → Settings → Environment Variables,
                then redeploy and press Re-check.
              </p>
            </div>
          )}

          {status.state === "connect" && (
            <div className="space-y-3">
              <Banner kind="error">{status.error}</Banner>
              <p className="text-xs text-textMuted">Fix the issue above, then press Re-check.</p>
            </div>
          )}

          {status.state === "connected" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm" style={{ color: "var(--success)" }}>
                <span>●</span> Connected to “{status.sheetTitle || "your sheet"}”.
              </div>
              <p className="text-xs text-textMuted">
                Tabs found: {status.tabs.length ? status.tabs.join(", ") : "none yet"}.
              </p>
            </div>
          )}
        </div>

        {/* STEP 2: initialize */}
        <div className="panel p-5" style={{ opacity: status.state === "connected" ? 1 : 0.5 }}>
          <h3 className="mb-3 font-display text-base font-semibold text-text">2 · Build the tabs</h3>
          <p className="mb-4 text-sm text-textMuted">
            Creates the 7 tabs (Services, Attendants, Sales, Inventory, Bookings, Attendance,
            Expenses) with the right column headers. Existing data is never overwritten.
          </p>

          <label className="mb-4 flex items-center gap-2 text-sm text-text">
            <input
              type="checkbox"
              checked={includeDemo}
              onChange={(e) => setIncludeDemo(e.target.checked)}
              className="h-4 w-4 accent-[var(--primary)]"
            />
            Add sample services, attendants &amp; inventory so I can try it right away
          </label>

          {err && <div className="mb-3"><Banner kind="error">{err}</Banner></div>}

          {done ? (
            <div className="space-y-3">
              <Banner kind="info">
                Done. Created {done.createdTabs.length} tab(s)
                {done.seededTabs.length ? `, added samples to ${done.seededTabs.length}` : ""}.
              </Banner>
              <div className="rounded-lg border border-border bg-bg p-4 text-sm">
                <p className="mb-2 font-semibold text-text">Default logins (change these right away):</p>
                <ul className="space-y-1 text-textMuted">
                  <li>• Admin — username <span className="text-text">admin</span> / password <span className="text-text">admin123</span></li>
                  <li>• Cashier — username <span className="text-text">cashier</span> / password <span className="text-text">cashier123</span></li>
                  <li>• Attendant — username <span className="text-text">marco</span> / password <span className="text-text">marco123</span></li>
                </ul>
                <p className="mt-3 text-xs text-textMuted">
                  Reminder: for photo, signature, and document uploads to work, make sure the
                  <span className="text-text"> Google Drive API</span> is enabled in your Google Cloud project,
                  and that <span className="text-text">AUTH_SECRET</span> is set in your environment variables.
                </p>
              </div>
              <div className="flex gap-2">
                <Link href="/login" className="btn-primary">Go to login</Link>
                <Link href="/admin" className="btn-ghost">Open Admin</Link>
              </div>
            </div>
          ) : (
            <button
              className="btn-primary"
              disabled={running || status.state !== "connected"}
              onClick={initialize}
            >
              {running ? "Building…" : "Initialize my sheet"}
            </button>
          )}
        </div>
      </main>
    </>
  );
}

function EnvRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <li className="flex items-center justify-between rounded-lg border border-border bg-bg px-3 py-2">
      <code className="text-xs text-text">{label}</code>
      <span className="text-xs" style={{ color: ok ? "var(--success)" : "var(--danger)" }}>
        {ok ? "set ✓" : "missing ✕"}
      </span>
    </li>
  );
}
