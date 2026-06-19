// ============================================================
//  /api/auth  — login / logout / me
//  POST { action:"login", username, password }
//  POST { action:"logout" }
//  GET  -> current session (from cookie) or null
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import { readTable, TABS } from "@/lib/sheets";
import { toUser } from "@/lib/data";
import {
  verifyPassword, signSession, verifySession,
  SESSION_COOKIE, SESSION_TTL_MS,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ ok: true, session: null });
  const session = verifySession(token);
  return NextResponse.json({ ok: true, session });
}

export async function POST(req: NextRequest) {
  let body: { action?: string; username?: string; password?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 }); }

  if (body.action === "logout") {
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, "", { maxAge: 0, path: "/" });
    return res;
  }

  if (body.action === "login") {
    const { username, password } = body;
    if (!username || !password) {
      return NextResponse.json({ ok: false, error: "Enter username and password." }, { status: 400 });
    }
    try {
      const users = (await readTable(TABS.users)).map(toUser);
      const user = users.find(
        (u) => u.username.toLowerCase() === username.toLowerCase() && u.active
      );
      if (!user || !verifyPassword(password, user.passwordHash)) {
        return NextResponse.json({ ok: false, error: "Incorrect username or password." }, { status: 401 });
      }
      const session = {
        userId: user.id,
        username: user.username,
        role: user.role,
        attendantId: user.attendantId,
        displayName: user.displayName,
        exp: Date.now() + SESSION_TTL_MS,
      };
      const token = signSession(session);
      const res = NextResponse.json({ ok: true, session });
      res.cookies.set(SESSION_COOKIE, token, {
        httpOnly: true, sameSite: "lax", path: "/",
        maxAge: Math.floor(SESSION_TTL_MS / 1000),
        secure: process.env.NODE_ENV === "production",
      });
      return res;
    } catch (e) {
      return NextResponse.json(
        { ok: false, error: e instanceof Error ? e.message : "Login failed" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
}
