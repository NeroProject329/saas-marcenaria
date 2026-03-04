import type { Order, OrderItem, OrderInstallment } from "@/lib/types";
import { apiFetch, ApiError } from "@/lib/api";

function normalizeItem(it: any, idx = 0): OrderItem {
  const qty = Number(it.quantity ?? it.qty ?? 1) || 1;
  const unit =
    Number(it.unitPriceCents ?? it.unitCents ?? it.unit_price_cents ?? 0) || 0;
  const total =
    Number(it.totalCents ?? it.total_cents ?? qty * unit) || 0;

  return {
    id: it.id ?? `item_${idx}`,
    name: it.name ?? it.description ?? it.desc ?? "Item",
    description: it.description ?? null,
    quantity: qty,
    unitPriceCents: unit,
    totalCents: total,
  };
}

function normalizeInstallment(p: any, idx = 0): OrderInstallment {
  return {
    id: p.id ?? `inst_${idx}`,
    dueDate: p.dueDate ?? p.dueAt ?? p.due_date ?? null,
    amountCents: Number(p.amountCents ?? p.valueCents ?? p.amount_cents ?? 0) || 0,
    paidAt: p.paidAt ?? null,
  };
}

function normalizeOrder(o: any): Order {
  const clientName = o.client?.name ?? o.clientName ?? o.nomeCliente ?? "—";
  const clientId = o.clientId ?? o.client?.id ?? "";

  const itemsRaw = o.items ?? o.orderItems ?? o.itens ?? [];
  const instRaw =
    o.installments ??
    o.receivable?.installments ??
    o.receivables?.installments ??
    [];

  const order: any = {
    id: o.id,
    clientId,
    clientName,
    status: (o.status ?? o.orderStatus ?? "PEDIDO") as any,
    createdAt: o.createdAt ?? new Date().toISOString(),
    expectedDeliveryAt: o.expectedDeliveryAt ?? o.deliveryDate ?? null,

    paymentMode: (o.paymentMode ?? o.payment_mode ?? "AVISTA") as any,
    paymentMethod: (o.paymentMethod ?? o.payment_method ?? "PIX") as any,
    installmentsCount: o.installmentsCount ?? null,
    firstDueDate: o.firstDueDate ?? null,
    paidNow: o.paidNow ?? null,

    subtotalCents: Number(o.subtotalCents ?? o.subtotal_cents ?? 0) || 0,
    discountCents: Number(o.discountCents ?? 0) || 0,
    totalCents: Number(o.totalCents ?? o.total_cents ?? 0) || 0,

    items: Array.isArray(itemsRaw) ? itemsRaw.map(normalizeItem) : [],
    installments: Array.isArray(instRaw) ? instRaw.map(normalizeInstallment) : [],
  };

  order.notes = o.notes ?? null;
  return order as Order;
}

/** Payload completo (M5) — usado no POST/PATCH */
export type SaveOrderPayload = {
  clientId: string;
  status: string;
  expectedDeliveryAt: string | null;

  paymentMode: string;
  paymentMethod: string;
  installmentsCount: number;
  firstDueDate: string | null;
  paidNow: boolean;

  subtotalCents: number;
  discountCents: number;
  totalCents: number;

  items: Array<{
    name: string;
    description: string | null;
    quantity: number;
    unitPriceCents: number;
    totalCents: number;
  }>;

  installments?: Array<{
    dueDate: string | null;
    amountCents: number;
  }>;

  notes?: string | null;
};

// ========= API =========

export async function listOrders(): Promise<Order[]> {
  const data = await apiFetch<any>("/api/orders", { auth: true });
  const list = Array.isArray(data) ? data : data.items || data.orders || [];
  return list.map(normalizeOrder);
}

/**
 * ✅ Fallback:
 * tenta /:id/full
 * se der 404 => tenta /:id
 * se ainda der 404 => tenta /:id?include=full
 */
export async function getOrderFull(id: string): Promise<Order> {
  try {
    const data = await apiFetch<any>(`/api/orders/${id}/full`, { auth: true });
    return normalizeOrder(data?.order ?? data);
  } catch (e: any) {
    if (e instanceof ApiError && e.status === 404) {
      try {
        const data2 = await apiFetch<any>(`/api/orders/${id}`, { auth: true });
        return normalizeOrder(data2?.order ?? data2);
      } catch (e2: any) {
        if (e2 instanceof ApiError && e2.status === 404) {
          const data3 = await apiFetch<any>(`/api/orders/${id}?include=full`, { auth: true });
          return normalizeOrder(data3?.order ?? data3);
        }
        throw e2;
      }
    }
    throw e;
  }
}

export async function createOrder(payload: SaveOrderPayload): Promise<Order> {
  const data = await apiFetch<any>("/api/orders", {
    method: "POST",
    auth: true,
    json: payload,
  });
  return normalizeOrder(data?.order ?? data);
}

/**
 * ✅ Fallback:
 * tenta PATCH /:id/full
 * se 404 => tenta PATCH /:id
 * se 404 => tenta PUT /:id
 */
export async function updateOrderFull(id: string, payload: SaveOrderPayload): Promise<Order> {
  try {
    const data = await apiFetch<any>(`/api/orders/${id}/full`, {
      method: "PATCH",
      auth: true,
      json: payload,
    });
    return normalizeOrder(data?.order ?? data);
  } catch (e: any) {
    if (e instanceof ApiError && e.status === 404) {
      try {
        const data2 = await apiFetch<any>(`/api/orders/${id}`, {
          method: "PATCH",
          auth: true,
          json: payload,
        });
        return normalizeOrder(data2?.order ?? data2);
      } catch (e2: any) {
        if (e2 instanceof ApiError && e2.status === 404) {
          const data3 = await apiFetch<any>(`/api/orders/${id}`, {
            method: "PUT",
            auth: true,
            json: payload,
          });
          return normalizeOrder(data3?.order ?? data3);
        }
        throw e2;
      }
    }
    throw e;
  }
}

export async function cancelOrder(id: string): Promise<void> {
  await apiFetch<any>(`/api/orders/${id}/cancel`, {
    method: "POST",
    auth: true,
  });
}

export async function deleteOrder(id: string): Promise<void> {
  await apiFetch<any>(`/api/orders/${id}`, {
    method: "DELETE",
    auth: true,
  });
}