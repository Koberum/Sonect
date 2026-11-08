import { useCallback, useEffect, useState } from "react";
import {
  loadRecentSearches,
  saveRecentSearch,
} from "@/features/search/recent-searches";

/** Per-profile recent search terms, captured only when a result is used. */
export function useRecentSearches(profileId: string) {
  const [recentSearches, setRecentSearches] = useState<string[]>(() =>
    loadRecentSearches(profileId),
  );

  useEffect(() => {
    setRecentSearches(loadRecentSearches(profileId));
  }, [profileId]);

  const refresh = useCallback(() => {
    setRecentSearches(loadRecentSearches(profileId));
  }, [profileId]);

  const remember = useCallback(
    (term: string) => {
      setRecentSearches(saveRecentSearch(profileId, term));
    },
    [profileId],
  );

  return { recentSearches, refresh, remember };
}
