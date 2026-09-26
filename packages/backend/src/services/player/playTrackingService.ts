import { EventEmitter } from "events";
import { tracksDb, albumsDb } from "@repo/db";

interface TrackEvent {
  id: number;
  album_id: number | null;
}

const DEBOUNCE_MS = 5000;

export class PlayTrackingService {
  private _lastTrackId: number | null = null;
  private _lastRecordedAt = 0;

  constructor(private _emitter: EventEmitter) {}

  start(): void {
    this._emitter.on("trackChanged", this._onTrackChanged.bind(this));
  }

  stop(): void {
    this._emitter.removeAllListeners("trackChanged");
  }

  private _onTrackChanged(track: TrackEvent): void {
    const now = Date.now();
    if (now - this._lastRecordedAt < DEBOUNCE_MS) return;
    if (track.id === this._lastTrackId) return;

    this._lastTrackId = track.id;
    this._lastRecordedAt = now;

    tracksDb.incrementPlayCount(track.id);
    if (track.album_id) {
      albumsDb.updateLastPlayed(track.album_id);
    }
  }
}
