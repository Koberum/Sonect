import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { TrackWithRelations } from "@repo/types/catalog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { formatTime } from "@/lib/format";
import { parseYear } from "@/lib/utils";
import { fileExtension, formatBitDepth, formatSampleRate } from "../quality";

interface TrackInfoDialogProps {
  track: TrackWithRelations;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? "font-mono text-xs break-all" : "break-words"}>
        {value}
      </dd>
    </>
  );
}

export function TrackInfoDialog({
  track,
  open,
  onOpenChange,
}: TrackInfoDialogProps) {
  const { t } = useTranslation();

  const year = parseYear(track.date);
  const hasAudio =
    track.bits_per_sample != null ||
    track.sample_rate != null ||
    track.channels != null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{track.title}</DialogTitle>
          <DialogDescription>
            {track.artist_name || track.album_title || "\u2014"}
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-2">
          <h2 className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            {t("trackInfo.details")}
          </h2>
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
            <InfoRow label={t("trackInfo.artist")} value={track.artist_name} />
            <InfoRow label={t("trackInfo.album")} value={track.album_title} />
            <InfoRow label={t("trackInfo.year")} value={year} />
            <InfoRow label={t("trackInfo.genre")} value={track.genre} />
            <InfoRow
              label={t("trackInfo.trackNumber")}
              value={track.track_number}
            />
            <InfoRow
              label={t("trackInfo.discNumber")}
              value={track.disc_number}
            />
            <InfoRow
              label={t("trackInfo.duration")}
              value={
                track.duration != null && track.duration > 0
                  ? formatTime(track.duration)
                  : null
              }
            />
            <InfoRow label={t("trackInfo.file")} value={track.file} mono />
            <InfoRow
              label={t("trackInfo.library")}
              value={track.storage_source_name}
            />
          </dl>
        </section>

        {hasAudio && (
          <>
            <Separator />
            <section className="space-y-2">
              <h2 className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                {t("trackInfo.audio")}
              </h2>
              <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
                <InfoRow
                  label={t("trackInfo.codec")}
                  value={fileExtension(track.file)}
                />
                <InfoRow
                  label={t("trackInfo.bitDepth")}
                  value={
                    track.bits_per_sample != null
                      ? formatBitDepth(track.bits_per_sample)
                      : null
                  }
                />
                <InfoRow
                  label={t("trackInfo.sampleRate")}
                  value={
                    track.sample_rate != null
                      ? formatSampleRate(track.sample_rate)
                      : null
                  }
                />
                <InfoRow
                  label={t("trackInfo.channels")}
                  value={
                    track.channels != null
                      ? t("trackInfo.channelsValue", {
                          count: track.channels,
                        })
                      : null
                  }
                />
              </dl>
            </section>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
