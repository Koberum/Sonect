import { expect } from "chai";
import { createTestDb } from "@tests/helpers/db.js";
import { SessionRegistry } from "@services/session/sessionRegistry.js";
import type { LogService } from "@services/utils/logService";

describe("SessionRegistry", () => {
  let close: () => void;
  let registry: SessionRegistry;

  beforeEach(() => {
    ({ close } = createTestDb());
    registry = new SessionRegistry({} as LogService);
  });

  afterEach(() => {
    close();
    registry.dispose();
  });

  it("getOrCreateSession is idempotent", () => {
    const a = registry.getOrCreateSession("abc");
    const b = registry.getOrCreateSession("abc");
    expect(a).to.equal(b);
  });

  it("removeSession drops the session and stops its clock", () => {
    const s = registry.getOrCreateSession("abc");
    registry.removeSession("abc");
    expect(registry.getSession("abc")).to.be.null;
    s.stop();
  });

  it("cleanupIdle removes sessions inactive for more than 30 minutes", () => {
    const s = registry.getOrCreateSession("old");
    // backdate active timestamp
    (s as unknown as { lastActiveAtInternal: number }).lastActiveAtInternal =
      Date.now() - 31 * 60 * 1000;
    registry.cleanupIdle();
    expect(registry.getSession("old")).to.be.null;
  });
});
