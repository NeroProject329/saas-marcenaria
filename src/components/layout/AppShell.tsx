"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import BoardTopbar from "./BoardTopbar";
import RouteEnter from "@/motion/RouteEnter";
import { usePathname } from "next/navigation";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const pathname = usePathname() || "";
const isAuth = pathname.startsWith("/login") || pathname.startsWith("/register");

if (isAuth) {
  return (
    <div className="safe-x mx-auto flex min-h-dvh w-full items-center justify-center px-3 py-10">
      <div className="w-full max-w-[520px]">{children}</div>
    </div>
  );
}

  return (
    <div className="relative min-h-dvh w-full">
      {/* mobile topbar fixo */}
      <Topbar onMenu={() => setMobileOpen(true)} />

      {/* desktop topbar sticky */}
      <div className="hidden md:block safe-x mx-auto w-full px-4 pt-5">
        <div className="sticky top-5 z-40">
          <BoardTopbar />
        </div>
      </div>

      {/* layout */}
      <div className="safe-x mx-auto w-full px-3 pb-10 pt-16 sm:px-4 sm:pt-20 md:pt-6">
        <div className="flex w-full gap-4">
          <Sidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />

          <main className="min-w-0 flex-1">
            {/* container principal (pode ser card leve, mas não é “board atrás de tudo”) */}
            <div className="rounded-[30px] border border-[color:var(--line)] bg-white/28 shadow-[0_18px_60px_rgba(11,18,32,0.10)] backdrop-blur-[12px]">
              <div className="p-3 sm:p-4">
                <RouteEnter>{children}</RouteEnter>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}