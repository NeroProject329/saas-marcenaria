"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import GlassCard from "@/components/ui/GlassCard";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { useAuth } from "@/auth/AuthProvider";

function LoginInner() {
  const { status, login } = useAuth();
  const router = useRouter();
  const sp = useSearchParams();

  // ✅ useSearchParams precisa estar abaixo de um <Suspense>
  const next = useMemo(() => {
    const raw = sp.get("next") || "/dashboard";
    if (raw.startsWith("/login") || raw.startsWith("/register")) return "/dashboard";
    return raw;
  }, [sp]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (status === "authed") router.replace(next);
  }, [status, router, next]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setPending(true);
    try {
      await login(email.trim(), password);
      router.replace(next);
    } catch (e: any) {
      setErr(e?.message || "Falha no login.");
    } finally {
      setPending(false);
    }
  }

  return (
    <GlassCard className="p-5 sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="font-display text-2xl font-black text-[color:var(--ink)]">Entrar</div>
          <div className="mt-1 text-sm font-semibold text-[color:var(--muted)]">
            Acesse seu painel premium.
          </div>
        </div>
        <Badge tone="brand">Marcenaria</Badge>
      </div>

      <form onSubmit={onSubmit} className="mt-5 space-y-3">
        <div>
          <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">E-mail</div>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seuemail@..." />
        </div>

        <div>
          <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Senha</div>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        {err ? (
          <div className="rounded-2xl border border-red-500/15 bg-red-500/10 p-3 text-sm font-semibold text-red-700">
            {err}
          </div>
        ) : null}

        <Button className="w-full" variant="dark" disabled={pending}>
          {pending ? "Entrando..." : "Entrar"}
        </Button>

        <Button
          type="button"
          className="w-full"
          variant="soft"
          onClick={() => router.push(`/register?next=${encodeURIComponent(next)}`)}
        >
          Criar conta
        </Button>
      </form>
    </GlassCard>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="h-10" />}>
      <LoginInner />
    </Suspense>
  );
}