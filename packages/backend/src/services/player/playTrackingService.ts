import { EventEmitter } from "events";
import { albumsDb, playHistoryDb, tracksDb } from "@repo/db";

type TrackChangedPayload = {
  sessionId: string;
  track: { id: number; album_id?: number };
};

const DEBOUNCE_MS = 5000;

export class PlayTrackingService {
  private _lastByProfile = new Map<string, { trackId: number; at: number }>();

  constructor(private _router: EventEmitter) {}

  start(): void {
    this._router.on("trackChanged", this._onTrackChanged.bind(this));
  }

  private _onTrackChanged(payload: TrackChangedPayload): void {
    const { sessionId, track } = payload;
    const now = Date.now();
    const last = this._lastByProfile.get(sessionId);
    if (last && last.trackId === track.id && now - last.at < DEBOUNCE_MS) {
      return;
    }

    const dbTrack = tracksDb.getById(track.id);
    if (!dbTrack) return;

    this._lastByProfile.set(sessionId, { trackId: dbTrack.id, at: now });
    playHistoryDb.record(sessionId, dbTrack.id, now);
    tracksDb.incrementPlayCount(dbTrack.id);
    if (dbTrack.album_id) {
      albumsDb.updateLastPlayed(dbTrack.album_id);
    }
  }
}
