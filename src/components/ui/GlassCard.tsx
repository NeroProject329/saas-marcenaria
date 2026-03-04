import { cn } from "@/lib/cn";

export default function GlassCard({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("glass-card", className)} {...props} />;
}