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
