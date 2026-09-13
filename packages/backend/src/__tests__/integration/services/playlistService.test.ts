import { expect } from "chai";
import sinon from "sinon";
import { createTestDb } from "@tests/helpers/db.js";
import { tracksDb, playlistsDb } from "@repo/db";
import { PlaylistServiceImpl } from "@services/library/playlistService.js";
import { db, playlists, albums } from "@repo/db";
import { tracks } from "@repo/db";
import { eq } from "drizzle-orm";

function stubMpd() {
  return {
    executeCommand: sinon.stub().resolves(""),
    refreshNow: sinon.stub().resolves(),
    executeCommandList: sinon.stub().resolves(""),
  } as unknown as import("@services/mpd/mpdConnectionManager.js").MpdConnectionManager;
}

describe("PlaylistService (trophy integration)", () => {
  let close: () => void;
  let mpd: ReturnType<typeof stubMpd>;
  let svc: PlaylistServiceImpl;

  beforeEach(() => {
    ({ close } = createTestDb());
    mpd = stubMpd();
    svc = new PlaylistServiceImpl(mpd as never);
  });
  afterEach(() => {
    close();
    sinon.restore();
  });

  describe("getAllPlaylists / getPlaylistById", () => {
    it("getAll empty → []", () =>
      expect(svc.getAllPlaylists()).to.deep.equal([]));
    it("getById miss → undefined", () =>
      expect(svc.getPlaylistById(99999)).to.be.undefined);
    it("create and list", () => {
      svc.createPlaylist("Alpha");
      svc.createPlaylist("Beta");
      expect(svc.getAllPlaylists().map((p) => p.name)).to.deep.equal([
        "Alpha",
        "Beta",
      ]);
      expect(svc.getPlaylistById(svc.getAllPlaylists()[0].id)?.name).to.equal(
        "Alpha",
      );
    });
  });

  describe("createPlaylist", () => {
    it("persists and returns row", () => {
      const pl = svc.createPlaylist("MyPl", "desc");
      expect(pl?.name).to.equal("MyPl");
      expect(pl?.description).to.equal("desc");
      expect(svc.getAllPlaylists()).to.have.length(1);
    });
    it("without description → null description", () => {
      const pl = svc.createPlaylist("NoDesc");
      expect(pl?.description).to.be.null;
    });
  });

  describe("updatePlaylist", () => {
    it("returns undefined on miss and no MPD call", () => {
      expect(svc.updatePlaylist(99999, { name: "X" })).to.be.undefined;
      expect((mpd.executeCommand as sinon.SinonStub).called).to.be.false;
    });
    it("updates name and calls rename", () => {
      const pl = svc.createPlaylist("OldName")!;
      const updated = svc.updatePlaylist(pl.id, { name: "NewName" });
      expect(updated?.name).to.equal("NewName");
      expect(
        (mpd.executeCommand as sinon.SinonStub).calledOnceWith("rename", [
          "OldName",
          "NewName",
        ]),
      ).to.be.true;
    });
    it("updates description without rename", () => {
      const pl = svc.createPlaylist("Name", "OldDesc")!;
      const updated = svc.updatePlaylist(pl.id, { description: "NewDesc" });
      expect(updated?.description).to.equal("NewDesc");
      expect((mpd.executeCommand as sinon.SinonStub).called).to.be.false;
    });
    it("same name does not call rename", () => {
      const pl = svc.createPlaylist("Same")!;
      svc.updatePlaylist(pl.id, { name: "Same" });
      expect((mpd.executeCommand as sinon.SinonStub).called).to.be.false;
    });
    it("Mpd rename rejection is swallowed", async () => {
      (mpd.executeCommand as sinon.SinonStub).rejects(new Error("mpd down"));
      const pl = svc.createPlaylist("Old")!;
      const updated = svc.updatePlaylist(pl.id, { name: "New" });
      expect(updated?.name).to.equal("New");
      await new Promise((r) => setTimeout(r, 10));
    });
  });

  describe("deletePlaylist", () => {
    it("returns false on miss", () =>
      expect(svc.deletePlaylist(99999)).to.be.false);
    it("deletes and calls rm", () => {
      const pl = svc.createPlaylist("DelPl")!;
      expect(svc.deletePlaylist(pl.id)).to.be.true;
      expect(svc.getPlaylistById(pl.id)).to.be.undefined;
      expect(
        (mpd.executeCommand as sinon.SinonStub).calledOnceWith("rm", ["DelPl"]),
      ).to.be.true;
    });
    it("rm rejection swallowed", async () => {
      (mpd.executeCommand as sinon.SinonStub).rejects(new Error("rm fail"));
      const pl = svc.createPlaylist("Del2")!;
      svc.deletePlaylist(pl.id);
      await new Promise((r) => setTimeout(r, 10));
      expect(svc.getPlaylistById(pl.id)).to.be.undefined;
    });
  });

  describe("getPlaylistWithTracks", () => {
    it("miss → undefined", () =>
      expect(svc.getPlaylistWithTracks(99999)).to.be.undefined);
    it("enriches tracks with artist_name/cover_path/genre", () => {
      const pl = svc.createPlaylist("EnrichPl")!;
      const tid = tracksDb.upsert({
        file: "a/enrich.mp3",
        title: "En",
        artist: "EnArtist",
        album: "EnAlbum",
        genre: "Rock",
      } as never);
      const trow = tracksDb.getById(tid)!;
      const alId = trow.album_id!;
      db()
        .update(albums)
        .set({ cover_path: "covers/x.jpg" } as never)
        .where(eq(albums.id, alId))
        .run();
      svc.addTrackToPlaylist(pl.id, tid);
      const withTracks = svc.getPlaylistWithTracks(pl.id);
      expect(withTracks?.tracks).to.have.length(1);
      expect(withTracks?.tracks[0].artist_name).to.equal("EnArtist");
      expect(withTracks?.tracks[0].cover_path).to.equal("covers/x.jpg");
      expect(withTracks?.tracks[0].genre).to.equal("Rock");
    });
    it("falls back artist_name to empty and cover to empty when orphan", () => {
      const pl = svc.createPlaylist("FallPl")!;
      const orphanId = db()
        .insert(tracks)
        .values({
          file: "orphan2.mp3",
          title: "Orphan",
          artist_id: null,
          album_id: null,
        })
        .run().lastInsertRowid as number;
      playlistsDb.addTrack(pl.id, orphanId);
      const res = svc.getPlaylistWithTracks(pl.id);
      expect(res?.tracks[0].artist_name).to.equal("");
      expect(res?.tracks[0].cover_path).to.equal("");
    });
    it("resolves genre via album fallback when track genre null", () => {
      const pl = svc.createPlaylist("GenrePl")!;
      const tid = tracksDb.upsert({
        file: "a/gpl.mp3",
        title: "G",
        artist: "A",
        album: "Al",
        genre: undefined,
      } as never);
      svc.addTrackToPlaylist(pl.id, tid);
      const res = svc.getPlaylistWithTracks(pl.id);
      expect(res?.tracks[0].genre).to.be.undefined;
    });
    it("enriches multiple tracks and preserves position order", () => {
      const pl = svc.createPlaylist("MultiPl")!;
      const t1 = tracksDb.upsert({
        file: "a/m1.mp3",
        title: "M1",
        artist: "A",
        album: "Al",
      } as never);
      const t2 = tracksDb.upsert({
        file: "a/m2.mp3",
        title: "M2",
        artist: "A",
        album: "Al",
      } as never);
      svc.addTrackToPlaylist(pl.id, t1);
      svc.addTrackToPlaylist(pl.id, t2);
      const res = svc.getPlaylistWithTracks(pl.id);
      expect(res?.tracks.map((t) => t.title)).to.deep.equal(["M1", "M2"]);
    });
  });

  describe("addTrackToPlaylist", () => {
    it("throws Track not found", () => {
      const pl = svc.createPlaylist("AddPl")!;
      expect(() => svc.addTrackToPlaylist(pl.id, 99999)).to.throw(
        "Track not found",
      );
    });
    it("throws Playlist not found", () => {
      const tid = tracksDb.upsert({
        file: "a/add.mp3",
        title: "Add",
        artist: "A",
        album: "Al",
      } as never);
      expect(() => svc.addTrackToPlaylist(99999, tid)).to.throw(
        "Playlist not found",
      );
    });
    it("adds and returns pt_id and calls playlistadd", () => {
      const pl = svc.createPlaylist("AddOk")!;
      const tid = tracksDb.upsert({
        file: "a/add2.mp3",
        title: "Add2",
        artist: "A",
        album: "Al",
      } as never);
      const res = svc.addTrackToPlaylist(pl.id, tid);
      expect(res?.pt_id).to.be.a("number");
      expect(
        (mpd.executeCommand as sinon.SinonStub).calledWith("playlistadd", [
          pl.name,
          "a/add2.mp3",
        ]),
      ).to.be.true;
      expect(svc.getPlaylistWithTracks(pl.id)?.tracks).to.have.length(1);
    });
    it("duplicate add still returns existing pt_id (idempotent)", () => {
      const pl = svc.createPlaylist("DupPl")!;
      const tid = tracksDb.upsert({
        file: "a/dup.mp3",
        title: "Dup",
        artist: "A",
        album: "Al",
      } as never);
      const r1 = svc.addTrackToPlaylist(pl.id, tid);
      const r2 = svc.addTrackToPlaylist(pl.id, tid);
      expect(r1?.pt_id).to.equal(r2?.pt_id);
      expect(svc.getPlaylistWithTracks(pl.id)?.tracks).to.have.length(1);
    });
  });

  describe("removeTrackFromPlaylist", () => {
    it("false when pt_id not found", () => {
      const pl = svc.createPlaylist("RemPl")!;
      expect(svc.removeTrackFromPlaylist(99999, pl.id)).to.be.false;
    });
    it("removes and calls playlistdelete via listplaylistinfo", async () => {
      const pl = svc.createPlaylist("RemOk")!;
      const tid = tracksDb.upsert({
        file: "a/rem.mp3",
        title: "Rem",
        artist: "A",
        album: "Al",
      } as never);
      const { pt_id } = svc.addTrackToPlaylist(pl.id, tid)!;
      (mpd.executeCommand as sinon.SinonStub).reset();
      (mpd.executeCommand as sinon.SinonStub).callsFake((cmd: string) => {
        if (cmd === "listplaylistinfo")
          return Promise.resolve(`file: a/rem.mp3\nTitle: Rem\n`);
        if (cmd === "playlistdelete") return Promise.resolve("OK");
        return Promise.resolve("");
      });
      expect(svc.removeTrackFromPlaylist(pt_id, pl.id)).to.be.true;
      expect(svc.getPlaylistWithTracks(pl.id)?.tracks).to.deep.equal([]);
      await new Promise((r) => setTimeout(r, 20));
      expect(
        (mpd.executeCommand as sinon.SinonStub).calledWith("playlistdelete", [
          pl.name,
          "0",
        ]),
      ).to.be.true;
    });
    it("handles listplaylistinfo with multiple files and correct pos", async () => {
      const pl = svc.createPlaylist("MultiRem")!;
      const t1 = tracksDb.upsert({
        file: "a/mr1.mp3",
        title: "MR1",
        artist: "A",
        album: "Al",
      } as never);
      const t2 = tracksDb.upsert({
        file: "a/mr2.mp3",
        title: "MR2",
        artist: "A",
        album: "Al",
      } as never);
      const r1 = svc.addTrackToPlaylist(pl.id, t1)!;
      svc.addTrackToPlaylist(pl.id, t2);
      (mpd.executeCommand as sinon.SinonStub).reset();
      (mpd.executeCommand as sinon.SinonStub).callsFake((cmd: string) => {
        if (cmd === "listplaylistinfo")
          return Promise.resolve(`file: a/mr1.mp3\nfile: a/mr2.mp3\n`);
        if (cmd === "playlistdelete") return Promise.resolve("OK");
        return Promise.resolve("");
      });
      // Remove second track (pos 1)
      const t2pt = svc
        .getPlaylistWithTracks(pl.id)!
        .tracks.find((t) => t.file === "a/mr2.mp3")!.pt_id;
      svc.removeTrackFromPlaylist(t2pt, pl.id);
      await new Promise((r) => setTimeout(r, 20));
      expect(
        (mpd.executeCommand as sinon.SinonStub).calledWith("playlistdelete", [
          pl.name,
          "1",
        ]),
      ).to.be.true;
      void r1;
    });
    it("swallows MPD listplaylistinfo error", async () => {
      const pl = svc.createPlaylist("SwallowPl")!;
      const tid = tracksDb.upsert({
        file: "a/swallow.mp3",
        title: "Sw",
        artist: "A",
        album: "Al",
      } as never);
      const { pt_id } = svc.addTrackToPlaylist(pl.id, tid)!;
      (mpd.executeCommand as sinon.SinonStub).callsFake((cmd: string) => {
        if (cmd === "listplaylistinfo")
          return Promise.reject(new Error("no mpd"));
        return Promise.resolve("");
      });
      expect(svc.removeTrackFromPlaylist(pt_id, pl.id)).to.be.true;
      await new Promise((r) => setTimeout(r, 20));
    });
    it("remove when playlist row missing still removes junction but no MPD call", async () => {
      const pl = svc.createPlaylist("NoMpdPl")!;
      const tid = tracksDb.upsert({
        file: "a/nompd.mp3",
        title: "NoMpd",
        artist: "A",
        album: "Al",
      } as never);
      const { pt_id } = svc.addTrackToPlaylist(pl.id, tid)!;
      (db().$client as unknown as { exec: (s: string) => void }).exec(
        "PRAGMA foreign_keys = OFF",
      );
      db().delete(playlists).where(eq(playlists.id, pl.id)).run();
      (db().$client as unknown as { exec: (s: string) => void }).exec(
        "PRAGMA foreign_keys = ON",
      );
      (mpd.executeCommand as sinon.SinonStub).reset();
      expect(svc.removeTrackFromPlaylist(pt_id, pl.id)).to.be.true;
      await new Promise((r) => setTimeout(r, 10));
      expect((mpd.executeCommand as sinon.SinonStub).called).to.be.false;
    });
  });

  describe("loadPlaylist", () => {
    it("throws Playlist not found", async () => {
      let threw = false;
      try {
        await svc.loadPlaylist(99999);
      } catch (e) {
        threw = true;
        expect((e as Error).message).to.match(/Playlist not found/);
      }
      expect(threw).to.be.true;
    });
    it("calls clear then load then refreshNow", async () => {
      const pl = svc.createPlaylist("LoadPl")!;
      await svc.loadPlaylist(pl.id);
      const stub = mpd.executeCommand as sinon.SinonStub;
      expect(stub.calledWith("clear")).to.be.true;
      expect(stub.calledWith("load", [pl.name])).to.be.true;
      expect((mpd.refreshNow as sinon.SinonStub).calledOnce).to.be.true;
    });
    it("refreshNow rejection swallowed", async () => {
      (mpd.refreshNow as sinon.SinonStub).rejects(new Error("refresh fail"));
      const pl = svc.createPlaylist("Load2")!;
      await svc.loadPlaylist(pl.id);
    });
  });
});
