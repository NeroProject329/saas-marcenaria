import { apiFetch } from "@/lib/api";

type Basis = "due" | "paid";

const cache = new Map<string, any>();
const k = (name: string, obj: any) => `${name}:${JSON.stringify(obj)}`;

export async function getDashboardOverview() {
  const key = "dashboard_overview";
  if (cache.has(key)) return cache.get(key);
  const data = await apiFetch<any>("/api/dashboard/overview", { auth: true });
  cache.set(key, data);
  return data;
}

export async function getDashboardPlus(params: { endMonth: string; basis: Basis; upcomingDays: number }) {
  const key = k("dashboard_plus", params);
  if (cache.has(key)) return cache.get(key);

  const { endMonth, basis, upcomingDays } = params;
  const url =
    `/api/dashboard/plus?months=6` +
    `&endMonth=${encodeURIComponent(endMonth)}` +
    `&basis=${encodeURIComponent(basis)}` +
    `&upcomingDays=${encodeURIComponent(String(upcomingDays))}` +
    `&upcomingTake=50`;

  const data = await apiFetch<any>(url, { auth: true });
  cache.set(key, data);
  return data;
}

export async function getDre(params: { month: string; basis: Basis }) {
  const key = k("dre", params);
  if (cache.has(key)) return cache.get(key);

  const url = `/api/reports/dre?month=${encodeURIComponent(params.month)}&basis=${encodeURIComponent(params.basis)}`;
  const data = await apiFetch<any>(url, { auth: true });
  cache.set(key, data);
  return data;
}

export async function getDfc(params: { month: string }) {
  const key = k("dfc", params);
  if (cache.has(key)) return cache.get(key);

  const url = `/api/reports/dfc?month=${encodeURIComponent(params.month)}`;
  const data = await apiFetch<any>(url, { auth: true });
  cache.set(key, data);
  return data;
}

export async function getProjections(params: { startMonth: string }) {
  const key = k("proj", params);
  if (cache.has(key)) return cache.get(key);

  const url = `/api/reports/projections?months=3&startMonth=${encodeURIComponent(params.startMonth)}`;
  const data = await apiFetch<any>(url, { auth: true });
  cache.set(key, data);
  return data;
}