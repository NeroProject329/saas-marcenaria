"use client";

import { Menu, Bell } from "lucide-react";
import IconButton from "@/components/ui/IconButton";

export default function Topbar({ onMenu }: { onMenu: () => void }) {
  return (
    <header className="fixed left-0 top-0 z-50 w-full md:hidden">
      <div className="safe-top safe-x mx-auto w-full px-3">
        <div className="pill flex items-center justify-between gap-2 px-2 py-2 shadow-[0_18px_60px_rgba(11,18,32,0.10)]">
          <button
            onClick={onMenu}
            className="icon-btn grid h-11 w-11 place-items-center"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5 text-[color:var(--ink)]" strokeWidth={2.15} />
          </button>

          <div className="flex min-w-0 items-center gap-2">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[rgba(247,211,32,0.28)]">
              <span className="font-display text-sm font-black text-[color:var(--ink)]">M</span>
            </div>
            <div className="min-w-0 leading-tight">
              <div className="truncate font-display text-sm font-black text-[color:var(--ink)]">
                Marcenaria
              </div>
              <div className="truncate text-[11px] font-semibold text-[color:var(--muted)]">
                Painel
              </div>
            </div>
          </div>

          <IconButton icon={Bell} label="Notificações" />
        </div>
      </div>
    </header>
  );
}