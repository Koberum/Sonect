import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  AudioLines,
  Library,
  ListMusic,
  ListOrdered,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/components/theme-provider";
import { useAuth } from "@/features/auth/auth-context";
import { isNavItemActive, type NavItem } from "@/layout/nav-items";
import { StatusCenter } from "@/features/status/components/status-center";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface SidebarProps {
  className?: string;
  collapsed?: boolean;
  collapsible?: boolean;
  onToggleCollapse?(): void;
}

export function Sidebar({
  className,
  collapsed = false,
  collapsible = false,
  onToggleCollapse,
}: SidebarProps) {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { theme } = useTheme();
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (event: MediaQueryListEvent) =>
      setSystemDark(event.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const effectiveTheme =
    theme === "system" ? (systemDark ? "dark" : "light") : theme;
  const logoSrc =
    effectiveTheme === "dark"
      ? "/sonect-logo-dark.svg"
      : "/sonect-logo-light.svg";

  const items: NavItem[] = [
    {
      href: "/discover",
      labelKey: "nav.discover",
      icon: AudioLines,
    },
    {
      href: "/library",
      labelKey: "nav.library",
      icon: Library,
    },
    {
      href: "/playlists",
      labelKey: "nav.playlists",
      icon: ListMusic,
    },
    {
      href: "/queue",
      labelKey: "nav.queue",
      icon: ListOrdered,
    },
    ...(isAdmin
      ? [
          {
            href: "/settings",
            labelKey: "nav.settings",
            icon: Settings,
          },
        ]
      : []),
  ];

  const isActive = (href: string) => isNavItemActive(pathname, href);

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <div
        className={cn(
          "flex h-16 shrink-0 items-center gap-2",
          collapsed ? "justify-center px-2" : "justify-between px-5",
        )}
      >
        {!collapsed ? (
          <Link
            to="/discover"
            className="focus-visible:ring-ring rounded-md focus-visible:ring-2 focus-visible:outline-none"
          >
            <img src={logoSrc} alt="Sonect" className="h-8 w-auto" />
          </Link>
        ) : null}
        {collapsible ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="bare"
                size="icon-sm"
                onClick={onToggleCollapse}
                aria-label={t(collapsed ? "nav.expand" : "nav.collapse")}
              >
                {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {t(collapsed ? "nav.expand" : "nav.collapse")}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
        <nav
          className={cn("space-y-1", collapsed ? "p-2" : "p-3")}
          aria-label={t("nav.label")}
        >
          {items.map(({ href, labelKey, icon: Icon }) => {
            const button = (
              <Button
                key={href}
                onClick={() => navigate(href)}
                variant={isActive(href) ? "secondary" : "ghost"}
                className={cn(
                  "w-full",
                  collapsed ? "justify-center px-0" : "justify-start",
                )}
                aria-current={isActive(href) ? "page" : undefined}
                aria-label={t(labelKey)}
              >
                <Icon className={cn(!collapsed && "mr-2")} />
                {!collapsed ? (
                  <span className="truncate">{t(labelKey)}</span>
                ) : null}
              </Button>
            );

            if (!collapsed) return button;

            return (
              <Tooltip key={href}>
                <TooltipTrigger asChild>{button}</TooltipTrigger>
                <TooltipContent side="right">{t(labelKey)}</TooltipContent>
              </Tooltip>
            );
          })}
        </nav>
      </div>
      <StatusCenter collapsed={collapsed} />
    </div>
  );
}
