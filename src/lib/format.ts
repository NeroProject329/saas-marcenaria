export function moneyBRLFromCents(cents: number) {
  const n = Number(cents || 0) / 100;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function parseBRLToCents(input: string | number) {
  const raw = String(input ?? "").trim();
  if (!raw) return 0;
  const normalized = raw
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.]/g, "");
  const num = Number(normalized);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100);
}

export function isoToBR(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

export function isoToDateInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function dateInputToISO(v: string) {
  if (!v) return null;
  const d = new Date(v + "T12:00:00.000Z");
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}