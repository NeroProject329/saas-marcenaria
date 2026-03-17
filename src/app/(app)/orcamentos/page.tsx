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
import {
  moneyBRLFromCents,
  isoToBR,
  isoToDateInput,
  parseBRLToCents,
  clamp,
  uid,
} from "@/lib/format";
import type { Client } from "@/lib/types";
import { budgetStatusLabel, budgetStatusTone } from "@/lib/status";

import { listClients, createClient } from "@/services/clients.service";
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
  unit: string;
};

function currentMonthYYYYMM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}


function payLabel(b: Budget) {
  const count = Math.max(1, Number(b.installmentsCount || 1));
  const cash = Number(b.cashTotalCents ?? b.totalCents ?? 0);
  const installmentTotal = Number(b.installmentTotalCents ?? b.totalCents ?? 0);
  const installmentAmount = Number(
    b.installmentAmountCents ?? Math.round(installmentTotal / count)
  );

  return `À vista ${moneyBRLFromCents(cash)} • ${count}x de ${moneyBRLFromCents(installmentAmount)}`;
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

function allocateTotalAcrossItems(
  items: Array<{ quantity: number; materialsCostPerUnitCents: number }>,
  totalCents: number
) {
  const n = items.length;
  if (!n) return [];

  let weights = items.map(
    (it) => it.quantity * (it.materialsCostPerUnitCents || 0)
  );
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

  useGsapStagger(wrapRef, {
    selector: "[data-stagger]",
    y: 14,
    duration: 0.5,
    stagger: 0.05,
  });

  const [status, setStatus] = useState<string>("");
  const [q, setQ] = useState("");
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const list = await listBudgets({
        status: status || undefined,
        q: q.trim() || undefined,
      });
      setBudgets(list);
    } catch (e: any) {
      setError(e?.message || "Erro ao carregar orçamentos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [clients, setClients] = useState<Client[]>([]);
  const [materialsCatalog, setMaterialsCatalog] = useState<Material[]>([]);
  const [materialsMap, setMaterialsMap] = useState<Record<string, Material>>(
    {}
  );

  const [form, setForm] = useState({
    clientId: "",
    expectedDeliveryAt: "",
    notes: "",

    dailyRate: "0,00",
    deliveryDays: 0,
    profitPercent: 30,

    discountType: "VALOR" as DiscountType,
    discount: "0,00",
   discountPreset: "0",

paymentMode: "PARCELADO" as PayMode,
paymentMethod: "CARTAO",
installmentsCount: 3,
cardFeePercent: "12,30",
  });

  const [items, setItems] = useState<ItemDraft[]>([
    { id: uid("it"), name: "", description: "", quantity: 1, materials: [] },
  ]);

  const [clientOpen, setClientOpen] = useState(false);
  const [clientForm, setClientForm] = useState({
    name: "",
    phone: "",
    email: "",
    cpf: "",
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "",
    notes: "",
  });

  async function createClientQuick() {
    if (!clientForm.name.trim() || !clientForm.phone.trim()) {
      alert("Preencha pelo menos nome e telefone do cliente.");
      return;
    }

    setLoading(true);
    try {
      const created = await createClient({
        name: clientForm.name.trim(),
        phone: clientForm.phone.trim(),
        type: "CLIENTE",
        cpf: clientForm.cpf || null,
        email: clientForm.email || null,
        cep: clientForm.cep || null,
        logradouro: clientForm.logradouro || null,
        numero: clientForm.numero || null,
        complemento: clientForm.complemento || null,
        bairro: clientForm.bairro || null,
        cidade: clientForm.cidade || null,
        estado: clientForm.estado || null,
        notes: clientForm.notes || null,
      });

      const c = await listClients();
      setClients(c);
      setForm((p) => ({ ...p, clientId: created.id }));

      setClientForm({
        name: "",
        phone: "",
        email: "",
        cpf: "",
        cep: "",
        logradouro: "",
        numero: "",
        complemento: "",
        bairro: "",
        cidade: "",
        estado: "",
        notes: "",
      });

      setClientOpen(false);
    } catch (e: any) {
      alert(e?.message || "Erro ao cadastrar cliente.");
    } finally {
      setLoading(false);
    }
  }

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
    const cached = Number(localStorage.getItem("marcenaria_dailyFixedCents") || 0);
    if (Number.isFinite(cached) && cached > 0) {
      setForm((p) => ({
        ...p,
        dailyRate: String((cached / 100).toFixed(2)).replace(".", ","),
      }));
      return;
    }

    const month = currentMonthYYYYMM();
    const wdRaw = Number(localStorage.getItem("marcenaria_workDays") || 21);
    const workDays = Number.isFinite(wdRaw) && wdRaw > 0 ? Math.trunc(wdRaw) : 21;

    try {
      const sum = await getCostsSummary(month, workDays);
      const cents = sum?.totals?.dailyFixedCents ?? 0;
      if (Number.isFinite(cents) && cents >= 0) {
        setForm((p) => ({
          ...p,
          dailyRate: String((cents / 100).toFixed(2)).replace(".", ","),
        }));
      }
    } catch {}
  }

  async function openNew() {
    await ensureCatalogsLoaded();
    setEditingId(null);

    const loadedClients = clients.length ? clients : await listClients();
    if (!clients.length) setClients(loadedClients);

    setForm({
      clientId: loadedClients[0]?.id || "",
      expectedDeliveryAt: "",
      notes: "",

      dailyRate: "0,00",
      deliveryDays: 0,
      profitPercent: 30,

      discountType: "VALOR",
      discount: "0,00",
     discountPreset: "0",

paymentMode: "PARCELADO",
paymentMethod: "CARTAO",
installmentsCount: 3,
cardFeePercent: "12,30",
    });

    setItems([
      { id: uid("it"), name: "", description: "", quantity: 1, materials: [] },
    ]);

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
        expectedDeliveryAt: b.expectedDeliveryAt
          ? isoToDateInput(b.expectedDeliveryAt)
          : "",
        notes: b.notes || "",

        dailyRate: String((b.dailyRateCents / 100).toFixed(2)).replace(".", ","),
        deliveryDays: b.deliveryDays || 0,
        profitPercent: Number(b.profitPercent ?? 30),

        discountType: (b.discountType || "VALOR") as any,
        discount: String(((b.discountCents || 0) / 100).toFixed(2)).replace(".", ","),
        discountPreset: String(Number(b.discountPercent || 0)).replace(".", ","),

        paymentMode: (b.paymentMode || "PARCELADO") as any,
paymentMethod: b.paymentMethod || "CARTAO",
installmentsCount: b.installmentsCount || 3,
cardFeePercent: String(Number(b.cardFeePercent ?? 12.3).toFixed(2)).replace(".", ","),
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
          : [
              {
                id: uid("it"),
                name: "",
                description: "",
                quantity: 1,
                materials: [],
              },
            ]
      );

      setOpen(true);
    } finally {
      setLoading(false);
    }
  }

  const [matOpen, setMatOpen] = useState(false);
  const [matItemId, setMatItemId] = useState<string | null>(null);
  const [matDraft, setMatDraft] = useState<MaterialLineDraft[]>([
    { id: uid("m"), name: "", qty: 1, unit: "" },
  ]);

  function maybeAutofillUnit(name: string, currentUnit: string) {
    if ((currentUnit || "").trim()) return currentUnit;
    const hit = materialsMap[String(name || "").trim().toLowerCase()] || null;
    const cents = findUnitCostCents(hit);
    return cents > 0
      ? String((cents / 100).toFixed(2)).replace(".", ",")
      : currentUnit;
  }

  function openMaterials(itemId: string) {
    const it = items.find((x) => x.id === itemId);
    setMatItemId(itemId);
    setMatDraft(
      it?.materials?.length
        ? it.materials.map((m) => ({ ...m, id: uid("m") }))
        : [{ id: uid("m"), name: "", qty: 1, unit: "" }]
    );
    setMatOpen(true);
  }

  function closeMaterials() {
    setMatOpen(false);
    setMatItemId(null);
  }

  function saveMaterialsToItem() {
    if (!matItemId) return;

    const clean = matDraft
      .map((m) => ({
        ...m,
        name: m.name.trim(),
        qty: Number(m.qty || 0),
        unit: (m.unit || "").trim(),
      }))
      .filter((m) => m.name && m.qty > 0);

    setItems((prev) =>
      prev.map((it) => (it.id === matItemId ? { ...it, materials: clean } : it))
    );
    closeMaterials();
  }

  const itemsInfo = useMemo(() => {
    return items.map((it) => {
      const qtyItem = Math.max(1, Number(it.quantity || 1));
      const materialsCostPerUnitCents = (it.materials || []).reduce((acc, m) => {
        const qtt = Number(m.qty || 0);
        const unit = parseBRLToCents(m.unit);
        return acc + Math.max(0, qtt) * Math.max(0, unit);
      }, 0);

      return {
        qtyItem,
        materialsCostPerUnitCents,
        materialsTotalCents: qtyItem * materialsCostPerUnitCents,
      };
    });
  }, [items]);

 const calc = useMemo(() => {
  const dailyRateCents = parseBRLToCents(form.dailyRate);
  const days = Math.max(0, Number(form.deliveryDays || 0));
  const laborCents = dailyRateCents * days;

  const materialsCents = itemsInfo.reduce(
    (acc, it) => acc + it.materialsTotalCents,
    0
  );

  const projectCostCents = materialsCents + laborCents;

  let profitPercent = Number(form.profitPercent || 0);
  if (!Number.isFinite(profitPercent) || profitPercent < 0) profitPercent = 0;

  const profitCents = Math.round(projectCostCents * (profitPercent / 100));
  const grossTotalCents = Math.max(0, projectCostCents + profitCents);

  let discountPct = 0;
  let discountCents = 0;

 if (form.discountType === "PERCENT") {
  const parsedDiscountPct = Number(
    String(form.discountPreset || "0").replace(",", ".")
  );
  discountPct =
    Number.isFinite(parsedDiscountPct) && parsedDiscountPct > 0
      ? parsedDiscountPct
      : 0;

  discountCents = Math.round(grossTotalCents * (discountPct / 100));
} else {
  discountCents = parseBRLToCents(form.discount);
}

  if (discountCents > grossTotalCents) {
    discountCents = grossTotalCents;
  }

  const cashTotalCents = Math.max(0, grossTotalCents - discountCents);

  const parsedCard = Number(String(form.cardFeePercent || "0").replace(",", "."));
  const cardFeePercent =
    Number.isFinite(parsedCard) && parsedCard >= 0 ? parsedCard : 0;

  const isCardInstallment =
    String(form.paymentMethod || "").toUpperCase() === "CARTAO";

  const cardFeeCents = isCardInstallment
    ? Math.round(grossTotalCents * (cardFeePercent / 100))
    : 0;

  const installmentTotalCents = Math.max(0, grossTotalCents + cardFeeCents);

  const installmentsCount = clamp(Number(form.installmentsCount || 3), 2, 24);
  const installmentAmountCents = Math.round(
    installmentTotalCents / installmentsCount
  );

  const profitOnCashCents = cashTotalCents - projectCostCents;
  const marginOnCashPct =
    cashTotalCents > 0 ? (profitOnCashCents / cashTotalCents) * 100 : 0;

  const allocation = allocateTotalAcrossItems(
    items.map((it, idx) => ({
      quantity: Math.max(1, it.quantity || 1),
      materialsCostPerUnitCents: itemsInfo[idx]?.materialsCostPerUnitCents || 0,
    })),
    grossTotalCents
  );

  return {
    dailyRateCents,
    days,
    laborCents,
    materialsCents,
    projectCostCents,

    profitPercent,
    profitCents,

    grossTotalCents,

    discountPct,
    discountCents,
    cashTotalCents,

    cardFeePercent,
    cardFeeCents,
    installmentTotalCents,
    installmentAmountCents,
    installmentsCount,

    profitOnCashCents,
    marginOnCashPct,

    allocation,
  };
}, [form, items, itemsInfo]);


  const showCardFee = String(form.paymentMethod || "").toUpperCase() === "CARTAO";

  const kpis = useMemo(() => {
    const drafts = budgets.filter((b) => b.status === "RASCUNHO").length;
    const sent = budgets.filter((b) => b.status === "ENVIADO").length;
    const approved = budgets.filter((b) => b.status === "APROVADO").length;
    const totalApproved = budgets
      .filter((b) => b.status === "APROVADO")
      .reduce((acc, b) => acc + (b.totalCents || 0), 0);

    return { drafts, sent, approved, totalApproved };
  }, [budgets]);

  function addItem() {
    setItems((p) => [
      ...p,
      { id: uid("it"), name: "", description: "", quantity: 1, materials: [] },
    ]);
  }

  function removeItem(id: string) {
    setItems((p) => (p.length <= 1 ? p : p.filter((x) => x.id !== id)));
  }

  async function saveBudget() {
    if (!form.clientId) return alert("Selecione um cliente.");
    if (!items.length) return alert("Adicione pelo menos 1 item.");

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.name.trim() || it.name.trim().length < 2) {
        return alert(`Item ${i + 1}: informe o nome.`);
      }
      if (!Number.isFinite(it.quantity) || it.quantity <= 0) {
        return alert(`Item ${i + 1}: quantidade inválida.`);
      }
    }

    if (calc.projectCostCents <= 0) {
      return alert(
        "Informe materiais e/ou custo do dia para gerar um custo do projeto > 0."
      );
    }

    let expectedDeliveryAt: string | null = null;
    const picked = safeDateISO(form.expectedDeliveryAt);
    if (picked) expectedDeliveryAt = picked;
    else if (calc.days > 0) {
      const d = new Date();
      d.setDate(d.getDate() + calc.days);
      expectedDeliveryAt = d.toISOString();
    }

    const installmentsCount = clamp(Number(form.installmentsCount || 3), 2, 24);
