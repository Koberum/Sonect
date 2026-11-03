import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useLocation, useNavigate } from "react-router-dom";
import { AudioLines, Library, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/features/auth/auth-context";
import { ProfileSwitcher } from "@/features/profiles/profile-switcher";

export interface SidebarProps {
  className?: string;
  toggleSidebar(open: boolean): void;
}

interface SidebarItem {
  href: string;
  match: string;
  labelKey: string;
  icon: typeof AudioLines;
}

export function Sidebar({ className, toggleSidebar }: SidebarProps) {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const items: SidebarItem[] = [
    {
      href: "/home/listen",
      match: "/home",
      labelKey: "nav.home",
      icon: AudioLines,
    },
    {
      href: "/library/albums",
      match: "/library",
      labelKey: "nav.library",
      icon: Library,
    },
    ...(isAdmin
      ? [
          {
            href: "/settings/audio",
            match: "/settings",
            labelKey: "nav.settings",
            icon: Settings,
          },
        ]
      : []),
  ];

  const handleNavigation = (path: string) => {
    navigate(path);
    toggleSidebar(false);
  };

  const isActive = (match: string) =>
    pathname === match || pathname.startsWith(`${match}/`);

  return (
    <div className={cn("flex h-full flex-col pb-24", className)}>
      <nav className="space-y-1 p-3" aria-label={t("nav.label")}>
        {items.map(({ href, match, labelKey, icon: Icon }) => (
          <Button
            key={href}
            onClick={() => handleNavigation(href)}
            variant={isActive(match) ? "secondary" : "ghost"}
            className="w-full justify-start"
            aria-current={isActive(match) ? "page" : undefined}
          >
            <Icon className="mr-2 h-4 w-4" />
            {t(labelKey)}
          </Button>
        ))}
      </nav>
      <div className="mt-auto border-t p-3">
        <ProfileSwitcher />
      </div>
    </div>
  );
}
