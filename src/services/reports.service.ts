import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";

export async function getReportPack(params: { month: string; basis: "due" | "paid" }) {
  const { month, basis } = params;
  return apiFetch<any>(`/api/reports/pack?month=${encodeURIComponent(month)}&basis=${encodeURIComponent(basis)}`, {
    auth: true,
  });
}

export async function downloadReportPackPdf(params: { month: string; basis: "due" | "paid" }) {
  const base = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
  const { month, basis } = params;

  const url = `${base}/api/reports/pack.pdf?month=${encodeURIComponent(month)}&basis=${encodeURIComponent(basis)}`;
  const t = getToken();

  const res = await fetch(url, {
    method: "GET",
    headers: { ...(t ? { Authorization: `Bearer ${t}` } : {}) },
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `Erro ${res.status} ao baixar PDF.`);
  }

  return res.blob();
}