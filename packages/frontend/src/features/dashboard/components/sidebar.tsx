import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AudioLines, Library, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/components/theme-provider";
import { useAuth } from "@/features/auth/auth-context";

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
    <div className={cn("flex h-full flex-col", className)}>
      <div className="flex h-16 shrink-0 items-center px-5">
        <Link
          to="/home/listen"
          onClick={() => toggleSidebar(false)}
          className="focus-visible:ring-ring rounded-md focus-visible:ring-2 focus-visible:outline-none"
        >
          <img src={logoSrc} alt="Sonect" className="h-8 w-auto" />
        </Link>
      </div>
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
    </div>
  );
}
