"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { branding } from "@/config/branding";
import { auth } from "@/lib/client";
import { Banner } from "@/components/ui/primitives";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setErr(""); setBusy(true);
    try {
      const session = await auth.login(username, password);
      // route by role
      if (session.role === "admin") router.push("/admin");
      else if (session.role === "cashier") router.push("/pos");
      else router.push("/attendant");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Login failed");
    } finally { setBusy(false); }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="panel w-full max-w-sm p-6">
        <div className="mb-6 text-center">
          <div
            className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl font-display text-xl font-bold"
            style={{ background: "var(--primary)", color: "var(--primary-text)", boxShadow: "0 0 24px -4px var(--primary-glow)" }}
          >
            {branding.businessName.slice(0, 1)}
          </div>
          <h1 className="font-display text-xl font-semibold text-text">{branding.businessName}</h1>
          <p className="text-xs uppercase tracking-[0.2em] text-textMuted">{branding.tagline}</p>
        </div>

        <div className="space-y-3" onKeyDown={(e) => e.key === "Enter" && submit()}>
          <div>
            <span className="label">Username</span>
            <input className="input" value={username} autoFocus
              onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div>
            <span className="label">Password</span>
            <input className="input" type="password" value={password}
              onChange={(e) => setPassword(e.target.value)} />
          </div>
          {err && <Banner kind="error">{err}</Banner>}
          <button className="btn-primary w-full" disabled={busy} onClick={submit}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </div>
      </div>
    </main>
  );
}
