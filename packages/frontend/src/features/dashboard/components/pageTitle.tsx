import type { ReactNode } from "react";

export interface PageTitleProps {
  title: string;
  description?: string | ReactNode;
}

export function PageTitle({ title, description }: PageTitleProps) {
  return (
    <div className="mt-6 mb-6 space-y-1">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  );
}
