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
    "inline-flex items-center justify-center gap-2 rounded-xl font-extrabold transition duration-200 active:translate-y-[2px] active:shadow-none disabled:opacity-60 disabled:pointer-events-none";

  const variants: Record<Variant, string> = {
    primary:
      "bg-[color:var(--brand)] text-[color:var(--ink)] border-2 border-[color:var(--ink)] shadow-[0_4px_0_var(--ink)] hover:-translate-y-0.5",
    soft:
      "bg-white text-[color:var(--ink)] border-2 border-[color:var(--line)] shadow-[0_3px_0_rgba(36,50,74,0.12)] hover:bg-[color:var(--bg-0)]",
    ghost:
      "bg-transparent text-[color:var(--ink)] border-2 border-transparent hover:bg-[color:var(--bg-0)] hover:border-[color:var(--line)]",
    dark:
      "bg-[color:var(--ink)] text-white border-2 border-[color:var(--ink)] shadow-[0_4px_0_rgba(36,50,74,0.26)] hover:-translate-y-0.5",
  };

  const sizes: Record<Size, string> = {
    sm: "h-9 px-3 text-sm",
    md: "h-10 px-4 text-sm",
    lg: "h-11 px-5 text-[15px]",
  };

  return <button className={cn(base, variants[variant], sizes[size], className)} {...props} />;
}
