import { expect } from "chai";
import { createTestDb } from "@tests/helpers/db.js";
import { artistsDb } from "@repo/db";
import { db } from "@repo/db";
import { artists } from "@repo/db";

describe("artistsDb (trophy integration)", () => {
  let close: () => void;
  beforeEach(() => {
    ({ close } = createTestDb());
  });
  afterEach(() => close());

  describe("findOrCreate", () => {
    it("creates and returns id", () => {
      const id = artistsDb.findOrCreate("Beatles");
      expect(id).to.be.a("number");
      expect(artistsDb.getById(id)?.name).to.equal("Beatles");
    });
    it("NOCASE dedup — same id for different case", () => {
      const a = artistsDb.findOrCreate("beatles");
      const b = artistsDb.findOrCreate("BEATLES");
      expect(a).to.equal(b);
      expect(artistsDb.count()).to.equal(1);
    });
    it("uses executor path — trims via caller not needed", () => {
      const id = artistsDb.findOrCreate("  spaced  ");
      expect(artistsDb.getById(id)?.name).to.equal("  spaced  ");
    });
  });

  describe("getAll", () => {
    it("returns [] when empty", () => {
      expect(artistsDb.getAll()).to.deep.equal([]);
    });
    it("orders asc(name)", () => {
      artistsDb.findOrCreate("Zebra");
      artistsDb.findOrCreate("Alpha");
      artistsDb.findOrCreate("Middle");
      expect(artistsDb.getAll().map((a) => a.name)).to.deep.equal([
        "Alpha",
        "Middle",
        "Zebra",
      ]);
    });
    it("pagination: limit/offset guard — offset ignored without limit", () => {
      for (let i = 0; i < 5; i++) artistsDb.findOrCreate(`Artist${i}`);
      const all = artistsDb.getAll();
      expect(all).to.have.length(5);
      expect(artistsDb.getAll({ limit: 2, offset: 1 })).to.have.length(2);
      expect(artistsDb.getAll({ offset: 2 } as never)).to.have.length(5);
    });
    it("limit without offset", () => {
      for (let i = 0; i < 4; i++) artistsDb.findOrCreate(`A${i}`);
      expect(artistsDb.getAll({ limit: 2 })).to.have.length(2);
    });
  });

  describe("count / getById", () => {
    it("count 0 when empty", () => expect(artistsDb.count()).to.equal(0));
    it("count reflects inserts", () => {
      artistsDb.findOrCreate("One");
      artistsDb.findOrCreate("Two");
      expect(artistsDb.count()).to.equal(2);
    });
    it("getById returns undefined on miss", () => {
      expect(artistsDb.getById(99999)).to.be.undefined;
    });
    it("getById returns found", () => {
      const id = artistsDb.findOrCreate("Lookup");
      expect(artistsDb.getById(id)?.name).to.equal("Lookup");
    });
  });

  describe("search", () => {
    it("finds via LIKE pattern", () => {
      artistsDb.findOrCreate("The Beatles");
      artistsDb.findOrCreate("Beach Boys");
      const res = artistsDb.search("beat");
      expect(res).to.have.length(1);
      expect(res[0].name).to.equal("The Beatles");
    });
    it("respects limit default 20", () => {
      for (let i = 0; i < 25; i++) artistsDb.findOrCreate(`Beat${i}`);
      expect(artistsDb.search("Beat")).to.have.length(20);
      expect(artistsDb.search("Beat", 5)).to.have.length(5);
    });
    it("orders asc(name) in search", () => {
      artistsDb.findOrCreate("Zebra beat");
      artistsDb.findOrCreate("Alpha beat");
      expect(artistsDb.search("beat").map((a) => a.name)).to.deep.equal([
        "Alpha beat",
        "Zebra beat",
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
