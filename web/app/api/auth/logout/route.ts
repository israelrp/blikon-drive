import { NextResponse } from "next/server";

const IS_DEV     = process.env.NODE_ENV === "development";
const DEV_COOKIE = "blikon_dev_session";

export async function POST(request: Request) {
  const returnUrl = new URL("/login", request.url).toString();
  const res       = NextResponse.redirect(returnUrl);

  if (IS_DEV) {
    // Borrar cookie de sesión dev
    res.cookies.set(DEV_COOKIE, "", { path: "/", maxAge: 0 });
  } else {
    // Expirar cookies de auth en dominio .com.blog
    for (const name of ["access_token", "refresh_token"]) {
      res.cookies.set(name, "", {
        domain:   ".com.blog",
        path:     "/",
        maxAge:   0,
        httpOnly: true,
        secure:   true,
        sameSite: "lax",
      });
    }
  }

  return res;
}
