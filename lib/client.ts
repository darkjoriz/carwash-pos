"use client";
// Client helpers to talk to /api/sheets and map to typed objects.
import {
  toService,
  toAttendant,
  toSale,
  toInventory,
  toBooking,
  toAttendance,
  toExpense,
} from "@/lib/data";
import { TABS } from "@/lib/tabs";
import type {
  Service,
  Attendant,
  Sale,
  InventoryItem,
  Booking,
  AttendanceRecord,
  Expense,
} from "@/lib/types";

async function getTab<T>(tab: string, map: (r: Record<string, string>) => T): Promise<T[]> {
  const res = await fetch(`/api/sheets?tab=${encodeURIComponent(tab)}`, { cache: "no-store" });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "Failed to load");
  return (json.data as Record<string, string>[]).map(map);
}

export const api = {
  services: () => getTab<Service>(TABS.services, toService),
  attendants: () => getTab<Attendant>(TABS.attendants, toAttendant),
  sales: () => getTab<Sale>(TABS.sales, toSale),
  inventory: () => getTab<InventoryItem>(TABS.inventory, toInventory),
  bookings: () => getTab<Booking>(TABS.bookings, toBooking),
  attendance: () => getTab<AttendanceRecord>(TABS.attendance, toAttendance),
  expenses: () => getTab<Expense>(TABS.expenses, toExpense),

  append: async (tab: string, record: Record<string, string | number>) => {
    const res = await fetch("/api/sheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tab, action: "append", record }),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Save failed");
  },

  update: async (tab: string, id: string, record: Record<string, string | number>) => {
    const res = await fetch("/api/sheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tab, action: "update", id, record }),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Update failed");
  },
};

export function uid(prefix = ""): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
