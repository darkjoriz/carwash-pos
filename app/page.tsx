"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/client";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    (async () => {
      const s = await auth.me();
      if (!s) router.replace("/login");
      else if (s.role === "admin") router.replace("/admin");
      else if (s.role === "cashier") router.replace("/pos");
      else router.replace("/attendant");
    })();
  }, [router]);
  return (
    <div className="grid min-h-screen place-items-center">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
    </div>
  );
}
