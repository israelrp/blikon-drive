import { cookies, headers } from "next/headers";

const API     = process.env.API_URL ?? "http://localhost:5086";
const IS_DEV  = process.env.NODE_ENV === "development";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://drive.com.blog";

// Nombre de la cookie que usamos en dev para simular la sesión
const DEV_COOKIE = "blikon_dev_session";

// A dónde se manda al usuario para autenticarse (ValidaCel) cuando /check da 401.
export function validacelLoginUrl(origin: string): string {
  return `https://validacel.com.blog/?origin=${encodeURIComponent(origin)}`;
}

export interface UserProfile {
  blikonId:    string;
  profileName: string;
  email:       string;
  photo:       string;
  firstName:   string;
  lastName:    string;
  cronoCode:   string;   // identificador único del usuario en Blikon
  phoneNumber: string;   // código de país + 10 dígitos (para folders compartidos)
}

const DEV_PROFILE: UserProfile = {
  blikonId:    "dev-blikon-001",
  profileName: "Dev User",
  email:       "dev@blikon.com",
  photo:       "",
  firstName:   "Dev",
  lastName:    "User",
  cronoCode:   "dev-crono-001",
  phoneNumber: "521234567890",
};

/**
 * Retorna el perfil del usuario autenticado o null.
 *
 * Dev:  lee cookie `blikon_dev_session`.
 *       Si está presente → DEV_PROFILE. Si no → null (redirigirá a /login).
 *
 * Prod: lee cookie `access_token` y valida con la API .NET.
 */
function mapProfile(data: Record<string, unknown>): UserProfile {
  const s = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    blikonId:    s(data.blikonId),
    profileName: s(data.profileName) || `${s(data.firstName)} ${s(data.lastName)}`.trim(),
    email:       s(data.email),
    photo:       s(data.photo),
    firstName:   s(data.firstName),
    lastName:    s(data.lastName),
    cronoCode:   s(data.cronoCode),
    phoneNumber: s(data.phoneNumber),
  };
}

export async function getSession(): Promise<UserProfile | null> {
  const cookieStore = await cookies();

  if (IS_DEV) {
    const devSession = cookieStore.get(DEV_COOKIE)?.value;
    return devSession === "1" ? DEV_PROFILE : null;
  }

  const accessToken  = cookieStore.get("access_token")?.value;
  const refreshToken = cookieStore.get("refresh_token")?.value;
  // Sin ningún token NO hay sesión (ni siquiera para refrescar).
  if (!accessToken && !refreshToken) return null;

  // Fast-path: perfil cacheado en cookie (lo escribe /api/auth/warm) → sin red.
  const cached = cookieStore.get("blikon_profile")?.value;
  if (cached) {
    try { return mapProfile(JSON.parse(cached)); } catch { /* valida abajo */ }
  }

  // Validación real con /check: obtiene el perfil; si el access_token venció lo
  // refresca; si no hay sesión válida devuelve 401. Reenviamos las cookies del
  // usuario para que el API pueda validarlas contra ValidaCel.
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
    if (!res.ok) return null;                 // 401 → sin sesión
    const data = await res.json();
    if (!data || !data.blikonId) return null; // /check puede devolver Ok(null)
    return mapProfile(data);
  } catch {
    return null;
  }
}

/** Si no hay sesión válida, redirige a ValidaCel (prod) o a /login (dev). */
export async function requireSession(): Promise<UserProfile> {
  const session = await getSession();
  if (!session) {
    const { redirect } = await import("next/navigation");
    if (IS_DEV) {
      redirect("/login");
    } else {
      // El origin debe ser la URL ACTUAL (incluye el subdominio del folder
      // drive-{crono}-{path}.com.blog), NO APP_URL fijo — si no, tras el login
      // ValidaCel devuelve a la home del drive y se pierde la carpeta.
      const h    = await headers();
      const host = h.get("x-forwarded-host") ?? h.get("host");
      const origin = host ? `https://${host}/` : APP_URL;
      redirect(validacelLoginUrl(origin));
    }
    throw new Error("unreachable");
  }
  return session;
}
