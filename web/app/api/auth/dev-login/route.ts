import { NextResponse } from "next/server";

// Solo disponible en desarrollo
export async function POST() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available" }, { status: 403 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("blikon_dev_session", "1", {
    path:     "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge:   60 * 60 * 24, // 24 horas
  });
  return res;
}
