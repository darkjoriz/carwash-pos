// ============================================================
//  TAB NAMES — shared constant, no server dependencies.
//  Safe to import from both client and server code.
//  Must match the tab titles in your Google Sheet exactly.
// ============================================================
export const TABS = {
  users: "Users",
  services: "Services",
  recipes: "Recipes",
  attendants: "Attendants",
  sales: "Sales",
  inventory: "Inventory",
  movements: "StockMovements",
  bookings: "Bookings",
  attendance: "Attendance",
  expenses: "Expenses",
  settings: "Settings",
} as const;

export type TabName = (typeof TABS)[keyof typeof TABS];
