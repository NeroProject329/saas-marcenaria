"use client";

import { useRef } from "react";
import { cn } from "@/lib/cn";
import { useGsapFadeUpList } from "@/motion/useGsapFadeUpList";
import GlassCard from "./GlassCard";

export type Column<T> = {
  header: string;
  className?: string;
  cell: (row: T) => React.ReactNode;
};

export default function DataTable<T>({
  title,
  subtitle,
  columns,
  rows,
  rowKey,
  empty,
  className,
  right,
  animateKey,
}: {
  title?: string;
  subtitle?: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, idx: number) => string;
  empty?: React.ReactNode;
  className?: string;
  right?: React.ReactNode;
  animateKey?: any[];
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useGsapFadeUpList(ref, animateKey || [rows.length], { selector: "[data-row]" });

  return (
    <GlassCard className={cn("p-4", className)}>
      {(title || right) ? (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            {title ? <div className="font-display text-sm font-black text-[color:var(--ink)]">{title}</div> : null}
            {subtitle ? <div className="text-xs font-semibold text-[color:var(--muted)]">{subtitle}</div> : null}
          </div>
          {right ? <div className="flex items-center gap-2">{right}</div> : null}
        </div>
      ) : null}

      <div ref={ref} className="mt-3 overflow-auto rounded-2xl border border-[color:var(--line)] bg-white/35">
        <table className="min-w-[900px] w-full text-sm">
          <thead className="bg-white/55">
            <tr>
              {columns.map((c, i) => (
                <th
                  key={i}
                  className={cn(
                    "px-4 py-3 text-left text-xs font-extrabold text-[color:var(--muted)]",
                    c.className
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.length ? (
              rows.map((r, idx) => (
                <tr
                  key={rowKey(r, idx)}
                  data-row
                  className="border-t border-[color:var(--line)] hover:bg-white/45 transition"
                >
                  {columns.map((c, i) => (
                    <td key={i} className={cn("px-4 py-3 align-top", c.className)}>
                      {c.cell(r)}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10">
                  {empty || (
                    <div className="text-sm font-semibold text-[color:var(--muted)]">
                      Nenhum registro.
                    </div>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}