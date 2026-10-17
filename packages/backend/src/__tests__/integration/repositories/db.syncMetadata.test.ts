import { expect } from "chai";
import { createTestDb } from "@tests/helpers/db.js";
import { catalogSyncDb, syncMetadataDb } from "@repo/db";

describe("syncMetadataDb (trophy integration)", () => {
  let close: () => void;
  beforeEach(() => {
    ({ close } = createTestDb());
  });
  afterEach(() => close());

  it("get miss → undefined", () =>
    expect(syncMetadataDb.get("missing")).to.be.undefined);

  it("get returns the last_sync stamped by applyIncremental", () => {
    catalogSyncDb.applyIncremental({ upserts: [], deletions: [] });
    expect(syncMetadataDb.get("last_sync")).to.be.a("string");
  });
});
