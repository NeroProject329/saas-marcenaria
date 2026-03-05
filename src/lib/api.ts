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

// cache simples em memória pra aguentar 304 caso aconteça
const memoryCache = new Map<string, any>();

function buildUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  if (!API_BASE) return path;
  return `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
}

async function readBody(res: Response) {
  const text = await res.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function getMsg(data: any, status: number, path: string) {
  return (
    (data && (data.message || data.error)) ||
    `HTTP ${status} em ${path}`
  );
}

function isTokenExpiredMessage(msg: string) {
  const m = (msg || "").toLowerCase();
  return m.includes("token expirado") || m.includes("jwt expired") || m.includes("expir");
}

function setTokenRaw(token: string) {
  // seu projeto usa localStorage token (padrão do painel)
  if (typeof window !== "undefined") {
    localStorage.setItem("token", token);
  }
}

async function tryRefreshToken(expiredToken: string): Promise<string | null> {
  try {
    const url = buildUrl("/api/auth/refresh");

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${expiredToken}`,
      },
      body: JSON.stringify({ token: expiredToken }),
      cache: "no-store",
    });

    const data = await readBody(res);
    if (!res.ok) return null;

    const newToken = data?.token;
    if (typeof newToken === "string" && newToken.length > 10) return newToken;

    return null;
  } catch {
    return null;
  }
}

async function apiFetchInternal<T = any>(
  path: string,
  opts: ApiFetchOptions,
  attempt: number
): Promise<T> {
  const url = buildUrl(path);

  const headers = new Headers(opts.headers || {});
  headers.set("Accept", "application/json");

  const hasJson = typeof opts.json !== "undefined";
  const method = (opts.method || (hasJson ? "POST" : "GET")).toUpperCase();
  const isGet = method === "GET";

  if (hasJson) headers.set("Content-Type", "application/json");

  // ✅ auth header
  let token: string | null = null;
  if (opts.auth) {
    token = getToken();
    if (!token) {
      throw new ApiError("Sem token. Faça login novamente.", 401);
    }
    headers.set("Authorization", `Bearer ${token}`);
  }

  // evita mandar props extras pro fetch (auth/json)
  const { auth, json, ...fetchOpts } = opts;

  // ✅ Por padrão, GET sem cache (mata 304)
  const cacheMode: RequestCache =
    (fetchOpts.cache as RequestCache) || (isGet ? "no-store" : "default");

  const res = await fetch(url, {
    ...fetchOpts,
    method,
    headers,
    cache: cacheMode,
    body: hasJson ? JSON.stringify(opts.json) : opts.body,
  });

  // ✅ 304 não é “erro” pra nós
  if (res.status === 304) {
    if (memoryCache.has(url)) return memoryCache.get(url) as T;
    const data304 = await readBody(res);
    return (data304 ?? null) as T;
  }

  // lê body uma vez
  const data = await readBody(res);

  // ✅ tentativa de refresh automático quando expirar
  if (res.status === 401 && opts.auth && attempt === 0) {
    const msg = getMsg(data, res.status, path);

    if (isTokenExpiredMessage(String(msg))) {
      const currentToken = token || getToken();
      if (currentToken) {
        const newToken = await tryRefreshToken(currentToken);
        if (newToken) {
          setTokenRaw(newToken);
          // retry 1x
          return apiFetchInternal<T>(path, opts, attempt + 1);
        }
      }

      // se não conseguiu renovar:
      // ✅ só desloga automático no /auth/me (mesma regra que você já tinha)
      if (path.startsWith("/api/auth/me")) {
        clearToken();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("auth:logout"));
        }
      }

      throw new ApiError(msg, res.status, data);
    }
  }

  if (!res.ok) {
    // ✅ Só desloga automaticamente se o /auth/me disser 401
    if (res.status === 401 && path.startsWith("/api/auth/me")) {
      clearToken();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("auth:logout"));
      }
    }

    const msg = getMsg(data, res.status, path);
    throw new ApiError(msg, res.status, data);
  }

  // guarda cache em memória (pra caso role 304 em algum cenário)
  if (isGet) memoryCache.set(url, data);

  return data as T;
}

export async function apiFetch<T = any>(path: string, opts: ApiFetchOptions = {}): Promise<T> {
  return apiFetchInternal<T>(path, opts, 0);
}