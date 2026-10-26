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
    tracksByAlbum: (albumId: string) =>
      ["catalog", "tracksByAlbum", albumId] as const,
    tracksByGenre: (genre: string) =>
      ["catalog", "tracksByGenre", genre] as const,
    stats: () => ["catalog", "stats"] as const,
    search: (query: string) => ["catalog", "search", query] as const,
  },
  playlists: {
    list: () => ["playlists", "list"] as const,
    detail: (id: number) => ["playlists", "detail", id] as const,
  },
  liked: {
    ids: (profileId: string) => ["liked", "ids", profileId] as const,
    list: (profileId: string) => ["liked", "list", profileId] as const,
  },
  player: {
    queue: () => ["player", "queue"] as const,
    waveform: (trackId: number) => ["player", "waveform", trackId] as const,
  },
  system: {
    audioDevices: () => ["system", "audio", "devices"] as const,
    audioStatus: () => ["system", "audio", "status"] as const,
    storageSources: () => ["system", "storage", "sources"] as const,
    detectedLibraries: () => ["system", "storage", "detected"] as const,
    health: () => ["system", "health"] as const,
    hardwareUsage: () => ["system", "hardware", "usage"] as const,
    outputMode: () => ["system", "outputMode"] as const,
  },
  profiles: {
    list: () => ["profiles", "list"] as const,
  },
  auth: {
    state: () => ["auth", "state"] as const,
    profiles: () => ["auth", "profiles"] as const,
  },
};
