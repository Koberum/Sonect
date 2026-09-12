import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  MicVocal,
  ListMusic,
  Plus,
  Library,
  Music,
  Disc3,
  RefreshCw,
  AudioLines,
  Settings,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePlaylistContext } from "@/components/playlist-context";
import { usePlaybackContext } from "@/components/playback-context";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createPlaylist } from "@/features/apis/playlistApis";
import { getLibraryStats, scanLibrary } from "@/features/apis/catalogApis";
import type { LibraryStats } from "@repo/types/catalog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface SidebarProps {
  className?: string;
  toggleSidebar(open: boolean): void;
}

export function Sidebar({ className, toggleSidebar }: SidebarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { playlists, refresh } = usePlaylistContext();
  usePlaybackContext();
  const [newName, setNewName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [libraryStats, setLibraryStats] = useState<LibraryStats | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    getLibraryStats()
      .then(setLibraryStats)
      .catch(() => {});
  }, []);

  const handleNavigation = (path: string) => {
    navigate(path);
    toggleSidebar(false);
  };

  const isMenuActive = (path: string) => {
    return window.location.pathname === path;
  };

  const handleRefreshLibrary = async () => {
    setIsRefreshing(true);
    try {
      await scanLibrary();
    } catch {
      // error handled via WS sync-error broadcast
    }
    setIsRefreshing(false);
  };

  const handleCreatePlaylist = async () => {
    if (!newName.trim()) return;
    try {
      await createPlaylist(newName.trim());
      setNewName("");
      setDialogOpen(false);
      await refresh();
    } catch {
      console.error(t("playlist.createError"));
    }
  };

  return (
    <div className={cn("pb-12", className)}>
      <div className="space-y-4 py-4">
        <div className="px-3 py-2">
          <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
            {t("sidebar.discover")}
          </h2>
          <div className="space-y-1">
            <Button
              onClick={() => handleNavigation("/")}
              variant={isMenuActive("/") ? "secondary" : "ghost"}
              className="w-full justify-start"
            >
              <AudioLines className="mr-2 h-4 w-4" fill="currentColor" />
              {t("sidebar.listenNow")}
            </Button>
          </div>
        </div>
        <div className="px-3 py-2">
          <div className="mb-2 flex items-center justify-between px-4">
            <h2 className="text-lg font-semibold tracking-tight">
              {t("sidebar.library")}
            </h2>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleRefreshLibrary}
                  disabled={isRefreshing}
                >
                  <RefreshCw
                    className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {isRefreshing
                  ? t("sidebar.refreshingLibrary")
                  : t("sidebar.refreshLibrary")}
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="space-y-1">
            <Button
              onClick={() => handleNavigation("/albums")}
              variant={isMenuActive("/albums") ? "secondary" : "ghost"}
              className="w-full justify-start"
            >
              <Library className="mr-2 h-4 w-4" />
              {t("albums.title")}
            </Button>
            <Button
              onClick={() => handleNavigation("/tracks")}
              variant={isMenuActive("/tracks") ? "secondary" : "ghost"}
              className="w-full justify-start"
            >
              <Music className="mr-2 h-4 w-4" />
              {t("tracks.title")}
            </Button>
            <Button
              onClick={() => handleNavigation("/genres")}
              variant={isMenuActive("/genres") ? "secondary" : "ghost"}
              className="w-full justify-start"
            >
              <Disc3 className="mr-2 h-4 w-4" />
              {t("genres.title")}
            </Button>
            <Button
              onClick={() => handleNavigation("/artists")}
              variant={isMenuActive("/artists") ? "secondary" : "ghost"}
              className="w-full justify-start"
            >
              <MicVocal className="mr-2 h-4 w-4" />
              {t("sidebar.artists")}
            </Button>
            <Button
              onClick={() => handleNavigation("/catalog/stats")}
              variant={isMenuActive("/catalog/stats") ? "secondary" : "ghost"}
              className="w-full justify-start"
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              {t("sidebar.statistics")}
            </Button>
          </div>
        </div>
        <div className="px-3 py-2">
          <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
            {t("sidebar.settings")}
          </h2>
          <div className="space-y-1">
            <Button
              onClick={() => handleNavigation("/settings")}
              variant={isMenuActive("/settings") ? "secondary" : "ghost"}
              className="w-full justify-start"
            >
              <Settings className="mr-2 h-4 w-4" />
              {t("sidebar.settings")}
            </Button>
          </div>
        </div>
        <div className="px-3 py-2">
          <div className="mb-2 flex items-center justify-between px-4">
            <h2 className="text-lg font-semibold tracking-tight">
              {t("sidebar.playlists")}
            </h2>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {t("playlist.new")}
                </TooltipContent>
              </Tooltip>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("playlist.new")}</DialogTitle>
                </DialogHeader>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleCreatePlaylist();
                  }}
                  className="space-y-4"
                >
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={t("playlist.namePlaceholder")}
                    autoFocus
                  />
                  <Button type="submit" className="w-full">
                    {t("playlist.create")}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          <ScrollArea className="max-h-[40vh]">
            <div className="space-y-1 pr-3">
              {playlists.map((playlist) => (
                <Tooltip key={playlist.id}>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={() =>
                        handleNavigation(`/playlists/${playlist.id}`)
                      }
                      variant={
                        isMenuActive(`/playlists/${playlist.id}`)
                          ? "secondary"
                          : "ghost"
                      }
                      className="w-full justify-start"
                    >
                      <ListMusic className="mr-2 h-4 w-4 shrink-0" />
                      <span className="truncate">{playlist.name}</span>
                    </Button>
                  </TooltipTrigger>
                  {playlist.name.length > 20 && (
                    <TooltipContent side="right">
                      {playlist.name}
                    </TooltipContent>
                  )}
                </Tooltip>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>
      {libraryStats && !isMenuActive("/catalog/stats") && (
        <div className="border-t px-3 py-3">
          <p className="text-muted-foreground text-xs">
            {t("sidebar.libraryInfo", {
              tracks: libraryStats.totalTracks,
              albums: libraryStats.totalAlbums,
              artists: libraryStats.totalArtists,
            })}
          </p>
        </div>
      )}
    </div>
  );
}
