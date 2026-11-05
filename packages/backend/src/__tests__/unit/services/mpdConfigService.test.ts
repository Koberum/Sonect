import { expect } from "chai";
import sinon from "sinon";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
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
});

describe("MpdConfigServiceImpl.getOutputDeviceName (unit)", () => {
  let dir: string;
  let configPath: string;
  let previousConfigPath: string | undefined;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "sonect-mpd-config-"));
    configPath = path.join(dir, "mpd-audio.conf");
    fs.writeFileSync(
      configPath,
      [
        "audio_output {",
        '    type "alsa"',
        '    name "PCH (card 0)"',
        '    device "hw:CARD=PCH,DEV=0"',
        '    mixer_type "software"',
        "}",
      ].join("\n"),
      "utf-8",
    );
    previousConfigPath = process.env.MPD_CONFIG_PATH;
    process.env.MPD_CONFIG_PATH = configPath;
  });

  afterEach(() => {
    if (previousConfigPath === undefined) {
      delete process.env.MPD_CONFIG_PATH;
    } else {
      process.env.MPD_CONFIG_PATH = previousConfigPath;
    }
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("resolves the configured card to a friendly device name", () => {
    const resolve = sinon.stub().returns("Built-in Audio");
    const svc = new MpdConfigServiceImpl(conn, undefined, resolve);

    expect(svc.getOutputDeviceName()).to.equal("Built-in Audio");
    expect(
      resolve.calledOnceWith("hw:CARD=PCH,DEV=0", "PCH (card 0)"),
    ).to.equal(true);
  });

  it("falls back to the name stored in the drop-in", () => {
    const svc = new MpdConfigServiceImpl(conn);

    expect(svc.getOutputDeviceName()).to.equal("PCH (card 0)");
  });

  it("returns null when no audio output is configured", () => {
    fs.writeFileSync(configPath, "# no output\n", "utf-8");
    const svc = new MpdConfigServiceImpl(conn);

    expect(svc.getOutputDeviceName()).to.equal(null);
  });
});
