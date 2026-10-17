import { expect } from "chai";
import { createTestDb } from "@tests/helpers/db.js";
import { genresDb, db, findOrCreateGenre, genres } from "@repo/db";

describe("genresDb (trophy integration)", () => {
  let close: () => void;
  beforeEach(() => {
    ({ close } = createTestDb());
  });
  afterEach(() => close());

  describe("findOrCreate", () => {
    it("creates trimmed name", () => {
      const id = findOrCreateGenre(db(), "  Shoegaze  ");
      expect(genresDb.getById(id)?.name).to.equal("Shoegaze");
    });
    it("NOCASE dedup", () => {
      const a = findOrCreateGenre(db(), "rock");
      const b = findOrCreateGenre(db(), "ROCK");
      expect(a).to.equal(b);
      expect(genresDb.count()).to.equal(1);
    });
    it("trims before NOCASE check", () => {
      const a = findOrCreateGenre(db(), "rock");
      const b = findOrCreateGenre(db(), "  rock  ");
      expect(a).to.equal(b);
    });
  });

  describe("getAll", () => {
    it("returns [] when empty", () =>
      expect(genresDb.getAll()).to.deep.equal([]));
    it("orders asc(name)", () => {
      findOrCreateGenre(db(), "Zebra");
      findOrCreateGenre(db(), "Alpha");
      expect(genresDb.getAll().map((g) => g.name)).to.deep.equal([
        "Alpha",
        "Zebra",
      ]);
    });
    it("pagination limit/offset guard", () => {
      for (let i = 0; i < 5; i++) findOrCreateGenre(db(), `G${i}`);
      expect(genresDb.getAll({ limit: 2, offset: 1 })).to.have.length(2);
      expect(genresDb.getAll({ offset: 2 } as never)).to.have.length(5);
    });
  });

  describe("count / getById", () => {
    it("count 0 when empty", () => expect(genresDb.count()).to.equal(0));
    it("count reflects inserts", () => {
      findOrCreateGenre(db(), "A");
      findOrCreateGenre(db(), "B");
      expect(genresDb.count()).to.equal(2);
    });
    it("getById miss → undefined", () =>
      expect(genresDb.getById(99999)).to.be.undefined);
    it("getById found", () => {
      const id = findOrCreateGenre(db(), "Found");
      expect(genresDb.getById(id)?.name).to.equal("Found");
    });
  });

  describe("unique constraint", () => {
    it("throws on duplicate when bypassing findOrCreate", () => {
      db().insert(genres).values({ name: "Dup" }).run();
      let threw = false;
      try {
        db().insert(genres).values({ name: "Dup" }).run();
      } catch {
        threw = true;
      }
      expect(threw).to.be.true;
    });
  });
});
