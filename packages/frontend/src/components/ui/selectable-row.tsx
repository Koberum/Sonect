import * as React from "react";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

function SelectableRow({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<"div"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "div";

  return (
    <Comp
      data-slot="selectable-row"
      className={cn(
        "group hover:bg-accent hover:text-accent-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors outline-none focus-visible:ring-[3px]",
        className,
      )}
      {...props}
    />
  );
}

function SelectableRowIcon({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="selectable-row-icon"
      className={cn(
        "bg-muted [&_svg]:text-muted-foreground group-hover:bg-accent-foreground/15 group-hover:[&_svg]:text-accent-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition-colors",
        className,
      )}
      {...props}
    />
  );
}

function SelectableRowTitle({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="selectable-row-title"
      className={cn("font-medium", className)}
      {...props}
    />
  );
}

function SelectableRowDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="selectable-row-description"
      className={cn(
        "text-muted-foreground group-hover:text-accent-foreground/70 text-sm",
        className,
      )}
      {...props}
    />
  );
}

export {
  SelectableRow,
  SelectableRowIcon,
  SelectableRowTitle,
  SelectableRowDescription,
};
