import GlassCard from "@/components/ui/GlassCard";
import Skeleton from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-4">
      <GlassCard className="p-4">
        <Skeleton className="h-6 w-[220px]" />
        <Skeleton className="mt-3 h-4 w-[420px] max-w-full" />
      </GlassCard>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <GlassCard key={i} className="p-4">
            <Skeleton className="h-4 w-[120px]" />
            <Skeleton className="mt-3 h-7 w-[160px]" />
            <Skeleton className="mt-3 h-3 w-[90%]" />
          </GlassCard>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
        <GlassCard className="p-4">
          <Skeleton className="h-5 w-[180px]" />
          <div className="mt-4 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-black/5 p-3">
                <Skeleton className="h-4 w-[75%]" />
                <Skeleton className="mt-2 h-4 w-[55%]" />
              </div>
            ))}
          </div>
        </GlassCard>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <GlassCard className="p-4">
            <Skeleton className="h-5 w-[180px]" />
            <Skeleton className="mt-4 h-28 w-full" />
          </GlassCard>
          <GlassCard className="p-4">
            <Skeleton className="h-5 w-[180px]" />
            <Skeleton className="mt-4 h-28 w-full" />
          </GlassCard>
        </div>
      </div>
    </div>
  );
}