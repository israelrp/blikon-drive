import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS  = ["/login", "/favicon.ico"];
const IS_DEV        = process.env.NODE_ENV === "development";
const DEV_COOKIE    = "blikon_dev_session";
const PROFILE_COOKIE = "blikon_profile";
const API           = process.env.API_URL ?? "http://localhost:5086";

// Cache del perfil validado (minutos). Dentro de este lapso, refrescar NO
// vuelve a llamar a la red — se sirve el perfil de la cookie.
const PROFILE_TTL_SECONDS = 30 * 60;

const DEV_PROFILE = {
  blikonId:    "dev-blikon-001",
  profileName: "Dev User",
  email:       "dev@blikon.com",
  photo:       "",
  firstName:   "Dev",
  lastName:    "User",
  cronoCode:   "dev-crono-001",
  phoneNumber: "521234567890",
};

async function validateToken(accessToken: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${API}/api/auth/check`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ accessToken }),
      cache:   "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function forward(request: NextRequest, profileJson: string, setCookie: boolean) {
  const headers = new Headers(request.headers);
  headers.set("x-blikon-profile", profileJson);
  const res = NextResponse.next({ request: { headers } });
  if (setCookie) {
    res.cookies.set(PROFILE_COOKIE, profileJson, {
      path:     "/",
      httpOnly: true,
      sameSite: "lax",
      secure:   !IS_DEV,
      maxAge:   PROFILE_TTL_SECONDS,
    });
  }
  return res;
}

function toLogin(request: NextRequest, pathname: string) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("return", pathname);
  const res = NextResponse.redirect(loginUrl);
  // Limpiar el cache del perfil — sin sesión válida no debe sobrevivir
  // (evita loop: cache stale haría que /login crea que hay sesión).
  res.cookies.set(PROFILE_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host         = request.headers.get("host") ?? "";

  // ── Reescritura de subdominio drive-{cuenta}.com.blog ───────────────────────
  const driveMatch = host.match(/^drive-(.+)\.com\.blog$/);
  if (driveMatch && pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = `/folder/${driveMatch[1]}`;
    return NextResponse.rewrite(url);
  }

  // ── Recursos estáticos y rutas API → sin auth ───────────────────────────────
  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api")
  ) {
    return NextResponse.next();
  }

  // ── Dev: cookie simulada ────────────────────────────────────────────────────
  if (IS_DEV) {
    if (request.cookies.get(DEV_COOKIE)?.value !== "1") return toLogin(request, pathname);
    return forward(request, JSON.stringify(DEV_PROFILE), false);
  }

  // ── Prod: buscar cookie de sesión y validar (solo si no hay cache) ──────────
  const accessToken = request.cookies.get("access_token")?.value;
  if (!accessToken) return toLogin(request, pathname);

  // Si ya tenemos el perfil cacheado → entrar instantáneo, sin red.
  const cached = request.cookies.get(PROFILE_COOKIE)?.value;
  if (cached) return forward(request, cached, false);

  // Primera vez (o cache expirado) → validar contra el API una sola vez.
  const profile = await validateToken(accessToken);
  if (!profile) return toLogin(request, pathname);

  return forward(request, JSON.stringify(profile), true);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
