import { clearToken, getToken } from "@/lib/auth";

export class ApiError extends Error {
  status: number;
  data: any;
  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

type ApiFetchOptions = RequestInit & {
  auth?: boolean; // adiciona Authorization Bearer
  json?: any;     // body em JSON
};

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

function buildUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  if (!API_BASE) return path;
  return `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
}

export async function apiFetch<T = any>(path: string, opts: ApiFetchOptions = {}): Promise<T> {
  const url = buildUrl(path);

  const headers = new Headers(opts.headers || {});
  headers.set("Accept", "application/json");

  const hasJson = typeof opts.json !== "undefined";
  const method = (opts.method || (hasJson ? "POST" : "GET")).toUpperCase();

  if (hasJson) headers.set("Content-Type", "application/json");

  // ✅ auth header
  if (opts.auth) {
    const token = getToken();
    if (!token) {
      // não faz request sem token
      throw new ApiError("Sem token. Faça login novamente.", 401);
    }
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(url, {
    ...opts,
    method,
    headers,
    body: hasJson ? JSON.stringify(opts.json) : opts.body,
  });

  const text = await res.text().catch(() => "");
  const data = (() => {
    try {
      return text ? JSON.parse(text) : null;
    } catch {
      return text || null;
    }
  })();

  if (!res.ok) {
    // ✅ Só desloga automaticamente se o /auth/me disser 401
    if (res.status === 401 && path.startsWith("/api/auth/me")) {
      clearToken();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("auth:logout"));
      }
    }

    const msg =
      (data && (data.message || data.error)) ||
      `HTTP ${res.status} em ${path}`;

    throw new ApiError(msg, res.status, data);
  }

  return data as T;
}