import { cn } from "@/lib/utils";
import { Skeleton } from "./skeleton";

/** Full-page placeholder used while auth/setup status is loading. */
export function PageSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex min-h-dvh items-center justify-center p-6",
        className,
      )}
      aria-busy="true"
    >
      <div className="w-full max-w-sm space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-2/3" />
      </div>
    </div>
  );
}
