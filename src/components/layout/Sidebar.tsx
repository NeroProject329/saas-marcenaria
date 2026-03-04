"use client";

import TransitionLink from "./TransitionLink";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Wallet,
  ShoppingCart,
  Receipt,
  Users,
  HardHat,
  Boxes,
  FileText,
  Settings,
  CreditCard,
  BarChart3,
  X,
} from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { useRouter } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/financeiro", label: "Financeiro", icon: Wallet },
  { href: "/vendas", label: "Vendas", icon: ShoppingCart },
  { href: "/custos", label: "Custos", icon: Receipt },
  { href: "/orcamentos", label: "Orçamentos", icon: FileText },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/funcionarios", label: "Funcionários", icon: HardHat },
  { href: "/estoque", label: "Estoque", icon: Boxes },
  { href: "/assinaturas", label: "Assinaturas", icon: CreditCard },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
] as const;

export default function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const { me, logout } = useAuth();
  const router = useRouter();

  return (
    <>
      {/* overlay mobile */}
      <button
        onClick={onClose}
        className={[
          "fixed inset-0 z-40 bg-black/35 backdrop-blur-sm transition md:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
        aria-label="Fechar menu"
      />

      <aside
        className={[
          "fixed left-3 top-3 z-50 h-[calc(100dvh-24px)] w-[86vw] max-w-[320px] rounded-[30px] border border-[color:var(--line)] bg-white/55 p-3 shadow-[0_26px_80px_rgba(11,18,32,0.18)] backdrop-blur-[var(--glass-blur)] transition md:sticky md:left-auto md:top-0 md:z-auto md:h-auto md:w-[290px] md:translate-x-0 md:bg-white/45",
          open ? "translate-x-0" : "-translate-x-[120%] md:translate-x-0",
        ].join(" ")}
      >
        {/* header mobile */}
        <div className="flex items-center justify-between gap-2 p-2 md:hidden">
          <div className="flex items-center gap-2">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[rgba(247,211,32,0.28)]">
              <span className="font-display text-sm font-black text-[color:var(--ink)]">M</span>
            </div>
            <div className="leading-tight">
              <div className="font-display text-sm font-black text-[color:var(--ink)]">
                Gestão Marcenaria
              </div>
              <div className="text-[11px] font-semibold text-[color:var(--muted)]">
                Menu
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="icon-btn grid h-11 w-11 place-items-center"
            aria-label="Fechar"
          >
            <X className="h-5 w-5 text-[color:var(--ink)]" strokeWidth={2.15} />
          </button>
        </div>

        {/* title desktop */}
        <div className="hidden px-2 pt-2 md:block">
          <div className="font-display text-sm font-black text-[color:var(--ink)]">Navegação</div>
          <div className="text-[11px] font-semibold text-[color:var(--muted)]">
            Tudo no mesmo padrão premium
          </div>
        </div>

        <nav className="mt-3 space-y-1.5 px-1">
          {NAV.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;

            return (
              <TransitionLink
  key={item.href}
  href={item.href}
  onClick={() => onClose()}
  className={[
    "group flex items-center gap-3 rounded-[22px] px-3 py-2.5 transition",
    active ? "bg-[rgba(247,211,32,0.28)] border border-black/10" : "hover:bg-white/55",
  ].join(" ")}
>
                <span
                  className={[
                    "grid h-10 w-10 place-items-center rounded-[18px] border transition",
                    active
                      ? "bg-[color:var(--ink)] border-black/10 shadow-[0_14px_30px_rgba(11,18,32,0.18)]"
                      : "bg-white/60 border-[color:var(--line)] group-hover:bg-white/75",
                  ].join(" ")}
                >
                  <Icon
                    className={[
                      "h-5 w-5",
                      active ? "text-white" : "text-[color:var(--ink)]",
                    ].join(" ")}
                    strokeWidth={2.15}
                  />
                </span>

                <div className="min-w-0">
                  <div className="truncate text-sm font-extrabold text-[color:var(--ink)]">
                    {item.label}
                  </div>
                  <div className="truncate text-[11px] font-semibold text-[color:var(--muted)]">
                    {active ? "Você está aqui" : "Abrir seção"}
                  </div>
                </div>
              </TransitionLink>
            );
          })}
        </nav>

        {/* footer card */}
       <div className="glass-card p-3">
  <div className="text-[11px] font-extrabold text-[color:var(--muted)]">Conta</div>
  <div className="mt-1 font-display text-sm font-black text-[color:var(--ink)]">
    {me?.name || "Usuário"}
  </div>
  <div className="text-[11px] font-semibold text-[color:var(--muted)]">
    {me?.email || "—"} • {me?.plan || "FREE"}
  </div>

  <button
    onClick={() => {
      logout();
      router.replace("/login");
    }}
    className="mt-3 w-full rounded-2xl border border-black/10 bg-white/65 px-3 py-2 text-sm font-extrabold text-[color:var(--ink)] hover:bg-white/75"
  >
    Sair
  </button>
</div>
      </aside>
    </>
  );
}