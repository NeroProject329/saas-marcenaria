"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, Trash2, Pencil, History, Users, Building2, UserRound } from "lucide-react";

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
import KpiCard from "@/components/ui/KpiCard";

import {
  budgetStatusLabel,
  budgetStatusTone,
  orderStatusLabel,
  orderStatusTone,
} from "@/lib/status";

import { useGsapStagger } from "@/motion/useGsapStagger";
import type { Client } from "@/lib/types";
import { moneyBRLFromCents, isoToBR } from "@/lib/format";
import {
  listClients,
  listClientsMetrics,
  createClient,
  updateClient,
  deleteClient,
  getClientHistory,
  type ClientMetricRow,
  type ClientHistory,
} from "@/services/clients.service";

type TypeFilter = "CLIENTE" | "FORNECEDOR" | "BOTH";
type HistTab = "orders" | "budgets" | "timeline";

function typeTone(t: string) {
  const u = String(t || "").toUpperCase();
  if (u === "FORNECEDOR") return "wood";
  if (u === "BOTH") return "brand";
  return "neutral";
}

function paymentLabel(x: any) {
  const mode = String(x.paymentMode || "").toUpperCase();
  const method = String(x.paymentMethod || "").toUpperCase();
  if (!mode && !method) return "—";
  return `${mode || "—"}${method ? ` • ${method}` : ""}`;
}

function itemsSummary(items: any[]) {
  const arr = Array.isArray(items) ? items : [];
  if (!arr.length) return "—";
  return arr
    .map((it) => {
      const q = Number(it.quantity || 0);
      const nm = String(it.name || "").trim();
      return nm ? `${nm}${q > 1 ? ` (${q})` : ""}` : null;
    })
    .filter(Boolean)
    .join(", ");
}

