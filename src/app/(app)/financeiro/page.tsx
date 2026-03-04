"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, ArrowDownCircle, ArrowUpCircle, Tags, Wallet } from "lucide-react";

import PageHeader from "@/components/layout/PageHeader";
import Tabs from "@/components/ui/Tabs";
import Toolbar from "@/components/ui/Toolbar";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import KpiCard from "@/components/ui/KpiCard";
import DataTable from "@/components/ui/DataTable";
import Modal from "@/components/ui/Modal";
import StatusPill from "@/components/ui/StatusPill";
import GlassCard from "@/components/ui/GlassCard";
import Badge from "@/components/ui/Badge";
import WaveMiniCard from "@/components/charts/WaveMiniCard";

import { useGsapStagger } from "@/motion/useGsapStagger";
import { moneyBRLFromCents, isoToBR, isoToDateInput, parseBRLToCents, dateInputToISO, uid } from "@/lib/format";
import type { FinanceCategory, FinanceTransaction, Payable, Receivable } from "@/lib/types";

import {
  getCashflowByRange,
  getCashflowSeriesInCents,
  listReceivablesMonth,
  listPayablesMonth,
  listTransactions,
  listCategories,
  createCategory,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  ymdToYm,
} from "@/services/finance.service";

type Tab = "cashflow" | "receivables" | "payables" | "transactions";

function tabAccent(tab: Tab) {
  switch (tab) {
    case "cashflow":
      return { glow: "bg-[rgba(149,173,193,0.28)]", badgeTone: "ink" as const, label: "Fluxo" };
    case "receivables":
      return { glow: "bg-[rgba(22,163,74,0.20)]", badgeTone: "success" as const, label: "Recebimentos" };
    case "payables":
      return { glow: "bg-[rgba(194,65,12,0.18)]", badgeTone: "wood" as const, label: "Pagamentos" };
    case "transactions":
    default:
      return { glow: "bg-[rgba(247,211,32,0.18)]", badgeTone: "brand" as const, label: "Extrato" };
  }
}

