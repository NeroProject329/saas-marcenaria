"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  TrendingUp,
  Wallet,
  Hammer,
  Users,
  ArrowUpRight,
  ArrowDownCircle,
  ArrowUpCircle,
  FileText,
  Boxes,
} from "lucide-react";

import PageHeader from "@/components/layout/PageHeader";
import GlassCard from "@/components/ui/GlassCard";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import Tabs from "@/components/ui/Tabs";
import KpiCard from "@/components/ui/KpiCard";
import DataTable from "@/components/ui/DataTable";
import StatusPill from "@/components/ui/StatusPill";
import { useGsapStagger } from "@/motion/useGsapStagger";
import { moneyBRLFromCents, isoToBR } from "@/lib/format";
import WaveMiniCard from "@/components/charts/WaveMiniCard";

import {
  getDashboardOverview,
  getDashboardPlus,
  getDre,
  getDfc,
  getProjections,
} from "@/services/dashboardPlus.service";

type Section = "overview" | "finance" | "sales" | "stock";
type FinanceTab =
  | "medias"
  | "breakeven"
  | "dfc"
  | "receber"
  | "pagar"
  | "dre"
  | "projetado"
  | "operacional"
  | "insights";

function currentMonthYYYYMM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function DashboardClient() {
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useGsapStagger(wrapRef, {
    selector: "[data-stagger]",
    y: 16,
    duration: 0.55,
    stagger: 0.06,
  });

  const sections = useMemo(
    () => [
      { key: "overview", label: "Visão Geral" },
      { key: "finance", label: "Financeiro" },
      { key: "sales", label: "Vendas" },
      { key: "stock", label: "Estoque" },
    ],
    []
  );

  const [section, setSection] = useState<Section>("overview");

  const financeTabs = useMemo(
    () => [
      { key: "medias", label: "Médias" },
      { key: "breakeven", label: "Break-even" },
      { key: "dfc", label: "DFC" },
      { key: "receber", label: "Receber" },
      { key: "pagar", label: "Pagar" },
      { key: "dre", label: "DRE" },
      { key: "projetado", label: "Fluxo projetado" },
      { key: "operacional", label: "Operacional" },
      { key: "insights", label: "Insights" },
    ],
    []
  );

  const [financeTab, setFinanceTab] = useState<FinanceTab>("medias");

  // ====== Dashboard Plus (dados reais) ======
  const endMonth = useMemo(() => currentMonthYYYYMM(), []);
  const basis = "due" as const;

  const [dashLoading, setDashLoading] = useState(false);
  const [dashErr, setDashErr] = useState<string | null>(null);

  const [overviewData, setOverviewData] = useState<any>(null);
  const [plusData, setPlusData] = useState<any>(null);
  const [dreData, setDreData] = useState<any>(null);
  const [dfcData, setDfcData] = useState<any>(null);
  const [projData, setProjData] = useState<any>(null);

  async function loadDashCore() {
    setDashLoading(true);
    setDashErr(null);
    try {
      const [plus, dfc, proj, overview] = await Promise.all([
        getDashboardPlus({ endMonth, basis, upcomingDays: 30 }),
        getDfc({ month: endMonth }),
        getProjections({ startMonth: endMonth }),
        getDashboardOverview(),
      ]);

      setPlusData(plus);
      setDfcData(dfc);
      setProjData(proj);
      setOverviewData(overview);
    } catch (e: any) {
      setDashErr(e?.message || "Erro ao carregar Dashboard Plus.");
    } finally {
      setDashLoading(false);
    }
  }

  async function loadDre() {
    try {
      const dre = await getDre({ month: endMonth, basis });
      setDreData(dre);
    } catch {}
  }

  useEffect(() => {
    loadDashCore();
    loadDre();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ====== KPIs (agora reais quando tiver dados) ======
  const bankCents = dfcData?.real?.finalBalanceCents ?? 0;
  const revenueCents = plusData?.cards?.revenueCents ?? 0;
  const profitCents = plusData?.cards?.profitCents ?? 0;
  const clientsCount = 0;

  const kpis = useMemo(
    () => [
      {
        label: "Saldo do mês",
        value: moneyBRLFromCents(bankCents),
        icon: Wallet,
        hint: `Saldo final (DFC real) • ${endMonth}`,
        tone: "brand" as const,
      },
      {
        label: "Vendas",
        value: moneyBRLFromCents(revenueCents),
        icon: TrendingUp,
        hint: "Faturamento (Dashboard Plus)",
        tone: "success" as const,
      },
      {
        label: "Produção",
        value: moneyBRLFromCents(profitCents),
        icon: Hammer,
        hint: "Lucro operacional (Dashboard Plus)",
        tone: "wood" as const,
      },
      {
        label: "Clientes",
        value: String(clientsCount),
        icon: Users,
        hint: "Base total (placeholder)",
        tone: "neutral" as const,
      },
    ],
    [bankCents, revenueCents, profitCents, clientsCount, endMonth]
  );

  // ====== Receber / Pagar (vem do plus.upcoming.items) ======
  const recvRows = useMemo(() => {
    const items = plusData?.upcoming?.items || [];
    const recv = items.filter((x: any) => x.kind === "RECEIVABLE");
    return recv.map((it: any, i: number) => ({
      id: it.id || `r_${i}`,
      dueDate: it.dueDate,
      client: it.title || "-",
      desc: it.subtitle || "-",
      amountCents: it.amountCents || 0,
      status: it.status || "ABERTO",
    }));
  }, [plusData]);

  const payRows = useMemo(() => {
    const items = plusData?.upcoming?.items || [];
    const pay = items.filter((x: any) => x.kind === "PAYABLE" || x.kind === "COST");
    return pay.map((it: any, i: number) => ({
      id: it.id || `p_${i}`,
      dueDate: it.dueDate,
      supplier: it.title || "-",
      desc: it.subtitle || (it.kind === "COST" ? "Custo" : "Conta"),
      amountCents: it.amountCents || 0,
      status: it.status || "ABERTO",
      kind: it.kind,
    }));
  }, [plusData]);

  // ✅ NOVO: Semana (Pagamentos/Recebimentos) + Preview entregas
  const weekWindow = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }, []);

  const weekReceivables = useMemo(() => {
    const { start, end } = weekWindow;
    return (recvRows || [])
      .filter((r: any) => {
        if (!r?.dueDate) return false;
        const d = new Date(r.dueDate);
        return !Number.isNaN(d.getTime()) && d >= start && d <= end;
      })
      .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [recvRows, weekWindow]);

  const weekPayables = useMemo(() => {
    const { start, end } = weekWindow;
    return (payRows || [])
      .filter((r: any) => {
        if (!r?.dueDate) return false;
        const d = new Date(r.dueDate);
        return !Number.isNaN(d.getTime()) && d >= start && d <= end;
      })
      .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [payRows, weekWindow]);

  const weekReceivablesTotalCents = useMemo(
    () => weekReceivables.reduce((acc: number, r: any) => acc + (Number(r.amountCents) || 0), 0),
    [weekReceivables]
  );

  const weekPayablesTotalCents = useMemo(
    () => weekPayables.reduce((acc: number, r: any) => acc + (Number(r.amountCents) || 0), 0),
    [weekPayables]
  );

  const deliveriesPreview = useMemo(() => {
    const list = overviewData?.upcomingDeliveries || [];
    return (Array.isArray(list) ? list : []).slice(0, 3);
  }, [overviewData]);

  // ====== gráfico (usa série do PLUS quando existir; senão placeholder) ======
  const chartPoints = useMemo(() => {
    const labels: string[] = (plusData?.series?.labels || []).map((x: any) => String(x).slice(5)); // MM
    const revenue: number[] = plusData?.series?.revenueCents || [];
    if (labels.length && revenue.length) {
      return labels.map((lab, i) => ({ label: lab, valueCents: revenue[i] || 0 }));
    }

    return [
      { label: "Jan", valueCents: 2100000 },
      { label: "Fev", valueCents: 2400000 },
      { label: "Mar", valueCents: 1800000 },
      { label: "Abr", valueCents: 2600000 },
      { label: "Mai", valueCents: 3200000 },
      { label: "Jun", valueCents: 2900000 },
      { label: "Jul", valueCents: 3600000 },
      { label: "Ago", valueCents: 4100000 },
    ];
  }, [plusData]);

  // ====== tabelas de DRE / DFC / Projeção ======
  const dreRows = useMemo(() => {
    const d = dreData?.dre || {};
    return [
      { k: "Receita do período", v: moneyBRLFromCents(d.revenueCents || 0) },
      { k: "Materiais (CMV)", v: moneyBRLFromCents(d.materialsCents || 0) },
      { k: "Custos variáveis", v: moneyBRLFromCents(d.variableCostsCents || 0) },
      { k: "CMV total", v: moneyBRLFromCents(d.cmvCents || 0) },
      { k: "Lucro bruto", v: moneyBRLFromCents(d.grossProfitCents || 0) },
      { k: "Custos fixos", v: moneyBRLFromCents(d.fixedCostsCents || 0) },
      { k: "Lucro operacional", v: moneyBRLFromCents(d.operatingProfitCents || 0) },
      { k: "Margem bruta (%)", v: `${Number(d.grossMarginPct || 0).toFixed(2)}%` },
      { k: "Margem operacional (%)", v: `${Number(d.operatingMarginPct || 0).toFixed(2)}%` },
    ];
  }, [dreData]);

  const dfcSeries = useMemo(
    () => (Array.isArray(dfcData?.real?.series) ? dfcData.real.series : []),
    [dfcData]
  );

  const dfcProjectedSeries = useMemo(
    () => (Array.isArray(dfcData?.projected?.series) ? dfcData.projected.series : []),
    [dfcData]
  );

  // ✅ NOVO: Resumo para os 4 cards do Financeiro
  const dfcTotals = useMemo(() => {
    const s = Array.isArray(dfcSeries) ? dfcSeries : [];
    const inCents = s.reduce((acc: number, r: any) => acc + (Number(r.inCents) || 0), 0);
    const outCents = s.reduce((acc: number, r: any) => acc + (Number(r.outCents) || 0), 0);
    return { inCents, outCents, netCents: inCents - outCents };
  }, [dfcSeries]);

  const dreOperatingCents = useMemo(
    () => Number(dreData?.dre?.operatingProfitCents || 0) || 0,
    [dreData]
  );

  const projectedFinalCents = useMemo(() => {
    const v = dfcData?.projected?.finalBalanceCents ?? dfcData?.projected?.finalCents;
    return Number(v || 0) || 0;
  }, [dfcData]);

  const projItems = useMemo(() => {
    const items = projData?.items || [];
    return Array.isArray(items) ? items : [];
  }, [projData]);

  // ===== RENDER =====
  return (
    <div ref={wrapRef} className="space-y-5">
      <div data-stagger>
        <PageHeader
          title="Dashboard"
          subtitle="Base premium alinhada com a referência. Dashboard Plus já conectado."
          badge={{ label: "Premium", tone: "brand" }}
          right={
            <Tabs
              items={sections}
              value={section}
              onChange={(k) => setSection(k as Section)}
              className="max-w-full"
            />
          }
        />
      </div>

      {dashErr ? (
        <div data-stagger>
          <GlassCard className="border border-[rgba(220,38,38,0.18)] bg-[rgba(220,38,38,0.06)] p-4">
            <div className="text-sm font-extrabold text-[rgba(220,38,38,0.95)]">Erro</div>
            <div className="mt-1 text-sm font-semibold text-[color:var(--muted)]">{dashErr}</div>
          </GlassCard>
        </div>
      ) : null}

      {section === "overview" ? (
        <section data-stagger>
          <div className="relative overflow-hidden rounded-[34px] border border-black/10 bg-[color:var(--brand)] shadow-[var(--shadow-card-2)]">
            <div className="absolute inset-0 opacity-35">
              <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-white/55 blur-3xl" />
              <div className="absolute -right-24 -bottom-24 h-80 w-80 rounded-full bg-black/10 blur-3xl" />
            </div>

            <div className="relative grid gap-6 p-5 sm:p-7 lg:grid-cols-[1.12fr_0.88fr] lg:items-center">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="ink">Hero</Badge>
                  <Badge tone="wood">Glass + Pills</Badge>
                  <Badge tone="ink">Lux</Badge>
                </div>

                <h2 className="font-display text-2xl font-black tracking-tight text-[color:var(--ink)] sm:text-3xl">
                  Projetos em destaque
                </h2>

                <p className="max-w-xl text-sm font-semibold text-black/65">
                  No M6 este hero vira carrossel real com imagens dos seus projetos/produtos e animação GSAP.
                </p>

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button variant="dark" onClick={() => setSection("overview")}>
                    Abrir visão geral <ArrowUpRight className="h-4 w-4" />
                  </Button>
                  <Button variant="soft" onClick={() => setSection("finance")}>
                    Ver financeiro
                  </Button>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <span className="h-2 w-7 rounded-full bg-black/70" />
                  <span className="h-2 w-2 rounded-full bg-black/25" />
                  <span className="h-2 w-2 rounded-full bg-black/25" />
                  <span className="h-2 w-2 rounded-full bg-black/25" />
                </div>
              </div>

              <div className="relative">
                <GlassCard className="p-3">
                  <div className="rounded-[24px] bg-white/70 p-4">
                    <div className="flex items-center justify-between">
                      <div className="font-display text-sm font-black text-[color:var(--ink)]">
                        Status rápido
                      </div>
                      <div className="text-[11px] font-bold text-[color:var(--muted)]">Preview</div>
                    </div>

                    <div className="mt-3 grid gap-2">
                      <div className="rounded-2xl bg-black/5 p-3">
                        <Skeleton className="h-4 w-[70%]" />
                        <Skeleton className="mt-2 h-4 w-[48%]" />
                      </div>
                      <div className="rounded-2xl bg-black/5 p-3">
                        <Skeleton className="h-4 w-[62%]" />
                        <Skeleton className="mt-2 h-4 w-[40%]" />
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <div className="h-16 rounded-2xl bg-[rgba(194,65,12,0.12)]" />
                      <div className="h-16 rounded-2xl bg-black/5" />
                      <div className="h-16 rounded-2xl bg-black/5" />
                    </div>
                  </div>
                </GlassCard>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-stagger>
        {kpis.map((k) => (
          <KpiCard
            key={k.label}
            label={k.label}
            value={dashLoading ? "…" : k.value}
            icon={k.icon}
            hint={k.hint}
            tone={k.tone}
          />
        ))}
      </section>

      {section === "overview" ? (
        <section className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]" data-stagger>
          <div className="grid gap-3">
            {/* ✅ AJUSTADO: Próximas entregas (agora renderiza dados reais) */}
            <GlassCard className="p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-display text-sm font-black text-[color:var(--ink)]">
                    Próximas entregas
                  </div>
                  <div className="text-xs font-semibold text-[color:var(--muted)]">
                    Puxando pedidos em andamento (Operacional)
                  </div>
                </div>

                {dashLoading ? (
                  <Badge tone="brand">Carregando</Badge>
                ) : deliveriesPreview.length ? (
                  <Badge tone="wood">{deliveriesPreview.length} itens</Badge>
                ) : (
                  <Badge tone="ink">Sem itens</Badge>
                )}
              </div>

              <div className="mt-4 space-y-2">
                {dashLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-[1fr_auto] gap-3 rounded-2xl bg-black/5 p-3"
                    >
                      <Skeleton className="h-4 w-[68%]" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  ))
                ) : deliveriesPreview.length ? (
                  deliveriesPreview.map((r: any, i: number) => (
                    <div
                      key={r.id || `d_${i}`}
                      className="grid grid-cols-[1fr_auto] gap-3 rounded-2xl bg-black/5 p-3"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-extrabold text-[color:var(--ink)]">
                          {String(r.id || "").slice(-6).toUpperCase()} • {r.client?.name || "-"}
                        </div>
                        <div className="mt-0.5 text-xs font-semibold text-[color:var(--muted)]">
                          Entrega {isoToBR(r.expectedDeliveryAt)}
                        </div>
                      </div>
                      <div className="flex items-center">
                        <StatusPill tone="neutral" label={String(r.status || "-")} />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl bg-black/5 p-3 text-xs font-semibold text-[color:var(--muted)]">
                    Sem entregas previstas para os próximos dias.
                  </div>
                )}
              </div>
            </GlassCard>

            <WaveMiniCard
              title="Evolução"
              subtitle="Receita mensal (Dashboard Plus)"
              points={chartPoints}
              accent="brand"
            />
          </div>

          {/* ✅ AJUSTADO: Semana (pagamentos/recebimentos) */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <GlassCard className="p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="font-display text-sm font-black text-[color:var(--ink)]">
                  Pagamentos da semana
                </div>
                <div className="text-sm font-black text-[color:var(--ink)]">
                  {dashLoading ? "—" : moneyBRLFromCents(weekPayablesTotalCents)}
                </div>
              </div>

              <div className="mt-3 rounded-2xl bg-black/5 p-3">
                {dashLoading ? (
                  <Skeleton className="h-24 w-full" />
                ) : weekPayables.length ? (
                  <div className="space-y-2">
                    {weekPayables.slice(0, 4).map((r: any) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between gap-3 rounded-2xl bg-black/5 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-xs font-extrabold text-[color:var(--ink)]">
                            {r.supplier || r.desc || "Pagamento"}
                          </div>
                          <div className="text-[11px] font-semibold text-[color:var(--muted)]">
                            {isoToBR(r.dueDate)}
                          </div>
                        </div>
                        <div className="text-xs font-extrabold text-[color:var(--ink)]">
                          {moneyBRLFromCents(r.amountCents || 0)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs font-semibold text-[color:var(--muted)]">
                    Nenhum pagamento previsto para os próximos 7 dias.
                  </div>
                )}
              </div>
            </GlassCard>

            <GlassCard className="p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="font-display text-sm font-black text-[color:var(--ink)]">
                  Recebimentos da semana
                </div>
                <div className="text-sm font-black text-[color:var(--ink)]">
                  {dashLoading ? "—" : moneyBRLFromCents(weekReceivablesTotalCents)}
                </div>
              </div>

              <div className="mt-3 rounded-2xl bg-black/5 p-3">
                {dashLoading ? (
                  <Skeleton className="h-24 w-full" />
                ) : weekReceivables.length ? (
                  <div className="space-y-2">
                    {weekReceivables.slice(0, 4).map((r: any) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between gap-3 rounded-2xl bg-black/5 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-xs font-extrabold text-[color:var(--ink)]">
                            {r.client || r.desc || "Recebimento"}
                          </div>
                          <div className="text-[11px] font-semibold text-[color:var(--muted)]">
                            {isoToBR(r.dueDate)}
                          </div>
                        </div>
                        <div className="text-xs font-extrabold text-[color:var(--ink)]">
                          {moneyBRLFromCents(r.amountCents || 0)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs font-semibold text-[color:var(--muted)]">
                    Nenhum recebimento previsto para os próximos 7 dias.
                  </div>
                )}
              </div>
            </GlassCard>
          </div>
        </section>
      ) : null}

      {section === "finance" ? (
        <section className="space-y-3" data-stagger>
          <Tabs
            items={financeTabs}
            value={financeTab}
            onChange={(k) => setFinanceTab(k as FinanceTab)}
          />

          {financeTab === "receber" ? (
            <DataTable
              title="Recebíveis"
              subtitle="..."
              rows={recvRows}
              rowKey={(r: any) => r.id}
              columns={[
                { header: "Vencimento", cell: (r: any) => isoToBR(r.dueDate) },
                { header: "Cliente", cell: (r: any) => r.client },
                { header: "Descrição", cell: (r: any) => r.desc },
                {
                  header: "Valor",
                  className: "text-right font-extrabold",
                  cell: (r: any) => moneyBRLFromCents(r.amountCents),
                },
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
          ) : financeTab === "pagar" ? (
            // ✅ AJUSTADO: aba pagar usa payRows e texto correto
            <DataTable
              title="Pagáveis"
              subtitle="..."
              rows={payRows}
              rowKey={(r: any) => r.id}
              columns={[
                { header: "Vencimento", cell: (r: any) => isoToBR(r.dueDate) },
                { header: "Fornecedor", cell: (r: any) => r.supplier },
                { header: "Descrição", cell: (r: any) => r.desc },
                {
                  header: "Valor",
                  className: "text-right font-extrabold",
                  cell: (r: any) => moneyBRLFromCents(r.amountCents),
                },
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
          ) : (
            <GlassCard className="p-5">
              <div className="font-display text-sm font-black text-[color:var(--ink)]">
                {financeTabs.find((t) => t.key === financeTab)?.label}
              </div>
              <div className="mt-2 text-sm font-semibold text-[color:var(--muted)]">
                Agora já está ligado no backend. Se algum bloco vier vazio, é porque não há dados no
                período.
              </div>

              {/* ✅ AJUSTADO: cards agora puxam números reais */}
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <KpiCard
                  label="Entradas"
                  value={moneyBRLFromCents(dfcTotals.inCents)}
                  icon={ArrowUpCircle}
                  hint={`Total do mês (DFC real) • ${endMonth}`}
                  tone="success"
                />
                <KpiCard
                  label="Saídas"
                  value={moneyBRLFromCents(dfcTotals.outCents)}
                  icon={ArrowDownCircle}
                  hint={`Total do mês (DFC real) • ${endMonth}`}
                  tone="danger"
                />
                <KpiCard
                  label="Relatório DRE"
                  value={moneyBRLFromCents(dreOperatingCents)}
                  icon={FileText}
                  hint={`Lucro operacional (DRE) • ${endMonth}`}
                  tone="brand"
                />
                <KpiCard
                  label="Fluxo projetado"
                  value={moneyBRLFromCents(projectedFinalCents)}
                  icon={TrendingUp}
                  hint={`Saldo final projetado (DFC) • ${endMonth}`}
                  tone="neutral"
                />
              </div>

              {/* ✅ conteúdo real por aba (add-on) */}
              {financeTab === "breakeven" ? (
                <div className="mt-4">
                  <DataTable
                    title="Projeções (3 meses)"
                    subtitle="GET /api/reports/projections"
                    rows={projItems}
                    rowKey={(r: any, i: number) => r.month || `m_${i}`}
                    columns={[
                      { header: "Mês", cell: (r: any) => r.month },
                      {
                        header: "Entradas",
                        className: "text-right font-extrabold",
                        cell: (r: any) => moneyBRLFromCents(r.expectedInCents || 0),
                      },
                      {
                        header: "Saídas",
                        className: "text-right font-extrabold",
                        cell: (r: any) => moneyBRLFromCents(r.expectedOutCents || 0),
                      },
                      {
                        header: "Saldo",
                        className: "text-right font-extrabold",
                        cell: (r: any) => moneyBRLFromCents(r.netCents || 0),
                      },
                    ]}
                  />
                </div>
              ) : null}

              {financeTab === "dfc" ? (
                <div className="mt-4">
                  <DataTable
                    title="DFC (Real)"
                    subtitle="GET /api/reports/dfc"
                    rows={dfcSeries}
                    rowKey={(r: any, i: number) => r.day || `d_${i}`}
                    columns={[
                      { header: "Dia", cell: (r: any) => String(r.day).slice(8) },
                      {
                        header: "Entradas",
                        className: "text-right font-extrabold",
                        cell: (r: any) => moneyBRLFromCents(r.inCents || 0),
                      },
                      {
                        header: "Saídas",
                        className: "text-right font-extrabold",
                        cell: (r: any) => moneyBRLFromCents(r.outCents || 0),
                      },
                      {
                        header: "Saldo",
                        className: "text-right font-extrabold",
                        cell: (r: any) => moneyBRLFromCents(r.netCents || 0),
                      },
                    ]}
                  />
                </div>
              ) : null}

              {financeTab === "dre" ? (
                <div className="mt-4">
                  <DataTable
                    title="DRE"
                    subtitle="GET /api/reports/dre"
                    rows={dreRows}
                    rowKey={(r: any, i: number) => `${r.k}_${i}`}
                    columns={[
                      { header: "Linha", cell: (r: any) => r.k },
                      {
                        header: "Valor",
                        className: "text-right font-extrabold",
                        cell: (r: any) => r.v,
                      },
                    ]}
                  />
                </div>
              ) : null}

              {financeTab === "projetado" ? (
                <div className="mt-4">
                  <DataTable
                    title="Fluxo projetado"
                    subtitle="DFC projected.series"
                    rows={dfcProjectedSeries}
                    rowKey={(r: any, i: number) => r.day || `p_${i}`}
                    columns={[
                      { header: "Dia", cell: (r: any) => String(r.day).slice(8) },
                      {
                        header: "Entradas",
                        className: "text-right font-extrabold",
                        cell: (r: any) => moneyBRLFromCents(r.inCents || 0),
                      },
                      {
                        header: "Saídas",
                        className: "text-right font-extrabold",
                        cell: (r: any) => moneyBRLFromCents(r.outCents || 0),
                      },
                      {
                        header: "Saldo",
                        className: "text-right font-extrabold",
                        cell: (r: any) => moneyBRLFromCents(r.netCents || 0),
                      },
                    ]}
                  />
                </div>
              ) : null}

              {financeTab === "operacional" ? (
                <div className="mt-4">
                  <DataTable
                    title="Próximas entregas"
                    subtitle="GET /api/dashboard/overview (upcomingDeliveries)"
                    rows={overviewData?.upcomingDeliveries || []}
                    rowKey={(r: any, i: number) => r.id || `o_${i}`}
                    columns={[
                      {
                        header: "Código",
                        cell: (r: any) => String(r.id || "").slice(-6).toUpperCase(),
                      },
                      { header: "Cliente", cell: (r: any) => r.client?.name || "-" },
                      { header: "Criado", cell: (r: any) => isoToBR(r.createdAt) },
                      { header: "Entrega", cell: (r: any) => isoToBR(r.expectedDeliveryAt) },
                      {
                        header: "Status",
                        cell: (r: any) => (
                          <StatusPill tone="neutral" label={String(r.status || "-")} />
                        ),
                      },
                    ]}
                  />
                </div>
              ) : null}
            </GlassCard>
          )}
        </section>
      ) : null}

      {section === "sales" ? (
        <GlassCard className="p-5" data-stagger>
          <div className="font-display text-sm font-black text-[color:var(--ink)]">Vendas</div>
          <div className="mt-2 text-sm font-semibold text-[color:var(--muted)]">
            Aqui entra o painel de pedidos + modal completo (já feito em /vendas).
          </div>
        </GlassCard>
      ) : null}

      {section === "stock" ? (
        <GlassCard className="p-5" data-stagger>
          <div className="font-display text-sm font-black text-[color:var(--ink)]">Estoque</div>
          <div className="mt-2 text-sm font-semibold text-[color:var(--muted)]">
            Aqui entra Catálogo/Movimentações/Quantidade/Histórico (já feito em /estoque).
          </div>
          <div className="mt-4">
            <Badge tone="wood">
              <Boxes className="h-3.5 w-3.5" /> Estoque premium
            </Badge>
          </div>
        </GlassCard>
      ) : null}
    </div>
  );
}