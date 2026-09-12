import { apiFetch } from "@/lib/api";
import type {
  Album,
  Artist,
  LibraryStats,
  TrackWithRelations,
  SearchResults,
} from "@repo/types/catalog";

export function getTracksByAlbum(
  albumId: string,
  signal?: AbortSignal,
): Promise<TrackWithRelations[]> {
  return apiFetch(`/catalog/albums/${albumId}/tracks`, { signal });
}

export function getTracksByArtist(
  artistId: string,
  signal?: AbortSignal,
): Promise<TrackWithRelations[]> {
  return apiFetch(`/catalog/artists/${artistId}/tracks`, { signal });
}

export function getAllTracks(
  params?: { sort?: string; limit?: number; offset?: number },
  signal?: AbortSignal,
): Promise<{ items: TrackWithRelations[]; total: number }> {
  return apiFetch("/catalog/tracks", {
    params: params as Record<string, string | number | boolean | undefined>,
    signal,
  });
}

export function getArtists(
  params?: { limit?: number; offset?: number },
  signal?: AbortSignal,
): Promise<{ items: Artist[]; total: number }> {
  return apiFetch("/catalog/artists", {
    params: params as Record<string, string | number | boolean | undefined>,
    signal,
  });
}

export function getArtistById(
  id: string,
  signal?: AbortSignal,
): Promise<Artist> {
  return apiFetch(`/catalog/artists/${id}`, { signal });
}

export function getAlbums(
  params?: { sort?: string; limit?: number; offset?: number },
  signal?: AbortSignal,
): Promise<{ items: Album[]; total: number }> {
  return apiFetch("/catalog/albums", {
    params: params as Record<string, string | number | boolean | undefined>,
    signal,
  });
}

export function getAlbumById(id: string, signal?: AbortSignal): Promise<Album> {
  return apiFetch(`/catalog/albums/${id}`, { signal });
}

export function getAlbumsByArtist(
  artistId: string,
  signal?: AbortSignal,
): Promise<Album[]> {
  return apiFetch(`/catalog/artists/${artistId}/albums`, { signal });
}

export function getGenres(
  signal?: AbortSignal,
): Promise<{ genre: string; track_count: number; album_count: number }[]> {
  return apiFetch("/catalog/genres", { signal });
}

export function getAlbumsByGenre(
  genre: string,
  signal?: AbortSignal,
): Promise<Album[]> {
  return apiFetch(`/catalog/genres/${encodeURIComponent(genre)}/albums`, {
    signal,
  });
}

export function getTracksByGenre(
  genre: string,
  signal?: AbortSignal,
): Promise<TrackWithRelations[]> {
  return apiFetch(`/catalog/genres/${encodeURIComponent(genre)}/tracks`, {
    signal,
  });
}

export function getRecentlyAdded(
  limit = 20,
  signal?: AbortSignal,
): Promise<{ albums: Album[]; tracks: TrackWithRelations[] }> {
  return apiFetch("/catalog/recently-added", {
    params: { limit },
    signal,
  });
}

export function search(
  query: string,
  signal?: AbortSignal,
): Promise<SearchResults> {
  return apiFetch("/catalog/search", { params: { q: query }, signal });
}

export function getLibraryStats(signal?: AbortSignal): Promise<LibraryStats> {
  return apiFetch("/catalog/stats", { signal });
}

export function scanLibrary(signal?: AbortSignal): Promise<void> {
  return apiFetch("/catalog/scan", { method: "POST", signal });
}

export function syncImages(signal?: AbortSignal): Promise<void> {
  return apiFetch("/catalog/sync-images", { method: "POST", signal });
}
