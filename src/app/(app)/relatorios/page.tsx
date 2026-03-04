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

import { useGsapStagger } from "@/motion/useGsapStagger";
import { moneyBRLFromCents, isoToBR } from "@/lib/format";
import { getReportPack, downloadReportPackPdf } from "@/services/reports.service";

type Tab = "summary" | "cash" | "overdue" | "tx";

function monthNow() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function RelatoriosPage() {
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useGsapStagger(wrapRef, { selector: "[data-stagger]", y: 14, duration: 0.5, stagger: 0.05 });

  const [tab, setTab] = useState<Tab>("summary");
  const tabs = useMemo(
    () => [
      { key: "summary", label: "Resumo" },
      { key: "cash", label: "DFC" },
      { key: "overdue", label: "Vencidos" },
      { key: "tx", label: "Transações" },
    ],
    []
  );

  const [month, setMonth] = useState(monthNow());
  const [basis, setBasis] = useState<"due" | "paid">("due");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pack, setPack] = useState<any>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const data = await getReportPack({ month, basis });
      setPack(data);
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

  const summary = pack?.summary || {};
  const dre = pack?.dre || {};
  const dfcReal = pack?.dfc?.real || {};
  const dfcProj = pack?.dfc?.projected || {};
  const upcoming = pack?.upcoming || {};
  const overdue = pack?.overdue || {};
  const lastTx = pack?.lastTransactions || [];

  return (
    <div ref={wrapRef} className="space-y-4">
      <div data-stagger>
        <PageHeader
          title="Relatórios"
          subtitle="Pack completo: resumo, DRE, DFC, vencidos e últimas transações."
          badge={{ label: "M5", tone: "brand" }}
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

              <div className="w-[170px]">
                <Select value={basis} onChange={(e) => setBasis(e.target.value as any)}>
                  <option value="due">Base: DUE</option>
                  <option value="paid">Base: PAID</option>
                </Select>
              </div>

              <Button variant="soft" onClick={load}>
                <RefreshCw className="h-4 w-4" /> Atualizar
              </Button>
              <Button variant="dark" onClick={onPdf}>
                <Download className="h-4 w-4" /> Baixar PDF
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
              <div className="font-display text-sm font-black text-[color:var(--ink)]">Resumo</div>
              <Badge tone="ink">{loading ? "Carregando…" : `Mês: ${month}`}</Badge>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <GlassCard className="p-4">
                <div className="text-xs font-extrabold text-[color:var(--muted)]">Receitas (Real)</div>
                <div className="mt-2 font-display text-2xl font-black text-[color:var(--ink)]">
                  {moneyBRLFromCents(summary.revenueCents || 0)}
                </div>
                <div className="mt-1 text-xs font-semibold text-[color:var(--muted)]">Entradas pagas</div>
              </GlassCard>

              <GlassCard className="p-4">
                <div className="text-xs font-extrabold text-[color:var(--muted)]">Despesas (Real)</div>
                <div className="mt-2 font-display text-2xl font-black text-[color:var(--ink)]">
                  {moneyBRLFromCents(summary.expensesCents || 0)}
                </div>
                <div className="mt-1 text-xs font-semibold text-[color:var(--muted)]">Saídas pagas</div>
              </GlassCard>

              <GlassCard className="p-4">
                <div className="text-xs font-extrabold text-[color:var(--muted)]">Saldo líquido</div>
                <div className="mt-2 font-display text-2xl font-black text-[color:var(--ink)]">
                  {moneyBRLFromCents(summary.netCents || 0)}
                </div>
                <div className="mt-1 text-xs font-semibold text-[color:var(--muted)]">Receitas - Despesas</div>
              </GlassCard>
            </div>
          </GlassCard>

          <DataTable
            title="DRE"
            subtitle={`Base: ${basis.toUpperCase()}`}
            rows={[
              { k: "Receita do período", v: moneyBRLFromCents(dre.revenueCents || 0) },
              { k: "CMV / Custos variáveis", v: moneyBRLFromCents(dre.variableCostsCents || 0) },
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
            title="DFC"
            subtitle="Real x Projetado"
            rows={[
              {
                kind: "Real",
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
            subtitle="7/15/30 dias"
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
            <div className="font-display text-sm font-black text-[color:var(--ink)]">Vencidos</div>
            <div className="mt-1 text-sm font-semibold text-[color:var(--muted)]">
              A receber: {moneyBRLFromCents(overdue?.totals?.toReceiveCents || 0)} • A pagar:{" "}
              {moneyBRLFromCents(overdue?.totals?.toPayCents || 0)}
            </div>
          </GlassCard>

          <DataTable
            title="Itens vencidos"
            subtitle="Até 25 itens (igual legado)"
            rows={(overdue?.items || []).slice(0, 25)}
            rowKey={(r: any, i: number) => r.id || `od_${i}`}
            columns={[
              { header: "Venc.", cell: (r: any) => isoToBR(r.dueDate) },
              { header: "Tipo", cell: (r: any) => r.kind },
              { header: "Título", cell: (r: any) => r.subtitle || r.title || "—" },
              { header: "Valor", className: "text-right font-extrabold", cell: (r: any) => moneyBRLFromCents(r.amountCents || 0) },
              { header: "Status", cell: (r: any) => r.status || "PENDENTE" },
            ]}
          />
        </div>
      ) : null}

      {tab === "tx" ? (
        <div data-stagger>
          <DataTable
            title="Últimas transações"
            subtitle="Pack lastTransactions"
            rows={lastTx}
            rowKey={(r: any, i: number) => r.id || `tx_${i}`}
            columns={[
              { header: "Data", cell: (r: any) => isoToBR(r.occurredAt) },
              { header: "Origem", cell: (r: any) => r.source },
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
    </div>
  );
}