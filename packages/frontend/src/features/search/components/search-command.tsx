import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
} from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { usePlayTrack } from "@/features/player/usePlayTrack";
import type { TrackWithRelations } from "@repo/types/catalog";
import { toast } from "sonner";
import { useMediaQuery } from "react-responsive";
import { useQuery } from "@tanstack/react-query";
import { catalogQueries } from "@/features/catalog/queries";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useAuth } from "@/features/auth/auth-context";
import type {
  GenreItem,
  SearchItem,
  SearchSection,
} from "@/features/search/search-types";
import { useRecentSearches } from "@/features/search/use-recent-searches";
import { SearchResults } from "./search-results";

const MIN_QUERY_LENGTH = 2;

export interface SearchCommandProps {
  /** `overlay` is the mobile-only full-screen search rendered by MainLayout. */
  variant?: "toolbar" | "overlay";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SearchCommand({
  variant = "toolbar",
  open,
  onOpenChange,
}: SearchCommandProps = {}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { play, addToQueue } = usePlayTrack();
  const { profile } = useAuth();
  const profileId = profile?.id ?? "";
  const isDesktop = useMediaQuery({ minWidth: 768 });
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [internalOverlayOpen, setInternalOverlayOpen] = useState(false);
  const overlayOpen = open ?? internalOverlayOpen;
  const setOverlayOpen = useCallback(
    (next: boolean) => {
      if (open === undefined) setInternalOverlayOpen(next);
      onOpenChange?.(next);
    },
    [open, onOpenChange],
  );
  const [showDropdown, setShowDropdown] = useState(false);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 350);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { recentSearches, refresh, remember } = useRecentSearches(profileId);

  const trimmedQuery = query.trim();
  const showRecents = trimmedQuery.length === 0 && recentSearches.length > 0;

  const enabled = debouncedQuery.trim().length >= MIN_QUERY_LENGTH;
  const { data: results, isFetching: loading } = useQuery({
    ...catalogQueries.search(debouncedQuery),
    enabled,
  });

  const rememberQuery = useCallback(() => {
    if (trimmedQuery.length < MIN_QUERY_LENGTH) return;
    remember(trimmedQuery);
  }, [remember, trimmedQuery]);

  const handlePlayTrack = useCallback(
    async (track: TrackWithRelations) => {
      await play(track);
      setOverlayOpen(false);
      setShowDropdown(false);
    },
    [play, setOverlayOpen],
  );

  const closeSearch = useCallback(() => {
    setOverlayOpen(false);
    setShowDropdown(false);
    setQuery("");
  }, [setOverlayOpen]);

  const activateItem = useCallback(
    (item: SearchItem) => {
      if (typeof item === "string") {
        setQuery(item);
        setSelectedIndex(0);
        setShowDropdown(true);
        remember(item);
        inputRef.current?.focus();
        return;
      }

      rememberQuery();
      if ("kind" in item) {
        navigate(`/library/genres/${encodeURIComponent(item.name)}`);
        closeSearch();
        return;
      }
      if ("file" in item) {
        void handlePlayTrack(item as TrackWithRelations);
      } else if ("artist_name" in item && !("name" in item)) {
        navigate(`/library/albums/${item.id}`);
        closeSearch();
      } else {
        navigate(`/library/artists/${item.id}`);
        closeSearch();
      }
    },
    [handlePlayTrack, navigate, closeSearch, rememberQuery, remember],
  );

  const sections: SearchSection[] = [];

  if (showRecents) {
    sections.push({ type: "recent", items: recentSearches });
  } else if (results) {
    if (results.genres.length > 0)
      sections.push({
        type: "genres",
        items: results.genres.map((genre): GenreItem => ({
          kind: "genre",
          name: genre.name,
        })),
      });
    if (results.artists.length > 0)
      sections.push({ type: "artists", items: results.artists.slice(0, 5) });
    if (results.albums.length > 0)
      sections.push({ type: "albums", items: results.albums.slice(0, 5) });
    if (results.tracks.length > 0)
      sections.push({ type: "tracks", items: results.tracks.slice(0, 10) });
  }

  const flatItems = sections.flatMap((section) => section.items);
  const totalItems = flatItems.length;

  useEffect(() => {
    if (totalItems === 0) {
      if (selectedIndex !== 0) setSelectedIndex(0);
      return;
    }
    if (selectedIndex > totalItems - 1) setSelectedIndex(totalItems - 1);
  }, [totalItems, selectedIndex]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "k") {
        event.preventDefault();
        if (isDesktop) {
          inputRef.current?.focus();
          setShowDropdown(true);
        } else {
          setOverlayOpen(!overlayOpen);
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isDesktop, overlayOpen, setOverlayOpen]);

