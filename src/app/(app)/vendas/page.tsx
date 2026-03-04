"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  UserPlus,
  ShoppingCart,
  Calendar,
  CreditCard,
  Percent,
  Trash2,
  CheckCircle2,
  XCircle,
  FileText,
  TrendingUp,
} from "lucide-react";

import PageHeader from "@/components/layout/PageHeader";
import GlassCard from "@/components/ui/GlassCard";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Toolbar from "@/components/ui/Toolbar";
import DataTable from "@/components/ui/DataTable";
import StatusPill from "@/components/ui/StatusPill";
import Modal from "@/components/ui/Modal";
import KpiCard from "@/components/ui/KpiCard";
import Tabs from "@/components/ui/Tabs";

import { useGsapStagger } from "@/motion/useGsapStagger";
import type {
  Client,
  Order,
  OrderItem,
  OrderInstallment,
  OrderStatus,
  PaymentMethod,
  PaymentMode,
} from "@/lib/types";
import {
  moneyBRLFromCents,
  isoToBR,
  isoToDateInput,
  parseBRLToCents,
  dateInputToISO,
  clamp,
  uid,
} from "@/lib/format";

import { listClients, createClient } from "@/services/clients.service";
import {
  listOrders,
  getOrderFull,
  createOrder,
  updateOrderFull,
  cancelOrder,
  deleteOrder,
  SaveOrderPayload,
} from "@/services/orders.service";

function statusTone(s: OrderStatus) {
  const u = String(s).toUpperCase();
  if (u === "ENTREGUE" || u === "PRONTO") return "success";
  if (u === "CANCELADO") return "danger";
  if (u === "EM_PRODUCAO" || u === "PEDIDO" || u === "ORCAMENTO") return "warning";
  return "neutral";
}

function paymentBadge(mode?: PaymentMode | null, method?: PaymentMethod | null) {
  const m = String(mode || "").toUpperCase();
  const k = String(method || "").toUpperCase();
  const label = m === "PARCELADO" ? `Parcelado${k ? ` • ${k}` : ""}` : `À vista${k ? ` • ${k}` : ""}`;
  return m === "PARCELADO" ? <Badge tone="wood">{label}</Badge> : <Badge tone="brand">{label}</Badge>;
}

function itemsSummary(items: OrderItem[]) {
  if (!items?.length) return "—";
  return (
    items.slice(0, 3).map((i) => `${i.quantity}x ${i.name}`).join(" • ") +
    (items.length > 3 ? ` +${items.length - 3}` : "")
  );
}

