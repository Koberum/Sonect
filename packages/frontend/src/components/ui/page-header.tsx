import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  media?: ReactNode;
  meta?: ReactNode;
  metaAlign?: "start" | "end";
  className?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  media,
  meta,
  metaAlign = "start",
  className,
}: PageHeaderProps) {
  const isMetaBottom = metaAlign === "end";
  return (
    <div
      className={cn(
        "mb-6 flex flex-wrap items-start justify-between gap-4",
        className,
      )}
    >
      <div
        className={cn(
          "flex min-w-0 gap-4",
          isMetaBottom ? "items-stretch" : "items-start",
        )}
      >
        {media ? <div className="shrink-0">{media}</div> : null}
        <div className={cn("min-w-0", isMetaBottom && "flex flex-col")}>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description ? (
            <p className="text-muted-foreground mt-1 text-sm">{description}</p>
          ) : null}
          {meta ? (
            <div className={cn(isMetaBottom ? "mt-auto pt-2" : "mt-2")}>
              {meta}
            </div>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
