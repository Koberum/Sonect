import { lookup as defaultLookup } from "node:dns/promises";
import * as defaultOs from "node:os";
import type { NetworkStatus } from "@repo/types";

const DNS_CHECK_TIMEOUT_MS = 3000;

export interface NetworkService {
  getNetworkStatus(): Promise<NetworkStatus>;
}

export class NetworkServiceImpl implements NetworkService {
  constructor(
    private readonly os: typeof defaultOs = defaultOs,
    private readonly lookup: typeof defaultLookup = defaultLookup,
  ) {}

  public async getNetworkStatus(): Promise<NetworkStatus> {
    const connected = Object.values(this.os.networkInterfaces()).some(
      (addresses) =>
        addresses?.some(
          ({ family, internal }) =>
            !internal && (family === "IPv4" || family === "IPv6"),
        ) ?? false,
    );

    if (!connected) {
      return { connected: false, dnsReachable: false };
    }

    const host = process.env.DNS_CHECK_HOST?.trim() || "example.com";
    const dnsReachable = await this.checkDnsReachability(host);
    return { connected: true, dnsReachable };
  }

  private checkDnsReachability(host: string): Promise<boolean> {
    return new Promise((resolve) => {
      let settled = false;
      const timeout = setTimeout(() => {
        settled = true;
        resolve(false);
      }, DNS_CHECK_TIMEOUT_MS);

      this.lookup(host).then(
        () => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          resolve(true);
        },
        () => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          resolve(false);
        },
      );
    });
  }
}
