import { createContext, useContext } from "react";

export interface TrackDragContextValue {
  startDrag(trackId: number): void;
  endDrag(): void;
}

export const TrackDragContext = createContext<TrackDragContextValue | null>(
  null,
);

export function useTrackDrag(): TrackDragContextValue {
  const context = useContext(TrackDragContext);
  if (!context) {
    throw new Error("useTrackDrag must be used within PlaylistDropProvider");
  }
  return context;
}
