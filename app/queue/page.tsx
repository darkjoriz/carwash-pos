"use client";
import { useEffect, useState } from "react";
import { TopBar } from "@/components/TopBar";
import { Guard } from "@/components/Guard";
import { QueueManager } from "@/components/QueueManager";
import { SectionTitle, Banner } from "@/components/ui/primitives";

export default function QueuePage() {
  const [origin, setOrigin] = useState("");
  useEffect(() => { setOrigin(window.location.origin); }, []);
  return (
    <Guard allow={["admin", "cashier"]}>
      {(s) => (
        <>
          <TopBar role={s.role} name={s.displayName} />
          <main className="mx-auto max-w-7xl px-4 py-6">
            <SectionTitle>Queue</SectionTitle>
            {origin && (
              <div className="mb-4">
                <Banner kind="info">
                  Customer self-queue link (for a QR code at the counter):{" "}
                  <a href={`${origin}/q`} target="_blank" rel="noreferrer" className="underline">{origin}/q</a>
                </Banner>
              </div>
            )}
            <QueueManager cashierId={s.userId} />
          </main>
        </>
      )}
    </Guard>
  );
}
