import { cn } from "@/lib/cn";

type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "brand" | "wood";

export default function StatusPill({
  label,
  tone = "neutral",
  className,
}: {
  label: string;
  tone?: Tone;
  className?: string;
}) {
  const tones: Record<Tone, string> = {
    success: "bg-[rgba(22,163,74,0.14)] border-black/10 text-[color:var(--ink)]",
    warning: "bg-[rgba(245,158,11,0.16)] border-black/10 text-[color:var(--ink)]",
    danger: "bg-[rgba(220,38,38,0.12)] border-black/10 text-[color:var(--ink)]",
    info: "bg-[rgba(59,130,246,0.12)] border-black/10 text-[color:var(--ink)]",
    neutral: "bg-white/60 border-[color:var(--line)] text-[color:var(--ink)]/85",
    brand: "bg-[rgba(247,211,32,0.22)] border-black/10 text-[color:var(--ink)]",
    wood: "bg-[rgba(194,65,12,0.14)] border-black/10 text-[color:var(--ink)]",
  };

  return (
    <span
      className={cn(
        "pill inline-flex items-center gap-2 border px-3 py-1 text-[11px] font-extrabold",
        tones[tone],
        className
      )}
    >
      {label}
    </span>
  );
}