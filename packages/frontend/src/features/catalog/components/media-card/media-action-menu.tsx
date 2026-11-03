import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { EllipsisVertical, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface MediaAction {
  key: string;
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  destructive?: boolean;
  separatorBefore?: boolean;
}

export interface MediaActionMenuProps {
  actions: MediaAction[];
  align?: "start" | "end";
}

export function MediaActionMenu({
  actions,
  align = "start",
}: MediaActionMenuProps) {
  const { t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="bare"
          size="icon-sm"
          aria-label={t("common.more")}
          className="bg-background/80 backdrop-blur-sm"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <EllipsisVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-48">
        {actions.map((action) => (
          <Fragment key={action.key}>
            {action.separatorBefore && <DropdownMenuSeparator />}
            <DropdownMenuItem
              className={cn(
                action.destructive && "text-destructive focus:text-destructive",
              )}
              onSelect={() => action.onSelect()}
            >
              {action.icon ? <action.icon /> : null}
              {action.label}
            </DropdownMenuItem>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
