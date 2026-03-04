"use client";

import { RefObject, useLayoutEffect } from "react";
import gsap from "gsap";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

export function useGsapFadeUpList(
  ref: RefObject<HTMLElement | null>,
  deps: any[] = [],
  opts?: { selector?: string; stagger?: number; y?: number; duration?: number }
) {
  const reduced = usePrefersReducedMotion();

  useLayoutEffect(() => {
    if (reduced) return;
    const root = ref.current;
    if (!root) return;

    const selector = opts?.selector ?? "[data-row]";
    const y = opts?.y ?? 10;
    const duration = opts?.duration ?? 0.32;
    const stagger = opts?.stagger ?? 0.03;

    const rows = root.querySelectorAll(selector);
    if (!rows.length) return;

    gsap.killTweensOf(rows);

    gsap.fromTo(
      rows,
      { opacity: 0, y },
      { opacity: 1, y: 0, duration, stagger, ease: "power2.out", clearProps: "transform" }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}