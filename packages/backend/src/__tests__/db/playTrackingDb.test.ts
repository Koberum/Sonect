import { describe, it, before, beforeEach } from "mocha";
import { expect } from "chai";

describe("play tracking DB helpers", () => {
  let dbModule: any;
  const db = () => dbModule.db().$client;

  before(async () => {
    const { initDb, initDatabase } = await import("@repo/db");
    await initDb();
    await initDatabase();
    dbModule = await import("@repo/db");
  });

  beforeEach(() => {
    db().prepare("DELETE FROM tracks").run();
    db().prepare("DELETE FROM albums").run();
    db().prepare("DELETE FROM artists").run();
    db()
      .prepare("INSERT INTO artists (id, name) VALUES (1, 'Test Artist')")
      .run();
    db()
      .prepare(
        "INSERT INTO albums (id, title, artist_id, last_played) VALUES (1, 'Test Album', 1, '2025-01-01')",
      )
      .run();
    db()
      .prepare(
        `INSERT INTO tracks (id, file, title, artist_id, album_id, genre, play_count, last_played)
                   VALUES (1, 'test.mp3', 'Test Track', 1, 1, 'Rock', 0, NULL)`,
      )
      .run();
    db()
      .prepare(
        `INSERT INTO tracks (id, file, title, artist_id, album_id, genre, play_count, last_played)
                   VALUES (2, 'test2.mp3', 'Test Track 2', 1, 1, 'Rock', 5, '2025-01-01')`,
      )
      .run();
    db()
      .prepare(
        `INSERT INTO tracks (id, file, title, artist_id, album_id, genre, play_count, last_played)
                   VALUES (3, 'test3.mp3', 'Test Track 3', 1, 1, 'Jazz', 0, NULL)`,
      )
      .run();
  });

  it("incrementPlayCount should increment play_count and set last_played", () => {
    const { tracksDb } = dbModule;
    tracksDb.incrementPlayCount(1);
    const row = db()
      .prepare("SELECT play_count, last_played FROM tracks WHERE id = 1")
      .get() as any;
    expect(row.play_count).to.equal(1);
    expect(row.last_played).to.not.be.null;
  });

  it("getTopTracks should return tracks ordered by play_count DESC", () => {
    const { tracksDb } = dbModule;
    const top = tracksDb.getTopTracks(10);
    expect(top).to.have.length(3);
    expect(top[0].id).to.equal(2);
    expect(top[0].artist_name).to.equal("Test Artist");
    expect(top[0].album_title).to.equal("Test Album");
  });

  it("getRecentlyPlayed should return tracks with last_played set", () => {
    const { tracksDb } = dbModule;
    const recent = tracksDb.getRecentlyPlayed(10);
    expect(recent).to.have.length(1);
    expect(recent[0].id).to.equal(2);
  });

  it("getTracksForDiscovery should return tracks with low play count from given genres", () => {
    const { tracksDb } = dbModule;
    const discovery = tracksDb.getTracksForDiscovery(["Rock"], [], 10);
    expect(discovery.some((t: any) => t.id === 1)).to.be.true;
    expect(discovery.some((t: any) => t.id === 3)).to.be.false;
  });

  it("getTopGenres should return genres ordered by total play_count", () => {
    const { tracksDb } = dbModule;
    const genres = tracksDb.getTopGenres(5);
    expect(genres).to.deep.equal(["Rock", "Jazz"]);
  });

  it("getTopArtists should return artists ordered by total play_count", () => {
    const { tracksDb } = dbModule;
    const artists = tracksDb.getTopArtists(5);
    expect(artists).to.have.length(1);
    expect(artists[0].name).to.equal("Test Artist");
  });

  it("getTopGenre should return the single top genre", () => {
    const { tracksDb } = dbModule;
    const genre = tracksDb.getTopGenre();
    expect(genre).to.equal("Rock");
  });

  it("getTracksByGenre should return tracks filtered by genre", () => {
    const { tracksDb } = dbModule;
    const tracks = tracksDb.getTracksByGenre("Jazz", 10);
    expect(tracks).to.have.length(1);
    expect(tracks[0].id).to.equal(3);
  });

  it("updateLastPlayed should set last_played on album", () => {
    const { albumsDb } = dbModule;
    albumsDb.updateLastPlayed(1);
    const row = db()
      .prepare("SELECT last_played FROM albums WHERE id = 1")
      .get() as any;
    expect(row.last_played).to.not.be.null;
  });

  it("getRecentAlbums should return albums ordered by last_played DESC", () => {
    const { albumsDb } = dbModule;
    const recent = albumsDb.getRecentAlbums(10);
    expect(recent).to.have.length(1);
    expect(recent[0].title).to.equal("Test Album");
  });

  it("getRecentAlbums should exclude album by id", () => {
    const { albumsDb } = dbModule;
    const recent = albumsDb.getRecentAlbums(10, 1);
    expect(recent).to.have.length(0);
  });

  it("getRankedByPlayCount should rank albums by total plays then title", () => {
    const { albumsDb } = dbModule;
    db()
      .prepare(
        "INSERT INTO albums (id, title, artist_id, genre) VALUES (2, 'Zulu', 1, 'Rock'), (3, 'Alpha', 1, 'Rock'), (4, 'Most played', 1, 'Jazz')",
      )
      .run();
    db()
      .prepare(
        `INSERT INTO tracks (id, file, title, artist_id, album_id, genre, play_count)
         VALUES (4, 'zulu.mp3', 'Zulu', 1, 2, 'Rock', 3),
                (5, 'alpha.mp3', 'Alpha', 1, 3, 'Rock', 3),
                (6, 'most-1.mp3', 'Most 1', 1, 4, 'Jazz', 4),
                (7, 'most-2.mp3', 'Most 2', 1, 4, 'Jazz', 5)`,
      )
      .run();

    const ranked = albumsDb.getRankedByPlayCount();

    expect(ranked.map((album: { id: number }) => album.id)).to.deep.equal([
      4, 1, 3, 2,
    ]);
  });
});
