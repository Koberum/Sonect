import { expect } from "chai";
import sinon from "sinon";
import esmock from "esmock";

describe("Network Service", () => {
  let networkService: typeof import("../../services/networkService.ts");
  let networkInterfacesStub: sinon.SinonStub;
  let lookupStub: sinon.SinonStub;

  beforeEach(async () => {
    delete process.env.DNS_CHECK_HOST;
    networkInterfacesStub = sinon.stub().returns({});
    lookupStub = sinon.stub().resolves({ address: "192.0.2.1", family: 4 });

    networkService = await esmock(
      new URL("../../services/networkService.ts", import.meta.url).pathname,
      {
        "node:os": {
          networkInterfaces: networkInterfacesStub,
        },
        "node:dns/promises": {
          lookup: lookupStub,
        },
      },
    );
  });

  afterEach(() => {
    delete process.env.DNS_CHECK_HOST;
    sinon.restore();
  });

  it("returns disconnected without checking DNS when there are no external addresses", async () => {
    networkInterfacesStub.returns({
      lo: [
        {
          address: "127.0.0.1",
          family: "IPv4",
          internal: true,
        },
      ],
      lo6: [
        {
          address: "::1",
          family: "IPv6",
          internal: true,
        },
      ],
    });

    const status = await networkService.getNetworkStatus();

    expect(status).to.deep.equal({ connected: false, dnsReachable: false });
    expect(lookupStub.notCalled).to.be.true;
  });

  it("reports an IPv4 connection with successful DNS", async () => {
    networkInterfacesStub.returns({
      ethernet: [
        {
          address: "192.0.2.10",
          family: "IPv4",
          internal: false,
        },
      ],
    });

    const status = await networkService.getNetworkStatus();

    expect(status).to.deep.equal({ connected: true, dnsReachable: true });
    expect(lookupStub.calledOnceWithExactly("example.com")).to.be.true;
  });

  it("reports an IPv6 connection with successful DNS", async () => {
    networkInterfacesStub.returns({
      ethernet: [
        {
          address: "2001:db8::10",
          family: "IPv6",
          internal: false,
        },
      ],
    });

    const status = await networkService.getNetworkStatus();

    expect(status).to.deep.equal({ connected: true, dnsReachable: true });
    expect(lookupStub.calledOnceWithExactly("example.com")).to.be.true;
  });

  it("reports DNS as unreachable when lookup fails", async () => {
    networkInterfacesStub.returns({
      ethernet: [
        {
          address: "192.0.2.10",
          family: "IPv4",
          internal: false,
        },
      ],
    });
    lookupStub.rejects(new Error("DNS unavailable"));

    const status = await networkService.getNetworkStatus();

    expect(status).to.deep.equal({ connected: true, dnsReachable: false });
  });

  it("reports DNS as unreachable when lookup times out", async () => {
    networkInterfacesStub.returns({
      ethernet: [
        {
          address: "192.0.2.10",
          family: "IPv4",
          internal: false,
        },
      ],
    });
    lookupStub.returns(new Promise(() => {}));
    const clock = sinon.useFakeTimers();

    try {
      const statusPromise = networkService.getNetworkStatus();
      await clock.tickAsync(3000);

      expect(await statusPromise).to.deep.equal({
        connected: true,
        dnsReachable: false,
      });
    } finally {
      clock.restore();
    }
  });

  it("uses the configured DNS check host after trimming it", async () => {
    networkInterfacesStub.returns({
      ethernet: [
        {
          address: "192.0.2.10",
          family: "IPv4",
          internal: false,
        },
      ],
    });
    process.env.DNS_CHECK_HOST = "  resolver.example.test  ";

    const status = await networkService.getNetworkStatus();

    expect(status).to.deep.equal({ connected: true, dnsReachable: true });
    expect(lookupStub.calledOnceWithExactly("resolver.example.test")).to.be
      .true;
  });
});
