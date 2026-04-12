import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  const opts = { path: "/", maxAge: 0 };
  response.cookies.set("g_access_token", "", opts);
  response.cookies.set("g_refresh_token", "", opts);
  response.cookies.set("g_email", "", opts);
  return response;
}
