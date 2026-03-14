import { apiFetch, ApiError } from "@/lib/api";
import { getToken } from "@/lib/auth";

export type BudgetStatus = "RASCUNHO" | "ENVIADO" | "APROVADO" | "REJEITADO" | "CANCELADO";
export type DiscountType = "VALOR" | "PERCENT";
export type PayMode = "AVISTA" | "PARCELADO";

export type BudgetMaterial = {
  name: string;
  qty: number;
  unitCostCents: number;
};

export type BudgetItem = {
  id?: string;
  name: string;
  description: string | null;
  quantity: number;
  unitPriceCents: number;
  materials: BudgetMaterial[];
};

export type Budget = {
  id: string;
  status: BudgetStatus;

  clientId: string;
  client: { id: string; name: string; phone?: string | null } | null;

  createdAt: string;
  expectedDeliveryAt: string | null;

  paymentMode: PayMode;
  paymentMethod: string | null;
  installmentsCount: number | null;

  deliveryDays: number;
  dailyRateCents: number;

  profitPercent: number | null;
  cardFeePercent: number | null;

  discountType: DiscountType;
  discountCents: number;
  discountPercent: number | null;

  notes: string | null;

  totalCents: number;

  items: BudgetItem[];
};

function n(v: any, fb = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fb;
}

function normalizeBudget(b: any): Budget {
  const client = b.client
    ? { id: b.client.id, name: b.client.name ?? "—", phone: b.client.phone ?? null }
    : null;

  const itemsRaw = Array.isArray(b.items) ? b.items : [];
  const items = itemsRaw.map((it: any) => ({
    id: it.id,
    name: it.name ?? "Item",
    description: it.description ?? null,
    quantity: n(it.quantity, 1) || 1,
    unitPriceCents: n(it.unitPriceCents, 0),
    materials: (Array.isArray(it.materials) ? it.materials : []).map((m: any) => ({
      name: m.name ?? "Material",
      qty: n(m.qty, 0),
      unitCostCents: n(m.unitCostCents, 0),
    })),
  }));

  return {
    id: b.id,
    status: String(b.status || "RASCUNHO").toUpperCase(),

    clientId: b.clientId,
    client,

    createdAt: b.createdAt ?? new Date().toISOString(),
    expectedDeliveryAt: b.expectedDeliveryAt ?? null,

    paymentMode: (b.paymentMode ?? "AVISTA").toUpperCase(),
    paymentMethod: b.paymentMethod ?? null,
    installmentsCount: b.installmentsCount ?? null,

    deliveryDays: n(b.deliveryDays, 0),
    dailyRateCents: n(b.dailyRateCents, 0),

    profitPercent: b.profitPercent ?? null,
    cardFeePercent: b.cardFeePercent ?? null,

    discountType: (b.discountType ?? "VALOR").toUpperCase(),
    discountCents: n(b.discountCents, 0),
    discountPercent: b.discountPercent ?? null,

    notes: b.notes ?? null,

    totalCents: n(b.totalCents, 0),

    items,
  } as any;
}

export type SaveBudgetPayload = {
  clientId: string;
  expectedDeliveryAt: string | null;
  notes: string;

  discountCents: number;
  discountType: DiscountType;
  discountPercent: number | null;

  deliveryDays: number;
  dailyRateCents: number;

  paymentMode: PayMode;
  paymentMethod: string | null;
  installmentsCount: number;
  firstDueDate: string | null;

  profitPercent: number;
  cardFeePercent: number;

  items: Array<{
    name: string;
    description: string | null;
    quantity: number;
    unitPriceCents: number;
    materials: Array<{ name: string; qty: number; unitCostCents: number }>;
  }>;
};

export async function listBudgets(params?: { status?: string; q?: string }): Promise<Budget[]> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.q) qs.set("q", params.q);

  const data = await apiFetch<any>(`/api/budgets${qs.toString() ? `?${qs.toString()}` : ""}`, { auth: true });
  const list = data?.budgets ?? data?.items ?? data;
  return (Array.isArray(list) ? list : []).map(normalizeBudget);
}

export async function getBudget(id: string): Promise<Budget> {
  const data = await apiFetch<any>(`/api/budgets/${id}`, { auth: true });
  const b = data?.budget ?? data;
  return normalizeBudget(b);
}

/**
 * ✅ Fallback igual Orders:
 * tenta PATCH /:id/full
 * se 404 => PATCH /:id
 * se 404 => PUT /:id
 */
export async function updateBudgetFull(id: string, payload: SaveBudgetPayload): Promise<Budget> {
  try {
    const data = await apiFetch<any>(`/api/budgets/${id}/full`, { method: "PATCH", auth: true, json: payload });
    return normalizeBudget(data?.budget ?? data);
  } catch (e: any) {
    if (e instanceof ApiError && e.status === 404) {
      try {
        const data2 = await apiFetch<any>(`/api/budgets/${id}`, { method: "PATCH", auth: true, json: payload });
        return normalizeBudget(data2?.budget ?? data2);
      } catch (e2: any) {
        if (e2 instanceof ApiError && e2.status === 404) {
          const data3 = await apiFetch<any>(`/api/budgets/${id}`, { method: "PUT", auth: true, json: payload });
          return normalizeBudget(data3?.budget ?? data3);
        }
        throw e2;
      }
    }
    throw e;
  }
}

export async function createBudget(payload: SaveBudgetPayload): Promise<Budget> {
  const data = await apiFetch<any>("/api/budgets", { method: "POST", auth: true, json: payload });
  return normalizeBudget(data?.budget ?? data);
}

export async function sendBudget(id: string): Promise<void> {
  await apiFetch(`/api/budgets/${id}/send`, { method: "POST", auth: true });
}

export async function approveBudget(id: string): Promise<void> {
  await apiFetch(`/api/budgets/${id}/approve`, { method: "POST", auth: true });
}

export async function cancelBudget(id: string): Promise<void> {
  await apiFetch(`/api/budgets/${id}/cancel`, { method: "POST", auth: true });
}

export async function deleteBudget(id: string): Promise<void> {
  await apiFetch(`/api/budgets/${id}`, { method: "DELETE", auth: true });
}

/** PDF (blob) */
export async function downloadBudgetPdf(id: string): Promise<Blob> {
  const envBase = String(process.env.NEXT_PUBLIC_API_URL || "")
    .trim()
    .replace(/\/$/, "");

  const url = `${envBase}/api/budgets/${id}/pdf?download=1`;

  const t = getToken();
  if (!t) {
    throw new Error("Sem token. Faça login novamente.");
  }

  if (!envBase) {
    throw new Error(
      "NEXT_PUBLIC_API_URL não está definido no frontend."
    );
  }

  let res: Response;

  try {
    res = await fetch(url, {
      method: "GET",
      mode: "cors",
      cache: "no-store",
      headers: {
        Accept: "application/pdf",
        Authorization: `Bearer ${t}`,
      },
    });
  } catch (err: any) {
    throw new Error(
      `Falha de rede ao baixar PDF. Verifique a URL da API no frontend e o CORS do backend. URL usada: ${url}`
    );
  }

  if (!res.ok) {
    const contentType = res.headers.get("content-type") || "";
    let msg = `Erro ${res.status} ao gerar PDF`;

    try {
      if (contentType.includes("application/json")) {
        const data = await res.json();
        if (data?.message) msg = data.message;
      } else {
        const txt = await res.text();
        if (txt) msg = txt;
      }
    } catch {}

    throw new Error(msg);
  }

  return await res.blob();
}