if (installmentsCount < 2 || installmentsCount > 24) {
  return alert("Parcelas deve ser entre 2 e 24.");
}

   const payload: SaveBudgetPayload = {
  clientId: form.clientId,
  expectedDeliveryAt,
  notes: form.notes || "",

  discountCents: calc.discountCents,
  discountType: form.discountType,
  discountPercent: form.discountType === "PERCENT" ? calc.discountPct : undefined,

  deliveryDays: calc.days,
  dailyRateCents: calc.dailyRateCents,

  // técnico / compatibilidade até ajustarmos approveBudget
  paymentMode: "PARCELADO",
 paymentMethod:
  form.paymentMethod === "PIX" ||
  form.paymentMethod === "CARTAO" ||
  form.paymentMethod === "DINHEIRO" ||
  form.paymentMethod === "BOLETO" ||
  form.paymentMethod === "TRANSFERENCIA" ||
  form.paymentMethod === "OUTRO"
    ? form.paymentMethod
    : "CARTAO",
  installmentsCount,
  firstDueDate: expectedDeliveryAt,

  profitPercent: calc.profitPercent,
  cardFeePercent: calc.cardFeePercent,

  items: items.map((it, idx) => {
    const alloc = calc.allocation[idx] || { unit: 0 };

    return {
      name: it.name.trim(),
      description: it.description?.trim() || null,
      quantity: Math.max(1, Number(it.quantity || 1)),
      unitPriceCents: alloc.unit,
      materials: (it.materials || [])
        .map((m) => ({
          name: m.name.trim(),
          qty: Number(m.qty || 0),
          unitCostCents: parseBRLToCents(m.unit),
        }))
        .filter((m) => m.name && m.qty > 0),
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

  async function onSend(id: string) {
    try {
      await sendBudget(id);
      await reload();
    } catch (e: any) {
      alert(e?.message || "Erro ao enviar.");
    }
  }

  async function onApprove(id: string) {
    try {
      await approveBudget(id);
      await reload();
    } catch (e: any) {
      alert(e?.message || "Erro ao aprovar.");
    }
  }

  async function onCancel(id: string) {
    try {
      await cancelBudget(id);
      await reload();
    } catch (e: any) {
      alert(e?.message || "Erro ao cancelar.");
    }
  }

  async function onDelete(id: string) {
    const ok = confirm("Excluir orçamento?");
    if (!ok) return;
    try {
      await deleteBudget(id);
      await reload();
    } catch (e: any) {
      alert(e?.message || "Erro ao excluir.");
    }
  }

 async function onPdf(id: string) {
  try {
    const blob = await downloadBudgetPdf(id);
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e: any) {
    console.error("Erro PDF orçamento:", e);
    alert(e?.message || "Erro ao abrir PDF.");
  }
}

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return budgets.filter((b) => {
      if (status && b.status !== status) return false;
      if (!qq) return true;
      const hay = `${b.client?.name || ""} ${b.notes || ""} ${payLabel(b)} ${
        b.status
      }`.toLowerCase();
      return hay.includes(qq);
    });
  }, [budgets, status, q]);

  return (
    <div ref={wrapRef} className="space-y-4">
      <div data-stagger>
        <PageHeader
          title="Orçamentos"
          subtitle="Motor de orçamento conectado ao backend com PDF, envio e aprovação."
          badge={{ label: "M5", tone: "brand" }}
          right={
            <Tabs
              items={[{ key: "budgets", label: "Orçamentos" }]}
              value="budgets"
              onChange={() => {}}
            />
          }
        />
      </div>

      <div data-stagger>
        <GlassCard className="relative overflow-hidden p-4 sm:p-5">
          <div className="pointer-events-none absolute -top-12 -right-12 h-56 w-56 rounded-full blur-3xl bg-[rgba(247,211,32,0.18)]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[44%] bg-white/30" />
          <div className="relative flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Badge tone="brand">Orçamentos</Badge>
                {loading ? (
                  <Badge tone="ink">Carregando…</Badge>
                ) : (
                  <Badge tone="success">Online</Badge>
                )}
              </div>
              <div className="mt-2 font-display text-lg font-black text-[color:var(--ink)]">
                Orçamentos premium
              </div>
              <div className="mt-1 text-sm font-semibold text-[color:var(--muted)]">
                Motor completo com materiais, custo diário, desconto à vista e taxa da maquininha.
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="soft" onClick={reload}>
                <RefreshCw className="h-4 w-4" /> Atualizar
              </Button>
              <Button variant="dark" onClick={openNew}>
                <Plus className="h-4 w-4" /> Novo orçamento
              </Button>
            </div>
          </div>
        </GlassCard>
      </div>

      {error ? (
        <div data-stagger>
          <GlassCard className="border border-[rgba(220,38,38,0.18)] bg-[rgba(220,38,38,0.06)] p-4">
            <div className="text-sm font-extrabold text-[rgba(220,38,38,0.95)]">
              Erro
            </div>
            <div className="mt-1 text-sm font-semibold text-[color:var(--muted)]">
              {error}
            </div>
          </GlassCard>
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-stagger>
        <GlassCard className="p-4">
          <div className="text-xs font-extrabold text-[color:var(--muted)]">Rascunhos</div>
          <div className="mt-2 font-display text-2xl font-black text-[color:var(--ink)]">
            {kpis.drafts}
          </div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="text-xs font-extrabold text-[color:var(--muted)]">Enviados</div>
          <div className="mt-2 font-display text-2xl font-black text-[color:var(--ink)]">
            {kpis.sent}
          </div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="text-xs font-extrabold text-[color:var(--muted)]">Aprovados</div>
          <div className="mt-2 font-display text-2xl font-black text-[color:var(--ink)]">
            {kpis.approved}
          </div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="text-xs font-extrabold text-[color:var(--muted)]">
            Total aprovado
          </div>
          <div className="mt-2 font-display text-2xl font-black text-[color:var(--ink)]">
            {moneyBRLFromCents(kpis.totalApproved)}
          </div>
        </GlassCard>
      </section>

      <div data-stagger>
        <Toolbar
          left={
            <>
              <div className="w-[280px] max-w-full">
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar orçamento..."
                />
              </div>
              <div className="w-[220px] max-w-full">
                <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="">Todos os status</option>
                  <option value="RASCUNHO">Rascunho</option>
                  <option value="ENVIADO">Enviado</option>
                  <option value="APROVADO">Aprovado</option>
                  <option value="REJEITADO">Rejeitado</option>
                  <option value="CANCELADO">Cancelado</option>
                </Select>
              </div>
              <Button variant="soft" onClick={reload}>
                <Search className="h-4 w-4" /> Buscar
              </Button>
            </>
          }
          right={<Badge tone="ink">Itens: {filtered.length}</Badge>}
        />
      </div>

      <div data-stagger>
        <DataTable
          title="Lista de orçamentos"
          subtitle="PDF, envio, aprovação e cancelamento."
          rows={filtered}
          rowKey={(r) => r.id}
          columns={[
            { header: "Criado", cell: (r) => isoToBR(r.createdAt) },
            { header: "Cliente", cell: (r) => r.client?.name || "—" },
            {
              header: "Status",
              cell: (r) => (
                <StatusPill
                  tone={budgetStatusTone(r.status) as any}
                  label={budgetStatusLabel(r.status)}
                />
              ),
            },
            { header: "Pagamento", cell: (r) => payLabel(r) },
            { header: "Entrega", cell: (r) => isoToBR(r.expectedDeliveryAt || null) },
            {
              header: "Total",
              className: "text-right font-extrabold",
              cell: (r) => moneyBRLFromCents(r.cashTotalCents || r.totalCents || 0),
            },
            {
              header: "Ações",
              className: "text-right",
              cell: (r) => {
                const locked = r.status === "APROVADO" || r.status === "CANCELADO";
                return (
                  <div className="flex justify-end gap-2">
                    <Button variant="soft" onClick={() => openEdit(r.id)} disabled={locked}>
                      <Pencil className="h-4 w-4" /> Editar
                    </Button>
                    <Button variant="soft" onClick={() => onPdf(r.id)}>
                      <FileText className="h-4 w-4" /> PDF
                    </Button>
                    {r.status === "RASCUNHO" ? (
                      <Button variant="soft" onClick={() => onSend(r.id)}>
                        <Send className="h-4 w-4" /> Enviar
                      </Button>
                    ) : null}
                    {r.status === "ENVIADO" ? (
                      <Button variant="soft" onClick={() => onApprove(r.id)}>
                        <CheckCircle2 className="h-4 w-4" /> Aprovar
                      </Button>
                    ) : null}
                    {r.status !== "CANCELADO" && r.status !== "APROVADO" ? (
                      <Button variant="soft" onClick={() => onCancel(r.id)}>
                        <XCircle className="h-4 w-4" /> Cancelar
                      </Button>
                    ) : null}
                    {r.status !== "APROVADO" ? (
                      <Button variant="soft" onClick={() => onDelete(r.id)}>
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

      <Modal
        open={open}
        title={editingId ? "Editar orçamento" : "Novo orçamento"}
        subtitle="POST /api/budgets • PATCH fallback /:id/full -> /:id"
        onClose={() => setOpen(false)}
        maxWidth="max-w-[1240px]"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="brand">Bruto: {moneyBRLFromCents(calc.grossTotalCents)}</Badge>
              <Badge tone="ink">À vista: {moneyBRLFromCents(calc.cashTotalCents)}</Badge>
              <Badge tone="wood">
                {calc.installmentsCount}x de {moneyBRLFromCents(calc.installmentAmountCents)}
              </Badge>
                {showCardFee ? (
                  <Badge tone="neutral">
                    Taxa cartão: {moneyBRLFromCents(calc.cardFeeCents)}
                  </Badge>
                ) : null}
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
        <div className="min-w-0 overflow-x-hidden">
          <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <div className="min-w-0 space-y-4">
              <GlassCard className="p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-[color:var(--muted)]">
                        Cliente
                      </span>
                      <Button variant="soft" onClick={() => setClientOpen(true)}>
                        <Plus className="h-4 w-4" /> Novo cliente
                      </Button>
                    </div>
                    <Select
                      value={form.clientId}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, clientId: e.target.value }))
                      }
                    >
                      <option value="">Selecione</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.phone ? `• ${c.phone}` : ""}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">
                      Entrega (data)
                    </div>
                    <Input
                      type="date"
                      value={form.expectedDeliveryAt}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, expectedDeliveryAt: e.target.value }))
                      }
                    />
                  </div>

                  <div>
                    <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">
                      Dias de fabricação
                    </div>
                    <Input
                      value={String(form.deliveryDays)}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          deliveryDays: Math.max(0, Number(e.target.value || 0)),
                        }))
                      }
                    />
                  </div>

                  <div>
                    <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">
                      Custo do dia (R$)
                    </div>
                    <Input
                      value={form.dailyRate}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, dailyRate: e.target.value }))
                      }
                    />
                  </div>

                  <div>
                    <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">
                      Lucro (%)
                    </div>
                    <div className="relative">
                      <Percent className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--muted)]" />
                      <Input
                        className="pl-10"
                        value={String(form.profitPercent)}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            profitPercent: Math.max(0, Number(e.target.value || 0)),
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">
                      Observações
                    </div>
                    <textarea
                      className="pill min-h-[90px] w-full px-3 py-2 text-sm font-semibold text-[color:var(--ink)] outline-none"
                      value={form.notes}
                      onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                      placeholder="Observações do orçamento…"
                    />
                  </div>
                </div>
              </GlassCard>

              <GlassCard className="p-4">
  <div className="flex flex-wrap items-center justify-between gap-2">
    <div>
      <div className="font-display text-sm font-black text-[color:var(--ink)]">
        Condições do orçamento
      </div>
      <div className="text-xs font-semibold text-[color:var(--muted)]">
        O orçamento envia à vista com desconto e parcelado com taxa juntos.
      </div>
    </div>
    <Badge tone="wood">
      <CreditCard className="h-3.5 w-3.5" /> À vista + Parcelado
    </Badge>
  </div>

  <div className="mt-3 grid gap-3 sm:grid-cols-2">
    <div>
      <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">
        Método do parcelado
      </div>
      <Select
        value={form.paymentMethod}
        onChange={(e) =>
          setForm((p) => ({ ...p, paymentMethod: e.target.value }))
        }
      >
        <option value="CARTAO">CARTÃO</option>
        <option value="PIX">PIX</option>
        <option value="DINHEIRO">DINHEIRO</option>
        <option value="BOLETO">BOLETO</option>
      </Select>
    </div>

    <div>
  <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">
    Parcelas
  </div>
  <Select
    value={String(form.installmentsCount)}
    onChange={(e) =>
      setForm((p) => ({
        ...p,
        installmentsCount: Number(e.target.value || 3),
      }))
    }
  >
    {Array.from({ length: 23 }, (_, i) => {
      const n = i + 2;
      return (
        <option key={n} value={n}>
          {n}x
        </option>
      );
    })}
  </Select>
