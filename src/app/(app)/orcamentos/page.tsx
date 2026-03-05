"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Search,
  RefreshCw,
  FileText,
  Send,
  CheckCircle2,
  XCircle,
  Trash2,
  Pencil,
  Hammer,
  Percent,
  CreditCard,
  Boxes,
} from "lucide-react";

import PageHeader from "@/components/layout/PageHeader";
import GlassCard from "@/components/ui/GlassCard";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Toolbar from "@/components/ui/Toolbar";
import DataTable from "@/components/ui/DataTable";
import Modal from "@/components/ui/Modal";
import StatusPill from "@/components/ui/StatusPill";
import Tabs from "@/components/ui/Tabs";

import { useGsapStagger } from "@/motion/useGsapStagger";
import { moneyBRLFromCents, isoToBR, isoToDateInput, parseBRLToCents, clamp, uid } from "@/lib/format";
import type { Client } from "@/lib/types";

import { listClients } from "@/services/clients.service";
import { getCostsSummary } from "@/services/costs.service";
import { listMaterials, type Material } from "@/services/materials.service";

import {
  type Budget,
  type BudgetStatus,
  type DiscountType,
  type PayMode,
  type SaveBudgetPayload,
  listBudgets,
  getBudget,
  createBudget,
  updateBudgetFull,
  sendBudget,
  approveBudget,
  cancelBudget,
  deleteBudget,
  downloadBudgetPdf,
} from "@/services/budgets.service";

type ItemDraft = {
  id: string;
  name: string;
  description: string;
  quantity: number;
  materials: MaterialLineDraft[];
};

type MaterialLineDraft = {
  id: string;
  name: string;
  qty: number;
  unit: string; // BRL
};

function currentMonthYYYYMM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function statusTone(s: BudgetStatus) {
  const u = String(s).toUpperCase();
  if (u === "APROVADO") return "success";
  if (u === "CANCELADO" || u === "REJEITADO") return "danger";
  if (u === "ENVIADO") return "warning";
  return "neutral";
}

function payLabel(b: Budget) {
  const mode = b.paymentMode || "AVISTA";
  const method = b.paymentMethod ? ` • ${b.paymentMethod}` : "";
  const inst = b.installmentsCount && b.installmentsCount > 1 ? ` • ${b.installmentsCount}x` : "";
  return `${mode}${method}${inst}`;
}

