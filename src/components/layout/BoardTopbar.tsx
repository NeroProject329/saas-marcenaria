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
    <div className="pill flex w-full items-center justify-between gap-3 px-3 py-3 shadow-[0_26px_80px_rgba(11,18,32,0.14)]">
      {/* left brand */}
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[rgba(247,211,32,0.28)] shadow-sm">
          <span className="font-display text-[15px] font-black text-[color:var(--ink)]">M</span>
        </div>
        <div className="hidden leading-tight lg:block">
          <div className="font-display text-sm font-black text-[color:var(--ink)]">Gestão Marcenaria</div>
          <div className="text-[11px] font-semibold text-[color:var(--muted)]">Painel Premium</div>
        </div>
      </div>

      {/* center tabs (scroll se precisar) */}
      <div className="max-w-[52vw] overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Segmented
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
          <Input placeholder="Buscar..." />
        </div>
        <div className="xl:hidden">
          <IconButton icon={Search} label="Buscar" />
        </div>

        <IconButton icon={Grid2X2} label="Atalhos" />
        <IconButton icon={Bell} label="Notificações" />
        <IconButton icon={Settings} label="Configurações" onClick={() => go("/configuracoes")} />

        <button
          onClick={() => {
            logout();
            router.replace("/login");
          }}
          className="ml-1 flex items-center gap-2 rounded-[18px] border border-[color:var(--line)] bg-white/60 px-3 py-2 hover:bg-white/70"
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