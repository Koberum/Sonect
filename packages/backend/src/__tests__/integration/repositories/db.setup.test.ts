import { expect } from "chai";
import { createTestDb } from "@tests/helpers/db.js";
import { setupDb } from "@repo/db";

describe("setupDb (trophy integration)", () => {
  let close: () => void;
  beforeEach(() => {
    ({ close } = createTestDb());
  });
  afterEach(() => close());

  it("get miss → undefined", () =>
    expect(setupDb.get("audio")).to.be.undefined);

  it("setCompleted creates and get returns completed true", () => {
    setupDb.setCompleted("audio");
    const row = setupDb.get("audio");
    expect(row?.completed).to.be.true;
    expect(row?.step).to.equal("audio");
  });

  it("setCompleted upsert keeps idempotent", () => {
    setupDb.setCompleted("sync");
    setupDb.setCompleted("sync");
    expect(setupDb.get("sync")?.completed).to.be.true;
  });

  it("setIncomplete clears completed flag", () => {
    setupDb.setCompleted("audio");
    setupDb.setIncomplete("audio");
    expect(setupDb.get("audio")?.completed).to.be.false;
  });

  it("setIncomplete on missing row no throw", () => {
    setupDb.setIncomplete("missing");
    expect(setupDb.get("missing")).to.be.undefined;
  });

  it("completed_at is set on setCompleted", () => {
    setupDb.setCompleted("audio");
    expect(setupDb.get("audio")?.completed_at).to.be.a("string");
  });

  it("multiple steps independent", () => {
    setupDb.setCompleted("audio");
    setupDb.setCompleted("sync");
    setupDb.setIncomplete("audio");
    expect(setupDb.get("audio")?.completed).to.be.false;
    expect(setupDb.get("sync")?.completed).to.be.true;
  });
});
