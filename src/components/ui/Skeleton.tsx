import { cn } from "@/lib/cn";

export default function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-[rgba(11,18,32,0.08)]",
        "before:absolute before:inset-0 before:-translate-x-full before:bg-gradient-to-r before:from-transparent before:via-white/40 before:to-transparent",
        "before:animate-[shimmer_1.25s_infinite]",
        className
      )}
      {...props}
    />
  );
}