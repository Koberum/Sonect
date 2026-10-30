export const TRACK_DRAG_MIME = "application/x-sonect-track";

// Marks a drag as a Sonect track so drop targets can ignore unrelated drags
// (files, links, text selection).
export function setTrackDragData(
  dataTransfer: DataTransfer,
  trackId: number,
): void {
  dataTransfer.setData(TRACK_DRAG_MIME, String(trackId));
  dataTransfer.setData("text/plain", String(trackId));
  dataTransfer.effectAllowed = "copy";
}

export function isTrackDrag(dataTransfer: DataTransfer): boolean {
  return dataTransfer.types.includes(TRACK_DRAG_MIME);
}

export function getDraggedTrackId(dataTransfer: DataTransfer): number | null {
  const raw = dataTransfer.getData(TRACK_DRAG_MIME);
  const trackId = Number.parseInt(raw, 10);
  return Number.isFinite(trackId) && trackId > 0 ? trackId : null;
}
