import type { Client } from "@/lib/types";
import { apiFetch, ApiError } from "@/lib/api";

function normalizeClient(c: any): Client {
  return {
    id: c.id,
    name: c.name ?? c.nome ?? "—",
    phone: c.phone ?? c.telefone ?? "",
    type: (c.type ?? c.tipo ?? "CLIENTE") as any,

    instagram: c.instagram ?? null,
    notes: c.notes ?? null,

    cpf: c.cpf ?? null,
    email: c.email ?? null,

    cep: c.cep ?? null,
    logradouro: c.logradouro ?? null,
    numero: c.numero ?? null,
    complemento: c.complemento ?? null,
    bairro: c.bairro ?? null,
    cidade: c.cidade ?? null,
    estado: c.estado ?? null,
  };
}

export type ClientMetricRow = {
  id: string;
  name: string;
  phone: string;
  type: "CLIENTE" | "FORNECEDOR" | "BOTH";
  totalSpentCents: number;
};

function normalizeMetricRow(x: any): ClientMetricRow {
  return {
    id: x.id,
    name: x.name ?? "—",
    phone: x.phone ?? "",
    type: (x.type ?? "CLIENTE").toUpperCase(),
    totalSpentCents: Number(x.totalSpent ?? x.totalSpentCents ?? 0) || 0,
  } as any;
}

export type ClientHistory = {
  client: Client | null;
  orders: any[];
  budgets: any[];
  timeline: Array<{ at: string; title: string; text?: string | null }>;
};

export async function listClients(params?: { type?: "CLIENTE" | "FORNECEDOR" | "BOTH" }): Promise<Client[]> {
  const qs = new URLSearchParams();
  if (params?.type) qs.set("type", params.type);

  const path = qs.toString() ? `/api/clients?${qs.toString()}` : "/api/clients";
  const data = await apiFetch<any>(path, { auth: true });

  const list = Array.isArray(data) ? data : data.clients || data.items || [];
  return (Array.isArray(list) ? list : []).map(normalizeClient);
}

export type CreateClientInput = Partial<Client> & {
  name: string;
  phone: string;
  type?: "CLIENTE" | "FORNECEDOR" | "BOTH";
};

export async function createClient(input: CreateClientInput): Promise<Client> {
  const payload = {
    name: input.name,
    phone: input.phone,
    type: input.type || "CLIENTE",

    instagram: input.instagram || null,
    notes: input.notes || null,

    cpf: input.cpf || null,
    email: input.email || null,

    cep: input.cep || null,
    logradouro: input.logradouro || null,
    numero: input.numero || null,
    complemento: input.complemento || null,
    bairro: input.bairro || null,
    cidade: input.cidade || null,
    estado: input.estado || null,
  };

  const data = await apiFetch<any>("/api/clients", {
    method: "POST",
    auth: true,
    json: payload,
  });

  return normalizeClient(data?.client ?? data);
}

export async function updateClient(id: string, input: Partial<Client>): Promise<Client> {
  const payload = {
    name: input.name,
    phone: input.phone,
    type: input.type,

    instagram: input.instagram ?? null,
    notes: input.notes ?? null,

    cpf: input.cpf ?? null,
    email: input.email ?? null,

    cep: input.cep ?? null,
    logradouro: input.logradouro ?? null,
    numero: input.numero ?? null,
    complemento: input.complemento ?? null,
    bairro: input.bairro ?? null,
    cidade: input.cidade ?? null,
    estado: input.estado ?? null,
  };

  const data = await apiFetch<any>(`/api/clients/${id}`, {
    method: "PATCH",
    auth: true,
    json: payload,
  });

  return normalizeClient(data?.client ?? data);
}

export async function deleteClient(id: string): Promise<void> {
  await apiFetch(`/api/clients/${id}`, { method: "DELETE", auth: true });
}

export async function listClientsMetrics(): Promise<ClientMetricRow[]> {
  const data = await apiFetch<any>("/api/clients/metrics", { auth: true });
  const list = data?.clients || data?.items || [];
  return (Array.isArray(list) ? list : []).map(normalizeMetricRow);
}

export async function getClientHistory(clientId: string): Promise<ClientHistory> {
  try {
    const data = await apiFetch<any>(`/api/clients/${clientId}/history`, { auth: true });
    return {
      client: data?.client ? normalizeClient(data.client) : null,
      orders: Array.isArray(data?.orders) ? data.orders : [],
      budgets: Array.isArray(data?.budgets) ? data.budgets : [],
      timeline: Array.isArray(data?.timeline) ? data.timeline : [],
    };
  } catch (e) {
    // fallback: se backend não tiver history (ou tiver outro path), deixa claro
    if (e instanceof ApiError && e.status === 404) {
      return { client: null, orders: [], budgets: [], timeline: [] };
    }
    throw e;
  }
}