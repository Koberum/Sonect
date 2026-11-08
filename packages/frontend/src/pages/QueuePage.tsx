import { useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ListMusic, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import type { QueuedTrack } from "@repo/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ListSkeleton } from "@/components/ui/list-skeleton";
import { usePlaybackContext } from "@/components/playback-context";
import { useAuth } from "@/features/auth/auth-context";
import { QueueTrackRow } from "@/features/queue/components/queue-track-row";
import {
  clearQueue,
  moveQueueItem,
  playQueueItem,
  removeFromQueue,
} from "@/features/player/api";
import { playerQueries } from "@/features/player/queries";
import { qk } from "@/lib/queryKeys";

function reorderTracks(
  tracks: QueuedTrack[],
  from: number,
  to: number,
): QueuedTrack[] {
  const next = [...tracks];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next.map((track, pos) => ({ ...track, pos }));
}

export default function QueuePage() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const profileId = profile?.id ?? "";
  const queueKey = qk.player.queue(profileId);
  const { playbackStatus, applyPlaybackStatus } = usePlaybackContext();
  const qc = useQueryClient();
  const [isDragging, setIsDragging] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const moveMutation = useMutation({
    mutationFn: ({ from, to }: { from: number; to: number }) =>
      moveQueueItem(from, to),
    onMutate: async ({ from, to }) => {
      await qc.cancelQueries({ queryKey: queueKey });
      const previous = qc.getQueryData<QueuedTrack[]>(queueKey);
      if (previous) {
        qc.setQueryData(queueKey, reorderTracks(previous, from, to));
      }
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        qc.setQueryData(queueKey, context.previous);
      }
      toast.error(t("queue.moveError"));
    },
    onSuccess: (status) => applyPlaybackStatus(status),
    onSettled: () => qc.invalidateQueries({ queryKey: queueKey }),
  });

  const removeMutation = useMutation({
    mutationFn: (pos: number) => removeFromQueue(pos),
    onMutate: async (pos) => {
      await qc.cancelQueries({ queryKey: queueKey });
      const previous = qc.getQueryData<QueuedTrack[]>(queueKey);
      if (previous) {
        const next = previous
          .filter((track) => track.pos !== pos)
          .map((track, index) => ({ ...track, pos: index }));
        qc.setQueryData(queueKey, next);
      }
      return { previous };
    },
    onError: (_error, _pos, context) => {
      if (context?.previous) {
        qc.setQueryData(queueKey, context.previous);
      }
      toast.error(t("queue.removeError"));
    },
    onSuccess: (status) => applyPlaybackStatus(status),
    onSettled: () => qc.invalidateQueries({ queryKey: queueKey }),
  });

  const clearMutation = useMutation({
    mutationFn: () => clearQueue(),
    onSuccess: (status) => {
      applyPlaybackStatus(status);
      qc.setQueryData(queueKey, []);
      toast.success(t("queue.cleared"));
    },
    onError: () => toast.error(t("queue.clearError")),
    onSettled: () => qc.invalidateQueries({ queryKey: queueKey }),
  });

  const queueMutationPending =
    moveMutation.isPending ||
    removeMutation.isPending ||
    clearMutation.isPending;

  const { data: queue = [], isPending } = useQuery({
    ...playerQueries.queue(profileId),
    refetchInterval: isDragging || queueMutationPending ? false : 10_000,
  });

  const handlePlay = async (pos: number) => {
    try {
      applyPlaybackStatus(await playQueueItem(pos));
      await qc.invalidateQueries({ queryKey: queueKey });
    } catch {
      toast.error(t("player.playbackError"));
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setIsDragging(false);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const from = queue.findIndex((track) => track.pos === Number(active.id));
    const to = queue.findIndex((track) => track.pos === Number(over.id));
    if (from < 0 || to < 0) return;
    moveMutation.mutate({ from, to });
  };

  const isMutating =
    moveMutation.isPending ||
    removeMutation.isPending ||
    clearMutation.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("queue.title")}
        description={
          queue.length > 0
            ? `${t("queue.tracksInQueue", { count: queue.length })} · ${t("queue.dragHint")}`
            : t("queue.emptyDescription")
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            disabled={queue.length === 0 || isMutating}
            onClick={() => setClearOpen(true)}
          >
            <Trash2 />
            {t("queue.clear")}
          </Button>
        }
      />

      {isPending ? (
        <ListSkeleton
          rows={6}
          className="space-y-1"
          itemClassName="h-14 w-full rounded-lg"
        />
      ) : queue.length === 0 ? (
        <EmptyState
          icon={ListMusic}
          title={t("queue.empty")}
          description={t("queue.emptyDescription")}
          action={
            <Button asChild variant="outline" size="sm">
              <Link to="/discover">{t("nav.discover")}</Link>
            </Button>
          }
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={() => setIsDragging(true)}
          onDragCancel={() => setIsDragging(false)}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={queue.map((track) => track.pos)}
            strategy={verticalListSortingStrategy}
          >
            <div
              role="list"
              aria-label={t("queue.title")}
              className="space-y-1"
            >
              {queue.map((track) => (
                <div role="listitem" key={track.pos}>
                  <QueueTrackRow
                    track={track}
                    isCurrent={track.file === playbackStatus.track?.file}
                    disabled={isMutating}
                    onPlay={() => void handlePlay(track.pos)}
                    onRemove={() => removeMutation.mutate(track.pos)}
                  />
                </div>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("queue.clearConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("queue.clearConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              onClick={() => clearMutation.mutate()}
            >
              {t("queue.clear")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
