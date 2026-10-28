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

async function apiFetchInternal<T = any>(
  path: string,
  opts: ApiFetchOptions
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
  return apiFetchInternal<T>(path, opts);
}
