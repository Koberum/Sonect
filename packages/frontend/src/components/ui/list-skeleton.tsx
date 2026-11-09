import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface ListSkeletonProps {
  rows?: number;
  itemClassName?: string;
  className?: string;
}

/** Stack of skeleton rows for list/table loading states. */
export function ListSkeleton({
  rows = 6,
  itemClassName = "h-12 w-full rounded-lg",
  className,
}: ListSkeletonProps) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className={itemClassName} />
      ))}
    </div>
  );
}
