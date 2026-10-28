"use client";

import { usePathname, useRouter } from "next/navigation";
import Segmented from "@/components/ui/Segmented";
import Input from "@/components/ui/Input";
import IconButton from "@/components/ui/IconButton";
import { Bell, Grid2X2, Settings, Search, LogOut } from "lucide-react";
import { useTransitionNav } from "@/motion/TransitionProvider";
import { useAuth } from "@/auth/AuthProvider";

const TOP = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard" },
  { key: "financeiro", label: "Financeiro", href: "/financeiro" },
  { key: "vendas", label: "Vendas", href: "/vendas" },
  { key: "estoque", label: "Estoque", href: "/estoque" },
];

export default function BoardTopbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { go } = useTransitionNav();
  const { me, logout } = useAuth();

  const current = TOP.find((t) => pathname?.startsWith(t.href))?.key || "dashboard";

  return (
    <div className="pill flex w-full items-center justify-between gap-3 !border-[color:var(--ink)] px-3 py-3 shadow-[0_5px_0_rgba(36,50,74,0.18)]">
      {/* left brand */}
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl border-2 border-[color:var(--ink)] bg-[rgba(247,211,32,0.28)] shadow-[0_3px_0_rgba(36,50,74,0.16)]">
          <span className="font-display text-[15px] font-black text-[color:var(--ink)]">M</span>
        </div>
        <div className="hidden leading-tight lg:block">
          <div className="font-display text-sm font-black text-[color:var(--ink)]">Gestão Marcenaria</div>
          <div className="text-[11px] font-semibold text-[color:var(--muted)]">Painel da oficina</div>
        </div>
      </div>

      {/* center tabs (scroll se precisar) */}
      <div className="max-w-[52vw] overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Segmented
          outlined
          items={TOP.map((t) => ({ key: t.key, label: t.label }))}
          value={current}
          onChange={(key) => {
            const target = TOP.find((t) => t.key === key);
            if (target) go(target.href);
          }}
        />
      </div>

      {/* right actions */}
      <div className="flex items-center gap-2">
        {/* search some em telas menores */}
        <div className="hidden xl:block xl:w-[320px]">
          <Input
            className="!border-[color:var(--ink)] bg-[rgba(84,199,236,0.12)]"
            placeholder="Buscar..."
          />
        </div>
        <div className="xl:hidden">
          <IconButton className="!border-[color:var(--ink)]" icon={Search} label="Buscar" />
        </div>

        <IconButton className="!border-[color:var(--ink)]" icon={Grid2X2} label="Atalhos" />
        <IconButton className="!border-[color:var(--ink)]" icon={Bell} label="Notificações" />
        <IconButton
          className="!border-[color:var(--ink)]"
          icon={Settings}
          label="Configurações"
          onClick={() => go("/configuracoes")}
        />

        <button
          onClick={() => {
            logout();
            router.replace("/login");
          }}
          className="ml-1 flex items-center gap-2 rounded-[18px] border-2 border-[color:var(--ink)] bg-white px-3 py-2 transition-colors hover:bg-[rgba(84,199,236,0.12)]"
        >
          <div className="hidden text-right lg:block">
            <div className="text-xs font-black text-[color:var(--ink)]">{me?.name || "Usuário"}</div>
            <div className="text-[11px] font-semibold text-[color:var(--muted)]">{me?.plan || "FREE"}</div>
          </div>
          <LogOut className="h-4 w-4 text-[color:var(--ink)]" strokeWidth={2.15} />
        </button>
      </div>
    </div>
  );
}
