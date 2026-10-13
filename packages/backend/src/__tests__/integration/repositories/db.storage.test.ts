import { expect } from "chai";
import { createTestDb } from "@tests/helpers/db.js";
import { storageDb } from "@repo/db";

describe("storageDb (trophy integration)", () => {
  let close: () => void;
  beforeEach(() => {
    ({ close } = createTestDb());
  });
  afterEach(() => close());

  describe("create / getAll / getById", () => {
    it("getAll empty → []", () => expect(storageDb.getAll()).to.deep.equal([]));
    it("getById miss → undefined", () =>
      expect(storageDb.getById(99999)).to.be.undefined);
    it("create stores enabled 1/0 and the library path", () => {
      const id = storageDb.create({
        name: "Lib",
        path: "/music/lib",
        enabled: true,
      });
      expect(storageDb.getById(id)?.enabled).to.equal(1);
      expect(storageDb.getById(id)?.path).to.equal("/music/lib");
      const id2 = storageDb.create({
        name: "Lib2",
        path: "/music/lib2",
        enabled: false,
      });
      expect(storageDb.getById(id2)?.enabled).to.equal(0);
    });
    it("getAll orders asc(name)", () => {
      storageDb.create({ name: "Zebra", path: "/music/z", enabled: true });
      storageDb.create({ name: "Alpha", path: "/music/a", enabled: true });
      expect(storageDb.getAll().map((s) => s.name)).to.deep.equal([
        "Alpha",
        "Zebra",
      ]);
    });
  });

  describe("update", () => {
    it("empty set → no update and no updated_at bump", () => {
      const id = storageDb.create({
        name: "NoChange",
        path: "/music/nc",
        enabled: true,
      });
      storageDb.update(id, {});
      expect(storageDb.getById(id)?.name).to.equal("NoChange");
    });
    it("updates name and path", () => {
      const id = storageDb.create({
        name: "Old",
        path: "/music/old",
        enabled: true,
      });
      storageDb.update(id, { name: "New", path: "/music/new" });
      const row = storageDb.getById(id);
      expect(row?.name).to.equal("New");
      expect(row?.path).to.equal("/music/new");
    });
    it("updates enabled boolean conversion", () => {
      const id = storageDb.create({
        name: "Upd",
        path: "/music/upd",
        enabled: true,
      });
      storageDb.update(id, { enabled: false });
      expect(storageDb.getById(id)?.enabled).to.equal(0);
      storageDb.update(id, { enabled: true });
      expect(storageDb.getById(id)?.enabled).to.equal(1);
    });
    it("update with only enabled undefined keeps value", () => {
      const id = storageDb.create({
        name: "Keep",
        path: "/music/k",
        enabled: true,
      });
      storageDb.update(id, { name: "Keep2" });
      expect(storageDb.getById(id)?.enabled).to.equal(1);
    });
  });

  describe("delete / updateStats", () => {
    it("delete removes row", () => {
      const id = storageDb.create({
        name: "Del",
        path: "/music/d",
        enabled: true,
      });
      storageDb.delete(id);
      expect(storageDb.getById(id)).to.be.undefined;
    });
    it("delete non-existent no throw", () => {
      storageDb.delete(99999);
      expect(storageDb.getAll()).to.deep.equal([]);
    });
    it("updateStats persists", () => {
      const id = storageDb.create({
        name: "Stats",
        path: "/music/s",
        enabled: true,
      });
      storageDb.updateStats(id, {
        file_count: 10,
        dir_count: 2,
        total_size: 12345,
      });
      const row = storageDb.getById(id);
      expect(row?.file_count).to.equal(10);
      expect(row?.dir_count).to.equal(2);
      expect(row?.total_size).to.equal(12345);
    });
  });
});
