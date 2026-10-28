"use client";

import { usePathname } from "next/navigation";
import { Boxes, House, Menu, ShoppingCart, Wallet } from "lucide-react";
import TransitionLink from "./TransitionLink";

const MOBILE_NAV = [
  { href: "/dashboard", label: "Início", icon: House },
  { href: "/financeiro", label: "Financeiro", icon: Wallet },
  { href: "/vendas", label: "Vendas", icon: ShoppingCart },
  { href: "/estoque", label: "Estoque", icon: Boxes },
] as const;

export default function Topbar({ onMenu }: { onMenu: () => void }) {
  const pathname = usePathname();

  return (
    <div className="mobile-bottom-safe fixed inset-x-0 bottom-0 z-40 lg:hidden">
      <nav
        aria-label="Navegação principal"
        className="mx-auto w-full overflow-hidden rounded-t-[24px] border-2 border-b-0 border-[color:var(--ink)] bg-[color:var(--bg-3)] shadow-[0_-8px_28px_rgba(36,50,74,0.20)]"
      >
        <div className="flex w-full snap-x snap-mandatory items-center gap-1 overflow-x-auto px-2 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {MOBILE_NAV.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <TransitionLink
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "flex min-h-14 min-w-[68px] snap-center flex-col items-center justify-center gap-1 rounded-2xl border-2 px-2 text-[10px] font-extrabold transition active:scale-[0.96]",
                  active
                    ? "border-[color:var(--ink)] bg-[color:var(--ink)] text-white"
                    : "border-transparent text-[color:var(--ink)] hover:border-[color:var(--line)] hover:bg-white",
                ].join(" ")}
              >
                <Icon className="h-5 w-5" strokeWidth={2.25} />
                <span>{item.label}</span>
              </TransitionLink>
            );
          })}

          <button
            type="button"
            onClick={onMenu}
            className="flex min-h-14 min-w-[68px] snap-center flex-col items-center justify-center gap-1 rounded-2xl border-2 border-transparent px-2 text-[10px] font-extrabold text-[color:var(--ink)] transition hover:border-[color:var(--line)] hover:bg-white active:scale-[0.96]"
            aria-label="Abrir menu completo"
          >
            <Menu className="h-5 w-5" strokeWidth={2.25} />
            <span>Menu</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
