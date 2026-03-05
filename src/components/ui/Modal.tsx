"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import GlassCard from "@/components/ui/GlassCard";
import Button from "@/components/ui/Button";

type ModalProps = {
  open: boolean;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string; // ex: "max-w-[880px]"
};

export default function Modal({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  maxWidth = "max-w-[760px]",
}: ModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // ESC pra fechar
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  // trava scroll do body
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100]">
      {/* overlay */}
      <button
        type="button"
        aria-label="Fechar modal"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
      />

      {/* container centralizado */}
      <div className="relative z-[101] flex min-h-full items-center justify-center p-4 sm:p-6">
        <div className={`w-full ${maxWidth} my-6`}>
          <GlassCard className="overflow-hidden p-0">
            {/* header */}
            <div className="flex items-start justify-between gap-3 border-b border-[color:var(--line)] bg-white/35 px-5 py-4">
              <div className="min-w-0">
                {title ? (
                  <div className="truncate font-display text-base font-black text-[color:var(--ink)]">
                    {title}
                  </div>
                ) : null}
                {subtitle ? (
                  <div className="mt-1 text-sm font-semibold text-[color:var(--muted)]">
                    {subtitle}
                  </div>
                ) : null}
              </div>

              <Button variant="ghost" onClick={onClose} aria-label="Fechar">
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* body com scroll interno (mantém o modal no meio) */}
            <div className="max-h-[calc(100vh-220px)] overflow-y-auto px-5 py-4">
              {children}
            </div>

            {/* footer */}
            {footer ? (
              <div className="border-t border-[color:var(--line)] bg-white/25 px-5 py-4">
                {footer}
              </div>
            ) : null}
          </GlassCard>
        </div>
      </div>
    </div>,
    document.body
  );
}