// ============================================================
//  /api/upload  — store a file in Google Drive, return its link
//  POST { filename, mimeType, base64 }
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import { uploadFile } from "@/lib/drive";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  let body: { filename?: string; mimeType?: string; base64?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 }); }

  const { filename, mimeType, base64 } = body;
  if (!filename || !mimeType || !base64) {
    return NextResponse.json({ ok: false, error: "Missing file data" }, { status: 400 });
  }

  try {
    const result = await uploadFile(filename, base64, mimeType);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload failed";
    const friendly = msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("scope")
      ? "Drive upload failed. Make sure the Drive API is enabled and the service account has Drive access."
      : msg;
    return NextResponse.json({ ok: false, error: friendly, raw: msg }, { status: 500 });
  }
}
