import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "@/components/ui/menubar";
import SidebarToggler from "@/components/sidebar-toggler";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { SearchCommand } from "@/features/dashboard/components/search-command";
import { getMpdStatus, restartMpd, stopMpd } from "@/features/apis/systemApis";
import { scanLibrary, syncImages } from "@/features/apis/libraryApis";
import {
  Check,
  ImageIcon,
  Loader2,
  Monitor,
  Moon,
  RefreshCw,
  Settings,
  Sun,
} from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { usePlaybackContext } from "@/components/playback-context";
import { StatusBar } from "./status-bar";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { AudioTab } from "@/features/settings/audio-tab";
import { NetworkTab } from "@/features/settings/network-tab";
import { StorageTab } from "@/features/settings/storage-tab";
import { MpdConfigTab } from "@/features/settings/mpd-config-tab";
import { DebugTab } from "@/features/settings/debug-tab";
import { HardwareMonitor } from "@/components/hardware-monitor";

export interface MenuProps {
  isOpen?: boolean;
  toggleSidebar(open: boolean): void;
}

export function Menu({ isOpen, toggleSidebar }: MenuProps) {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
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

  const [activeDialog, setActiveDialog] = useState<string | null>(null);
  const [isLibraryUpdating, setIsLibraryUpdating] = useState(false);
  const [showRestartMpdDialog, setShowRestartMpdDialog] = useState(false);
  const [showStopMpdDialog, setShowStopMpdDialog] = useState(false);

  const doSync = async (fn: () => Promise<void>) => {
    setIsLibraryUpdating(true);
    try {
      await fn();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("sync.failed", "Sync failed"),
      );
    } finally {
      setIsLibraryUpdating(false);
    }
  };

  const handleSyncAll = () => doSync(scanLibrary);
  const handleSyncImages = () => doSync(syncImages);

  const handleCheckMpdStatus = async () => {
    try {
      const status = await getMpdStatus();
      if (status.running) {
        toast.success(t("menu.debugMenu.mpdRunning"));
      } else {
        toast.error(status.error ?? t("menu.debugMenu.mpdStopped"));
      }
    } catch {
      toast.error(t("settings.debug.checkError", "Failed to check MPD status"));
    }
  };

  const handleRestartMpd = async () => {
    setShowRestartMpdDialog(false);
    try {
      const result = await restartMpd();
      toast[result.success ? "success" : "warning"](
        result.success
          ? t("menu.debugMenu.mpdRestarted")
          : (result.warning ?? ""),
      );
    } catch {
      toast.error(t("settings.debug.restartError", "Failed to restart MPD"));
    }
  };

  const handleStopMpd = async () => {
    setShowStopMpdDialog(false);
    try {
      const result = await stopMpd();
      toast[result.success ? "success" : "warning"](
        result.success
          ? t("menu.debugMenu.mpdStoppedAction")
          : (result.warning ?? ""),
      );
    } catch {
      toast.error(t("settings.debug.stopError", "Failed to stop MPD"));
    }
  };

  return (
    <>
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
          <MenubarMenu>
            <MenubarTrigger className="text-muted-foreground hover:text-foreground data-[state=open]:text-foreground cursor-pointer rounded-md p-2">
              <Settings className="h-4 w-4" />
            </MenubarTrigger>
            <MenubarContent align="end">
              <MenubarItem onClick={() => setActiveDialog("audio")}>
                {t("settings.tabs.audio")}
              </MenubarItem>
              <MenubarItem onClick={() => setActiveDialog("network")}>
                {t("settings.tabs.network")}
              </MenubarItem>
              <MenubarItem onClick={() => setActiveDialog("storage")}>
                {t("settings.tabs.storage")}
              </MenubarItem>
              <MenubarSub>
                <MenubarSubTrigger>{t("menu.library")}</MenubarSubTrigger>
                <MenubarSubContent>
                  <MenubarItem
                    onClick={handleSyncAll}
                    disabled={isLibraryUpdating}
                  >
                    {isLibraryUpdating ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    {t("settings.library.syncAll")}
                  </MenubarItem>
                  <MenubarItem
                    onClick={handleSyncImages}
                    disabled={isLibraryUpdating}
                  >
                    {isLibraryUpdating ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ImageIcon className="mr-2 h-4 w-4" />
                    )}
                    {t("settings.library.syncImages")}
                  </MenubarItem>
                </MenubarSubContent>
              </MenubarSub>
              <MenubarSub>
                <MenubarSubTrigger>
                  {t("menu.settingsMenu.theme")}
                </MenubarSubTrigger>
                <MenubarSubContent>
                  <MenubarItem
                    onClick={() => setTheme("light")}
                    aria-label={t("theme.light")}
                  >
                    {theme === "light" ? (
                      <Check className="mr-2 h-4 w-4" />
                    ) : (
                      <div className="mr-2 h-4 w-4" />
                    )}
                    <Sun className="mr-2 h-4 w-4" />
                    {t("theme.light")}
                  </MenubarItem>
                  <MenubarItem
                    onClick={() => setTheme("dark")}
                    aria-label={t("theme.dark")}
                  >
                    {theme === "dark" ? (
                      <Check className="mr-2 h-4 w-4" />
                    ) : (
                      <div className="mr-2 h-4 w-4" />
                    )}
                    <Moon className="mr-2 h-4 w-4" />
                    {t("theme.dark")}
                  </MenubarItem>
                  <MenubarItem
                    onClick={() => setTheme("system")}
                    aria-label={t("theme.system")}
                  >
                    {theme === "system" ? (
                      <Check className="mr-2 h-4 w-4" />
                    ) : (
                      <div className="mr-2 h-4 w-4" />
                    )}
                    <Monitor className="mr-2 h-4 w-4" />
                    {t("theme.system")}
                  </MenubarItem>
                </MenubarSubContent>
              </MenubarSub>
              <MenubarSub>
                <MenubarSubTrigger>
                  {t("menu.settingsMenu.language")}
                </MenubarSubTrigger>
                <MenubarSubContent>
                  <MenubarItem
                    onClick={() => {
                      i18n.changeLanguage("en");
                      localStorage.setItem("language", "en");
                    }}
                    aria-label={t("language.en")}
                  >
                    {i18n.language.startsWith("en") ? (
                      <Check className="mr-2 h-4 w-4" />
                    ) : (
                      <div className="mr-2 h-4 w-4" />
                    )}
                    {t("language.en")}
                  </MenubarItem>
                  <MenubarItem
                    onClick={() => {
                      i18n.changeLanguage("es");
                      localStorage.setItem("language", "es");
                    }}
                    aria-label={t("language.es")}
                  >
                    {i18n.language.startsWith("es") ? (
                      <Check className="mr-2 h-4 w-4" />
                    ) : (
                      <div className="mr-2 h-4 w-4" />
                    )}
                    {t("language.es")}
                  </MenubarItem>
                  <MenubarItem
                    onClick={() => {
                      i18n.changeLanguage("it");
                      localStorage.setItem("language", "it");
                    }}
                    aria-label={t("language.it")}
                  >
                    {i18n.language.startsWith("it") ? (
                      <Check className="mr-2 h-4 w-4" />
                    ) : (
                      <div className="mr-2 h-4 w-4" />
                    )}
                    {t("language.it")}
                  </MenubarItem>
                </MenubarSubContent>
              </MenubarSub>
              <MenubarItem onClick={() => setActiveDialog("config")}>
                {t("settings.tabs.config")}
              </MenubarItem>
              <MenubarSeparator />
              <MenubarSub>
                <MenubarSubTrigger>{t("menu.debug")}</MenubarSubTrigger>
                <MenubarSubContent>
                  <MenubarItem onClick={handleCheckMpdStatus}>
                    {t("menu.debugMenu.mpdStatus")}
                  </MenubarItem>
                  <MenubarItem onClick={() => setShowRestartMpdDialog(true)}>
                    {t("menu.debugMenu.restartMpd")}
                  </MenubarItem>
                  <MenubarItem onClick={() => setShowStopMpdDialog(true)}>
                    {t("menu.debugMenu.stopMpd")}
                  </MenubarItem>
                  <MenubarSeparator />
                  <MenubarItem onClick={() => setActiveDialog("environment")}>
                    {t("menu.debugMenu.environment")}
                  </MenubarItem>
                  <MenubarItem onClick={() => setActiveDialog("hardware")}>
                    {t("menu.debugMenu.hardware")}
                  </MenubarItem>
                </MenubarSubContent>
              </MenubarSub>
            </MenubarContent>
          </MenubarMenu>
        </div>
      </Menubar>

      <Dialog
        open={activeDialog !== null}
        onOpenChange={(open) => {
          if (!open) setActiveDialog(null);
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          {activeDialog === "audio" && <AudioTab />}
          {activeDialog === "network" && <NetworkTab />}
          {activeDialog === "storage" && <StorageTab />}

          {activeDialog === "config" && <MpdConfigTab />}
          {activeDialog === "debug" && <DebugTab />}
          {activeDialog === "environment" && (
            <div className="p-4">
              <h2 className="mb-4 text-lg font-semibold">
                {t("menu.debugMenu.environment")}
              </h2>
              <pre className="bg-muted max-h-64 overflow-auto rounded-md p-3 text-xs">
                {JSON.stringify(
                  {
                    MODE: import.meta.env.MODE,
                    DEV: import.meta.env.DEV,
                    PROD: import.meta.env.PROD,
                    VITE_DEBUG: import.meta.env.VITE_DEBUG,
                  },
                  null,
                  2,
                )}
              </pre>
            </div>
          )}
          {activeDialog === "hardware" && (
            <div className="p-4">
              <h2 className="mb-4 text-lg font-semibold">
                {t("menu.debugMenu.hardware")}
              </h2>
              <HardwareMonitor />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={showRestartMpdDialog}
        onOpenChange={setShowRestartMpdDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("settings.debug.restartConfirmTitle", "Restart MPD?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "settings.debug.restartConfirm",
                "This will restart MPD and interrupt playback. Continue?",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("common.cancel", "Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleRestartMpd}>
              {t("menu.debugMenu.restartMpd")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showStopMpdDialog} onOpenChange={setShowStopMpdDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("settings.debug.stopConfirmTitle", "Stop MPD?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings.debug.stopConfirm", "This will stop MPD. Continue?")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("common.cancel", "Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleStopMpd}>
              {t("menu.debugMenu.stopMpd")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
