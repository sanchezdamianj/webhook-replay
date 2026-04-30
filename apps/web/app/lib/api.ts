export const API_BASE_URL = "/api/core/";

export async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const url = path.startsWith("/api/") ? path : `${API_BASE_URL}${path.startsWith("/") ? path.slice(1) : path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = await res.text();
    }
    throw new Error(`API ${res.status} ${res.statusText}: ${JSON.stringify(body)}`);
  }

  return (await res.json()) as T;
}

export type MeResponse = {
  user: { id: number; email: string; ui_flags: Record<string, unknown> };
  account: { id: number; name: string };
};

export async function apiMe(): Promise<MeResponse> {
  return await apiFetch<MeResponse>("/v1/me");
}

export async function apiUpdateUiFlags(ui_flags: Record<string, unknown>) {
  return await apiFetch<{ ok: true; ui_flags: Record<string, unknown> }>("/v1/me/ui_flags", {
    method: "PATCH",
    body: JSON.stringify({ ui_flags }),
  });
}