export default function FinanceiroPage() {
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useGsapStagger(wrapRef, {
    selector: "[data-stagger]",
    y: 14,
    duration: 0.5,
    stagger: 0.05,
  });

  const tabs = useMemo(
    () => [
      { key: "cashflow", label: "Fluxo" },
      { key: "receivables", label: "Recebimentos" },
      { key: "payables", label: "Pagamentos" },
      { key: "transactions", label: "Extrato" },
    ],
    []
  );

  const [tab, setTab] = useState<Tab>("cashflow");
  const accent = tabAccent(tab);

  // draft range
  const [draftFrom, setDraftFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return isoToDateInput(d.toISOString());
  });
  const [draftTo, setDraftTo] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1, 0);
    return isoToDateInput(d.toISOString());
  });

  // applied range
  const [from, setFrom] = useState(draftFrom);
  const [to, setTo] = useState(draftTo);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [cashflow, setCashflow] = useState({
    previousBalanceCents: 0,
    inCents: 0,
    outCents: 0,
    balanceCents: 0,
  });

  const [cashflowPoints, setCashflowPoints] = useState<Array<{ label: string; valueCents: number }>>([]);

  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [payables, setPayables] = useState<Payable[]>([]);

  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [txs, setTxs] = useState<FinanceTransaction[]>([]);

  const [txTypeFilter, setTxTypeFilter] = useState<"" | "IN" | "OUT">("");
  const [txCatFilter, setTxCatFilter] = useState<string>("");

  // Modais
  const [txOpen, setTxOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [txEditing, setTxEditing] = useState<FinanceTransaction | null>(null);

  const [txForm, setTxForm] = useState({
    type: "IN" as "IN" | "OUT",
    name: "",
    date: isoToDateInput(new Date().toISOString()),
    amount: "",
    categoryId: "",
    notes: "",
  });

  const [catForm, setCatForm] = useState({ name: "", type: "" as "" | "IN" | "OUT" });

  async function loadAllCore() {
    setLoading(true);
    setError(null);

    try {
      const month = ymdToYm(from);

      const [cf, series, rec, pay] = await Promise.all([
        getCashflowByRange({ fromYmd: from, toYmd: to, basis: "due" }),
        getCashflowSeriesInCents({ fromYmd: from, toYmd: to, basis: "due", maxMonths: 8 }),
        listReceivablesMonth(month),
        listPayablesMonth(month),
      ]);

      setCashflow(cf);
      setCashflowPoints(series);
      setReceivables(rec);
      setPayables(pay);
    } catch (e: any) {
      setError(e?.message || "Erro ao carregar financeiro.");
    } finally {
      setLoading(false);
    }
  }

  async function loadTxAndCats() {
    try {
      const [cats, list] = await Promise.all([
        listCategories().catch(() => []),
        listTransactions({ fromYmd: from, toYmd: to, type: txTypeFilter || "", categoryId: txCatFilter || "" }).catch(() => []),
      ]);
      setCategories(cats);
      setTxs(list);
    } catch {
      // silencioso (UI mostra só se quiser)
    }
  }

  useEffect(() => {
    loadAllCore();
  }, [from, to]);

  useEffect(() => {
    if (tab === "transactions") loadTxAndCats();
  }, [tab, from, to, txTypeFilter, txCatFilter]);

  function applyRange() {
    setFrom(draftFrom);
    setTo(draftTo);
  }

  function openNewTx(type: "IN" | "OUT") {
    setTxEditing(null);
    setTxForm({
      type,
      name: "",
      date: isoToDateInput(new Date().toISOString()),
      amount: "",
      categoryId: "",
      notes: "",
    });
    setTxOpen(true);
  }

  async function saveTx() {
    const occurredAt = dateInputToISO(txForm.date) || new Date().toISOString();
    const amountCents = parseBRLToCents(txForm.amount);

    if (!txForm.name.trim()) return;
    if (amountCents <= 0) return;

    try {
      if (!txEditing) {
        await createTransaction({
          type: txForm.type,
          name: txForm.name.trim(),
          occurredAt,
          amountCents,
          categoryId: txForm.categoryId || null,
          notes: txForm.notes || null,
        });
      } else {
        await updateTransaction(txEditing.id, {
          type: txForm.type,
          name: txForm.name.trim(),
          occurredAt,
          amountCents,
          categoryId: txForm.categoryId || null,
          notes: txForm.notes || null,
        });
      }

      setTxOpen(false);
      setTxEditing(null);

      // recarrega extrato + cashflow pra refletir
      await Promise.all([loadTxAndCats(), loadAllCore()]);
    } catch (e: any) {
      alert(e?.message || "Erro ao salvar lançamento.");
    }
  }

  function editTx(t: FinanceTransaction) {
    if (String(t.source || "MANUAL").toUpperCase() !== "MANUAL") return;

    setTxEditing(t);
    setTxForm({
      type: t.type as any,
      name: t.name,
      date: isoToDateInput(t.occurredAt),
      amount: String((t.amountCents || 0) / 100).replace(".", ","),
      categoryId: t.categoryId || "",
      notes: t.notes || "",
    });
    setTxOpen(true);
  }

  async function delTx(t: FinanceTransaction) {
    if (String(t.source || "MANUAL").toUpperCase() !== "MANUAL") return;

    const ok = confirm("Excluir este lançamento?");
    if (!ok) return;

    try {
      await deleteTransaction(t.id);
      await Promise.all([loadTxAndCats(), loadAllCore()]);
    } catch (e: any) {
      alert(e?.message || "Erro ao excluir lançamento.");
    }
  }

  async function saveCat() {
    if (!catForm.name.trim()) return;

    try {
      await createCategory({ name: catForm.name.trim(), type: (catForm.type || null) as any });
      setCatOpen(false);
      setCatForm({ name: "", type: "" });
      await loadTxAndCats();
    } catch (e: any) {
      alert(e?.message || "Erro ao salvar categoria.");
    }
  }

  return (
    <div ref={wrapRef} className="space-y-4">
      <div data-stagger>
        <PageHeader
          title="Financeiro"
          subtitle="Conectado ao backend (M5). Basis=due, include=all e filtros iguais ao legado."
          badge={{ label: "M5", tone: "brand" }}
          right={<Tabs items={tabs} value={tab} onChange={(k) => setTab(k as Tab)} />}
        />
      </div>

      {/* Header strip */}
      <div data-stagger>
        <GlassCard className="relative overflow-hidden p-4 sm:p-5">
          <div className={`pointer-events-none absolute -top-12 -right-12 h-56 w-56 rounded-full blur-3xl ${accent.glow}`} />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[44%] bg-white/30" />

          <div className="relative flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Badge tone={accent.badgeTone}>{accent.label}</Badge>
                {loading ? <Badge tone="ink">Carregando…</Badge> : <Badge tone="success">Online</Badge>}
              </div>
              <div className="mt-2 font-display text-lg font-black text-[color:var(--ink)]">Período</div>
              <div className="mt-1 text-sm font-semibold text-[color:var(--muted)]">
                Cashflow por vencimento (basis=due), igual no legado.
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="w-[160px]">
                <Input type="date" value={draftFrom} onChange={(e) => setDraftFrom(e.target.value)} />
              </div>
              <div className="w-[160px]">
                <Input type="date" value={draftTo} onChange={(e) => setDraftTo(e.target.value)} />
              </div>
              <Button variant="dark" onClick={applyRange}>Aplicar</Button>
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
        <KpiCard label="Saldo anterior" value={moneyBRLFromCents(cashflow.previousBalanceCents)} icon={ArrowUpCircle} hint="Virada do mês" tone="neutral" />
        <KpiCard label="Entradas" value={moneyBRLFromCents(cashflow.inCents)} icon={ArrowUpCircle} hint="Recebimentos + entradas" tone="success" />
        <KpiCard label="Saídas" value={moneyBRLFromCents(cashflow.outCents)} icon={ArrowDownCircle} hint="Pagamentos + saídas" tone="danger" />
        <KpiCard label="Saldo do mês" value={moneyBRLFromCents(cashflow.balanceCents)} icon={Wallet} hint="Anterior + Entradas - Saídas" tone="brand" />
      </section>

      {/* Toolbar */}
      <div data-stagger>
        <Toolbar
          left={
            tab === "transactions" ? (
              <>
                <div className="w-[200px] max-w-full">
                  <Select value={txTypeFilter} onChange={(e) => setTxTypeFilter(e.target.value as any)}>
                    <option value="">Tipo: Todos</option>
                    <option value="IN">Entrada</option>
                    <option value="OUT">Saída</option>
                  </Select>
                </div>

                <div className="w-[260px] max-w-full">
                  <Select value={txCatFilter} onChange={(e) => setTxCatFilter(e.target.value)}>
                    <option value="">Categoria: Todas</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </Select>
                </div>
              </>
            ) : (
              <div className="text-sm font-semibold text-[color:var(--muted)]">
                {tab === "cashflow"
                  ? "Mini-wave real por mês (entradas)."
                  : tab === "receivables"
                  ? `Recebimentos do mês ${ymdToYm(from)}`
                  : tab === "payables"
                  ? `Pagamentos do mês ${ymdToYm(from)}`
                  : ""}
              </div>
            )
          }
          right={
            tab === "transactions" ? (
              <>
                <Button variant="soft" onClick={() => setCatOpen(true)}>
                  <Tags className="h-4 w-4" /> Categoria
                </Button>
                <Button variant="soft" onClick={() => openNewTx("OUT")}>
                  <ArrowDownCircle className="h-4 w-4" /> Saída
                </Button>
                <Button variant="dark" onClick={() => openNewTx("IN")}>
                  <ArrowUpCircle className="h-4 w-4" /> Entrada
                </Button>
              </>
            ) : (
              <Button variant="soft" onClick={loadAllCore}>
                <Plus className="h-4 w-4" /> Recarregar
              </Button>
            )
          }
        />
      </div>

      {/* Conteúdo */}
      {tab === "cashflow" ? (
        <section className="grid gap-3 lg:grid-cols-[0.95fr_1.05fr]" data-stagger>
          <WaveMiniCard
            title="Evolução"
            subtitle="Entradas por mês (real)"
            points={cashflowPoints.length ? cashflowPoints : [{ label: "—", valueCents: 0 }]}
            accent="brand"
          />

          <DataTable
            title="Resumo do fluxo"
            subtitle={`De ${from} até ${to} • /api/finance/cashflow`}
            rows={[
              { id: "1", label: "Saldo anterior", v: cashflow.previousBalanceCents },
              { id: "2", label: "Entradas", v: cashflow.inCents },
              { id: "3", label: "Saídas", v: cashflow.outCents },
              { id: "4", label: "Saldo do mês", v: cashflow.balanceCents },
            ]}
            rowKey={(r) => r.id}
            columns={[
              { header: "Campo", cell: (r) => r.label },
              { header: "Valor", className: "text-right font-extrabold", cell: (r) => moneyBRLFromCents(r.v) },
            ]}
          />
        </section>
      ) : null}

      {tab === "receivables" ? (
        <section data-stagger>
          <DataTable
            title="Recebimentos"
            subtitle="GET /api/finance/receivables/month"
            rows={receivables}
            rowKey={(r) => r.id}
            columns={[
              { header: "Vencimento", cell: (r: any) => isoToBR(r.dueDate) },
              { header: "Cliente", cell: (r: any) => r.clientName },
              { header: "Descrição", cell: (r: any) => r.description },
              { header: "Parcela", cell: (r: any) => r.installmentLabel || "—" },
              { header: "Valor", className: "text-right font-extrabold", cell: (r: any) => moneyBRLFromCents(r.amountCents) },
              {
                header: "Status",
                cell: (r: any) =>
                  String(r.status).toUpperCase() === "PAGO" ? (
                    <StatusPill tone="success" label="Pago" />
                  ) : (
                    <StatusPill tone="warning" label="Aberto" />
                  ),
              },
            ]}
          />
        </section>
      ) : null}

      {tab === "payables" ? (
        <section data-stagger>
          <DataTable
            title="Pagamentos"
            subtitle="GET /api/finance/payables/month"
            rows={payables}
            rowKey={(r) => r.id}
            columns={[
              { header: "Vencimento", cell: (r: any) => isoToBR(r.dueDate) },
              { header: "Fornecedor", cell: (r: any) => r.supplierName },
              { header: "Descrição", cell: (r: any) => r.description },
              { header: "Parcela", cell: (r: any) => r.installmentLabel || "—" },
              { header: "Valor", className: "text-right font-extrabold", cell: (r: any) => moneyBRLFromCents(r.amountCents) },
              {
                header: "Status",
                cell: (r: any) =>
                  String(r.status).toUpperCase() === "PAGO" ? (
                    <StatusPill tone="success" label="Pago" />
                  ) : (
                    <StatusPill tone="warning" label="Aberto" />
                  ),
              },
            ]}
          />
        </section>
      ) : null}

      {tab === "transactions" ? (
        <section data-stagger>
          <DataTable
            title="Extrato"
            subtitle="GET /api/finance/transactions?include=all (somente MANUAL editável)"
            rows={txs}
            rowKey={(r) => r.id}
            right={<Badge tone="ink">Itens: {txs.length}</Badge>}
            columns={[
              { header: "Data", cell: (r: any) => isoToBR(r.occurredAt) },
              {
                header: "Tipo",
                cell: (r: any) =>
                  r.type === "IN" ? (
                    <StatusPill tone="success" label="Entrada" />
                  ) : (
                    <StatusPill tone="danger" label="Saída" />
                  ),
              },
              {
                header: "Source",
                cell: (r: any) => {
                  const s = String(r.source || "MANUAL").toUpperCase();
                  if (s.includes("RECEIV")) return <StatusPill tone="success" label="Recebível" />;
                  if (s.includes("PAYAB")) return <StatusPill tone="wood" label="Pagável" />;
                  if (s.includes("COST")) return <StatusPill tone="warning" label="Custo" />;
                  return <StatusPill tone="neutral" label="Manual" />;
                },
              },
              { header: "Categoria", cell: (r: any) => r.categoryName || "—" },
              { header: "Nome", cell: (r: any) => r.name },
              { header: "Valor", className: "text-right font-extrabold", cell: (r: any) => moneyBRLFromCents(r.amountCents) },
              {
                header: "Ações",
                className: "text-right",
                cell: (r: any) => (
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => editTx(r)}
                      disabled={String(r.source || "MANUAL").toUpperCase() !== "MANUAL"}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => delTx(r)}
                      disabled={String(r.source || "MANUAL").toUpperCase() !== "MANUAL"}
                    >
                      Excluir
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        </section>
      ) : null}

      {/* MODAL TX */}
      <Modal
        open={txOpen}
        title={txEditing ? "Editar lançamento" : "Novo lançamento"}
        subtitle="POST/PATCH /api/finance/transactions"
        onClose={() => setTxOpen(false)}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="soft" onClick={() => setTxOpen(false)}>Cancelar</Button>
            <Button variant="dark" onClick={saveTx}>Salvar</Button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Tipo</div>
            <Select value={txForm.type} onChange={(e) => setTxForm((p) => ({ ...p, type: e.target.value as any }))}>
              <option value="IN">Entrada</option>
              <option value="OUT">Saída</option>
            </Select>
          </div>

          <div>
            <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Data</div>
            <Input type="date" value={txForm.date} onChange={(e) => setTxForm((p) => ({ ...p, date: e.target.value }))} />
          </div>

          <div className="sm:col-span-2">
            <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Nome</div>
            <Input value={txForm.name} onChange={(e) => setTxForm((p) => ({ ...p, name: e.target.value }))} />
          </div>

          <div>
            <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Valor (R$)</div>
            <Input value={txForm.amount} onChange={(e) => setTxForm((p) => ({ ...p, amount: e.target.value }))} placeholder="120,50" />
          </div>

          <div>
            <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Categoria</div>
            <Select value={txForm.categoryId} onChange={(e) => setTxForm((p) => ({ ...p, categoryId: e.target.value }))}>
              <option value="">Sem categoria</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>

          <div className="sm:col-span-2">
            <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Observações</div>
            <textarea
              className="pill min-h-[90px] w-full px-3 py-2 text-sm font-semibold text-[color:var(--ink)] outline-none"
              value={txForm.notes}
              onChange={(e) => setTxForm((p) => ({ ...p, notes: e.target.value }))}
            />
          </div>
        </div>
      </Modal>

      {/* MODAL CAT */}
      <Modal
        open={catOpen}
        title="Nova categoria"
        subtitle="POST /api/finance/categories"
        onClose={() => setCatOpen(false)}
        maxWidth="max-w-[640px]"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="soft" onClick={() => setCatOpen(false)}>Cancelar</Button>
            <Button variant="dark" onClick={saveCat}>Salvar</Button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Nome</div>
            <Input value={catForm.name} onChange={(e) => setCatForm((p) => ({ ...p, name: e.target.value }))} />
          </div>
          <div>
            <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Tipo</div>
            <Select value={catForm.type} onChange={(e) => setCatForm((p) => ({ ...p, type: e.target.value as any }))}>
              <option value="">Sem</option>
              <option value="IN">Entrada</option>
              <option value="OUT">Saída</option>
            </Select>
          </div>
        </div>
      </Modal>
    </div>
  );
}