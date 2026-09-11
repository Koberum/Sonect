import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  getPlaylist,
  deletePlaylist,
  loadPlaylist,
  removeTrackFromPlaylist,
} from "@/features/apis/playlistApis";
import { playSong, addToQueue } from "@/features/apis/mpdApis";
import { usePlaylistContext } from "@/components/playlist-context";
import { PageTitle } from "@/features/dashboard/components/pageTitle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updatePlaylist } from "@/features/apis/playlistApis";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PlayIcon, Trash2, Play, Edit3, X, ListMusic } from "lucide-react";
import { formatTime, getCoverPath } from "@/lib/utils";
import type { PlaylistWithTracks, PlaylistTrack } from "@repo/types/library";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

export default function PlaylistDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { refresh } = usePlaylistContext();
  const [playlist, setPlaylist] = useState<PlaylistWithTracks | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getPlaylist(parseInt(id, 10))
      .then((data) => {
        setPlaylist(data);
        setEditName(data.name);
        setEditDesc(data.description || "");
      })
      .catch(() => navigate("/"))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const handlePlay = useCallback(async (track: PlaylistTrack) => {
    await playSong(track);
  }, []);

  const handlePlayAll = useCallback(async () => {
    if (!playlist || playlist.tracks.length === 0) return;
    await loadPlaylist(playlist.id);
  }, [playlist]);

  const handleDelete = async () => {
    if (!playlist) return;
    setDeleteLoading(true);
    try {
      await deletePlaylist(playlist.id);
      toast(t("playlist.deleted"));
      await refresh();
      navigate("/");
    } catch {
      toast.error(t("playlist.deleteError"));
    } finally {
      setDeleteLoading(false);
      setDeleteOpen(false);
    }
  };

  const handleRemoveTrack = async (ptId: number) => {
    if (!playlist) return;
    const previous = playlist;
    setPlaylist({
      ...playlist,
      tracks: playlist.tracks.filter((t) => t.pt_id !== ptId),
    });
    try {
      await removeTrackFromPlaylist(playlist.id, ptId);
      toast(t("playlist.trackRemoved"));
    } catch {
      setPlaylist(previous);
      toast.error(t("playlist.trackRemovedError"));
    }
  };

  const handleAddToQueue = async (file: string) => {
    await addToQueue(file);
    toast(t("playlist.trackAddedToQueue"));
  };

  const handleEdit = async () => {
    if (!playlist || !editName.trim()) return;
    setEditLoading(true);
    try {
      const updated = await updatePlaylist(playlist.id, {
        name: editName.trim(),
        description: editDesc.trim() || undefined,
      });
      setPlaylist({ ...playlist, ...updated });
      setEditOpen(false);
      await refresh();
      toast(t("playlist.updated"));
    } catch {
      toast.error(t("playlist.updateError"));
    } finally {
      setEditLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="mt-6 h-10 w-32" />
        <Separator className="my-4" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!playlist) return null;

  return (
    <div>
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/">{t("breadcrumb.home")}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink className="text-muted-foreground">
              {t("breadcrumb.playlists")}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink className="text-foreground">
              {playlist.name}
            </BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-start justify-between">
        <PageTitle
          title={playlist.name}
          description={
            playlist.tracks.length > 0
              ? t("playlist.trackCount", { count: playlist.tracks.length })
              : t("playlist.empty")
          }
        />
        <div className="flex items-center gap-2">
          <Sheet open={editOpen} onOpenChange={setEditOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Edit3 className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
              </TooltipTrigger>
              <TooltipContent>{t("playlist.edit")}</TooltipContent>
            </Tooltip>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>{t("playlist.edit")}</SheetTitle>
              </SheetHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleEdit();
                }}
                className="mt-6 space-y-4"
              >
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder={t("playlist.namePlaceholder")}
                  autoFocus
                />
                <Input
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder={t("playlist.descriptionPlaceholder")}
                />
                <Button type="submit" className="w-full" disabled={editLoading}>
                  {editLoading ? t("common.saving") : t("playlist.save")}
                </Button>
              </form>
            </SheetContent>
          </Sheet>

          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="icon">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
              </TooltipTrigger>
              <TooltipContent>{t("playlist.delete")}</TooltipContent>
            </Tooltip>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {t("playlist.deleteConfirmTitle")}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t("playlist.deleteConfirmDescription")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={deleteLoading}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleteLoading ? t("common.deleting") : t("playlist.delete")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="mt-4 mb-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                onClick={handlePlayAll}
                disabled={playlist.tracks.length === 0}
              >
                <Play className="mr-2 h-4 w-4" fill="currentColor" />
                {t("album.playAll")}
              </Button>
            </span>
          </TooltipTrigger>
          {playlist.tracks.length === 0 && (
            <TooltipContent>{t("playlist.empty")}</TooltipContent>
          )}
        </Tooltip>
      </div>

      <Separator className="my-4" />

      {playlist.tracks.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead className="w-12"></TableHead>
              <TableHead>{t("album.title")}</TableHead>
              <TableHead className="hidden sm:table-cell">
                {t("tracks.artist")}
              </TableHead>
              <TableHead>{t("album.duration")}</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {playlist.tracks.map((track, idx: number) => (
              <ContextMenu key={track.pt_id ?? track.id}>
                <ContextMenuTrigger asChild>
                  <TableRow
                    className="group cursor-pointer"
                    onClick={() => handlePlay(track)}
                  >
                    <TableCell className="text-muted-foreground">
                      <span className="group-hover:hidden">{idx + 1}</span>
                      <PlayIcon
                        width={15}
                        height={15}
                        fill="currentColor"
                        className="hidden group-hover:block"
                      />
                    </TableCell>
                    <TableCell>
                      <img
                        src={getCoverPath(track.cover_path)}
                        alt=""
                        className="h-8 w-8 rounded-sm object-cover"
                        onError={(e) => {
                          e.currentTarget.src = "/default_cover.png";
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{track.title}</p>
                      <p className="text-muted-foreground text-xs sm:hidden">
                        {track.artist_name}
                      </p>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden sm:table-cell">
                      {track.artist_name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatTime(track.duration ?? 0)}
                    </TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="opacity-0 transition-opacity group-hover:opacity-100 hover:!opacity-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveTrack(track.pt_id);
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {t("playlist.removeTrack")}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlay(track);
                    }}
                  >
                    <Play className="mr-2 h-4 w-4" fill="currentColor" />
                    {t("contextMenu.play")}
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddToQueue(track.file);
                    }}
                  >
                    <ListMusic className="mr-2 h-4 w-4" />
                    {t("contextMenu.addToQueue")}
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveTrack(track.pt_id);
                    }}
                    className="text-destructive focus:text-destructive"
                  >
                    <X className="mr-2 h-4 w-4" />
                    {t("playlist.removeTrack")}
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="text-muted-foreground flex items-center justify-center py-16">
          {t("playlist.emptyDescription")}
        </div>
      )}
    </div>
  );
}
