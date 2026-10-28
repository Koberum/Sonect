import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Search, MicVocal, Loader2, History } from "lucide-react";
import { Input } from "@/components/ui/input";
import { getCoverPath } from "@/lib/utils";
import { usePlayTrack } from "@/features/player/usePlayTrack";
import type { TrackWithRelations, Album, Artist } from "@repo/types/catalog";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "react-responsive";
import { useQuery } from "@tanstack/react-query";
import { catalogQueries } from "@/features/catalog/queries";
import { LikeButton } from "@/features/liked/components/like-button";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useAuth } from "@/features/auth/auth-context";
import {
  loadRecentSearches,
  saveRecentSearch,
} from "@/features/dashboard/recent-searches";

type SectionType = "artists" | "albums" | "tracks" | "recent";
type SearchItem = Artist | Album | TrackWithRelations | string;

export function SearchCommand() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { play, addToQueue } = usePlayTrack();
  const { profile } = useAuth();
  const profileId = profile?.id ?? "";
  const isDesktop = useMediaQuery({ minWidth: 768 });
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 350);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>(() =>
    loadRecentSearches(profileId),
  );
  const MIN_QUERY_LENGTH = 2;
  const trimmedQuery = query.trim();
  const showRecents =
    trimmedQuery.length === 0 && recentSearches.length > 0;

  const enabled = debouncedQuery.trim().length >= MIN_QUERY_LENGTH;
  const { data: results, isFetching: loading } = useQuery({
    ...catalogQueries.search(debouncedQuery),
    enabled,
  });

  useEffect(() => {
    setRecentSearches(loadRecentSearches(profileId));
  }, [profileId]);

  const refreshRecentSearches = useCallback(() => {
    setRecentSearches(loadRecentSearches(profileId));
  }, [profileId]);

  const rememberQuery = useCallback(() => {
    const term = query.trim();
    if (term.length < MIN_QUERY_LENGTH) return;
    setRecentSearches(saveRecentSearch(profileId, term));
  }, [profileId, query]);

  const getSectionLabel = (type: SectionType): string => {
    switch (type) {
      case "artists":
        return t("search.artists");
      case "albums":
        return t("search.albums");
      case "tracks":
        return t("search.tracks");
      case "recent":
        return t("search.recentSearches");
    }
  };

  const handlePlayTrack = useCallback(
    async (track: TrackWithRelations) => {
      await play(track);
      setOverlayOpen(false);
      setShowDropdown(false);
    },
    [play],
  );

  const closeSearch = useCallback(() => {
    setOverlayOpen(false);
    setShowDropdown(false);
    setQuery("");
  }, []);

  const activateItem = useCallback(
    (item: SearchItem) => {
      if (typeof item === "string") {
        setQuery(item);
        setSelectedIndex(0);
        setShowDropdown(true);
        setRecentSearches(saveRecentSearch(profileId, item));
        inputRef.current?.focus();
        return;
      }

      rememberQuery();
      if ("file" in item) {
        handlePlayTrack(item as TrackWithRelations);
      } else if ("artist_name" in item && !("name" in item)) {
        navigate(`/albums/${(item as Album).id}`);
        closeSearch();
      } else {
        navigate(`/artists/${(item as Artist).id}/albums`);
        closeSearch();
      }
    },
    [
      handlePlayTrack,
      navigate,
      closeSearch,
      rememberQuery,
      profileId,
    ],
  );

  const sections: { type: SectionType; items: SearchItem[] }[] = [];

  if (showRecents) {
    sections.push({ type: "recent", items: recentSearches });
  } else if (results) {
    if (results.artists.length > 0)
      sections.push({ type: "artists", items: results.artists.slice(0, 5) });
    if (results.albums.length > 0)
      sections.push({ type: "albums", items: results.albums.slice(0, 5) });
    if (results.tracks.length > 0)
      sections.push({ type: "tracks", items: results.tracks.slice(0, 10) });
  }

  const flatItems = sections.flatMap((s) => s.items);
  const totalItems = flatItems.length;

  useEffect(() => {
    if (totalItems === 0) {
      if (selectedIndex !== 0) setSelectedIndex(0);
      return;
    }
    if (selectedIndex > totalItems - 1) setSelectedIndex(totalItems - 1);
  }, [totalItems, selectedIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        if (isDesktop) {
          inputRef.current?.focus();
          setShowDropdown(true);
        } else {
          setOverlayOpen((prev) => !prev);
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isDesktop]);

  useEffect(() => {
    if (overlayOpen) {
      refreshRecentSearches();
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery("");
    }
  }, [overlayOpen, refreshRecentSearches]);

  useEffect(() => {
    if (!showDropdown) {
      setSelectedIndex(0);
    }
  }, [showDropdown]);

  useEffect(() => {
    if (!showDropdown && !overlayOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (totalItems === 0) return;
        setSelectedIndex((prev) => Math.min(prev + 1, totalItems - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (totalItems === 0) return;
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && totalItems > 0) {
        if ((e.target as HTMLElement | null)?.closest("button")) return;
        e.preventDefault();
        const item = flatItems[selectedIndex];
        if (item) activateItem(item);
      } else if (e.key === "Escape") {
        e.preventDefault();
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
  ]);

  useEffect(() => {
    const el = listRef.current?.querySelector(
      `[data-index="${selectedIndex}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  useEffect(() => {
    if (!showDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showDropdown]);

  let globalIdx = 0;

  const handleAddToQueue = async (track: TrackWithRelations) => {
    rememberQuery();
    await addToQueue(track.file);
    toast(t("search.addedToQueue"));
    setShowDropdown(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
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
    const recents = loadRecentSearches(profileId);
    setRecentSearches(recents);
    const length = query.trim().length;
    if (
      length >= MIN_QUERY_LENGTH ||
      (length === 0 && recents.length > 0)
    ) {
      setShowDropdown(true);
    }
  };

  const renderResults = () => (
    <div className="no-scrollbar max-h-[60vh] overflow-y-auto" ref={listRef}>
      {loading && trimmedQuery.length >= MIN_QUERY_LENGTH && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
        </div>
      )}

      {!loading && (
        <div className="p-2">
          {sections.map((section) => (
            <div key={section.type} className="mb-2">
              <p className="text-muted-foreground px-2 py-1 text-xs font-semibold uppercase">
                {getSectionLabel(section.type)}
              </p>
              {section.items.map((item) => {
                const idx = globalIdx++;
                const isSelected = idx === selectedIndex;
                if (typeof item === "string") {
                  return (
                    <div
                      key={item}
                      data-index={idx}
                      className={`flex cursor-pointer items-center gap-3 rounded-sm px-2 py-2 text-sm transition-colors ${
                        isSelected ? "bg-accent/50" : "hover:bg-accent/50"
                      }`}
                      onClick={() => activateItem(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                    >
                      <History className="text-muted-foreground size-4 shrink-0" />
                      <span className="truncate">{item}</span>
                    </div>
                  );
                }
                if ("file" in item) {
                  const track = item as TrackWithRelations;
                  return (
                    <div
                      key={track.id}
                      data-index={idx}
                      className={`group flex cursor-pointer items-center gap-3 rounded-sm px-2 py-2 text-sm transition-colors ${
                        isSelected ? "bg-accent/50" : "hover:bg-accent/50"
                      }`}
                      onClick={() => activateItem(track)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                    >
                      <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded">
                        <img
                          src={getCoverPath(track.cover_path)}
                          alt=""
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = "/default_cover.png";
                          }}
                        />
                      </div>
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
                        className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddToQueue(track);
                        }}
                      >
                        {t("search.addToQueue")}
                      </Button>
                    </div>
                  );
                }
                if ("artist_name" in item && !("name" in item)) {
                  const album = item as Album;
                  return (
                    <div
                      key={album.id}
                      data-index={idx}
                      className={`flex cursor-pointer items-center gap-3 rounded-sm px-2 py-2 text-sm transition-colors ${
                        isSelected ? "bg-accent/50" : "hover:bg-accent/50"
                      }`}
                      onClick={() => activateItem(album)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                    >
                      <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded">
                        <img
                          src={getCoverPath(album.cover_path)}
                          alt=""
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = "/default_cover.png";
                          }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="truncate">{album.title}</span>
                        <span className="text-muted-foreground ml-2 text-xs">
                          {album.artist_name}
                        </span>
                      </div>
                    </div>
                  );
                }
                const artist = item as Artist;
                return (
                  <div
                    key={artist.id}
                    data-index={idx}
                    className={`flex cursor-pointer items-center gap-3 rounded-sm px-2 py-2 text-sm transition-colors ${
                      isSelected ? "bg-accent/50" : "hover:bg-accent/50"
                    }`}
                    onClick={() => activateItem(artist)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <MicVocal className="text-muted-foreground h-4 w-4" />
                    <span>{artist.name}</span>
                  </div>
                );
              })}
            </div>
          ))}

          {trimmedQuery.length < MIN_QUERY_LENGTH &&
            recentSearches.length === 0 && (
              <div className="text-muted-foreground flex items-center justify-center py-8 text-sm">
                {t("search.startTyping")}
              </div>
            )}

          {trimmedQuery.length >= MIN_QUERY_LENGTH &&
            !loading &&
            results &&
            results.artists.length === 0 &&
            results.albums.length === 0 &&
            results.tracks.length === 0 && (
              <div className="text-muted-foreground flex items-center justify-center py-8 text-sm">
                {t("search.noResults")}
              </div>
            )}
        </div>
      )}
    </div>
  );

  if (isDesktop) {
    return (
      <div className="relative w-100" ref={containerRef}>
        <div
          className="text-muted-foreground flex cursor-text items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors"
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
            {renderResults()}
          </div>
        )}
      </div>
    );
  }

  if (!overlayOpen) {
    return (
      <div
        onClick={() => setOverlayOpen(true)}
        className="text-muted-foreground flex cursor-pointer items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors"
      >
        <Search className="h-4 w-4" />
      </div>
    );
  }

  return (
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
              onChange={(e) => setQuery(e.target.value)}
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

        {renderResults()}
      </div>
    </div>
  );
}
