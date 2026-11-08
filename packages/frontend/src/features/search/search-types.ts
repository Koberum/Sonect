import type { Album, Artist, TrackWithRelations } from "@repo/types/catalog";

export type SectionType = "genres" | "artists" | "albums" | "tracks" | "recent";
export type GenreItem = { kind: "genre"; name: string };
export type SearchItem =
  Artist | Album | TrackWithRelations | GenreItem | string;

export interface SearchSection {
  type: SectionType;
  items: SearchItem[];
}
