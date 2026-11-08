import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import { History, Loader2, MicVocal } from "lucide-react";
import type {
  Album,
  Artist,
  SearchResults as CatalogSearchResults,
  TrackWithRelations,
} from "@repo/types/catalog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LikeButton } from "@/features/liked/components/like-button";
import { useTrackDragHandlers } from "@/features/playlists/use-track-drag-handlers";
import { cn, getCoverPath } from "@/lib/utils";
import type {
  GenreItem,
  SearchItem,
  SearchSection,
  SectionType,
} from "../search-types";

const ROW_CLASS =
  "group flex cursor-pointer items-center gap-3 rounded-sm px-2 py-2 text-sm transition-colors";

function rowClass(selected: boolean): string {
  return cn(ROW_CLASS, selected ? "bg-accent/50" : "hover:bg-accent/50");
}

interface RowProps<T> {
  item: T;
  index: number;
  selected: boolean;
  onActivate: (item: T) => void;
  onHover: (index: number) => void;
}

function Cover({ src }: { src?: string }) {
  return (
    <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded">
      <img
        src={getCoverPath(src)}
        alt=""
        className="h-full w-full object-cover"
        onError={(event) => {
          event.currentTarget.src = "/default_cover.png";
        }}
      />
    </div>
  );
}

function TrackResultRow({
  item: track,
  index,
  selected,
  onActivate,
  onHover,
  onAddToQueue,
}: RowProps<TrackWithRelations> & {
  onAddToQueue: (track: TrackWithRelations) => void;
}) {
  const { t } = useTranslation();
  const dragHandlers = useTrackDragHandlers<HTMLDivElement>(track.id);

  return (
    <div
      {...dragHandlers}
      data-index={index}
      className={rowClass(selected)}
      onClick={() => onActivate(track)}
      onMouseEnter={() => onHover(index)}
    >
      <Cover src={track.cover_path} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{track.title}</p>
        <p className="text-muted-foreground truncate text-xs">
          {track.artist_name}
        </p>
      </div>
      <LikeButton trackId={track.id} />
      <Button
        variant="ghost"
        size="xs"
        className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 max-md:opacity-100"
        onClick={(event) => {
          event.stopPropagation();
          onAddToQueue(track);
        }}
      >
        {t("search.addToQueue")}
      </Button>
    </div>
  );
}

function AlbumResultRow({
  item: album,
  index,
  selected,
  onActivate,
  onHover,
}: RowProps<Album>) {
  return (
    <div
      data-index={index}
      className={rowClass(selected)}
      onClick={() => onActivate(album)}
      onMouseEnter={() => onHover(index)}
    >
      <Cover src={album.cover_path} />
      <div className="min-w-0 flex-1">
        <span className="truncate">{album.title}</span>
        <span className="text-muted-foreground ml-2 text-xs">
          {album.artist_name}
        </span>
      </div>
    </div>
  );
}

function ArtistResultRow({
  item: artist,
  index,
  selected,
  onActivate,
  onHover,
}: RowProps<Artist>) {
  return (
    <div
      data-index={index}
      className={rowClass(selected)}
      onClick={() => onActivate(artist)}
      onMouseEnter={() => onHover(index)}
    >
      <MicVocal className="text-muted-foreground h-4 w-4" />
      <span>{artist.name}</span>
    </div>
  );
}

function RecentResultRow({
  item,
  index,
  selected,
  onActivate,
  onHover,
}: RowProps<string>) {
  return (
    <div
      data-index={index}
      className={rowClass(selected)}
      onClick={() => onActivate(item)}
      onMouseEnter={() => onHover(index)}
    >
      <History className="text-muted-foreground size-4 shrink-0" />
      <span className="truncate">{item}</span>
    </div>
  );
}

function GenreBadge({
  item,
  index,
  selected,
  onActivate,
  onHover,
}: RowProps<GenreItem>) {
  return (
    <Badge
      asChild
      variant={selected ? "default" : "secondary"}
      className="cursor-pointer"
    >
      <button
        type="button"
        data-index={index}
        onClick={() => onActivate(item)}
        onMouseEnter={() => onHover(index)}
      >
        {item.name}
      </button>
    </Badge>
  );
}

