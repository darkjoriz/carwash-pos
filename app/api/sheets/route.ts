// ============================================================
//  /api/sheets  — single endpoint for all table operations
//  GET  ?tab=Services
//  POST { tab, action:"append", record }
//  POST { tab, action:"update", id, record }
//  POST { tab, action:"delete", id }
//  POST { tab, action:"setKey", id:key, record:{key,value} }
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import {
  readTable, appendRow, updateRowById, deleteRowById, setKeyValue,
  TABS, type TabName,
} from "@/lib/sheets";

export const dynamic = "force-dynamic";

const VALID_TABS = new Set<string>(Object.values(TABS));
function isValidTab(t: string | null): t is TabName {
  return !!t && VALID_TABS.has(t);
}

export async function GET(req: NextRequest) {
  const tab = req.nextUrl.searchParams.get("tab");
  if (!isValidTab(tab)) {
    return NextResponse.json(
      { ok: false, error: `Unknown or missing tab.` }, { status: 400 }
    );
  }
  try {
    const data = await readTable(tab);
    return NextResponse.json({ ok: true, data });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: errMsg(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: {
    tab?: string; action?: string; id?: string;
    record?: Record<string, string | number>;
  };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 }); }

  const { tab, action, id, record } = body;
  if (!isValidTab(tab ?? null)) {
    return NextResponse.json({ ok: false, error: "Unknown or missing tab" }, { status: 400 });
  }

  try {
    if (action === "update") {
      if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
      if (!record) return NextResponse.json({ ok: false, error: "Missing record" }, { status: 400 });
      const ok = await updateRowById(tab as TabName, id, record);
      if (!ok) return NextResponse.json({ ok: false, error: "Record not found" }, { status: 404 });
      return NextResponse.json({ ok: true });
    }
    if (action === "delete") {
      if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
      const ok = await deleteRowById(tab as TabName, id);
      if (!ok) return NextResponse.json({ ok: false, error: "Record not found" }, { status: 404 });
      return NextResponse.json({ ok: true });
    }
    if (action === "setKey") {
      if (!record?.key) return NextResponse.json({ ok: false, error: "Missing key" }, { status: 400 });
      await setKeyValue(tab as TabName, String(record.key), String(record.value ?? ""));
      return NextResponse.json({ ok: true });
    }
    // default: append
    if (!record) return NextResponse.json({ ok: false, error: "Missing record" }, { status: 400 });
    await appendRow(tab as TabName, record);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: errMsg(err) }, { status: 500 });
  }
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : "Unknown server error";
}
