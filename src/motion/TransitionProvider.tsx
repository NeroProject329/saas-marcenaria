"use client";

import { createContext, useCallback, useContext, useMemo, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import gsap from "gsap";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

type Ctx = {
  go: (href: string) => void;
};

const TransitionCtx = createContext<Ctx | null>(null);

export function TransitionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const reduced = usePrefersReducedMotion();
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const go = useCallback(
    (href: string) => {
      if (!href || href === pathname) return;

      // respeita reduce motion
      if (reduced) {
        router.push(href);
        return;
      }

      const overlay = overlayRef.current;
      if (!overlay) {
        router.push(href);
        return;
      }

      gsap.killTweensOf(overlay);

      const tl = gsap.timeline({ defaults: { ease: "power2.out" } });

      tl.set(overlay, { pointerEvents: "auto" })
        .fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: 0.16 })
        .add(() => router.push(href))
        .to(overlay, { opacity: 0, duration: 0.22, delay: 0.08, ease: "power2.inOut" })
        .set(overlay, { pointerEvents: "none" });
    },
    [pathname, reduced, router]
  );

  const value = useMemo(() => ({ go }), [go]);

  return (
    <TransitionCtx.Provider value={value}>
      {children}
      <div ref={overlayRef} className="route-overlay" aria-hidden="true" />
    </TransitionCtx.Provider>
  );
}

export function useTransitionNav() {
  const ctx = useContext(TransitionCtx);
  if (!ctx) throw new Error("useTransitionNav must be used inside TransitionProvider");
  return ctx;
}