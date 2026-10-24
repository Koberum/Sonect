export { initDb, db, closeDb } from "./connection.js";
export { initDatabase } from "./schema.js";
export {
  artists,
  albums,
  tracks,
  genres,
  playlists,
  playlistTracks,
} from "./tables.js";
export { artistsDb, findOrCreateArtist } from "./repositories/artists.js";
export { albumsDb, findOrCreateAlbum } from "./repositories/albums.js";
export { tracksDb, upsertTrack } from "./repositories/tracks.js";
export { catalogSyncDb } from "./repositories/catalogSync.js";
export { playlistsDb } from "./repositories/playlists.js";
export { syncMetadataDb } from "./repositories/syncMetadata.js";
export { statsDb } from "./repositories/stats.js";
export { storageDb } from "./repositories/storage.js";
export { setupDb } from "./repositories/setup.js";
export { genresDb, findOrCreateGenre } from "./repositories/genres.js";
export { profilesDb, LastAdminError } from "./repositories/profiles.js";
export {
  authSessionsDb,
  type DBAuthSession,
} from "./repositories/authSessions.js";
