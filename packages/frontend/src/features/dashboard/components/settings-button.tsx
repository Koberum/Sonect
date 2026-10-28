import { Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/features/auth/auth-context";

export function SettingsButton() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  if (!isAdmin) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="bare"
          aria-label={t("settings.title")}
          className="text-muted-foreground size-11 border-0 bg-transparent p-0"
          onClick={() => navigate("/settings")}
        >
          <Settings className="size-4" aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{t("settings.title")}</TooltipContent>
    </Tooltip>
  );
}
