"use client";

import { cn } from "@/lib/cn";

type Item = { key: string; label: string };

export default function Segmented({
  items,
  value,
  onChange,
  className,
  outlined = false,
}: {
  items: Item[];
  value: string;
  onChange: (key: string) => void;
  className?: string;
  outlined?: boolean;
}) {
  return (
    <div
      className={cn(
        "pill inline-flex items-center p-1",
        outlined ? "gap-2" : "gap-1",
        className
      )}
    >
      {items.map((it) => {
        const active = it.key === value;
        return (
          <button
            key={it.key}
            onClick={() => onChange(it.key)}
            className={cn(
              "h-9 rounded-full border-2 px-4 text-sm font-extrabold transition-colors",
              active
                ? "border-[color:var(--ink)] bg-[color:var(--ink)] text-white shadow-[0_4px_0_rgba(36,50,74,0.18)]"
                : outlined
                  ? "border-[color:var(--ink)] bg-white text-[color:var(--ink)] hover:bg-[rgba(84,199,236,0.16)]"
                  : "border-transparent text-[color:var(--ink)]/70 hover:text-[color:var(--ink)]"
            )}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
