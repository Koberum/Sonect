export const qk = {
  dashboard: () => ["dashboard"] as const,
  catalog: {
    albumsInfinite: (sort: string) =>
      ["catalog", "albums", "infinite", sort] as const,
    album: (id: string) => ["catalog", "album", id] as const,
    albumsByArtist: (artistId: string) =>
      ["catalog", "albumsByArtist", artistId] as const,
    albumsByGenre: (genre: string) =>
      ["catalog", "albumsByGenre", genre] as const,
    artistsInfinite: () => ["catalog", "artists", "infinite"] as const,
    artist: (id: string) => ["catalog", "artist", id] as const,
    genres: () => ["catalog", "genres"] as const,
    tracksInfinite: (sort: string) =>
      ["catalog", "tracks", "infinite", sort] as const,
    tracksByAlbum: (albumId: string) =>
      ["catalog", "tracksByAlbum", albumId] as const,
    tracksByArtist: (artistId: string) =>
      ["catalog", "tracksByArtist", artistId] as const,
    tracksByGenre: (genre: string) =>
      ["catalog", "tracksByGenre", genre] as const,
    stats: () => ["catalog", "stats"] as const,
    search: (query: string) => ["catalog", "search", query] as const,
  },
  playlists: {
    list: () => ["playlists", "list"] as const,
    detail: (id: number) => ["playlists", "detail", id] as const,
  },
  mpd: {
    queue: () => ["mpd", "queue"] as const,
  },
  system: {
    audioDevices: () => ["system", "audio", "devices"] as const,
    audioStatus: () => ["system", "audio", "status"] as const,
    storageSources: () => ["system", "storage", "sources"] as const,
    activeMounts: () => ["system", "storage", "mounts"] as const,
    networkStatus: () => ["system", "network", "status"] as const,
    backendStatus: () => ["system", "backend", "status"] as const,
    hardwareUsage: () => ["system", "hardware", "usage"] as const,
    outputMode: () => ["system", "outputMode"] as const,
    mpdStatus: () => ["system", "mpd", "status"] as const,
  },
};
