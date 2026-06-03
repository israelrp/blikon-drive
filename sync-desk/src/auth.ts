const VALIDACEL_API = "https://api-authentication-v3.com.blog/api/v3";

export interface CheckCookiesResponse {
  result: boolean;
  message: string;
  access_token_is_valid: boolean;
  access_token_remaining_secs: number;
  refresh_token_is_valid: boolean;
  refresh_token_remaining_secs: number;
}

export interface ValidacelProfile {
  result: boolean;
  message: string;
  user_id: number;
  roles: string[];
  blikon_profile_id: number;
  blikon_id: string;
  user_type_id: number;
  status_id: number;
  registered_user: boolean;
  phone_number: string;
  email: string;
  email_is_confirmed: boolean;
  username: string;
  profile_name: string;
  photo: string;
  crono_code: string;
  first_name: string;
  last_name: string;
  mother_last_name: string;
}

export interface RefreshTokenResponse {
  result: boolean;
  message: string;
  blikon_id: string;
}

export async function checkCookies(): Promise<CheckCookiesResponse> {
  const res = await fetch(`${VALIDACEL_API}/cookies/check_cookies`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`check_cookies ${res.status}`);
  return res.json();
}

export async function getUserProfile(): Promise<ValidacelProfile> {
  const res = await fetch(`${VALIDACEL_API}/users`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`get_profile ${res.status}`);
  return res.json();
}

export async function refreshAccessToken(): Promise<RefreshTokenResponse> {
  const res = await fetch(`${VALIDACEL_API}/cookies/refresh_access_token`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`refresh_token ${res.status}`);
  return res.json();
}
