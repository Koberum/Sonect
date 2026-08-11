export type DBTrack = {
  id: number;
  file: string;
  title: string;
  artist_id?: number;
  album_id?: number;
  track_number?: number;
  disc_number?: number;
  duration?: number;
  date?: string;
  genre?: string;
  composer?: string;
  performer?: string;
  comment?: string;
  last_modified?: string;
  play_count?: number;
  last_played?: string;
  created_at?: string;
  updated_at?: string;
};

export type DBArtist = {
  id: number;
  name: string;
  sort_name?: string;
  created_at?: string;
  updated_at?: string;
};

export type DBAlbum = {
  id: number;
  title: string;
  artist_id?: number;
  artist_name?: string;
  year?: number;
  date?: string;
  genre?: string;
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
