import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

export interface SectionTab {
  href: string;
  labelKey: string;
  badge?: number;
}

function isSectionTabActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export interface SectionTabsProps {
  tabs: SectionTab[];
  label: string;
}

export function SectionTabs({ tabs, label }: SectionTabsProps) {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  return (
    <nav
      aria-label={label}
      className="no-scrollbar mb-6 flex gap-1 overflow-x-auto border-b"
    >
      {tabs.map((tab) => {
        const active = isSectionTabActive(pathname, tab.href);
        return (
          <Link
            key={tab.href}
            to={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "text-muted-foreground hover:text-foreground after:bg-foreground relative inline-flex h-9 shrink-0 items-center gap-1.5 px-3 text-sm font-medium whitespace-nowrap transition-colors",
              "after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:opacity-0 after:transition-opacity",
              active && "text-foreground after:opacity-100",
            )}
          >
            {t(tab.labelKey)}
            {typeof tab.badge === "number" && tab.badge > 0 ? (
              <span className="text-muted-foreground text-xs tabular-nums">
                {tab.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
