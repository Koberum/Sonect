import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useOutletContext } from "react-router-dom";
import { MenuIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchCommand } from "@/features/dashboard/components/search-command";
import { ProfileSwitcher } from "@/features/profiles/profile-switcher";

export interface SidebarOutletContext {
  openSidebar: () => void;
}

type HistoryState = { idx?: number } | null;

function useCanGoBack(): boolean {
  const { key } = useLocation();
  if (!key) return false;
  // window.history.state.idx is set by React Router for each entry; there is
  // no public API to know whether a forward entry exists.
  return ((window.history.state as HistoryState)?.idx ?? 0) > 0;
}

export function SectionToolbar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const context = useOutletContext<SidebarOutletContext | null>();
  const canGoBack = useCanGoBack();

  return (
    <div className="mb-6 flex items-center gap-2 border-b pb-3">
      <Button
        variant="bare"
        size="icon-sm"
        className="md:hidden"
        onClick={() => context?.openSidebar()}
        aria-label={t("sidebar.toggleSidebar")}
      >
        <MenuIcon />
      </Button>

      <div className="flex items-center gap-1">
        <Button
          variant="bare"
          size="icon-sm"
          onClick={() => navigate(-1)}
          disabled={!canGoBack}
          aria-label={t("nav.back")}
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="bare"
          size="icon-sm"
          onClick={() => navigate(1)}
          aria-label={t("nav.forward")}
        >
          <ChevronRight />
        </Button>
      </div>

      <div className="min-w-0 flex-1">
        <SearchCommand />
      </div>

      <ProfileSwitcher />
    </div>
  );
}
