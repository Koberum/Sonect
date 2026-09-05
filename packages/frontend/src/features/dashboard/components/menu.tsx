import { Menubar } from "@/components/ui/menubar";
import SidebarToggler from "@/components/sidebar-toggler";
import { useEffect, useState } from "react";
import { SearchCommand } from "@/features/dashboard/components/search-command";
import { useTheme } from "@/components/theme-provider";
import { usePlaybackContext } from "@/components/playback-context";
import { StatusBar } from "./status-bar";
import { NetworkStatusIndicator } from "@/features/status/NetworkStatusIndicator";

export interface MenuProps {
  isOpen?: boolean;
  toggleSidebar(open: boolean): void;
}

export function Menu({ isOpen, toggleSidebar }: MenuProps) {
  const { theme } = useTheme();
  const { syncProgress } = usePlaybackContext();
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const effectiveTheme =
    theme === "system" ? (systemDark ? "dark" : "light") : theme;
  const logoSrc =
    effectiveTheme === "dark"
      ? "/sonect-logo-dark.svg"
      : "/sonect-logo-light.svg";

  return (
    <Menubar
      className={`flex items-center justify-between rounded-none px-2 md:px-6 lg:px-4${syncProgress ? "min-h-[72px]" : ""}`}
    >
      <div className="flex flex-1 items-center gap-2">
        <div className="md:hidden">
          <SidebarToggler isOpen={!!isOpen} toggleSidebar={toggleSidebar} />
        </div>
        <div className="md:hidden">
          <SearchCommand />
        </div>
        <img
          src={logoSrc}
          alt="Sonect"
          className="hidden h-8 w-auto md:block"
        />
      </div>
      <div className="flex flex-1 items-center justify-center">
        <div className="hidden md:block">
          <SearchCommand />
        </div>
      </div>
      <div className="flex flex-1 items-center justify-end gap-2">
        <div className="hidden md:block">
          <StatusBar />
        </div>
        <div className="hidden md:flex">
          <NetworkStatusIndicator />
        </div>
      </div>
    </Menubar>
  );
}
