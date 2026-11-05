import MusicPlayer from "@/features/player/components/music-player";
import { Sidebar } from "@/layout/sidebar";
import { SectionToolbar } from "@/components/section-toolbar";
import { SectionContentSkeleton } from "@/components/section-tabs";
import { SetupGuard } from "@/components/setup-guard";
import { Suspense, useCallback, useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { useMediaQuery } from "react-responsive";
import { Toaster } from "@/components/ui/sonner";
import { SyncIndicator } from "@/features/sync/components/sync-indicator";
import { PlaylistDropProvider } from "@/features/playlists/components/playlist-drop-provider";
import { cn } from "@/lib/utils";

export default function MainLayout() {
  const isMobile = useMediaQuery({ maxWidth: 767 });
  const isCompactSidebar = useMediaQuery({ minWidth: 768, maxWidth: 1279 });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem("sonect.sidebar.collapsed") === "1",
  );
  const openSidebar = useCallback(() => setSidebarOpen(true), []);
  const toggleCollapse = useCallback(
    () => setSidebarCollapsed((collapsed) => !collapsed),
    [],
  );
  const collapsed = isCompactSidebar || sidebarCollapsed;

  useEffect(() => {
    localStorage.setItem(
      "sonect.sidebar.collapsed",
      sidebarCollapsed ? "1" : "0",
    );
  }, [sidebarCollapsed]);

  return (
    <PlaylistDropProvider>
      <div className="flex h-dvh flex-col overflow-hidden">
        <div className="flex flex-1 overflow-hidden">
          <aside
            className={cn(
              "hidden shrink-0 flex-col overflow-hidden border-r transition-[width] duration-300 ease-in-out md:flex",
              collapsed ? "w-16" : "w-52",
            )}
          >
            <Sidebar
              toggleSidebar={() => {}}
              className="no-scrollbar flex-1 overflow-y-auto"
              collapsed={collapsed}
              collapsible={!isCompactSidebar}
              onToggleCollapse={toggleCollapse}
            />
          </aside>

          {isMobile && (
            <>
              <div
                className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${
                  sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
                }`}
                onClick={() => setSidebarOpen(false)}
              />
              <aside
                className={`bg-background fixed inset-y-0 left-0 z-50 w-52 transition-transform duration-300 ease-in-out ${
                  sidebarOpen ? "translate-x-0" : "-translate-x-full"
                }`}
              >
                <Sidebar
                  toggleSidebar={setSidebarOpen}
                  className="no-scrollbar h-full overflow-y-auto border-r"
                />
              </aside>
            </>
          )}

          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <main className="no-scrollbar flex-1 overflow-y-auto">
              <div className="px-4 pt-4 pb-12 sm:px-4 lg:px-8">
                <SetupGuard>
                  <SectionToolbar onOpenSidebar={openSidebar} />
                  <Suspense fallback={<SectionContentSkeleton />}>
                    <Outlet />
                  </Suspense>
                  <Toaster />
                </SetupGuard>
              </div>
            </main>
            <MusicPlayer />
          </div>
        </div>

        <SyncIndicator />
      </div>
    </PlaylistDropProvider>
  );
}
