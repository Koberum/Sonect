import type { LucideIcon } from "lucide-react";
import { AudioLines, Disc3, ListOrdered, Search, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/features/auth/auth-context";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  labelKey: string;
  icon: LucideIcon;
};

export interface MobileNavProps {
  onSearch(): void;
}

export function MobileNav({ onSearch }: MobileNavProps) {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const { pathname } = useLocation();

  const leftItems: NavItem[] = [
    { href: "/player", labelKey: "nav.player", icon: Disc3 },
    { href: "/queue", labelKey: "nav.queue", icon: ListOrdered },
  ];
  const rightItems: NavItem[] = [
    { href: "/discover", labelKey: "nav.discover", icon: AudioLines },
    ...(isAdmin
      ? [{ href: "/settings", labelKey: "nav.settings", icon: Settings }]
      : []),
  ];

  const renderLink = ({ href, labelKey, icon: Icon }: NavItem) => {
    const isActive = pathname === href || pathname.startsWith(`${href}/`);
    return (
      <Link
        key={href}
        to={href}
        aria-label={t(labelKey)}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "focus-visible:ring-ring flex h-full flex-1 items-center justify-center transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset",
          isActive
            ? "text-primary"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Icon className="size-5" />
      </Link>
    );
  };

  return (
    <nav
      className="bg-card border-border shrink-0 border-t pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label={t("nav.label")}
    >
      <div className="flex h-14 items-center">
        <div className="flex flex-1 items-center">
          {leftItems.map(renderLink)}
        </div>
        <button
          type="button"
          onClick={onSearch}
          aria-label={t("search.open")}
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring flex h-full w-16 shrink-0 items-center justify-center transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
        >
          <Search className="size-5" />
        </button>
        <div className="flex flex-1 items-center">
          {rightItems.map(renderLink)}
        </div>
      </div>
    </nav>
  );
}
