import { expect } from "chai";
import { createTestDb } from "@tests/helpers/db.js";
import { storageDb } from "@repo/db";
import { db } from "@repo/db";
import { storageSources } from "@repo/db";

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
    it("create stores enabled 1/0 and sanitizes", () => {
      const id = storageDb.create({
        name: "Lib",
        type: "local",
        uri: "/tmp/music",
        mount_path: "/music/lib",
        enabled: true,
      });
      expect(storageDb.getById(id)?.enabled).to.equal(1);
      const id2 = storageDb.create({
        name: "Lib2",
        type: "smb",
        uri: "//host/share",
        mount_path: "/music/lib2",
        enabled: false,
      });
      expect(storageDb.getById(id2)?.enabled).to.equal(0);
    });
    it("create stores optional username/password", () => {
      const id = storageDb.create({
        name: "Sec",
        type: "smb",
        uri: "//h/s",
        mount_path: "/music/sec",
        username: "u",
        password: "p",
        enabled: true,
      });
      const row = storageDb.getById(id);
      expect(row?.username).to.equal("u");
      expect(row?.password).to.equal("p");
    });
    it("create without optional fields → null", () => {
      const id = storageDb.create({
        name: "NoOpt",
        type: "local",
        uri: "/tmp/a",
        mount_path: "/music/noopt",
        enabled: true,
      });
      expect(storageDb.getById(id)?.username).to.be.null;
      expect(storageDb.getById(id)?.password).to.be.null;
    });
    it("getAll orders asc(name)", () => {
      storageDb.create({
        name: "Zebra",
        type: "local",
        uri: "/tmp/z",
        mount_path: "/music/z",
        enabled: true,
      });
      storageDb.create({
        name: "Alpha",
        type: "local",
        uri: "/tmp/a",
        mount_path: "/music/a",
        enabled: true,
      });
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
        type: "local",
        uri: "/tmp/nc",
        mount_path: "/music/nc",
        enabled: true,
      });
      storageDb.update(id, {});
      expect(storageDb.getById(id)?.name).to.equal("NoChange");
    });
    it("updates name/type/uri/mount_path", () => {
      const id = storageDb.create({
        name: "Old",
        type: "local",
        uri: "/tmp/old",
        mount_path: "/music/old",
        enabled: true,
      });
      storageDb.update(id, {
        name: "New",
        type: "nfs",
        uri: "/tmp/new",
        mount_path: "/music/new",
      });
      const row = storageDb.getById(id);
      expect(row?.name).to.equal("New");
      expect(row?.type).to.equal("nfs");
      expect(row?.uri).to.equal("/tmp/new");
      expect(row?.mount_path).to.equal("/music/new");
    });
    it("updates username/password/enabled boolean conversion", () => {
      const id = storageDb.create({
        name: "Upd",
        type: "smb",
        uri: "//h/s",
        mount_path: "/music/upd",
        enabled: true,
      });
      storageDb.update(id, { username: "nu", password: "np", enabled: false });
      const row = storageDb.getById(id);
      expect(row?.username).to.equal("nu");
      expect(row?.password).to.equal("np");
      expect(row?.enabled).to.equal(0);
      storageDb.update(id, { enabled: true });
      expect(storageDb.getById(id)?.enabled).to.equal(1);
    });
    it("update with only enabled undefined keeps value", () => {
      const id = storageDb.create({
        name: "Keep",
        type: "local",
        uri: "/tmp/k",
        mount_path: "/music/k",
        enabled: true,
      });
      storageDb.update(id, { name: "Keep2" });
      expect(storageDb.getById(id)?.enabled).to.equal(1);
    });
    it("type check constraint — invalid type throws", () => {
      let threw = false;
      try {
        db()
          .insert(storageSources)
          .values({
            name: "Bad",
            type: "bad" as never,
            uri: "/tmp/bad",
            mount_path: "/music/bad",
          })
          .run();
      } catch {
        threw = true;
      }
      expect(threw).to.be.true;
    });
  });

  describe("delete / updateStats", () => {
    it("delete removes row", () => {
      const id = storageDb.create({
        name: "Del",
        type: "local",
        uri: "/tmp/d",
        mount_path: "/music/d",
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
        type: "local",
        uri: "/tmp/s",
        mount_path: "/music/s",
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
