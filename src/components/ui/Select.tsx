import { cn } from "@/lib/cn";

export default function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "pill h-10 w-full px-3 text-sm font-semibold text-[color:var(--ink)] outline-none",
        "focus:border-black/15 focus:ring-4 focus:ring-[rgba(149,173,193,0.35)]",
        className
      )}
      {...props}
    />
  );
}