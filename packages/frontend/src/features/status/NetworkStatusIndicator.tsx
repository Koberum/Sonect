import { CircleHelp, Globe2, Network, Unplug } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
          color: "text-red-500",
        }
      : !status.dnsReachable
        ? {
            label: t("status.networkNoDns"),
            icon: Network,
            color: "text-amber-500",
          }
        : {
            label: t("status.networkConnected"),
            icon: Globe2,
            color: "text-green-500",
          };

  const Icon = indicator.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={indicator.label}
          className="text-muted-foreground inline-flex size-11 items-center justify-center border-0 bg-transparent p-0"
        >
          <Icon className={`size-4 ${indicator.color}`} aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{indicator.label}</TooltipContent>
    </Tooltip>
  );
}