function safeDateISO(dateInput: string) {
  if (!dateInput) return null;
  const d = new Date(dateInput + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function findUnitCostCents(mat: Material | null) {
  if (!mat) return 0;
  const best = mat.bestSupplier?.unitCostCents ?? 0;
  if (best > 0) return best;
  const def = mat.defaultUnitCostCents ?? 0;
  return def > 0 ? def : 0;
}

function allocateTotalAcrossItems(items: Array<{ quantity: number; materialsCostPerUnitCents: number }>, totalCents: number) {
  const n = items.length;
  if (!n) return [];

  let weights = items.map((it) => it.quantity * (it.materialsCostPerUnitCents || 0));
  let sumW = weights.reduce((a, b) => a + b, 0);

  if (!Number.isFinite(sumW) || sumW <= 0) {
    weights = items.map((it) => it.quantity);
    sumW = weights.reduce((a, b) => a + b, 0);
  }

  const out: Array<{ unit: number; total: number }> = [];
  let running = 0;

  for (let i = 0; i < n; i++) {
    const qty = Math.max(1, items[i].quantity || 1);

    let itemTotal: number;
    if (i === n - 1) {
      itemTotal = Math.max(0, totalCents - running);
    } else {
      const share = sumW > 0 ? (totalCents * weights[i]) / sumW : 0;
      itemTotal = Math.max(0, Math.round(share));
      running += itemTotal;
    }

    const unit = Math.max(0, Math.round(itemTotal / qty));
    out.push({ unit, total: unit * qty });
  }

  const sumTotals = out.reduce((a, b) => a + b.total, 0);
  const diff = totalCents - sumTotals;
  if (diff !== 0 && out.length) {
    const last = out[out.length - 1];
    const qty = Math.max(1, items[n - 1].quantity || 1);
    const adj = Math.round(diff / qty);
    last.unit = Math.max(0, last.unit + adj);
    last.total = last.unit * qty;
  }

  return out;
}

export default function OrcamentosPage() {
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useGsapStagger(wrapRef, { selector: "[data-stagger]", y: 14, duration: 0.5, stagger: 0.05 });

  // ===== LIST =====
  const [status, setStatus] = useState<string>("");
  const [q, setQ] = useState("");
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const list = await listBudgets({ status: status || undefined, q: q.trim() || undefined });
      setBudgets(list);
    } catch (e: any) {
      setError(e?.message || "Erro ao carregar orçamentos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== MODAL (CREATE/EDIT) =====
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [clients, setClients] = useState<Client[]>([]);
  const [materialsCatalog, setMaterialsCatalog] = useState<Material[]>([]);
  const [materialsMap, setMaterialsMap] = useState<Record<string, Material>>({});

  const [form, setForm] = useState({
    clientId: "",
    expectedDeliveryAt: "", // input date
    notes: "",

    dailyRate: "0,00",
    deliveryDays: 0,
    profitPercent: 30,

    discountType: "VALOR" as DiscountType,
    discount: "0,00",
    discountPreset: 0,

    paymentMode: "AVISTA" as PayMode,
    paymentMethod: "" as string,
    installmentsCount: 3,
  });

  const [items, setItems] = useState<ItemDraft[]>([
    { id: uid("it"), name: "", description: "", quantity: 1, materials: [] },
  ]);

  async function ensureCatalogsLoaded() {
    if (!clients.length) {
      const c = await listClients();
      setClients(c);
    }
    if (!materialsCatalog.length) {
      const mats = await listMaterials({ includeInactive: false });
      const active = mats.filter((m) => m.isActive !== false);
      setMaterialsCatalog(active);

      const map: Record<string, Material> = {};
      active.forEach((m) => {
        map[String(m.name || "").trim().toLowerCase()] = m;
      });
      setMaterialsMap(map);
    }
  }

  async function prefillDailyRate() {
    // tenta cache primeiro
    const cached = Number(localStorage.getItem("marcenaria_dailyFixedCents") || 0);
    if (Number.isFinite(cached) && cached > 0) {
      setForm((p) => ({ ...p, dailyRate: String((cached / 100).toFixed(2)).replace(".", ",") }));
      return;
    }

    // senão, busca summary do mês atual
    const month = currentMonthYYYYMM();
    const wdRaw = Number(localStorage.getItem("marcenaria_workDays") || 21);
    const workDays = Number.isFinite(wdRaw) && wdRaw > 0 ? Math.trunc(wdRaw) : 21;

    try {
      const sum = await getCostsSummary(month, workDays);
      const cents = sum?.totals?.dailyFixedCents ?? 0;
      if (Number.isFinite(cents) && cents >= 0) {
        setForm((p) => ({ ...p, dailyRate: String((cents / 100).toFixed(2)).replace(".", ",") }));
      }
    } catch {}
  }

  async function openNew() {
    await ensureCatalogsLoaded();
    setEditingId(null);

    setForm({
      clientId: clients[0]?.id || "",
      expectedDeliveryAt: "",
      notes: "",

      dailyRate: "0,00",
      deliveryDays: 0,
      profitPercent: 30,

      discountType: "VALOR",
      discount: "0,00",
      discountPreset: 0,

      paymentMode: "AVISTA",
      paymentMethod: "",
      installmentsCount: 3,
    });

    setItems([{ id: uid("it"), name: "", description: "", quantity: 1, materials: [] }]);

    await prefillDailyRate();
    setOpen(true);
  }

  async function openEdit(id: string) {
    await ensureCatalogsLoaded();
    setLoading(true);
    try {
      const b = await getBudget(id);

      if (b.status === "APROVADO" || b.status === "CANCELADO") {
        alert("Esse orçamento não pode ser editado.");
        return;
      }

      setEditingId(id);

      setForm({
        clientId: b.clientId,
        expectedDeliveryAt: b.expectedDeliveryAt ? isoToDateInput(b.expectedDeliveryAt) : "",
        notes: b.notes || "",

        dailyRate: String((b.dailyRateCents / 100).toFixed(2)).replace(".", ","),
        deliveryDays: b.deliveryDays || 0,
        profitPercent: Number(b.profitPercent ?? 30),

        discountType: (b.discountType || "VALOR") as any,
        discount: String(((b.discountCents || 0) / 100).toFixed(2)).replace(".", ","),
        discountPreset: Math.trunc(Number(b.discountPercent || 0)),

        paymentMode: (b.paymentMode || "AVISTA") as any,
        paymentMethod: b.paymentMethod || "",
        installmentsCount: b.installmentsCount || 3,
      });

      setItems(
        (b.items || []).length
          ? b.items.map((it) => ({
              id: it.id || uid("it"),
              name: it.name || "",
              description: it.description || "",
              quantity: it.quantity || 1,
              materials: (it.materials || []).map((m) => ({
                id: uid("m"),
                name: m.name,
                qty: m.qty,
                unit: String((m.unitCostCents / 100).toFixed(2)).replace(".", ","),
              })),
            }))
          : [{ id: uid("it"), name: "", description: "", quantity: 1, materials: [] }]
      );

      setOpen(true);
    } finally {
      setLoading(false);
    }
  }

  // ===== MATERIALS MODAL (por item) =====
  const [matOpen, setMatOpen] = useState(false);
  const [matItemId, setMatItemId] = useState<string | null>(null);
  const [matDraft, setMatDraft] = useState<MaterialLineDraft[]>([]);

  function openMaterials(itemId: string) {
    const it = items.find((x) => x.id === itemId);
    setMatItemId(itemId);
    setMatDraft(it?.materials?.length ? it.materials.map((m) => ({ ...m })) : [{ id: uid("m"), name: "", qty: 1, unit: "" }]);
    setMatOpen(true);
  }

  function closeMaterials() {
    setMatOpen(false);
    setMatItemId(null);
    setMatDraft([]);
  }

  function maybeAutofillUnit(name: string, currentUnit: string) {
    const key = String(name || "").trim().toLowerCase();
    if (!key) return currentUnit;

    const mat = materialsMap[key];
    if (!mat) return currentUnit;

    const cents = findUnitCostCents(mat);
    if (cents <= 0) return currentUnit;

    const curr = parseBRLToCents(currentUnit);
    if (curr > 0) return currentUnit;

    return String((cents / 100).toFixed(2)).replace(".", ",");
  }

  function saveMaterialsToItem() {
    if (!matItemId) return;

    const cleaned = matDraft
      .map((m) => ({
        ...m,
        name: m.name.trim(),
        qty: Number(m.qty || 0),
        unit: m.unit,
      }))
      .filter((m) => m.name && Number.isFinite(m.qty) && m.qty > 0 && parseBRLToCents(m.unit) > 0);

    setItems((prev) => prev.map((it) => (it.id === matItemId ? { ...it, materials: cleaned } : it)));
    closeMaterials();
  }

  // ===== CALC ENGINE =====
  const calc = useMemo(() => {
    const dailyRateCents = parseBRLToCents(form.dailyRate);
    const days = Math.max(0, Math.trunc(Number(form.deliveryDays || 0)));
    const laborCents = dailyRateCents * days;

    const itemsInfo = items.map((it) => {
      const materialsCostPerUnitCents = (it.materials || []).reduce((acc, m) => {
        const qty = Number(m.qty || 0);
        const unit = parseBRLToCents(m.unit);
        return acc + Math.max(0, qty) * Math.max(0, unit);
      }, 0);

      const costTotalItemCents = Math.max(1, it.quantity || 1) * materialsCostPerUnitCents;

      return { materialsCostPerUnitCents, costTotalItemCents };
    });

    const costItems = itemsInfo.reduce((a, b) => a + b.costTotalItemCents, 0);
    const projectCost = costItems + laborCents;

    const method = String(form.paymentMethod || "").toUpperCase();
    const cardFeePercent = 12.3;
    const cardFeeCents =
      form.paymentMode === "PARCELADO" && method === "CARTAO"
        ? Math.round(projectCost * (cardFeePercent / 100))
        : 0;

    const baseForProfit = projectCost + cardFeeCents;

    let profitPercent = Number(form.profitPercent || 0);
    if (!Number.isFinite(profitPercent) || profitPercent < 0) profitPercent = 0;

    const targetProfitCents = Math.round(baseForProfit * (profitPercent / 100));
    const totalBeforeDiscount = baseForProfit + targetProfitCents;

    let discountCents = 0;
    let discountPct = 0;

    if (form.paymentMode === "AVISTA") {
      if (form.discountType === "PERCENT") {
        discountPct = Number(form.discountPreset || 0) || 0;
        discountCents = Math.round(totalBeforeDiscount * (discountPct / 100));
      } else {
        discountCents = parseBRLToCents(form.discount);
      }
    }

    if (discountCents > totalBeforeDiscount) discountCents = totalBeforeDiscount;

    const totalCliente = Math.max(0, totalBeforeDiscount - discountCents);
    const profit = totalCliente - baseForProfit;
    const margin = totalCliente > 0 ? (profit / totalCliente) * 100 : 0;

    // distribui o subtotal (antes do desconto) nos itens, pra exibir valor unit e total por item
    const allocation = allocateTotalAcrossItems(
      items.map((it, idx) => ({
        quantity: Math.max(1, it.quantity || 1),
        materialsCostPerUnitCents: itemsInfo[idx]?.materialsCostPerUnitCents || 0,
      })),
      totalBeforeDiscount
    );

    return {
      dailyRateCents,
      days,
      laborCents,
      costItems,
      projectCost,
      cardFeePercent,
      cardFeeCents,
      baseForProfit,
      profitPercent,
      totalBeforeDiscount,
      discountCents,
      discountPct,
      totalCliente,
      profit,
      margin,
      allocation,
    };
  }, [form, items]);

  // ===== ITEMS handlers =====
  function addItem() {
    setItems((p) => [...p, { id: uid("it"), name: "", description: "", quantity: 1, materials: [] }]);
  }

  function removeItem(id: string) {
    setItems((p) => (p.length <= 1 ? p : p.filter((x) => x.id !== id)));
  }

  // ===== SAVE =====
  async function saveBudget() {
    if (!form.clientId) return alert("Selecione um cliente.");
    if (!items.length) return alert("Adicione pelo menos 1 item.");

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.name.trim() || it.name.trim().length < 2) return alert(`Item ${i + 1}: informe o nome.`);
      if (!Number.isFinite(it.quantity) || it.quantity <= 0) return alert(`Item ${i + 1}: quantidade inválida.`);
    }

    if (calc.projectCost <= 0) {
      return alert("Informe materiais e/ou custo do dia para gerar um custo do projeto > 0.");
    }

    // entrega: data escolhida OU hoje + dias
    let expectedDeliveryAt: string | null = null;
    const picked = safeDateISO(form.expectedDeliveryAt);
    if (picked) expectedDeliveryAt = picked;
    else if (calc.days > 0) {
      const d = new Date();
      d.setDate(d.getDate() + calc.days);
      expectedDeliveryAt = d.toISOString();
    }

    let installmentsCount = 1;
    if (form.paymentMode === "PARCELADO") {
      installmentsCount = clamp(Number(form.installmentsCount || 2), 2, 24);
      if (installmentsCount < 2 || installmentsCount > 24) return alert("Parcelas deve ser entre 2 e 24.");
    }

    const payload: SaveBudgetPayload = {
      clientId: form.clientId,
      expectedDeliveryAt,
      notes: form.notes?.trim() || "",

      discountCents: calc.discountCents,
      discountType: form.discountType,
      discountPercent: form.discountType === "PERCENT" ? calc.discountPct : null,

      deliveryDays: calc.days,
      dailyRateCents: calc.dailyRateCents,

      paymentMode: form.paymentMode,
      paymentMethod: form.paymentMethod || null,
      installmentsCount,
      firstDueDate: null,

      profitPercent: calc.profitPercent,
      cardFeePercent: calc.cardFeePercent,

      items: items.map((it, idx) => {
        const alloc = calc.allocation[idx] || { unit: 0, total: 0 };

        return {
          name: it.name.trim(),
          description: it.description.trim() ? it.description.trim() : null,
          quantity: Math.max(1, it.quantity || 1),
          unitPriceCents: alloc.unit || 0,
          materials: (it.materials || []).map((m) => ({
            name: m.name.trim(),
            qty: Number(m.qty || 0),
            unitCostCents: parseBRLToCents(m.unit),
          })),
        };
      }),
    };

    setLoading(true);
    try {
      if (editingId) await updateBudgetFull(editingId, payload);
      else await createBudget(payload);

      setOpen(false);
      setEditingId(null);
      await reload();
    } catch (e: any) {
      alert(e?.message || "Erro ao salvar orçamento.");
    } finally {
      setLoading(false);
    }
  }

  // ===== ACTIONS =====
  async function openPdf(id: string) {
    const blob = await downloadBudgetPdf(id);
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  async function actSend(id: string) {
    await sendBudget(id);
  }

  async function actApprove(id: string) {
    const ok = confirm("Aprovar orçamento? Isso vai gerar um PEDIDO + RECEBÍVEIS no Financeiro.");
    if (!ok) return;
    await approveBudget(id);
  }

  async function actCancel(id: string) {
    const ok = confirm("Cancelar orçamento?");
    if (!ok) return;
    await cancelBudget(id);
  }

  async function actDelete(id: string) {
    const ok = confirm("Excluir orçamento? (apaga itens e parcelas)");
    if (!ok) return;
    await deleteBudget(id);
  }

  // ===== UI =====
  const kpis = useMemo(() => {
    const total = budgets.reduce((a, b) => a + (b.totalCents || 0), 0);
    const count = budgets.length;
    const approved = budgets.filter((b) => b.status === "APROVADO").length;
    const sent = budgets.filter((b) => b.status === "ENVIADO").length;
    return { total, count, approved, sent };
  }, [budgets]);

  const discountEnabled = form.paymentMode === "AVISTA";
  const installmentsVisible = form.paymentMode === "PARCELADO";
  const showCardFee = calc.cardFeeCents > 0;

  return (
    <div ref={wrapRef} className="space-y-4">
      <div data-stagger>
        <PageHeader
          title="Orçamentos"
          subtitle="M5 conectado: cálculo + PDF + enviar/aprovar/cancelar/excluir."
          badge={{ label: "M5", tone: "brand" }}
          right={
            <div className="flex items-center gap-2">
              <Button variant="soft" onClick={reload}>
                <RefreshCw className="h-4 w-4" /> Atualizar
              </Button>
              <Button variant="dark" onClick={openNew}>
                <Plus className="h-4 w-4" /> Novo orçamento
              </Button>
            </div>
          }
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
                <Badge tone="brand">Cálculo + PDF</Badge>
                {loading ? <Badge tone="ink">Carregando…</Badge> : <Badge tone="success">Online</Badge>}
              </div>
              <div className="mt-2 font-display text-lg font-black text-[color:var(--ink)]">Pipeline de orçamento</div>
              <div className="mt-1 text-sm font-semibold text-[color:var(--muted)]">
                Materiais + custo do dia + lucro + taxa cartão + desconto à vista.
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge tone="ink">Itens: {budgets.length}</Badge>
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

      {/* KPIs */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-stagger>
        <GlassCard className="p-4">
          <div className="text-xs font-extrabold text-[color:var(--muted)]">Orçamentos</div>
          <div className="mt-2 font-display text-2xl font-black text-[color:var(--ink)]">{kpis.count}</div>
          <div className="mt-2 text-xs font-semibold text-[color:var(--muted)]">No filtro atual</div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="text-xs font-extrabold text-[color:var(--muted)]">Total</div>
          <div className="mt-2 font-display text-2xl font-black text-[color:var(--ink)]">{moneyBRLFromCents(kpis.total)}</div>
          <div className="mt-2 text-xs font-semibold text-[color:var(--muted)]">Somatório</div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="text-xs font-extrabold text-[color:var(--muted)]">Enviados</div>
          <div className="mt-2 font-display text-2xl font-black text-[color:var(--ink)]">{kpis.sent}</div>
          <div className="mt-2 text-xs font-semibold text-[color:var(--muted)]">Aguardando aprovação</div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="text-xs font-extrabold text-[color:var(--muted)]">Aprovados</div>
          <div className="mt-2 font-display text-2xl font-black text-[color:var(--ink)]">{kpis.approved}</div>
          <div className="mt-2 text-xs font-semibold text-[color:var(--muted)]">Viraram pedidos</div>
        </GlassCard>
      </section>

      {/* Filtros */}
      <div data-stagger>
        <Toolbar
          left={
            <>
              <div className="w-[220px]">
                <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="">Todos status</option>
                  <option value="RASCUNHO">RASCUNHO</option>
                  <option value="ENVIADO">ENVIADO</option>
                  <option value="APROVADO">APROVADO</option>
                  <option value="REJEITADO">REJEITADO</option>
                  <option value="CANCELADO">CANCELADO</option>
                </Select>
              </div>

              <div className="w-[420px] max-w-full">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--muted)]" />
                  <Input
                    className="pl-10"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Buscar por cliente/telefone/observação…"
                    onKeyDown={(e) => e.key === "Enter" && reload()}
                  />
                </div>
              </div>

              <Button variant="soft" onClick={reload}>
                <RefreshCw className="h-4 w-4" /> Buscar
              </Button>
            </>
          }
          right={<Badge tone="ink">Atualizado</Badge>}
        />
      </div>

      {/* Tabela */}
      <div data-stagger>
        <DataTable
          title="Orçamentos"
          subtitle="GET /api/budgets • PDF /api/budgets/:id/pdf"
          rows={budgets}
          rowKey={(r) => r.id}
          columns={[
            {
              header: "Status",
              cell: (b: Budget) => <StatusPill tone={statusTone(b.status) as any} label={b.status} />,
            },
            {
              header: "Cliente",
              cell: (b: Budget) => (
                <div>
                  <div className="font-extrabold">{b.client?.name || "—"}</div>
                  <div className="text-xs font-semibold text-[color:var(--muted)]">{b.client?.phone || ""}</div>
                </div>
              ),
            },
            { header: "Criado", cell: (b: Budget) => isoToBR(b.createdAt) },
            { header: "Entrega", cell: (b: Budget) => isoToBR(b.expectedDeliveryAt) },
            { header: "Pagamento", cell: (b: Budget) => payLabel(b) },
            { header: "Total", className: "text-right font-extrabold", cell: (b: Budget) => moneyBRLFromCents(b.totalCents) },
            {
              header: "Ações",
              className: "text-right",
              cell: (b: Budget) => {
                const canEdit = b.status !== "APROVADO" && b.status !== "CANCELADO";
                const canSend = b.status === "RASCUNHO";
                const canApprove = b.status !== "APROVADO" && b.status !== "CANCELADO";
                const canCancel = b.status !== "APROVADO" && b.status !== "CANCELADO";
                const canDelete = b.status !== "APROVADO";

                return (
                  <div className="flex justify-end gap-2 flex-wrap">
                    <Button variant="ghost" onClick={() => openPdf(b.id)}>
                      <FileText className="h-4 w-4" /> PDF
                    </Button>

                    {canEdit ? (
                      <Button variant="ghost" onClick={() => openEdit(b.id)}>
                        <Pencil className="h-4 w-4" /> Editar
                      </Button>
                    ) : null}

                    <Button
                      variant="ghost"
                      onClick={async () => {
                        try {
                          await actSend(b.id);
                          await reload();
                        } catch (e: any) {
                          alert(e?.message || "Erro ao enviar.");
                        }
                      }}
                      disabled={!canSend}
                    >
                      <Send className="h-4 w-4" /> Enviar
                    </Button>

                    <Button
                      variant="ghost"
                      onClick={async () => {
                        try {
                          await actApprove(b.id);
                          await reload();
                        } catch (e: any) {
                          alert(e?.message || "Erro ao aprovar.");
                        }
                      }}
                      disabled={!canApprove}
                    >
                      <CheckCircle2 className="h-4 w-4" /> Aprovar
                    </Button>

                    <Button
                      variant="ghost"
                      onClick={async () => {
                        try {
                          await actCancel(b.id);
                          await reload();
                        } catch (e: any) {
                          alert(e?.message || "Erro ao cancelar.");
                        }
                      }}
                      disabled={!canCancel}
                    >
                      <XCircle className="h-4 w-4" /> Cancelar
                    </Button>

                    {canDelete ? (
                      <Button
                        variant="ghost"
                        onClick={async () => {
                          try {
                            await actDelete(b.id);
                            await reload();
                          } catch (e: any) {
                            alert(e?.message || "Erro ao excluir.");
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" /> Excluir
                      </Button>
                    ) : null}
                  </div>
                );
              },
            },
          ]}
        />
      </div>

      {/* MODAL ORÇAMENTO */}
      <Modal
  open={open}
  title={editingId ? "Editar orçamento" : "Novo orçamento"}
  subtitle="POST /api/budgets • PATCH fallback /:id/full -> /:id"
  onClose={() => setOpen(false)}
  maxWidth="max-w-[1240px]"
  footer={
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <Badge tone="brand">Total: {moneyBRLFromCents(calc.totalCliente)}</Badge>
        {showCardFee ? <Badge tone="wood">Taxa cartão: {moneyBRLFromCents(calc.cardFeeCents)}</Badge> : null}
        {form.paymentMode === "AVISTA" ? <Badge tone="ink">Desconto ativo</Badge> : <Badge tone="neutral">Sem desconto</Badge>}
      </div>
      <div className="flex gap-2">
        <Button variant="soft" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
        <Button variant="dark" onClick={saveBudget}>
          Salvar
        </Button>
      </div>
    </div>
  }
>
  {/* ✅ impede o modal inteiro de ganhar scroll horizontal */}
  <div className="min-w-0 overflow-x-hidden">
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
      {/* LEFT */}
      <div className="min-w-0 space-y-4">
        <GlassCard className="p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Cliente</div>
              <Select value={form.clientId} onChange={(e) => setForm((p) => ({ ...p, clientId: e.target.value }))}>
                <option value="">Selecione</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `• ${c.phone}` : ""}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Entrega (data)</div>
              <Input
                type="date"
                value={form.expectedDeliveryAt}
                onChange={(e) => setForm((p) => ({ ...p, expectedDeliveryAt: e.target.value }))}
              />
            </div>

            <div>
              <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Dias de fabricação</div>
              <Input
                value={String(form.deliveryDays)}
                onChange={(e) => setForm((p) => ({ ...p, deliveryDays: Math.max(0, Number(e.target.value || 0)) }))}
              />
            </div>

            <div>
              <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Custo do dia (R$)</div>
              <Input value={form.dailyRate} onChange={(e) => setForm((p) => ({ ...p, dailyRate: e.target.value }))} />
            </div>

            <div>
              <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Lucro (%)</div>
              <div className="relative">
                <Percent className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--muted)]" />
                <Input
                  className="pl-10"
                  value={String(form.profitPercent)}
                  onChange={(e) => setForm((p) => ({ ...p, profitPercent: Math.max(0, Number(e.target.value || 0)) }))}
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Observações</div>
              <textarea
                className="pill min-h-[90px] w-full px-3 py-2 text-sm font-semibold text-[color:var(--ink)] outline-none"
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Observações do orçamento…"
              />
            </div>
          </div>
        </GlassCard>

        {/* Pagamento + desconto */}
        <GlassCard className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-display text-sm font-black text-[color:var(--ink)]">Pagamento</div>
              <div className="text-xs font-semibold text-[color:var(--muted)]">
                Desconto só à vista. Taxa cartão só parcelado + cartão.
              </div>
            </div>
            <Badge tone="wood">
              <CreditCard className="h-3.5 w-3.5" /> {form.paymentMode}
            </Badge>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Modo</div>
              <Select
                value={form.paymentMode}
                onChange={(e) => {
                  const v = e.target.value as PayMode;
                  setForm((p) => ({
                    ...p,
                    paymentMode: v,
                    ...(v === "PARCELADO"
                      ? { discountType: "VALOR" as DiscountType, discount: "0,00", discountPreset: 0 }
                      : {}),
                  }));
                }}
              >
                <option value="AVISTA">À vista</option>
                <option value="PARCELADO">Parcelado</option>
              </Select>
            </div>

            <div>
              <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Método</div>
              <Select value={form.paymentMethod} onChange={(e) => setForm((p) => ({ ...p, paymentMethod: e.target.value }))}>
                <option value="">Selecione</option>
                <option value="PIX">PIX</option>
                <option value="DINHEIRO">DINHEIRO</option>
                <option value="CARTAO">CARTÃO</option>
                <option value="BOLETO">BOLETO</option>
              </Select>
            </div>

            {installmentsVisible ? (
              <div>
                <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Parcelas</div>
                <Input
                  value={String(form.installmentsCount)}
                  onChange={(e) => setForm((p) => ({ ...p, installmentsCount: clamp(Number(e.target.value || 2), 2, 24) }))}
                />
              </div>
            ) : (
              <div className="sm:col-span-1 rounded-2xl border border-[color:var(--line)] bg-white/40 p-3 text-xs font-semibold text-[color:var(--muted)]">
                Desconto habilitado (à vista)
              </div>
            )}

            <div>
              <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Tipo desconto</div>
              <Select
                value={form.discountType}
                disabled={!discountEnabled}
                onChange={(e) => setForm((p) => ({ ...p, discountType: e.target.value as DiscountType }))}
              >
                <option value="VALOR">VALOR</option>
                <option value="PERCENT">PERCENT</option>
              </Select>
            </div>

            {form.discountType === "VALOR" ? (
              <div>
                <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Desconto (R$)</div>
                <Input value={form.discount} disabled={!discountEnabled} onChange={(e) => setForm((p) => ({ ...p, discount: e.target.value }))} />
              </div>
            ) : (
              <div>
                <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Desconto (%)</div>
                <Select
                  value={String(form.discountPreset)}
                  disabled={!discountEnabled}
                  onChange={(e) => setForm((p) => ({ ...p, discountPreset: Number(e.target.value || 0) }))}
                >
                  <option value="0">0%</option>
                  <option value="3">3%</option>
                  <option value="5">5%</option>
                  <option value="10">10%</option>
                </Select>
              </div>
            )}
          </div>
        </GlassCard>

        {/* Itens */}
        <GlassCard className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-display text-sm font-black text-[color:var(--ink)]">Itens</div>
              <div className="text-xs font-semibold text-[color:var(--muted)]">
                Valor unitário é calculado pelo motor (distribuição do total).
              </div>
            </div>
            <Button variant="soft" onClick={addItem}>
              <Plus className="h-4 w-4" /> Adicionar item
            </Button>
          </div>

          {/* ✅ scroll só aqui */}
          <div className="mt-3 min-w-0 overflow-x-auto rounded-2xl border border-[color:var(--line)] bg-white/35">
            <table className="w-full min-w-[1150px] table-fixed text-sm">
              <colgroup>{["w-[220px]","w-[260px]","w-[90px]","w-[130px]","w-[140px]","w-[120px]","w-[120px]","w-[80px]"].map((c,i)=>(<col key={i} className={c} />))}</colgroup>
              <thead className="bg-white/55">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-extrabold text-[color:var(--muted)]">Item</th>
                  <th className="px-4 py-3 text-left text-xs font-extrabold text-[color:var(--muted)]">Descrição</th>
                  <th className="px-4 py-3 text-left text-xs font-extrabold text-[color:var(--muted)]">Qtd</th>
                  <th className="px-4 py-3 text-left text-xs font-extrabold text-[color:var(--muted)]">Valor (R$)</th>
                  <th className="px-4 py-3 text-left text-xs font-extrabold text-[color:var(--muted)]">Materiais</th>
                  <th className="px-4 py-3 text-right text-xs font-extrabold text-[color:var(--muted)]">Custo</th>
                  <th className="px-4 py-3 text-right text-xs font-extrabold text-[color:var(--muted)]">Total</th>
                  <th className="px-4 py-3 text-right text-xs font-extrabold text-[color:var(--muted)]">Ação</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => {
                  const alloc = calc.allocation[idx] || { unit: 0, total: 0 };

                  const materialsCostPerUnit = (it.materials || []).reduce((acc, m) => {
                    const qtt = Number(m.qty || 0);
                    const unit = parseBRLToCents(m.unit);
                    return acc + Math.max(0, qtt) * Math.max(0, unit);
                  }, 0);

                  const costTotalItem = Math.max(1, it.quantity || 1) * materialsCostPerUnit;

                  return (
                    <tr key={it.id} className="border-t border-[color:var(--line)]">
                      <td className="px-4 py-3">
                        <Input
                          value={it.name}
                          onChange={(e) => setItems((p) => p.map((x) => (x.id === it.id ? { ...x, name: e.target.value } : x)))}
                          placeholder="Ex: Armário planejado"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Input
                          value={it.description}
                          onChange={(e) => setItems((p) => p.map((x) => (x.id === it.id ? { ...x, description: e.target.value } : x)))}
                          placeholder="Detalhes (opcional)"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Input
                          value={String(it.quantity)}
                          onChange={(e) =>
                            setItems((p) =>
                              p.map((x) => (x.id === it.id ? { ...x, quantity: clamp(Number(e.target.value || 1), 1, 9999) } : x))
                            )
                          }
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Input value={String((alloc.unit / 100).toFixed(2)).replace(".", ",")} readOnly />
                      </td>
                      <td className="px-4 py-3">
                        <Button variant="ghost" onClick={() => openMaterials(it.id)}>
                          <Boxes className="h-4 w-4" /> Materiais
                        </Button>
                      </td>
                      <td className="px-4 py-3 text-right font-extrabold">{moneyBRLFromCents(costTotalItem)}</td>
                      <td className="px-4 py-3 text-right font-extrabold">{moneyBRLFromCents(alloc.total)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" onClick={() => removeItem(it.id)} disabled={items.length <= 1}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </div>

      {/* RIGHT */}
      <div className="min-w-0 space-y-4">
        <GlassCard className="relative overflow-hidden p-4">
          <div className="pointer-events-none absolute -top-10 -right-10 h-44 w-44 rounded-full bg-[rgba(247,211,32,0.18)] blur-3xl" />
          <div className="relative">
            <div className="font-display text-sm font-black text-[color:var(--ink)]">Resumo do orçamento</div>

            <div className="mt-3 space-y-2 text-sm font-semibold">
              <div className="flex items-center justify-between">
                <span className="text-[color:var(--muted)]">Subtotal</span>
                <span className="font-extrabold text-[color:var(--ink)]">{moneyBRLFromCents(calc.totalBeforeDiscount)}</span>
              </div>

              {showCardFee ? (
                <div className="flex items-center justify-between">
                  <span className="text-[color:var(--muted)]">Taxa cartão ({calc.cardFeePercent.toFixed(1)}%)</span>
                  <span className="font-extrabold text-[color:var(--ink)]">{moneyBRLFromCents(calc.cardFeeCents)}</span>
                </div>
              ) : null}

              <div className="flex items-center justify-between">
                <span className="text-[color:var(--muted)]">Desconto</span>
                <span className="font-extrabold text-[color:var(--ink)]">- {moneyBRLFromCents(calc.discountCents)}</span>
              </div>

              <div className="h-px bg-black/10" />

              <div className="flex items-center justify-between">
                <span className="text-[color:var(--muted)]">Total cliente</span>
                <span className="font-display text-xl font-black text-[color:var(--ink)]">{moneyBRLFromCents(calc.totalCliente)}</span>
              </div>

              {form.paymentMode === "PARCELADO" ? (
                <div className="mt-2 rounded-2xl border border-[color:var(--line)] bg-white/45 p-3">
                  <div className="text-xs font-extrabold text-[color:var(--muted)]">Parcelado</div>
                  <div className="mt-1 font-extrabold text-[color:var(--ink)]">
                    {clamp(Number(form.installmentsCount || 2), 2, 24)}x •{" "}
                    {moneyBRLFromCents(
                      Math.round(
                        calc.totalCliente / clamp(Number(form.installmentsCount || 2), 2, 24)
                      )
                    )}
                  </div>
                  <div className="mt-1 text-xs font-semibold text-[color:var(--muted)]">(no PDF aparece total + parcelas)</div>
                </div>
              ) : (
                <div className="mt-2 rounded-2xl border border-[color:var(--line)] bg-white/45 p-3">
                  <div className="text-xs font-extrabold text-[color:var(--muted)]">À vista</div>
                  <div className="mt-1 font-extrabold text-[color:var(--ink)]">{form.paymentMethod || "—"}</div>
                </div>
              )}
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="font-display text-sm font-black text-[color:var(--ink)]">Custos & margem</div>

          <div className="mt-3 space-y-2 text-sm font-semibold">
            <div className="flex items-center justify-between">
              <span className="text-[color:var(--muted)]">Custo materiais</span>
              <span className="font-extrabold text-[color:var(--ink)]">{moneyBRLFromCents(calc.costItems)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[color:var(--muted)]">Custo fabricação</span>
              <span className="font-extrabold text-[color:var(--ink)]">{moneyBRLFromCents(calc.laborCents)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[color:var(--muted)]">Custo projeto</span>
              <span className="font-extrabold text-[color:var(--ink)]">{moneyBRLFromCents(calc.projectCost)}</span>
            </div>

            <div className="h-px bg-black/10" />

            <div className="flex items-center justify-between">
              <span className="text-[color:var(--muted)]">Lucro</span>
              <span className="font-extrabold text-[color:var(--ink)]">{moneyBRLFromCents(calc.profit)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[color:var(--muted)]">Margem</span>
              <span className="font-extrabold text-[color:var(--ink)]">{calc.margin.toFixed(1)}%</span>
            </div>

            <div className="mt-2 rounded-2xl border border-[color:var(--line)] bg-white/45 p-3 text-xs font-semibold text-[color:var(--muted)]">
              <div className="flex items-center gap-2">
                <Hammer className="h-4 w-4" /> Motor idêntico ao legado (M5): materiais + custo do dia + lucro + taxa cartão + desconto à vista.
              </div>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  </div>
</Modal>

      {/* MODAL MATERIAIS */}
      <Modal
        open={matOpen}
        title="Materiais do item"
        subtitle="Sugere custo pelo estoque (bestSupplier/defaultUnitCost)."
        onClose={closeMaterials}
        maxWidth="max-w-[1100px]"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="soft" onClick={closeMaterials}>Cancelar</Button>
            <Button variant="dark" onClick={saveMaterialsToItem}>Salvar materiais</Button>
          </div>
        }
      >
        {/* datalist */}
        <datalist id="materialsCatalogList">
          {materialsCatalog.map((m) => (
            <option key={m.id} value={m.name} />
          ))}
        </datalist>

        <GlassCard className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-display text-sm font-black text-[color:var(--ink)]">Lista de materiais</div>
              <div className="text-xs font-semibold text-[color:var(--muted)]">Digite e selecione do estoque (ou manual).</div>
            </div>
            <Button
              variant="soft"
              onClick={() => setMatDraft((p) => [...p, { id: uid("m"), name: "", qty: 1, unit: "" }])}
            >
              <Plus className="h-4 w-4" /> Adicionar
            </Button>
          </div>

          <div className="mt-3 overflow-x-auto lg:overflow-x-hidden rounded-2xl border border-[color:var(--line)] bg-white/35">
          <table className="w-full min-w-0 table-fixed text-sm">
            <colgroup><col /><col className="w-[140px]" /><col className="w-[180px]" /><col className="w-[140px]" /><col className="w-[80px]" /></colgroup>
              <thead className="bg-white/55">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-extrabold text-[color:var(--muted)]">Material</th>
                  <th className="px-4 py-3 text-left text-xs font-extrabold text-[color:var(--muted)]">Qtd</th>
                  <th className="px-4 py-3 text-left text-xs font-extrabold text-[color:var(--muted)]">Custo unit (R$)</th>
                  <th className="px-4 py-3 text-right text-xs font-extrabold text-[color:var(--muted)]">Total</th>
                  <th className="px-4 py-3 text-right text-xs font-extrabold text-[color:var(--muted)]">Ação</th>
                </tr>
              </thead>
              <tbody>
                {matDraft.map((m) => {
                  const rowTotal = Math.round(Number(m.qty || 0) * parseBRLToCents(m.unit));
                  return (
                    <tr key={m.id} className="border-t border-[color:var(--line)]">
                      <td className="px-4 py-3">
                        <Input
                          list="materialsCatalogList"
                          value={m.name}
                          onChange={(e) => {
                            const v = e.target.value;
                            setMatDraft((p) =>
                              p.map((x) =>
                                x.id === m.id ? { ...x, name: v, unit: maybeAutofillUnit(v, x.unit) } : x
                              )
                            );
                          }}
                          onBlur={() => {
                            setMatDraft((p) =>
                              p.map((x) => (x.id === m.id ? { ...x, unit: maybeAutofillUnit(x.name, x.unit) } : x))
                            );
                          }}
                          placeholder="Ex: MDF 18mm"
                        />
                      </td>
                      <td className="px-4 py-3 w-[160px]">
                        <Input
                          value={String(m.qty)}
                          onChange={(e) =>
                            setMatDraft((p) => p.map((x) => (x.id === m.id ? { ...x, qty: Number(e.target.value || 0) } : x)))
                          }
                        />
                      </td>
                      <td className="px-4 py-3 w-[220px]">
                        <Input
                          value={m.unit}
                          onChange={(e) => setMatDraft((p) => p.map((x) => (x.id === m.id ? { ...x, unit: e.target.value } : x)))}
                          placeholder="0,00"
                        />
                      </td>
                      <td className="px-4 py-3 text-right font-extrabold">{moneyBRLFromCents(rowTotal)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          onClick={() => setMatDraft((p) => (p.length <= 1 ? p : p.filter((x) => x.id !== m.id)))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </Modal>
    </div>
  );
}