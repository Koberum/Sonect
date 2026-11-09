import { useMutation, useQuery } from "@tanstack/react-query";
import { systemMutations, systemQueries } from "@/features/system/queries";

/**
 * Shared library source state for Settings → Libraries and the setup wizard.
 */
export function useLibraries() {
  const sourcesQuery = useQuery(systemQueries.storageSources());
  const detectedQuery = useQuery(systemQueries.detectedLibraries());
  const createMut = useMutation(systemMutations.createStorageSource());
  const updateMut = useMutation(systemMutations.updateStorageSource());
  const deleteMut = useMutation(systemMutations.deleteStorageSource());
  const refreshMut = useMutation(systemMutations.refreshStorageStats());
  const computeMut = useMutation(systemMutations.computeStorageStats());

  const sources = sourcesQuery.data ?? [];
  const detected = (detectedQuery.data ?? []).filter(
    (library) => !library.registered,
  );

  return {
    sourcesQuery,
    detectedQuery,
    sources,
    detected,
    createMut,
    updateMut,
    deleteMut,
    refreshMut,
    computeMut,
  };
}
