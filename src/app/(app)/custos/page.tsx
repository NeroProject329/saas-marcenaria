"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, RefreshCw, Trash2, Pencil, Search } from "lucide-react";

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
import KpiCard from "@/components/ui/KpiCard";
import Tabs from "@/components/ui/Tabs";

import { useGsapStagger } from "@/motion/useGsapStagger";
import { moneyBRLFromCents, isoToBR, parseBRLToCents } from "@/lib/format";

import {
  type Cost,
  type CostType,
  type SupplierMini,
  type CostsSummary,
  listCosts,
  getCostsSummary,
  listSuppliers,
  createCost,
  updateCost,
  deleteCost,
  type SaveCostPayload,
} from "@/services/costs.service";

type FilterTab = "ALL" | "FIXO" | "VARIAVEL";

function currentMonthYYYYMM() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${m}`;
}

function typeTone(t: CostType) {
  return t === "FIXO" ? "brand" : "wood";
}

export default function CustosPage() {
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useGsapStagger(wrapRef, {
    selector: "[data-stagger]",
    y: 14,
    duration: 0.5,
    stagger: 0.05,
  });

  // defaults com cache legado
  const [month, setMonth] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("marcenaria_costsMonth");
      if (saved) return saved;
    }
    return currentMonthYYYYMM();
  });

  const [workDays, setWorkDays] = useState(() => {
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem("marcenaria_workDays");
      const n = raw ? Number(raw) : NaN;
      if (Number.isFinite(n) && n > 0) return Math.trunc(n);
    }
    return 21;
  });

  const [tab, setTab] = useState<FilterTab>("ALL");
  const tabs = useMemo(
    () => [
      { key: "ALL", label: "Todos" },
      { key: "FIXO", label: "Fixos" },
      { key: "VARIAVEL", label: "Variáveis" },
    ],
    []
  );

  const [q, setQ] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [summary, setSummary] = useState<CostsSummary>({
    month,
    workDays,
    totals: { fixedCents: 0, variableCents: 0, totalCents: 0, dailyFixedCents: 0 },
  });

  const [costs, setCosts] = useState<Cost[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierMini[]>([]);

  async function reloadAll() {
    setLoading(true);
    setError(null);
    try {
      const [sup, sum, list] = await Promise.all([
        listSuppliers(),
        getCostsSummary(month, workDays),
        listCosts(month),
      ]);
      setSuppliers(sup);
      setSummary(sum);
      setCosts(list);

      // cache workDays/month igual legado
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("marcenaria_costsMonth", month);
          localStorage.setItem("marcenaria_workDays", String(workDays));
        } catch {}
      }
    } catch (e: any) {
      setError(e?.message || "Erro ao carregar custos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reloadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // refaz summary quando workDays mudar (igual legado)
  useEffect(() => {
    // não explode no primeiro render
    if (!month) return;
    getCostsSummary(month, workDays)
      .then(setSummary)
      .catch(() => {});
  }, [month, workDays]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();

    return costs.filter((c) => {
      if (tab !== "ALL" && c.type !== tab) return false;
      if (supplierFilter && String(c.supplierId || "") !== supplierFilter) return false;

      if (!qq) return true;
      const hay = `${c.type} ${c.name} ${c.category || ""} ${c.supplierName || ""} ${c.description || ""}`.toLowerCase();
      return hay.includes(qq);
    });
  }, [costs, tab, q, supplierFilter]);

  // ===== modal
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Cost | null>(null);

  const [form, setForm] = useState({
    name: "",
    type: "FIXO" as CostType,
    amount: "",
    category: "",
    occurredAt: "",
    supplierId: "",
    description: "",
    isRecurring: true,
  });

  function openNew() {
    setEditing(null);
    setForm({
      name: "",
      type: "FIXO",
      amount: "",
      category: "",
      occurredAt: "",
      supplierId: "",
      description: "",
      isRecurring: true,
    });
    setOpen(true);
  }

  function openEdit(c: Cost) {
    setEditing(c);
    setForm({
      name: c.name || "",
      type: c.type,
      amount: String((c.amountCents || 0) / 100).replace(".", ","),
      category: c.category || "",
      occurredAt: c.occurredAt ? String(c.occurredAt).slice(0, 10) : "",
      supplierId: c.supplierId || "",
      description: c.description || "",
      isRecurring: c.isRecurring !== false,
    });
    setOpen(true);
  }

  const preview = useMemo(() => {
    const amountCents = parseBRLToCents(form.amount);
    const daily = workDays > 0 ? Math.round(amountCents / workDays) : 0;
    return { amountCents, dailyCents: daily };
  }, [form.amount, workDays]);

  async function save() {
    const name = form.name.trim();
    const amountCents = parseBRLToCents(form.amount);
    if (name.length < 2) return alert("Informe um nome válido.");
    if (amountCents <= 0) return alert("Valor inválido.");

    const payload: SaveCostPayload = {
      name,
      type: form.type,
      amountCents,
      description: form.description.trim() ? form.description.trim() : null,
      supplierId: form.supplierId || null,
      occurredAt: form.occurredAt ? new Date(form.occurredAt + "T00:00:00").toISOString() : null,
      category: form.category.trim() ? form.category.trim() : null,
      isRecurring: !!form.isRecurring,
    };

    setLoading(true);
    try {
      if (editing) await updateCost(editing.id, payload);
      else await createCost(payload);

      setOpen(false);
      setEditing(null);
      await reloadAll();
    } catch (e: any) {
      alert(e?.message || "Erro ao salvar custo.");
    } finally {
      setLoading(false);
    }
  }

  async function remove(id: string) {
    const ok = confirm("Excluir este custo? Isso não pode ser desfeito.");
    if (!ok) return;

    setLoading(true);
    try {
      await deleteCost(id);
      await reloadAll();
    } catch (e: any) {
      alert(e?.message || "Erro ao excluir.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div ref={wrapRef} className="space-y-4">
      <div data-stagger>
        <PageHeader
          title="Custos"
          subtitle="M5 conectado: summary (custo do dia fixo) + lista por mês + CRUD."
          badge={{ label: "M5", tone: "brand" }}
          right={<Tabs items={tabs} value={tab} onChange={(k) => setTab(k as FilterTab)} />}
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
                <Badge tone="brand">Resumo</Badge>
                {loading ? <Badge tone="ink">Carregando…</Badge> : <Badge tone="success">Online</Badge>}
              </div>
              <div className="mt-2 font-display text-lg font-black text-[color:var(--ink)]">
                Custos do mês
              </div>
              <div className="mt-1 text-sm font-semibold text-[color:var(--muted)]">
                Custo do dia (fixo) vem do backend (usado no Orçamento).
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="w-[170px]">
                <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
              </div>
              <div className="w-[150px]">
                <Input
                  value={String(workDays)}
                  onChange={(e) => setWorkDays(Math.max(1, Number(e.target.value || 21)))}
                  placeholder="Dias úteis"
                />
              </div>

              <Button variant="soft" onClick={reloadAll}>
                <RefreshCw className="h-4 w-4" /> Recarregar
              </Button>
              <Button variant="dark" onClick={openNew}>
                <Plus className="h-4 w-4" /> Novo custo
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
        <KpiCard label="Fixo" value={moneyBRLFromCents(summary.totals.fixedCents)} icon={Plus} hint="Custos fixos" tone="brand" />
        <KpiCard label="Variável" value={moneyBRLFromCents(summary.totals.variableCents)} icon={Plus} hint="Custos variáveis" tone="wood" />
        <KpiCard label="Total mês" value={moneyBRLFromCents(summary.totals.totalCents)} icon={Plus} hint="Somatório" tone="neutral" />
        <KpiCard
          label="Custo diário (fixo)"
          value={moneyBRLFromCents(summary.totals.dailyFixedCents)}
          icon={Plus}
          hint={`${summary.workDays} dias úteis`}
          tone="success"
        />
      </section>

      {/* filtros */}
      <div data-stagger>
        <Toolbar
          left={
            <>
              <div className="w-[320px] max-w-full">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--muted)]" />
                  <Input
                    className="pl-10"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Buscar custo…"
                  />
                </div>
              </div>

              <div className="w-[260px] max-w-full">
                <Select value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)}>
                  <option value="">Fornecedor: todos</option>
                  {suppliers.map((s: SupplierMini) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>
            </>
          }
          right={<Badge tone="ink">Itens: {filtered.length}</Badge>}
        />
      </div>

      {/* tabela */}
      <div data-stagger>
        <DataTable
          title="Custos"
          subtitle="GET /api/costs?month=YYYY-MM"
          rows={filtered}
          rowKey={(r) => r.id}
          columns={[
            { header: "Tipo", cell: (r: Cost) => <StatusPill tone={typeTone(r.type) as any} label={r.type} /> },
            { header: "Nome", cell: (r: Cost) => r.name },
            { header: "Categoria", cell: (r: Cost) => r.category || "—" },
            { header: "Fornecedor", cell: (r: Cost) => r.supplierName || "—" },
            { header: "Data", cell: (r: Cost) => (r.occurredAt ? isoToBR(r.occurredAt) : "—") },
            { header: "Valor", className: "text-right font-extrabold", cell: (r: Cost) => moneyBRLFromCents(r.amountCents) },
            {
              header: "Ações",
              className: "text-right",
              cell: (r: Cost) => (
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => openEdit(r)}>
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

      {/* modal */}
      <Modal
        open={open}
        title={editing ? "Editar custo" : "Novo custo"}
        subtitle="POST/PATCH /api/costs"
        onClose={() => setOpen(false)}
        maxWidth="max-w-[980px]"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="soft" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="dark" onClick={save}>Salvar</Button>
          </div>
        }
      >
        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Nome</div>
              <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            </div>

            <div>
              <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Tipo</div>
              <Select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as any }))}>
                <option value="FIXO">FIXO</option>
                <option value="VARIAVEL">VARIÁVEL</option>
              </Select>
            </div>

            <div>
              <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Valor (R$)</div>
              <Input value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} placeholder="1200,00" />
            </div>

            <div>
              <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Categoria</div>
              <Input value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} placeholder="Ex: energia" />
            </div>

            <div>
              <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Data</div>
              <Input type="date" value={form.occurredAt} onChange={(e) => setForm((p) => ({ ...p, occurredAt: e.target.value }))} />
            </div>

            <div className="sm:col-span-2">
              <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Fornecedor</div>
              <Select value={form.supplierId} onChange={(e) => setForm((p) => ({ ...p, supplierId: e.target.value }))}>
                <option value="">Sem fornecedor</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </div>

            <div className="sm:col-span-2">
              <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Descrição</div>
              <textarea
                className="pill min-h-[90px] w-full px-3 py-2 text-sm font-semibold text-[color:var(--ink)] outline-none"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Detalhes do custo…"
              />
            </div>

            <div className="sm:col-span-2 flex items-center gap-2">
              <input
                id="rec"
                type="checkbox"
                checked={!!form.isRecurring}
                onChange={(e) => setForm((p) => ({ ...p, isRecurring: e.target.checked }))}
                className="h-4 w-4"
              />
              <label htmlFor="rec" className="text-sm font-semibold text-[color:var(--muted)]">
                Recorrente
              </label>
            </div>
          </div>

          {/* Preview premium */}
          <GlassCard className="relative overflow-hidden p-4">
            <div className="pointer-events-none absolute -top-10 -right-10 h-44 w-44 rounded-full bg-[rgba(247,211,32,0.18)] blur-3xl" />
            <div className="relative">
              <div className="font-display text-sm font-black text-[color:var(--ink)]">Preview</div>
              <div className="mt-2 space-y-2 text-sm font-semibold">
                <div className="flex items-center justify-between">
                  <span className="text-[color:var(--muted)]">Valor</span>
                  <span className="font-extrabold text-[color:var(--ink)]">{moneyBRLFromCents(preview.amountCents)} / mês</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[color:var(--muted)]">Por dia</span>
                  <span className="font-extrabold text-[color:var(--ink)]">{moneyBRLFromCents(preview.dailyCents)} / dia</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[color:var(--muted)]">Tipo</span>
                  <StatusPill tone={typeTone(form.type) as any} label={form.type === "VARIAVEL" ? "VARIÁVEL" : "FIXO"} />
                </div>
                <div className="mt-3 rounded-2xl border border-[color:var(--line)] bg-white/45 p-3 text-xs font-semibold text-[color:var(--muted)]">
                  O “Custo diário (fixo)” do orçamento vem do resumo do mês (summary).
                </div>
              </div>
            </div>
          </GlassCard>
        </div>
      </Modal>
    </div>
  );
}