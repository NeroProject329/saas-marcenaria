import { cn } from "@/lib/cn";

type Variant = "primary" | "soft" | "ghost" | "dark";
type Size = "sm" | "md" | "lg";

export default function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl font-extrabold transition active:translate-y-[1px] disabled:opacity-60 disabled:pointer-events-none";

  const variants: Record<Variant, string> = {
    primary:
      "bg-[color:var(--brand)] text-[color:var(--ink)] border border-black/10 shadow-[0_14px_26px_rgba(247,211,32,0.22)] hover:brightness-[0.99]",
    soft:
      "bg-[rgba(255,255,255,0.66)] text-[color:var(--ink)] border border-[color:var(--line)] hover:bg-white/75",
    ghost:
      "bg-transparent text-[color:var(--ink)] border border-transparent hover:bg-white/55 hover:border-[color:var(--line)]",
    dark:
      "bg-[color:var(--ink)] text-white border border-black/20 shadow-[0_14px_28px_rgba(11,18,32,0.18)] hover:brightness-[1.02]",
  };

  const sizes: Record<Size, string> = {
    sm: "h-9 px-3 text-sm",
    md: "h-10 px-4 text-sm",
    lg: "h-11 px-5 text-[15px]",
  };

  return <button className={cn(base, variants[variant], sizes[size], className)} {...props} />;
}