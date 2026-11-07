import { expect } from "chai";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import app from "../../app.js";
import {
  initializeServices,
  isServicesInitialized,
} from "@services/factory.js";

describe("playlists page SPA fallback", () => {
  let dist: string;
  const previousDist = process.env.FRONTEND_DIST;

  before(() => {
    if (!isServicesInitialized()) initializeServices();
    dist = fs.mkdtempSync(path.join(os.tmpdir(), "sonect-playlists-page-"));
    fs.writeFileSync(
      path.join(dist, "index.html"),
      "<!doctype html><title>Sonect playlists</title>",
    );
    process.env.FRONTEND_DIST = dist;
  });

  after(() => {
    if (previousDist === undefined) {
      delete process.env.FRONTEND_DIST;
    } else {
      process.env.FRONTEND_DIST = previousDist;
    }
    fs.rmSync(dist, { recursive: true, force: true });
  });

  it("serves the SPA shell for a document request to /playlists", async () => {
    const res = await request(app).get("/playlists").set("Accept", "text/html");

    expect(res.status).to.equal(200);
    expect(res.headers["content-type"]).to.contain("text/html");
    expect(res.text).to.contain("Sonect playlists");
  });

  it("serves the SPA shell for a playlist detail document request", async () => {
    const res = await request(app)
      .get("/playlists/42")
      .set("Accept", "text/html");

    expect(res.status).to.equal(200);
    expect(res.headers["content-type"]).to.contain("text/html");
    expect(res.text).to.contain("Sonect playlists");
  });

  it("keeps /playlists API requests on the authenticated router", async () => {
    const res = await request(app)
      .get("/playlists")
      .set("Accept", "application/json");

    expect(res.status).to.equal(401);
    expect(res.headers["content-type"]).to.contain("application/json");
  });

  it("keeps /playlists/:id API requests on the authenticated router", async () => {
    const res = await request(app)
      .get("/playlists/42")
      .set("Accept", "application/json");

    expect(res.status).to.equal(401);
    expect(res.headers["content-type"]).to.contain("application/json");
  });
});
