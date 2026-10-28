const TOKEN_KEY = "token";

function isExpiredJwt(token: string): boolean {
  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return true;

    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(normalized));
    const expiresAt = Number(payload?.exp);

    return !Number.isFinite(expiresAt) || expiresAt * 1000 <= Date.now();
  } catch {
    return true;
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;

    if (isExpiredJwt(token)) {
      localStorage.removeItem(TOKEN_KEY);
      return null;
    }

    return token;
  } catch {
    return null;
  }
}

export function setToken(token: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {}
}

export function clearToken() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
}
