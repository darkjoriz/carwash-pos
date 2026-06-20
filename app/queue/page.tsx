"use client";
import { TopBar } from "@/components/TopBar";
import { Guard } from "@/components/Guard";
import { QueueManager } from "@/components/QueueManager";
import { SectionTitle } from "@/components/ui/primitives";

export default function QueuePage() {
  return (
    <Guard allow={["admin", "cashier"]}>
      {(s) => (
        <>
          <TopBar role={s.role} name={s.displayName} />
          <main className="mx-auto max-w-7xl px-4 py-6">
            <SectionTitle>Queue</SectionTitle>
            <QueueManager cashierId={s.userId} />
          </main>
        </>
      )}
    </Guard>
  );
}
