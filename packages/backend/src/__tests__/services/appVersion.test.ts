import { expect } from "chai";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readAppVersion } from "../../services/utils/appVersion.js";

describe("appVersion", () => {
  let tmp: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "sonect-appversion-"));
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("returns the trimmed contents of the .version file", () => {
    writeFileSync(join(tmp, ".version"), "1.2.3\n");
    expect(readAppVersion(tmp)).to.equal("1.2.3");
  });

  it("returns 'dev' when no .version file exists", () => {
    expect(readAppVersion(tmp)).to.equal("dev");
  });

  it("returns 'dev' when the .version file is blank", () => {
    writeFileSync(join(tmp, ".version"), "   \n");
    expect(readAppVersion(tmp)).to.equal("dev");
  });
});
