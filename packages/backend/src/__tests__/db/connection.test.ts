import { afterEach, describe, it } from "mocha";
import { expect } from "chai";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeDb, db, initDb, transaction } from "@repo/db";

describe("native SQLite connection", () => {
  const directories: string[] = [];

  afterEach(() => {
    closeDb();
    for (const directory of directories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("persists through node:sqlite and exposes synchronous Drizzle queries", () => {
    const directory = mkdtempSync(join(tmpdir(), "sonect-db-"));
    directories.push(directory);
    const path = join(directory, "music.db");

    initDb(path);
    db().$client.exec(
      "CREATE TABLE probe (id INTEGER PRIMARY KEY, value TEXT)",
    );
    transaction(() => {
      db()
        .$client.prepare("INSERT INTO probe (value) VALUES (?)")
        .run("native");
    });

    expect(db().$client.prepare("SELECT value FROM probe").all()).to.deep.equal(
      [{ value: "native" }],
    );
    closeDb();
    expect(readFileSync(path).subarray(0, 16).toString()).to.equal(
      "SQLite format 3\u0000",
    );
  });
});