export default function ClientesPage() {
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useGsapStagger(wrapRef, {
    selector: "[data-stagger]",
    y: 14,
    duration: 0.5,
    stagger: 0.05,
  });

  const typeTabs = useMemo(
    () => [
      { key: "CLIENTE", label: "Clientes" },
      { key: "FORNECEDOR", label: "Fornecedores" },
      { key: "BOTH", label: "Ambos" },
    ],
    []
  );

  const [type, setType] = useState<TypeFilter>("CLIENTE");
  const [q, setQ] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rows, setRows] = useState<ClientMetricRow[]>([]);
  const [rawClients, setRawClients] = useState<Client[]>([]);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const [metrics, clients] = await Promise.all([listClientsMetrics(), listClients()]);
      setRows(metrics);
      setRawClients(clients);
    } catch (e: any) {
      setError(e?.message || "Erro ao carregar clientes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();

    const base = rows.filter((r) => String(r.type).toUpperCase() === type);
    if (!qq) return base;

    return base.filter((r) => {
      const name = String(r.name || "").toLowerCase();
      const phone = String(r.phone || "").toLowerCase();
      return name.includes(qq) || phone.includes(qq);
    });
  }, [rows, q, type]);

  const kpis = useMemo(() => {
    const base = rows.filter((r) => String(r.type).toUpperCase() === type);
    const count = base.length;
    const spent = base.reduce((a, b) => a + (b.totalSpentCents || 0), 0);
    const avg = count ? Math.round(spent / count) : 0;
    return { count, spent, avg };
  }, [rows, type]);

  // ===== Modal create/edit
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);

  const [form, setForm] = useState<Client>({
    id: "",
    name: "",
    phone: "",
    type: "CLIENTE" as any,

    instagram: null,
    notes: null,

    cpf: null,
    email: null,

    cep: null,
    logradouro: null,
    numero: null,
    complemento: null,
    bairro: null,
    cidade: null,
    estado: null,
  } as any);

  function openNew() {
    setEditing(null);
    setForm({
      id: "",
      name: "",
      phone: "",
      type,
      instagram: null,
      notes: null,
      cpf: null,
      email: null,
      cep: null,
      logradouro: null,
      numero: null,
      complemento: null,
      bairro: null,
      cidade: null,
      estado: null,
    } as any);
    setOpen(true);
  }

  function openEdit(id: string) {
    const c = rawClients.find((x) => x.id === id);
    if (!c) return;
    setEditing(c);
    setForm({ ...(c as any) });
    setOpen(true);
  }

  async function save() {
    if (!form.name?.trim()) return alert("Informe o nome.");
    if (!form.phone?.trim()) return alert("Informe o telefone.");

    setLoading(true);
    try {
      if (!editing) {
        await createClient({
          name: form.name.trim(),
          phone: form.phone.trim(),
          type: (form.type || type) as any,
          instagram: form.instagram || null,
          notes: form.notes || null,
          cpf: form.cpf || null,
          email: form.email || null,
          cep: form.cep || null,
          logradouro: form.logradouro || null,
          numero: form.numero || null,
          complemento: form.complemento || null,
          bairro: form.bairro || null,
          cidade: form.cidade || null,
          estado: form.estado || null,
        });
      } else {
        await updateClient(editing.id, {
          ...form,
          name: form.name.trim(),
          phone: form.phone.trim(),
        });
      }

      setOpen(false);
      setEditing(null);
      await reload();
    } catch (e: any) {
      alert(e?.message || "Erro ao salvar.");
    } finally {
      setLoading(false);
    }
  }

  async function remove(id: string) {
    const ok = confirm("Excluir este registro?");
    if (!ok) return;

    setLoading(true);
    try {
      await deleteClient(id);
      await reload();
    } catch (e: any) {
      alert(e?.message || "Erro ao excluir.");
    } finally {
      setLoading(false);
    }
  }

  // ===== History modal
  const [histOpen, setHistOpen] = useState(false);
  const [histLoading, setHistLoading] = useState(false);
  const [histError, setHistError] = useState<string | null>(null);
  const [histTab, setHistTab] = useState<HistTab>("orders");
  const [histTitle, setHistTitle] = useState("Histórico");
  const [history, setHistory] = useState<ClientHistory>({ client: null, orders: [], budgets: [], timeline: [] });

  const histTabs = useMemo(
    () => [
      { key: "orders", label: "Pedidos" },
      { key: "budgets", label: "Orçamentos" },
      { key: "timeline", label: "Timeline" },
    ],
    []
  );

  async function openHistory(id: string, name: string) {
    setHistOpen(true);
    setHistTab("orders");
    setHistTitle(`Histórico — ${name || "Cliente"}`);
    setHistLoading(true);
    setHistError(null);
    setHistory({ client: null, orders: [], budgets: [], timeline: [] });

    try {
      const data = await getClientHistory(id);
      setHistory(data);
    } catch (e: any) {
      setHistError(e?.message || "Erro ao carregar histórico.");
    } finally {
      setHistLoading(false);
    }
  }

  return (
    <div ref={wrapRef} className="space-y-4">
      <div data-stagger>
        <PageHeader
          title="Clientes"
          subtitle="M5 conectado: metrics + CRUD + histórico do cliente."
          badge={{ label: "M5", tone: "brand" }}
          right={
            <Tabs
              items={typeTabs}
              value={type}
              onChange={(k) => setType(k as TypeFilter)}
              className="max-w-full"
            />
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
                <Badge tone={typeTone(type) as any}>{type}</Badge>
                {loading ? <Badge tone="ink">Carregando…</Badge> : <Badge tone="success">Online</Badge>}
              </div>
              <div className="mt-2 font-display text-lg font-black text-[color:var(--ink)]">
                Base de contatos
              </div>
              <div className="mt-1 text-sm font-semibold text-[color:var(--muted)]">
                Lista com total gasto + histórico (pedidos/orçamentos/timeline).
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="soft" onClick={reload}>Recarregar</Button>
              <Button variant="dark" onClick={openNew}>
                <Plus className="h-4 w-4" /> Novo
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
        <KpiCard
          label="Registros"
          value={`${kpis.count}`}
          icon={type === "FORNECEDOR" ? Building2 : type === "BOTH" ? Users : UserRound}
          hint="No filtro atual"
          tone={typeTone(type) as any}
        />
        <KpiCard label="Total gasto" value={moneyBRLFromCents(kpis.spent)} icon={Users} hint="Somatório" tone="brand" />
        <KpiCard label="Média gasto" value={moneyBRLFromCents(kpis.avg)} icon={Users} hint="Por registro" tone="neutral" />
        <KpiCard label="Status" value={loading ? "…" : "OK"} icon={Users} hint="Backend" tone="success" />
      </section>

      {/* filtros */}
      <div data-stagger>
        <Toolbar
          left={
            <div className="w-[340px] max-w-full">
                <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--muted)]" />
                    <Input
                        className="pl-10"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Buscar por nome ou telefone…"
                    />
                </div>
            </div>
          }
          right={<Badge tone="ink">Itens: {filtered.length}</Badge>}
        />
      </div>

      {/* tabela */}
      <div data-stagger>
        <DataTable
          title="Lista"
          subtitle="GET /api/clients/metrics + GET /api/clients"
          rows={filtered}
          rowKey={(r) => r.id}
          columns={[
            { header: "Nome", cell: (r) => r.name },
            { header: "Telefone", cell: (r) => r.phone || "—" },
            { header: "Tipo", cell: (r) => <StatusPill tone={typeTone(r.type) as any} label={r.type} /> },
            { header: "Total gasto", className: "text-right font-extrabold", cell: (r) => moneyBRLFromCents(r.totalSpentCents) },
            {
              header: "Ações",
              className: "text-right",
              cell: (r) => (
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => openHistory(r.id, r.name)}>
                    <History className="h-4 w-4" /> Histórico
                  </Button>
                  <Button variant="ghost" onClick={() => openEdit(r.id)}>
                    <Pencil className="h-4 w-4" /> Editar
                  </Button>
                  <Button variant="ghost" onClick={() => remove(r.id)}>
                    <Trash2 className="h-4 w-4" /> Excluir
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </div>

      {/* modal create/edit */}
      <Modal
        open={open}
        title={editing ? "Editar" : "Novo"}
        subtitle="POST/PATCH /api/clients"
        onClose={() => setOpen(false)}
        maxWidth="max-w-[880px]"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="soft" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="dark" onClick={save}>Salvar</Button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Nome</div>
            <Input value={form.name || ""} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value } as any))} />
          </div>

          <div>
            <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Telefone</div>
            <Input value={form.phone || ""} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value } as any))} />
          </div>

          <div>
            <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Tipo</div>
            <Select value={(form.type as any) || type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value } as any))}>
              <option value="CLIENTE">CLIENTE</option>
              <option value="FORNECEDOR">FORNECEDOR</option>
              <option value="BOTH">BOTH</option>
            </Select>
          </div>

          <div>
            <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">CPF/CNPJ</div>
            <Input value={(form.cpf as any) || ""} onChange={(e) => setForm((p) => ({ ...p, cpf: e.target.value } as any))} />
          </div>

          <div>
            <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">E-mail</div>
            <Input value={(form.email as any) || ""} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value } as any))} />
          </div>

          <div className="sm:col-span-2">
            <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Endereço</div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Input placeholder="CEP" value={(form.cep as any) || ""} onChange={(e) => setForm((p) => ({ ...p, cep: e.target.value } as any))} />
              <Input placeholder="Cidade" value={(form.cidade as any) || ""} onChange={(e) => setForm((p) => ({ ...p, cidade: e.target.value } as any))} />
              <Input placeholder="Estado" value={(form.estado as any) || ""} onChange={(e) => setForm((p) => ({ ...p, estado: e.target.value } as any))} />
              <Input className="sm:col-span-2" placeholder="Logradouro" value={(form.logradouro as any) || ""} onChange={(e) => setForm((p) => ({ ...p, logradouro: e.target.value } as any))} />
              <Input placeholder="Número" value={(form.numero as any) || ""} onChange={(e) => setForm((p) => ({ ...p, numero: e.target.value } as any))} />
              <Input className="sm:col-span-3" placeholder="Complemento" value={(form.complemento as any) || ""} onChange={(e) => setForm((p) => ({ ...p, complemento: e.target.value } as any))} />
              <Input placeholder="Bairro" value={(form.bairro as any) || ""} onChange={(e) => setForm((p) => ({ ...p, bairro: e.target.value } as any))} />
              <Input placeholder="Instagram" value={(form.instagram as any) || ""} onChange={(e) => setForm((p) => ({ ...p, instagram: e.target.value } as any))} />
            </div>
          </div>

          <div className="sm:col-span-2">
            <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Observações</div>
            <textarea
              className="pill min-h-[90px] w-full px-3 py-2 text-sm font-semibold text-[color:var(--ink)] outline-none"
              value={(form.notes as any) || ""}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value } as any))}
            />
          </div>
        </div>
      </Modal>

      {/* modal histórico */}
      <Modal
        open={histOpen}
        title={histTitle}
        subtitle={
          histLoading
            ? "Carregando…"
            : histError
            ? "Erro ao carregar"
            : `${history.orders.length} pedido(s) • ${history.budgets.length} orçamento(s) • ${history.timeline.length} evento(s)`
        }
        onClose={() => setHistOpen(false)}
        maxWidth="max-w-[1100px]"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="soft" onClick={() => setHistOpen(false)}>Fechar</Button>
          </div>
        }
      >
        {histError ? (
          <GlassCard className="border border-[rgba(220,38,38,0.18)] bg-[rgba(220,38,38,0.06)] p-4">
            <div className="text-sm font-extrabold text-[rgba(220,38,38,0.95)]">Erro</div>
            <div className="mt-1 text-sm font-semibold text-[color:var(--muted)]">{histError}</div>
          </GlassCard>
        ) : (
          <div className="space-y-3">
            <Tabs items={histTabs} value={histTab} onChange={(k) => setHistTab(k as HistTab)} />

            {histTab === "orders" ? (
              <DataTable
                title="Pedidos"
                subtitle="GET /api/clients/:id/history"
                rows={history.orders}
                rowKey={(r: any, i: number) => r?.id || `o_${i}`}
                columns={[
                  { header: "Criado", cell: (r: any) => isoToBR(r.createdAt) },
                  {
  header: "Status",
  cell: (r: any) => (
    <StatusPill
      tone={orderStatusTone(r.status) as any}
      label={orderStatusLabel(r.status)}
    />
  ),
},
                  { header: "Pagamento", cell: (r: any) => paymentLabel(r) },
                  { header: "Entrega", cell: (r: any) => isoToBR(r.expectedDeliveryAt) },
                  {
                    header: "Itens",
                    cell: (r: any) => {
                      const s = itemsSummary(r.items);
                      return (
                        <span title={s} className="block max-w-[520px] truncate">
                          {s}
                        </span>
                      );
                    },
                  },
                  { header: "Total", className: "text-right font-extrabold", cell: (r: any) => moneyBRLFromCents(r.totalCents || 0) },
                ]}
              />
            ) : null}

            {histTab === "budgets" ? (
              <DataTable
                title="Orçamentos"
                subtitle="GET /api/clients/:id/history"
                rows={history.budgets}
                rowKey={(r: any, i: number) => r?.id || `b_${i}`}
                columns={[
                  { header: "Criado", cell: (r: any) => isoToBR(r.createdAt) },
                 {
  header: "Status",
  cell: (r: any) => (
    <StatusPill
      tone={budgetStatusTone(r.status) as any}
      label={budgetStatusLabel(r.status)}
    />
  ),
},
                  { header: "Pagamento", cell: (r: any) => paymentLabel(r) },
                  { header: "Entrega", cell: (r: any) => isoToBR(r.expectedDeliveryAt) },
                  {
                    header: "Itens",
                    cell: (r: any) => {
                      const s = itemsSummary(r.items);
                      return (
                        <span title={s} className="block max-w-[520px] truncate">
                          {s}
                        </span>
                      );
                    },
                  },
                  { header: "Total", className: "text-right font-extrabold", cell: (r: any) => moneyBRLFromCents(r.totalCents || 0) },
                ]}
              />
            ) : null}

            {histTab === "timeline" ? (
              <GlassCard className="p-4">
                <div className="font-display text-sm font-black text-[color:var(--ink)]">Timeline</div>
                <div className="mt-2 text-sm font-semibold text-[color:var(--muted)]">
                  Observações do pedido/orçamento (eventos).
                </div>

                <div className="mt-3 divide-y divide-black/10 overflow-hidden rounded-2xl border border-[color:var(--line)] bg-white/35">
                  {history.timeline.length ? (
                    history.timeline.map((ev: any, idx: number) => (
                      <div key={idx} className="flex gap-4 p-4">
                        <div className="min-w-[150px] text-xs font-extrabold text-[color:var(--muted)]">
                          {isoToBR(ev.at)}
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-black text-[color:var(--ink)]">{ev.title || "Evento"}</div>
                          <div className="mt-1 text-sm font-semibold text-[color:var(--muted)]">
                            {ev.text ? ev.text : <span className="opacity-60">(sem observações)</span>}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-sm font-semibold text-[color:var(--muted)]">Nenhum evento.</div>
                  )}
                </div>
              </GlassCard>
            ) : null}
          </div>
        )}
      </Modal>
    </div>
  );
}