import { expect } from "chai";
import { createTestDb } from "@tests/helpers/db.js";
import { genresDb } from "@repo/db";
import { db } from "@repo/db";
import { genres } from "@repo/db";

describe("genresDb (trophy integration)", () => {
  let close: () => void;
  beforeEach(() => {
    ({ close } = createTestDb());
  });
  afterEach(() => close());

  describe("findOrCreate", () => {
    it("creates trimmed name", () => {
      const id = genresDb.findOrCreate("  Shoegaze  ");
      expect(genresDb.getById(id)?.name).to.equal("Shoegaze");
    });
    it("NOCASE dedup", () => {
      const a = genresDb.findOrCreate("rock");
      const b = genresDb.findOrCreate("ROCK");
      expect(a).to.equal(b);
      expect(genresDb.count()).to.equal(1);
    });
    it("trims before NOCASE check", () => {
      const a = genresDb.findOrCreate("rock");
      const b = genresDb.findOrCreate("  rock  ");
      expect(a).to.equal(b);
    });
  });

  describe("getAll", () => {
    it("returns [] when empty", () =>
      expect(genresDb.getAll()).to.deep.equal([]));
    it("orders asc(name)", () => {
      genresDb.findOrCreate("Zebra");
      genresDb.findOrCreate("Alpha");
      expect(genresDb.getAll().map((g) => g.name)).to.deep.equal([
        "Alpha",
        "Zebra",
      ]);
    });
    it("pagination limit/offset guard", () => {
      for (let i = 0; i < 5; i++) genresDb.findOrCreate(`G${i}`);
      expect(genresDb.getAll({ limit: 2, offset: 1 })).to.have.length(2);
      expect(genresDb.getAll({ offset: 2 } as never)).to.have.length(5);
    });
  });

  describe("count / getById / getByName", () => {
    it("count 0 when empty", () => expect(genresDb.count()).to.equal(0));
    it("count reflects inserts", () => {
      genresDb.findOrCreate("A");
      genresDb.findOrCreate("B");
      expect(genresDb.count()).to.equal(2);
    });
    it("getById miss → undefined", () =>
      expect(genresDb.getById(99999)).to.be.undefined);
    it("getById found", () => {
      const id = genresDb.findOrCreate("Found");
      expect(genresDb.getById(id)?.name).to.equal("Found");
    });
    it("getByName NOCASE + trim", () => {
      genresDb.findOrCreate("Shoegaze");
      expect(genresDb.getByName("shoegaze")?.name).to.equal("Shoegaze");
      expect(genresDb.getByName("  SHOEGAZE  ")?.name).to.equal("Shoegaze");
      expect(genresDb.getByName("missing")).to.be.undefined;
    });
  });

  describe("search", () => {
    it("finds via LIKE", () => {
      genresDb.findOrCreate("Shoegaze");
      genresDb.findOrCreate("Dream Pop");
      expect(genresDb.search("shoe")).to.have.length(1);
    });
    it("orders asc(name) and respects limit", () => {
      for (let i = 0; i < 25; i++) genresDb.findOrCreate(`Genre${i}`);
      expect(genresDb.search("Genre")).to.have.length(20);
      expect(genresDb.search("Genre", 3)).to.have.length(3);
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
