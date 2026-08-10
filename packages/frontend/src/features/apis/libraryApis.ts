import { ApiClient } from "@/lib/apiClient";
import type {
  Album,
  Artist,
  LibraryStats,
  Track,
  SearchResults,
} from "@repo/types";

const apiClient = new ApiClient({
  baseUrl: `${import.meta.env.VITE_BACKEND_URL ?? ""}/library`,
});

/**
 * Tracks
 */
export const getTracksByAlbum = async (albumId: string): Promise<Track[]> => {
  return apiClient.get(`/albums/${albumId}/tracks`);
};

export const getTracksByArtist = async (artistId: string): Promise<Track[]> => {
  return apiClient.get(`/artists/${artistId}/tracks`);
};

export const getAllTracks = async (params?: {
  sort?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: Track[]; total: number }> => {
  return apiClient.get("/tracks", {
    queryParams: params as Record<string, string | number | boolean>,
  });
};

/**
 * Artists
 */
export const getArtists = async (params?: {
  limit?: number;
  offset?: number;
}): Promise<{ items: Artist[]; total: number }> => {
  return apiClient.get("/artists", {
    queryParams: params as Record<string, string | number | boolean>,
  });
};
export const getArtistById = async (id: string): Promise<Artist> => {
  return apiClient.get(`/artists/${id}`);
};

/** 
 * Albums
 
 */
export const getAlbums = async (params?: {
  sort?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: Album[]; total: number }> => {
  return apiClient.get("/albums", {
    queryParams: params as Record<string, string | number | boolean>,
  });
};

export const getAlbumById = async (id: string): Promise<Album> => {
  return apiClient.get(`/albums/${id}`);
};

export const getAlbumsByArtist = async (artistId: string): Promise<Album[]> => {
  return apiClient.get(`/artists/${artistId}/albums`);
};

/**
 * Genres
 */
export const getGenres = async (): Promise<
  { genre: string; track_count: number; album_count: number }[]
> => {
  return apiClient.get("/genres");
};

export const getAlbumsByGenre = async (genre: string): Promise<Album[]> => {
  return apiClient.get(`/genres/${encodeURIComponent(genre)}/albums`);
};

export const getTracksByGenre = async (genre: string): Promise<Track[]> => {
  return apiClient.get(`/genres/${encodeURIComponent(genre)}/tracks`);
};

/**
 * Recently Added
 */
export const getRecentlyAdded = async (
  limit = 20,
): Promise<{ albums: Album[]; tracks: Track[] }> => {
  return apiClient.get("/recently-added", {
    queryParams: { limit: String(limit) },
  });
};

/**
 * Search
 */
export const search = async (
  query: string,
  signal?: AbortSignal,
): Promise<SearchResults> => {
  return apiClient.get("/search", {
    queryParams: { q: query },
    signal,
  });
};

/**
 * Library Statistics
 */
export const getLibraryStats = async (): Promise<LibraryStats> => {
  return apiClient.get("/stats");
};

/**
 * Updates
 */
export const scanLibrary = async (): Promise<void> => {
  return apiClient.post("/scan");
};

export const syncImages = async (): Promise<void> => {
  return apiClient.post("/sync-images");
};
