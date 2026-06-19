// ============================================================
//  /api/setup
//  GET  -> check whether env vars are present + sheet reachable
//  POST { includeDemo: boolean } -> create tabs/headers/demo data
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import { setupSheet } from "@/lib/setup";
import { sheetsClient } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export async function GET() {
  const hasEmail = !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const hasKey = !!process.env.GOOGLE_PRIVATE_KEY;
  const hasSheet = !!process.env.GOOGLE_SHEET_ID;

  if (!hasEmail || !hasKey || !hasSheet) {
    return NextResponse.json({
      ok: false,
      stage: "env",
      hasEmail,
      hasKey,
      hasSheet,
      error: "One or more environment variables are missing on the server.",
    });
  }

  // Try a lightweight call to confirm credentials + sharing work.
  try {
    const sheets = sheetsClient();
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID!,
    });
    const tabs = (meta.data.sheets ?? []).map((s) => s.properties?.title ?? "");
    return NextResponse.json({
      ok: true,
      stage: "connected",
      sheetTitle: meta.data.properties?.title ?? "",
      tabs,
    });
  } catch (err: unknown) {
    return NextResponse.json({
      ok: false,
      stage: "connect",
      error: friendly(errMsg(err)),
      raw: errMsg(err),
    });
  }
}

export async function POST(req: NextRequest) {
  let includeDemo = true;
  try {
    const body = await req.json();
    if (typeof body?.includeDemo === "boolean") includeDemo = body.includeDemo;
  } catch {
    /* default to true */
  }

  try {
    const result = await setupSheet(includeDemo);
    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: friendly(errMsg(err)), raw: errMsg(err) },
      { status: 500 }
    );
  }
}

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

// Turn common Google API errors into plain-language guidance.
function friendly(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("permission") || m.includes("403") || m.includes("forbidden")) {
    return "The robot account can't open your sheet. Did you Share the Google Sheet with the service-account email as Editor?";
  }
  if (m.includes("not found") || m.includes("404") || m.includes("unable to parse range")) {
    return "Sheet not found. Double-check the GOOGLE_SHEET_ID value matches the ID in your sheet's URL.";
  }
  if (m.includes("invalid_grant") || m.includes("decoder") || m.includes("pem") || m.includes("key")) {
    return "The private key looks malformed. Re-paste GOOGLE_PRIVATE_KEY exactly as it appears in the JSON, keeping the quotes and the \\n parts.";
  }
  if (m.includes("api has not been used") || m.includes("disabled")) {
    return "The Google Sheets API isn't enabled for your Cloud project yet. Enable it, then try again.";
  }
  return msg;
}
