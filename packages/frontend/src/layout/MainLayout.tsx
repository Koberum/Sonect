import { Menu } from "@/features/dashboard/components/menu";
import MusicPlayer from "@/features/dashboard/components/music-player";
import { Sidebar } from "@/features/dashboard/components/sidebar";
import { SetupGuard } from "@/components/setup-guard";
import { useState } from "react";
import { Outlet } from "react-router-dom";
import { useMediaQuery } from "react-responsive";
import { Toaster } from "@/components/ui/sonner";
import { ConnectionBanner } from "@/features/status/ConnectionBanner";

export default function MainLayout() {
  const isMobile = useMediaQuery({ maxWidth: 767 });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <ConnectionBanner />
      <Menu isOpen={sidebarOpen} toggleSidebar={setSidebarOpen} />

      <div className="flex flex-1 overflow-hidden border-t">
        <aside className="hidden w-64 shrink-0 flex-col border-r md:flex">
          <Sidebar
            toggleSidebar={() => {}}
            className="no-scrollbar flex-1 overflow-y-auto"
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
              className={`bg-background fixed inset-y-0 left-0 z-50 w-64 transition-transform duration-300 ease-in-out ${
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

        <main className="no-scrollbar flex-1 overflow-y-auto">
          <div className="px-4 pb-24 sm:px-4 lg:px-8">
            <SetupGuard>
              <Outlet />
              <Toaster />
            </SetupGuard>
          </div>
        </main>
      </div>

      <MusicPlayer />
    </div>
  );
}
