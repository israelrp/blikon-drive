import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/favicon.ico"];
const IS_DEV       = process.env.NODE_ENV === "development";
const DEV_COOKIE   = "blikon_dev_session";

// El middleware corre en Edge. NO hace llamadas de red (API_URL no es fiable
// aquí) — solo verifica PRESENCIA de la cookie de sesión. La validación real
// del token la hace getSession() server-side (Node, donde API_URL sí funciona).
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host         = request.headers.get("host") ?? "";

  // ── Recursos estáticos y rutas API → sin auth ni reescritura ────────────────
  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api")
  ) {
    return NextResponse.next();
  }

  // ── Parsear subdominio drive-{cronoCode}-{folder}-{folder}.com.blog ─────────
  // Los nombres de folder no tienen guiones, así que el guión separa: el primer
  // segmento es el cronoCode (se ignora en el routing — el folder se resuelve por
  // la sesión), el resto son los niveles del path. Solo reescribe en la raíz "/".
  let rewriteTo: string | null = null;
  const driveMatch = host.match(/^drive-(.+)\.com\.blog$/);
  if (driveMatch && pathname === "/") {
    const segs = driveMatch[1].split("-").filter(Boolean);
    const folderSegs = segs.slice(1); // saltar cronoCode
    if (folderSegs.length > 0) rewriteTo = `/folder/${folderSegs.join("/")}`;
  }

  // ── Dev: cookie simulada → /login ───────────────────────────────────────────
  if (IS_DEV) {
    if (request.cookies.get(DEV_COOKIE)?.value !== "1") {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("return", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return applyRewrite(request, rewriteTo);
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

  return applyRewrite(request, rewriteTo);
}

function applyRewrite(request: NextRequest, rewriteTo: string | null) {
  if (!rewriteTo) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = rewriteTo;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
