import { ReactNode } from "react";
import Badge from "@/components/ui/Badge";

export default function PageHeader({
  title,
  subtitle,
  badge,
  right,
}: {
  title: string;
  subtitle?: string;
  badge?: { label: string; tone?: any };
  right?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="font-display text-xl font-black tracking-tight text-[color:var(--ink)] sm:text-2xl">
            {title}
          </h1>
          {badge ? <Badge tone={badge.tone || "ink"}>{badge.label}</Badge> : null}
        </div>
        {subtitle ? (
          <p className="mt-1 max-w-2xl text-sm font-semibold text-[color:var(--muted)]">
            {subtitle}
          </p>
        ) : null}
      </div>

      {right ? <div className="flex items-center gap-2">{right}</div> : null}
    </div>
  );
}