</div>

    <div>
      <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">
        Taxa da maquininha (%)
      </div>
      <Input
        value={form.cardFeePercent}
        onChange={(e) =>
          setForm((p) => ({ ...p, cardFeePercent: e.target.value }))
        }
        placeholder="Ex: 12,30"
      />
    </div>

    <div>
      <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">
        Tipo desconto à vista
      </div>
      <Select
        value={form.discountType}
        onChange={(e) =>
          setForm((p) => ({
            ...p,
            discountType: e.target.value as DiscountType,
          }))
        }
      >
        <option value="VALOR">VALOR</option>
        <option value="PERCENT">PERCENT</option>
      </Select>
    </div>

    {form.discountType === "VALOR" ? (
      <div>
        <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">
          Desconto à vista (R$)
        </div>
        <Input
          value={form.discount}
          onChange={(e) =>
            setForm((p) => ({ ...p, discount: e.target.value }))
          }
        />
      </div>
    ) : (
     <div>
  <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">
    Desconto à vista (%)
  </div>
  <Input
    value={String(form.discountPreset)}
    onChange={(e) =>
      setForm((p) => ({
        ...p,
        discountPreset: e.target.value,
      }))
    }
    placeholder="Ex: 10 ou 12,5"
  />
</div>
    )}

    <div className="sm:col-span-2 rounded-2xl border border-[color:var(--line)] bg-white/40 p-3 text-xs font-semibold text-[color:var(--muted)]">
      O valor bruto é a base comum. À vista aplica desconto. Parcelado aplica taxa.
    </div>
  </div>
