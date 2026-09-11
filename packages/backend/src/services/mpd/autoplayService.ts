import { tracksDb, albumsDb } from "@repo/db";
import type { DBAlbum } from "@repo/types";

const AUTOPLAY_BATCH_TARGET = 25;

type BatchOptions = {
  queuedFiles?: string[];
};

export class AutoplayService {
  private usedAlbumIds = new Set<number>();
  private seedFile: string | undefined;
  private _sessionId = 0;

  get threshold(): number {
    return 5;
  }

  get sessionId(): number {
    return this._sessionId;
  }

  resetSession(seedFile?: string, queuedFiles: string[] = []): number {
    this._sessionId++;
    this.seedFile = seedFile;
    this.usedAlbumIds.clear();
    for (const file of seedFile ? [seedFile, ...queuedFiles] : queuedFiles) {
      const track = tracksDb.getByFile(file);
      if (track?.album_id) this.usedAlbumIds.add(track.album_id);
    }
    return this._sessionId;
  }

  commitBatch(files: string[], sessionId = this._sessionId): void {
    if (sessionId !== this._sessionId) return;
    for (const file of files) {
      const track = tracksDb.getByFile(file);
      if (track?.album_id) this.usedAlbumIds.add(track.album_id);
    }
  }

  async getNextBatch(
    currentFile: string,
    { queuedFiles = [] }: BatchOptions = {},
  ): Promise<string[]> {
    const result: string[] = [];
    const currentTrack = tracksDb.getByFile(currentFile);
    const seedTrack = tracksDb.getByFile(this.seedFile ?? currentFile);
    const seedAlbum = seedTrack?.album_id
      ? albumsDb.getById(seedTrack.album_id)
      : undefined;
    const protectedAlbumIds = new Set<number>();

    if (currentTrack?.album_id) protectedAlbumIds.add(currentTrack.album_id);
    for (const file of queuedFiles) {
      const queuedTrack = tracksDb.getByFile(file);
      if (queuedTrack?.album_id) protectedAlbumIds.add(queuedTrack.album_id);
    }

    const fill = () => {
      const excludedAlbumIds = new Set([
        ...this.usedAlbumIds,
        ...protectedAlbumIds,
      ]);
      const collectAlbums = (albums: DBAlbum[]): boolean => {
        for (const album of albums) {
          if (excludedAlbumIds.has(album.id)) continue;
          excludedAlbumIds.add(album.id);

          const albumTracks = tracksDb.getByAlbumOrdered(album.id);
          result.push(...albumTracks.map((track) => track.file));
          if (result.length >= AUTOPLAY_BATCH_TARGET) return true;
        }
        return false;
      };

      if (
        seedTrack?.artist_id &&
        collectAlbums(
          albumsDb.getRankedByPlayCount({
            artistId: seedTrack.artist_id,
          }),
        )
      ) {
        return;
      }

      const genreId = seedAlbum?.genre_id || seedTrack?.genre_id;
      const genre = seedAlbum?.genre || (seedTrack as any)?.genre;
      if (
        (genreId || genre) &&
        collectAlbums(
          albumsDb.getRankedByPlayCount({
            genreId: genreId ?? undefined,
            genre: genre ?? undefined,
          }),
        )
      ) {
        return;
      }

      collectAlbums(albumsDb.getRankedByPlayCount());
    };

    fill();

    if (result.length === 0) {
      this.usedAlbumIds = new Set(protectedAlbumIds);
      fill();
    }

    return result;
  }
}
