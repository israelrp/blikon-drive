import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/favicon.ico"];
const IS_DEV       = process.env.NODE_ENV === "development";
const DEV_COOKIE   = "blikon_dev_session";

// El middleware corre en Edge. NO hace llamadas de red (API_URL no es fiable
// aquí) — solo verifica PRESENCIA de la cookie de sesión. La validación real
// del token la hace getSession() server-side (Node, donde API_URL sí funciona).
//
// La entrada por subdominio drive-{crono}-{path}.com.blog se resuelve en el
// server component raíz (app/page.tsx) con headers(), NO aquí: en Netlify el
// `host` del Edge no siempre es el público.
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Detrás del proxy de Netlify el host público está en x-forwarded-host.
  const host = request.headers.get("x-forwarded-host")
            ?? request.headers.get("host")
            ?? "";

  // ── Recursos estáticos y rutas API → sin auth ──────────────────────────────
  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api")
  ) {
    return NextResponse.next();
  }

  // ── Dev: cookie simulada → /login ───────────────────────────────────────────
  if (IS_DEV) {
    if (request.cookies.get(DEV_COOKIE)?.value !== "1") {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("return", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // ── Prod: sin token (ni access ni refresh) → directo a ValidaCel ────────────
  // El destino (origin) es la URL pública actual, para volver aquí tras el login.
  const hasToken = !!request.cookies.get("access_token")?.value
                || !!request.cookies.get("refresh_token")?.value;

  if (!hasToken) {
    const dest      = `https://${host}${pathname}${request.nextUrl.search}`;
    const validacel = `https://validacel.com.blog/?origin=${encodeURIComponent(dest)}`;
    const res = NextResponse.redirect(validacel);
    res.cookies.set("blikon_profile", "", { path: "/", maxAge: 0 }); // limpiar cache stale
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
