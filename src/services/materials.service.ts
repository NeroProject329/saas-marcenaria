import { apiFetch } from "@/lib/api";

export type Material = {
  id: string;
  name: string;
  unit: string | null;
  isActive: boolean;

  defaultUnitCostCents: number | null;

  bestSupplier?: { id: string; name: string; unitCostCents: number } | null;
  supplierPrices?: Array<{ supplierId: string; supplierName: string; unitCostCents: number }>;
};

export type MaterialMovement = {
  id: string;
  materialId: string;
  materialName: string;

  type: "IN" | "OUT" | "ADJUST";
  qty: number;

  unitCostCents: number;
  totalCents: number;

  occurredAt: string;

  supplierId: string | null;
  supplierName: string | null;
  nfNumber: string | null;
};

export type StockRow = {
  materialId: string;
  materialName: string;
  unit: string | null;
  inQty: number;
  outQty: number;
  balanceQty: number;
};

function normalizeMaterial(m: any): Material {
  const sp = Array.isArray(m.supplierPrices) ? m.supplierPrices : [];
  const best = m.bestSupplier || (sp.length ? sp[0] : null);

  return {
    id: m.id,
    name: m.name ?? "—",
    unit: m.unit ?? null,
    isActive: m.isActive !== false,
    defaultUnitCostCents: m.defaultUnitCostCents ?? m.defaultUnitCost ?? null,
    bestSupplier: best
      ? {
          id: best.supplierId ?? best.id,
          name: best.supplierName ?? best.name ?? "Fornecedor",
          unitCostCents: Number(best.unitCostCents ?? 0) || 0,
        }
      : null,
    supplierPrices: sp.map((x: any) => ({
      supplierId: x.supplierId ?? x.supplier?.id,
      supplierName: x.supplierName ?? x.supplier?.name ?? "Fornecedor",
      unitCostCents: Number(x.unitCostCents ?? 0) || 0,
    })),
  };
}

function normalizeMovement(x: any): MaterialMovement {
  const qty = Number(x.qty ?? x.quantity ?? 0) || 0;
  const unit = Number(x.unitCostCents ?? x.unitCents ?? 0) || 0;
  const total =
    Number(x.totalCents ?? 0) ||
    Math.round(qty * unit);

  return {
    id: x.id,
    materialId: x.materialId ?? x.material?.id,
    materialName: x.material?.name ?? x.materialName ?? "—",
    type: String(x.type || "IN").toUpperCase(),
    qty,
    unitCostCents: unit,
    totalCents: total,
    occurredAt: x.occurredAt ?? x.createdAt ?? new Date().toISOString(),
    supplierId: x.supplierId ?? x.supplier?.id ?? null,
    supplierName: x.supplier?.name ?? x.supplierName ?? null,
    nfNumber: x.nfNumber ?? null,
  } as any;
}

function normalizeStockRow(x: any): StockRow {
  const inQty = Number(x.inQty ?? x.in ?? 0) || 0;
  const outQty = Number(x.outQty ?? x.out ?? 0) || 0;
  const bal = Number(x.balanceQty ?? x.balance ?? (inQty - outQty)) || 0;

  return {
    materialId: x.materialId ?? x.material?.id,
    materialName: x.materialName ?? x.material?.name ?? "—",
    unit: x.unit ?? null,
    inQty,
    outQty,
    balanceQty: bal,
  };
}

export async function listMaterials(params?: { q?: string; supplierId?: string; includeInactive?: boolean }) {
  const qs = new URLSearchParams();
  if (params?.q) qs.set("q", params.q);
  if (params?.supplierId) qs.set("supplierId", params.supplierId);
  if (params?.includeInactive) qs.set("includeInactive", "true");

  const data = await apiFetch<any>(`/api/materials${qs.toString() ? `?${qs.toString()}` : ""}`, { auth: true });
  const list = data.materials || data.items || data;
  return (Array.isArray(list) ? list : []).map(normalizeMaterial);
}

export async function getMaterial(id: string): Promise<Material> {
  const data = await apiFetch<any>(`/api/materials/${id}`, { auth: true });
  return normalizeMaterial(data.material ?? data);
}

export type SaveMaterialPayload = {
  name: string;
  unit?: string | null;
  isActive?: boolean;
  defaultUnitCostCents?: number | null;
  suppliers?: Array<{ supplierId: string; unitCostCents: number }>;
};

export async function createMaterial(payload: SaveMaterialPayload): Promise<Material> {
  const data = await apiFetch<any>("/api/materials", { method: "POST", auth: true, json: payload });
  return normalizeMaterial(data.material ?? data);
}

export async function updateMaterial(id: string, payload: SaveMaterialPayload): Promise<Material> {
  const data = await apiFetch<any>(`/api/materials/${id}`, { method: "PATCH", auth: true, json: payload });
  return normalizeMaterial(data.material ?? data);
}

export async function listMovements(month: string): Promise<MaterialMovement[]> {
  const data = await apiFetch<any>(`/api/materials/movements?month=${encodeURIComponent(month)}`, { auth: true });
  const list = data.movements || data.items || data;
  return (Array.isArray(list) ? list : []).map(normalizeMovement);
}

export type CreateMovementPayload = {
  materialId: string;
  type: "IN" | "OUT";
  qty: number;
  occurredAt?: string | null;

  supplierId?: string | null; // IN
  nfNumber?: string | null;   // IN
  unitCostCents?: number;     // IN
};

export async function createMovement(payload: CreateMovementPayload): Promise<MaterialMovement> {
  const data = await apiFetch<any>("/api/materials/movements", { method: "POST", auth: true, json: payload });
  return normalizeMovement(data.movement ?? data);
}

export async function listStock(month?: string): Promise<StockRow[]> {
  const url = month ? `/api/materials/stock?month=${encodeURIComponent(month)}` : "/api/materials/stock";
  const data = await apiFetch<any>(url, { auth: true });
  const list = data.stock || data.items || data;
  return (Array.isArray(list) ? list : []).map(normalizeStockRow);
}

export async function listSummary(month: string) {
  return apiFetch<any>(`/api/materials/summary?month=${encodeURIComponent(month)}`, { auth: true });
}