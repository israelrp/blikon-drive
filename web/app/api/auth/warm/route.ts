import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const API    = process.env.API_URL ?? "http://localhost:5086";
const IS_DEV = process.env.NODE_ENV === "development";

// Valida el access_token contra el API y cachea el perfil en la cookie
// blikon_profile (TTL 30 min). El cliente lo llama una vez tras cargar para
// que los refrescos siguientes sean instantáneos (getSession lee la cookie).
export async function POST() {
  if (IS_DEV) return NextResponse.json({ ok: true });

  const cookieStore  = await cookies();
  const accessToken  = cookieStore.get("access_token")?.value;
  const refreshToken = cookieStore.get("refresh_token")?.value;
  if (!accessToken && !refreshToken) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const cookieHeader = [
      accessToken  ? `access_token=${accessToken}`   : "",
      refreshToken ? `refresh_token=${refreshToken}` : "",
    ].filter(Boolean).join("; ");

    const res = await fetch(`${API}/api/auth/check`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieHeader },
      body:    JSON.stringify({ accessToken }),
      cache:   "no-store",
    });
    if (!res.ok) return NextResponse.json({ ok: false }, { status: 401 });

    const profile = await res.json();
    if (!profile || !profile.blikonId) return NextResponse.json({ ok: false }, { status: 401 });
    const response = NextResponse.json({ ok: true });
    response.cookies.set("blikon_profile", JSON.stringify(profile), {
      path:     "/",
      httpOnly: true,
      sameSite: "lax",
      secure:   true,
      maxAge:   30 * 60,
    });
    return response;
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
