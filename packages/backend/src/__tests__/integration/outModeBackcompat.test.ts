import { expect } from "chai";
import fs from "fs";
import path from "path";
import { MpdConfigServiceImpl } from "@services/mpd/mpdConfigService.js";

describe("setOutputMode backcompat no-op (browser sessions use a separate engine)", () => {
  let tmpDir: string;
  let configPath: string;
  let svc: MpdConfigServiceImpl;
  const originalEnv = process.env.MPD_CONFIG_PATH;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync("sonect-outmode-");
    configPath = path.join(tmpDir, "mpd-audio.conf");
    fs.writeFileSync(
      configPath,
      [
        "audio_output {",
        '    type        "alsa"',
        '    name        "My ALSA Card"',
        '    device      "hw:0,0"',
        "}",
        "",
      ].join("\n"),
      "utf-8",
    );
    // The service reads MPD_CONFIG_PATH at construction time, so it must be
    // set before the instance is created.
    process.env.MPD_CONFIG_PATH = configPath;
    svc = new MpdConfigServiceImpl();
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.MPD_CONFIG_PATH;
    } else {
      process.env.MPD_CONFIG_PATH = originalEnv;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("does not rewrite mpd drop-in when switching output modes", () => {
    const original = fs.readFileSync(configPath, "utf-8");

    const browserResult = svc.setOutputMode("browser");
    expect(browserResult).to.deep.equal({ success: true });
    expect(fs.readFileSync(configPath, "utf8")).to.equal(original);

    const mpdResult = svc.setOutputMode("mpd");
    expect(mpdResult).to.deep.equal({ success: true });
    expect(fs.readFileSync(configPath, "utf8")).to.equal(original);
  });

  it("getOutputMode returns the last in-memory value", () => {
    expect(svc.getOutputMode()).to.equal("mpd");
    svc.setOutputMode("browser");
    expect(svc.getOutputMode()).to.equal("browser");
    svc.setOutputMode("mpd");
    expect(svc.getOutputMode()).to.equal("mpd");
  });
});
