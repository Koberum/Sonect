import { expect } from "chai";
import sinon from "sinon";
import fs from "fs";
import os from "os";
import path from "path";
import { eq } from "drizzle-orm";
import { createTestDb } from "@tests/helpers/db.js";
import {
  catalogSyncDb,
  db,
  storageDb,
  syncMetadataDb,
  tracks,
  tracksDb,
  upsertTrack,
} from "@repo/db";
import type { LibrarySyncProgress } from "@repo/types/catalog";
import { MpdCatalogSyncService } from "@services/library/mpdCatalogSyncService.js";
import type { MpdConnectionManager } from "@services/mpd/mpdConnectionManager.js";
import type { LogService } from "@services/utils/logService.js";

type CommandStub = sinon.SinonStub<
  [command: string, args?: string[]],
  Promise<string>
>;

type TrackFixture = {
  file: string;
  title: string;
  artist?: string;
  album?: string;
  duration?: number;
  albumArtist?: string;
  genre?: string;
  track?: number;
  disc?: string;
  date?: string;
};

function mpdRecord(track: TrackFixture): string {
  const lines = [
    `file: ${track.file}`,
    "Last-Modified: 2026-01-02T03:04:05Z",
    `Title: ${track.title}`,
  ];
  if (track.artist) lines.push(`Artist: ${track.artist}`);
  if (track.album) lines.push(`Album: ${track.album}`);
  if (track.albumArtist) lines.push(`AlbumArtist: ${track.albumArtist}`);
  if (track.genre) lines.push(`Genre: ${track.genre}`);
  if (track.track) lines.push(`Track: ${track.track}`);
  if (track.disc) lines.push(`Disc: ${track.disc}`);
  if (track.date) lines.push(`Date: ${track.date}`);
  if (track.duration) lines.push(`Time: ${track.duration}`);
  return lines.join("\n");
}

function pageSlice(args: string[], all: TrackFixture[]): TrackFixture[] {
  const window = args[2];
  if (!window) return all;
  const [start, end] = window.split(":").map(Number);
  return all.slice(start, end);
}

