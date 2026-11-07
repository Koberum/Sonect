import type { LucideIcon } from "lucide-react";
import { AudioLines, Disc3, Library, ListMusic, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/features/auth/auth-context";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  labelKey: string;
  icon: LucideIcon;
};

export function MobileNav() {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const { pathname } = useLocation();

  const items: NavItem[] = [
    { href: "/player", labelKey: "nav.player", icon: Disc3 },
    { href: "/library", labelKey: "nav.library", icon: Library },
    { href: "/queue", labelKey: "nav.queue", icon: ListMusic },
    { href: "/discover", labelKey: "nav.discover", icon: AudioLines },
    ...(isAdmin
      ? [{ href: "/settings", labelKey: "nav.settings", icon: Settings }]
      : []),
  ];

  return (
    <nav
      className="bg-card border-border shrink-0 border-t pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label={t("nav.label")}
    >
      <div className="flex h-14 items-center">
        {items.map(({ href, labelKey, icon: Icon }) => {
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
        })}
      </div>
    </nav>
  );
}
