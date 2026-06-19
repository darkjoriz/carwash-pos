"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/client";

export interface Session {
  userId: string; username: string; role: string;
  attendantId: string; displayName: string; exp: number;
}

/**
 * Wrap a page's content. Redirects to /login if not signed in, or to the
 * user's home view if their role isn't allowed here.
 */
export function Guard({
  allow,
  children,
}: {
  allow: string[];
  children: (session: Session) => React.ReactNode;
}) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading");

  useEffect(() => {
    (async () => {
      const s = await auth.me();
      if (!s) { router.replace("/login"); return; }
      if (!allow.includes(s.role)) {
        // send them to their own home
        if (s.role === "admin") router.replace("/admin");
        else if (s.role === "cashier") router.replace("/pos");
        else router.replace("/attendant");
        setState("denied");
        return;
      }
      setSession(s);
      setState("ok");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state !== "ok" || !session) {
    return (
      <div className="grid min-h-screen place-items-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }
  return <>{children(session)}</>;
}
