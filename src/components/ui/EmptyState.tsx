import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import GlassCard from "./GlassCard";
import Button from "./Button";

export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}) {
  return (
    <GlassCard className={cn("p-6 sm:p-7", className)}>
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 place-items-center rounded-2xl border border-black/10 bg-white/55">
          <Icon className="h-6 w-6 text-[color:var(--ink)]" strokeWidth={2.15} />
        </div>

        <div className="min-w-0">
          <div className="font-display text-lg font-black text-[color:var(--ink)]">{title}</div>
          {description ? (
            <div className="mt-1 text-sm font-semibold text-[color:var(--muted)]">{description}</div>
          ) : null}

          {actionLabel && onAction ? (
            <div className="mt-4">
              <Button variant="dark" onClick={onAction}>
                {actionLabel}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </GlassCard>
  );
}