</GlassCard>
            </div>

            <div className="min-w-0 space-y-4">
              <GlassCard className="p-4">
  <div className="font-display text-sm font-black text-[color:var(--ink)]">
    Resumo do orçamento
  </div>

  <div className="mt-3 space-y-3 text-sm font-semibold">
    <div className="flex items-center justify-between">
      <span className="text-[color:var(--muted)]">Valor bruto</span>
      <span className="font-extrabold text-[color:var(--ink)]">
        {moneyBRLFromCents(calc.grossTotalCents)}
      </span>
    </div>

    <div className="rounded-2xl border border-[color:var(--line)] bg-white/45 p-3">
      <div className="text-xs font-extrabold text-[color:var(--muted)]">
        À vista
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-[color:var(--muted)]">Desconto</span>
        <span className="font-extrabold text-[color:var(--ink)]">
          - {moneyBRLFromCents(calc.discountCents)}
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-[color:var(--muted)]">Total à vista</span>
        <span className="font-display text-lg font-black text-[color:var(--ink)]">
          {moneyBRLFromCents(calc.cashTotalCents)}
        </span>
      </div>
    </div>

    <div className="rounded-2xl border border-[color:var(--line)] bg-white/45 p-3">
      <div className="text-xs font-extrabold text-[color:var(--muted)]">
        Parcelado
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-[color:var(--muted)]">
          Taxa ({calc.cardFeePercent.toFixed(2)}%)
        </span>
        <span className="font-extrabold text-[color:var(--ink)]">
          + {moneyBRLFromCents(calc.cardFeeCents)}
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-[color:var(--muted)]">Total parcelado</span>
        <span className="font-display text-lg font-black text-[color:var(--ink)]">
          {moneyBRLFromCents(calc.installmentTotalCents)}
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-[color:var(--muted)]">Parcelas</span>
        <span className="font-extrabold text-[color:var(--ink)]">
          {calc.installmentsCount}x de {moneyBRLFromCents(calc.installmentAmountCents)}
        </span>
      </div>
    </div>
  </div>
