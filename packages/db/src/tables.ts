import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  real,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

export const artists = sqliteTable("artists", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  created_at: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  updated_at: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export const albums = sqliteTable(
  "albums",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    artist_id: integer("artist_id").references(() => artists.id, {
      onDelete: "set null",
    }),
    genre: text("genre"),
    cover_path: text("cover_path"),
    last_played: text("last_played"),
    year: integer("year"),
    created_at: text("created_at").default(sql`CURRENT_TIMESTAMP`),
    updated_at: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_albums_artist").on(table.artist_id)],
);

export const tracks = sqliteTable(
  "tracks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    file: text("file").notNull(),
    title: text("title").notNull(),
    artist_id: integer("artist_id").references(() => artists.id, {
      onDelete: "set null",
    }),
    album_id: integer("album_id").references(() => albums.id, {
      onDelete: "set null",
    }),
    track_number: integer("track_number"),
    disc_number: integer("disc_number"),
    duration: real("duration"),
    date: text("date"),
    genre: text("genre"),
    last_modified: text("last_modified"),
    play_count: integer("play_count").default(0),
    last_played: text("last_played"),
    created_at: text("created_at").default(sql`CURRENT_TIMESTAMP`),
    updated_at: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    unique("tracks_file_unique").on(table.file),
    index("idx_tracks_artist").on(table.artist_id),
    index("idx_tracks_album").on(table.album_id),
    index("idx_tracks_file").on(table.file),
  ],
);

export const playlists = sqliteTable("playlists", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  description: text("description"),
  created_at: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  updated_at: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export const playlistTracks = sqliteTable(
  "playlist_tracks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    playlist_id: integer("playlist_id")
      .notNull()
      .references(() => playlists.id, { onDelete: "cascade" }),
    track_id: integer("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    added_at: text("added_at").default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    unique().on(table.playlist_id, table.track_id),
    index("idx_playlist_tracks_playlist").on(table.playlist_id),
    index("idx_playlist_tracks_track").on(table.track_id),
  ],
);

export const syncMetadata = sqliteTable("sync_metadata", {
  key: text("key").primaryKey(),
  value: text("value"),
  updated_at: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export const storageSources = sqliteTable(
  "storage_sources",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    type: text("type").notNull(),
    uri: text("uri").notNull(),
    mount_path: text("mount_path").notNull(),
    username: text("username"),
    password: text("password"),
    enabled: integer("enabled").default(1),
    file_count: integer("file_count").default(0),
    dir_count: integer("dir_count").default(0),
    total_size: integer("total_size").default(0),
    created_at: text("created_at").default(sql`CURRENT_TIMESTAMP`),
    updated_at: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    check(
      "storage_sources_type_check",
      sql`${table.type} in ('smb', 'nfs', 'local')`,
    ),
  ],
);

export const setupProgress = sqliteTable("setup_progress", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  step: text("step").notNull().unique(),
  completed: integer("completed").default(0),
  completed_at: text("completed_at"),
});
