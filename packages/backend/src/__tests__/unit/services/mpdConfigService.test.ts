import { expect } from "chai";
import sinon from "sinon";
import fs from "fs";
import type { MpdConnectionManager } from "@services/mpd/mpdConnectionManager.js";
import { MpdConfigServiceImpl } from "@services/mpd/mpdConfigService.js";

const conn = { connected: false } as unknown as MpdConnectionManager;

describe("MpdConfigServiceImpl.restartMPD (unit)", () => {
  it("calls the injected reload hook once and returns success", () => {
    const reload = sinon.spy();
    const svc = new MpdConfigServiceImpl(conn, reload);

    const res = svc.restartMPD();

    expect(res.success).to.equal(true);
    expect(res.warning).to.equal(undefined);
    expect(reload.calledOnce).to.equal(true);
  });

  it("returns a warning when the reload hook throws", () => {
    const reload = sinon.stub().throws(new Error("boom"));
    const svc = new MpdConfigServiceImpl(conn, reload);

    const res = svc.restartMPD();

    expect(res.success).to.equal(false);
    expect(res.warning).to.be.a("string").and.include("boom");
  });

  it("updateConfig writes the drop-in then invokes the reload hook", () => {
    const reload = sinon.spy();
    const write = sinon.stub(fs, "writeFileSync");
    const mkdir = sinon.stub(fs, "mkdirSync");
    process.env.MPD_CONFIG_PATH = "/tmp/sonect-mpd-test/mpd-audio.conf";

    try {
      const svc = new MpdConfigServiceImpl(conn, reload);
      const res = svc.updateConfig("audio_output {}\n");

      expect(res.success).to.equal(true);
      expect(write.calledOnce).to.equal(true);
      expect(reload.calledOnce).to.equal(true);
    } finally {
      delete process.env.MPD_CONFIG_PATH;
      write.restore();
      mkdir.restore();
    }
  });
});