  useLayoutEffect(() => {
    if (overlayOpen) {
      refresh();
      setSelectedIndex(0);
      inputRef.current?.focus();
    } else {
      setQuery("");
    }
  }, [overlayOpen, refresh]);

  useEffect(() => {
    if (!showDropdown) {
      setSelectedIndex(0);
    }
  }, [showDropdown]);

  useEffect(() => {
    if (!showDropdown && !overlayOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (totalItems === 0) return;
        setSelectedIndex((previous) => Math.min(previous + 1, totalItems - 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        if (totalItems === 0) return;
        setSelectedIndex((previous) => Math.max(previous - 1, 0));
      } else if (event.key === "Enter" && totalItems > 0) {
        if ((event.target as HTMLElement | null)?.closest("button")) return;
        event.preventDefault();
        const item = flatItems[selectedIndex];
        if (item) activateItem(item);
      } else if (event.key === "Escape") {
        event.preventDefault();
        if (overlayOpen) {
          setOverlayOpen(false);
        } else {
          setShowDropdown(false);
          inputRef.current?.blur();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    showDropdown,
    overlayOpen,
    totalItems,
    selectedIndex,
    flatItems,
    activateItem,
    setOverlayOpen,
  ]);

  useEffect(() => {
    const element = listRef.current?.querySelector(
      `[data-index="${selectedIndex}"]`,
    );
    element?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  useEffect(() => {
    if (!showDropdown) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showDropdown]);

  const handleAddToQueue = async (track: TrackWithRelations) => {
    rememberQuery();
    await addToQueue(track.file);
    toast(t("search.addedToQueue"));
    setShowDropdown(false);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setQuery(value);
    const length = value.trim().length;
    if (length >= MIN_QUERY_LENGTH) {
      setShowDropdown(true);
    } else if (length === 0 && recentSearches.length > 0) {
      setShowDropdown(true);
    } else {
      setShowDropdown(false);
    }
  };

  const handleInputFocus = () => {
    const recents = refresh();
    const length = query.trim().length;
    if (length >= MIN_QUERY_LENGTH || (length === 0 && recents.length > 0)) {
      setShowDropdown(true);
    }
  };

  const resultsView = (
    <SearchResults
      sections={sections}
      selectedIndex={selectedIndex}
      loading={loading}
      trimmedQuery={trimmedQuery}
      results={results}
      minQueryLength={MIN_QUERY_LENGTH}
      recentSearchCount={recentSearches.length}
      onActivate={activateItem}
      onHover={setSelectedIndex}
      onAddToQueue={handleAddToQueue}
      listRef={listRef}
    />
  );

  const overlay = (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-4">
      <div
        className="fixed inset-0 bg-black/80"
        onClick={() => setOverlayOpen(false)}
      />
      <div className="bg-background relative z-50 w-full max-w-xl rounded-lg border shadow-2xl">
        <div className="flex items-center justify-between px-3">
          <div className="flex flex-1 items-center">
            <Search className="mr-2 h-4 w-4 shrink-0" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("search.placeholder")}
              className="border-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <kbd
            className="cursor-pointer rounded border px-1.5 font-mono text-xs"
            onClick={() => setOverlayOpen(false)}
          >
            ESC
          </kbd>
        </div>

        {resultsView}
      </div>
    </div>
  );

  if (variant === "overlay") {
    return overlayOpen ? overlay : null;
  }

  if (isDesktop) {
    return (
      <div className="relative w-full" ref={containerRef}>
        <div
          className="text-muted-foreground flex h-11 cursor-text items-center gap-2 rounded-md border px-3 text-sm transition-colors"
          onClick={() => inputRef.current?.focus()}
        >
          <Search className="h-4 w-4 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            placeholder={t("search.placeholder")}
            className="flex-1 bg-transparent outline-none"
          />
          <kbd className="bg-muted pointer-events-none rounded border px-1.5 font-mono text-xs">
            ⌘K
          </kbd>
        </div>
        {showDropdown && (
          <div className="bg-background absolute top-full right-0 left-0 z-50 mt-4 rounded-md border shadow-lg">
            {resultsView}
          </div>
        )}
      </div>
    );
  }

  if (!overlayOpen) {
    return (
      <div
        onClick={() => setOverlayOpen(true)}
        className="text-muted-foreground flex w-fit cursor-pointer items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors"
      >
        <Search className="h-4 w-4" />
      </div>
    );
  }

  return overlay;
}
