"use client";

import Link from "next/link";
import { MouseEvent } from "react";
import { useTransitionNav } from "@/motion/TransitionProvider";

export default function TransitionLink({
  href,
  children,
  className,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const { go } = useTransitionNav();

  return (
    <Link
      href={href}
      className={className}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented) return;

        // permite abrir nova aba / copiar link / etc
        const modified =
          e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
        if (modified) return;

        e.preventDefault();
        go(href);
      }}
    >
      {children}
    </Link>
  );
}