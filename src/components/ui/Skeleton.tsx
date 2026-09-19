import { Card } from "@/components/ui/Card";
import { cn } from "@/design/utils";

export interface SkeletonProps {
  variant: "line" | "block" | "card";
  className?: string;
}

export function Skeleton({ variant, className }: SkeletonProps) {
  if (variant === "card") {
    return (
      <Card aria-hidden className={className}>
        <div className="flex flex-col gap-lg">
          <Skeleton variant="block" />
          <Skeleton variant="line" />
          <Skeleton variant="line" className="w-2/3" />
        </div>
      </Card>
    );
  }
  return (
    <div
      aria-hidden
      className={cn(
        "animate-shimmer bg-surfaceMuted",
        variant === "line" ? "h-lg w-full rounded-sm" : "h-xxxl w-full rounded-md",
        className,
      )}
    />
  );
}
