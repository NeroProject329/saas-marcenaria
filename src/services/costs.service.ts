import { apiFetch } from "@/lib/api";

export type CostType = "FIXO" | "VARIAVEL";

export type SupplierMini = { id: string; name: string };

export type Cost = {
  id: string;
  name: string;
  type: CostType;
  amountCents: number;

  category: string | null;
  occurredAt: string | null;
  supplierId: string | null;
  supplierName: string | null;
  description: string | null;
  isRecurring: boolean;
};

export type CostsSummary = {
  month: string;
  workDays: number;
  totals: {
    fixedCents: number;
    variableCents: number;
    totalCents: number;
    dailyFixedCents: number;
  };
};

function normType(t: any): CostType {
  const u = String(t || "FIXO").toUpperCase();
  if (u === "VARIÁVEL") return "VARIAVEL";
  return u === "VARIAVEL" ? "VARIAVEL" : "FIXO";
}

function normalizeCost(c: any): Cost {
  return {
    id: c.id,
    name: c.name ?? "—",
    type: normType(c.type),
    amountCents: Number(c.amountCents || 0) || 0,

    category: c.category ?? null,
    occurredAt: c.occurredAt ?? null,
    supplierId: c.supplierId ?? c.supplier?.id ?? null,
    supplierName: c.supplier?.name ?? null,
    description: c.description ?? null,
    isRecurring: c.isRecurring !== false,
  };
}

export async function listCosts(month: string): Promise<Cost[]> {
  const data = await apiFetch<any>(`/api/costs?month=${encodeURIComponent(month)}`, { auth: true });
  const list = Array.isArray(data?.costs) ? data.costs : Array.isArray(data) ? data : [];
  return list.map(normalizeCost);
}

export async function getCostsSummary(month: string, workDays: number): Promise<CostsSummary> {
  const data = await apiFetch<any>(
    `/api/costs/summary?month=${encodeURIComponent(month)}&workDays=${encodeURIComponent(String(workDays))}`,
    { auth: true }
  );

  const totals = data?.totals || {};
  const summary: CostsSummary = {
    month: String(data?.month || month),
    workDays: Number(data?.workDays || workDays) || workDays,
    totals: {
      fixedCents: Number(totals.fixedCents || 0) || 0,
      variableCents: Number(totals.variableCents || 0) || 0,
      totalCents: Number(totals.totalCents || 0) || 0,
      dailyFixedCents: Number(totals.dailyFixedCents || 0) || 0,
    },
  };

  // ✅ cache igual legado (ajuda no orçamento)
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("marcenaria_costsMonth", summary.month);
      localStorage.setItem("marcenaria_workDays", String(summary.workDays));
      localStorage.setItem("marcenaria_dailyFixedCents", String(summary.totals.dailyFixedCents));
    } catch {}
  }

  return summary;
}

export async function listSuppliers(): Promise<SupplierMini[]> {
  const data = await apiFetch<any>("/api/clients", { auth: true });
  const list = Array.isArray(data) ? data : data.clients || data.items || [];
  return (Array.isArray(list) ? list : [])
    .filter((c: any) => {
      const t = String(c.type || "").toUpperCase();
      return t === "FORNECEDOR" || t === "BOTH";
    })
    .map((c: any) => ({ id: c.id, name: c.name || "Fornecedor" }));
}

export type SaveCostPayload = {
  name: string;
  type: CostType;
  amountCents: number;
  description: string | null;
  supplierId: string | null;
  occurredAt: string | null;
  category: string | null;
  isRecurring: boolean;
};

export async function createCost(payload: SaveCostPayload): Promise<Cost> {
  const data = await apiFetch<any>("/api/costs", {
    method: "POST",
    auth: true,
    json: payload,
  });
  return normalizeCost(data?.cost ?? data);
}

export async function updateCost(id: string, payload: SaveCostPayload): Promise<Cost> {
  const data = await apiFetch<any>(`/api/costs/${id}`, {
    method: "PATCH",
    auth: true,
    json: payload,
  });
  return normalizeCost(data?.cost ?? data);
}

export async function deleteCost(id: string): Promise<void> {
  await apiFetch(`/api/costs/${id}`, { method: "DELETE", auth: true });
}