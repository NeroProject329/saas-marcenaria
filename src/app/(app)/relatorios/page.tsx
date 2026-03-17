"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, RefreshCw } from "lucide-react";

import PageHeader from "@/components/layout/PageHeader";
import GlassCard from "@/components/ui/GlassCard";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Tabs from "@/components/ui/Tabs";
import Select from "@/components/ui/Select";
import DataTable from "@/components/ui/DataTable";
import StatusPill from "@/components/ui/StatusPill";

import { useGsapStagger } from "@/motion/useGsapStagger";
import { moneyBRLFromCents, isoToBR } from "@/lib/format";
import { financeStatusLabel, financeStatusTone, orderStatusLabel, orderStatusTone, reportBasisLabel } from "@/lib/status";
import {
  getReportPack,
  downloadReportPackPdf,
  downloadSalesHistoryPdf,
} from "@/services/reports.service";
import { listOrders } from "@/services/orders.service";
import type { Order } from "@/lib/types";

type Tab = "summary" | "cash" | "overdue" | "tx" | "sales";

type SalesStatusFilter = "ALL" | Order["status"];

const SALES_STATUS_OPTIONS: Array<{ value: SalesStatusFilter; label: string }> = [
  { value: "ALL", label: "Todos" },
  { value: "ORCAMENTO", label: "Orçamento" },
  { value: "PEDIDO", label: "Pedido" },
  { value: "EM_PRODUCAO", label: "Em produção" },
  { value: "PRONTO", label: "Pronto" },
  { value: "ENTREGUE", label: "Entregue" },
  { value: "CANCELADO", label: "Cancelado" },
];