export default function VendasPage() {
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useGsapStagger(wrapRef, {
    selector: "[data-stagger]",
    y: 14,
    duration: 0.5,
    stagger: 0.05,
  });

  const topTabs = useMemo(() => [{ key: "orders", label: "Pedidos" }], []);
  const [topTab, setTopTab] = useState("orders");

  // ====== DATA ======
  const [clients, setClients] = useState<Client[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reloadAll() {
    setLoading(true);
    setError(null);
    try {
      const [c, o] = await Promise.all([listClients(), listOrders()]);
      setClients(c);
      setOrders(o);
    } catch (e: any) {
      setError(e?.message || "Erro ao carregar vendas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reloadAll();
  }, []);

  // ====== FILTERS ======
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("ALL");
  const [payMode, setPayMode] = useState<string>("ALL");

  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return isoToDateInput(d.toISOString());
  });
  const [to, setTo] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1, 0);
    return isoToDateInput(d.toISOString());
  });

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return orders.filter((o) => {
      if (status !== "ALL" && o.status !== status) return false;
      if (payMode !== "ALL" && String(o.paymentMode || "").toUpperCase() !== payMode) return false;

      // filtro de data (createdAt)
      const dt = new Date(o.createdAt).getTime();
      const fromISO = dateInputToISO(from);
      const toISO = dateInputToISO(to);
      if (fromISO) {
        const t = new Date(fromISO).getTime();
        if (dt < t) return false;
      }
      if (toISO) {
        const t = new Date(toISO).getTime();
        if (dt > t + 24 * 60 * 60 * 1000 - 1) return false;
      }

      if (!qq) return true;
      const hay = `${o.clientName || ""} ${o.status} ${itemsSummary(o.items || [])} ${o.paymentMode || ""} ${o.paymentMethod || ""}`.toLowerCase();
      return hay.includes(qq);
    });
  }, [orders, q, status, payMode, from, to]);

  // ====== KPIs ======
  const kpis = useMemo(() => {
    const totalCents = filtered.reduce((a, b) => a + (b.totalCents || 0), 0);
    const count = filtered.length;
    const openCount = filtered.filter((o) => o.status !== "ENTREGUE" && o.status !== "CANCELADO").length;
    const deliveredCount = filtered.filter((o) => o.status === "ENTREGUE").length;
    const avg = count ? Math.round(totalCents / count) : 0;
    return { totalCents, count, openCount, deliveredCount, avg };
  }, [filtered]);

  // ====== MODAL ORDER ======
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);

  const [form, setForm] = useState({
    clientId: "",
    status: "PEDIDO" as OrderStatus,
    expectedDeliveryAt: isoToDateInput(new Date(Date.now() + 7 * 864e5).toISOString()),
    notes: "",
    paymentMode: "AVISTA" as PaymentMode,
    paymentMethod: "PIX" as PaymentMethod,
    paidNow: false,
    installmentsCount: 2,
    firstDueDate: isoToDateInput(new Date(Date.now() + 30 * 864e5).toISOString()),
    discount: "",
  });

  const [items, setItems] = useState<Array<{ id: string; description: string; quantity: number; unit: string }>>([
    { id: uid("it"), description: "", quantity: 1, unit: "" },
  ]);

  const [installments, setInstallments] = useState<Array<{ id: string; dueDate: string; amount: string }>>([]);

  // ====== QUICK CLIENT MODAL ======
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

  // ====== TOTALS ======
  const subtotalCents = useMemo(
    () => items.reduce((acc, it) => acc + it.quantity * parseBRLToCents(it.unit), 0),
    [items]
  );
  const discountCents = useMemo(() => parseBRLToCents(form.discount), [form.discount]);
  const totalCents = useMemo(() => Math.max(0, subtotalCents - discountCents), [subtotalCents, discountCents]);

  const installmentsSumCents = useMemo(
    () => installments.reduce((acc, p) => acc + parseBRLToCents(p.amount), 0),
    [installments]
  );

  const installmentsOk = useMemo(() => {
    if (String(form.paymentMode).toUpperCase() !== "PARCELADO") return true;
    const count = clamp(Number(form.installmentsCount || 2), 2, 48);
    if (!form.firstDueDate) return false;
    if (installments.length !== count) return false;
    return installmentsSumCents === totalCents;
  }, [form.paymentMode, form.installmentsCount, form.firstDueDate, installments.length, installmentsSumCents, totalCents]);

  // ====== OPEN NEW / EDIT ======
  function openNew() {
    setEditing(null);
    setForm({
      clientId: clients[0]?.id || "",
      status: "PEDIDO",
      expectedDeliveryAt: isoToDateInput(new Date(Date.now() + 7 * 864e5).toISOString()),
      notes: "",
      paymentMode: "AVISTA",
      paymentMethod: "PIX",
      paidNow: false,
      installmentsCount: 2,
      firstDueDate: isoToDateInput(new Date(Date.now() + 30 * 864e5).toISOString()),
      discount: "",
    });
    setItems([{ id: uid("it"), description: "", quantity: 1, unit: "" }]);
    setInstallments([]);
    setOpen(true);
  }

  async function openEdit(orderId: string) {
    setLoading(true);
    setError(null);
    try {
      const full = await getOrderFull(orderId);
      setEditing(full);

      setForm({
        clientId: full.clientId,
        status: full.status,
        expectedDeliveryAt: isoToDateInput(full.expectedDeliveryAt || ""),
        notes: full.notes || "",
        paymentMode: (full.paymentMode || "AVISTA") as any,
        paymentMethod: (full.paymentMethod || "PIX") as any,
        paidNow: !!full.paidNow,
        installmentsCount: full.installmentsCount || 2,
        firstDueDate: isoToDateInput(full.firstDueDate || ""),
        discount: String((full.discountCents || 0) / 100).replace(".", ","),
      });

      setItems(
        (full.items || []).length
          ? full.items.map((x: OrderItem) => ({
              id: x.id,
              description: x.name,
              quantity: x.quantity,
              unit: String((x.unitPriceCents || 0) / 100).replace(".", ","),
            }))
          : [{ id: uid("it"), description: "", quantity: 1, unit: "" }]
      );

      setInstallments(
        (full.installments || []).map((p: OrderInstallment) => ({
          id: p.id,
          dueDate: isoToDateInput(p.dueDate),
          amount: String((p.amountCents || 0) / 100).replace(".", ","),
        }))
      );

      setOpen(true);
    } catch (e: any) {
      setError(e?.message || "Erro ao abrir pedido.");
    } finally {
      setLoading(false);
    }
  }

  // ====== ITEMS ======
  function addItem() {
    setItems((prev) => [...prev, { id: uid("it"), description: "", quantity: 1, unit: "" }]);
  }
  function removeItem(id: string) {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((x) => x.id !== id)));
  }

  // ====== INSTALLMENTS ======
  function genInstallments() {
    const count = clamp(Number(form.installmentsCount || 2), 2, 48);
    const first = form.firstDueDate || isoToDateInput(new Date(Date.now() + 30 * 864e5).toISOString());
    const base = new Date(first + "T12:00:00.000Z");

    const total = totalCents;
    const each = Math.floor(total / count);
    const rest = total - each * count;

    const arr = Array.from({ length: count }).map((_, i) => {
      const d = new Date(base);
      d.setUTCMonth(d.getUTCMonth() + i);
      const cents = each + (i === count - 1 ? rest : 0);
      return {
        id: uid("parc"),
        dueDate: isoToDateInput(d.toISOString()),
        amount: String((cents / 100).toFixed(2)).replace(".", ","),
      };
    });

    setInstallments(arr);
  }

  // ====== SAVE ORDER API ======
  async function saveOrder() {
    if (!form.clientId) return alert("Selecione o cliente.");
    if (!items.length) return alert("Adicione pelo menos 1 item.");
    if (items.some((it) => !it.description.trim() || it.quantity <= 0)) return alert("Preencha descrição e quantidade.");
    if (String(form.paymentMode).toUpperCase() === "PARCELADO" && !installmentsOk) return alert("Parcelas inválidas.");

    const payload: SaveOrderPayload = {
      clientId: form.clientId,
      status: form.status,
      expectedDeliveryAt: dateInputToISO(form.expectedDeliveryAt) || null,

      paymentMode: form.paymentMode,
      paymentMethod: form.paymentMethod,

      // em AVISTA mantemos 1 e null (backend pode ignorar)
      installmentsCount: String(form.paymentMode).toUpperCase() === "PARCELADO" ? clamp(Number(form.installmentsCount || 2), 2, 48) : 1,
      firstDueDate: String(form.paymentMode).toUpperCase() === "PARCELADO" ? (dateInputToISO(form.firstDueDate) || null) : null,
      paidNow: !!form.paidNow,

      subtotalCents,
      discountCents,
      totalCents,

      items: items.map((it) => {
        const qty = Math.max(1, Number(it.quantity || 1));
        const unitCents = parseBRLToCents(it.unit);
        return {
          name: it.description.trim(),
          description: null,
          quantity: qty,
          unitPriceCents: unitCents,
          totalCents: qty * unitCents,
        };
      }),

      notes: form.notes || null,
    };

    if (String(form.paymentMode).toUpperCase() === "PARCELADO") {
      payload.installments = installments.map((p) => ({
        dueDate: dateInputToISO(p.dueDate) || null,
        amountCents: parseBRLToCents(p.amount),
      }));
    }

    setLoading(true);
    setError(null);

    try {
      if (editing) await updateOrderFull(editing.id, payload);
      else await createOrder(payload);

      setOpen(false);
      setEditing(null);
      await reloadAll();
    } catch (e: any) {
      alert(e?.message || "Erro ao salvar pedido.");
    } finally {
      setLoading(false);
    }
  }

  // ====== CANCEL / DELETE ======
  async function onCancelOrder(id: string) {
    const ok = confirm("Cancelar este pedido?");
    if (!ok) return;
    setLoading(true);
    try {
      await cancelOrder(id);
      await reloadAll();
    } catch (e: any) {
      alert(e?.message || "Erro ao cancelar.");
    } finally {
      setLoading(false);
    }
  }

  async function onDeleteOrder(id: string) {
    const ok = confirm("Excluir este pedido? (não pode desfazer)");
    if (!ok) return;
    setLoading(true);
    try {
      await deleteOrder(id);
      await reloadAll();
    } catch (e: any) {
      alert(e?.message || "Erro ao excluir.");
    } finally {
      setLoading(false);
    }
  }

  // ====== CREATE CLIENT QUICK API ======
  async function createClientQuick() {
    if (!clientForm.name.trim() || !clientForm.phone.trim()) return;

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

      const list = await listClients();
      setClients(list);
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

  return (
    <div ref={wrapRef} className="space-y-4">
      <div data-stagger>
        <PageHeader
          title="Vendas"
          subtitle="M5 conectado: clients + orders + /full + cancel + delete."
          badge={{ label: "M5", tone: "brand" }}
          right={<Tabs items={topTabs} value={topTab} onChange={setTopTab} />}
        />
      </div>

      {/* Header vivo */}
      <div data-stagger>
        <GlassCard className="relative overflow-hidden p-4 sm:p-5">
          <div className="pointer-events-none absolute -top-12 -right-12 h-56 w-56 rounded-full blur-3xl bg-[rgba(247,211,32,0.18)]" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full blur-3xl bg-[rgba(149,173,193,0.22)]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[44%] bg-white/30" />

          <div className="relative flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Badge tone="brand">Pedidos</Badge>
                {loading ? <Badge tone="ink">Carregando…</Badge> : <Badge tone="success">Online</Badge>}
              </div>
              <div className="mt-2 font-display text-lg font-black text-[color:var(--ink)]">Pipeline</div>
              <div className="mt-1 text-sm font-semibold text-[color:var(--muted)]">
                Lista real + edição completa via /full.
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="soft" onClick={reloadAll}>Recarregar</Button>
              <Button variant="dark" onClick={openNew}>
                <Plus className="h-4 w-4" /> Novo pedido
              </Button>
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
        <KpiCard label="Pedidos" value={`${kpis.count}`} icon={ShoppingCart} hint="No filtro atual" tone="neutral" />
        <KpiCard label="Total" value={moneyBRLFromCents(kpis.totalCents)} icon={TrendingUp} hint="No filtro atual" tone="brand" />
        <KpiCard label="Em aberto" value={`${kpis.openCount}`} icon={Calendar} hint="Não entregue/cancelado" tone="wood" />
        <KpiCard label="Entregues" value={`${kpis.deliveredCount}`} icon={CheckCircle2} hint="Concluídos" tone="success" />
      </section>

      {/* Filtros */}
      <div data-stagger>
        <Toolbar
          left={
            <>
              <div className="w-[280px] max-w-full">
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar pedido/cliente..." />
              </div>
              <div className="w-[200px] max-w-full">
                <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="ALL">Todos status</option>
                  <option value="ORCAMENTO">Orçamento</option>
                  <option value="PEDIDO">Pedido</option>
                  <option value="EM_PRODUCAO">Em produção</option>
                  <option value="PRONTO">Pronto</option>
                  <option value="ENTREGUE">Entregue</option>
                  <option value="CANCELADO">Cancelado</option>
                </Select>
              </div>
              <div className="w-[200px] max-w-full">
                <Select value={payMode} onChange={(e) => setPayMode(e.target.value)}>
                  <option value="ALL">Todos pagamentos</option>
                  <option value="AVISTA">À vista</option>
                  <option value="PARCELADO">Parcelado</option>
                </Select>
              </div>
              <div className="w-[160px]">
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="w-[160px]">
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </>
          }
          right={
            <div className="pill px-4 py-2 text-xs font-extrabold">
              Ticket médio: <span className="ml-2 font-display">{moneyBRLFromCents(kpis.avg)}</span>
            </div>
          }
        />
      </div>

      {/* Tabela */}
      <div data-stagger>
        <DataTable
          title="Pedidos"
          subtitle="GET /api/orders • Edit via /:id/full"
          rows={filtered}
          rowKey={(r) => r.id}
          columns={[
            { header: "Criado", cell: (r) => isoToBR(r.createdAt) },
            { header: "Status", cell: (r) => <StatusPill tone={statusTone(r.status) as any} label={r.status.replaceAll("_", " ")} /> },
            { header: "Cliente", cell: (r) => r.clientName || "—" },
            { header: "Entrega", cell: (r) => isoToBR(r.expectedDeliveryAt || null) },
            { header: "Pagamento", cell: (r) => paymentBadge(r.paymentMode || null, r.paymentMethod || null) },
            { header: "Itens", cell: (r) => itemsSummary(r.items || []) },
            { header: "Total", className: "text-right font-extrabold", cell: (r) => moneyBRLFromCents(r.totalCents) },
            {
              header: "Ações",
              className: "text-right",
              cell: (r) => (
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => openEdit(r.id)}>Ver/Editar</Button>
                  <Button variant="ghost" onClick={() => onCancelOrder(r.id)}>Cancelar</Button>
                  <Button variant="ghost" onClick={() => onDeleteOrder(r.id)}>Excluir</Button>
                </div>
              ),
            },
          ]}
        />
      </div>

      {/* MODAL PEDIDO (COMPLETO) */}
      <Modal
        open={open}
        title={editing ? "Editar pedido" : "Novo pedido"}
        subtitle="POST /api/orders • PATCH /api/orders/:id/full"
        onClose={() => setOpen(false)}
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {form.paymentMode === "PARCELADO" ? (
                installmentsOk ? <Badge tone="success">Parcelas OK</Badge> : <Badge tone="danger">Parcelas inválidas</Badge>
              ) : (
                <Badge tone="ink">À vista</Badge>
              )}
              <Badge tone="brand">Total: {moneyBRLFromCents(totalCents)}</Badge>
            </div>
            <div className="flex gap-2">
              <Button variant="soft" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button variant="dark" onClick={saveOrder}>Salvar</Button>
            </div>
          </div>
        }
      >
        <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
          {/* LEFT */}
          <div className="space-y-4">
            {/* Cliente + meta */}
            <GlassCard className="relative overflow-hidden p-4">
              <div className="pointer-events-none absolute -top-10 -right-10 h-44 w-44 rounded-full bg-[rgba(247,211,32,0.20)] blur-3xl" />
              <div className="relative grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2 flex flex-wrap items-end justify-between gap-2">
                  <div className="min-w-[240px] flex-1">
                    <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Cliente</div>
                    <Select value={form.clientId} onChange={(e) => setForm((p) => ({ ...p, clientId: e.target.value }))}>
                      <option value="">Selecione</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} • {c.phone}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <Button variant="soft" onClick={() => setClientOpen(true)}>
                    <UserPlus className="h-4 w-4" /> Cadastrar cliente
                  </Button>
                </div>

                <div>
                  <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Status</div>
                  <Select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as any }))}>
                    <option value="ORCAMENTO">Orçamento</option>
                    <option value="PEDIDO">Pedido</option>
                    <option value="EM_PRODUCAO">Em produção</option>
                    <option value="PRONTO">Pronto</option>
                    <option value="ENTREGUE">Entregue</option>
                    <option value="CANCELADO">Cancelado</option>
                  </Select>
                </div>

                <div>
                  <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Entrega prevista</div>
                  <Input type="date" value={form.expectedDeliveryAt} onChange={(e) => setForm((p) => ({ ...p, expectedDeliveryAt: e.target.value }))} />
                </div>

                <div className="sm:col-span-2">
                  <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Observações</div>
                  <textarea
                    className="pill min-h-[90px] w-full px-3 py-2 text-sm font-semibold text-[color:var(--ink)] outline-none"
                    value={form.notes}
                    onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                    placeholder="Detalhes importantes do pedido..."
                  />
                </div>
              </div>
            </GlassCard>

            {/* Itens */}
            <GlassCard className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-display text-sm font-black text-[color:var(--ink)]">Itens</div>
                  <div className="text-xs font-semibold text-[color:var(--muted)]">Descrição, quantidade e valor unitário.</div>
                </div>

                <Button variant="soft" onClick={addItem}>
                  <Plus className="h-4 w-4" /> Adicionar
                </Button>
              </div>

              <div className="mt-3 overflow-auto rounded-2xl border border-[color:var(--line)] bg-white/35">
                <table className="min-w-[980px] w-full text-sm">
                  <thead className="bg-white/55">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-extrabold text-[color:var(--muted)]">Descrição</th>
                      <th className="px-4 py-3 text-left text-xs font-extrabold text-[color:var(--muted)]">Qtd</th>
                      <th className="px-4 py-3 text-left text-xs font-extrabold text-[color:var(--muted)]">Preço unit (R$)</th>
                      <th className="px-4 py-3 text-right text-xs font-extrabold text-[color:var(--muted)]">Total</th>
                      <th className="px-4 py-3 text-right text-xs font-extrabold text-[color:var(--muted)]">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => {
                      const rowTotal = it.quantity * parseBRLToCents(it.unit);
                      return (
                        <tr key={it.id} className="border-t border-[color:var(--line)]">
                          <td className="px-4 py-3">
                            <Input
                              value={it.description}
                              onChange={(e) =>
                                setItems((prev) =>
                                  prev.map((x) => (x.id === it.id ? { ...x, description: e.target.value } : x))
                                )
                              }
                              placeholder="Ex: Armário planejado"
                            />
                          </td>
                          <td className="px-4 py-3 w-[140px]">
                            <Input
                              value={String(it.quantity)}
                              onChange={(e) =>
                                setItems((prev) =>
                                  prev.map((x) =>
                                    x.id === it.id
                                      ? { ...x, quantity: clamp(Number(e.target.value || 1), 1, 9999) }
                                      : x
                                  )
                                )
                              }
                            />
                          </td>
                          <td className="px-4 py-3 w-[200px]">
                            <Input
                              value={it.unit}
                              onChange={(e) =>
                                setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, unit: e.target.value } : x)))
                              }
                              placeholder="1200,00"
                            />
                          </td>
                          <td className="px-4 py-3 text-right font-extrabold">{moneyBRLFromCents(rowTotal)}</td>
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

            {/* Pagamento */}
            <GlassCard className="relative overflow-hidden p-4">
              <div className="pointer-events-none absolute -top-10 -right-10 h-44 w-44 rounded-full bg-[rgba(194,65,12,0.16)] blur-3xl" />

              <div className="relative flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-display text-sm font-black text-[color:var(--ink)]">Pagamento</div>
                  <div className="text-xs font-semibold text-[color:var(--muted)]">
                    À vista ou parcelado com geração de parcelas.
                  </div>
                </div>
                {paymentBadge(form.paymentMode, form.paymentMethod)}
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Modo</div>
                  <Select value={form.paymentMode} onChange={(e) => setForm((p) => ({ ...p, paymentMode: e.target.value as any }))}>
                    <option value="AVISTA">À vista</option>
                    <option value="PARCELADO">Parcelado</option>
                  </Select>
                </div>

                <div>
                  <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Método</div>
                  <Select value={form.paymentMethod} onChange={(e) => setForm((p) => ({ ...p, paymentMethod: e.target.value as any }))}>
                    <option value="PIX">PIX</option>
                    <option value="DINHEIRO">Dinheiro</option>
                    <option value="CARTAO">Cartão</option>
                    <option value="BOLETO">Boleto</option>
                  </Select>
                </div>

                <div>
                  <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Desconto (R$)</div>
                  <div className="relative">
                    <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--muted)]">
                      <Percent className="h-4 w-4" />
                    </div>
                    <Input
                      className="pl-10"
                      value={form.discount}
                      onChange={(e) => setForm((p) => ({ ...p, discount: e.target.value }))}
                      placeholder="0,00"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="paidNow"
                    type="checkbox"
                    checked={!!form.paidNow}
                    onChange={(e) => setForm((p) => ({ ...p, paidNow: e.target.checked }))}
                    className="h-4 w-4"
                  />
                  <label htmlFor="paidNow" className="text-sm font-semibold text-[color:var(--muted)]">
                    Marcar como pago agora
                  </label>
                </div>

                {form.paymentMode === "PARCELADO" ? (
                  <>
                    <div>
                      <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Parcelas</div>
                      <Input
                        value={String(form.installmentsCount)}
                        onChange={(e) => setForm((p) => ({ ...p, installmentsCount: clamp(Number(e.target.value || 2), 2, 48) }))}
                      />
                    </div>

                    <div>
                      <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">1º vencimento</div>
                      <Input
                        type="date"
                        value={form.firstDueDate}
                        onChange={(e) => setForm((p) => ({ ...p, firstDueDate: e.target.value }))}
                      />
                    </div>

                    <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2">
                      <Button variant="soft" onClick={genInstallments}>
                        <CreditCard className="h-4 w-4" /> Gerar parcelas
                      </Button>

                      <div className="flex items-center gap-2">
                        <Badge tone="ink">Soma: {moneyBRLFromCents(installmentsSumCents)}</Badge>
                        {installmentsOk ? <Badge tone="success">OK</Badge> : <Badge tone="danger">Ajuste valores</Badge>}
                      </div>
                    </div>

                    <div className="sm:col-span-2 overflow-auto rounded-2xl border border-[color:var(--line)] bg-white/35">
                      <table className="min-w-[720px] w-full text-sm">
                        <thead className="bg-white/55">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-extrabold text-[color:var(--muted)]">Vencimento</th>
                            <th className="px-4 py-3 text-left text-xs font-extrabold text-[color:var(--muted)]">Valor (R$)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {installments.map((p) => (
                            <tr key={p.id} className="border-t border-[color:var(--line)]">
                              <td className="px-4 py-3">
                                <Input
                                  type="date"
                                  value={p.dueDate}
                                  onChange={(e) =>
                                    setInstallments((prev) =>
                                      prev.map((x) => (x.id === p.id ? { ...x, dueDate: e.target.value } : x))
                                    )
                                  }
                                />
                              </td>
                              <td className="px-4 py-3">
                                <Input
                                  value={p.amount}
                                  onChange={(e) =>
                                    setInstallments((prev) =>
                                      prev.map((x) => (x.id === p.id ? { ...x, amount: e.target.value } : x))
                                    )
                                  }
                                />
                              </td>
                            </tr>
                          ))}
                          {!installments.length ? (
                            <tr>
                              <td colSpan={2} className="px-4 py-8 text-sm font-semibold text-[color:var(--muted)]">
                                Clique em “Gerar parcelas”.
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : null}
              </div>
            </GlassCard>
          </div>

          {/* RIGHT: Summary */}
          <div className="space-y-4">
            <GlassCard className="relative overflow-hidden p-4">
              <div className="pointer-events-none absolute -top-10 -right-10 h-44 w-44 rounded-full bg-[rgba(247,211,32,0.18)] blur-3xl" />
              <div className="relative">
                <div className="font-display text-sm font-black text-[color:var(--ink)]">Resumo</div>

                <div className="mt-2 space-y-2 text-sm font-semibold">
                  <div className="flex items-center justify-between">
                    <span className="text-[color:var(--muted)]">Subtotal</span>
                    <span className="font-extrabold text-[color:var(--ink)]">{moneyBRLFromCents(subtotalCents)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[color:var(--muted)]">Desconto</span>
                    <span className="font-extrabold text-[color:var(--ink)]">- {moneyBRLFromCents(discountCents)}</span>
                  </div>
                  <div className="h-px bg-black/10" />
                  <div className="flex items-center justify-between">
                    <span className="text-[color:var(--muted)]">Total</span>
                    <span className="font-display text-xl font-black text-[color:var(--ink)]">{moneyBRLFromCents(totalCents)}</span>
                  </div>

                  {form.paymentMode === "PARCELADO" ? (
                    <div className="mt-3 rounded-2xl border border-[color:var(--line)] bg-white/45 p-3">
                      <div className="text-xs font-extrabold text-[color:var(--muted)]">Parcelamento</div>
                      <div className="mt-1 font-extrabold text-[color:var(--ink)]">
                        {form.installmentsCount}x • 1º venc. {form.firstDueDate || "—"}
                      </div>
                      <div className="mt-1 text-xs font-semibold text-[color:var(--muted)]">
                        Soma das parcelas precisa bater o total.
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 rounded-2xl border border-[color:var(--line)] bg-white/45 p-3">
                      <div className="text-xs font-extrabold text-[color:var(--muted)]">À vista</div>
                      <div className="mt-1 font-extrabold text-[color:var(--ink)]">{String(form.paymentMethod || "PIX")}</div>
                    </div>
                  )}
                </div>

                <div className="mt-4 grid gap-2">
                  <Button variant="soft" onClick={() => {}}>
                    <FileText className="h-4 w-4" /> Gerar comprovante (placeholder)
                  </Button>
                  <Button variant="ghost" onClick={() => {}}>
                    Histórico (placeholder)
                  </Button>
                </div>
              </div>
            </GlassCard>

            {form.paymentMode === "PARCELADO" ? (
              <GlassCard className="p-4">
                <div className="font-display text-sm font-black text-[color:var(--ink)]">Validação</div>
                <div className="mt-2 flex items-center gap-2">
                  {installmentsOk ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-[color:var(--success)]" />
                      <span className="text-sm font-semibold text-[color:var(--muted)]">Parcelas batendo com o total.</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-5 w-5 text-[color:var(--danger)]" />
                      <span className="text-sm font-semibold text-[color:var(--muted)]">Ajuste parcelas para somar o total.</span>
                    </>
                  )}
                </div>
              </GlassCard>
            ) : null}
          </div>
        </div>
      </Modal>

      {/* MODAL CLIENTE RÁPIDO */}
      <Modal
        open={clientOpen}
        title="Cadastrar cliente"
        subtitle="POST /api/clients"
        onClose={() => setClientOpen(false)}
        maxWidth="max-w-[760px]"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="soft" onClick={() => setClientOpen(false)}>Cancelar</Button>
            <Button variant="dark" onClick={createClientQuick}>Salvar cliente</Button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Nome</div>
            <Input value={clientForm.name} onChange={(e) => setClientForm((p) => ({ ...p, name: e.target.value }))} />
          </div>
          <div>
            <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Telefone</div>
            <Input value={clientForm.phone} onChange={(e) => setClientForm((p) => ({ ...p, phone: e.target.value }))} />
          </div>
          <div>
            <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">E-mail</div>
            <Input value={clientForm.email} onChange={(e) => setClientForm((p) => ({ ...p, email: e.target.value }))} />
          </div>
          <div>
            <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">CPF</div>
            <Input value={clientForm.cpf} onChange={(e) => setClientForm((p) => ({ ...p, cpf: e.target.value }))} />
          </div>
          <div>
            <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">CEP</div>
            <Input value={clientForm.cep} onChange={(e) => setClientForm((p) => ({ ...p, cep: e.target.value }))} />
          </div>
          <div className="sm:col-span-2">
            <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Logradouro</div>
            <Input value={clientForm.logradouro} onChange={(e) => setClientForm((p) => ({ ...p, logradouro: e.target.value }))} />
          </div>
          <div>
            <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Número</div>
            <Input value={clientForm.numero} onChange={(e) => setClientForm((p) => ({ ...p, numero: e.target.value }))} />
          </div>
          <div>
            <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Complemento</div>
            <Input value={clientForm.complemento} onChange={(e) => setClientForm((p) => ({ ...p, complemento: e.target.value }))} />
          </div>
          <div>
            <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Bairro</div>
            <Input value={clientForm.bairro} onChange={(e) => setClientForm((p) => ({ ...p, bairro: e.target.value }))} />
          </div>
          <div>
            <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Cidade</div>
            <Input value={clientForm.cidade} onChange={(e) => setClientForm((p) => ({ ...p, cidade: e.target.value }))} />
          </div>
          <div>
            <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Estado</div>
            <Input value={clientForm.estado} onChange={(e) => setClientForm((p) => ({ ...p, estado: e.target.value }))} />
          </div>
          <div className="sm:col-span-2">
            <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Observações</div>
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