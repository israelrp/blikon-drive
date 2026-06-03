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
}

const DEV_PROFILE: UserProfile = {
  blikonId:    "dev-blikon-001",
  profileName: "Dev User",
  email:       "dev@blikon.com",
  photo:       "",
  firstName:   "Dev",
  lastName:    "User",
};

/**
 * Retorna el perfil del usuario autenticado o null.
 *
 * Dev:  lee cookie `blikon_dev_session`.
 *       Si está presente → DEV_PROFILE. Si no → null (redirigirá a /login).
 *
 * Prod: lee cookie `access_token` y valida con la API .NET.
 */
export async function getSession(): Promise<UserProfile | null> {
  const cookieStore = await cookies();

  if (IS_DEV) {
    const devSession = cookieStore.get(DEV_COOKIE)?.value;
    return devSession === "1" ? DEV_PROFILE : null;
  }

  const accessToken = cookieStore.get("access_token")?.value;
  if (!accessToken) return null;

  try {
    const res = await fetch(`${API}/api/auth/check`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ accessToken }),
      cache:   "no-store",
    });
    if (!res.ok) return null;

    const data = await res.json();
    return {
      blikonId:    data.blikonId    ?? "",
      profileName: data.profileName ?? `${data.firstName ?? ""} ${data.lastName ?? ""}`.trim(),
      email:       data.email       ?? "",
      photo:       data.photo       ?? "",
      firstName:   data.firstName   ?? "",
      lastName:    data.lastName    ?? "",
    };
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
