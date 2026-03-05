"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  HardHat,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserRound,
  Wallet,
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
import KpiCard from "@/components/ui/KpiCard";
import EmptyState from "@/components/ui/EmptyState";

import { useGsapStagger } from "@/motion/useGsapStagger";
import { apiFetch } from "@/lib/api";
import { moneyBRLFromCents, parseBRLToCents } from "@/lib/format";

type Employee = {
  id: string;
  name: string;
  role?: string | null;
  sector?: string | null;
  salaryCents?: number | null;
  benefitsCents?: number | null;
  payDay?: number | null;
  isActive?: boolean | null;
  notes?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

function toInt(v: any, fallback = 0) {
  const n = Number.parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : fallback;
}

function toBool(v: any, fallback = false) {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  const s = String(v ?? "").toLowerCase();
  if (["true", "1", "yes", "y", "sim"].includes(s)) return true;
  if (["false", "0", "no", "n", "nao", "não"].includes(s)) return false;
  return fallback;
}

function normalizeEmployee(raw: any): Employee {
  return {
    id: String(raw?.id ?? raw?._id ?? ""),
    name: String(raw?.name ?? ""),
    role: raw?.role ?? raw?.jobTitle ?? raw?.function ?? null,
    sector: raw?.sector ?? raw?.department ?? null,
    salaryCents: Number(raw?.salaryCents ?? raw?.salary_cents ?? raw?.salary ?? 0) || 0,
    benefitsCents: Number(raw?.benefitsCents ?? raw?.benefits_cents ?? raw?.benefits ?? 0) || 0,
    payDay: toInt(raw?.payDay ?? raw?.pay_day ?? raw?.payday, 1),
    isActive: toBool(raw?.isActive ?? raw?.active, true),
    notes: raw?.notes ?? raw?.obs ?? null,
    createdAt: raw?.createdAt ?? null,
    updatedAt: raw?.updatedAt ?? null,
  };
}

async function listEmployees(): Promise<Employee[]> {
  const data = await apiFetch<any>("/api/employees", { auth: true });
  const arr = Array.isArray(data) ? data : data?.employees ?? data?.items ?? [];
  return (Array.isArray(arr) ? arr : []).map(normalizeEmployee).filter((x) => x.id);
}

async function createEmployee(payload: any) {
  return apiFetch("/api/employees", { method: "POST", auth: true, json: payload });
}

async function updateEmployee(id: string, payload: any) {
  return apiFetch(`/api/employees/${id}`, { method: "PATCH", auth: true, json: payload });
}

async function activateEmployee(id: string) {
  return apiFetch(`/api/employees/${id}`, { method: "PATCH", auth: true, json: { isActive: true } });
}

async function deactivateEmployee(id: string) {
  try {
    return await apiFetch(`/api/employees/${id}`, { method: "DELETE", auth: true });
  } catch (_) {
    // fallback caso o backend use inativação via PATCH
    return apiFetch(`/api/employees/${id}`, { method: "PATCH", auth: true, json: { isActive: false } });
  }
}

export default function FuncionariosPage() {
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useGsapStagger(wrapRef, {
    selector: "[data-stagger]",
    y: 14,
    duration: 0.5,
    stagger: 0.05,
  });

  const [q, setQ] = useState("");
  const [onlyActive, setOnlyActive] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [employees, setEmployees] = useState<Employee[]>([]);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const items = await listEmployees();
      setEmployees(items);
    } catch (e: any) {
      setError(e?.message || "Erro ao carregar funcionários.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    let base = employees.slice();

    if (onlyActive) base = base.filter((e) => !!e.isActive);

    if (!qq) return base;

    return base.filter((e) => {
      const name = String(e.name || "").toLowerCase();
      const role = String(e.role || "").toLowerCase();
      const sector = String(e.sector || "").toLowerCase();
      return name.includes(qq) || role.includes(qq) || sector.includes(qq);
    });
  }, [employees, q, onlyActive]);

  const kpis = useMemo(() => {
    const total = employees.length;
    const active = employees.filter((e) => !!e.isActive).length;

    const activeItems = employees.filter((e) => !!e.isActive);
    const salary = activeItems.reduce((a, b) => a + (Number(b.salaryCents || 0) || 0), 0);
    const benefits = activeItems.reduce((a, b) => a + (Number(b.benefitsCents || 0) || 0), 0);

    return {
      total,
      active,
      salary,
      benefits,
      totalCost: salary + benefits,
    };
  }, [employees]);

  // ===== modal create/edit
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);

  const [form, setForm] = useState({
    name: "",
    role: "",
    sector: "",
    salary: "",
    benefits: "",
    payDay: "5",
    isActive: true,
    notes: "",
  });

  function openNew() {
    setEditing(null);
    setForm({
      name: "",
      role: "",
      sector: "",
      salary: "",
      benefits: "",
      payDay: "5",
      isActive: true,
      notes: "",
    });
    setOpen(true);
  }

  function openEdit(emp: Employee) {
    setEditing(emp);
    setForm({
      name: emp.name || "",
      role: emp.role || "",
      sector: emp.sector || "",
      salary: String((Number(emp.salaryCents || 0) / 100).toFixed(2)).replace(".", ","),
      benefits: String((Number(emp.benefitsCents || 0) / 100).toFixed(2)).replace(".", ","),
      payDay: String(emp.payDay || 5),
      isActive: !!emp.isActive,
      notes: emp.notes || "",
    });
    setOpen(true);
  }

  async function save() {
    const name = form.name.trim();
    if (!name) return alert("Informe o nome.");

    const payDay = toInt(form.payDay, 0);
    if (!(payDay >= 1 && payDay <= 31)) return alert("Informe o dia de pagamento (1 a 31).");

    const salaryCents = parseBRLToCents(form.salary);
    const benefitsCents = parseBRLToCents(form.benefits);

    const payload = {
      name,
      role: form.role.trim() ? form.role.trim() : null,
      sector: form.sector.trim() ? form.sector.trim() : null,
      salaryCents,
      benefitsCents,
      payDay,
      isActive: !!form.isActive,
      notes: form.notes.trim() ? form.notes.trim() : null,
    };

    setLoading(true);
    try {
      if (editing) await updateEmployee(editing.id, payload);
      else await createEmployee(payload);

      setOpen(false);
      setEditing(null);
      await reload();
    } catch (e: any) {
      alert(e?.message || "Erro ao salvar funcionário.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(emp: Employee) {
    if (!emp.isActive) {
      setLoading(true);
      try {
        await activateEmployee(emp.id);
        await reload();
      } catch (e: any) {
        alert(e?.message || "Erro ao ativar.");
      } finally {
        setLoading(false);
      }
      return;
    }

    const ok = confirm("Desativar este funcionário? (não será excluído, apenas inativado)");
    if (!ok) return;

    setLoading(true);
    try {
      await deactivateEmployee(emp.id);
      await reload();
    } catch (e: any) {
      alert(e?.message || "Erro ao desativar.");
    } finally {
      setLoading(false);
    }
  }

  const totalPreviewCents = useMemo(() => {
    return parseBRLToCents(form.salary) + parseBRLToCents(form.benefits);
  }, [form.salary, form.benefits]);

  return (
    <div ref={wrapRef} className="space-y-4">
      <div data-stagger>
        <PageHeader
          title="Funcionários"
          subtitle="Salário + benefícios entram como custo FIXO recorrente no mês (dia de pagamento)."
          badge={{ label: "M5", tone: "brand" }}
          right={
            <Button variant="dark" onClick={openNew}>
              <Plus className="h-4 w-4" /> Novo funcionário
            </Button>
          }
        />
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
          label="Funcionários"
          value={String(kpis.total)}
          icon={UserRound}
          hint="Total cadastrados"
          tone="neutral"
        />
        <KpiCard label="Ativos" value={String(kpis.active)} icon={CheckCircle2} hint="Somente ativos" tone="success" />
        <KpiCard
          label="Salários (ativos)"
          value={moneyBRLFromCents(kpis.salary)}
          icon={HardHat}
          hint="Total mensal"
          tone="wood"
        />
        <KpiCard
          label="Custo fixo (ativos)"
          value={moneyBRLFromCents(kpis.totalCost)}
          icon={Wallet}
          hint="Salário + benefícios"
          tone="brand"
        />
      </section>

      {/* Toolbar */}
      <div data-stagger>
        <GlassCard className="relative overflow-hidden p-4 sm:p-5">
          <div className="pointer-events-none absolute -top-12 -right-12 h-56 w-56 rounded-full blur-3xl bg-[rgba(247,211,32,0.18)]" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full blur-3xl bg-[rgba(149,173,193,0.22)]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[44%] bg-white/30" />

          <div className="relative flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Badge tone="ink">Folha</Badge>
                {loading ? <Badge tone="ink">Carregando…</Badge> : <Badge tone="success">Online</Badge>}
              </div>
              <div className="mt-2 font-display text-lg font-black text-[color:var(--ink)]">Cadastro e controle</div>
              <div className="mt-1 text-sm font-semibold text-[color:var(--muted)]">
                Buscar por nome/função/setor + filtrar ativos. Editar atualiza o custo recorrente no dia de pagamento.
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="soft" onClick={reload}>
                <RefreshCw className="h-4 w-4" /> Atualizar
              </Button>
              <Button variant="dark" onClick={openNew}>
                <Plus className="h-4 w-4" /> Novo
              </Button>
            </div>
          </div>

          <div className="relative mt-4">
            <Toolbar
              left={
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  <div className="relative flex-1 min-w-[220px]">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--muted)]" />
                    <Input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Buscar por nome, função ou setor…"
                      className="pl-9"
                    />
                  </div>

                  <label className="pill h-10 px-3 inline-flex items-center gap-2 border border-[color:var(--line)] bg-white/55">
                    <input
                      type="checkbox"
                      checked={onlyActive}
                      onChange={(e) => setOnlyActive(e.target.checked)}
                      className="h-4 w-4"
                    />
                    <span className="text-sm font-semibold text-[color:var(--muted)]">Somente ativos</span>
                  </label>
                </div>
              }
              right={
                <div className="flex items-center gap-2">
                  <Badge tone="neutral">{filtered.length} itens</Badge>
                </div>
              }
            />
          </div>
        </GlassCard>
      </div>

      {/* Lista */}
      <div data-stagger>
        <DataTable
          title="Lista"
          subtitle="GET /api/employees"
          rows={filtered}
          rowKey={(r) => r.id}
          empty={
            <EmptyState
              icon={HardHat}
              title="Nenhum funcionário por aqui"
              description="Cadastre o primeiro funcionário para controlar a folha e custos recorrentes."
              actionLabel="Cadastrar"
              onAction={openNew}
            />
          }
          columns={[
            {
              header: "Nome",
              cell: (r) => (
                <div className="min-w-[220px]">
                  <div className="font-extrabold text-[color:var(--ink)]">{r.name || "—"}</div>
                  <div className="mt-0.5 text-xs font-semibold text-[color:var(--muted)]">
                    {r.role ? r.role : "—"}
                    {r.sector ? <span className="opacity-70"> • {r.sector}</span> : null}
                  </div>
                </div>
              ),
            },
            {
              header: "Dia pag.",
              className: "whitespace-nowrap",
              cell: (r) => (r.payDay ? `Dia ${r.payDay}` : "—"),
            },
            {
              header: "Salário",
              className: "text-right whitespace-nowrap font-extrabold",
              cell: (r) => moneyBRLFromCents(Number(r.salaryCents || 0) || 0),
            },
            {
              header: "Benefícios",
              className: "text-right whitespace-nowrap font-extrabold",
              cell: (r) => moneyBRLFromCents(Number(r.benefitsCents || 0) || 0),
            },
            {
              header: "Total",
              className: "text-right whitespace-nowrap font-black",
              cell: (r) =>
                moneyBRLFromCents((Number(r.salaryCents || 0) || 0) + (Number(r.benefitsCents || 0) || 0)),
            },
            {
              header: "Status",
              className: "whitespace-nowrap",
              cell: (r) => (
                <StatusPill label={r.isActive ? "ATIVO" : "INATIVO"} tone={r.isActive ? "success" : "danger"} />
              ),
            },
            {
              header: "Ações",
              className: "text-right whitespace-nowrap",
              cell: (r) => (
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => openEdit(r)}>
                    <Pencil className="h-4 w-4" /> Editar
                  </Button>

                  <Button
                    variant="ghost"
                    onClick={() => toggleActive(r)}
                    className={r.isActive ? "text-[rgba(220,38,38,0.95)]" : "text-[rgba(22,163,74,0.95)]"}
                    title={r.isActive ? "Desativar" : "Ativar"}
                  >
                    {r.isActive ? <Trash2 className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                    {r.isActive ? "Desativar" : "Ativar"}
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
        title={editing ? "Editar funcionário" : "Novo funcionário"}
        subtitle={editing ? "PATCH /api/employees/:id" : "POST /api/employees"}
        onClose={() => setOpen(false)}
        maxWidth="max-w-[980px]"
        footer={
          <div className="flex flex-wrap justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge tone="neutral">Prévia do total</Badge>
              <Badge tone="brand">{moneyBRLFromCents(totalPreviewCents)}</Badge>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="soft" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button variant="dark" onClick={save} disabled={loading}>
                Salvar
              </Button>
            </div>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Nome</div>
            <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          </div>

          <div>
            <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Função</div>
            <Input
              value={form.role}
              onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
              placeholder="Ex: Marceneiro, Montador…"
            />
          </div>

          <div>
            <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Setor</div>
            <Input
              value={form.sector}
              onChange={(e) => setForm((p) => ({ ...p, sector: e.target.value }))}
              placeholder="Ex: Produção, Acabamento…"
            />
          </div>

          <div>
            <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Salário (R$)</div>
            <Input
              value={form.salary}
              onChange={(e) => setForm((p) => ({ ...p, salary: e.target.value }))}
              placeholder="Ex: 2.500,00"
              inputMode="decimal"
            />
          </div>

          <div>
            <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Benefícios (R$)</div>
            <Input
              value={form.benefits}
              onChange={(e) => setForm((p) => ({ ...p, benefits: e.target.value }))}
              placeholder="Ex: 300,00"
              inputMode="decimal"
            />
          </div>

          <div>
            <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Dia de pagamento</div>
            <Select value={form.payDay} onChange={(e) => setForm((p) => ({ ...p, payDay: e.target.value }))}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={String(d)}>
                  {d}
                </option>
              ))}
            </Select>
            <div className="mt-1 text-xs font-semibold text-[color:var(--muted)]">
              Esse dia é usado para lançar o custo fixo recorrente no mês.
            </div>
          </div>

          <div className="flex items-center gap-2 sm:items-start sm:pt-6">
            <input
              id="empActive"
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
              className="h-4 w-4"
            />
            <label htmlFor="empActive" className="text-sm font-semibold text-[color:var(--muted)]">
              Ativo
            </label>
          </div>

          <div className="sm:col-span-2">
            <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Observações</div>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Ex: Horário, benefícios, combinado, etc."
              className={[
                "pill w-full px-3 py-2 text-sm font-semibold text-[color:var(--ink)] outline-none",
                "min-h-[96px] resize-none",
                "focus:border-black/15 focus:ring-4 focus:ring-[rgba(149,173,193,0.35)]",
              ].join(" ")}
            />
          </div>

          <div className="sm:col-span-2">
            <GlassCard className="p-4 bg-white/35">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-extrabold text-[color:var(--ink)]">Resumo</div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="neutral">Salário</Badge>
                  <Badge tone="neutral">{moneyBRLFromCents(parseBRLToCents(form.salary))}</Badge>
                  <Badge tone="neutral">Benefícios</Badge>
                  <Badge tone="neutral">{moneyBRLFromCents(parseBRLToCents(form.benefits))}</Badge>
                  <Badge tone="brand">Total</Badge>
                  <Badge tone="brand">{moneyBRLFromCents(totalPreviewCents)}</Badge>
                </div>
              </div>
              <div className="mt-2 text-xs font-semibold text-[color:var(--muted)]">
                O lançamento no Financeiro/Custos é gerado pelo backend com base no dia de pagamento.
              </div>
            </GlassCard>
          </div>
        </div>
      </Modal>
    </div>
  );
}