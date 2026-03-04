import { cn } from "@/lib/cn";

type Tone = "brand" | "wood" | "success" | "warning" | "danger" | "ink" | "neutral" ;

export default function Badge({
  tone = "brand",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  const tones: Record<Tone, string> = {
    brand: "bg-[rgba(247,211,32,0.22)] text-[color:var(--ink)] border-black/10",
    wood: "bg-[rgba(194,65,12,0.14)] text-[color:var(--ink)] border-black/10",
    success: "bg-[rgba(22,163,74,0.14)] text-[color:var(--ink)] border-black/10",
    warning: "bg-[rgba(245,158,11,0.16)] text-[color:var(--ink)] border-black/10",
    danger: "bg-[rgba(220,38,38,0.12)] text-[color:var(--ink)] border-black/10",
    ink: "bg-[rgba(11,18,32,0.10)] text-[color:var(--ink)] border-black/10",
    neutral: ""
  };

  return (
    <span
      className={cn(
        "pill inline-flex items-center gap-2 border px-3 py-1 text-[11px] font-extrabold",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}