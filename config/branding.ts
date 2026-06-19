/**
 * ============================================================
 *  BRANDING & BUSINESS CONFIG
 *  Edit this single file to re-skin the entire template.
 *  No other code changes are required to rebrand.
 * ============================================================
 */

export const branding = {
  // --- Identity ---
  businessName: "Apex Auto Spa",
  tagline: "Wash · Detail · Protect",
  // Put your logo in /public and reference it here (e.g. "/logo.svg").
  // Leave empty to show the businessName text logo.
  logoUrl: "",

  // --- Color palette (derived from futuristic dark/red automotive theme) ---
  colors: {
    bg: "#0E0F11",          // near-black charcoal
    surface: "#1A1C1F",     // graphite cards / panels
    surfaceAlt: "#2A2D31",  // brushed steel / hover
    border: "#3A3E44",      // cool gray edge
    text: "#F2F4F7",        // off-white
    textMuted: "#9AA0A8",   // muted gray
    primary: "#E11D2A",     // signal red (LED)
    primaryText: "#FFFFFF",
    primaryGlow: "#FF3B3B",  // hot red glow
    secondary: "#C7CDD4",   // chrome highlight
    success: "#3FB950",
    warning: "#D29922",
    danger: "#F85149",
  },

  // --- Locale / money ---
  currency: "PHP",
  currencySymbol: "₱",
  locale: "en-PH",

  // --- Default commission + tax (overridable per service in Admin) ---
  defaultCommissionRate: 10, // percent
  taxRate: 0,                // percent, set 12 for PH VAT if needed

  // --- Payment methods shown in POS ---
  paymentMethods: ["Cash", "Card", "GCash", "Maya", "Bank Transfer"],
} as const;

export type Branding = typeof branding;
