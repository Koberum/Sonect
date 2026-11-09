import type { DragEvent } from "react";
import { useTrackDrag } from "./playlist-drop-context";
import { setTrackDragData } from "./track-drag";

/**
 * Drag wiring shared by track rows, track cards and search results. The
 * generic is the element the handlers are attached to.
 */
export function useTrackDragHandlers<T extends HTMLElement>(trackId: number) {
  const { startDrag, endDrag } = useTrackDrag();

  return {
    draggable: true as const,
    onDragStart: (event: DragEvent<T>) => {
      setTrackDragData(event.dataTransfer, trackId);
      startDrag(trackId);
    },
    onDragEnd: endDrag,
  };
}
