import { CircleHelp, Globe2, Network, Unplug } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { useNetworkStatus } from "./useNetworkStatus";

export function NetworkStatusIndicator() {
  const { t } = useTranslation();
  const status = useNetworkStatus();

  const indicator = !status
    ? {
        label: t("status.networkUnknown"),
        icon: CircleHelp,
        color: "text-muted-foreground",
      }
    : !status.connected
      ? {
          label: t("status.networkDisconnected"),
          icon: Unplug,
          color: "text-destructive",
        }
      : !status.dnsReachable
        ? {
            label: t("status.networkNoDns"),
            icon: Network,
            color: "text-warning",
          }
        : {
            label: t("status.networkConnected"),
            icon: Globe2,
            color: "text-success",
          };

  const Icon = indicator.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          aria-label={indicator.label}
          className="text-muted-foreground size-11 border-0 bg-transparent p-0"
        >
          <Icon className={`size-4 ${indicator.color}`} aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{indicator.label}</TooltipContent>
    </Tooltip>
  );
}
