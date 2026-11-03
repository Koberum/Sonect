import { playlistsDb, tracksDb } from "@repo/db";
import { Playlist, PlaylistWithTracks } from "@repo/types/catalog";
import { MpdConnectionManager } from "@services/mpd/mpdConnectionManager";

export interface PlaylistService {
  getAllPlaylists(profileId: string): Playlist[];
  getPlaylistById(profileId: string, id: number): Playlist | undefined;
  getPlaylistWithTracks(
    profileId: string,
    id: number,
  ): PlaylistWithTracks | undefined;
  createPlaylist(
    profileId: string,
    name: string,
    description?: string,
  ): Playlist | undefined;
  updatePlaylist(
    profileId: string,
    id: number,
    data: { name?: string; description?: string },
  ): Playlist | undefined;
  deletePlaylist(profileId: string, id: number): boolean;
  addTrackToPlaylist(
    profileId: string,
    playlistId: number,
    trackId: number,
  ): { pt_id: number } | null;
  removeTrackFromPlaylist(
    profileId: string,
    playlistTrackId: number,
    playlistId: number,
  ): boolean;
  loadPlaylist(profileId: string, id: number): Promise<void>;
}

export class PlaylistServiceImpl implements PlaylistService {
  constructor(private mpdConnectionManager: MpdConnectionManager) {}

  getAllPlaylists(profileId: string): Playlist[] {
    return playlistsDb.getAll(profileId).map((playlist) => ({
      ...playlist,
      coverPreviews: playlistsDb.getCoverPreviews(playlist.id, 4),
      trackCount: playlistsDb.getTrackCount(playlist.id),
    }));
  }

  getPlaylistById(profileId: string, id: number): Playlist | undefined {
    return playlistsDb.getById(profileId, id);
  }

  getPlaylistWithTracks(
    profileId: string,
    id: number,
  ): PlaylistWithTracks | undefined {
    const playlist = playlistsDb.getById(profileId, id);
    if (!playlist) return undefined;

    const tracks = playlistsDb.getTracks(id).map((t) => ({
      ...t,
      artist_name: t.artist_name ?? "",
      cover_path: t.cover_path ?? "",
      genre: t.genre ?? undefined,
    }));
    return { ...playlist, tracks };
  }

  createPlaylist(
    profileId: string,
    name: string,
    description?: string,
  ): Playlist | undefined {
    const id = playlistsDb.create(profileId, name, description);
    return playlistsDb.getById(profileId, id);
  }

  updatePlaylist(
    profileId: string,
    id: number,
    data: { name?: string; description?: string },
  ): Playlist | undefined {
    const playlist = playlistsDb.getById(profileId, id);
    if (!playlist) return undefined;

    playlistsDb.update(profileId, id, data);
    return playlistsDb.getById(profileId, id);
  }

  deletePlaylist(profileId: string, id: number): boolean {
    const playlist = playlistsDb.getById(profileId, id);
    if (!playlist) return false;

    playlistsDb.delete(profileId, id);
    this.mpdConnectionManager
      .executeCommand("rm", [this.mpdPlaylistName(id)])
      .catch(() => {});
    return true;
  }

  addTrackToPlaylist(
    profileId: string,
    playlistId: number,
    trackId: number,
  ): { pt_id: number } | null {
    const track = tracksDb.getById(trackId);
    if (!track) throw new Error("Track not found");

    const playlist = playlistsDb.getById(profileId, playlistId);
    if (!playlist) return null;

    playlistsDb.addTrack(playlistId, trackId);

    this.mpdConnectionManager
      .executeCommand("playlistadd", [
        this.mpdPlaylistName(playlistId),
        track.file,
      ])
      .catch(() => {});

    const tracks = playlistsDb.getTracks(playlistId);
    const added = tracks.find((t) => t.file === track.file);
    return added ? { pt_id: added.pt_id } : null;
  }

  removeTrackFromPlaylist(
    profileId: string,
    playlistTrackId: number,
    playlistId: number,
  ): boolean {
    const playlist = playlistsDb.getById(profileId, playlistId);
    if (!playlist) return false;

    const tracks = playlistsDb.getTracks(playlistId);
    const track = tracks.find((t) => t.pt_id === playlistTrackId);
    if (!track) return false;

    playlistsDb.removeTrack(playlistTrackId);

    this.removeTrackFromMpdPlaylist(
      this.mpdPlaylistName(playlistId),
      track.file,
    ).catch(() => {});
    return true;
  }

  async loadPlaylist(profileId: string, id: number): Promise<void> {
    const playlist = playlistsDb.getById(profileId, id);
    if (!playlist) throw new Error("Playlist not found");

    await this.mpdConnectionManager.executeCommand("clear");
    await this.mpdConnectionManager.executeCommand("load", [
      this.mpdPlaylistName(id),
    ]);
    this.mpdConnectionManager.refreshNow().catch(() => {});
  }

  /**
   * MPD playlists share one global namespace, while Sonect playlists are
   * per-profile and may reuse names. The id-based name keeps them separate.
   */
  private mpdPlaylistName(id: number): string {
    return `sonect-${id}`;
  }

  private async removeTrackFromMpdPlaylist(
    playlistName: string,
    trackFile: string,
  ): Promise<void> {
    try {
      const raw = await this.mpdConnectionManager.executeCommand(
        "listplaylistinfo",
        [playlistName],
      );
      const lines = raw.split("\n");
      let pos = 0;
      for (const line of lines) {
        if (line.startsWith("file: ") && line.slice(6) === trackFile) {
          await this.mpdConnectionManager.executeCommand("playlistdelete", [
            playlistName,
            pos.toString(),
          ]);
          return;
        }
        if (line.startsWith("file: ")) pos++;
      }
    } catch {
      // MPD playlist may not exist yet
    }
  }
}
