const TRACK_MIME = "application/x-sonect-track";

export function setTrackDragData(
  dataTransfer: DataTransfer,
  trackId: number,
): void {
  dataTransfer.setData(TRACK_MIME, String(trackId));
  dataTransfer.setData("text/plain", String(trackId));
  dataTransfer.effectAllowed = "copy";
}

export function getTrackDragId(dataTransfer: DataTransfer): number | null {
  const raw =
    dataTransfer.getData(TRACK_MIME) || dataTransfer.getData("text/plain");
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isTrackDrag(dataTransfer: DataTransfer): boolean {
  return dataTransfer.types.includes(TRACK_MIME);
}
