import { cn } from "@/lib/cn";
import type { LucideIcon } from "lucide-react";

export default function IconButton({
  icon: Icon,
  label,
  className,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={cn(
        "icon-btn grid h-11 w-11 place-items-center transition hover:brightness-[0.985] active:translate-y-[1px]",
        className
      )}
    >
      <Icon className="h-5 w-5 text-[color:var(--ink)]" strokeWidth={2.15} />
    </button>
  );
}