</GlassCard>

              <GlassCard className="p-4">
                <div className="font-display text-sm font-black text-[color:var(--ink)]">
                  Custos & margem
                </div>
                <div className="mt-3 space-y-2 text-sm font-semibold">
                  <div className="flex items-center justify-between">
                    <span className="text-[color:var(--muted)]">Custo materiais</span>
                    <span className="font-extrabold text-[color:var(--ink)]">
                      {moneyBRLFromCents(calc.materialsCents)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[color:var(--muted)]">Custo fabricação</span>
                    <span className="font-extrabold text-[color:var(--ink)]">
                      {moneyBRLFromCents(calc.laborCents)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[color:var(--muted)]">Custo projeto</span>
                    <span className="font-extrabold text-[color:var(--ink)]">
                      {moneyBRLFromCents(calc.projectCostCents)}
                    </span>
                  </div>
                  <div className="h-px bg-black/10" />
                  <div className="flex items-center justify-between">
                    <span className="text-[color:var(--muted)]">Lucro</span>
                    <span className="font-extrabold text-[color:var(--ink)]">
                      {moneyBRLFromCents(calc.profitOnCashCents)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[color:var(--muted)]">Margem</span>
                    <span className="font-extrabold text-[color:var(--ink)]">
                      {calc.marginOnCashPct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="mt-2 rounded-2xl border border-[color:var(--line)] bg-white/45 p-3 text-xs font-semibold text-[color:var(--muted)]">
                    <div className="flex items-center gap-2">
                      <Hammer className="h-4 w-4" /> Motor idêntico ao legado
                      (M5): materiais + custo do dia + lucro + taxa cartão +
                      desconto à vista.
                    </div>
                  </div>
                </div>
              </GlassCard>
            </div>

            <div className="min-w-0 lg:col-span-2">
              <GlassCard className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-display text-sm font-black text-[color:var(--ink)]">
                      Itens
                    </div>
                    <div className="text-xs font-semibold text-[color:var(--muted)]">
                      Valor unitário é calculado pelo motor (distribuição do total).
                    </div>
                  </div>

                  <Button variant="soft" onClick={addItem}>
                    <Plus className="h-4 w-4" /> Adicionar item
                  </Button>
                </div>

                <div className="mt-3 min-w-0 overflow-hidden rounded-2xl border border-[color:var(--line)] bg-white/35">
                  <table className="w-full table-fixed text-sm">
                    <colgroup>
  {[
    "w-[16%]",
    "w-[19%]",
    "w-[8%]",
    "w-[12%]",
    "w-[15%]",
    "w-[11%]",
    "w-[11%]",
    "w-[8%]",
  ].map((c, i) => (
    <col key={i} className={c} />
  ))}
</colgroup>
                    <thead className="bg-white/55">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-extrabold text-[color:var(--muted)]">
                          Item
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-extrabold text-[color:var(--muted)]">
                          Descrição
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-extrabold text-[color:var(--muted)]">
                          Qtd
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-extrabold text-[color:var(--muted)]">
                          Valor (R$)
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-extrabold text-[color:var(--muted)]">
                          Materiais
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-extrabold text-[color:var(--muted)]">
                          Custo
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-extrabold text-[color:var(--muted)]">
                          Total
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-extrabold text-[color:var(--muted)]">
                          Ação
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {items.map((it, idx) => {
                        const alloc = calc.allocation[idx] || { unit: 0, total: 0 };

                        const materialsCostPerUnit = (it.materials || []).reduce(
                          (acc, m) => {
                            const qtt = Number(m.qty || 0);
                            const unit = parseBRLToCents(m.unit);
                            return acc + Math.max(0, qtt) * Math.max(0, unit);
                          },
                          0
                        );

                        const costTotalItem =
                          Math.max(1, it.quantity || 1) * materialsCostPerUnit;

                        return (
                          <tr key={it.id} className="border-t border-[color:var(--line)]">
                            <td className="px-4 py-3">
                              <Input
                                value={it.name}
                                onChange={(e) =>
                                  setItems((p) =>
                                    p.map((x) =>
                                      x.id === it.id ? { ...x, name: e.target.value } : x
                                    )
                                  )
                                }
                                placeholder="Ex: Armário planejado"
                              />
                            </td>

                            <td className="px-4 py-3">
                              <Input
                                value={it.description}
                                onChange={(e) =>
                                  setItems((p) =>
                                    p.map((x) =>
                                      x.id === it.id
                                        ? { ...x, description: e.target.value }
                                        : x
                                    )
                                  )
                                }
                                placeholder="Detalhes (opcional)"
                              />
                            </td>

                            <td className="px-4 py-3">
                              <Input
                                value={String(it.quantity)}
                                onChange={(e) =>
                                  setItems((p) =>
                                    p.map((x) =>
                                      x.id === it.id
                                        ? {
                                            ...x,
                                            quantity: clamp(
                                              Number(e.target.value || 1),
                                              1,
                                              9999
                                            ),
                                          }
                                        : x
                                    )
                                  )
                                }
                              />
                            </td>

                            <td className="px-4 py-3">
                              <Input
                                value={String((alloc.unit / 100).toFixed(2)).replace(".", ",")}
                                readOnly
                              />
                            </td>

                            <td className="px-4 py-3">
                              <Button
                                variant="soft"
                                className="w-full justify-center"
                                onClick={() => openMaterials(it.id)}
                              >
                                <Boxes className="h-4 w-4" /> Materiais
                              </Button>
                            </td>

                            <td className="px-4 py-3 text-right font-extrabold">
                              {moneyBRLFromCents(costTotalItem)}
                            </td>

                            <td className="px-4 py-3 text-right font-extrabold">
                              {moneyBRLFromCents(alloc.total)}
                            </td>

                            <td className="px-4 py-3 text-right">
                              <Button
                                variant="ghost"
                                onClick={() => removeItem(it.id)}
                                disabled={items.length <= 1}
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
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={matOpen}
        title="Materiais do item"
        subtitle="Sugere custo pelo estoque (bestSupplier/defaultUnitCost)."
        onClose={closeMaterials}
        maxWidth="max-w-[1100px]"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="soft" onClick={closeMaterials}>
              Cancelar
            </Button>
            <Button variant="dark" onClick={saveMaterialsToItem}>
              Salvar materiais
            </Button>
          </div>
        }
      >
        <datalist id="materialsCatalogList">
          {materialsCatalog.map((m) => (
            <option key={m.id} value={m.name} />
          ))}
        </datalist>

        <GlassCard className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-display text-sm font-black text-[color:var(--ink)]">
                Lista de materiais
              </div>
              <div className="text-xs font-semibold text-[color:var(--muted)]">
                Digite e selecione do estoque (ou manual).
              </div>
            </div>
            <Button
              variant="soft"
              onClick={() =>
                setMatDraft((p) => [...p, { id: uid("m"), name: "", qty: 1, unit: "" }])
              }
            >
              <Plus className="h-4 w-4" /> Adicionar
            </Button>
          </div>

          <div className="mt-3 overflow-x-auto lg:overflow-x-hidden rounded-2xl border border-[color:var(--line)] bg-white/35">
            <table className="w-full min-w-0 table-fixed text-sm">
              <colgroup>
                <col />
                <col className="w-[140px]" />
                <col className="w-[180px]" />
                <col className="w-[140px]" />
                <col className="w-[80px]" />
              </colgroup>
              <thead className="bg-white/55">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-extrabold text-[color:var(--muted)]">
                    Material
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-extrabold text-[color:var(--muted)]">
                    Qtd
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-extrabold text-[color:var(--muted)]">
                    Custo unit (R$)
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-extrabold text-[color:var(--muted)]">
                    Total
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-extrabold text-[color:var(--muted)]">
                    Ação
                  </th>
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
                                x.id === m.id
                                  ? { ...x, name: v, unit: maybeAutofillUnit(v, x.unit) }
                                  : x
                              )
                            );
                          }}
                          onBlur={() =>
                            setMatDraft((p) =>
                              p.map((x) =>
                                x.id === m.id
                                  ? { ...x, unit: maybeAutofillUnit(x.name, x.unit) }
                                  : x
                              )
                            )
                          }
                          placeholder="Ex: MDF 18mm"
                        />
                      </td>

                      <td className="px-4 py-3 w-[160px]">
                        <Input
                          value={String(m.qty)}
                          onChange={(e) =>
                            setMatDraft((p) =>
                              p.map((x) =>
                                x.id === m.id
                                  ? { ...x, qty: Number(e.target.value || 0) }
                                  : x
                              )
                            )
                          }
                        />
                      </td>

                      <td className="px-4 py-3 w-[220px]">
                        <Input
                          value={m.unit}
                          onChange={(e) =>
                            setMatDraft((p) =>
                              p.map((x) =>
                                x.id === m.id ? { ...x, unit: e.target.value } : x
                              )
                            )
                          }
                          placeholder="0,00"
                        />
                      </td>

                      <td className="px-4 py-3 text-right font-extrabold">
                        {moneyBRLFromCents(rowTotal)}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          onClick={() =>
                            setMatDraft((p) =>
                              p.length <= 1 ? p : p.filter((x) => x.id !== m.id)
                            )
                          }
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

      <Modal
        open={clientOpen}
        title="Cadastrar cliente"
        subtitle="Cadastro rápido dentro do orçamento"
        onClose={() => setClientOpen(false)}
        maxWidth="max-w-[760px]"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="soft" onClick={() => setClientOpen(false)}>
              Cancelar
            </Button>
            <Button variant="dark" onClick={createClientQuick}>
              Salvar cliente
            </Button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">
              Nome
            </div>
            <Input
              value={clientForm.name}
              onChange={(e) => setClientForm((p) => ({ ...p, name: e.target.value }))}
            />
          </div>

          <div>
            <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">
              Telefone
            </div>
            <Input
              value={clientForm.phone}
              onChange={(e) => setClientForm((p) => ({ ...p, phone: e.target.value }))}
            />
          </div>

          <div>
            <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">
              E-mail
            </div>
            <Input
              value={clientForm.email}
              onChange={(e) => setClientForm((p) => ({ ...p, email: e.target.value }))}
            />
          </div>

          <div>
            <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">
              CPF
            </div>
            <Input
              value={clientForm.cpf}
              onChange={(e) => setClientForm((p) => ({ ...p, cpf: e.target.value }))}
            />
          </div>

          <div>
            <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">
              CEP
            </div>
            <Input
              value={clientForm.cep}
              onChange={(e) => setClientForm((p) => ({ ...p, cep: e.target.value }))}
            />
          </div>

          <div className="sm:col-span-2">
            <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">
              Logradouro
            </div>
            <Input
              value={clientForm.logradouro}
              onChange={(e) =>
                setClientForm((p) => ({ ...p, logradouro: e.target.value }))
              }
            />
          </div>

          <div>
            <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">
              Número
            </div>
            <Input
              value={clientForm.numero}
              onChange={(e) => setClientForm((p) => ({ ...p, numero: e.target.value }))}
            />
          </div>

          <div>
            <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">
              Complemento
            </div>
            <Input
              value={clientForm.complemento}
              onChange={(e) =>
                setClientForm((p) => ({ ...p, complemento: e.target.value }))
              }
            />
          </div>

          <div>
            <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">
              Bairro
            </div>
            <Input
              value={clientForm.bairro}
              onChange={(e) => setClientForm((p) => ({ ...p, bairro: e.target.value }))}
            />
          </div>

          <div>
            <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">
              Cidade
            </div>
            <Input
              value={clientForm.cidade}
              onChange={(e) => setClientForm((p) => ({ ...p, cidade: e.target.value }))}
            />
          </div>

          <div>
            <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">
              Estado
            </div>
            <Input
              value={clientForm.estado}
              onChange={(e) => setClientForm((p) => ({ ...p, estado: e.target.value }))}
            />
          </div>

          <div className="sm:col-span-2">
            <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">
              Observações
            </div>
            <textarea
              className="pill min-h-[90px] w-full px-3 py-2 text-sm font-semibold text-[color:var(--ink)] outline-none"
              value={clientForm.notes}
              onChange={(e) => setClientForm((p) => ({ ...p, notes: e.target.value }))}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
