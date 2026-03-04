import type {
  FinanceCategory,
  FinanceTransaction,
  Receivable,
  Payable,
} from "@/lib/types";
import { apiFetch } from "@/lib/api";

export type Cashflow = {
  previousBalanceCents: number;
  inCents: number;
  outCents: number;
  balanceCents: number;
};

// yyyy-mm-dd -> ISO início do dia local
export function dayStartISO(ymd: string) {
  const [y, m, d] = (ymd || "").split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
}

// yyyy-mm-dd -> ISO início do próximo dia local
export function dayNextStartISO(ymd: string) {
  const [y, m, d] = (ymd || "").split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d + 1, 0, 0, 0, 0).toISOString();
}

export function ymdToYm(ymd: string) {
  return String(ymd || "").slice(0, 7);
}

function monthLabelPt(ym: string) {
  const m = Number(String(ym).slice(5, 7));
  const names = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return names[m - 1] || ym;
}

function normalizeCategory(c: any): FinanceCategory {
  return { id: c.id, name: c.name ?? "—", type: c.type ?? null };
}

function isPaidStatus(status: any) {
  const s = String(status || "").toUpperCase();
  return s === "PAGO" || s === "PAID";
}

function normalizeReceivable(r: any): Receivable {
  const client = r.clientName || r.client?.name || "-";
  const order = r.orderCode || r.orderId || r.order?.code || r.order?.id || "-";

  const inst =
    r.installmentNumber != null
      ? `${r.installmentNumber}/${r.installmentsCount || "?"}`
      : (r.label || null);

  const paid = !!(r.paidAt || r.isPaid || isPaidStatus(r.status));

  return {
    id: r.id,
    dueDate: r.dueDate || r.dueAt || null,
    clientName: client,
    description: r.description || `Pedido ${order}${inst ? ` • ${inst}` : ""}`,
    amountCents: Number(r.amountCents || r.valueCents || 0) || 0,
    status: paid ? "PAGO" : "ABERTO",
    paidAt: r.paidAt || null,

    orderId: order,
    installmentLabel: inst || null,
  } as any;
}

function normalizePayable(r: any): Payable {
  const supplier = r.supplier?.name || r.supplierName || "-";
  const title = r.description || r.title || r.name || "-";

  const isPayable = String(r.source || "").toUpperCase() === "PAYABLE";
  const inst = isPayable && r.number != null
    ? `${r.number}${r.installmentsCount ? `/${r.installmentsCount}` : ""}`
    : (r.installmentLabel || null);

  const paid = !!r.paidAt || isPaidStatus(r.status);

  return {
    id: r.id,
    dueDate: r.dueDate || r.dueAt || null,
    supplierName: supplier,
    description: title,
    amountCents: Number(r.amountCents || r.valueCents || 0) || 0,
    status: paid ? "PAGO" : "ABERTO",
    paidAt: r.paidAt || null,
    installmentLabel: inst || null,
  } as any;
}

function normalizeTx(t: any): FinanceTransaction {
  return {
    id: t.id,
    type: (t.type || "OUT").toUpperCase(),
    name: t.name || t.title || "-",
    occurredAt: t.occurredAt || t.date || new Date().toISOString(),
    amountCents: Number(t.amountCents || 0) || 0,
    categoryId: t.categoryId || t.category?.id || null,
    categoryName: t.categoryName || t.category?.name || null,
    notes: t.notes || null,
    source: t.source || "MANUAL",
  };
}

export async function getCashflowByRange(params: {
  fromYmd: string;
  toYmd: string;
  basis?: "due" | "paid";
}): Promise<Cashflow> {
  const fromISO = dayStartISO(params.fromYmd);
  const toISO = dayNextStartISO(params.toYmd);
  if (!fromISO || !toISO) throw new Error("Período inválido.");

  const basis = (params.basis || "due") === "paid" ? "paid" : "due";

  const data = await apiFetch<any>(
    `/api/finance/cashflow?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}&basis=${encodeURIComponent(basis)}`,
    { auth: true }
  );

  const prev = Number(data?.previousBalanceCents || data?.previousCents || 0);
  const ins = Number(data?.period?.inCents || data?.inCents || data?.totalInCents || 0);
  const outs = Number(data?.period?.outCents || data?.outCents || data?.totalOutCents || 0);
  const cur = data?.currentBalanceCents;

  return {
    previousBalanceCents: prev,
    inCents: ins,
    outCents: outs,
    balanceCents: Number.isFinite(Number(cur)) ? Number(cur) : (prev + ins - outs),
  };
}

