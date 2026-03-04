"use client";

import { useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

export default function RouteEnter({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();
  const reduced = usePrefersReducedMotion();

  useLayoutEffect(() => {
    if (reduced) return;
    const el = ref.current;
    if (!el) return;

    gsap.killTweensOf(el);

    gsap.fromTo(
      el,
      { opacity: 0, y: 10, filter: "blur(8px)" },
      {
        opacity: 1,
        y: 0,
        filter: "blur(0px)",
        duration: 0.38,
        ease: "power2.out",
        clearProps: "transform,filter",
      }
    );
  }, [pathname, reduced]);

  return <div ref={ref} className="min-h-full">{children}</div>;
}