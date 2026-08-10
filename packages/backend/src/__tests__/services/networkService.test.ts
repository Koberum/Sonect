import { expect } from "chai";
import sinon from "sinon";
import esmock from "esmock";

const MOCK_WIFI_SCAN = `MyNetwork:85:WPA2\nOtherNet:40:WPA3\nOpenNet:20:--\n`;

const MOCK_DISCONNECT_WIFI = `wifi:wlan0\n`;

const MOCK_ETHERNET_ONLY = `ethernet:eth0\n`;

const MOCK_NETWORK_STATUS = `MyWiFi:wifi:activated:wlan0\n`;

describe("Network Service", () => {
  describe("nmcli available", () => {
    let networkService: any;
    let execSyncStub: sinon.SinonStub;
    let execStub: sinon.SinonStub;

    beforeEach(async () => {
      execSyncStub = sinon.stub().returns("");
      execSyncStub.withArgs("which nmcli").returns("/usr/bin/nmcli");
      execStub = sinon.stub();

      networkService = await esmock(
        new URL("../../services/networkService.ts", import.meta.url).pathname,
        {
          child_process: {
            execSync: execSyncStub,
            exec: execStub,
          },
        },
      );
    });

    afterEach(() => {
      sinon.restore();
    });

    describe("isNmcliAvailable", () => {
      it("should return true when nmcli is installed", () => {
        expect(networkService.isNmcliAvailable()).to.be.true;
      });
    });

    describe("scanWifi", () => {
      it("should parse nmcli output into WifiNetwork array", () => {
        execSyncStub
          .withArgs(sinon.match("device wifi list"))
          .returns(MOCK_WIFI_SCAN);

        const networks = networkService.scanWifi();

        expect(networks).to.have.length(3);
        expect(networks[0]).to.deep.equal({
          ssid: "MyNetwork",
          signal: 85,
          secured: true,
        });
      });

      it("should throw on nmcli failure", () => {
        execSyncStub
          .withArgs(sinon.match("device wifi list"))
          .throws(new Error("No Wi-Fi device"));

        expect(() => networkService.scanWifi()).to.throw("Failed to scan WiFi");
      });
    });

    describe("connectWifi", () => {
      it("should connect with password and return success", async () => {
        execStub.callsFake(
          (_cmd: string, _opts: any, callback?: (error: null) => void) => {
            if (callback) callback(null);
          },
        );

        const result = await networkService.connectWifi("MyNet", "pass123");

        expect(result.success).to.be.true;
      });

      it("should connect without password and return success", async () => {
        execStub.callsFake(
          (_cmd: string, _opts: any, callback?: (error: null) => void) => {
            if (callback) callback(null);
          },
        );

        const result = await networkService.connectWifi("OpenNet");

        expect(result.success).to.be.true;
      });

      it("should return failure on connection error", async () => {
        execStub.callsFake(
          (_cmd: string, _opts: any, callback?: (error: Error) => void) => {
            if (callback) callback(new Error("Bad password"));
          },
        );

        const result = await networkService.connectWifi("MyNet", "wrong");

        expect(result.success).to.be.false;
        expect(result.error).to.include("Connection failed");
      });
    });

    describe("disconnectWifi", () => {
      it("should disconnect active WiFi connection", async () => {
        execSyncStub.callsFake((cmd: string) => {
          if (typeof cmd === "string" && cmd.includes("connection show"))
            return MOCK_DISCONNECT_WIFI;
          return "";
        });

        const result = await networkService.disconnectWifi();

        expect(result.success).to.be.true;
        expect(
          execSyncStub.calledWith(
            sinon.match(
              (val: unknown) =>
                typeof val === "string" &&
                val.includes("device disconnect wlan0"),
            ),
            sinon.match.any,
          ),
        ).to.be.true;
      });

      it("should return failure when no active WiFi", async () => {
        execSyncStub.callsFake((cmd: string) => {
          if (cmd.includes("connection show")) return MOCK_ETHERNET_ONLY;
          return "";
        });

        const result = await networkService.disconnectWifi();

        expect(result.success).to.be.false;
        expect(result.error).to.equal("No active WiFi connection");
      });

      it("should handle disconnect failure", async () => {
        execSyncStub.callsFake((cmd: string) => {
          if (cmd.includes("connection show")) return MOCK_DISCONNECT_WIFI;
          if (cmd.includes("device disconnect")) throw new Error("failed");
          return "";
        });

        const result = await networkService.disconnectWifi();

        expect(result.success).to.be.false;
      });
    });

    describe("getNetworkStatus", () => {
      it("should return connected status for active WiFi", () => {
        execSyncStub.resetBehavior();
        execSyncStub.returns(MOCK_NETWORK_STATUS);

        const status = networkService.getNetworkStatus();

        expect(status.connected).to.be.true;
        expect(status.ssid).to.equal("MyWiFi");
      });

      it("should return disconnected when no active connections", () => {
        execSyncStub.resetBehavior();
        execSyncStub.returns("");

        const status = networkService.getNetworkStatus();

        expect(status.connected).to.be.false;
      });
    });
  });

  describe("nmcli not available", () => {
    let networkService: any;
    let execSyncStub: sinon.SinonStub;
    let execStub: sinon.SinonStub;

    beforeEach(async () => {
      execSyncStub = sinon.stub();
      execSyncStub.throws(new Error("not found"));
      execStub = sinon.stub();

      networkService = await esmock(
        new URL("../../services/networkService.ts", import.meta.url).pathname,
        {
          child_process: {
            execSync: execSyncStub,
            exec: execStub,
          },
        },
      );
    });

    afterEach(() => {
      sinon.restore();
    });

    describe("isNmcliAvailable", () => {
      it("should return false when nmcli is not installed", () => {
        expect(networkService.isNmcliAvailable()).to.be.false;
      });
    });

    describe("scanWifi", () => {
      it("should throw when nmcli is not available", () => {
        expect(() => networkService.scanWifi()).to.throw(
          "nmcli is not available",
        );
      });
    });

    describe("connectWifi", () => {
      it("should return failure when nmcli is not available", async () => {
        const result = await networkService.connectWifi("MyNet");

        expect(result.success).to.be.false;
        expect(result.error).to.equal("nmcli is not available");
      });
    });

    describe("disconnectWifi", () => {
      it("should return failure when nmcli is not available", async () => {
        const result = await networkService.disconnectWifi();

        expect(result.success).to.be.false;
        expect(result.error).to.equal("nmcli is not available");
      });
    });

    describe("getNetworkStatus", () => {
      it("should return disconnected when nmcli is unavailable", () => {
        const status = networkService.getNetworkStatus();

        expect(status.connected).to.be.false;
      });
    });
  });
});
