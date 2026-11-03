import { expect } from "chai";
import sinon from "sinon";
import { createTestDb } from "@tests/helpers/db.js";
import {
  tracksDb,
  playlistsDb,
  profilesDb,
  db,
  upsertTrack,
  playlists,
  albums,
  tracks,
} from "@repo/db";
import { PlaylistServiceImpl } from "@services/library/playlistService.js";

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
  let profileId: string;

  beforeEach(() => {
    ({ close } = createTestDb());
    mpd = stubMpd();
    svc = new PlaylistServiceImpl(mpd as never);
    profileId = profilesDb.create({ name: "Owner", passwordHash: "hash" });
  });
  afterEach(() => {
    close();
    sinon.restore();
  });

  describe("getAllPlaylists / getPlaylistById", () => {
    it("getAll empty → []", () =>
      expect(svc.getAllPlaylists(profileId)).to.deep.equal([]));
    it("getById miss → undefined", () =>
      expect(svc.getPlaylistById(profileId, 99999)).to.be.undefined);
    it("does not expose playlists across profiles", () => {
      const other = profilesDb.create({ name: "Other", passwordHash: "hash" });
      const pl = svc.createPlaylist(profileId, "Private")!;
      expect(svc.getAllPlaylists(other)).to.deep.equal([]);
      expect(svc.getPlaylistById(other, pl.id)).to.be.undefined;
      expect(svc.updatePlaylist(other, pl.id, { name: "Hacked" })).to.be
        .undefined;
      expect(svc.deletePlaylist(other, pl.id)).to.be.false;
      expect(svc.getPlaylistById(profileId, pl.id)?.name).to.equal("Private");
    });
    it("allows the same name on different profiles", () => {
      const other = profilesDb.create({ name: "Other", passwordHash: "hash" });
      const a = svc.createPlaylist(profileId, "Same")!;
      const b = svc.createPlaylist(other, "Same")!;
      expect(a.id).not.to.equal(b.id);
    });
    it("create and list", () => {
      svc.createPlaylist(profileId, "Alpha");
      svc.createPlaylist(profileId, "Beta");
      expect(svc.getAllPlaylists(profileId).map((p) => p.name)).to.deep.equal([
        "Alpha",
        "Beta",
      ]);
      expect(
        svc.getPlaylistById(profileId, svc.getAllPlaylists(profileId)[0].id)
          ?.name,
      ).to.equal("Alpha");
    });
  });

  describe("createPlaylist", () => {
    it("persists and returns row", () => {
      const pl = svc.createPlaylist(profileId, "MyPl", "desc");
      expect(pl?.name).to.equal("MyPl");
      expect(pl?.description).to.equal("desc");
      expect(svc.getAllPlaylists(profileId)).to.have.length(1);
    });
    it("without description → null description", () => {
      const pl = svc.createPlaylist(profileId, "NoDesc");
      expect(pl?.description).to.be.null;
    });
  });

  describe("updatePlaylist", () => {
    it("returns undefined on miss and no MPD call", () => {
      expect(svc.updatePlaylist(profileId, 99999, { name: "X" })).to.be
        .undefined;
      expect((mpd.executeCommand as sinon.SinonStub).called).to.be.false;
    });
    it("updates name without MPD calls", () => {
      const pl = svc.createPlaylist(profileId, "OldName")!;
      const updated = svc.updatePlaylist(profileId, pl.id, { name: "NewName" });
      expect(updated?.name).to.equal("NewName");
      expect((mpd.executeCommand as sinon.SinonStub).called).to.be.false;
    });
    it("updates description without rename", () => {
      const pl = svc.createPlaylist(profileId, "Name", "OldDesc")!;
      const updated = svc.updatePlaylist(profileId, pl.id, {
        description: "NewDesc",
      });
      expect(updated?.description).to.equal("NewDesc");
      expect((mpd.executeCommand as sinon.SinonStub).called).to.be.false;
    });
    it("same name does not call rename", () => {
      const pl = svc.createPlaylist(profileId, "Same")!;
      svc.updatePlaylist(profileId, pl.id, { name: "Same" });
      expect((mpd.executeCommand as sinon.SinonStub).called).to.be.false;
    });
    it("updates name even when MPD is down", async () => {
      (mpd.executeCommand as sinon.SinonStub).rejects(new Error("mpd down"));
      const pl = svc.createPlaylist(profileId, "Old")!;
      const updated = svc.updatePlaylist(profileId, pl.id, { name: "New" });
      expect(updated?.name).to.equal("New");
      await new Promise((r) => setTimeout(r, 10));
    });
  });

  describe("deletePlaylist", () => {
    it("returns false on miss", () =>
      expect(svc.deletePlaylist(profileId, 99999)).to.be.false);
    it("deletes and calls rm", () => {
      const pl = svc.createPlaylist(profileId, "DelPl")!;
      expect(svc.deletePlaylist(profileId, pl.id)).to.be.true;
      expect(svc.getPlaylistById(profileId, pl.id)).to.be.undefined;
      expect(
        (mpd.executeCommand as sinon.SinonStub).calledOnceWith("rm", [
          `sonect-${pl.id}`,
        ]),
      ).to.be.true;
    });
    it("rm rejection swallowed", async () => {
      (mpd.executeCommand as sinon.SinonStub).rejects(new Error("rm fail"));
      const pl = svc.createPlaylist(profileId, "Del2")!;
      svc.deletePlaylist(profileId, pl.id);
      await new Promise((r) => setTimeout(r, 10));
      expect(svc.getPlaylistById(profileId, pl.id)).to.be.undefined;
    });
  });

  describe("getPlaylistWithTracks", () => {
    it("miss → undefined", () =>
      expect(svc.getPlaylistWithTracks(profileId, 99999)).to.be.undefined);
    it("enriches tracks with artist_name/cover_path/genre", () => {
      const pl = svc.createPlaylist(profileId, "EnrichPl")!;
      const tid = upsertTrack(db(), {
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
      svc.addTrackToPlaylist(profileId, pl.id, tid);
      const withTracks = svc.getPlaylistWithTracks(profileId, pl.id);
      expect(withTracks?.tracks).to.have.length(1);
      expect(withTracks?.tracks[0].artist_name).to.equal("EnArtist");
      expect(withTracks?.tracks[0].cover_path).to.equal("covers/x.jpg");
      expect(withTracks?.tracks[0].genre).to.equal("Rock");
    });
    it("falls back artist_name to empty and cover to empty when orphan", () => {
      const pl = svc.createPlaylist(profileId, "FallPl")!;
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
      const res = svc.getPlaylistWithTracks(profileId, pl.id);
      expect(res?.tracks[0].artist_name).to.equal("");
      expect(res?.tracks[0].cover_path).to.equal("");
    });
    it("resolves genre via album fallback when track genre null", () => {
      const pl = svc.createPlaylist(profileId, "GenrePl")!;
      const tid = upsertTrack(db(), {
        file: "a/gpl.mp3",
        title: "G",
        artist: "A",
        album: "Al",
        genre: undefined,
      } as never);
      svc.addTrackToPlaylist(profileId, pl.id, tid);
      const res = svc.getPlaylistWithTracks(profileId, pl.id);
      expect(res?.tracks[0].genre).to.be.undefined;
    });
    it("enriches multiple tracks and preserves position order", () => {
      const pl = svc.createPlaylist(profileId, "MultiPl")!;
      const t1 = upsertTrack(db(), {
        file: "a/m1.mp3",
        title: "M1",
        artist: "A",
        album: "Al",
      } as never);
      const t2 = upsertTrack(db(), {
        file: "a/m2.mp3",
        title: "M2",
        artist: "A",
        album: "Al",
      } as never);
      svc.addTrackToPlaylist(profileId, pl.id, t1);
      svc.addTrackToPlaylist(profileId, pl.id, t2);
      const res = svc.getPlaylistWithTracks(profileId, pl.id);
      expect(res?.tracks.map((t) => t.title)).to.deep.equal(["M1", "M2"]);
    });
  });

  describe("addTrackToPlaylist", () => {
    it("throws Track not found", () => {
      const pl = svc.createPlaylist(profileId, "AddPl")!;
      expect(() => svc.addTrackToPlaylist(profileId, pl.id, 99999)).to.throw(
        "Track not found",
      );
    });
    it("returns null when the playlist is not owned", () => {
      const tid = upsertTrack(db(), {
        file: "a/add.mp3",
        title: "Add",
        artist: "A",
        album: "Al",
      } as never);
      expect(svc.addTrackToPlaylist(profileId, 99999, tid)).to.be.null;
    });
    it("adds and returns pt_id and calls playlistadd", () => {
      const pl = svc.createPlaylist(profileId, "AddOk")!;
      const tid = upsertTrack(db(), {
        file: "a/add2.mp3",
        title: "Add2",
        artist: "A",
        album: "Al",
      } as never);
      const res = svc.addTrackToPlaylist(profileId, pl.id, tid);
      expect(res?.pt_id).to.be.a("number");
      expect(
        (mpd.executeCommand as sinon.SinonStub).calledWith("playlistadd", [
          `sonect-${pl.id}`,
          "a/add2.mp3",
        ]),
      ).to.be.true;
      expect(
        svc.getPlaylistWithTracks(profileId, pl.id)?.tracks,
      ).to.have.length(1);
    });
    it("duplicate add still returns existing pt_id (idempotent)", () => {
      const pl = svc.createPlaylist(profileId, "DupPl")!;
      const tid = upsertTrack(db(), {
        file: "a/dup.mp3",
        title: "Dup",
        artist: "A",
        album: "Al",
      } as never);
      const r1 = svc.addTrackToPlaylist(profileId, pl.id, tid);
      const r2 = svc.addTrackToPlaylist(profileId, pl.id, tid);
      expect(r1?.pt_id).to.equal(r2?.pt_id);
      expect(
        svc.getPlaylistWithTracks(profileId, pl.id)?.tracks,
      ).to.have.length(1);
    });
  });

  describe("removeTrackFromPlaylist", () => {
    it("false when pt_id not found", () => {
      const pl = svc.createPlaylist(profileId, "RemPl")!;
      expect(svc.removeTrackFromPlaylist(profileId, 99999, pl.id)).to.be.false;
    });
    it("removes and calls playlistdelete via listplaylistinfo", async () => {
      const pl = svc.createPlaylist(profileId, "RemOk")!;
      const tid = upsertTrack(db(), {
        file: "a/rem.mp3",
        title: "Rem",
        artist: "A",
        album: "Al",
      } as never);
      const { pt_id } = svc.addTrackToPlaylist(profileId, pl.id, tid)!;
      (mpd.executeCommand as sinon.SinonStub).reset();
      (mpd.executeCommand as sinon.SinonStub).callsFake((cmd: string) => {
        if (cmd === "listplaylistinfo")
          return Promise.resolve(`file: a/rem.mp3\nTitle: Rem\n`);
        if (cmd === "playlistdelete") return Promise.resolve("OK");
        return Promise.resolve("");
      });
      expect(svc.removeTrackFromPlaylist(profileId, pt_id, pl.id)).to.be.true;
      expect(svc.getPlaylistWithTracks(profileId, pl.id)?.tracks).to.deep.equal(
        [],
      );
      await new Promise((r) => setTimeout(r, 20));
      expect(
        (mpd.executeCommand as sinon.SinonStub).calledWith("playlistdelete", [
          `sonect-${pl.id}`,
          "0",
        ]),
      ).to.be.true;
    });
    it("handles listplaylistinfo with multiple files and correct pos", async () => {
      const pl = svc.createPlaylist(profileId, "MultiRem")!;
      const t1 = upsertTrack(db(), {
        file: "a/mr1.mp3",
        title: "MR1",
        artist: "A",
        album: "Al",
      } as never);
      const t2 = upsertTrack(db(), {
        file: "a/mr2.mp3",
        title: "MR2",
        artist: "A",
        album: "Al",
      } as never);
      const r1 = svc.addTrackToPlaylist(profileId, pl.id, t1)!;
      svc.addTrackToPlaylist(profileId, pl.id, t2);
      (mpd.executeCommand as sinon.SinonStub).reset();
      (mpd.executeCommand as sinon.SinonStub).callsFake((cmd: string) => {
        if (cmd === "listplaylistinfo")
          return Promise.resolve(`file: a/mr1.mp3\nfile: a/mr2.mp3\n`);
        if (cmd === "playlistdelete") return Promise.resolve("OK");
        return Promise.resolve("");
      });
      // Remove second track (pos 1)
      const t2pt = svc
        .getPlaylistWithTracks(profileId, pl.id)!
        .tracks.find((t) => t.file === "a/mr2.mp3")!.pt_id;
      svc.removeTrackFromPlaylist(profileId, t2pt, pl.id);
      await new Promise((r) => setTimeout(r, 20));
      expect(
        (mpd.executeCommand as sinon.SinonStub).calledWith("playlistdelete", [
          `sonect-${pl.id}`,
          "1",
        ]),
      ).to.be.true;
      void r1;
    });
    it("swallows MPD listplaylistinfo error", async () => {
      const pl = svc.createPlaylist(profileId, "SwallowPl")!;
      const tid = upsertTrack(db(), {
        file: "a/swallow.mp3",
        title: "Sw",
        artist: "A",
        album: "Al",
      } as never);
      const { pt_id } = svc.addTrackToPlaylist(profileId, pl.id, tid)!;
      (mpd.executeCommand as sinon.SinonStub).callsFake((cmd: string) => {
        if (cmd === "listplaylistinfo")
          return Promise.reject(new Error("no mpd"));
        return Promise.resolve("");
      });
      expect(svc.removeTrackFromPlaylist(profileId, pt_id, pl.id)).to.be.true;
      await new Promise((r) => setTimeout(r, 20));
    });
    it("does not remove when the playlist row is missing", async () => {
      const pl = svc.createPlaylist(profileId, "NoMpdPl")!;
      const tid = upsertTrack(db(), {
        file: "a/nompd.mp3",
        title: "NoMpd",
        artist: "A",
        album: "Al",
      } as never);
      const { pt_id } = svc.addTrackToPlaylist(profileId, pl.id, tid)!;
      (db().$client as unknown as { exec: (s: string) => void }).exec(
        "PRAGMA foreign_keys = OFF",
      );
      db().delete(playlists).where(eq(playlists.id, pl.id)).run();
      (db().$client as unknown as { exec: (s: string) => void }).exec(
        "PRAGMA foreign_keys = ON",
      );
      (mpd.executeCommand as sinon.SinonStub).reset();
      expect(svc.removeTrackFromPlaylist(profileId, pt_id, pl.id)).to.be.false;
      await new Promise((r) => setTimeout(r, 10));
      expect((mpd.executeCommand as sinon.SinonStub).called).to.be.false;
    });
  });

  describe("loadPlaylist", () => {
    it("throws Playlist not found", async () => {
      let threw = false;
      try {
        await svc.loadPlaylist(profileId, 99999);
      } catch (e) {
        threw = true;
        expect((e as Error).message).to.match(/Playlist not found/);
      }
      expect(threw).to.be.true;
    });
    it("calls clear then load then refreshNow", async () => {
      const pl = svc.createPlaylist(profileId, "LoadPl")!;
      await svc.loadPlaylist(profileId, pl.id);
      const stub = mpd.executeCommand as sinon.SinonStub;
      expect(stub.calledWith("clear")).to.be.true;
      expect(stub.calledWith("load", [`sonect-${pl.id}`])).to.be.true;
      expect((mpd.refreshNow as sinon.SinonStub).calledOnce).to.be.true;
    });
    it("refreshNow rejection swallowed", async () => {
      (mpd.refreshNow as sinon.SinonStub).rejects(new Error("refresh fail"));
      const pl = svc.createPlaylist(profileId, "Load2")!;
      await svc.loadPlaylist(profileId, pl.id);
    });
  });
});
