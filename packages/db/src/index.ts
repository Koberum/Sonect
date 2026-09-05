export { initDb, db, closeDb, transaction } from "./connection.js";
export { initDatabase } from "./schema.js";
export {
  artists,
  albums,
  tracks,
  playlists,
  playlistTracks,
  syncMetadata,
  storageSources,
  schemaVersion,
  setupProgress,
} from "./tables.js";
export { artistsDb } from "./repositories/artists.js";
export { albumsDb } from "./repositories/albums.js";
export { tracksDb } from "./repositories/tracks.js";
export { playlistsDb } from "./repositories/playlists.js";
export { syncMetadataDb } from "./repositories/syncMetadata.js";
export { statsDb } from "./repositories/stats.js";
export { storageDb } from "./repositories/storage.js";
export { setupDb } from "./repositories/setup.js";
