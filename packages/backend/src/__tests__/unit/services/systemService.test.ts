import { expect } from "chai";
import sinon from "sinon";
import fs from "fs";
import type { MpdConnectionManager } from "@services/mpd/mpdConnectionManager.js";
import { SystemServiceImpl } from "@services/system/systemService.js";

const ASOUND_CARDS = ` 0 [PCH            ]: HDA-Intel - HDA Intel PCH
                      HDA Intel PCH at 0xf7c30000 irq 34
 1 [USB Audio      ]: USB-Audio - USB Audio Device
                      USB Audio Device at usb-0000:00:14.0-1, full speed
`;

// Mirrors real /proc/asound/pcm: the device name is repeated before the
// `: playback` marker, and capture-only devices must be ignored.
const ASOUND_PCM = `00-00: ALC671 Analog : ALC671 Analog : playback 1 : capture 1
01-00: USB Audio : USB Audio : capture 1
01-03: USB Audio : USB Audio : playback 1 : capture 1
`;

function enoent(path: string): NodeJS.ErrnoException {
  const error = new Error(`ENOENT: no such file or directory, open '${path}'`);
  (error as NodeJS.ErrnoException).code = "ENOENT";
  return error;
}

function stubFs(files: Record<string, string>): {
  readFile: sinon.SinonStub;
  readdir: sinon.SinonStub;
} {
  const readFile = sinon
    .stub(fs, "readFileSync")
    .callsFake((path: fs.PathOrFileDescriptor) => {
      const key = String(path);
      if (key in files) return files[key];
      throw enoent(key);
    });
  const readdir = sinon
    .stub(fs, "readdirSync")
    .returns(["1-1", "1-1:1.0", "usb1"] as never);
  return { readFile, readdir };
}

describe("SystemServiceImpl.detectAudioDevices (unit)", () => {
  let service: SystemServiceImpl;

  beforeEach(() => {
    service = new SystemServiceImpl({
      connected: false,
    } as unknown as MpdConnectionManager);
  });

  it("enumerates HDA and USB playback devices from /proc/asound", () => {
    const { readFile, readdir } = stubFs({
      "/proc/asound/cards": ASOUND_CARDS,
      "/proc/asound/pcm": ASOUND_PCM,
      "/proc/asound/card1/usbid": "0d8c:0014\n",
      "/sys/bus/usb/devices/1-1/idVendor": "0d8c\n",
      "/sys/bus/usb/devices/1-1/idProduct": "0014\n",
      "/sys/bus/usb/devices/1-1/manufacturer": "C-Media Electronics, Inc.\n",
      "/sys/bus/usb/devices/1-1/product": "USB Audio Device\n",
    });

    try {
      expect(service.detectAudioDevices()).to.deep.equal([
        {
          card: "hw:0,0",
          name: "PCH (card 0)",
          description: "ALC671 Analog",
          usb: false,
        },
        {
          card: "hw:1,3",
          name: "USB Audio (card 1)",
          description: "USB Audio",
          usb: true,
          usbVendor: "C-Media Electronics, Inc.",
          usbProduct: "USB Audio Device",
        },
      ]);
    } finally {
      readFile.restore();
      readdir.restore();
    }
  });

  it("leaves USB vendor/product undefined when sysfs cannot resolve the id", () => {
    const { readFile, readdir } = stubFs({
      "/proc/asound/cards": ASOUND_CARDS,
      "/proc/asound/pcm": ASOUND_PCM,
      "/proc/asound/card1/usbid": "0d8c:0014\n",
      "/sys/bus/usb/devices/1-1/idVendor": "0bda\n",
      "/sys/bus/usb/devices/1-1/idProduct": "0129\n",
    });

    try {
      const devices = service.detectAudioDevices();
      expect(devices).to.have.length(2);
      expect(devices[1]).to.deep.equal({
        card: "hw:1,3",
        name: "USB Audio (card 1)",
        description: "USB Audio",
        usb: true,
      });
    } finally {
      readFile.restore();
      readdir.restore();
    }
  });

  it("returns an empty list and never throws when /proc files are missing", () => {
    const { readFile, readdir } = stubFs({});

    try {
      expect(service.detectAudioDevices()).to.deep.equal([]);
    } finally {
      readFile.restore();
      readdir.restore();
    }
  });
});
