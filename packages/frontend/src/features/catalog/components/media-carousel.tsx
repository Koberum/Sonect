import type { ReactNode } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

export interface MediaCarouselProps {
  title: string;
  children: ReactNode;
}

/** Horizontal, scrollable row of media cards used by the dashboard sections. */
export function MediaCarousel({ title, children }: MediaCarouselProps) {
  return (
    <section className="mb-8">
      <h2 className="text-muted-foreground mb-2 text-sm font-medium tracking-wider uppercase">
        {title}
      </h2>
      <ScrollArea type="always" className="w-full">
        <div className="flex gap-4 pb-4">{children}</div>
        <ScrollBar orientation="horizontal" className="hidden" />
      </ScrollArea>
    </section>
  );
}
