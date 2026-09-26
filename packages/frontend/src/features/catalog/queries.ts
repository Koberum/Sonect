import { queryOptions, infiniteQueryOptions } from "@tanstack/react-query";
import { qk } from "@/lib/queryKeys";
import {
  getAlbumById,
  getAlbums,
  getAlbumsByArtist,
  getAlbumsByGenre,
  getArtistById,
  getArtists,
  getAllTracks,
  getGenres,
  getLibraryStats,
  getTracksByAlbum,
  getTracksByArtist,
  getTracksByGenre,
  search,
} from "./api";

const PAGE_SIZE_ALBUMS = 50;
const PAGE_SIZE_ARTISTS = 50;
const PAGE_SIZE_TRACKS = 100;

export const catalogQueries = {
  albumsInfinite: (sort: string) =>
    infiniteQueryOptions({
      queryKey: qk.catalog.albumsInfinite(sort),
      queryFn: ({ pageParam, signal }) =>
        getAlbums(
          { sort, limit: PAGE_SIZE_ALBUMS, offset: pageParam as number },
          signal,
        ),
      initialPageParam: 0,
      getNextPageParam: (last, allPages) => {
        if (last.items.length < PAGE_SIZE_ALBUMS) return undefined;
        return allPages.reduce((acc, p) => acc + p.items.length, 0);
      },
      staleTime: 60_000,
    }),

  artistsInfinite: () =>
    infiniteQueryOptions({
      queryKey: qk.catalog.artistsInfinite(),
      queryFn: ({ pageParam, signal }) =>
        getArtists(
          { limit: PAGE_SIZE_ARTISTS, offset: pageParam as number },
          signal,
        ),
      initialPageParam: 0,
      getNextPageParam: (last, allPages) => {
        if (last.items.length < PAGE_SIZE_ARTISTS) return undefined;
        return allPages.reduce((acc, p) => acc + p.items.length, 0);
      },
      staleTime: 60_000,
    }),

  tracksInfinite: (sort: string) =>
    infiniteQueryOptions({
      queryKey: qk.catalog.tracksInfinite(sort),
      queryFn: ({ pageParam, signal }) =>
        getAllTracks(
          { sort, limit: PAGE_SIZE_TRACKS, offset: pageParam as number },
          signal,
        ),
      initialPageParam: 0,
      getNextPageParam: (last, allPages) => {
        if (last.items.length < PAGE_SIZE_TRACKS) return undefined;
        return allPages.reduce((acc, p) => acc + p.items.length, 0);
      },
      staleTime: 60_000,
    }),

  album: (id: string) =>
    queryOptions({
      queryKey: qk.catalog.album(id),
      queryFn: ({ signal }) => getAlbumById(id, signal),
      enabled: !!id,
      staleTime: 5 * 60_000,
    }),

  artist: (id: string) =>
    queryOptions({
      queryKey: qk.catalog.artist(id),
      queryFn: ({ signal }) => getArtistById(id, signal),
      enabled: !!id,
      staleTime: 5 * 60_000,
    }),

  albumsByArtist: (artistId: string) =>
    queryOptions({
      queryKey: qk.catalog.albumsByArtist(artistId),
      queryFn: ({ signal }) => getAlbumsByArtist(artistId, signal),
      enabled: !!artistId,
      staleTime: 5 * 60_000,
    }),

  tracksByAlbum: (albumId: string) =>
    queryOptions({
      queryKey: qk.catalog.tracksByAlbum(albumId),
      queryFn: ({ signal }) => getTracksByAlbum(albumId, signal),
      enabled: !!albumId,
      staleTime: 5 * 60_000,
    }),

  tracksByArtist: (artistId: string) =>
    queryOptions({
      queryKey: qk.catalog.tracksByArtist(artistId),
      queryFn: ({ signal }) => getTracksByArtist(artistId, signal),
      enabled: !!artistId,
      staleTime: 5 * 60_000,
    }),

  genres: () =>
    queryOptions({
      queryKey: qk.catalog.genres(),
      queryFn: ({ signal }) => getGenres(signal),
      staleTime: 5 * 60_000,
    }),

  albumsByGenre: (genre: string) =>
    queryOptions({
      queryKey: qk.catalog.albumsByGenre(genre),
      queryFn: ({ signal }) => getAlbumsByGenre(genre, signal),
      enabled: !!genre,
      staleTime: 5 * 60_000,
    }),

  tracksByGenre: (genre: string) =>
    queryOptions({
      queryKey: qk.catalog.tracksByGenre(genre),
      queryFn: ({ signal }) => getTracksByGenre(genre, signal),
      enabled: !!genre,
      staleTime: 5 * 60_000,
    }),

  stats: () =>
    queryOptions({
      queryKey: qk.catalog.stats(),
      queryFn: ({ signal }) => getLibraryStats(signal),
      staleTime: 2 * 60_000,
    }),

  search: (query: string) =>
    queryOptions({
      queryKey: qk.catalog.search(query),
      queryFn: ({ signal }) => search(query, signal),
      enabled: query.trim().length >= 2,
      staleTime: 10_000,
    }),
};
