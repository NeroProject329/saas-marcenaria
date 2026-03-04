"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, RefreshCw, Boxes, History, ArrowDownCircle, ArrowUpCircle } from "lucide-react";

import PageHeader from "@/components/layout/PageHeader";
import GlassCard from "@/components/ui/GlassCard";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Tabs from "@/components/ui/Tabs";
import Toolbar from "@/components/ui/Toolbar";
import DataTable from "@/components/ui/DataTable";
import Modal from "@/components/ui/Modal";
import StatusPill from "@/components/ui/StatusPill";
import Skeleton from "@/components/ui/Skeleton";

import { useGsapStagger } from "@/motion/useGsapStagger";
import { moneyBRLFromCents, isoToBR, isoToDateInput, parseBRLToCents, clamp } from "@/lib/format";
import type { Client } from "@/lib/types";
import { listClients } from "@/services/clients.service";

import {
  type Material,
  type MaterialMovement,
  type StockRow,
  listMaterials,
  getMaterial,
  createMaterial,
  updateMaterial,
  listMovements,
  createMovement,
  listStock,
} from "@/services/materials.service";

type Tab = "catalogo" | "movimentacoes" | "quantidade";
type HistType = "" | "IN" | "OUT" | "ADJUST";

function currentMonthYYYYMM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function EstoquePage() {
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useGsapStagger(wrapRef, { selector: "[data-stagger]", y: 14, duration: 0.5, stagger: 0.05 });

  const [tab, setTab] = useState<Tab>("catalogo");
  const tabs = useMemo(
    () => [
      { key: "catalogo", label: "Catálogo" },
      { key: "movimentacoes", label: "Movimentações" },
      { key: "quantidade", label: "Quantidade" },
    ],
    []
  );

  const [month, setMonth] = useState(currentMonthYYYYMM());

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // suppliers (for IN)
  const [suppliers, setSuppliers] = useState<Client[]>([]);

  // catálogo
  const [catalogQ, setCatalogQ] = useState("");
  const [catalogSupplierId, setCatalogSupplierId] = useState("");
  const [materials, setMaterials] = useState<Material[]>([]);

  // movimentações
  const [mvQuery, setMvQuery] = useState("");
  const [movements, setMovements] = useState<MaterialMovement[]>([]);

  // quantidade
  const [stockQuery, setStockQuery] = useState("");
  const [onlyWithBalance, setOnlyWithBalance] = useState(false);
  const [stock, setStock] = useState<StockRow[]>([]);

  // caches
  const [histCache, setHistCache] = useState<Record<string, MaterialMovement[]>>({});

  async function reloadAll() {
    setLoading(true);
    setError(null);
    try {
      const [sup, mats, mvs, st] = await Promise.all([
        listClients().catch(() => []),
        listMaterials({ q: catalogQ || undefined, supplierId: catalogSupplierId || undefined }),
        listMovements(month),
        listStock(month),
      ]);

      // fornecedores = FORNECEDOR ou BOTH
      setSuppliers(
        sup.filter((c: any) => {
          const t = String(c.type || "").toUpperCase();
          return t === "FORNECEDOR" || t === "BOTH";
        })
      );

      setMaterials(mats);
      setMovements(mvs);
      setStock(st);
    } catch (e: any) {
      setError(e?.message || "Erro ao carregar estoque.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reloadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  // ======= FILTROS =======
  const filteredMaterials = useMemo(() => {
    const qq = catalogQ.trim().toLowerCase();
    return materials.filter((m) => {
      if (!qq) return true;
      const hay = `${m.name} ${m.bestSupplier?.name || ""}`.toLowerCase();
      return hay.includes(qq);
    });
  }, [materials, catalogQ]);

  const filteredMovements = useMemo(() => {
    const qq = mvQuery.trim().toLowerCase();
    return movements
      .filter((m) => String(m.type).toUpperCase() === "IN") // ✅ regra: Movimentações = IN
      .filter((m) => {
        if (!qq) return true;
        const hay = `${m.materialName} ${m.supplierName || ""} ${m.nfNumber || ""}`.toLowerCase();
        return hay.includes(qq);
      });
  }, [movements, mvQuery]);

  const filteredStock = useMemo(() => {
    const qq = stockQuery.trim().toLowerCase();
    return stock
      .filter((s) => (!onlyWithBalance ? true : (s.balanceQty || 0) > 0))
      .filter((s) => {
        if (!qq) return true;
        return String(s.materialName || "").toLowerCase().includes(qq);
      });
  }, [stock, stockQuery, onlyWithBalance]);

  // ======= MODAL MATERIAL =======
  const [matOpen, setMatOpen] = useState(false);
  const [matEditing, setMatEditing] = useState<Material | null>(null);
  const [matForm, setMatForm] = useState({
    name: "",
    unit: "",
    isActive: true,
    defaultUnit: "",
  });

  // supplier prices draft
  const [matSuppliers, setMatSuppliers] = useState<Array<{ supplierId: string; unit: string }>>([]);

  function openNewMaterial() {
    setMatEditing(null);
    setMatForm({ name: "", unit: "", isActive: true, defaultUnit: "" });
    setMatSuppliers([]);
    setMatOpen(true);
  }

  async function openEditMaterial(id: string) {
    setLoading(true);
    try {
      const full = await getMaterial(id);
      setMatEditing(full);
      setMatForm({
        name: full.name,
        unit: full.unit || "",
        isActive: full.isActive !== false,
        defaultUnit: full.defaultUnitCostCents ? String((full.defaultUnitCostCents / 100).toFixed(2)).replace(".", ",") : "",
      });
      setMatSuppliers(
        (full.supplierPrices || []).map((x) => ({
          supplierId: x.supplierId,
          unit: String((x.unitCostCents / 100).toFixed(2)).replace(".", ","),
        }))
      );
      setMatOpen(true);
    } finally {
      setLoading(false);
    }
  }

  async function saveMaterial() {
    const name = matForm.name.trim();
    if (name.length < 2) return alert("Nome inválido.");

    const defaultUnitCostCents = matForm.defaultUnit ? parseBRLToCents(matForm.defaultUnit) : null;

    const suppliersPayload = matSuppliers
      .filter((s) => s.supplierId && parseBRLToCents(s.unit) > 0)
      .map((s) => ({ supplierId: s.supplierId, unitCostCents: parseBRLToCents(s.unit) }));

    setLoading(true);
    try {
      if (!matEditing) {
        await createMaterial({
          name,
          unit: matForm.unit.trim() || null,
          isActive: !!matForm.isActive,
          defaultUnitCostCents,
          suppliers: suppliersPayload,
        });
      } else {
        await updateMaterial(matEditing.id, {
          name,
          unit: matForm.unit.trim() || null,
          isActive: !!matForm.isActive,
          defaultUnitCostCents,
          suppliers: suppliersPayload,
        });
      }

      setMatOpen(false);
      setMatEditing(null);
      await reloadAll();
    } catch (e: any) {
      alert(e?.message || "Erro ao salvar material.");
    } finally {
      setLoading(false);
    }
  }

  // ======= MODAL MOVEMENT (IN/OUT) =======
  const [mvOpen, setMvOpen] = useState(false);
  const [mvMode, setMvMode] = useState<"IN" | "OUT">("IN");
  const [mvMaterialId, setMvMaterialId] = useState("");
  const [mvSupplierId, setMvSupplierId] = useState("");
  const [mvNf, setMvNf] = useState("");
  const [mvQty, setMvQty] = useState("1");
  const [mvUnit, setMvUnit] = useState("");
  const [mvDate, setMvDate] = useState(() => isoToDateInput(new Date().toISOString()));

  async function openInModal(materialId?: string) {
    setMvMode("IN");
    setMvOpen(true);
    setMvMaterialId(materialId || (materials[0]?.id || ""));
    setMvSupplierId("");
    setMvNf("");
    setMvQty("1");
    setMvUnit("");
    setMvDate(isoToDateInput(new Date().toISOString()));
  }

  async function openOutModal(materialId: string) {
    setMvMode("OUT");
    setMvOpen(true);
    setMvMaterialId(materialId);
    setMvSupplierId("");
    setMvNf("");
    setMvQty("1");
    setMvUnit("");
    setMvDate(isoToDateInput(new Date().toISOString()));
  }

  // auto-fill unit when IN and supplier/material selected
  useEffect(() => {
    if (!mvOpen) return;
    if (mvMode !== "IN") return;
    if (!mvMaterialId || !mvSupplierId) return;

    const mat = materials.find((m) => m.id === mvMaterialId);
    if (!mat) return;

    const sp = (mat.supplierPrices || []).find((x) => x.supplierId === mvSupplierId);
    const best = sp?.unitCostCents ?? mat.defaultUnitCostCents ?? null;

    if (best != null && best > 0) {
      setMvUnit(String((best / 100).toFixed(2)).replace(".", ","));
    }
  }, [mvOpen, mvMode, mvMaterialId, mvSupplierId, materials]);

  async function saveMovement() {
    if (!mvMaterialId) return alert("Selecione o material.");

    const qty = Number(String(mvQty).replace(",", "."));
    if (!Number.isFinite(qty) || qty <= 0) return alert("Quantidade inválida.");

    const occurredAt = mvDate ? new Date(mvDate + "T00:00:00").toISOString() : null;

    if (mvMode === "IN") {
      if (!mvSupplierId) return alert("Selecione o fornecedor.");
      const unitCostCents = parseBRLToCents(mvUnit);
      if (unitCostCents <= 0) return alert("Informe o custo unitário.");

      setLoading(true);
      try {
        await createMovement({
          materialId: mvMaterialId,
          type: "IN",
          qty,
          occurredAt,
          supplierId: mvSupplierId,
          nfNumber: mvNf.trim() || null,
          unitCostCents,
        });
        setMvOpen(false);
        await reloadAll();
      } catch (e: any) {
        alert(e?.message || "Erro ao salvar entrada.");
      } finally {
        setLoading(false);
      }
    } else {
      // OUT: sem fornecedor/NF e unitCost = 0
      setLoading(true);
      try {
        await createMovement({
          materialId: mvMaterialId,
          type: "OUT",
          qty,
          occurredAt,
          unitCostCents: 0,
        });
        setMvOpen(false);
        await reloadAll();
      } catch (e: any) {
        alert(e?.message || "Erro ao salvar saída.");
      } finally {
        setLoading(false);
      }
    }
  }

  // ======= HISTÓRICO DO MATERIAL =======
  const [histOpen, setHistOpen] = useState(false);
  const [histMaterialId, setHistMaterialId] = useState("");
  const [histMaterialName, setHistMaterialName] = useState("");
  const [histQuery, setHistQuery] = useState("");
  const [histType, setHistType] = useState<HistType>("");

  async function openHistory(materialId: string, materialName: string) {
    setHistMaterialId(materialId);
    setHistMaterialName(materialName);
    setHistQuery("");
    setHistType("");
    setHistOpen(true);

    // cache por mês
    if (!histCache[month]) {
      try {
        const mvs = await listMovements(month);
        setHistCache((p) => ({ ...p, [month]: mvs }));
      } catch {}
    }
  }

  const histMovements = useMemo(() => {
    const list = histCache[month] || movements;
    const qq = histQuery.trim().toLowerCase();
    return list
      .filter((m) => m.materialId === histMaterialId)
      .filter((m) => (histType ? m.type === histType : true))
      .filter((m) => {
        if (!qq) return true;
        const hay = `${m.type} ${m.supplierName || ""} ${m.nfNumber || ""}`.toLowerCase();
        return hay.includes(qq);
      })
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  }, [histCache, month, movements, histMaterialId, histQuery, histType]);

  return (
    <div ref={wrapRef} className="space-y-4">
      <div data-stagger>
        <PageHeader
          title="Estoque"
          subtitle="M5 conectado: Catálogo, Entradas (Movimentações), Saídas (Quantidade) + histórico por material."
          badge={{ label: "M5", tone: "brand" }}
          right={<Tabs items={tabs} value={tab} onChange={(k) => setTab(k as Tab)} />}
        />
      </div>

      <div data-stagger>
        <GlassCard className="relative overflow-hidden p-4 sm:p-5">
          <div className="pointer-events-none absolute -top-12 -right-12 h-56 w-56 rounded-full blur-3xl bg-[rgba(247,211,32,0.18)]" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full blur-3xl bg-[rgba(149,173,193,0.22)]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[44%] bg-white/30" />

          <div className="relative flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Badge tone="wood">
                  <Boxes className="h-3.5 w-3.5" /> Estoque
                </Badge>
                {loading ? <Badge tone="ink">Carregando…</Badge> : <Badge tone="success">Online</Badge>}
              </div>
              <div className="mt-2 font-display text-lg font-black text-[color:var(--ink)]">Controle</div>
              <div className="mt-1 text-sm font-semibold text-[color:var(--muted)]">
                Mês atual: {month} • Movimentações = ENTRADAS • Quantidade = SAÍDAS
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="w-[170px]">
                <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
              </div>

              <Button variant="soft" onClick={reloadAll}>
                <RefreshCw className="h-4 w-4" /> Recarregar
              </Button>

              {tab === "catalogo" ? (
                <Button variant="dark" onClick={openNewMaterial}>
                  <Plus className="h-4 w-4" /> Novo material
                </Button>
              ) : null}

              {tab === "movimentacoes" ? (
                <Button variant="dark" onClick={() => openInModal()}>
                  <ArrowDownCircle className="h-4 w-4" /> Entrada
                </Button>
              ) : null}
            </div>
          </div>
        </GlassCard>
      </div>

      {error ? (
        <div data-stagger>
          <GlassCard className="border border-[rgba(220,38,38,0.18)] bg-[rgba(220,38,38,0.06)] p-4">
            <div className="text-sm font-extrabold text-[rgba(220,38,38,0.95)]">Erro</div>
            <div className="mt-1 text-sm font-semibold text-[color:var(--muted)]">{error}</div>
          </GlassCard>
        </div>
      ) : null}

      {/* TOOLBAR */}
      <div data-stagger>
        <Toolbar
          left={
            tab === "catalogo" ? (
              <>
                <div className="w-[320px] max-w-full">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--muted)]" />
                    <Input className="pl-10" value={catalogQ} onChange={(e) => setCatalogQ(e.target.value)} placeholder="Buscar material/fornecedor…" />
                  </div>
                </div>

                <div className="w-[260px] max-w-full">
                  <Select value={catalogSupplierId} onChange={(e) => setCatalogSupplierId(e.target.value)}>
                    <option value="">Fornecedor: todos</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </Select>
                </div>
              </>
            ) : tab === "movimentacoes" ? (
              <div className="w-[320px] max-w-full">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--muted)]" />
                  <Input className="pl-10" value={mvQuery} onChange={(e) => setMvQuery(e.target.value)} placeholder="Buscar entrada (material, fornecedor, NF)…" />
                </div>
              </div>
            ) : (
              <>
                <div className="w-[320px] max-w-full">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--muted)]" />
                    <Input className="pl-10" value={stockQuery} onChange={(e) => setStockQuery(e.target.value)} placeholder="Buscar material…" />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="onlyBal"
                    type="checkbox"
                    checked={onlyWithBalance}
                    onChange={(e) => setOnlyWithBalance(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <label htmlFor="onlyBal" className="text-sm font-semibold text-[color:var(--muted)]">
                    Somente com saldo
                  </label>
                </div>
              </>
            )
          }
          right={<Badge tone="ink">Itens: {tab === "catalogo" ? filteredMaterials.length : tab === "movimentacoes" ? filteredMovements.length : filteredStock.length}</Badge>}
        />
      </div>

      {/* CONTENT */}
      {tab === "catalogo" ? (
        <div data-stagger>
          <DataTable
            title="Catálogo"
            subtitle="GET /api/materials (inclui bestSupplier)"
            rows={filteredMaterials}
            rowKey={(r) => r.id}
            columns={[
              { header: "Material", cell: (r: Material) => r.name },
              { header: "Unidade", cell: (r: Material) => r.unit || "—" },
              { header: "Ativo", cell: (r: Material) => <StatusPill tone={r.isActive ? "success" : "neutral"} label={r.isActive ? "Ativo" : "Inativo"} /> },
              { header: "Melhor fornecedor", cell: (r: Material) => r.bestSupplier?.name || "—" },
              { header: "Melhor preço", className: "text-right font-extrabold", cell: (r: Material) => (r.bestSupplier ? moneyBRLFromCents(r.bestSupplier.unitCostCents) : "—") },
              {
                header: "Ações",
                className: "text-right",
                cell: (r: Material) => (
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => openInModal(r.id)}>
                      <ArrowDownCircle className="h-4 w-4" /> Entrada
                    </Button>
                    <Button variant="ghost" onClick={() => openEditMaterial(r.id)}>
                      <Plus className="h-4 w-4" /> Editar
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        </div>
      ) : null}

      {tab === "movimentacoes" ? (
        <div data-stagger>
          <DataTable
            title="Movimentações"
            subtitle="Somente ENTRADAS (IN) — regra do legado"
            rows={filteredMovements}
            rowKey={(r) => r.id}
            columns={[
              { header: "Data", cell: (r: MaterialMovement) => isoToBR(r.occurredAt) },
              { header: "Material", cell: (r: MaterialMovement) => r.materialName },
              { header: "Fornecedor", cell: (r: MaterialMovement) => r.supplierName || "—" },
              { header: "NF", cell: (r: MaterialMovement) => r.nfNumber || "—" },
              { header: "Qtd", className: "text-right font-extrabold", cell: (r: MaterialMovement) => String(r.qty) },
              { header: "Unit", className: "text-right font-extrabold", cell: (r: MaterialMovement) => moneyBRLFromCents(r.unitCostCents) },
              { header: "Total", className: "text-right font-extrabold", cell: (r: MaterialMovement) => moneyBRLFromCents(r.totalCents) },
            ]}
          />
        </div>
      ) : null}

      {tab === "quantidade" ? (
        <div data-stagger>
          <DataTable
            title="Quantidade"
            subtitle="Saldo por material + Saída + Histórico"
            rows={filteredStock}
            rowKey={(r) => r.materialId}
            columns={[
              { header: "Material", cell: (r: StockRow) => r.materialName },
              { header: "Unidade", cell: (r: StockRow) => r.unit || "—" },
              { header: "Entradas", className: "text-right font-extrabold", cell: (r: StockRow) => String(r.inQty) },
              { header: "Saídas", className: "text-right font-extrabold", cell: (r: StockRow) => String(r.outQty) },
              { header: "Saldo", className: "text-right font-extrabold", cell: (r: StockRow) => String(r.balanceQty) },
              {
                header: "Ações",
                className: "text-right",
                cell: (r: StockRow) => (
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => openOutModal(r.materialId)}>
                      <ArrowUpCircle className="h-4 w-4" /> Saída
                    </Button>
                    <Button variant="ghost" onClick={() => openHistory(r.materialId, r.materialName)}>
                      <History className="h-4 w-4" /> Histórico
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        </div>
      ) : null}

      {/* MODAL MATERIAL */}
      <Modal
        open={matOpen}
        title={matEditing ? "Editar material" : "Novo material"}
        subtitle="POST/PATCH /api/materials (com preços por fornecedor)"
        onClose={() => setMatOpen(false)}
        maxWidth="max-w-[1100px]"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="soft" onClick={() => setMatOpen(false)}>Cancelar</Button>
            <Button variant="dark" onClick={saveMaterial}>Salvar</Button>
          </div>
        }
      >
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Nome</div>
              <Input value={matForm.name} onChange={(e) => setMatForm((p) => ({ ...p, name: e.target.value }))} />
            </div>

            <div>
              <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Unidade</div>
              <Input value={matForm.unit} onChange={(e) => setMatForm((p) => ({ ...p, unit: e.target.value }))} placeholder="Ex: m², un, kg" />
            </div>

            <div>
              <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Custo padrão (R$)</div>
              <Input value={matForm.defaultUnit} onChange={(e) => setMatForm((p) => ({ ...p, defaultUnit: e.target.value }))} placeholder="0,00" />
            </div>

            <div className="sm:col-span-2 flex items-center gap-2">
              <input
                id="matActive"
                type="checkbox"
                checked={!!matForm.isActive}
                onChange={(e) => setMatForm((p) => ({ ...p, isActive: e.target.checked }))}
                className="h-4 w-4"
              />
              <label htmlFor="matActive" className="text-sm font-semibold text-[color:var(--muted)]">
                Ativo
              </label>
            </div>
          </div>

          <GlassCard className="p-4">
            <div className="font-display text-sm font-black text-[color:var(--ink)]">Fornecedores</div>
            <div className="mt-1 text-sm font-semibold text-[color:var(--muted)]">
              Preço por fornecedor (bestSupplier aparece no catálogo).
            </div>

            <div className="mt-3 grid gap-2">
              {matSuppliers.map((s, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_160px_auto] gap-2">
                  <Select
                    value={s.supplierId}
                    onChange={(e) =>
                      setMatSuppliers((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, supplierId: e.target.value } : x))
                      )
                    }
                  >
                    <option value="">Fornecedor</option>
                    {suppliers.map((sp) => (
                      <option key={sp.id} value={sp.id}>{sp.name}</option>
                    ))}
                  </Select>

                  <Input
                    value={s.unit}
                    onChange={(e) =>
                      setMatSuppliers((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, unit: e.target.value } : x))
                      )
                    }
                    placeholder="Preço (R$)"
                  />

                  <Button
                    variant="ghost"
                    onClick={() => setMatSuppliers((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    Remover
                  </Button>
                </div>
              ))}

              <Button variant="soft" onClick={() => setMatSuppliers((p) => [...p, { supplierId: "", unit: "" }])}>
                <Plus className="h-4 w-4" /> Adicionar fornecedor
              </Button>
            </div>
          </GlassCard>
        </div>
      </Modal>

      {/* MODAL MOVEMENT IN/OUT */}
      <Modal
        open={mvOpen}
        title={mvMode === "IN" ? "Nova Entrada" : "Nova Saída"}
        subtitle={mvMode === "IN" ? "POST /api/materials/movements (IN + fornecedor + NF + custo)" : "POST /api/materials/movements (OUT + qty)"}
        onClose={() => setMvOpen(false)}
        maxWidth="max-w-[880px]"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="soft" onClick={() => setMvOpen(false)}>Cancelar</Button>
            <Button variant="dark" onClick={saveMovement}>Salvar</Button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Material</div>
            <Select value={mvMaterialId} onChange={(e) => setMvMaterialId(e.target.value)}>
              <option value="">Selecione</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </Select>
          </div>

          <div>
            <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Quantidade</div>
            <Input value={mvQty} onChange={(e) => setMvQty(e.target.value)} placeholder="1" />
          </div>

          <div>
            <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Data</div>
            <Input type="date" value={mvDate} onChange={(e) => setMvDate(e.target.value)} />
          </div>

          {mvMode === "IN" ? (
            <>
              <div className="sm:col-span-2">
                <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Fornecedor</div>
                <Select value={mvSupplierId} onChange={(e) => setMvSupplierId(e.target.value)}>
                  <option value="">Selecione</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </Select>
              </div>

              <div>
                <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">NF</div>
                <Input value={mvNf} onChange={(e) => setMvNf(e.target.value)} placeholder="Ex: 123" />
              </div>

              <div>
                <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Custo unit (R$)</div>
                <Input value={mvUnit} onChange={(e) => setMvUnit(e.target.value)} placeholder="0,00" />
              </div>
            </>
          ) : (
            <div className="sm:col-span-2 rounded-2xl border border-[color:var(--line)] bg-white/40 p-4 text-sm font-semibold text-[color:var(--muted)]">
              Saída não exige fornecedor/NF/custo. (unitCost = 0)
            </div>
          )}
        </div>
      </Modal>

      {/* MODAL HISTÓRICO */}
      <Modal
        open={histOpen}
        title={`Histórico — ${histMaterialName}`}
        subtitle={`Mês: ${month}`}
        onClose={() => setHistOpen(false)}
        maxWidth="max-w-[1100px]"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="soft" onClick={() => setHistOpen(false)}>Fechar</Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Toolbar
            left={
              <>
                <div className="w-[320px] max-w-full">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--muted)]" />
                    <Input className="pl-10" value={histQuery} onChange={(e) => setHistQuery(e.target.value)} placeholder="Buscar por fornecedor/NF/tipo…" />
                  </div>
                </div>

                <div className="w-[220px] max-w-full">
                  <Select value={histType} onChange={(e) => setHistType(e.target.value as any)}>
                    <option value="">Tipo: Todos</option>
                    <option value="IN">IN</option>
                    <option value="OUT">OUT</option>
                    <option value="ADJUST">ADJUST</option>
                  </Select>
                </div>
              </>
            }
            right={<Badge tone="ink">Itens: {histMovements.length}</Badge>}
          />

          <div className="overflow-auto rounded-2xl border border-[color:var(--line)] bg-white/35">
            <table className="min-w-[980px] w-full text-sm">
              <thead className="bg-white/55">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-extrabold text-[color:var(--muted)]">Data</th>
                  <th className="px-4 py-3 text-left text-xs font-extrabold text-[color:var(--muted)]">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-extrabold text-[color:var(--muted)]">Fornecedor</th>
                  <th className="px-4 py-3 text-left text-xs font-extrabold text-[color:var(--muted)]">NF</th>
                  <th className="px-4 py-3 text-right text-xs font-extrabold text-[color:var(--muted)]">Qtd</th>
                  <th className="px-4 py-3 text-right text-xs font-extrabold text-[color:var(--muted)]">Unit</th>
                  <th className="px-4 py-3 text-right text-xs font-extrabold text-[color:var(--muted)]">Total</th>
                </tr>
              </thead>
              <tbody>
                {histMovements.map((m) => (
                  <tr key={m.id} className="border-t border-[color:var(--line)]">
                    <td className="px-4 py-3">{isoToBR(m.occurredAt)}</td>
                    <td className="px-4 py-3">
                      <StatusPill
                        tone={m.type === "IN" ? "success" : m.type === "OUT" ? "danger" : "neutral"}
                        label={m.type}
                      />
                    </td>
                    <td className="px-4 py-3">{m.supplierName || "—"}</td>
                    <td className="px-4 py-3">{m.nfNumber || "—"}</td>
                    <td className="px-4 py-3 text-right font-extrabold">{String(m.qty)}</td>
                    <td className="px-4 py-3 text-right font-extrabold">{moneyBRLFromCents(m.unitCostCents)}</td>
                    <td className="px-4 py-3 text-right font-extrabold">{moneyBRLFromCents(m.totalCents)}</td>
                  </tr>
                ))}

                {!histMovements.length ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-sm font-semibold text-[color:var(--muted)]">
                      Nenhum movimento encontrado.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>
    </div>
  );
}