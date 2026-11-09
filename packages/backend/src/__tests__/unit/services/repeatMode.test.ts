import { expect } from "chai";
import { repeatModeFromFlags } from "@repo/types";

describe("repeatModeFromFlags", () => {
  it("maps MPD repeat/single flags to the three UI modes", () => {
    expect(repeatModeFromFlags(false, false)).to.equal("off");
    expect(repeatModeFromFlags(true, false)).to.equal("all");
    expect(repeatModeFromFlags(true, true)).to.equal("one");
    expect(repeatModeFromFlags(false, true)).to.equal("off");
  });
});
