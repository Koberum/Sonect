import { MenuIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export default function SidebarToggler({
  isOpen,
  toggleSidebar,
}: {
  isOpen: boolean;
  toggleSidebar: (open: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => toggleSidebar(!isOpen)}
      aria-label={t("sidebar.toggleSidebar")}
    >
      <MenuIcon />
    </Button>
  );
}
