import { createContext, useContext, useState, useCallback } from "react";
import { getPlaylists } from "@/features/apis/playlistApis";
import type { Playlist } from "@repo/types/library";

type PlaylistContextType = {
  playlists: Playlist[];
  loading: boolean;
  refresh: () => Promise<void>;
};

const PlaylistContext = createContext<PlaylistContextType | undefined>(
  undefined,
);

export function PlaylistProvider({ children }: { children: React.ReactNode }) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPlaylists();
      setPlaylists(data);
    } catch {
      setPlaylists([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <PlaylistContext.Provider value={{ playlists, loading, refresh }}>
      {children}
    </PlaylistContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePlaylistContext() {
  const context = useContext(PlaylistContext);
  if (!context) {
    throw new Error("usePlaylistContext must be used inside PlaylistProvider");
  }
  return context;
}