describe("MpdCatalogSyncService (integration)", () => {
  let close: () => void;
  let sandbox: sinon.SinonSandbox;
  let musicDir: string;
  let logService: LogService;
  let originalMusicDir: string | undefined;

  beforeEach(() => {
    ({ close } = createTestDb());
    sandbox = sinon.createSandbox();
    musicDir = fs.mkdtempSync(path.join(os.tmpdir(), "sonect-mpd-sync-"));
    originalMusicDir = process.env.MUSIC_DIR;
    process.env.MUSIC_DIR = musicDir;
    logService = { pushLog: sandbox.stub() } as unknown as LogService;
  });

  afterEach(() => {
    sandbox.restore();
    close();
    fs.rmSync(musicDir, { recursive: true, force: true });
    if (originalMusicDir === undefined) delete process.env.MUSIC_DIR;
    else process.env.MUSIC_DIR = originalMusicDir;
  });

  function addSource(name: string, relativePath: string): number {
    const sourcePath = path.join(musicDir, relativePath);
    fs.mkdirSync(sourcePath, { recursive: true });
    return storageDb.create({ name, path: sourcePath, enabled: true });
  }

  function writeMusic(relativePath: string, content = "x"): void {
    const file = path.join(musicDir, relativePath);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }

  function makeMpd(
    tracksFixture: TrackFixture[],
    options: {
      dbUpdate?: string;
      songs?: number;
      findError?: Error;
    } = {},
  ): {
    mpd: MpdConnectionManager;
    execute: CommandStub;
    findCalls: () => number;
    countCalls: () => number;
  } {
    let updating = true;
    let findCalls = 0;
    let countCalls = 0;
    const dbUpdate = options.dbUpdate ?? "100";
    const songs = options.songs ?? tracksFixture.length;
    const execute = sandbox.stub() as CommandStub;
    execute.callsFake(async (command: string, args: string[] = []) => {
      switch (command) {
        case "update":
          return "updating_db: 1";
        case "status":
          if (updating) {
            updating = false;
            return "updating_db: 1";
          }
          return "state: stop";
        case "stats":
          return `songs: ${songs}\ndb_update: ${dbUpdate}\ndb_playtime: 600`;
        case "count":
          countCalls += 1;
          return `songs: ${songs}\nplaytime: 600`;
        case "find": {
          findCalls += 1;
          if (options.findError) throw options.findError;
          return pageSlice(args, tracksFixture).map(mpdRecord).join("\n");
        }
        case "listallinfo":
          return tracksFixture.map(mpdRecord).join("\n");
        default:
          throw new Error(`unexpected MPD command: ${command}`);
      }
    });
    return {
      mpd: { executeCommand: execute } as unknown as MpdConnectionManager,
      execute,
      findCalls: () => findCalls,
      countCalls: () => countCalls,
    };
  }

  function makeService(
    mpd: MpdConnectionManager,
    options: {
      pageSize?: number;
      pollIntervalMs?: number;
      updateTimeoutMs?: number;
    } = {},
  ): MpdCatalogSyncService {
    return new MpdCatalogSyncService(mpd, logService, {
      pageSize: options.pageSize ?? 2,
      pollIntervalMs: options.pollIntervalMs ?? 0,
      updateTimeoutMs: options.updateTimeoutMs ?? 1000,
      sleep: async () => {},
    });
  }

  const fixture: TrackFixture[] = [
    {
      file: "lib/a.mp3",
      title: "A",
      artist: "Artist",
      album: "Album",
      duration: 10,
    },
    {
      file: "lib/b.mp3",
      title: "B",
      artist: "Artist",
      album: "Album",
      duration: 10,
    },
    {
      file: "lib/rock/c.mp3",
      title: "C",
      artist: "Artist",
      album: "Album",
      duration: 10,
    },
  ];

  it("syncs all paged tracks, attributes the most specific source, and preserves play_count", async () => {
    const libId = addSource("Lib", "lib");
    const rockId = addSource("Rock", "lib/rock");
    const existingId = upsertTrack(db(), {
      file: "lib/a.mp3",
      title: "Old",
      artist: "Artist",
      album: "Album",
      storageSourceId: libId,
    });
    db()
      .update(tracks)
      .set({ play_count: 7 })
      .where(eq(tracks.id, existingId))
      .run();

    const { mpd, findCalls, countCalls } = makeMpd(fixture);
    const progress: LibrarySyncProgress[] = [];
    const result = await makeService(mpd).sync({ force: true }, (p) =>
      progress.push(p),
    );

    expect(result).to.deep.include({
      synced: 3,
      deleted: 0,
      errors: 0,
      skipped: false,
    });
    expect(result.changedSourceIds.sort()).to.deep.equal(
      [libId, rockId].sort(),
    );
    expect(findCalls()).to.equal(2);
    expect(countCalls()).to.equal(1);
    expect(tracksDb.getByFile("lib/a.mp3")?.play_count).to.equal(7);
    expect(tracksDb.getByFile("lib/a.mp3")?.storage_source_id).to.equal(libId);
    expect(tracksDb.getByFile("lib/b.mp3")?.storage_source_id).to.equal(libId);
    expect(tracksDb.getByFile("lib/rock/c.mp3")?.storage_source_id).to.equal(
      rockId,
    );
    expect(
      progress.some((p) => p.phase === "tracks" && p.track?.title === "A"),
    ).to.equal(true);
  });

  it("second sync skips the fetch when db_update and song count are unchanged", async () => {
    const libId = addSource("Lib", "lib");
    for (const item of fixture) {
      upsertTrack(db(), {
        file: item.file,
        title: item.title,
        artist: item.artist,
        album: item.album,
        duration: item.duration,
        storageSourceId: libId,
      });
    }
    catalogSyncDb.applyIncremental({
      upserts: [],
      deletions: [],
      mpdDbUpdate: "100",
      mpdSongs: 3,
    });

    const { mpd, findCalls } = makeMpd(fixture, { dbUpdate: "100", songs: 3 });
    const result = await makeService(mpd).sync();

    expect(result.skipped).to.equal(true);
    expect(result.synced).to.equal(0);
    expect(result.deleted).to.equal(0);
    expect(findCalls()).to.equal(0);
    expect(syncMetadataDb.get("last_sync")).to.be.a("string");
  });

  it("deletes rows missing from MPD and reports the changed source", async () => {
    const libId = addSource("Lib", "lib");
    upsertTrack(db(), {
      file: "lib/gone.mp3",
      title: "Gone",
      artist: "Artist",
      album: "Album",
      storageSourceId: libId,
    });

    const { mpd } = makeMpd(fixture, { dbUpdate: "101", songs: 3 });
    const result = await makeService(mpd).sync({ force: true });

    expect(result.deleted).to.equal(1);
    expect(tracksDb.getByFile("lib/gone.mp3")).to.be.undefined;
    expect(result.changedSourceIds).to.include(libId);
  });

  it("does not touch the catalog when MPD is unreachable", async () => {
    const libId = addSource("Lib", "lib");
    upsertTrack(db(), {
      file: "lib/keep.mp3",
      title: "Keep",
      storageSourceId: libId,
    });
    const execute = sandbox
      .stub()
      .rejects(new Error("MPD connection not available"));
    const mpd = { executeCommand: execute } as unknown as MpdConnectionManager;

    let error: unknown;
    try {
      await makeService(mpd).sync({ force: true });
    } catch (err) {
      error = err;
    }

    expect(error).to.be.instanceOf(Error);
    expect(tracksDb.getByFile("lib/keep.mp3")).to.exist;
  });

  it("refuses to empty the catalog when MPD reports zero but a library still has audio", async () => {
    const libId = addSource("Lib", "lib");
    writeMusic("lib/still-here.mp3");
    upsertTrack(db(), {
      file: "lib/old.mp3",
      title: "Old",
      storageSourceId: libId,
    });

    const { mpd } = makeMpd([], { dbUpdate: "200", songs: 0 });
    let error: unknown;
    try {
      await makeService(mpd).sync({ force: true });
    } catch (err) {
      error = err;
    }

    expect(error).to.be.instanceOf(Error);
    expect(String(error)).to.include("keeping catalog");
    expect(tracksDb.getByFile("lib/old.mp3")).to.exist;
  });

  it("falls back to listallinfo when find fails", async () => {
    const libId = addSource("Lib", "lib");
    void libId;
    const { mpd, findCalls } = makeMpd(fixture, {
      findError: new Error("Unknown filter"),
    });
    const result = await makeService(mpd).sync({ force: true });

    expect(result.synced).to.equal(3);
    expect(findCalls()).to.equal(1);
    expect(tracksDb.count()).to.equal(3);
  });

  it("refuses to apply a partial catalog when paged results do not add up", async () => {
    const libId = addSource("Lib", "lib");
    void libId;
    let updating = true;
    const execute = sandbox.stub().callsFake(async (command: string) => {
      if (command === "update") return "updating_db: 1";
      if (command === "status") {
        if (updating) {
          updating = false;
          return "updating_db: 1";
        }
        return "state: stop";
      }
      if (command === "stats")
        return "songs: 3\ndb_update: 102\ndb_playtime: 600";
      if (command === "count") return "songs: 3\nplaytime: 600";
      if (command === "find") {
        return [fixture[0], fixture[1]].map(mpdRecord).join("\n");
      }
      throw new Error(`unexpected ${command}`);
    });
    const mpd = { executeCommand: execute } as unknown as MpdConnectionManager;

    let error: unknown;
    try {
      await makeService(mpd).sync({ force: true });
    } catch (err) {
      error = err;
    }

    expect(error).to.be.instanceOf(Error);
    expect(tracksDb.count()).to.equal(0);
  });

  it("refuses to empty the catalog when the library path is readable but empty", async () => {
    const libId = addSource("Lib", "lib");
    upsertTrack(db(), {
      file: "lib/old.mp3",
      title: "Old",
      storageSourceId: libId,
    });

    const { mpd } = makeMpd([], { dbUpdate: "201", songs: 0 });
    let error: unknown;
    try {
      await makeService(mpd).sync({ force: true });
    } catch (err) {
      error = err;
    }

    expect(error).to.be.instanceOf(Error);
    expect(String(error)).to.include("keeping catalog");
    expect(tracksDb.getByFile("lib/old.mp3")).to.exist;
  });

  it("refuses to empty an unattributed catalog when MPD reports zero", async () => {
    upsertTrack(db(), { file: "stray.mp3", title: "Stray" });

    const { mpd } = makeMpd([], { dbUpdate: "202", songs: 0 });
    let error: unknown;
    try {
      await makeService(mpd).sync({ force: true });
    } catch (err) {
      error = err;
    }

    expect(error).to.be.instanceOf(Error);
    expect(tracksDb.getByFile("stray.mp3")).to.exist;
  });

  it("aborts when MPD changes between the fetch and the apply", async () => {
    const libId = addSource("Lib", "lib");
    upsertTrack(db(), {
      file: "lib/a.mp3",
      title: "A",
      storageSourceId: libId,
    });

    const shifted: TrackFixture[] = [
      { file: "lib/x.mp3", title: "X" },
      { file: "lib/y.mp3", title: "Y" },
    ];
    let updating = true;
    let statsCalls = 0;
    let countCalls = 0;
    const execute = sandbox.stub().callsFake(async (command: string) => {
      if (command === "update") return "updating_db: 1";
      if (command === "status") {
        if (updating) {
          updating = false;
          return "updating_db: 1";
        }
        return "state: stop";
      }
      if (command === "stats") {
        statsCalls += 1;
        return statsCalls === 1
          ? "songs: 2\ndb_update: 300\ndb_playtime: 20"
          : "songs: 2\ndb_update: 301\ndb_playtime: 20";
      }
      if (command === "count") {
        countCalls += 1;
        return "songs: 2\nplaytime: 20";
      }
      if (command === "find") {
        return shifted.map(mpdRecord).join("\n");
      }
      throw new Error(`unexpected ${command}`);
    });
    const mpd = { executeCommand: execute } as unknown as MpdConnectionManager;

    let error: unknown;
    try {
      await makeService(mpd).sync({ force: true });
    } catch (err) {
      error = err;
    }

    expect(error).to.be.instanceOf(Error);
    expect(countCalls).to.equal(1);
    expect(statsCalls).to.equal(2);
    expect(tracksDb.getByFile("lib/a.mp3")).to.exist;
    expect(tracksDb.getByFile("lib/x.mp3")).to.be.undefined;
  });

  it("does not oscillate on albums sharing a title with different artists", async () => {
    addSource("Lib", "lib");
    const sharedAlbum: TrackFixture[] = [
      {
        file: "lib/a.mp3",
        title: "A",
        artist: "Artist A",
        album: "Greatest Hits",
      },
      {
        file: "lib/b.mp3",
        title: "B",
        artist: "Artist B",
        album: "Greatest Hits",
      },
    ];
    const { mpd } = makeMpd(sharedAlbum, { dbUpdate: "400", songs: 2 });
    const service = makeService(mpd);

    const first = await service.sync({ force: true });
    const second = await service.sync({ force: true });

    expect(first.synced).to.equal(2);
    expect(second.synced).to.equal(0);
  });
});
