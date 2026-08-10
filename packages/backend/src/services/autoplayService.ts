import { tracksDb, albumsDb } from "@repo/db";

const AUTOPLAY_BATCH = 25;

class AutoplayService {
  get threshold(): number {
    return 5;
  }

  async getNextBatch(currentFile: string): Promise<string[]> {
    const count = AUTOPLAY_BATCH;
    const result: string[] = [];
    const seen = new Set<string>();

    const dbTrack = tracksDb.getByFile(currentFile);
    if (!dbTrack) return this._randomFallback(count);

    seen.add(currentFile);
    const album = dbTrack.album_id ? albumsDb.getById(dbTrack.album_id) : null;

    const collectFromAlbum = (albumId: number) => {
      const albumTracks = tracksDb.getByAlbumOrdered(albumId);
      for (const t of albumTracks) {
        if (result.length >= count) return;
        if (seen.has(t.file)) continue;
        seen.add(t.file);
        result.push(t.file);
      }
    };

    const collectFromArtist = (artistId: number, skipAlbumId?: number) => {
      const artistAlbums = albumsDb.getByArtist(artistId);
      for (const a of artistAlbums) {
        if (a.id === skipAlbumId) continue;
        if (result.length >= count) return;
        collectFromAlbum(a.id);
      }
    };

    const collectFromGenre = (genre: string) => {
      const genreAlbums = albumsDb.getByGenre(genre);
      for (const a of genreAlbums) {
        if (a.id === dbTrack.album_id) continue;
        if (result.length >= count) return;
        collectFromAlbum(a.id);
      }
    };

    if (dbTrack.album_id) {
      collectFromAlbum(dbTrack.album_id);
    }

    if (dbTrack.artist_id && result.length < count) {
      collectFromArtist(dbTrack.artist_id, dbTrack.album_id);
    }

    const trackGenre = album?.genre || dbTrack.genre;
    if (trackGenre && result.length < count) {
      collectFromGenre(trackGenre);
    }

    if (result.length < count) {
      const randomTracks = tracksDb.getRandomTracks(count - result.length);
      for (const t of randomTracks) {
        if (result.length >= count) break;
        seen.add(t.file);
        result.push(t.file);
      }
    }

    return result;
  }

  private _randomFallback(count: number): string[] {
    return tracksDb.getRandomTracks(count).map((t) => t.file);
  }
}

export const autoplayService = new AutoplayService();
