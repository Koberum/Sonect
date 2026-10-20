import { expect } from "chai";
import sinon from "sinon";
import fs from "fs";
import os from "os";
import path from "path";
import type { MpdConnectionManager } from "@services/mpd/mpdConnectionManager.js";
import type { LogService } from "@services/utils/logService.js";
import {
  SystemServiceImpl,
  type SoundPaths,
} from "@services/system/systemService.js";

const conn = { connected: false } as unknown as MpdConnectionManager;

describe("SystemServiceImpl.detectAudioDevices (unit)", () => {
  let tmpDir: string;
  let paths: SoundPaths;
  let logService: LogService;
  let pushLog: sinon.SinonStub;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sonect-audio-"));
    paths = {
      procAsound: path.join(tmpDir, "proc/asound"),
      sysSound: path.join(tmpDir, "sys/class/sound"),
      usbDevices: path.join(tmpDir, "sys/bus/usb/devices"),
    };
    pushLog = sinon.stub();
    logService = { pushLog } as unknown as LogService;
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function write(relativePath: string, content: string): void {
    const target = path.join(tmpDir, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }

  function touch(relativePath: string): void {
    write(relativePath, "");
  }

  function symlink(relativePath: string, target: string): void {
    const link = path.join(tmpDir, relativePath);
    fs.mkdirSync(path.dirname(link), { recursive: true });
    fs.symlinkSync(target, link);
  }

  function makeService(): SystemServiceImpl {
    return new SystemServiceImpl(conn, { logService, paths });
  }

  it("enumerates playback cards from sysfs without /proc/asound", () => {
    write("sys/class/sound/card0/id", "Codec\n");
    write("sys/class/sound/card1/id", "HDMI\n");
    write("sys/class/sound/card2/id", "ZD3\n");
    touch("sys/class/sound/pcmC2D0p");
    touch("sys/class/sound/pcmC1D0p");
    touch("sys/class/sound/pcmC0D0p");
    touch("sys/class/sound/pcmC1D0c");

    write("sys/devices/usb1/1-1/1-1:1.0/uevent", "PRODUCT=152a/889b/108\n");
    write("sys/devices/usb1/1-1/idVendor", "152a\n");
    write("sys/devices/usb1/1-1/idProduct", "889b\n");
    write("sys/devices/usb1/1-1/manufacturer", "XMOS\n");
    write("sys/devices/usb1/1-1/product", "Fosi Audio ZD3\n");
    symlink(
      "sys/class/sound/card2/device",
      "../../../devices/usb1/1-1/1-1:1.0",
    );

    expect(makeService().detectAudioDevices()).to.deep.equal([
      {
        card: "hw:CARD=Codec,DEV=0",
        name: "Codec (card 0)",
        description: "Codec",
        usb: false,
      },
      {
        card: "hw:CARD=HDMI,DEV=0",
        name: "HDMI (card 1)",
        description: "HDMI",
        usb: false,
      },
      {
        card: "hw:CARD=ZD3,DEV=0",
        name: "ZD3 (card 2)",
        description: "Fosi Audio ZD3",
        usb: true,
        usbVendor: "XMOS",
        usbProduct: "Fosi Audio ZD3",
      },
    ]);
    expect(pushLog.called).to.equal(false);
  });

  it("ignores capture-only PCMs", () => {
    write("sys/class/sound/card0/id", "Codec\n");
    touch("sys/class/sound/pcmC0D0c");
    touch("sys/class/sound/pcmC0D0p");

    const devices = makeService().detectAudioDevices();

    expect(devices).to.have.length(1);
    expect(devices[0].card).to.equal("hw:CARD=Codec,DEV=0");
  });

  it("handles non-USB cards such as Raspberry Pi HAT DACs", () => {
    write("sys/class/sound/card0/id", "sndrpihifiberry\n");
    touch("sys/class/sound/pcmC0D0p");
    write("sys/devices/platform/soc/soc:sound/uevent", "");
    symlink(
      "sys/class/sound/card0/device",
      "../../../devices/platform/soc/soc:sound",
    );

    expect(makeService().detectAudioDevices()).to.deep.equal([
      {
        card: "hw:CARD=sndrpihifiberry,DEV=0",
        name: "sndrpihifiberry (card 0)",
        description: "sndrpihifiberry",
        usb: false,
      },
    ]);
  });

  it("lists every playback PCM on a card in device order", () => {
    write("sys/class/sound/card0/id", "PCH\n");
    touch("sys/class/sound/pcmC0D7p");
    touch("sys/class/sound/pcmC0D0p");
    touch("sys/class/sound/pcmC0D3p");
    touch("sys/class/sound/pcmC0D0c");

    const devices = makeService().detectAudioDevices();

    expect(devices.map((device) => device.card)).to.deep.equal([
      "hw:CARD=PCH,DEV=0",
      "hw:CARD=PCH,DEV=3",
      "hw:CARD=PCH,DEV=7",
    ]);
  });

  it("keeps USB devices without manufacturer/product metadata", () => {
    write("sys/class/sound/card2/id", "USB Audio\n");
    touch("sys/class/sound/pcmC2D0p");
    write("sys/devices/usb1/1-1/1-1:1.0/uevent", "PRODUCT=152a/889b/108\n");
    symlink(
      "sys/class/sound/card2/device",
      "../../../devices/usb1/1-1/1-1:1.0",
    );

    expect(makeService().detectAudioDevices()).to.deep.equal([
      {
        card: "hw:CARD=USB Audio,DEV=0",
        name: "USB Audio (card 2)",
        description: "USB Audio",
        usb: true,
      },
    ]);
  });

  it("enriches sysfs devices with /proc/asound descriptions", () => {
    write("sys/class/sound/card0/id", "Codec\n");
    touch("sys/class/sound/pcmC0D0p");
    write(
      "proc/asound/pcm",
      "00-00: ALC671 Analog : ALC671 Analog : playback 1 : capture 1\n",
    );

    expect(makeService().detectAudioDevices()).to.deep.equal([
      {
        card: "hw:CARD=Codec,DEV=0",
        name: "Codec (card 0)",
        description: "ALC671 Analog",
        usb: false,
      },
    ]);
  });

  it("uses /proc/asound usbid when the sysfs card device link is missing", () => {
    write("sys/class/sound/card1/id", "USB Audio\n");
    touch("sys/class/sound/pcmC1D0p");
    write("proc/asound/card1/usbid", "0d8c:0014\n");
    write("sys/bus/usb/devices/1-1/idVendor", "0d8c\n");
    write("sys/bus/usb/devices/1-1/idProduct", "0014\n");
    write(
      "sys/bus/usb/devices/1-1/manufacturer",
      "C-Media Electronics, Inc.\n",
    );
    write("sys/bus/usb/devices/1-1/product", "USB Audio Device\n");

    expect(makeService().detectAudioDevices()).to.deep.equal([
      {
        card: "hw:CARD=USB Audio,DEV=0",
        name: "USB Audio (card 1)",
        description: "USB Audio Device",
        usb: true,
        usbVendor: "C-Media Electronics, Inc.",
        usbProduct: "USB Audio Device",
      },
    ]);
  });

  it("falls back to /proc/asound when sysfs is unreadable", () => {
    write(
      "proc/asound/cards",
      ` 0 [PCH            ]: HDA-Intel - HDA Intel PCH
 1 [USB Audio      ]: USB-Audio - USB Audio Device
`,
    );
    write(
      "proc/asound/pcm",
      `00-00: ALC671 Analog : ALC671 Analog : playback 1 : capture 1
01-00: USB Audio : USB Audio : capture 1
01-03: USB Audio : USB Audio : playback 1 : capture 1
`,
    );
    write("proc/asound/card1/usbid", "0d8c:0014\n");
    write("sys/bus/usb/devices/1-1/idVendor", "0d8c\n");
    write("sys/bus/usb/devices/1-1/idProduct", "0014\n");
    write(
      "sys/bus/usb/devices/1-1/manufacturer",
      "C-Media Electronics, Inc.\n",
    );
    write("sys/bus/usb/devices/1-1/product", "USB Audio Device\n");

    expect(makeService().detectAudioDevices()).to.deep.equal([
      {
        card: "hw:CARD=PCH,DEV=0",
        name: "PCH (card 0)",
        description: "ALC671 Analog",
        usb: false,
      },
      {
        card: "hw:CARD=USB Audio,DEV=3",
        name: "USB Audio (card 1)",
        description: "USB Audio",
        usb: true,
        usbVendor: "C-Media Electronics, Inc.",
        usbProduct: "USB Audio Device",
      },
    ]);
  });

  it("returns an empty list and warns once when both sources are missing", () => {
    const service = makeService();

    expect(service.detectAudioDevices()).to.deep.equal([]);
    expect(service.detectAudioDevices()).to.deep.equal([]);

    expect(pushLog.calledOnce).to.equal(true);
    expect(pushLog.firstCall.args[0]).to.equal("warn");
    expect(String(pushLog.firstCall.args[1])).to.include(paths.sysSound);
    expect(String(pushLog.firstCall.args[1])).to.include(paths.procAsound);
  });

  it("falls back to the numeric card string when the card id is unreadable", () => {
    fs.mkdirSync(path.join(tmpDir, "sys/class/sound/card0"), {
      recursive: true,
    });
    touch("sys/class/sound/pcmC0D0p");

    expect(makeService().detectAudioDevices()).to.deep.equal([
      {
        card: "hw:0,0",
        name: "card 0 (card 0)",
        description: "card 0",
        usb: false,
      },
    ]);
  });

  it("does not throw when a USB card's device symlink is dangling", () => {
    write("sys/class/sound/card0/id", "Codec\n");
    touch("sys/class/sound/pcmC0D0p");
    symlink("sys/class/sound/card0/device", "../../../devices/missing");

    const devices = makeService().detectAudioDevices();

    expect(devices).to.have.length(1);
    expect(devices[0].usb).to.equal(false);
  });
});
