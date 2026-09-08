export { initDb, db, closeDb, transaction } from "./connection.js";
export { initDatabase } from "./schema.js";
export {
  artists,
  albums,
  tracks,
  genres,
  playlists,
  playlistTracks,
  syncMetadata,
  storageSources,
  setupProgress,
} from "./tables.js";
export { artistsDb } from "./repositories/artists.js";
export { albumsDb, type AlbumWithArtist } from "./repositories/albums.js";
export { tracksDb } from "./repositories/tracks.js";
export { librarySyncDb } from "./repositories/librarySync.js";
export { playlistsDb } from "./repositories/playlists.js";
export { syncMetadataDb } from "./repositories/syncMetadata.js";
export { statsDb } from "./repositories/stats.js";
export { storageDb } from "./repositories/storage.js";
export { setupDb } from "./repositories/setup.js";
export { genresDb, findOrCreateGenre } from "./repositories/genres.js";
