import { after, afterEach, before, beforeEach, describe, it } from "mocha";
import { expect } from "chai";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DBAlbum, DBTrack } from "@repo/types";

describe("music repository contracts", () => {
  let dbModule: typeof import("@repo/db");
  let directory: string;
  let databasePath: string;

  before(async () => {
    dbModule = await import("@repo/db");
    directory = mkdtempSync(join(tmpdir(), "sonect-repositories-"));
    databasePath = join(directory, "music.db");
  });

  beforeEach(async () => {
    // Detach any connection another test suite left open, then open this
    // suite's own temporary native database so tests never share state.
    dbModule.closeDb();
    await dbModule.initDatabase(databasePath);
    dbModule
      .db()
      .$client.exec(
        "DELETE FROM tracks; DELETE FROM albums; DELETE FROM artists;",
      );
  });

  afterEach(() => {
    dbModule.closeDb();
  });

  after(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it("finds artists case-insensitively before creating them", () => {
    expect(dbModule.artistsDb.findOrCreate("ARTIST")).to.equal(
      dbModule.artistsDb.findOrCreate("Artist"),
    );
  });

  it("sorts albums by year descending with title as the tie-break", () => {
    const artistId = dbModule.artistsDb.findOrCreate("Year Artist");
    dbModule.albumsDb.findOrCreate("Oldest", artistId, 2001, "Rock");
    dbModule.albumsDb.findOrCreate("Newest", artistId, 2024, "Rock");
    expect(
      dbModule.albumsDb.getAll({ sort: "year" }).map((row) => row.title),
    ).to.deep.equal(["Newest", "Oldest"]);
  });

  it("retrieves an upserted track by file with fresh play statistics", () => {
    dbModule.tracksDb.upsert({
      file: "music/song.mp3",
      title: "Song",
      artist: "Song Artist",
      album: "Song Album",
    });
    const track: DBTrack | undefined =
      dbModule.tracksDb.getByFile("music/song.mp3");
    expect(track).to.include({
      file: "music/song.mp3",
      title: "Song",
      play_count: 0,
    });
  });

  it("returns artist, album, and cover aliases from track search", () => {
    dbModule.tracksDb.upsert({
      file: "music/song.mp3",
      title: "Song",
      artist: "Song Artist",
      album: "Song Album",
    });
    const results = dbModule.tracksDb.search("Song", 20);
    expect(results[0]).to.include.keys(
      "artist_name",
      "album_title",
      "cover_path",
    );
    expect(results[0]?.artist_name).to.equal("Song Artist");
    expect(results[0]?.album_title).to.equal("Song Album");
  });

  it("limits track search results to the requested amount", () => {
    for (const index of [1, 2, 3]) {
      dbModule.tracksDb.upsert({
        file: `music/limit-${index}.mp3`,
        title: `Limit Song ${index}`,
        artist: "Limit Artist",
        album: "Limit Album",
      });
    }
    expect(dbModule.tracksDb.search("Limit", 2)).to.have.length(2);
    expect(dbModule.tracksDb.search("Limit", 2)[0]?.title).to.equal(
      "Limit Song 1",
    );
  });

  it("resolves a track by artist, album, and title case-insensitively", () => {
    dbModule.tracksDb.upsert({
      file: "music/match.mp3",
      title: "Matched Song",
      artist: "Match Artist",
      album: "Match Album",
    });
    const track = dbModule.tracksDb.getByArtistAlbumTitle(
      "match artist",
      "Match Album",
      "Matched Song",
    );
    expect(track?.file).to.equal("music/match.mp3");
    expect(
      dbModule.tracksDb.getByArtistAlbumTitle(
        "Match Artist",
        "No Such Album",
        "Matched Song",
      ),
    ).to.be.undefined;
  });

  it("resolves an album by title and artist name case-insensitively", () => {
    const artistId = dbModule.artistsDb.findOrCreate("Resolve Artist");
    dbModule.albumsDb.findOrCreate("Resolve Album", artistId, 2019, "Rock");
    const album = dbModule.albumsDb.getByTitleAndArtist(
      "Resolve Album",
      "resolve artist",
    );
    expect(album?.title).to.equal("Resolve Album");
    expect(album?.year).to.equal(2019);
  });

  it("draws random tracks while excluding given files", () => {
    dbModule.tracksDb.upsert({ file: "music/keep.mp3", title: "Keep" });
    dbModule.tracksDb.upsert({ file: "music/skip.mp3", title: "Skip" });
    const random = dbModule.tracksDb.getRandomTracks(10, ["music/skip.mp3"]);
    expect(random.map(({ file }) => file)).to.deep.equal(["music/keep.mp3"]);
  });

  it("ranks albums by total plays with title breaking ties", () => {
    const artistId = dbModule.artistsDb.findOrCreate("Ranking Artist");
    const alphaId = dbModule.albumsDb.findOrCreate(
      "Alpha",
      artistId,
      2024,
      "Rock",
    );
    const zuluId = dbModule.albumsDb.findOrCreate(
      "Zulu",
      artistId,
      2024,
      "Rock",
    );
    const mostPlayedId = dbModule.albumsDb.findOrCreate(
      "Most played",
      artistId,
      2024,
      "Jazz",
    );
    seedAlbumPlayCounts({ [alphaId]: 3, [zuluId]: 3, [mostPlayedId]: 9 });
    expect(
      dbModule.albumsDb.getRankedByPlayCount().map(({ id }) => id),
    ).to.deep.equal([mostPlayedId, alphaId, zuluId]);
  });

  it("preserves playback statistics when incrementing plays", () => {
    const trackId = dbModule.tracksDb.upsert({
      file: "stats.mp3",
      title: "Stats",
    });
    dbModule.tracksDb.incrementPlayCount(trackId);
    const row = dbModule
      .db()
      .$client.prepare(
        "SELECT play_count, last_played FROM tracks WHERE id = ?",
      )
      .get(trackId) as { play_count: number; last_played: string | null };
    expect(row.play_count).to.equal(1);
    expect(row.last_played).to.not.be.null;
  });

  it("returns top tracks ordered by plays with artist and album aliases", () => {
    seedTopTracks();
    const top = dbModule.tracksDb.getTopTracks(10);
    expect(top).to.have.length(3);
    expect(top[0]?.title).to.equal("Often");
    expect(top[0]?.artist_name).to.equal("Top Artist");
    expect(top[0]?.album_title).to.equal("Top Album");
  });

  it("returns only tracks that have been played recently", () => {
    seedTopTracks();
    const recent = dbModule.tracksDb.getRecentlyPlayed(10);
    expect(recent.map(({ title }) => title).sort()).to.deep.equal([
      "Often",
      "Played Once",
    ]);
  });

  it("returns discovery candidates with low play counts from known genres", () => {
    seedTopTracks();
    const discovery = dbModule.tracksDb.getTracksForDiscovery(["Rock"], [], 10);
    const titles = discovery.map((track) => track.title);
    expect(titles).to.include("Played Once");
    expect(titles).to.not.include("Jazz Track");
    expect(titles).to.not.include("Often");
  });

  it("returns top genres and the single top genre by plays", () => {
    seedTopTracks();
    expect(dbModule.tracksDb.getTopGenres(5)).to.deep.equal(["Rock", "Jazz"]);
    expect(dbModule.tracksDb.getTopGenre()).to.equal("Rock");
  });

  it("returns top artists ordered by total plays", () => {
    seedTopTracks();
    const artists = dbModule.tracksDb.getTopArtists(5);
    expect(artists).to.have.length(1);
    expect(artists[0]?.name).to.equal("Top Artist");
    expect(artists[0]?.total).to.equal(4);
  });

  it("returns tracks of a genre ordered by play count", () => {
    seedTopTracks();
    const jazz = dbModule.tracksDb.getTracksByGenre("Jazz", 10);
    expect(jazz).to.have.length(1);
    expect(jazz[0]?.title).to.equal("Jazz Track");
  });

  it("stamps album last_played and lists recent albums with exclusions", () => {
    const artistId = dbModule.artistsDb.findOrCreate("Recent Artist");
    const keptId = dbModule.albumsDb.findOrCreate("Kept", artistId, 2024);
    const excludedId = dbModule.albumsDb.findOrCreate(
      "Excluded",
      artistId,
      2024,
    );

    dbModule.albumsDb.updateLastPlayed(keptId);
    dbModule.albumsDb.updateLastPlayed(excludedId);

    const album: DBAlbum | undefined = dbModule.albumsDb.getById(keptId);
    expect(album?.last_played).to.not.be.null;

    const recent = dbModule.albumsDb.getRecentAlbums(10);
    expect(recent.map(({ title }) => title).sort()).to.deep.equal([
      "Excluded",
      "Kept",
    ]);
    expect(
      dbModule.albumsDb.getRecentAlbums(10, excludedId).map(({ id }) => id),
    ).to.deep.equal([keptId]);
  });

  it("filters ranked albums by artist and genre", () => {
    const artistId = dbModule.artistsDb.findOrCreate("Cycle Artist");
    const firstId = dbModule.albumsDb.findOrCreate(
      "First",
      artistId,
      2024,
      "Rock",
    );
    const secondId = dbModule.albumsDb.findOrCreate(
      "Second",
      artistId,
      2024,
      "Rock",
    );
    seedAlbumPlayCounts({ [firstId]: 2, [secondId]: 1 });
    expect(
      dbModule.albumsDb
        .getRankedByPlayCount({ artistId, genre: "Rock" })
        .map(({ id }) => id),
    ).to.deep.equal([firstId, secondId]);
    expect(
      dbModule.albumsDb.getRankedByPlayCount({ artistId, genre: "Jazz" }),
    ).to.have.length(0);
  });

  // Inserts one uniquely named track per album through tracksDb.upsert() and
  // bumps its play count the requested number of times. The track carries no
  // artist, so upsert's album lookup never reassigns the album's artist.
  function seedAlbumPlayCounts(input: Record<number, number>): void {
    let sequence = 0;
    for (const [rawAlbumId, playCount] of Object.entries(input)) {
      sequence += 1;
      const albumId = Number(rawAlbumId);
      const album = dbModule.albumsDb.getById(albumId);
      if (!album) throw new Error(`Album ${albumId} does not exist`);
      const trackId = dbModule.tracksDb.upsert({
        file: `music/ranking-${sequence}.mp3`,
        title: `Ranking Track ${sequence}`,
        album: album.title,
      });
      for (let plays = 0; plays < playCount; plays += 1) {
        dbModule.tracksDb.incrementPlayCount(trackId);
      }
    }
  }

  // An often-played rock track, a once-played rock track, and an untouched
  // jazz track under one artist/album, for discovery and ordering checks.
  // Artist and album rows are created through tracksDb.upsert() itself.
  function seedTopTracks(): void {
    dbModule.artistsDb.findOrCreate("Top Artist");
    const oftenId = dbModule.tracksDb.upsert({
      file: "music/often.mp3",
      title: "Often",
      artist: "Top Artist",
      album: "Top Album",
      genre: "Rock",
    });
    const onceId = dbModule.tracksDb.upsert({
      file: "music/once.mp3",
      title: "Played Once",
      artist: "Top Artist",
      album: "Top Album",
      genre: "Rock",
    });
    dbModule.tracksDb.upsert({
      file: "music/jazz.mp3",
      title: "Jazz Track",
      artist: "Top Artist",
      album: "Top Album",
      genre: "Jazz",
    });
    for (let plays = 0; plays < 3; plays += 1) {
      dbModule.tracksDb.incrementPlayCount(oftenId);
    }
    dbModule.tracksDb.incrementPlayCount(onceId);
  }
});

describe("supporting repository contracts", () => {
  let dbModule: typeof import("@repo/db");
  let directory: string;
  let databasePath: string;

  before(async () => {
    dbModule = await import("@repo/db");
    directory = mkdtempSync(join(tmpdir(), "sonect-supporting-repositories-"));
    databasePath = join(directory, "music.db");
  });

  beforeEach(async () => {
    // Detach any connection another test suite left open, then open this
    // suite's own temporary native database so tests never share state.
    dbModule.closeDb();
    await dbModule.initDatabase(databasePath);
    dbModule
      .db()
      .$client.exec(
        "DELETE FROM playlist_tracks; DELETE FROM playlists; DELETE FROM sync_metadata;" +
          " DELETE FROM storage_sources; DELETE FROM setup_progress;" +
          " DELETE FROM tracks; DELETE FROM albums; DELETE FROM artists;",
      );
  });

  afterEach(() => {
    dbModule.closeDb();
  });

  after(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it("ignores duplicate playlist track additions at the same position", () => {
    const playlistId = dbModule.playlistsDb.create("Road trip");
    const firstTrackId = dbModule.tracksDb.upsert({
      file: "music/first.mp3",
      title: "First",
      artist: "Artist",
      album: "Album",
    });
    dbModule.playlistsDb.addTrack(playlistId, firstTrackId);
    dbModule.playlistsDb.addTrack(playlistId, firstTrackId);
    expect(
      dbModule.playlistsDb
        .getTracks(playlistId)
        .map(({ position }) => position),
    ).to.deep.equal([0]);
  });

  it("stores sync metadata as a single upserted value", () => {
    dbModule.syncMetadataDb.set("last_sync", "2026-09-05T12:00:00.000Z");
    dbModule.syncMetadataDb.set("last_sync", "2026-09-05T13:00:00.000Z");
    expect(dbModule.syncMetadataDb.getLastSync()?.toISOString()).to.equal(
      "2026-09-05T13:00:00.000Z",
    );
  });

  it("keeps storage source flags numeric and persists scan stats", () => {
    const localSource = {
      name: "Local",
      type: "local" as const,
      uri: "/srv/music",
      mount_path: "/opt/sonect/music/local",
      enabled: true,
    };
    const sourceId = dbModule.storageDb.create(localSource);
    expect(dbModule.storageDb.getById(sourceId)?.enabled).to.equal(1);
    dbModule.storageDb.updateStats(sourceId, {
      file_count: 2,
      dir_count: 1,
      total_size: 4096,
    });
    expect(dbModule.storageDb.getById(sourceId)).to.include({
      file_count: 2,
      dir_count: 1,
      total_size: 4096,
    });
  });

  it("toggles setup steps between completed and incomplete", () => {
    dbModule.setupDb.setCompleted("audio");
    expect(dbModule.setupDb.get("audio")?.completed).to.equal(true);
    dbModule.setupDb.setIncomplete("audio");
    expect(dbModule.setupDb.get("audio")?.completed).to.equal(false);
  });

  it("returns the complete dashboard statistics shape", () => {
    dbModule.playlistsDb.create("Road trip");
    dbModule.tracksDb.upsert({
      file: "music/first.mp3",
      title: "First",
      artist: "Artist",
      album: "Album",
      genre: "Rock",
      duration: 60,
      date: "2020",
    });
    dbModule.tracksDb.upsert({
      file: "music/second.mp3",
      title: "Second",
      artist: "Artist",
      genre: "Rock",
      duration: 120,
      date: "2024",
    });
    dbModule.syncMetadataDb.set("last_sync", "2026-09-05T13:00:00.000Z");
    expect(dbModule.statsDb.getStats()).to.deep.equal({
      totalTracks: 2,
      totalArtists: 1,
      totalAlbums: 1,
      totalPlaylists: 1,
      totalGenres: 1,
      totalDuration: 180,
      averageDuration: 90,
      earliestYear: 2020,
      latestYear: 2024,
      tracksWithoutAlbum: 1,
      lastSync: "2026-09-05T13:00:00.000Z",
    });
  });

  it("updates, orders, and deletes playlists", () => {
    const playlistId = dbModule.playlistsDb.create("Mixtape", "Summer picks");
    dbModule.playlistsDb.update(playlistId, {
      name: "Renamed",
      description: "Updated",
    });
    expect(dbModule.playlistsDb.getById(playlistId)).to.include({
      name: "Renamed",
      description: "Updated",
    });

    dbModule.playlistsDb.create("Aardvark");
    expect(dbModule.playlistsDb.getAll().map(({ name }) => name)).to.deep.equal(
      ["Aardvark", "Renamed"],
    );

    // Updating with no fields must be a no-op, not a blanket updated_at bump.
    dbModule.playlistsDb.update(playlistId, {});
    expect(dbModule.playlistsDb.getById(playlistId)).to.include({
      name: "Renamed",
    });

    dbModule.playlistsDb.delete(playlistId);
    expect(dbModule.playlistsDb.getById(playlistId)).to.be.undefined;
    expect(dbModule.playlistsDb.getAll().map(({ name }) => name)).to.deep.equal(
      ["Aardvark"],
    );
  });

  it("returns joined playlist tracks and removes them by row id", () => {
    const playlistId = dbModule.playlistsDb.create("Road trip");
    const trackId = dbModule.tracksDb.upsert({
      file: "music/joined.mp3",
      title: "Joined",
    });
    dbModule.playlistsDb.addTrack(playlistId, trackId);

    const tracks = dbModule.playlistsDb.getTracks(playlistId);
    expect(tracks).to.have.length(1);
    expect(tracks[0]).to.include.keys("pt_id", "position", "added_at");
    expect(tracks[0]).to.include({ file: "music/joined.mp3", position: 0 });

    dbModule.playlistsDb.removeTrack(tracks[0].pt_id);
    expect(dbModule.playlistsDb.getTracks(playlistId)).to.have.length(0);
  });

  it("reads missing sync metadata as undefined and stamps last sync", () => {
    expect(dbModule.syncMetadataDb.get("missing")).to.be.undefined;
    expect(dbModule.syncMetadataDb.getLastSync()).to.be.undefined;
    const before = Date.now();
    dbModule.syncMetadataDb.setLastSync();
    expect(dbModule.syncMetadataDb.getLastSync()?.getTime()).to.be.at.least(
      before,
    );
  });

  it("updates storage sources partially with numeric flags", () => {
    const sourceId = dbModule.storageDb.create({
      name: "NAS",
      type: "smb",
      uri: "smb://nas/share",
      mount_path: "/mnt/nas",
      username: "user",
      password: "pass",
      enabled: true,
    });
    dbModule.storageDb.update(sourceId, {
      name: "NAS renamed",
      enabled: false,
    });
    expect(dbModule.storageDb.getById(sourceId)).to.include({
      name: "NAS renamed",
      type: "smb",
      uri: "smb://nas/share",
      mount_path: "/mnt/nas",
      username: "user",
      password: "pass",
      enabled: 0,
    });

    dbModule.storageDb.delete(sourceId);
    expect(dbModule.storageDb.getById(sourceId)).to.be.undefined;
    expect(dbModule.storageDb.getAll()).to.have.length(0);
  });

  it("returns setup rows with completed converted to booleans", () => {
    dbModule.setupDb.setCompleted("storage");
    dbModule.setupDb.setCompleted("audio");
    const rows = dbModule.setupDb.getAll();
    expect(rows.map(({ step }) => step)).to.deep.equal(["storage", "audio"]);
    expect(rows.map(({ completed }) => completed)).to.deep.equal([true, true]);
    expect(dbModule.setupDb.get("sync")).to.be.undefined;
  });
});
