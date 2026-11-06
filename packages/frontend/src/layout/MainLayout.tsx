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
import { Toaster } from "@/components/ui/sonner";
import { SyncIndicator } from "@/features/sync/components/sync-indicator";
import { PlaylistDropProvider } from "@/features/playlists/components/playlist-drop-provider";
import { cn } from "@/lib/utils";

export default function MainLayout() {
  const { pathname } = useLocation();
  const isPlayerRoute = pathname === "/player";
  const isMobile = useMediaQuery({ maxWidth: 767 });
  const isCompactSidebar = useMediaQuery({ minWidth: 768, maxWidth: 1279 });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem("sonect.sidebar.collapsed") === "1",
  );
  const toggleCollapse = () => setSidebarCollapsed((collapsed) => !collapsed);
  const collapsed = isCompactSidebar || sidebarCollapsed;

  useEffect(() => {
    localStorage.setItem(
      "sonect.sidebar.collapsed",
      sidebarCollapsed ? "1" : "0",
    );
  }, [sidebarCollapsed]);

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
                className="no-scrollbar flex-1 overflow-y-auto"
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
                      <SectionToolbar />
                      <Suspense fallback={<SectionContentSkeleton />}>
                        <Outlet />
                      </Suspense>
                    </SetupGuard>
                  </div>
                </main>
              )}

              {!isMobile && <MusicPlayer />}
              {isMobile && <MobileNav />}
              <Toaster />
            </div>
          </div>

          <SyncIndicator />
          <AutoplayNotice />
        </div>
      </PlayerEngineProvider>
    </PlaylistDropProvider>
  );
}
