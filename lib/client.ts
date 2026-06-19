"use client";
// Client helpers to talk to the API and map to typed objects.
import {
  toUser, toService, toRecipe, toAttendant, toSale, toInventory,
  toMovement, toBooking, toAttendance, toExpense, toPayrollSettings,
} from "@/lib/data";
import { TABS } from "@/lib/tabs";
import type {
  User, Service, Recipe, Attendant, Sale, InventoryItem,
  StockMovement, Booking, AttendanceRecord, Expense, PayrollSettings,
} from "@/lib/types";

async function getTab<T>(tab: string, map: (r: Record<string, string>) => T): Promise<T[]> {
  const res = await fetch(`/api/sheets?tab=${encodeURIComponent(tab)}`, { cache: "no-store" });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "Failed to load");
  return (json.data as Record<string, string>[]).map(map);
}

async function getRows(tab: string): Promise<Record<string, string>[]> {
  const res = await fetch(`/api/sheets?tab=${encodeURIComponent(tab)}`, { cache: "no-store" });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "Failed to load");
  return json.data as Record<string, string>[];
}

export const api = {
  users: () => getTab<User>(TABS.users, toUser),
  services: () => getTab<Service>(TABS.services, toService),
  recipes: () => getTab<Recipe>(TABS.recipes, toRecipe),
  attendants: () => getTab<Attendant>(TABS.attendants, toAttendant),
  sales: () => getTab<Sale>(TABS.sales, toSale),
  inventory: () => getTab<InventoryItem>(TABS.inventory, toInventory),
  movements: () => getTab<StockMovement>(TABS.movements, toMovement),
  bookings: () => getTab<Booking>(TABS.bookings, toBooking),
  attendance: () => getTab<AttendanceRecord>(TABS.attendance, toAttendance),
  expenses: () => getTab<Expense>(TABS.expenses, toExpense),
  settings: async (): Promise<PayrollSettings> => toPayrollSettings(await getRows(TABS.settings)),

  append: async (tab: string, record: Record<string, string | number>) => {
    const res = await fetch("/api/sheets", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tab, action: "append", record }),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Save failed");
  },

  update: async (tab: string, id: string, record: Record<string, string | number>) => {
    const res = await fetch("/api/sheets", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tab, action: "update", id, record }),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Update failed");
  },

  remove: async (tab: string, id: string) => {
    const res = await fetch("/api/sheets", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tab, action: "delete", id }),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Delete failed");
  },

  // Update a single Settings key.
  setSetting: async (key: string, value: string | number) => {
    const res = await fetch("/api/sheets", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tab: TABS.settings, action: "setKey", id: key, record: { key, value } }),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Save failed");
  },

  checkout: async (sale: unknown) => {
    const res = await fetch("/api/checkout", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sale }),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Checkout failed");
    return json;
  },

  upload: async (filename: string, mimeType: string, base64: string): Promise<string> => {
    const res = await fetch("/api/upload", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename, mimeType, base64 }),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Upload failed");
    return json.link as string;
  },
};

export const auth = {
  me: async () => {
    const res = await fetch("/api/auth", { cache: "no-store" });
    const json = await res.json();
    return json.session as null | {
      userId: string; username: string; role: string;
      attendantId: string; displayName: string; exp: number;
    };
  },
  login: async (username: string, password: string) => {
    const res = await fetch("/api/auth", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "login", username, password }),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Login failed");
    return json.session;
  },
  logout: async () => {
    await fetch("/api/auth", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
  },
};

export function uid(prefix = ""): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
