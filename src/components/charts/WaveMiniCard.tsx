"use client";

import { useMemo, useState } from "react";
import GlassCard from "@/components/ui/GlassCard";
import { cn } from "@/lib/cn";
import { moneyBRLFromCents } from "@/lib/format";

type Point = { label: string; valueCents: number };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// Catmull-Rom -> Bezier (suaviza o path)
function catmullRomToBezier(points: Array<{ x: number; y: number }>) {
  if (points.length < 2) return "";
  const d: string[] = [];
  d.push(`M ${points[0].x} ${points[0].y}`);

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    const t = 0.55;

    const c1x = p1.x + ((p2.x - p0.x) / 6) * t;
    const c1y = p1.y + ((p2.y - p0.y) / 6) * t;

    const c2x = p2.x - ((p3.x - p1.x) / 6) * t;
    const c2y = p2.y - ((p3.y - p1.y) / 6) * t;

    d.push(`C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`);
  }
  return d.join(" ");
}

export default function WaveMiniCard({
  title = "Evolução",
  subtitle = "Receita (placeholder)",
  points,
  accent = "brand",
  className,
}: {
  title?: string;
  subtitle?: string;
  points: Point[];
  accent?: "brand" | "wood" | "success" | "neutral";
  className?: string;
}) {
  const [active, setActive] = useState(() => Math.max(0, points.length - 1));

  const { lineD, areaD, svgPoints } = useMemo(() => {
    const W = 720;
    const H = 160; // ✅ compacto
    const padX = 30;
    const padTop = 22;
    const padBottom = 42;

    const values = points.map((p) => p.valueCents);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = Math.max(1, max - min);

    const step = (W - padX * 2) / Math.max(1, points.length - 1);

    const pts = points.map((p, i) => {
      const x = padX + i * step;
      const t = (p.valueCents - min) / range;
      const y = padTop + (1 - t) * (H - padTop - padBottom);
      return { x, y, v: p.valueCents, label: p.label };
    });

    const line = catmullRomToBezier(pts.map(({ x, y }) => ({ x, y })));
    const baseY = H - padBottom + 12;
    const area = `${line} L ${pts[pts.length - 1].x} ${baseY} L ${pts[0].x} ${baseY} Z`;

    return { lineD: line, areaD: area, svgPoints: pts };
  }, [points]);

  const a = svgPoints[active] || svgPoints[0];

  const accentGlow: Record<string, string> = {
    brand: "from-[rgba(247,211,32,0.52)] via-[rgba(247,211,32,0.18)] to-transparent",
    wood: "from-[rgba(194,65,12,0.28)] via-[rgba(194,65,12,0.10)] to-transparent",
    success: "from-[rgba(22,163,74,0.22)] via-[rgba(22,163,74,0.08)] to-transparent",
    neutral: "from-white/45 via-white/10 to-transparent",
  };

  return (
    <GlassCard className={cn("relative overflow-hidden p-4", className)}>
      {/* glow sutil */}
      <div
        className={cn(
          "pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full blur-3xl opacity-80",
          "bg-gradient-to-br",
          accentGlow[accent]
        )}
      />

      <div className="relative flex items-end justify-between gap-2">
        <div>
          <div className="font-display text-sm font-black text-[color:var(--ink)]">{title}</div>
          <div className="text-xs font-semibold text-[color:var(--muted)]">{subtitle}</div>
        </div>

        <div className="pill px-3 py-2 text-xs font-extrabold">
          {a?.label} • {moneyBRLFromCents(a?.v || 0)}
        </div>
      </div>

      <div className="relative mt-3 overflow-hidden rounded-[22px] border border-[color:var(--line)] bg-white/40">
        {/* faixa amarelinha estilo referência */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[54%] bg-[rgba(247,211,32,0.18)]" />

        <svg viewBox="0 0 720 160" className="relative block w-full">
          <defs>
            <linearGradient id="miniArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(247,211,32,0.50)" />
              <stop offset="55%" stopColor="rgba(247,211,32,0.18)" />
              <stop offset="100%" stopColor="rgba(247,211,32,0.02)" />
            </linearGradient>
            <linearGradient id="miniLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(11,18,32,0.80)" />
              <stop offset="100%" stopColor="rgba(11,18,32,0.45)" />
            </linearGradient>
          </defs>

          <path d={areaD} fill="url(#miniArea)" opacity="0.95" />
          <path d={lineD} fill="none" stroke="url(#miniLine)" strokeWidth="3.1" />

          <line
            x1={a?.x || 0}
            x2={a?.x || 0}
            y1="22"
            y2="118"
            stroke="rgba(11,18,32,0.22)"
            strokeDasharray="4 6"
          />
          <circle
            cx={a?.x || 0}
            cy={a?.y || 0}
            r="7"
            fill="rgba(247,211,32,0.98)"
            stroke="rgba(11,18,32,0.70)"
            strokeWidth="2"
          />
        </svg>

        {/* pills de meses */}
        <div className="flex items-center gap-2 overflow-x-auto px-3 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {points.map((p, idx) => {
            const isActive = idx === active;
            return (
              <button
                key={p.label + idx}
                onClick={() => setActive(idx)}
                className={cn(
                  "pill shrink-0 px-3 py-2 text-[11px] font-extrabold transition",
                  isActive
                    ? "bg-[rgba(247,211,32,0.36)] border-black/10 text-[color:var(--ink)]"
                    : "bg-white/55 text-[color:var(--ink)]/70 hover:text-[color:var(--ink)]"
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>
    </GlassCard>
  );
}