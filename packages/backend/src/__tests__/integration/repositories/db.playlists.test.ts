import { expect } from "chai";
import { createTestDb } from "@tests/helpers/db.js";
import {
  playlistsDb,
  profilesDb,
  db,
  upsertTrack,
  albums,
  playlists,
  playlistTracks,
} from "@repo/db";

import { eq } from "drizzle-orm";

describe("playlistsDb (trophy integration)", () => {
  let close: () => void;
  let profileId: string;
  beforeEach(() => {
    ({ close } = createTestDb());
    profileId = profilesDb.create({ name: "Owner", passwordHash: "hash" });
  });
  afterEach(() => close());

  describe("getAll / getById / create", () => {
    it("getAll empty → []", () =>
      expect(playlistsDb.getAll(profileId)).to.deep.equal([]));
    it("getById miss → undefined", () =>
      expect(playlistsDb.getById(profileId, 99999)).to.be.undefined);
    it("create returns id and getById found", () => {
      const id = playlistsDb.create(profileId, "MyPl", "desc");
      expect(playlistsDb.getById(profileId, id)?.name).to.equal("MyPl");
      expect(playlistsDb.getById(profileId, id)?.description).to.equal("desc");
    });
    it("create without description → null", () => {
      const id = playlistsDb.create(profileId, "NoDesc");
      expect(playlistsDb.getById(profileId, id)?.description).to.be.null;
    });
    it("getAll orders asc(name)", () => {
      playlistsDb.create(profileId, "Zebra");
      playlistsDb.create(profileId, "Alpha");
      expect(playlistsDb.getAll(profileId).map((p) => p.name)).to.deep.equal([
        "Alpha",
        "Zebra",
      ]);
    });
    it("scopes reads and writes to the owning profile", () => {
      const other = profilesDb.create({ name: "Other", passwordHash: "hash" });
      const id = playlistsDb.create(profileId, "Mine");
      expect(playlistsDb.getAll(other)).to.deep.equal([]);
      expect(playlistsDb.getById(other, id)).to.be.undefined;
      playlistsDb.update(other, id, { name: "Hacked" });
      expect(playlistsDb.getById(profileId, id)?.name).to.equal("Mine");
      playlistsDb.delete(other, id);
      expect(playlistsDb.getById(profileId, id)).to.exist;
    });
    it("unique name constraint throws when bypassing", () => {
      playlistsDb.create(profileId, "Dup");
      let threw = false;
      try {
        db().insert(playlists).values({ profile_id: profileId, name: "Dup" }).run();
      } catch {
        threw = true;
      }
      expect(threw).to.be.true;
    });
  });

  describe("update", () => {
    it("no-op when both undefined", () => {
      const id = playlistsDb.create(profileId, "UpNoOp");
      playlistsDb.update(profileId, id, {});
      expect(playlistsDb.getById(profileId, id)?.name).to.equal("UpNoOp");
    });
    it("updates name and description", () => {
      const id = playlistsDb.create(profileId, "OldName", "OldDesc");
      playlistsDb.update(profileId, id, { name: "NewName", description: "NewDesc" });
      const row = playlistsDb.getById(profileId, id);
      expect(row?.name).to.equal("NewName");
      expect(row?.description).to.equal("NewDesc");
    });
    it("updates only description", () => {
      const id = playlistsDb.create(profileId, "OnlyDesc", "Old");
      playlistsDb.update(profileId, id, { description: "New" });
      expect(playlistsDb.getById(profileId, id)?.description).to.equal("New");
      expect(playlistsDb.getById(profileId, id)?.name).to.equal("OnlyDesc");
    });
    it("updates only name", () => {
      const id = playlistsDb.create(profileId, "OnlyName");
      playlistsDb.update(profileId, id, { name: "Renamed" });
      expect(playlistsDb.getById(profileId, id)?.name).to.equal("Renamed");
    });
  });

  describe("delete", () => {
    it("deletes playlist and cascades tracks", () => {
      const id = playlistsDb.create(profileId, "DelPl");
      const tid = upsertTrack(db(), {
        file: "a/del.mp3",
        title: "Del",
        artist: "A",
        album: "Al",
      } as never);
      playlistsDb.addTrack(id, tid);
      expect(playlistsDb.getTracks(id)).to.have.length(1);
      playlistsDb.delete(profileId, id);
      expect(playlistsDb.getById(profileId, id)).to.be.undefined;
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
      playlistsDb.delete(profileId, 99999);
      expect(playlistsDb.getAll(profileId)).to.deep.equal([]);
    });
  });

  describe("addTrack / getTracks / removeTrack", () => {
    it("addTrack assigns position 0 then 1", () => {
      const pid = playlistsDb.create(profileId, "PosPl");
      const t1 = upsertTrack(db(), {
        file: "a/p1.mp3",
        title: "T1",
        artist: "A",
        album: "Al",
      } as never);
      const t2 = upsertTrack(db(), {
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
      const pid = playlistsDb.create(profileId, "DupPl");
      const tid = upsertTrack(db(), {
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
      const pid = playlistsDb.create(profileId, "EmptyPl");
      expect(playlistsDb.getTracks(pid)).to.deep.equal([]);
      expect(playlistsDb.getTracks(99999)).to.deep.equal([]);
    });
    it("removeTrack deletes junction row", () => {
      const pid = playlistsDb.create(profileId, "RemPl");
      const tid = upsertTrack(db(), {
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
      expect(playlistsDb.getAll(profileId)).to.deep.equal([]);
    });
    it("getTracks returns PlaylistTrackRow with pt_id and position", () => {
      const pid = playlistsDb.create(profileId, "RowPl");
      const tid = upsertTrack(db(), {
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

  describe("track count / cover previews", () => {
    it("counts tracks in a playlist", () => {
      const pid = playlistsDb.create(profileId, "CountPl");
      expect(playlistsDb.getTrackCount(pid)).to.equal(0);

      const t1 = upsertTrack(db(), {
        file: "a/count1.mp3",
        title: "C1",
        artist: "A",
        album: "AlCount1",
      } as never);
      const t2 = upsertTrack(db(), {
        file: "a/count2.mp3",
        title: "C2",
        artist: "A",
        album: "AlCount2",
      } as never);
      playlistsDb.addTrack(pid, t1);
      playlistsDb.addTrack(pid, t2);

      expect(playlistsDb.getTrackCount(pid)).to.equal(2);
    });

    it("returns distinct non-empty album covers up to 4", () => {
      const pid = playlistsDb.create(profileId, "CoversPl");
      for (let i = 0; i < 5; i++) {
        const tid = upsertTrack(db(), {
          file: `a/cover${i}.mp3`,
          title: `Cover ${i}`,
          artist: "A",
          album: `Album ${i}`,
        } as never);
        playlistsDb.addTrack(pid, tid);
        db()
          .update(albums)
          .set({ cover_path: `cover-${i}.webp` })
          .where(eq(albums.title, `Album ${i}`))
          .run();
      }

      const previews = playlistsDb.getCoverPreviews(pid);
      expect(previews).to.have.length(4);
      expect(previews).to.include("cover-0.webp");
    });

    it("deduplicates covers shared by several tracks", () => {
      const pid = playlistsDb.create(profileId, "DupCovers");
      const t1 = upsertTrack(db(), {
        file: "a/dupc1.mp3",
        title: "D1",
        artist: "A",
        album: "Same Album",
      } as never);
      const t2 = upsertTrack(db(), {
        file: "a/dupc2.mp3",
        title: "D2",
        artist: "A",
        album: "Same Album",
      } as never);
      playlistsDb.addTrack(pid, t1);
      playlistsDb.addTrack(pid, t2);
      db()
        .update(albums)
        .set({ cover_path: "same.webp" })
        .where(eq(albums.title, "Same Album"))
        .run();

      expect(playlistsDb.getCoverPreviews(pid)).to.deep.equal(["same.webp"]);
    });
  });
});
