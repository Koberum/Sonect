export const MAX_RECENT_SEARCHES = 5;

const STORAGE_KEY_PREFIX = "sonect.recentSearches.";

function storageKey(profileId: string): string {
  return `${STORAGE_KEY_PREFIX}${profileId}`;
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && !!window.sessionStorage;
}

export function loadRecentSearches(profileId: string): string[] {
  if (!profileId || !canUseStorage()) return [];
  try {
    const raw = window.sessionStorage.getItem(storageKey(profileId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .slice(0, MAX_RECENT_SEARCHES);
  } catch {
    return [];
  }
}

export function saveRecentSearch(profileId: string, term: string): string[] {
  const normalized = term.trim();
  if (!profileId || !normalized || !canUseStorage()) {
    return loadRecentSearches(profileId);
  }

  const lower = normalized.toLowerCase();
  const next = [
    normalized,
    ...loadRecentSearches(profileId).filter(
      (item) => item.toLowerCase() !== lower,
    ),
  ].slice(0, MAX_RECENT_SEARCHES);

  try {
    window.sessionStorage.setItem(storageKey(profileId), JSON.stringify(next));
  } catch {
    // Ignore quota/security errors; recents just won't persist.
  }
  return next;
}
