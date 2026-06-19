"use client";
import { useState } from "react";
import { TopBar } from "@/components/TopBar";
import { Guard } from "@/components/Guard";
import { ReportsTab } from "./tabs/ReportsTab";
import { ServicesTab } from "./tabs/ServicesTab";
import { InventoryTab } from "./tabs/InventoryTab";
import { AttendanceTab } from "./tabs/AttendanceTab";
import { AttendantsTab } from "./tabs/AttendantsTab";
import { ExpensesTab } from "./tabs/ExpensesTab";
import { UsersTab } from "./tabs/UsersTab";
import { CommissionTab, BookingsTab } from "./tabs/MiscTabs";

type Tab = "reports" | "services" | "inventory" | "attendance" | "attendants"
  | "expenses" | "commission" | "bookings" | "users";

const TABS: { id: Tab; label: string }[] = [
  { id: "reports", label: "Sales & P&L" },
  { id: "services", label: "Services" },
  { id: "inventory", label: "Inventory" },
  { id: "attendance", label: "Attendance" },
  { id: "attendants", label: "Attendants" },
  { id: "expenses", label: "Expenses" },
  { id: "commission", label: "Commission" },
  { id: "bookings", label: "Bookings" },
  { id: "users", label: "Users" },
];

export default function AdminPage() {
  return (
    <Guard allow={["admin"]}>
      {(session) => <AdminInner role={session.role} name={session.displayName} />}
    </Guard>
  );
}

function AdminInner({ role, name }: { role: string; name: string }) {
  const [tab, setTab] = useState<Tab>("reports");
  return (
    <>
      <TopBar role={role} name={name} />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-5 flex flex-wrap gap-1 rounded-xl border border-border bg-surface p-1 w-fit">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${tab === t.id ? "bg-primary text-primaryText" : "text-textMuted hover:text-text"}`}>
              {t.label}
            </button>
          ))}
        </div>
        {tab === "reports" && <ReportsTab />}
        {tab === "services" && <ServicesTab />}
        {tab === "inventory" && <InventoryTab />}
        {tab === "attendance" && <AttendanceTab />}
        {tab === "attendants" && <AttendantsTab />}
        {tab === "expenses" && <ExpensesTab />}
        {tab === "commission" && <CommissionTab />}
        {tab === "bookings" && <BookingsTab />}
        {tab === "users" && <UsersTab />}
      </main>
    </>
  );
}
