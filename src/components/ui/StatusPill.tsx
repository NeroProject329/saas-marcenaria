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
    success:
      "bg-[color:var(--success)] text-white border-[color:var(--success)] shadow-[0_8px_22px_rgba(22,163,74,0.28)]",
    warning:
      "bg-[color:var(--warning)] text-[color:var(--ink)] border-[color:var(--warning)] shadow-[0_8px_22px_rgba(245,158,11,0.28)]",
    danger:
      "bg-[color:var(--danger)] text-white border-[color:var(--danger)] shadow-[0_8px_22px_rgba(220,38,38,0.28)]",
    info:
      "bg-[#2563eb] text-white border-[#2563eb] shadow-[0_8px_22px_rgba(37,99,235,0.28)]",
    neutral:
      "bg-[color:var(--ink)]/78 text-white border-[color:var(--ink)]/78 shadow-[0_8px_22px_rgba(11,18,32,0.18)]",
    brand:
      "bg-[color:var(--brand)] text-[color:var(--ink)] border-[color:var(--brand)] shadow-[0_8px_22px_rgba(247,211,32,0.28)]",
    wood:
      "bg-[color:var(--wood)] text-white border-[color:var(--wood)] shadow-[0_8px_22px_rgba(194,65,12,0.28)]",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-extrabold tracking-[0.02em] whitespace-nowrap",
        tones[tone],
        className
      )}
    >
      {label}
    </span>
  );
}