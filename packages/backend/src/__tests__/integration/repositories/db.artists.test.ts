import { expect } from "chai";
import { createTestDb } from "@tests/helpers/db.js";
import { artistsDb, db, findOrCreateArtist, artists } from "@repo/db";
import { track } from "@tests/factories/index.js";

describe("artistsDb (trophy integration)", () => {
  let close: () => void;
  beforeEach(() => {
    ({ close } = createTestDb());
  });
  afterEach(() => close());

  describe("findOrCreate", () => {
    it("creates and returns id", () => {
      const id = findOrCreateArtist(db(), "Beatles");
      expect(id).to.be.a("number");
      expect(artistsDb.getById(id)?.name).to.equal("Beatles");
    });
    it("NOCASE dedup — same id for different case", () => {
      const a = findOrCreateArtist(db(), "beatles");
      const b = findOrCreateArtist(db(), "BEATLES");
      expect(a).to.equal(b);
      expect(artistsDb.count()).to.equal(1);
    });
    it("uses executor path — trims via caller not needed", () => {
      const id = findOrCreateArtist(db(), "  spaced  ");
      expect(artistsDb.getById(id)?.name).to.equal("  spaced  ");
    });
  });

  describe("getAll", () => {
    it("returns [] when empty", () => {
      expect(artistsDb.getAll()).to.deep.equal([]);
    });
    it("orders asc(name)", () => {
      findOrCreateArtist(db(), "Zebra");
      findOrCreateArtist(db(), "Alpha");
      findOrCreateArtist(db(), "Middle");
      expect(artistsDb.getAll().map((a) => a.name)).to.deep.equal([
        "Alpha",
        "Middle",
        "Zebra",
      ]);
    });
    it("pagination: limit/offset guard — offset ignored without limit", () => {
      for (let i = 0; i < 5; i++) findOrCreateArtist(db(), `Artist${i}`);
      const all = artistsDb.getAll();
      expect(all).to.have.length(5);
      expect(artistsDb.getAll({ limit: 2, offset: 1 })).to.have.length(2);
      expect(artistsDb.getAll({ offset: 2 } as never)).to.have.length(5);
    });
    it("limit without offset", () => {
      for (let i = 0; i < 4; i++) findOrCreateArtist(db(), `A${i}`);
      expect(artistsDb.getAll({ limit: 2 })).to.have.length(2);
    });
  });

  describe("count / getById", () => {
    it("count 0 when empty", () => expect(artistsDb.count()).to.equal(0));
    it("count reflects inserts", () => {
      findOrCreateArtist(db(), "One");
      findOrCreateArtist(db(), "Two");
      expect(artistsDb.count()).to.equal(2);
    });
    it("getById returns undefined on miss", () => {
      expect(artistsDb.getById(99999)).to.be.undefined;
    });
    it("getById returns found", () => {
      const id = findOrCreateArtist(db(), "Lookup");
      expect(artistsDb.getById(id)?.name).to.equal("Lookup");
    });
  });

  describe("search", () => {
    it("finds via LIKE pattern", () => {
      findOrCreateArtist(db(), "The Beatles");
      findOrCreateArtist(db(), "Beach Boys");
      const res = artistsDb.search("beat");
      expect(res).to.have.length(1);
      expect(res[0].name).to.equal("The Beatles");
    });
    it("respects limit default 20", () => {
      for (let i = 0; i < 25; i++) findOrCreateArtist(db(), `Beat${i}`);
      expect(artistsDb.search("Beat")).to.have.length(20);
      expect(artistsDb.search("Beat", 5)).to.have.length(5);
    });
    it("orders asc(name) in search", () => {
      findOrCreateArtist(db(), "Zebra beat");
      findOrCreateArtist(db(), "Alpha beat");
      expect(artistsDb.search("beat").map((a) => a.name)).to.deep.equal([
        "Alpha beat",
        "Zebra beat",
      ]);
    });
  });

  describe("getRecentlyPlayed", () => {
    it("returns [] when no track has been played", () => {
      findOrCreateArtist(db(), "Unplayed");
      expect(artistsDb.getRecentlyPlayed(10)).to.deep.equal([]);
    });

    it("orders by latest track play and respects limit", () => {
      track.create(
        {
          title: "Old track",
          artist: "Old Artist",
          last_played: "2026-01-01 00:00:00",
        },
        1,
      );
      track.create(
        {
          title: "New track",
          artist: "New Artist",
          last_played: "2026-01-02 00:00:00",
        },
        2,
      );
      track.create({ title: "Never played", artist: "Unplayed Artist" }, 3);

      expect(artistsDb.getRecentlyPlayed(10).map((a) => a.name)).to.deep.equal([
        "New Artist",
        "Old Artist",
      ]);
      expect(artistsDb.getRecentlyPlayed(1).map((a) => a.name)).to.deep.equal([
        "New Artist",
      ]);
    });
  });

  describe("unique constraint via direct insert", () => {
    it("throws on duplicate unique name when bypassing findOrCreate", () => {
      db().insert(artists).values({ name: "Dup" }).run();
      let threw = false;
      try {
        db().insert(artists).values({ name: "Dup" }).run();
      } catch {
        threw = true;
      }
      expect(threw).to.be.true;
    });
  });
});
