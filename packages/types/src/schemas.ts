import { z } from "zod";

export const playerSchemas = {
  play: z.object({
    file: z.string().min(1, "file is required").optional(),
  }),
  position: z.object({
    position: z.number().finite("position must be a finite number"),
  }),
  playPosition: z.object({
    pos: z.number().int("pos must be an integer").min(0, "pos must be >= 0"),
  }),
  queuePos: z.object({
    pos: z.number().int("pos must be an integer").min(0, "pos must be >= 0"),
  }),
  addToQueue: z.object({
    file: z.string().min(1, "file is required"),
  }),
  moveQueue: z.object({
    from: z.number().int("from must be an integer").min(0, "from must be >= 0"),
    to: z.number().int("to must be an integer").min(0, "to must be >= 0"),
  }),
  volume: z.object({
    volume: z
      .number()
      .int("volume must be an integer")
      .min(0, "volume must be >= 0")
      .max(100, "volume must be <= 100"),
  }),
  toggle: z.object({
    enabled: z.boolean({ error: "enabled is required" }),
  }),
  empty: z.object({}).strict(),
};

export const playlistSchemas = {
  idParam: z.object({
    id: z.coerce
      .number()
      .int("id must be an integer")
      .positive("id must be positive"),
  }),
  trackIdParam: z.object({
    trackId: z.coerce
      .number()
      .int("trackId must be an integer")
      .positive("trackId must be positive"),
  }),
  create: z.object({
    name: z.string().min(1, "name is required").max(255),
    description: z.string().optional(),
  }),
  update: z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().optional(),
  }),
  addTrack: z.object({
    trackId: z.number().int("trackId must be an integer").positive(),
  }),
};

export const systemSchemas = {
  audioConfigure: z.object({
    card: z.string().min(1, "card identifier is required"),
    name: z.string().min(1, "name is required"),
    mixerType: z.enum(["hardware", "software", "none"]).optional(),
  }),
  idParam: z.object({
    id: z.coerce
      .number()
      .int("id must be an integer")
      .positive("id must be positive"),
  }),
  storageSource: z.object({
    name: z.string().min(1, "name is required").max(255),
    type: z.enum(["smb", "nfs", "local"]),
    uri: z.string().min(1, "URI is required"),
    // mount_path is an internal detail (mount point for network sources,
    // symlink target for local) under MUSIC_DIR. It is omitted for every type
    // so the server generates it from the library name.
    mount_path: z.string().optional(),
    username: z.string().optional(),
    password: z.string().optional(),
    enabled: z.boolean().optional(),
  }),
  storageSourceUpdate: z.object({
    name: z.string().min(1).max(255).optional(),
    type: z.enum(["smb", "nfs", "local"]).optional(),
    uri: z.string().min(1).optional(),
    mount_path: z.string().min(1).optional(),
    username: z.string().optional(),
    password: z.string().optional(),
    enabled: z.boolean().optional(),
  }),
  configUpdate: z.object({
    content: z.string().min(1, "content is required"),
  }),
  setupProgress: z.object({
    step: z.string().min(1, "step is required"),
    completed: z.boolean(),
  }),
  outputMode: z.object({
    mode: z.enum(["mpd", "browser"]),
  }),
};

export const librarySchemas = {
  idParam: z.object({
    id: z.coerce
      .number()
      .int("id must be an integer")
      .positive("id must be positive"),
  }),
  artistIdParam: z.object({
    artistId: z.coerce
      .number()
      .int("artistId must be an integer")
      .positive("artistId must be positive"),
  }),
  albumIdParam: z.object({
    albumId: z.coerce
      .number()
      .int("albumId must be an integer")
      .positive("albumId must be positive"),
  }),
  genreParam: z.object({
    genre: z.string().min(1, "genre is required"),
  }),
};
