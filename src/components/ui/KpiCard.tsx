import type { LucideIcon } from "lucide-react";
import GlassCard from "./GlassCard";
import { cn } from "@/lib/cn";

type Tone = "brand" | "wood" | "success" | "danger" | "neutral" | "warning";

export default function KpiCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = "neutral",
  className,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  hint?: string;
  tone?: Tone;
  className?: string;
}) {
  const blob: Record<Tone, string> = {
    brand: "from-[rgba(247,211,32,0.40)] via-[rgba(247,211,32,0.10)] to-transparent",
    wood: "from-[rgba(194,65,12,0.22)] via-[rgba(194,65,12,0.08)] to-transparent",
    success: "from-[rgba(22,163,74,0.18)] via-[rgba(22,163,74,0.08)] to-transparent",
    danger: "from-[rgba(220,38,38,0.16)] via-[rgba(220,38,38,0.06)] to-transparent",
    neutral: "from-white/35 via-white/10 to-transparent",
    warning: "",
  };

  return (
    <GlassCard className={cn("relative p-4 overflow-hidden", className)}>
      {/* blob premium (dá vida) */}
      <div
        className={cn(
          "pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full blur-2xl opacity-80",
          "bg-gradient-to-br",
          blob[tone]
        )}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-xs font-extrabold text-[color:var(--muted)]">{label}</div>
          <div className="font-display text-xl font-black text-[color:var(--ink)]">{value}</div>
          {hint ? <div className="text-xs font-semibold text-[color:var(--muted)]">{hint}</div> : null}
        </div>

        <div className="grid h-11 w-11 place-items-center rounded-2xl border border-[color:var(--line)] bg-white/55 shadow-sm">
          <Icon className="h-5 w-5 text-[color:var(--ink)]" strokeWidth={2.15} />
        </div>
      </div>
    </GlassCard>
  );
}