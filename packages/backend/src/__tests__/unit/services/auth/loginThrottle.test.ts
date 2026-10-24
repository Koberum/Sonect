import { expect } from "chai";
import { LoginThrottle, MAX_ENTRIES } from "@services/auth/loginThrottle.js";

describe("LoginThrottle", () => {
  it("blocks after five failures and resets after the window", () => {
    const throttle = new LoginThrottle();
    const now = 1_000;
    for (let i = 0; i < 5; i += 1) throttle.recordFailure("profile", now);
    const blocked = throttle.check("profile", now);
    expect(blocked.allowed).to.equal(false);
    expect(throttle.check("profile", now + 15 * 60_000).allowed).to.equal(true);
  });

  it("resets on success", () => {
    const throttle = new LoginThrottle();
    throttle.recordFailure("profile", 1_000);
    throttle.reset("profile");
    expect(throttle.check("profile", 1_000).allowed).to.equal(true);
  });

  it("caps the attempts map at MAX_ENTRIES", () => {
    const throttle = new LoginThrottle();
    const now = 1_000;
    for (let i = 0; i <= MAX_ENTRIES + 50; i += 1) {
      throttle.recordFailure(`profile-${i}`, now);
    }
    const size = (throttle as unknown as { attempts: Map<string, unknown> })
      .attempts.size;
    expect(size).to.be.at.most(MAX_ENTRIES);
  });
});
