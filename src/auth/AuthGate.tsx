"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import GlassCard from "@/components/ui/GlassCard";
import Skeleton from "@/components/ui/Skeleton";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname() || "";

  const isAuthRoute =
    pathname.startsWith("/login") || pathname.startsWith("/register");

  useEffect(() => {
    if (status !== "guest") return;

    // ✅ Se já está em /login ou /register, não redireciona
    if (isAuthRoute) return;

    // ✅ Nunca manda next=/login
    const next = pathname && !isAuthRoute ? pathname : "/dashboard";
    router.replace(`/login?next=${encodeURIComponent(next)}`);
  }, [status, router, pathname, isAuthRoute]);

  if (status === "loading") {
    return (
      <div className="space-y-3">
        <GlassCard className="p-4">
          <Skeleton className="h-6 w-[220px]" />
          <Skeleton className="mt-3 h-4 w-[420px] max-w-full" />
        </GlassCard>
      </div>
    );
  }

  // ✅ Se for guest e estiver em /login ou /register, deixa renderizar
  if (status === "guest" && isAuthRoute) return <>{children}</>;

  if (status === "guest") return null;

  return <>{children}</>;
}