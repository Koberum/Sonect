import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const { t } = useTranslation();

  return (
    <EmptyState
      icon={Compass}
      title={t("notFound.title")}
      description={t("notFound.description")}
      action={
        <Button asChild variant="outline" size="sm">
          <Link to="/discover">{t("notFound.back")}</Link>
        </Button>
      }
    />
  );
}
