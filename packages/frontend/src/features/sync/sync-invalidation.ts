import type { QueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/queryKeys";

export function invalidateCatalogAfterSync(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: qk.catalog.root() });
  void queryClient.invalidateQueries({ queryKey: qk.dashboardRoot() });
  void queryClient.invalidateQueries({ queryKey: qk.likedRoot() });
  void queryClient.invalidateQueries({ queryKey: qk.playlistsRoot() });
}

export function invalidateSystemAfterSync(queryClient: QueryClient): void {
  invalidateCatalogAfterSync(queryClient);
  void queryClient.invalidateQueries({
    queryKey: qk.system.storageSources(),
  });
  void queryClient.invalidateQueries({
    queryKey: qk.system.detectedLibraries(),
  });
}
