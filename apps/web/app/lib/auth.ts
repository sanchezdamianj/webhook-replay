// Auth is handled via httpOnly cookie set by Next route handlers under /api/auth/*.
export function getToken(): string | null {
  return null;
}

export function setToken(_token: string) {
  void _token;
}

export function clearToken() {}

