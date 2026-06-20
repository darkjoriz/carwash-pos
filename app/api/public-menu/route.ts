// ============================================================
//  /api/public-menu — minimal public data for the self-queue page
//  Returns active services and attendant first names only (no login).
//  No sensitive data is exposed (no pay, contact, bank, etc.).
// ============================================================
import { NextResponse } from "next/server";
import { readTable, TABS } from "@/lib/sheets";
import { toService, toAttendant } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [servicesRaw, attendantsRaw] = await Promise.all([
      readTable(TABS.services),
      readTable(TABS.attendants),
    ]);
    const services = servicesRaw.map(toService)
      .filter((s) => s.active)
      .map((s) => ({ id: s.id, name: s.name, category: s.category, price: s.price }));
    const attendants = attendantsRaw.map(toAttendant)
      .filter((a) => a.active)
      .map((a) => ({ id: a.id, name: (a.name || "").split(" ")[0] })); // first name only
    return NextResponse.json({ ok: true, services, attendants });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Failed to load" },
      { status: 500 }
    );
  }
}
