import { expect } from "chai";
import sinon from "sinon";
import { db, initDatabase, initDb, tracksDb } from "@repo/db";
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
});
