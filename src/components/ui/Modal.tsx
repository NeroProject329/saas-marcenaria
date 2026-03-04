"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import GlassCard from "./GlassCard";

export default function Modal({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  className,
  maxWidth = "max-w-[920px]",
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  maxWidth?: string;
}) {
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-5">
      <button
        className="absolute inset-0 bg-black/35 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Fechar modal"
      />

      <GlassCard
        className={cn(
          "relative w-full overflow-hidden",
          maxWidth,
          "max-h-[92dvh] flex flex-col",
          className
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[color:var(--line)] bg-white/40 p-4 sm:p-5">
          <div className="min-w-0">
            <div className="font-display text-lg font-black text-[color:var(--ink)] sm:text-xl">
              {title}
            </div>
            {subtitle ? (
              <div className="mt-1 text-sm font-semibold text-[color:var(--muted)]">{subtitle}</div>
            ) : null}
          </div>

          <button
            onClick={onClose}
            className="icon-btn grid h-11 w-11 place-items-center"
            aria-label="Fechar"
          >
            <X className="h-5 w-5 text-[color:var(--ink)]" strokeWidth={2.15} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-5">{children}</div>

        {footer ? (
          <div className="border-t border-[color:var(--line)] bg-white/35 p-4 sm:p-5">{footer}</div>
        ) : null}
      </GlassCard>
    </div>
  );
}