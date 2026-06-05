import { cookies } from "next/headers";

const API     = process.env.API_URL ?? "http://localhost:5086";
const IS_DEV  = process.env.NODE_ENV === "development";

// Nombre de la cookie que usamos en dev para simular la sesión
const DEV_COOKIE = "blikon_dev_session";

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

  // CRÍTICO: sin access_token NO hay sesión, aunque el cache del perfil exista.
  const accessToken = cookieStore.get("access_token")?.value;
  if (!accessToken) return null;

  // Fast-path: perfil cacheado en cookie (lo escribe /api/auth/warm) → sin red.
  const cached = cookieStore.get("blikon_profile")?.value;
  if (cached) {
    try { return mapProfile(JSON.parse(cached)); } catch { /* valida abajo */ }
  }

  // Validación real (Node runtime, API_URL fiable aquí — no en Edge/middleware).
  try {
    const res = await fetch(`${API}/api/auth/check`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ accessToken }),
      cache:   "no-store",
    });
    if (!res.ok) return null;
    return mapProfile(await res.json());
  } catch {
    return null;
  }
}

/** Lanza redirect a /login si no hay sesión. */
export async function requireSession(): Promise<UserProfile> {
  const session = await getSession();
  if (!session) {
    const { redirect } = await import("next/navigation");
    redirect("/login");
    throw new Error("unreachable");
  }
  return session;
}
