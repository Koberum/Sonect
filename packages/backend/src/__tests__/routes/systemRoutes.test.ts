import { expect } from "chai";
import express from "express";
import supertest from "supertest";
import { errorHandler } from "../../middleware/errorHandler.js";

describe("System network routes", () => {
  let request: supertest.SuperTest<supertest.Test>;

  before(async () => {
    const { default: systemRoutes } =
      await import("../../routes/systemRoutes.ts");
    const app = express();
    app.use(express.json());
    app.use("/system", systemRoutes);
    app.use(errorHandler);
    request = supertest(app) as supertest.SuperTest<supertest.Test>;
  });

  it("returns only the read-only network status fields", async () => {
    const response = await request.get("/system/network/status").expect(200);

    expect(Object.keys(response.body).sort()).to.deep.equal([
      "connected",
      "dnsReachable",
    ]);
    expect(response.body.connected).to.be.a("boolean");
    expect(response.body.dnsReachable).to.be.a("boolean");
  });

  it("does not expose Wi-Fi scanning or connection routes", async () => {
    await request.get("/system/network/wifi/scan").expect(404);
    await request.post("/system/network/wifi/connect").expect(404);
    await request.post("/system/network/wifi/disconnect").expect(404);
  });
});
