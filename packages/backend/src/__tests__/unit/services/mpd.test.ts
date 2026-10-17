import { expect } from "chai";
import { parseKeyValue, hashFile } from "../../../utils/mpd.js";

// Layer 1: Pure functions — no DB, no mocks, cheap & fast
describe("parseKeyValue (pure unit)", () => {
  it("parses colon-separated lines", () => {
    const msg = "state: play\nvolume: 80\nelapsed: 12.5\nOK";
    const kv = parseKeyValue(msg);
    expect(kv.state).to.equal("play");
    expect(kv.volume).to.equal("80");
    expect(kv.elapsed).to.equal("12.5");
  });

  it("returns empty object for empty input", () => {
    expect(parseKeyValue("")).to.deep.equal({});
  });

  it("ignores lines without colon", () => {
    const kv = parseKeyValue("OK\nstate: pause");
    expect(kv.state).to.equal("pause");
    expect(kv).to.not.have.property("OK");
  });
});

describe("hashFile (pure unit)", () => {
  it("is deterministic", () => {
    expect(hashFile("a/b/c.mp3")).to.equal(hashFile("a/b/c.mp3"));
  });
  it("differs for different paths", () => {
    expect(hashFile("a.mp3")).to.not.equal(hashFile("b.mp3"));
  });
  it("returns non-negative integer", () => {
    expect(hashFile("test/file.flac")).to.be.a("number");
    expect(hashFile("test/file.flac")).to.be.greaterThanOrEqual(0);
  });
});
