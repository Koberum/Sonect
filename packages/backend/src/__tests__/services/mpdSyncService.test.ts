import { expect } from "chai";
import sinon from "sinon";
import {
  albumsDb,
  artistsDb,
  initDatabase,
  initDb,
  librarySyncDb,
  tracksDb,
  db,
} from "@repo/db";
import { MpdSyncService } from "../../services/mpdSyncService";
import { mpdConnectionManager } from "../../services/mpdConnectionManager";

describe("MpdSyncService", () => {
  before(async () => {
    await initDb();
    await initDatabase();
  });

  beforeEach(() => {
    db().$client.exec(
      "DELETE FROM tracks; DELETE FROM albums; DELETE FROM artists;",
    );
  });

  afterEach(() => {
    sinon.restore();
  });

  it("preserves playback statistics when rebuilding the library", async () => {
    db()
      .$client.prepare("INSERT INTO artists (id, name) VALUES (1, 'Artist')")
      .run();
    db()
      .$client.prepare(
        "INSERT INTO albums (id, title, artist_id) VALUES (1, 'Album', 1)",
      )
      .run();
    db()
      .$client.prepare(
        `INSERT INTO tracks (id, file, title, artist_id, album_id, play_count, last_played)
         VALUES (1, 'music/song.mp3', 'Song', 1, 1, 7, '2026-01-02 03:04:05')`,
      )
      .run();
    sinon
      .stub(mpdConnectionManager, "executeCommand")
      .onFirstCall()
      .resolves("Album: Album")
      .onSecondCall()
      .resolves(
        "file: music/song.mp3\nArtist: Artist\nAlbum: Album\nTitle: Song\nTime: 120",
      );

    await new MpdSyncService().syncAll();

    const track = tracksDb.getByFile("music/song.mp3");
    expect(track?.play_count).to.equal(7);
    expect(track?.last_played).to.equal("2026-01-02 03:04:05");
  });

  describe("library rebuild atomicity", () => {
    it("keeps the existing library when MPD fetching fails", async () => {
      const keepId = tracksDb.upsert({
        file: "music/keep.mp3",
        title: "Keep",
        artist: "Artist",
        album: "Album",
      });
      for (let count = 0; count < 7; count++) {
        tracksDb.incrementPlayCount(keepId);
      }
      sinon
        .stub(mpdConnectionManager, "executeCommand")
        .rejects(new Error("offline"));

      let failure: unknown;
      try {
        await new MpdSyncService().syncAll();
      } catch (error) {
        failure = error;
      }

      expect(failure).to.be.instanceOf(Error);
      expect((failure as Error).message).to.equal("offline");
      expect(tracksDb.getByFile("music/keep.mp3")?.play_count).to.equal(7);
    });

    it("rolls back a rebuild when persistence fails unexpectedly", () => {
      const keepId = tracksDb.upsert({
        file: "music/keep.mp3",
        title: "Keep",
        artist: "Artist",
        album: "Album",
      });
      for (let count = 0; count < 7; count++) {
        tracksDb.incrementPlayCount(keepId);
      }
      const replacementTrack = {
        file: "music/new.mp3",
        title: "New",
        artist: "Artist",
        album: "Album",
      };
      expect(() =>
        librarySyncDb.rebuild([replacementTrack], () => {
          throw new Error("progress failed");
        }),
      ).to.throw("progress failed");
      expect(tracksDb.getByFile("music/keep.mp3")?.play_count).to.equal(7);
      expect(tracksDb.getByFile(replacementTrack.file)).to.equal(undefined);
    });

    it("counts malformed tracks as errors without aborting the rebuild", () => {
      const validTrack = {
        file: "music/valid.mp3",
        title: "Valid",
        artist: "Artist",
        album: "Album",
      };
      const result = librarySyncDb.rebuild([
        validTrack,
        {
          ...validTrack,
          file: null as unknown as string,
          // Distinct metadata so the assertion below proves the rejected
          // track's artist and album rows were rolled back with it.
          artist: "Ghost Artist",
          album: "Ghost Album",
        },
      ]);
      expect(result).to.deep.equal({ synced: 1, errors: 1 });
      expect(tracksDb.getByFile(validTrack.file)).not.to.equal(undefined);
      // No row with a null file was committed.
      expect(tracksDb.getAll().map((track) => track.file)).to.deep.equal([
        "music/valid.mp3",
      ]);
      // The artist/album created for the rejected track rolled back with it.
      expect(artistsDb.getAll().map((artist) => artist.name)).to.deep.equal([
        "Artist",
      ]);
      expect(albumsDb.getAll().map((album) => album.title)).to.deep.equal([
        "Album",
      ]);
    });
  });
});
