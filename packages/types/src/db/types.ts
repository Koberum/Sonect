export type DBGenre = {
  id: number;
  name: string;
  created_at?: string;
  updated_at?: string;
};

export type DBGenreWithCounts = DBGenre & {
  album_count: number;
  track_count: number;
};

export type DBTrack = {
  id: number;
  file: string;
  title: string;
  artist_id?: number;
  album_id?: number;
  genre_id?: number;
  storage_source_id?: number;
  track_number?: number;
  disc_number?: number;
  duration?: number;
  date?: string;
  mtime?: number;
  size?: number;
  play_count?: number;
  last_played?: string;
  created_at?: string;
  updated_at?: string;
};

export type DBTrackWithRelations = DBTrack & {
  artist_name?: string;
  album_title?: string;
  cover_path?: string;
  genre?: string;
};

export type DBArtist = {
  id: number;
  name: string;
  created_at?: string;
  updated_at?: string;
};

export type DBAlbum = {
  id: number;
  title: string;
  artist_id?: number;
  genre_id?: number;
  year?: number;
  cover_path?: string;
  last_played?: string;
  created_at?: string;
  updated_at?: string;
};

export type DBPlaylist = {
  id: number;
  name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
};

export type DBStorageSource = {
  id: number;
  name: string;
  path: string;
  enabled: number;
  file_count?: number;
  dir_count?: number;
  total_size?: number;
  created_at?: string;
  updated_at?: string;
};

import type { AuthProfile, ProfileRole, PublicProfile } from "../auth/types.js";

export type DBProfile = {
  id: string;
  name: string;
  avatar_color: string;
  password_hash: string | null;
  role: ProfileRole;
  password_updated_at: number | null;
  created_at: number;
};

export type Profile = {
  id: string;
  name: string;
  avatarColor: string;
  role: ProfileRole;
  createdAt: number;
};

export function toProfile(dbProfile: DBProfile): Profile {
  return {
    id: dbProfile.id,
    name: dbProfile.name,
    avatarColor: dbProfile.avatar_color,
    role: dbProfile.role,
    createdAt: dbProfile.created_at,
  };
}

export function toAuthProfile(dbProfile: DBProfile): AuthProfile {
  return {
    id: dbProfile.id,
    name: dbProfile.name,
    avatarColor: dbProfile.avatar_color,
    role: dbProfile.role,
  };
}

export function toPublicProfile(dbProfile: DBProfile): PublicProfile {
  return {
    id: dbProfile.id,
    name: dbProfile.name,
    avatarColor: dbProfile.avatar_color,
  };
}
