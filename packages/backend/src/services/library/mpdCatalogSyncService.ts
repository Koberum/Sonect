import path from "path";
import {
  albumsDb,
  catalogSyncDb,
  storageDb,
  syncMetadataDb,
  tracksDb,
} from "@repo/db";
import type {
  Album,
  CatalogTrack,
  LibrarySyncProgress,
} from "@repo/types/catalog";
import type { MPDTrack } from "@repo/types/mpd";
import type { MpdConnectionManager } from "@services/mpd/mpdConnectionManager";
import type { LogService } from "@services/utils/logService";
import { computeSourceStatsAsync } from "@services/storage/storageStats";
import { parseKeyValue, parseMPDTracks } from "../../utils/mpd";

export type CatalogSyncOptions = { force?: boolean };

export type CatalogSyncResult = {
  synced: number;
  deleted: number;
  errors: number;
  changedSourceIds: number[];
  skipped: boolean;
};

export interface CatalogSyncService {
  sync(
    options?: CatalogSyncOptions,
    onProgress?: (progress: LibrarySyncProgress) => void,
  ): Promise<CatalogSyncResult>;
}

type MpdStats = {
  songs: number;
  dbUpdate: string;
  dbPlaytime: number;
};

type SourcePrefix = {
  id: number;
  prefix: string;
};

type ServiceOptions = {
  pageSize?: number;
  pollIntervalMs?: number;
  updateTimeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
};

type Snapshot = ReturnType<typeof tracksDb.getSyncSnapshot>[number];

const DEFAULT_PAGE_SIZE = 500;
const DEFAULT_POLL_INTERVAL_MS = 500;
const DEFAULT_UPDATE_TIMEOUT_MS = 30 * 60 * 1000;
const PROGRESS_THROTTLE_MS = 100;
const ALL_FILES_FILTER = "(file != '')";

function getMusicDir(): string {
  return path.resolve(process.env.MUSIC_DIR ?? "/opt/sonect/music");
}

function normalizeRelative(value: string): string {
  return value.split(path.sep).join("/");
}

function isUnderPrefix(file: string, prefix: string): boolean {
  if (prefix === "" || prefix === ".") return true;
  return file === prefix || file.startsWith(prefix + "/");
}

