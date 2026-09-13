import { expect } from "chai";
import { createTestDb } from "@tests/helpers/db.js";
import { playlistsDb, tracksDb } from "@repo/db";
import { db } from "@repo/db";
import { playlists, playlistTracks } from "@repo/db";
import { eq } from "drizzle-orm";

describe("playlistsDb (trophy integration)", () => {
  let close: () => void;
  beforeEach(() => {
    ({ close } = createTestDb());
  });
  afterEach(() => close());

  describe("getAll / getById / create", () => {
    it("getAll empty → []", () =>
      expect(playlistsDb.getAll()).to.deep.equal([]));
    it("getById miss → undefined", () =>
      expect(playlistsDb.getById(99999)).to.be.undefined);
    it("create returns id and getById found", () => {
      const id = playlistsDb.create("MyPl", "desc");
      expect(playlistsDb.getById(id)?.name).to.equal("MyPl");
      expect(playlistsDb.getById(id)?.description).to.equal("desc");
    });
    it("create without description → null", () => {
      const id = playlistsDb.create("NoDesc");
      expect(playlistsDb.getById(id)?.description).to.be.null;
    });
    it("getAll orders asc(name)", () => {
      playlistsDb.create("Zebra");
      playlistsDb.create("Alpha");
      expect(playlistsDb.getAll().map((p) => p.name)).to.deep.equal([
        "Alpha",
        "Zebra",
      ]);
    });
    it("unique name constraint throws when bypassing", () => {
      playlistsDb.create("Dup");
      let threw = false;
      try {
        db().insert(playlists).values({ name: "Dup" }).run();
      } catch {
        threw = true;
      }
      expect(threw).to.be.true;
    });
  });

  describe("update", () => {
    it("no-op when both undefined", () => {
      const id = playlistsDb.create("UpNoOp");
      playlistsDb.update(id, {});
      expect(playlistsDb.getById(id)?.name).to.equal("UpNoOp");
    });
    it("updates name and description", () => {
      const id = playlistsDb.create("OldName", "OldDesc");
      playlistsDb.update(id, { name: "NewName", description: "NewDesc" });
      const row = playlistsDb.getById(id);
      expect(row?.name).to.equal("NewName");
      expect(row?.description).to.equal("NewDesc");
    });
    it("updates only description", () => {
      const id = playlistsDb.create("OnlyDesc", "Old");
      playlistsDb.update(id, { description: "New" });
      expect(playlistsDb.getById(id)?.description).to.equal("New");
      expect(playlistsDb.getById(id)?.name).to.equal("OnlyDesc");
    });
    it("updates only name", () => {
      const id = playlistsDb.create("OnlyName");
      playlistsDb.update(id, { name: "Renamed" });
      expect(playlistsDb.getById(id)?.name).to.equal("Renamed");
    });
  });

  describe("delete", () => {
    it("deletes playlist and cascades tracks", () => {
      const id = playlistsDb.create("DelPl");
      const tid = tracksDb.upsert({
        file: "a/del.mp3",
        title: "Del",
        artist: "A",
        album: "Al",
      } as never);
      playlistsDb.addTrack(id, tid);
      expect(playlistsDb.getTracks(id)).to.have.length(1);
      playlistsDb.delete(id);
      expect(playlistsDb.getById(id)).to.be.undefined;
      // junction rows removed
      expect(
        db()
          .select()
          .from(playlistTracks)
          .where(eq(playlistTracks.playlist_id, id))
          .all(),
      ).to.deep.equal([]);
    });
    it("delete non-existent no throw", () => {
      playlistsDb.delete(99999);
      expect(playlistsDb.getAll()).to.deep.equal([]);
    });
  });

  describe("addTrack / getTracks / removeTrack", () => {
    it("addTrack assigns position 0 then 1", () => {
      const pid = playlistsDb.create("PosPl");
      const t1 = tracksDb.upsert({
        file: "a/p1.mp3",
        title: "T1",
        artist: "A",
        album: "Al",
      } as never);
      const t2 = tracksDb.upsert({
        file: "a/p2.mp3",
        title: "T2",
        artist: "A",
        album: "Al",
      } as never);
      playlistsDb.addTrack(pid, t1);
      playlistsDb.addTrack(pid, t2);
      const tracks = playlistsDb.getTracks(pid);
      expect(tracks.map((t) => t.position)).to.deep.equal([0, 1]);
      expect(tracks.map((t) => t.title)).to.deep.equal(["T1", "T2"]);
    });
    it("addTrack duplicate is no-op (onConflictDoNothing)", () => {
      const pid = playlistsDb.create("DupPl");
      const tid = tracksDb.upsert({
        file: "a/dup.mp3",
        title: "Dup",
        artist: "A",
        album: "Al",
      } as never);
      playlistsDb.addTrack(pid, tid);
      playlistsDb.addTrack(pid, tid);
      expect(playlistsDb.getTracks(pid)).to.have.length(1);
    });
    it("getTracks empty → [] and ordered by position", () => {
      const pid = playlistsDb.create("EmptyPl");
      expect(playlistsDb.getTracks(pid)).to.deep.equal([]);
      expect(playlistsDb.getTracks(99999)).to.deep.equal([]);
    });
    it("removeTrack deletes junction row", () => {
      const pid = playlistsDb.create("RemPl");
      const tid = tracksDb.upsert({
        file: "a/rem.mp3",
        title: "Rem",
        artist: "A",
        album: "Al",
      } as never);
      playlistsDb.addTrack(pid, tid);
      const pt = playlistsDb.getTracks(pid)[0];
      playlistsDb.removeTrack(pt.pt_id);
      expect(playlistsDb.getTracks(pid)).to.deep.equal([]);
    });
    it("removeTrack non-existent no throw", () => {
      playlistsDb.removeTrack(99999);
      expect(playlistsDb.getAll()).to.deep.equal([]);
    });
    it("getTracks returns PlaylistTrackRow with pt_id and position", () => {
      const pid = playlistsDb.create("RowPl");
      const tid = tracksDb.upsert({
        file: "a/row.mp3",
        title: "Row",
        artist: "A",
        album: "Al",
      } as never);
      playlistsDb.addTrack(pid, tid);
      const row = playlistsDb.getTracks(pid)[0];
      expect(row.pt_id).to.be.a("number");
      expect(row.position).to.equal(0);
      expect(row.added_at).to.be.a("string");
    });
  });
});
