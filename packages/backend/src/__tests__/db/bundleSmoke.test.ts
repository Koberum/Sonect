import { execSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import type { Context } from "mocha";
import { before, describe, it } from "mocha";
import { expect } from "chai";

describe("native SQLite production bundle", () => {
  const distDir = resolve("dist");

  before(function (this: Context) {
    this.timeout(60_000);
    // A stale generated sidecar must not survive into the build: remove it
    // first so its presence can never produce a false pass.
    rmSync(resolve(distDir, "sql-wasm.wasm"), { force: true });
    execSync("pnpm bundle");
  });

  it("bundles node:sqlite without the sql.js wasm sidecar", () => {
    const bundle = readFileSync(resolve(distDir, "bundle.cjs"), "utf8");
    expect(bundle).to.include("node:sqlite");
    expect(bundle).not.to.include("sql-wasm.wasm");
    expect(existsSync(resolve(distDir, "sql-wasm.wasm"))).to.equal(false);
  });
});
