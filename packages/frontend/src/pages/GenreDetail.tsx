import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import {
  getAlbumsByGenre,
  getTracksByGenre,
} from "@/features/apis/catalogApis";
import { useEffect, useState } from "react";
import type { Album, TrackWithRelations } from "@repo/types/catalog";
import { useNavigate, useParams } from "react-router-dom";
import { AlbumArtwork } from "@/features/dashboard/components/album-artwork";
import { PageTitle } from "@/features/dashboard/components/pageTitle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatTime } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PlayIcon, ListPlus } from "lucide-react";
import { playSong, addToQueue } from "@/features/apis/mpdApis";
import { usePlaybackContext } from "@/components/playback-context";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { AddToPlaylistMenu } from "@/features/dashboard/components/add-to-playlist-menu";

export default function GenreDetail() {
  const { t } = useTranslation();
  const { genre } = useParams<{ genre: string }>();
  const navigate = useNavigate();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [tracks, setTracks] = useState<TrackWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const { trackPlayed } = usePlaybackContext();

  useEffect(() => {
    if (!genre) return;
    Promise.all([getAlbumsByGenre(genre), getTracksByGenre(genre)])
      .then(([a, tr]) => {
        setAlbums(a);
        setTracks(tr);
      })
      .finally(() => setLoading(false));
  }, [genre]);

  if (!genre) return null;

  if (loading) {
    return (
      <div>
        <PageTitle title={genre} description={t("genres.description")} />
        <div className="flex justify-center py-16">
          <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageTitle title={genre} description={t("genres.description")} />
      <Tabs defaultValue="albums" className="mt-4">
        <TabsList>
          <TabsTrigger value="albums">
            {t("genres.albums")} ({albums.length})
          </TabsTrigger>
          <TabsTrigger value="tracks">
            {t("genres.tracks")} ({tracks.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="albums" className="mt-4">
          {albums.length === 0 && (
            <p className="text-muted-foreground text-center">
              {t("albums.noAlbums")}
            </p>
          )}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {albums.map((album) => (
              <AlbumArtwork
                key={album.id}
                album={album}
                className="w-full"
                onClick={() => navigate(`/albums/${album.id}`)}
              />
            ))}
          </div>
        </TabsContent>
        <TabsContent value="tracks" className="mt-4">
          {tracks.length === 0 && (
            <p className="text-muted-foreground text-center">
              {t("tracks.noTracks")}
            </p>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>{t("album.title")}</TableHead>
                <TableHead>{t("tracks.artist")}</TableHead>
                <TableHead className="hidden md:table-cell">
                  {t("tracks.album")}
                </TableHead>
                <TableHead className="w-20">{t("album.duration")}</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tracks.map((track) => (
                <ContextMenu key={track.id}>
                  <ContextMenuTrigger asChild>
                    <TableRow
                      className="group h-12 cursor-pointer"
                      onClick={() => playSong(track)}
                    >
                      <TableCell>
                        {trackPlayed?.id === track.id ? (
                          <div className="flex items-end gap-1">
                            <div
                              className="bg-primary eq h-1 w-1 rounded"
                              style={{ animationDelay: "0ms" }}
                            />
                            <div
                              className="bg-primary eq h-2 w-1 rounded"
                              style={{ animationDelay: "150ms" }}
                            />
                            <div
                              className="bg-primary eq h-3 w-1 rounded"
                              style={{ animationDelay: "300ms" }}
                            />
                          </div>
                        ) : (
                          <PlayIcon
                            width={15}
                            height={15}
                            fill="currentColor"
                            className="opacity-0 transition-opacity group-hover:opacity-100"
                          />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {track.title}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {track.artist_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden md:table-cell">
                        {track.album_id ? (
                          <span
                            className="cursor-pointer hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/albums/${track.album_id}`);
                            }}
                          >
                            {track.album_title || "-"}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatTime(track.duration ?? 0)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground hover:text-foreground opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            addToQueue(track.file);
                          }}
                          title={t("album.addToQueue")}
                        >
                          <ListPlus className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-48">
                    <ContextMenuItem onClick={() => playSong(track)}>
                      {t("contextMenu.playNext")}
                    </ContextMenuItem>
                    <ContextMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        addToQueue(track.file);
                      }}
                    >
                      {t("contextMenu.playLater")}
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <AddToPlaylistMenu trackId={track.id} />
                  </ContextMenuContent>
                </ContextMenu>
              ))}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>
    </div>
  );
}
