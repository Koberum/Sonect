import type { TrackWithRelations } from "@repo/types/catalog";
import { usePlaybackContext } from "@/components/playback-context";
import { usePlayTrack } from "@/features/player/usePlayTrack";
import { useTrackDragHandlers } from "@/features/playlists/use-track-drag-handlers";
import { TrackActionsMenu } from "@/features/tracks/components/track-actions-menu";
import { parseYear } from "@/lib/utils";
import { MediaCard } from "./media-card";

export interface TrackCardProps {
  track: TrackWithRelations;
  className?: string;
}

export function TrackCard({ track, className }: TrackCardProps) {
  const { trackPlayed } = usePlaybackContext();
  const { play } = usePlayTrack();
  const dragHandlers = useTrackDragHandlers<HTMLDivElement>(track.id);
  const isPlaying = trackPlayed?.id === track.id;

  return (
    <MediaCard
      className={className}
      {...dragHandlers}
      artwork={{ kind: "single", src: track.cover_path, alt: track.title }}
      title={track.title}
      subtitle={track.artist_name || undefined}
      meta={parseYear(track.date)}
      isPlaying={isPlaying}
      likeTrackId={track.id}
      onActivate={() => {
        void play(track);
      }}
      actions={<TrackActionsMenu track={track} align="start" />}
    />
  );
}