export async function listReceivablesMonth(month: string): Promise<Receivable[]> {
  const data = await apiFetch<any>(`/api/finance/receivables/month?month=${encodeURIComponent(month)}`, { auth: true });
  const items = data.items || data.receivables || data.installments || [];
  return (Array.isArray(items) ? items : []).map(normalizeReceivable);
}

export async function listPayablesMonth(month: string): Promise<Payable[]> {
  const data = await apiFetch<any>(`/api/finance/payables/month?month=${encodeURIComponent(month)}`, { auth: true });
  const items = data.items || data.payables || data.installments || [];
  return (Array.isArray(items) ? items : []).map(normalizePayable);
}

export async function listCategories(): Promise<FinanceCategory[]> {
  const data = await apiFetch<any>("/api/finance/categories", { auth: true });
  const list = data.categories || data.items || [];
  return (Array.isArray(list) ? list : []).map(normalizeCategory);
}

export async function createCategory(input: { name: string; type?: "IN" | "OUT" | null }) {
  const data = await apiFetch<any>("/api/finance/categories", {
    method: "POST",
    auth: true,
    json: { name: input.name, type: input.type || null },
  });
  return normalizeCategory(data?.category ?? data);
}

export async function listTransactions(params: {
  fromYmd: string;
  toYmd: string;
  type?: "IN" | "OUT" | "";
  categoryId?: string;
}): Promise<FinanceTransaction[]> {
  const fromISO = dayStartISO(params.fromYmd);
  const toISO = dayNextStartISO(params.toYmd);
  if (!fromISO || !toISO) throw new Error("Período inválido.");

  const qs = new URLSearchParams({
    from: fromISO,
    to: toISO,
    include: "all",
  });

  if (params.type) qs.set("type", params.type);
  if (params.categoryId) qs.set("categoryId", params.categoryId);

  const data = await apiFetch<any>(`/api/finance/transactions?${qs.toString()}`, { auth: true });
  const list = data.transactions || data.items || [];
  return (Array.isArray(list) ? list : []).map(normalizeTx);
}

export async function createTransaction(input: {
  type: "IN" | "OUT";
  name: string;
  occurredAt: string; // ISO
  amountCents: number;
  categoryId?: string | null;
  notes?: string | null;
}) {
  const data = await apiFetch<any>("/api/finance/transactions", {
    method: "POST",
    auth: true,
    json: {
      type: input.type,
      name: input.name,
      occurredAt: input.occurredAt,
      amountCents: input.amountCents,
      categoryId: input.categoryId || null,
      notes: input.notes || null,
    },
  });
  return normalizeTx(data?.transaction ?? data);
}

export async function updateTransaction(id: string, input: {
  type: "IN" | "OUT";
  name: string;
  occurredAt: string;
  amountCents: number;
  categoryId?: string | null;
  notes?: string | null;
}) {
  const data = await apiFetch<any>(`/api/finance/transactions/${id}`, {
    method: "PATCH",
    auth: true,
    json: {
      type: input.type,
      name: input.name,
      occurredAt: input.occurredAt,
      amountCents: input.amountCents,
      categoryId: input.categoryId || null,
      notes: input.notes || null,
    },
  });
  return normalizeTx(data?.transaction ?? data);
}

export async function deleteTransaction(id: string) {
  await apiFetch<any>(`/api/finance/transactions/${id}`, { method: "DELETE", auth: true });
}

export function buildMonthSeries(fromYmd: string, toYmd: string, max = 8) {
  const start = ymdToYm(fromYmd);
  const end = ymdToYm(toYmd);

  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);

  const out: string[] = [];
  let y = sy, m = sm;

  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m === 13) { m = 1; y++; }
    if (out.length > 48) break;
  }

  // se vier maior que max, pega os últimos max (mais útil visualmente)
  if (out.length > max) return out.slice(out.length - max);
  return out;
}

export async function getCashflowSeriesInCents(params: {
  fromYmd: string;
  toYmd: string;
  basis?: "due" | "paid";
  maxMonths?: number;
}) {
  const months = buildMonthSeries(params.fromYmd, params.toYmd, params.maxMonths ?? 8);
  const basis = params.basis || "due";

  const results = await Promise.all(
    months.map(async (ym) => {
      const [y, m] = ym.split("-").map(Number);
      const fromYmd = `${y}-${String(m).padStart(2, "0")}-01`;
      const toDate = new Date(y, m, 0); // último dia do mês
      const toYmd = `${y}-${String(m).padStart(2, "0")}-${String(toDate.getDate()).padStart(2, "0")}`;

      const cf = await getCashflowByRange({ fromYmd, toYmd, basis });
      return { ym, inCents: cf.inCents };
    })
  );

  return results.map((r) => ({
    label: monthLabelPt(r.ym),
    valueCents: r.inCents,
  }));
}