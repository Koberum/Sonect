import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InfiniteData } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { LikedTracksPage } from "@repo/types/catalog";
import { useAuth } from "@/features/auth/auth-context";
import { qk } from "@/lib/queryKeys";
import { likedQueries } from "./queries";
import { likeTrack, unlikeTrack } from "./api";

export function useToggleLike(trackId: number) {
  const { profile } = useAuth();
  const profileId = profile?.id ?? "";
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const idsQuery = useQuery(likedQueries.ids(profileId));
  const ids = idsQuery.data ?? [];
  const liked = ids.includes(trackId);

  const mutation = useMutation({
    mutationFn: (next: boolean) =>
      next ? likeTrack(trackId) : unlikeTrack(trackId),
    onMutate: async (next) => {
      const idsKey = qk.liked.ids(profileId);
      const listKey = qk.liked.list(profileId);
      await queryClient.cancelQueries({ queryKey: idsKey });
      const previousIds = queryClient.getQueryData<number[]>(idsKey);
      const previousList =
        queryClient.getQueryData<InfiniteData<LikedTracksPage>>(listKey);

      queryClient.setQueryData<number[]>(idsKey, (old = []) =>
        next
          ? [trackId, ...old.filter((id) => id !== trackId)]
          : old.filter((id) => id !== trackId),
      );

      if (!next) {
        queryClient.setQueryData<InfiniteData<LikedTracksPage>>(
          listKey,
          (old) =>
            old
              ? {
                  ...old,
                  pages: old.pages.map((page) => ({
                    ...page,
                    items: page.items.filter((item) => item.id !== trackId),
                  })),
                }
              : old,
        );
      }

      return { previousIds, previousList };
    },
    onError: (_error, _next, context) => {
      if (context?.previousIds !== undefined) {
        queryClient.setQueryData(qk.liked.ids(profileId), context.previousIds);
      }
      if (context?.previousList !== undefined) {
        queryClient.setQueryData(
          qk.liked.list(profileId),
          context.previousList,
        );
      }
      toast.error(t("liked.updateError"));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: qk.liked.ids(profileId),
      });
      void queryClient.invalidateQueries({
        queryKey: qk.liked.list(profileId),
      });
    },
  });

  return {
    liked,
    isPending: !profileId || idsQuery.isPending || mutation.isPending,
    toggle: () => {
      if (!profileId || mutation.isPending) return;
      mutation.mutate(!liked);
    },
  };
}
