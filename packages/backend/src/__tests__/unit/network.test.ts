import { expect } from "chai";
import sinon from "sinon";
import esmock from "esmock";

describe("NetworkService (unit, esmock)", () => {
  let clock: sinon.SinonFakeTimers;

  beforeEach(() => {
    clock = sinon.useFakeTimers();
  });

  afterEach(() => {
    clock.restore();
    delete process.env.DNS_CHECK_HOST;
  });

  async function loadService(overrides: {
    networkInterfaces?: () => ReturnType<
      typeof import("node:os").networkInterfaces
    >;
    lookup?: typeof import("node:dns/promises").lookup;
  }) {
    const osStub: Record<string, unknown> = {};
    if (overrides.networkInterfaces)
      osStub.networkInterfaces = overrides.networkInterfaces;
    const dnsStub: Record<string, unknown> = {};
    if (overrides.lookup) dnsStub.lookup = overrides.lookup;
    const mod = await esmock("../../services/network/networkService.js", {
      "node:os": osStub,
      "node:dns/promises": dnsStub,
    });
    return new mod.NetworkServiceImpl() as {
      getNetworkStatus(): Promise<{
        connected: boolean;
        dnsReachable: boolean;
      }>;
    };
  }

  describe("getNetworkStatus", () => {
    it("returns disconnected when no non-loopback interface", async () => {
      let lookupCalled = false;
      const service = await loadService({
        networkInterfaces: () => ({
          lo: [
            { family: "IPv4", internal: true, address: "127.0.0.1" } as never,
          ],
        }),
        lookup: ((..._args: unknown[]) => {
          lookupCalled = true;
          return Promise.resolve({ address: "1.1.1.1", family: 4 } as never);
        }) as never,
      });
      const status = await service.getNetworkStatus();
      expect(status).to.deep.equal({ connected: false, dnsReachable: false });
      expect(lookupCalled).to.be.false;
    });

    it("returns dnsReachable true when lookup resolves", async () => {
      const service = await loadService({
        networkInterfaces: () => ({
          eth0: [
            {
              family: "IPv4",
              internal: false,
              address: "192.168.1.10",
            } as never,
          ],
        }),
        lookup: (() =>
          Promise.resolve({
            address: "93.184.216.34",
            family: 4,
          } as never)) as never,
      });
      const status = await service.getNetworkStatus();
      expect(status).to.deep.equal({ connected: true, dnsReachable: true });
    });

    it("returns dnsReachable false when lookup rejects", async () => {
      const service = await loadService({
        networkInterfaces: () => ({
          eth0: [
            { family: "IPv6", internal: false, address: "fe80::1" } as never,
          ],
        }),
        lookup: (() => Promise.reject(new Error("ENOTFOUND"))) as never,
      });
      const status = await service.getNetworkStatus();
      expect(status).to.deep.equal({ connected: true, dnsReachable: false });
    });

    it("returns dnsReachable false on timeout", async () => {
      const service = await loadService({
        networkInterfaces: () => ({
          eth0: [
            { family: "IPv4", internal: false, address: "10.0.0.5" } as never,
          ],
        }),
        lookup: (() => new Promise(() => {})) as never,
      });
      const promise = service.getNetworkStatus();
      await clock.tickAsync(3000);
      const status = await promise;
      expect(status).to.deep.equal({ connected: true, dnsReachable: false });
    });

    it("uses DNS_CHECK_HOST env when set", async () => {
      process.env.DNS_CHECK_HOST = "custom.example.org";
      let calledHost: unknown = null;
      const service = await loadService({
        networkInterfaces: () => ({
          eth0: [
            {
              family: "IPv4",
              internal: false,
              address: "192.168.1.10",
            } as never,
          ],
        }),
        lookup: ((host: string) => {
          calledHost = host;
          return Promise.resolve({ address: "1.1.1.1", family: 4 } as never);
        }) as never,
      });
      await service.getNetworkStatus();
      expect(calledHost).to.equal("custom.example.org");
    });
  });
});
