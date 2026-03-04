"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import GlassCard from "@/components/ui/GlassCard";
import Button from "@/components/ui/Button";
import StatusPill from "@/components/ui/StatusPill";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import KpiCard from "@/components/ui/KpiCard";
import Skeleton from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import { apiFetch } from "@/lib/api";
import { CreditCard, RefreshCcw, ShieldCheck, CalendarClock, Ban, Play, Crown } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";

type MeResponse = {
  user: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    salon?: { id: string; name: string; phone?: string | null; plan?: string | null } | null;
  };
  subscription: {
    plan: string;
    status: "ACTIVE" | "EXPIRING" | "CANCEL_SCHEDULED" | "EXPIRED";
    source: string;
    endsAt: string | null;
    daysLeft: number | null;
    cancelAtPeriodEnd: boolean;
  } | null;
};

function toneByStatus(status?: string) {
  const s = String(status || "").toUpperCase();
  if (s === "ACTIVE") return "success";
  if (s === "EXPIRING") return "warning";
  if (s === "CANCEL_SCHEDULED") return "wood";
  if (s === "EXPIRED") return "danger";
  return "neutral";
}

export default function AssinaturasClient() {
  const sp = useSearchParams();
  const paid = sp?.get("paid") === "1";

  const { refreshMe } = useAuth();

  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [plan, setPlan] = useState<"PRO" | "PREMIUM">("PRO");
  const [method, setMethod] = useState<"PIX" | "CARD" | "PIX,CARD">("PIX,CARD");
  const [taxId, setTaxId] = useState("");
  const [cellphone, setCellphone] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const data = await apiFetch<MeResponse>("/api/auth/me", { auth: true });
      setMe(data);
    } catch (e: any) {
      setErr(e?.message || "Falha ao carregar assinatura.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // se veio do checkout com paid=1, deixa um “modo conferência” (webhook pode demorar)
  useEffect(() => {
    if (!paid) return;
    const t = setTimeout(() => {
      load();
      refreshMe();
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paid]);

  const subscription = me?.subscription;
  const statusLabel = subscription?.status || "—";
  const endsAtLabel =
    subscription?.endsAt ? new Date(subscription.endsAt).toLocaleDateString("pt-BR") : "—";
  const daysLeftLabel =
    typeof subscription?.daysLeft === "number" ? `${subscription.daysLeft} dia(s)` : "—";

  const canCancel =
    subscription?.status === "ACTIVE" || subscription?.status === "EXPIRING" || subscription?.status === "CANCEL_SCHEDULED";

  const cancelScheduled = !!subscription?.cancelAtPeriodEnd;

  const methodsArr = useMemo(() => {
    if (method === "PIX") return ["PIX"];
    if (method === "CARD") return ["CARD"];
    return ["PIX", "CARD"];
  }, [method]);

  function openCheckout() {
    const userPhone = me?.user?.phone || me?.user?.salon?.phone || "";
    setCellphone(userPhone || "");
    setCheckoutOpen(true);
  }

  async function doCheckout() {
    const user = me?.user;
    if (!user) return;

    const cpf = taxId.trim();
    const phone = cellphone.trim();

    if (!cpf) return setErr("Digite seu CPF/CNPJ para gerar o checkout.");
    if (!phone) return setErr("Digite seu celular para o pagamento.");

    setBusy(true);
    setErr(null);

    try {
      const origin = window.location.origin;
      const returnUrl = `${origin}/assinaturas`;
      const completionUrl = `${origin}/assinaturas?paid=1`;

      const resp: any = await apiFetch("/api/billing/checkout", {
        method: "POST",
        auth: true,
        json: {
          plan,
          methods: methodsArr,
          returnUrl,
          completionUrl,
          customer: {
            name: user.name,
            email: user.email,
            cellphone: phone,
            taxId: cpf,
          },
        },
      });

      const url = resp?.checkoutUrl;
      if (!url) throw new Error("Checkout não retornou URL.");

      window.location.href = url;
    } catch (e: any) {
      setErr(e?.message || "Falha ao criar checkout.");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    setErr(null);
    try {
      await apiFetch("/api/billing/cancel", { method: "POST", auth: true, json: {} });
      await load();
      await refreshMe();
    } catch (e: any) {
      setErr(e?.message || "Falha ao cancelar.");
    } finally {
      setBusy(false);
    }
  }

  async function resume() {
    setBusy(true);
    setErr(null);
    try {
      await apiFetch("/api/billing/resume", { method: "POST", auth: true, json: {} });
      await load();
      await refreshMe();
    } catch (e: any) {
      setErr(e?.message || "Falha ao reativar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Assinatura"
        subtitle="Plano atual, status e ações (renovar, cancelar no fim do período e reativar)."
        badge={{ label: subscription?.plan || "FREE", tone: "brand" }}
        right={
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill label={statusLabel} tone={toneByStatus(subscription?.status) as any} />
            <Button variant="soft" onClick={() => { load(); refreshMe(); }} disabled={busy}>
              <RefreshCcw className="h-4 w-4" /> Atualizar
            </Button>
          </div>
        }
      />

      {paid ? (
        <GlassCard className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-display text-sm font-black text-[color:var(--ink)]">
                Pagamento finalizado ✅
              </div>
              <div className="text-sm font-semibold text-[color:var(--muted)]">
                Pode levar alguns segundos para confirmar (webhook). Clique em “Atualizar” se necessário.
              </div>
            </div>
            <StatusPill label="Aguardando confirmação" tone="warning" />
          </div>
        </GlassCard>
      ) : null}

      {err ? (
        <GlassCard className="p-4">
          <div className="text-sm font-semibold text-[color:var(--danger)]">{err}</div>
        </GlassCard>
      ) : null}

      {/* KPIs */}
      <div className="grid gap-3 md:grid-cols-3">
        {loading ? (
          <>
            <GlassCard className="p-4"><Skeleton className="h-6 w-40" /><Skeleton className="mt-3 h-10 w-28" /></GlassCard>
            <GlassCard className="p-4"><Skeleton className="h-6 w-40" /><Skeleton className="mt-3 h-10 w-28" /></GlassCard>
            <GlassCard className="p-4"><Skeleton className="h-6 w-40" /><Skeleton className="mt-3 h-10 w-28" /></GlassCard>
          </>
        ) : (
          <>
            <KpiCard
              label="Plano"
              value={subscription?.plan || "FREE"}
              icon={Crown}
              tone="brand"
              hint={subscription?.source ? `Fonte: ${subscription.source}` : undefined}
            />
            <KpiCard
              label="Vence em"
              value={daysLeftLabel}
              icon={CalendarClock}
              tone={subscription?.status === "EXPIRING" ? "danger" : "neutral"}
              hint={subscription?.endsAt ? `Data: ${endsAtLabel}` : "—"}
            />
            <KpiCard
              label="Cancelamento"
              value={cancelScheduled ? "Agendado" : "Não"}
              icon={Ban}
              tone={cancelScheduled ? "wood" : "neutral"}
              hint={cancelScheduled ? "Acesso liberado até expirar" : "—"}
            />
          </>
        )}
      </div>

      {/* CTA principal */}
      {!loading && !subscription ? (
        <EmptyState
          icon={CreditCard}
          title="Você está no FREE"
          description="Ative um plano para liberar acesso completo (renovação a cada 30 dias)."
          actionLabel="Assinar agora"
          onAction={openCheckout}
        />
      ) : (
        <GlassCard className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="font-display text-base font-black text-[color:var(--ink)]">
                Gerenciar assinatura
              </div>
              <div className="text-sm font-semibold text-[color:var(--muted)]">
                Renove quando quiser. Se cancelar, mantém acesso até o fim do período.
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="dark" onClick={openCheckout} disabled={busy}>
                <CreditCard className="h-4 w-4" />
                Assinar / Renovar
              </Button>

              {canCancel && !cancelScheduled ? (
                <Button variant="soft" onClick={cancel} disabled={busy}>
                  <Ban className="h-4 w-4" />
                  Cancelar no fim
                </Button>
              ) : null}

              {canCancel && cancelScheduled ? (
                <Button variant="primary" onClick={resume} disabled={busy}>
                  <Play className="h-4 w-4" />
                  Reativar
                </Button>
              ) : null}
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-[color:var(--line)] bg-white/45 p-3 text-xs font-semibold text-[color:var(--muted)]">
            <ShieldCheck className="inline h-4 w-4 -translate-y-[1px]" /> O pagamento abre o checkout e a confirmação vem via webhook.
          </div>
        </GlassCard>
      )}

      {/* Modal checkout */}
      <Modal
        open={checkoutOpen}
        title="Assinar / Renovar"
        subtitle="Escolha plano e método. CPF/CNPJ é obrigatório para gerar o checkout."
        onClose={() => setCheckoutOpen(false)}
        footer={
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setCheckoutOpen(false)} disabled={busy}>
              Fechar
            </Button>
            <Button variant="dark" onClick={doCheckout} disabled={busy}>
              {busy ? "Gerando..." : "Ir para pagamento"}
            </Button>
          </div>
        }
      >
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Plano</div>
            <Select value={plan} onChange={(e) => setPlan(e.target.value as any)}>
              <option value="PRO">PRO</option>
              <option value="PREMIUM">PREMIUM</option>
            </Select>
          </div>

          <div>
            <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Método</div>
            <Select value={method} onChange={(e) => setMethod(e.target.value as any)}>
              <option value="PIX,CARD">PIX + CARTÃO</option>
              <option value="PIX">PIX</option>
              <option value="CARD">CARTÃO</option>
            </Select>
          </div>

          <div>
            <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">CPF/CNPJ</div>
            <Input value={taxId} onChange={(e) => setTaxId(e.target.value)} placeholder="Somente números ou formatado" />
          </div>

          <div>
            <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Celular</div>
            <Input value={cellphone} onChange={(e) => setCellphone(e.target.value)} placeholder="(11) 99999-9999" />
          </div>
        </div>
      </Modal>
    </div>
  );
}