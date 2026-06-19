// ============================================================
//  /api/users — server-side password hashing helper
//  POST { action:"hash", password } -> { ok, hash }
//  (Hashing must happen server-side; the crypto module is Node-only.)
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { action?: string; password?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 }); }

  if (body.action === "hash") {
    if (!body.password) return NextResponse.json({ ok: false, error: "Missing password" }, { status: 400 });
    return NextResponse.json({ ok: true, hash: hashPassword(body.password) });
  }
  return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
}
