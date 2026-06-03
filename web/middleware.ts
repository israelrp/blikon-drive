import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS  = ["/login", "/favicon.ico"];
const IS_DEV        = process.env.NODE_ENV === "development";
const DEV_COOKIE    = "blikon_dev_session";

export function middleware(request: NextRequest) {
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

  // ── Verificar sesión ────────────────────────────────────────────────────────
  const sessionCookie = IS_DEV
    ? request.cookies.get(DEV_COOKIE)?.value === "1"
    : !!request.cookies.get("access_token")?.value;

  if (!sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("return", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
