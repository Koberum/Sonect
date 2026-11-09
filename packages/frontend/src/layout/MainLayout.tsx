import MusicPlayer from "@/features/player/components/music-player";
import { AutoplayNotice } from "@/features/player/components/autoplay-notice";
import { PlayerEngineProvider } from "@/features/player/player-engine-context";
import { MobileNav } from "@/layout/mobile-nav";
import { Sidebar } from "@/layout/sidebar";
import { SectionToolbar } from "@/components/section-toolbar";
import { SectionContentSkeleton } from "@/components/section-tabs";
import { SetupGuard } from "@/components/setup-guard";
import { Suspense, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useMediaQuery } from "react-responsive";
import { useTranslation } from "react-i18next";
import { Toaster } from "@/components/ui/sonner";
import { MobileStatusCenter } from "@/features/status/components/mobile-status-center";
import { PlaylistDropProvider } from "@/features/playlists/components/playlist-drop-provider";
import { SearchCommand } from "@/features/search/components/search-command";
import { cn } from "@/lib/utils";

export default function MainLayout() {
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const isPlayerRoute = pathname === "/player" || pathname === "/player/";
  const isMobile = useMediaQuery({ maxWidth: 767.98 });
  const isCompactSidebar = useMediaQuery({ minWidth: 768, maxWidth: 1279 });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem("sonect.sidebar.collapsed") === "1",
  );
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const toggleCollapse = () => setSidebarCollapsed((collapsed) => !collapsed);
  const collapsed = isCompactSidebar || sidebarCollapsed;

  useEffect(() => {
    localStorage.setItem(
      "sonect.sidebar.collapsed",
      sidebarCollapsed ? "1" : "0",
    );
  }, [sidebarCollapsed]);

  useEffect(() => {
    setMobileSearchOpen(false);
  }, [pathname]);

  useEffect(() => {
    const section = pathname.startsWith("/library")
      ? "library"
      : pathname.startsWith("/playlists")
        ? "playlists"
        : pathname.startsWith("/player")
          ? "player"
          : pathname.startsWith("/queue")
            ? "queue"
            : pathname.startsWith("/settings")
              ? "settings"
              : pathname.startsWith("/discover")
                ? "discover"
                : null;
    document.title = section ? `Sonect · ${t(`nav.${section}`)}` : "Sonect";
  }, [pathname, t]);

  return (
    <PlaylistDropProvider>
      <PlayerEngineProvider>
        <div className="flex h-dvh flex-col overflow-hidden">
          <div className="flex flex-1 overflow-hidden">
            <aside
              className={cn(
                "hidden shrink-0 flex-col overflow-hidden border-r transition-[width] duration-300 ease-in-out md:flex",
                collapsed ? "w-16" : "w-52",
              )}
            >
              <Sidebar
                className="flex-1"
                collapsed={collapsed}
                collapsible={!isCompactSidebar}
                onToggleCollapse={toggleCollapse}
              />
            </aside>

            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              {isPlayerRoute ? (
                <main className="min-h-0 flex-1 overflow-hidden">
                  <div className="h-full">
                    <SetupGuard>
                      <Suspense fallback={<SectionContentSkeleton />}>
                        <Outlet />
                      </Suspense>
                    </SetupGuard>
                  </div>
                </main>
              ) : (
                <main className="no-scrollbar flex-1 overflow-y-auto">
                  <div className="px-4 pt-4 pb-12 sm:px-4 lg:px-8">
                    <SetupGuard>
                      {!isMobile && <SectionToolbar />}
                      <Suspense fallback={<SectionContentSkeleton />}>
                        <Outlet />
                      </Suspense>
                    </SetupGuard>
                  </div>
                </main>
              )}

              {!isMobile && <MusicPlayer />}
              {isMobile && (
                <MobileNav onSearch={() => setMobileSearchOpen(true)} />
              )}
              {isMobile && (
                <SearchCommand
                  variant="overlay"
                  open={mobileSearchOpen}
                  onOpenChange={setMobileSearchOpen}
                />
              )}
              <Toaster />
            </div>
          </div>

          {isMobile && <MobileStatusCenter />}
          <AutoplayNotice />
        </div>
      </PlayerEngineProvider>
    </PlaylistDropProvider>
  );
}
