// ============================================================
//  TAB NAMES — shared constant, no server dependencies.
//  Safe to import from both client and server code.
//  Must match the tab titles in your Google Sheet exactly.
// ============================================================
export const TABS = {
  services: "Services",
  attendants: "Attendants",
  sales: "Sales",
  inventory: "Inventory",
  bookings: "Bookings",
  attendance: "Attendance",
  expenses: "Expenses",
} as const;

export type TabName = (typeof TABS)[keyof typeof TABS];
