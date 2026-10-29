import { useState, type DragEvent } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  MicVocal,
  ListMusic,
  Plus,
  Library,
  Heart,
  Disc3,
  LoaderCircle,
  AudioLines,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  playlistQueries,
  playlistMutations,
} from "@/features/playlists/queries";
import {
  getDraggedTrackId,
  isTrackDrag,
} from "@/features/playlists/track-drag";
import { likedQueries } from "@/features/liked/queries";
import { scanLibrary } from "@/features/catalog/api";
import { useAuth } from "@/features/auth/auth-context";
import { toast } from "sonner";

export interface SidebarProps {
  className?: string;
  toggleSidebar(open: boolean): void;
}

export function Sidebar({ className, toggleSidebar }: SidebarProps) {
  const { t } = useTranslation();
  const { isAdmin, profile } = useAuth();
  const navigate = useNavigate();
  const { data: playlists = [] } = useQuery(playlistQueries.list());
  const { data: likedIds = [] } = useQuery(likedQueries.ids(profile?.id ?? ""));
  const createMut = useMutation(playlistMutations.create());
  const addTrackMut = useMutation(playlistMutations.addTrack());
  const [newName, setNewName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dragOverPlaylistId, setDragOverPlaylistId] = useState<number | null>(
    null,
  );

  const handlePlaylistDragOver = (
    event: DragEvent<HTMLButtonElement>,
    playlistId: number,
  ) => {
    if (!isTrackDrag(event.dataTransfer)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    if (dragOverPlaylistId !== playlistId) {
      setDragOverPlaylistId(playlistId);
    }
  };

  const handlePlaylistDragLeave = (
    event: DragEvent<HTMLButtonElement>,
    playlistId: number,
  ) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null))
      return;
    setDragOverPlaylistId((current) =>
      current === playlistId ? null : current,
    );
  };

  const handlePlaylistDrop = async (
    event: DragEvent<HTMLButtonElement>,
    playlistId: number,
  ) => {
    if (!isTrackDrag(event.dataTransfer)) return;
    event.preventDefault();
    setDragOverPlaylistId(null);
    const trackId = getDraggedTrackId(event.dataTransfer);
    if (trackId === null) return;
    try {
      await addTrackMut.mutateAsync({ playlistId, trackId });
      toast(t("playlist.trackAdded"));
    } catch {
      toast(t("playlist.trackAddError"));
    }
  };

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
      await createMut.mutateAsync({ name: newName.trim() });
      setNewName("");
      setDialogOpen(false);
    } catch {
      // mutation state surfaces the error inside the dialog
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
            {isAdmin && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="bare"
                    size="icon-sm"
                    onClick={handleRefreshLibrary}
                    disabled={isRefreshing}
                    aria-label={t("sidebar.refreshLibrary")}
                  >
                    <LoaderCircle
                      className={isRefreshing ? "animate-spin" : ""}
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {isRefreshing
                    ? t("sidebar.refreshingLibrary")
                    : t("sidebar.refreshLibrary")}
                </TooltipContent>
              </Tooltip>
            )}
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
              onClick={() => handleNavigation("/liked")}
              variant={isMenuActive("/liked") ? "secondary" : "ghost"}
              className="w-full justify-start"
            >
              <Heart className="mr-2 h-4 w-4" />
              {t("liked.title")}
              {likedIds.length > 0 && (
                <span className="text-muted-foreground ml-auto text-xs">
                  {likedIds.length}
                </span>
              )}
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
              onClick={() => handleNavigation("/library/stats")}
              variant={isMenuActive("/library/stats") ? "secondary" : "ghost"}
              className="w-full justify-start"
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              {t("sidebar.statistics")}
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
                    <Button
                      variant="bare"
                      size="icon-sm"
                      aria-label={t("playlist.new")}
                    >
                      <Plus />
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
                      className={cn(
                        "w-full justify-start",
                        dragOverPlaylistId === playlist.id &&
                          "ring-primary bg-primary/10 ring-2",
                      )}
                      onDragOver={(event) =>
                        handlePlaylistDragOver(event, playlist.id)
                      }
                      onDragLeave={(event) =>
                        handlePlaylistDragLeave(event, playlist.id)
                      }
                      onDrop={(event) => {
                        void handlePlaylistDrop(event, playlist.id);
                      }}
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
    </div>
  );
}
