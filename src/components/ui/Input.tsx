import { cn } from "@/lib/cn";

export default function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "pill h-10 w-full px-3 text-sm font-semibold text-[color:var(--ink)] outline-none",
        "focus:border-[color:var(--ink)] focus:ring-4 focus:ring-[rgba(84,199,236,0.30)]",
        className
      )}
      {...props}
    />
  );
}
