import { DBTrack, DBArtist, DBAlbum, Track } from "@repo/types";
import { genresDb } from "@repo/db";

export function mapDbTrackToTrack(
  dbTrack: DBTrack,
  artist?: DBArtist,
  album?: DBAlbum & { genre?: string },
): Track {
  return {
    ...dbTrack,
    artist_name: artist?.name ?? "",
    cover_path: album?.cover_path ?? "",
    album_name: album?.title,
    genre:
      (dbTrack as any).genre ??
      (dbTrack.genre_id
        ? genresDb.getById(dbTrack.genre_id)?.name
        : undefined) ??
      album?.genre ??
      undefined,
  };
}