function monthNow() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function isInMonth(iso: string | null | undefined, month: string) {
  if (!iso || !month) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}` === month;
}

function paymentLabel(order: Order) {
  const mode = order.paymentMode === "PARCELADO" ? "Parcelado" : "À vista";
  const methodMap: Record<string, string> = {
    PIX: "Pix",
    DINHEIRO: "Dinheiro",
    CARTAO: "Cartão",
    BOLETO: "Boleto",
  };
  const method = methodMap[String(order.paymentMethod || "").toUpperCase()] || String(order.paymentMethod || "").trim();
  return method ? `${mode} • ${method}` : mode;
}

export default function RelatoriosPage() {
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useGsapStagger(wrapRef, { selector: "[data-stagger]", y: 14, duration: 0.5, stagger: 0.05 });

  const [tab, setTab] = useState<Tab>("summary");
  const tabs = useMemo(
    () => [
      { key: "summary", label: "Resumo" },
      { key: "cash", label: "Demonstração dos Fluxos de Caixa (DFC)" },
      { key: "overdue", label: "Vencidos" },
      { key: "tx", label: "Últimas transações" },
      { key: "sales", label: "Histórico de vendas" },
    ],
    []
  );

  const [month, setMonth] = useState(monthNow());
  const [basis, setBasis] = useState<"due" | "paid">("due");

  const [salesStatus, setSalesStatus] = useState<SalesStatusFilter>("ALL");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pack, setPack] = useState<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const [packData, ordersData] = await Promise.all([
        getReportPack({ month, basis }),
        listOrders().catch(() => []),
      ]);
      setPack(packData);
      setOrders(ordersData);
    } catch (e: any) {
      setErr(e?.message || "Erro ao carregar relatório.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, basis]);

  async function onPdf() {
    const blob = await downloadReportPackPdf({ month, basis });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Relatorio_${month}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  async function onSalesPdf() {
    const blob = await downloadSalesHistoryPdf({ month, status: salesStatus });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeStatus = salesStatus === "ALL" ? "TODOS" : salesStatus;

    a.href = url;
    a.download = `Historico_Vendas_${month}_${safeStatus}.pdf`;

    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  const summary = pack?.summary || {};
  const dre = pack?.dre || {};
  const dfcReal = pack?.dfc?.real || {};
  const dfcProj = pack?.dfc?.projected || {};
  const upcoming = pack?.upcoming || {};
  const overdue = pack?.overdue || {};
  const lastTx = pack?.lastTransactions || [];

const salesRows = useMemo(() => {
  return (orders || [])
    .filter((order) => isInMonth(order.createdAt, month) || isInMonth(order.expectedDeliveryAt || null, month))
    .filter((order) => (salesStatus === "ALL" ? true : order.status === salesStatus))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}, [orders, month, salesStatus]);

const salesStatusLabel = salesStatus === "ALL" ? "Todos" : orderStatusLabel(salesStatus);
  const salesTotalCents = useMemo(
    () => salesRows.reduce((acc, order) => acc + (Number(order.totalCents) || 0), 0),
    [salesRows]
  );

  return (
    <div ref={wrapRef} className="space-y-4">
      <div data-stagger>
        <PageHeader
          title="Relatórios"
          subtitle="Resumo financeiro, DRE, DFC, vencidos, últimas transações e vendas entregues no PDF completo."
          badge={{ label: "Gestão", tone: "brand" }}
          right={
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-[170px]">
                <input
                  className="pill w-full px-3 py-2 text-sm font-semibold text-[color:var(--ink)] outline-none"
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                />
              </div>

              <div className="w-[210px]">
                <Select value={basis} onChange={(e) => setBasis(e.target.value as any)}>
                  <option value="due">Base: por vencimento</option>
                  <option value="paid">Base: por pagamento</option>
                </Select>
              </div>

              <Button variant="soft" onClick={load}>
                <RefreshCw className="h-4 w-4" /> Atualizar
              </Button>
              <Button variant="dark" onClick={onPdf}>
                <Download className="h-4 w-4" /> Baixar PDF completo
              </Button>
            </div>
          }
        />
      </div>

      {err ? (
        <div data-stagger>
          <GlassCard className="border border-[rgba(220,38,38,0.18)] bg-[rgba(220,38,38,0.06)] p-4">
            <div className="text-sm font-extrabold text-[rgba(220,38,38,0.95)]">Erro</div>
            <div className="mt-1 text-sm font-semibold text-[color:var(--muted)]">{err}</div>
          </GlassCard>
        </div>
      ) : null}

      <div data-stagger>
        <Tabs items={tabs} value={tab} onChange={(k) => setTab(k as Tab)} />
      </div>

      {tab === "summary" ? (
        <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]" data-stagger>
          <GlassCard className="p-4">
            <div className="flex items-center justify-between">
              <div className="font-display text-sm font-black text-[color:var(--ink)]">Resumo do período</div>
              <Badge tone="ink">{loading ? "Carregando…" : `Base: ${reportBasisLabel(basis)}`}</Badge>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <GlassCard className="p-4">
                <div className="text-xs font-extrabold text-[color:var(--muted)]">Receitas</div>
                <div className="mt-2 font-display text-2xl font-black text-[color:var(--ink)]">
                  {moneyBRLFromCents(summary.revenueCents || 0)}
                </div>
                <div className="mt-1 text-xs font-semibold text-[color:var(--muted)]">Entradas efetivas no período</div>
              </GlassCard>

              <GlassCard className="p-4">
                <div className="text-xs font-extrabold text-[color:var(--muted)]">Despesas</div>
                <div className="mt-2 font-display text-2xl font-black text-[color:var(--ink)]">
                  {moneyBRLFromCents(summary.expensesCents || 0)}
                </div>
                <div className="mt-1 text-xs font-semibold text-[color:var(--muted)]">Saídas efetivas no período</div>
              </GlassCard>

              <GlassCard className="p-4">
                <div className="text-xs font-extrabold text-[color:var(--muted)]">Saldo líquido</div>
                <div className="mt-2 font-display text-2xl font-black text-[color:var(--ink)]">
                  {moneyBRLFromCents(summary.netCents || 0)}
                </div>
                <div className="mt-1 text-xs font-semibold text-[color:var(--muted)]">Receitas menos despesas</div>
              </GlassCard>
            </div>
          </GlassCard>

          <DataTable
            title="Demonstração do Resultado do Exercício (DRE)"
            subtitle={`Base: ${reportBasisLabel(basis)}`}
            rows={[
              { k: "Receita do período", v: moneyBRLFromCents(dre.revenueCents || 0) },
              { k: "Custos variáveis", v: moneyBRLFromCents(dre.variableCostsCents || 0) },
              { k: "Lucro bruto", v: moneyBRLFromCents(dre.grossProfitCents || 0) },
              { k: "Custos fixos", v: moneyBRLFromCents(dre.fixedCostsCents || 0) },
              { k: "Lucro operacional", v: moneyBRLFromCents(dre.operatingProfitCents || 0) },
              { k: "Margem", v: `${Number(dre.marginPct || 0).toFixed(2)}%` },
            ]}
            rowKey={(r: any, i: number) => `${r.k}_${i}`}
            columns={[
              { header: "Linha", cell: (r: any) => r.k },
              { header: "Valor", className: "text-right font-extrabold", cell: (r: any) => r.v },
            ]}
          />
        </div>
      ) : null}

      {tab === "cash" ? (
        <div className="space-y-3" data-stagger>
          <DataTable
            title="Demonstração dos Fluxos de Caixa (DFC)"
            subtitle="Realizado x projetado"
            rows={[
              {
                kind: "Realizado",
                initial: dfcReal.initialBalanceCents || 0,
                ins: dfcReal.inCents || 0,
                outs: dfcReal.outCents || 0,
                final: dfcReal.finalBalanceCents || 0,
              },
              {
                kind: "Projetado",
                initial: dfcProj.initialBalanceCents || 0,
                ins: dfcProj.inCents || 0,
                outs: dfcProj.outCents || 0,
                final: dfcProj.finalBalanceCents || 0,
              },
            ]}
            rowKey={(r: any) => r.kind}
            columns={[
              { header: "Tipo", cell: (r: any) => r.kind },
              { header: "Saldo inicial", className: "text-right font-extrabold", cell: (r: any) => moneyBRLFromCents(r.initial) },
              { header: "Entradas", className: "text-right font-extrabold", cell: (r: any) => moneyBRLFromCents(r.ins) },
              { header: "Saídas", className: "text-right font-extrabold", cell: (r: any) => moneyBRLFromCents(r.outs) },
              { header: "Saldo final", className: "text-right font-extrabold", cell: (r: any) => moneyBRLFromCents(r.final) },
            ]}
          />

          <DataTable
            title="Próximos vencimentos"
            subtitle="Janelas de 7, 15 e 30 dias"
            rows={[
              { d: "7 dias", recv: upcoming?.d7?.toReceiveCents || 0, pay: upcoming?.d7?.toPayCents || 0 },
              { d: "15 dias", recv: upcoming?.d15?.toReceiveCents || 0, pay: upcoming?.d15?.toPayCents || 0 },
              { d: "30 dias", recv: upcoming?.d30?.toReceiveCents || 0, pay: upcoming?.d30?.toPayCents || 0 },
            ]}
            rowKey={(r: any) => r.d}
            columns={[
              { header: "Janela", cell: (r: any) => r.d },
              { header: "A receber", className: "text-right font-extrabold", cell: (r: any) => moneyBRLFromCents(r.recv) },
              { header: "A pagar", className: "text-right font-extrabold", cell: (r: any) => moneyBRLFromCents(r.pay) },
            ]}
          />
        </div>
      ) : null}

      {tab === "overdue" ? (
        <div className="space-y-3" data-stagger>
          <GlassCard className="p-4">
            <div className="font-display text-sm font-black text-[color:var(--ink)]">Movimentos vencidos</div>
            <div className="mt-1 text-sm font-semibold text-[color:var(--muted)]">
              A receber: {moneyBRLFromCents(overdue?.totals?.toReceiveCents || 0)} • A pagar:{" "}
              {moneyBRLFromCents(overdue?.totals?.toPayCents || 0)}
            </div>
          </GlassCard>

          <DataTable
            title="Itens vencidos"
            subtitle="Até 25 registros"
            rows={(overdue?.items || []).slice(0, 25)}
            rowKey={(r: any, i: number) => r.id || `od_${i}`}
            columns={[
              { header: "Vencimento", cell: (r: any) => isoToBR(r.dueDate) },
              { header: "Tipo", cell: (r: any) => r.kind === "PAYABLE" ? "Pagamento" : r.kind === "RECEIVABLE" ? "Recebimento" : r.kind },
              { header: "Título", cell: (r: any) => r.subtitle || r.title || "—" },
              { header: "Valor", className: "text-right font-extrabold", cell: (r: any) => moneyBRLFromCents(r.amountCents || 0) },
              { header: "Status", cell: (r: any) => <StatusPill tone={financeStatusTone(r.status || "VENCIDO") as any} label={financeStatusLabel(r.status || "VENCIDO")} /> },
            ]}
          />
        </div>
      ) : null}

      {tab === "tx" ? (
        <div data-stagger>
          <DataTable
            title="Últimas transações do período"
            subtitle="Movimentações financeiras mais recentes"
            rows={lastTx}
            rowKey={(r: any, i: number) => r.id || `tx_${i}`}
            columns={[
              { header: "Data", cell: (r: any) => isoToBR(r.occurredAt) },
              { header: "Origem", cell: (r: any) => r.source || "—" },
              { header: "Nome", cell: (r: any) => r.name },
              {
                header: "Valor",
                className: "text-right font-extrabold",
                cell: (r: any) => `${r.type === "IN" ? "+" : "-"}${moneyBRLFromCents(r.amountCents || 0)}`,
              },
            ]}
          />
        </div>
      ) : null}

      {tab === "sales" ? (
  <div className="space-y-3" data-stagger>
    <GlassCard className="p-4">
      <div className="grid gap-3 lg:grid-cols-[240px_1fr_auto] lg:items-end">
        <div>
          <div className="text-xs font-extrabold text-[color:var(--muted)]">Filtrar por status</div>
          <div className="mt-2">
            <Select value={salesStatus} onChange={(e) => setSalesStatus(e.target.value as SalesStatusFilter)}>
              {SALES_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="text-sm font-semibold text-[color:var(--muted)]">
          Exibindo vendas do mês <span className="font-black text-[color:var(--ink)]">{month}</span> com filtro{" "}
          <span className="font-black text-[color:var(--ink)]">{salesStatusLabel}</span>.
        </div>

        <div className="lg:justify-self-end">
          <Button variant="soft" onClick={onSalesPdf}>
            <Download className="h-4 w-4" /> Baixar PDF do histórico
          </Button>
        </div>
      </div>
    </GlassCard>

    <div className="grid gap-3 md:grid-cols-3">
      <GlassCard className="p-4">
        <div className="text-xs font-extrabold text-[color:var(--muted)]">Vendas no período</div>
        <div className="mt-2 font-display text-2xl font-black text-[color:var(--ink)]">{salesRows.length}</div>
        <div className="mt-1 text-xs font-semibold text-[color:var(--muted)]">
          Registros do mês com filtro: {salesStatusLabel}
        </div>
      </GlassCard>

      <GlassCard className="p-4 md:col-span-2">
        <div className="text-xs font-extrabold text-[color:var(--muted)]">Total vendido no período</div>
        <div className="mt-2 font-display text-2xl font-black text-[color:var(--ink)]">
          {moneyBRLFromCents(salesTotalCents)}
        </div>
        <div className="mt-1 text-xs font-semibold text-[color:var(--muted)]">
          Soma dos pedidos/orçamentos visíveis com o filtro atual
        </div>
      </GlassCard>
    </div>

    <DataTable
      title="Histórico de vendas"
      subtitle={`Pedidos do mês ${month} • Status: ${salesStatusLabel}`}
      rows={salesRows}
      rowKey={(r) => r.id}
      columns={[
        { header: "Criado em", cell: (r) => isoToBR(r.createdAt) },
        { header: "Cliente", cell: (r) => r.clientName || "—" },
        {
          header: "Status",
          cell: (r) => (
            <StatusPill tone={orderStatusTone(r.status) as any} label={orderStatusLabel(r.status)} />
          ),
        },
        { header: "Entrega prevista", cell: (r) => isoToBR(r.expectedDeliveryAt || null) },
        { header: "Pagamento", cell: (r) => paymentLabel(r) },
        { header: "Valor", className: "text-right font-extrabold", cell: (r) => moneyBRLFromCents(r.totalCents || 0) },
      ]}
    />
  </div>
) : null}
    </div>
  );
}