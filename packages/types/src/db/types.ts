export type DBGenre = {
  id: number;
  name: string;
  created_at?: string;
  updated_at?: string;
};

export type DBTrack = {
  id: number;
  file: string;
  title: string;
  artist_id?: number;
  album_id?: number;
  genre_id?: number;
  track_number?: number;
  disc_number?: number;
  duration?: number;
  date?: string;
  last_modified?: string;
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
  type: "smb" | "nfs" | "local";
  uri: string;
  mount_path: string;
  username?: string;
  password?: string;
  enabled: number;
  file_count?: number;
  dir_count?: number;
  total_size?: number;
  created_at?: string;
  updated_at?: string;
};

export type DBSetupProgress = {
  id: number;
  step: string;
  completed: number;
  completed_at?: string;
};
