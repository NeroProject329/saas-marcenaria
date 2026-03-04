"use client";

import { cn } from "@/lib/cn";

type Item = { key: string; label: string };

export default function Tabs({
  items,
  value,
  onChange,
  className,
}: {
  items: Item[];
  value: string;
  onChange: (key: string) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "pill flex max-w-full items-center gap-1 p-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
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
              "h-9 shrink-0 rounded-full px-4 text-sm font-extrabold transition",
              active
                ? "bg-[color:var(--ink)] text-white shadow-[0_10px_20px_rgba(11,18,32,0.18)]"
                : "text-[color:var(--ink)]/70 hover:text-[color:var(--ink)]"
            )}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}