function toInteger(value: string | number | undefined): number | null {
  if (value === undefined) return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function trackProgress(track: MPDTrack | null): {
  title: string;
  artist: string;
  album: string;
} | null {
  if (!track) return null;
  return {
    title: track.title ?? "",
    artist: track.artist ?? "",
    album: track.album ?? "",
  };
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

/**
 * Keep the Sonect catalog in sync with MPD's song database.
 *
 * MPD owns the scan: Sonect triggers `update`, waits for it, and reads the
 * resulting database in bounded `find` pages. The catalog diff is computed in
 * memory and applied in one transaction, so a failed read leaves the previous
 * catalog untouched. `force` bypasses the `db_update`/song-count shortcut and
 * is used by manual refreshes and storage-source changes.
 */
export class MpdCatalogSyncService implements CatalogSyncService {
  private readonly pageSize: number;
  private readonly pollIntervalMs: number;
  private readonly updateTimeoutMs: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private lastProgressAt = 0;

  constructor(
    private readonly mpd: MpdConnectionManager,
    private readonly log: LogService,
    options: ServiceOptions = {},
  ) {
    this.pageSize = Math.max(1, options.pageSize ?? DEFAULT_PAGE_SIZE);
    this.pollIntervalMs = Math.max(
      0,
      options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
    );
    this.updateTimeoutMs = options.updateTimeoutMs ?? DEFAULT_UPDATE_TIMEOUT_MS;
    this.sleep =
      options.sleep ??
      ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  async sync(
    options: CatalogSyncOptions = {},
    onProgress?: (progress: LibrarySyncProgress) => void,
  ): Promise<CatalogSyncResult> {
    this.lastProgressAt = 0;
    await this.updateAndWait(onProgress);

    const stats = await this.getStats();
    if (!options.force && this.isCurrent(stats)) {
      catalogSyncDb.applyIncremental({
        upserts: [],
        deletions: [],
        mpdDbUpdate: stats.dbUpdate,
        mpdSongs: stats.songs,
      });
      this.emitProgress(
        onProgress,
        {
          phase: "tracks",
          current: stats.songs,
          total: stats.songs,
          track: null,
        },
        true,
      );
      this.log.pushLog(
        "info",
        `MPD catalog unchanged (${stats.songs} tracks); skipped sync`,
      );
      return {
        synced: 0,
        deleted: 0,
        errors: 0,
        changedSourceIds: [],
        skipped: true,
      };
    }

    const mpdTracks = await this.fetchAllTracks(stats.songs, onProgress);
    const musicDir = getMusicDir();
    const sources = this.getSourcePrefixes(musicDir);
    const attributed: CatalogTrack[] = mpdTracks.map((track) => ({
      ...track,
      storageSourceId: this.attribute(track.file, sources),
    }));

    const snapshot = tracksDb.getSyncSnapshot();
    const snapshotByFile = new Map(snapshot.map((row) => [row.file, row]));
    const albums = new Map(albumsDb.getAll().map((album) => [album.id, album]));
    const upserts: CatalogTrack[] = [];
    const changedSourceIds = new Set<number>();

    for (let index = 0; index < attributed.length; index += 1) {
      const next = attributed[index];
      const existing = snapshotByFile.get(next.file);
      if (!existing || this.trackChanged(existing, next, albums)) {
        upserts.push(next);
        if (existing?.storage_source_id) {
          changedSourceIds.add(existing.storage_source_id);
        }
        if (next.storageSourceId) {
          changedSourceIds.add(next.storageSourceId);
        }
      }

      this.emitProgress(
        onProgress,
        {
          phase: "tracks",
          current: index + 1,
          total: stats.songs,
          track: trackProgress(next),
        },
        index === 0 || index === attributed.length - 1,
      );

      if (index > 0 && index % 500 === 0) {
        await yieldToEventLoop();
      }
    }

    const mpdFiles = new Set(attributed.map((track) => track.file));
    const deletions: string[] = [];
    for (const row of snapshot) {
      if (!mpdFiles.has(row.file)) {
        deletions.push(row.file);
        if (row.storage_source_id) {
          changedSourceIds.add(row.storage_source_id);
        }
      }
    }

    if (attributed.length === 0 && snapshot.length > 0) {
      await this.assertNotAccidentallyEmpty();
    }

    if (
      options.force &&
      upserts.length === 0 &&
      deletions.length === 0 &&
      sources.length > 0
    ) {
      for (const source of sources) changedSourceIds.add(source.id);
    }

    const result = catalogSyncDb.applyIncremental({
      upserts,
      deletions,
      mpdDbUpdate: stats.dbUpdate,
      mpdSongs: stats.songs,
    });

    this.log.pushLog(
      "info",
      `MPD catalog sync finished: ${result.synced} synced, ${result.deleted} deleted, ${result.errors} errors`,
    );

    this.emitProgress(
      onProgress,
      {
        phase: "tracks",
        current: stats.songs,
        total: stats.songs,
        track: null,
      },
      true,
    );

    return {
      ...result,
      changedSourceIds: [...changedSourceIds],
      skipped: false,
    };
  }

  private async updateAndWait(
    onProgress?: (progress: LibrarySyncProgress) => void,
  ): Promise<void> {
    this.emitProgress(
      onProgress,
      { phase: "mpd", current: 0, total: 0, track: null },
      true,
    );

    await this.mpd.executeCommand("update");
    const startedAt = Date.now();

    for (;;) {
      const status = parseKeyValue(await this.mpd.executeCommand("status"));
      if (!status.updating_db) return;
      if (Date.now() - startedAt > this.updateTimeoutMs) {
        throw new Error(
          "Timed out waiting for MPD to finish updating its database",
        );
      }
      await this.sleep(this.pollIntervalMs);
    }
  }

  private async getStats(): Promise<MpdStats> {
    const raw = parseKeyValue(await this.mpd.executeCommand("stats"));
    return {
      songs: Number.parseInt(raw.songs ?? "0", 10) || 0,
      dbUpdate: raw.db_update ?? "",
      dbPlaytime: Number.parseInt(raw.db_playtime ?? "0", 10) || 0,
    };
  }

  private isCurrent(stats: MpdStats): boolean {
    return (
      stats.dbUpdate !== "" &&
      syncMetadataDb.get("mpd_db_update") === stats.dbUpdate &&
      syncMetadataDb.get("mpd_songs") === String(stats.songs) &&
      tracksDb.count() === stats.songs
    );
  }

  private async fetchAllTracks(
    total: number,
    onProgress?: (progress: LibrarySyncProgress) => void,
  ): Promise<MPDTrack[]> {
    if (total === 0) return [];

    for (let attempt = 0; attempt < 2; attempt += 1) {
      let tracks: MPDTrack[];
      try {
        tracks = await this.fetchPaged(total, onProgress);
      } catch (err) {
        this.log.pushLog(
          "warn",
          "MPD find failed; falling back to listallinfo",
          { error: err instanceof Error ? err.message : err },
        );
        tracks = await this.fetchAllInfo(onProgress);
      }

      const unique = new Set(tracks.map((track) => track.file));
      if (unique.size === total) return tracks;

      this.log.pushLog(
        "warn",
        `MPD returned ${unique.size} unique tracks, expected ${total}; retrying`,
      );
    }

    throw new Error(
      `MPD catalog changed during sync (expected ${total} tracks); nothing applied`,
    );
  }

  private async fetchPaged(
    total: number,
    onProgress?: (progress: LibrarySyncProgress) => void,
  ): Promise<MPDTrack[]> {
    const byFile = new Map<string, MPDTrack>();

    for (let start = 0; start < total; start += this.pageSize) {
      const end = Math.min(start + this.pageSize, total);
      const raw = await this.mpd.executeCommand("find", [
        ALL_FILES_FILTER,
        "window",
        `${start}:${end}`,
      ]);
      const page = parseMPDTracks(raw);
      if (page.length === 0) {
        throw new Error(`MPD returned an empty page for ${start}:${end}`);
      }

      for (const track of page) byFile.set(track.file, track);

      const last = page[page.length - 1] ?? null;
      this.emitProgress(
        onProgress,
        {
          phase: "tracks",
          current: byFile.size,
          total,
          track: trackProgress(last),
        },
        byFile.size >= total,
      );
    }

    return [...byFile.values()];
  }

  private async fetchAllInfo(
    onProgress?: (progress: LibrarySyncProgress) => void,
  ): Promise<MPDTrack[]> {
    const raw = await this.mpd.executeCommand("listallinfo");
    const tracks = parseMPDTracks(raw);
    const last = tracks[tracks.length - 1] ?? null;
    this.emitProgress(
      onProgress,
      {
        phase: "tracks",
        current: tracks.length,
        total: tracks.length,
        track: trackProgress(last),
      },
      true,
    );
    return tracks;
  }

  private getSourcePrefixes(musicDir: string): SourcePrefix[] {
    return storageDb
      .getAll()
      .map((source) => ({
        id: source.id,
        prefix: normalizeRelative(path.relative(musicDir, source.path)),
      }))
      .filter(
        (source) =>
          source.prefix === "" ||
          (!source.prefix.startsWith("..") && !path.isAbsolute(source.prefix)),
      );
  }

  private attribute(file: string, sources: SourcePrefix[]): number | null {
    let best: SourcePrefix | null = null;
    for (const source of sources) {
      if (!isUnderPrefix(file, source.prefix)) continue;
      if (!best || source.prefix.length > best.prefix.length) {
        best = source;
      }
    }
    return best?.id ?? null;
  }

  private trackChanged(
    existing: Snapshot,
    next: CatalogTrack,
    albums: Map<number, Album>,
  ): boolean {
    const existingAlbum =
      existing.album_id === null ? undefined : albums.get(existing.album_id);
    const nextAlbumArtist = next.albumArtist ?? next.artist ?? null;
    const albumArtistChanged =
      next.album !== undefined &&
      (existingAlbum?.artist_name ?? null) !== nextAlbumArtist;

    return (
      existing.title !== (next.title || "Unknown") ||
      (existing.artist_name ?? null) !== (next.artist ?? null) ||
      (existing.album_title ?? null) !== (next.album ?? null) ||
      albumArtistChanged ||
      (existing.genre ?? null) !== (next.genre ?? null) ||
      (existing.track_number ?? null) !== toInteger(next.track) ||
      (existing.disc_number ?? null) !== toInteger(next.disc) ||
      (existing.duration ?? null) !== (next.duration ?? null) ||
      (existing.date ?? null) !== (next.date ?? null) ||
      (existing.storage_source_id ?? null) !== (next.storageSourceId ?? null)
    );
  }

  private async assertNotAccidentallyEmpty(): Promise<void> {
    // The catalog mirrors all of MPD, not only enabled storage sources, so a
    // disabled-but-registered library still protects its rows.
    for (const source of storageDb.getAll()) {
      let stats: Awaited<ReturnType<typeof computeSourceStatsAsync>>;
      try {
        stats = await computeSourceStatsAsync(source.path);
      } catch (err) {
        throw new Error(
          `MPD returned no songs and library "${source.name}" could not be read; keeping catalog`,
          { cause: err },
        );
      }
      if (stats.file_count > 0) {
        throw new Error(
          `MPD returned no songs but library "${source.name}" still contains ${stats.file_count} audio files; keeping catalog`,
        );
      }
    }
  }

  private emitProgress(
    onProgress: ((progress: LibrarySyncProgress) => void) | undefined,
    progress: LibrarySyncProgress,
    force = false,
  ): void {
    if (!onProgress) return;
    const now = Date.now();
    if (!force && now - this.lastProgressAt < PROGRESS_THROTTLE_MS) return;
    this.lastProgressAt = now;
    onProgress(progress);
  }
}
