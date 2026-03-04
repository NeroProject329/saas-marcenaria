"use client";

import { RefObject, useLayoutEffect } from "react";
import gsap from "gsap";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

type Options = {
  selector?: string;
  y?: number;
  duration?: number;
  stagger?: number;
};

export function useGsapStagger(ref: RefObject<HTMLElement | null>, options: Options = {}) {
  const reduced = usePrefersReducedMotion();

  useLayoutEffect(() => {
    if (reduced) return;
    const el = ref.current;
    if (!el) return;

    const {
      selector = "[data-stagger]",
      y = 12,
      duration = 0.5,
      stagger = 0.05,
    } = options;

    const targets = el.querySelectorAll(selector);
    if (!targets.length) return;

    gsap.fromTo(
      targets,
      { opacity: 0, y },
      {
        opacity: 1,
        y: 0,
        duration,
        stagger,
        ease: "power2.out",
        clearProps: "transform",
      }
    );
  }, [ref, reduced, options.selector, options.y, options.duration, options.stagger]);
}