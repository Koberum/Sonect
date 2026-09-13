import { expect } from "chai";
import { createTestDb } from "@tests/helpers/db.js";
import { syncMetadataDb } from "@repo/db";

describe("syncMetadataDb (trophy integration)", () => {
  let close: () => void;
  beforeEach(() => {
    ({ close } = createTestDb());
  });
  afterEach(() => close());

  it("get miss → undefined", () =>
    expect(syncMetadataDb.get("missing")).to.be.undefined);
  it("getLastSync miss → undefined", () =>
    expect(syncMetadataDb.getLastSync()).to.be.undefined);

  it("set and get", () => {
    syncMetadataDb.set("k1", "v1");
    expect(syncMetadataDb.get("k1")).to.equal("v1");
  });

  it("set upsert updates value", () => {
    syncMetadataDb.set("k1", "v1");
    syncMetadataDb.set("k1", "v2");
    expect(syncMetadataDb.get("k1")).to.equal("v2");
  });

  it("setLastSync / getLastSync roundtrip", () => {
    syncMetadataDb.setLastSync();
    const d = syncMetadataDb.getLastSync();
    expect(d).to.be.instanceOf(Date);
    expect(d!.getTime()).to.be.closeTo(Date.now(), 2000);
  });

  it("get returns string for last_sync key", () => {
    syncMetadataDb.set("last_sync", "2020-01-01T00:00:00.000Z");
    expect(syncMetadataDb.get("last_sync")).to.equal(
      "2020-01-01T00:00:00.000Z",
    );
  });
});
