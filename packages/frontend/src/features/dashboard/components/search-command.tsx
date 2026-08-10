import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Search, MicVocal, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { getCoverPath } from "@/lib/utils";
import { search } from "@/features/apis/libraryApis";
import { playSong, addToQueue } from "@/features/apis/mpdApis";
import type { Track, Album, Artist, SearchResults } from "@repo/types";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "react-responsive";

type SectionType = "artists" | "albums" | "tracks";

export function SearchCommand() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isDesktop = useMediaQuery({ minWidth: 768 });
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const MIN_QUERY_LENGTH = 2;
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const abortRef = useRef<AbortController | null>(null);

  const getSectionLabel = (type: SectionType): string => {
    switch (type) {
      case "artists":
        return t("search.artists");
      case "albums":
        return t("search.albums");
      case "tracks":
        return t("search.tracks");
    }
  };

  const handlePlayTrack = useCallback(async (track: Track) => {
    await playSong(track);
    setOverlayOpen(false);
    setShowDropdown(false);
  }, []);

  const closeSearch = useCallback(() => {
    setOverlayOpen(false);
    setShowDropdown(false);
    setQuery("");
    setResults(null);
  }, []);

  const activateItem = useCallback(
    (item: Artist | Album | Track) => {
      if ("file" in item) {
        handlePlayTrack(item as Track);
      } else if ("artist_name" in item && !("name" in item)) {
        navigate(`/albums/${(item as Album).id}`);
        closeSearch();
      } else {
        navigate(`/artists/${(item as Artist).id}/albums`);
        closeSearch();
      }
    },
    [handlePlayTrack, navigate, closeSearch],
  );

  const sections: { type: SectionType; items: (Artist | Album | Track)[] }[] =
    [];

  if (results) {
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
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery("");
      setResults(null);
    }
  }, [overlayOpen]);

  useEffect(() => {
    if (!showDropdown) {
      setSelectedIndex(0);
    }
  }, [showDropdown]);

  const doSearch = useCallback(async (q: string, signal?: AbortSignal) => {
    if (!q.trim()) {
      setResults(null);
      return;
    }
    setLoading(true);
    try {
      const data = await search(q, signal);
      if (!signal?.aborted) {
        setResults(data);
      }
    } catch {
      if (!signal?.aborted) {
        setResults(null);
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < MIN_QUERY_LENGTH) {
      setResults(null);
      setLoading(false);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    debounceRef.current = setTimeout(
      () => doSearch(query, controller.signal),
      350,
    );
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, doSearch]);

  useEffect(() => {
    if (!showDropdown && !overlayOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, totalItems - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && totalItems > 0) {
        e.preventDefault();
        activateItem(flatItems[selectedIndex]);
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

  const handleAddToQueue = async (track: Track) => {
    await addToQueue(track.file);
    toast(t("search.addedToQueue"));
    setShowDropdown(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    if (e.target.value.trim().length >= MIN_QUERY_LENGTH) {
      setShowDropdown(true);
    } else {
      setShowDropdown(false);
    }
  };

  const handleInputFocus = () => {
    if (query.trim().length >= MIN_QUERY_LENGTH) {
      setShowDropdown(true);
    }
  };

  const renderResults = () => (
    <div className="no-scrollbar max-h-[60vh] overflow-y-auto" ref={listRef}>
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
        </div>
      )}

      {!loading && results && (
        <div className="p-2">
          {sections.map((section) => (
            <div key={section.type} className="mb-2">
              <p className="text-muted-foreground px-2 py-1 text-xs font-semibold uppercase">
                {getSectionLabel(section.type)}
              </p>
              {section.items.map((item) => {
                const idx = globalIdx++;
                const isSelected = idx === selectedIndex;
                if ("file" in item) {
                  const track = item as Track;
                  return (
                    <div
                      key={track.id}
                      data-index={idx}
                      className={`group flex cursor-pointer items-center gap-3 rounded-sm px-2 py-2 text-sm transition-colors ${
                        isSelected ? "bg-accent/50" : "hover:bg-accent/50"
                      }`}
                      onClick={() => handlePlayTrack(track)}
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
                      onClick={() => {
                        navigate(`/albums/${album.id}`);
                        closeSearch();
                      }}
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
                    onClick={() => {
                      navigate(`/artists/${artist.id}/albums`);
                      closeSearch();
                    }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <MicVocal className="text-muted-foreground h-4 w-4" />
                    <span>{artist.name}</span>
                  </div>
                );
              })}
            </div>
          ))}

          {!query.trim() && (
            <div className="text-muted-foreground flex items-center justify-center py-8 text-sm">
              {t("search.startTyping")}
            </div>
          )}

          {query.trim() &&
            !loading &&
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
        {showDropdown && results && (
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
