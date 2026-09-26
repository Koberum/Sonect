import { expect } from "chai";
import request from "supertest";
import { createTestDb } from "@tests/helpers/db.js";
import { track } from "@tests/factories/index.js";
import app from "../../app.js";
import {
  initializeServices,
  isServicesInitialized,
} from "@services/factory.js";

// Layer 4: Full stack — router → controller → service → real DB, few critical paths
describe("Catalog e2e (supertest + real seeded DB)", () => {
  let close: () => void;

  before(() => {
    if (!isServicesInitialized()) initializeServices();
  });

  beforeEach(() => {
    ({ close } = createTestDb());
  });
  afterEach(() => close());

  it("GET /catalog/artists returns seeded artists", async () => {
    track.create({ artist: "E2E Artist One" });
    track.create({ artist: "E2E Artist Two" });

    const res = await request(app).get("/catalog/artists");
    expect(res.status).to.equal(200);
    expect(res.body.items).to.be.an("array");
    expect(res.body.total).to.be.at.least(2);
  });

  it("GET /catalog/search?q= finds seeded tracks", async () => {
    track.create({ title: "E2EUniqueTitle999" });
    const res = await request(app)
      .get("/catalog/search")
      .query({ q: "E2EUniqueTitle999" });
    expect(res.status).to.equal(200);
    expect(res.body.tracks).to.be.an("array");
    expect(res.body.tracks.length).to.equal(1);
    expect(res.body.tracks[0].title).to.equal("E2EUniqueTitle999");
  });

  it("GET /catalog/search?q= empty returns empty arrays", async () => {
    const res = await request(app).get("/catalog/search").query({ q: "" });
    expect(res.status).to.equal(200);
    expect(res.body.artists).to.deep.equal([]);
    expect(res.body.albums).to.deep.equal([]);
    expect(res.body.tracks).to.deep.equal([]);
  });

  it("GET /catalog/tracks returns paginated seeded tracks", async () => {
    track.createMany(3);
    const res = await request(app).get("/catalog/tracks").query({ limit: 2 });
    expect(res.status).to.equal(200);
    expect(res.body.items).to.have.length(2);
    expect(res.body.total).to.equal(3);
  });
});
