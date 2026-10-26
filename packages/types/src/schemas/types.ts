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

export const likedSchemas = {
  trackIdParam: z.object({
    trackId: z.coerce
      .number()
      .int("trackId must be an integer")
      .positive("trackId must be positive"),
  }),
  listQuery: z.object({
    limit: z.coerce
      .number()
      .int("limit must be an integer")
      .min(1, "limit must be >= 1")
      .max(200, "limit must be <= 200")
      .optional(),
    offset: z.coerce
      .number()
      .int("offset must be an integer")
      .min(0, "offset must be >= 0")
      .optional(),
  }),
  play: z.object({
    shuffle: z.boolean().optional(),
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
    // path is a folder that must already exist inside the container, under
    // MUSIC_DIR. It is provided by the host as a bind mount; Sonect never
    // mounts anything itself.
    path: z.string().min(1, "path is required"),
    enabled: z.boolean().optional(),
  }),
  storageSourceUpdate: z.object({
    name: z.string().min(1).max(255).optional(),
    path: z.string().min(1).optional(),
    enabled: z.boolean().optional(),
  }),
  setupProgress: z.object({
    step: z.string().min(1, "step is required"),
    completed: z.boolean(),
  }),
  outputMode: z.object({
    mode: z.enum(["mpd", "browser"]),
    deviceId: z.string().min(1).optional(),
  }),
};

export const sessionSchemas = {
  play: z.object({
    file: z.string().min(1, "file is required"),
  }),
  position: z.object({
    position: z.number().finite("position must be a finite number"),
  }),
  queuePos: z.object({
    // Params arrive as strings from the route; coerce on parse.
    pos: z.coerce
      .number("pos must be a number")
      .int("pos must be an integer")
      .min(0, "pos must be >= 0"),
  }),
  moveQueue: z.object({
    from: z.number().int("from must be an integer").min(0, "from must be >= 0"),
    to: z.number().int("to must be an integer").min(0, "to must be >= 0"),
  }),
};

const passwordSchema = z
  .string()
  .min(8, "password must be at least 8 characters")
  .max(200, "password is too long");

export const authSchemas = {
  bootstrap: z.object({
    name: z.string().trim().min(1, "name is required").max(50),
    password: passwordSchema,
  }),
  login: z.object({
    profileId: z.string().min(1, "profileId is required").max(200),
    password: z.string().min(1, "password is required").max(200),
  }),
  switchProfile: z.object({
    profileId: z.string().min(1, "profileId is required").max(200),
    password: z.string().min(1, "password is required").max(200),
  }),
  changePassword: z.object({
    currentPassword: z.string().min(1, "currentPassword is required").max(200),
    newPassword: passwordSchema,
  }),
};

export const profileSchemas = {
  create: z.object({
    name: z.string().trim().min(1, "name is required").max(50),
    avatarColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, "avatarColor must be a hex color")
      .optional(),
    password: passwordSchema,
    role: z.enum(["admin", "user"]).optional(),
  }),
  update: z
    .object({
      name: z.string().trim().min(1, "name is required").max(50).optional(),
      avatarColor: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/, "avatarColor must be a hex color")
        .optional(),
      role: z.enum(["admin", "user"]).optional(),
    })
    .refine(
      (v) =>
        v.name !== undefined ||
        v.avatarColor !== undefined ||
        v.role !== undefined,
      { message: "At least one of name, avatarColor or role is required" },
    ),
  resetPassword: z.object({ password: passwordSchema }),
  idParam: z.object({ id: z.string().min(1, "id is required") }),
};

export const catalogSchemas = {
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
