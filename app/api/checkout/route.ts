// ============================================================
//  /api/checkout — record a sale + auto-deduct inventory
//  POST { sale }  (sale already has lines, totals, etc.)
//  Server reads recipes + inventory, writes the sale row, then
//  appends OUT stock movements for each consumable used.
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import { readTable, appendRow, TABS } from "@/lib/sheets";
import { toRecipe, toInventory, saleToRow, buildConsumptionMovements } from "@/lib/data";
import type { Sale } from "@/lib/types";

export const dynamic = "force-dynamic";

function uid(prefix = ""): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export async function POST(req: NextRequest) {
  let body: { sale?: Sale };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 }); }

  const sale = body.sale;
  if (!sale || !Array.isArray(sale.lines) || sale.lines.length === 0) {
    return NextResponse.json({ ok: false, error: "Empty sale" }, { status: 400 });
  }

  try {
    // 1. Write the sale row.
    await appendRow(TABS.sales, saleToRow(sale));

    // 2. Auto-deduct inventory based on recipes.
    const [recipes, items] = await Promise.all([
      readTable(TABS.recipes).then((r) => r.map(toRecipe)),
      readTable(TABS.inventory).then((r) => r.map(toInventory)),
    ]);

    const soldServiceIds = sale.lines.map((l) => l.serviceId);
    const nameById = (id: string) =>
      sale.lines.find((l) => l.serviceId === id)?.serviceName ?? id;

    const movements = buildConsumptionMovements(
      soldServiceIds, recipes, items, sale.id, () => uid("M-"), nameById
    );

    // 3. Append each movement (sequential keeps Sheets append order clean).
    const now = new Date().toISOString();
    for (const m of movements) {
      await appendRow(TABS.movements, {
        id: m.id, datetime: now, itemId: m.itemId, type: m.type,
        qty: m.qty, unitCost: m.unitCost, reason: m.reason,
        reference: m.reference, receiptUrl: m.receiptUrl,
      });
    }

    return NextResponse.json({ ok: true, deductions: movements.length });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Checkout failed" },
      { status: 500 }
    );
  }
}
