"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import GlassCard from "@/components/ui/GlassCard";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { useAuth } from "@/auth/AuthProvider";

export default function RegisterPage() {
  const { status, register } = useAuth();
  const router = useRouter();
  const sp = useSearchParams();
  const next = useMemo(() => {
  const raw = sp.get("next") || "/dashboard";
  if (raw.startsWith("/login") || raw.startsWith("/register")) return "/dashboard";
  return raw;
}, [sp]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (status === "authed") router.replace(next);
  }, [status, router, next]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!name.trim()) return setErr("Informe seu nome.");
    if (!email.trim()) return setErr("Informe seu e-mail.");
    if (pass.length < 6) return setErr("A senha precisa ter no mínimo 6 caracteres.");
    if (pass !== pass2) return setErr("As senhas não conferem.");

    setPending(true);
    try {
      await register({ name: name.trim(), email: email.trim(), password: pass });
      router.replace(next);
    } catch (e: any) {
      setErr(e?.message || "Falha no cadastro.");
    } finally {
      setPending(false);
    }
  }

  return (
    <GlassCard className="p-5 sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="font-display text-2xl font-black text-[color:var(--ink)]">Criar conta</div>
          <div className="mt-1 text-sm font-semibold text-[color:var(--muted)]">
            Crie seu acesso e entre no painel.
          </div>
        </div>
        <Badge tone="brand">Premium</Badge>
      </div>

      <form onSubmit={onSubmit} className="mt-5 space-y-3">
        <div>
          <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Nome</div>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" />
        </div>

        <div>
          <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">E-mail</div>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seuemail@..." />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Senha</div>
            <Input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="••••••••" />
          </div>
          <div>
            <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Confirmar</div>
            <Input type="password" value={pass2} onChange={(e) => setPass2(e.target.value)} placeholder="••••••••" />
          </div>
        </div>

        {err ? (
          <div className="rounded-2xl border border-red-500/15 bg-red-500/10 p-3 text-sm font-semibold text-red-700">
            {err}
          </div>
        ) : null}

        <Button className="w-full" variant="dark" disabled={pending}>
          {pending ? "Criando..." : "Criar conta"}
        </Button>

        <Button type="button" className="w-full" variant="soft" onClick={() => router.push(`/login?next=${encodeURIComponent(next)}`)}>
          Já tenho conta
        </Button>
      </form>
    </GlassCard>
  );
}