function sectionLabel(type: SectionType, t: (key: string) => string): string {
  switch (type) {
    case "genres":
      return t("search.genres");
    case "artists":
      return t("search.artists");
    case "albums":
      return t("search.albums");
    case "tracks":
      return t("search.tracks");
    case "recent":
      return t("search.recentSearches");
  }
}

export interface SearchResultsProps {
  sections: SearchSection[];
  selectedIndex: number;
  loading: boolean;
  trimmedQuery: string;
  results: CatalogSearchResults | undefined;
  minQueryLength: number;
  recentSearchCount: number;
  onActivate: (item: SearchItem) => void;
  onHover: (index: number) => void;
  onAddToQueue: (track: TrackWithRelations) => void;
  listRef: RefObject<HTMLDivElement | null>;
}

/** Presentational result list shared by the toolbar dropdown and mobile overlay. */
export function SearchResults({
  sections,
  selectedIndex,
  loading,
  trimmedQuery,
  results,
  minQueryLength,
  recentSearchCount,
  onActivate,
  onHover,
  onAddToQueue,
  listRef,
}: SearchResultsProps) {
  const { t } = useTranslation();
  let globalIndex = 0;

  return (
    <div className="no-scrollbar max-h-[60vh] overflow-y-auto" ref={listRef}>
      {loading && trimmedQuery.length >= minQueryLength && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
        </div>
      )}

      {!loading && (
        <div className="p-2">
          {sections.map((section) => {
            if (section.type === "genres") {
              return (
                <div
                  key={section.type}
                  role="group"
                  aria-label={t("search.genres")}
                  className="mb-2 flex flex-wrap gap-2 px-2 py-1"
                >
                  {section.items.map((item) => {
                    const index = globalIndex++;
                    return (
                      <GenreBadge
                        key={(item as GenreItem).name}
                        item={item as GenreItem}
                        index={index}
                        selected={index === selectedIndex}
                        onActivate={onActivate}
                        onHover={onHover}
                      />
                    );
                  })}
                </div>
              );
            }

            return (
              <div key={section.type} className="mb-2">
                <p className="text-muted-foreground px-2 py-1 text-xs font-semibold uppercase">
                  {sectionLabel(section.type, t)}
                </p>
                {section.items.map((item) => {
                  const index = globalIndex++;
                  const rowProps = {
                    index,
                    selected: index === selectedIndex,
                    onActivate,
                    onHover,
                  };

                  if (typeof item === "string") {
                    return (
                      <RecentResultRow key={item} item={item} {...rowProps} />
                    );
                  }
                  if ("file" in item) {
                    return (
                      <TrackResultRow
                        key={(item as TrackWithRelations).id}
                        item={item as TrackWithRelations}
                        {...rowProps}
                        onAddToQueue={onAddToQueue}
                      />
                    );
                  }
                  if ("artist_name" in item && !("name" in item)) {
                    return (
                      <AlbumResultRow
                        key={(item as Album).id}
                        item={item as Album}
                        {...rowProps}
                      />
                    );
                  }
                  return (
                    <ArtistResultRow
                      key={(item as Artist).id}
                      item={item as Artist}
                      {...rowProps}
                    />
                  );
                })}
              </div>
            );
          })}

          {trimmedQuery.length < minQueryLength && recentSearchCount === 0 && (
            <div className="text-muted-foreground flex items-center justify-center py-8 text-sm">
              {t("search.startTyping")}
            </div>
          )}

          {trimmedQuery.length >= minQueryLength &&
            !loading &&
            results &&
            results.artists.length === 0 &&
            results.albums.length === 0 &&
            results.tracks.length === 0 &&
            results.genres.length === 0 && (
              <div className="text-muted-foreground flex items-center justify-center py-8 text-sm">
                {t("search.noResults")}
              </div>
            )}
        </div>
      )}
    </div>
  );
}
