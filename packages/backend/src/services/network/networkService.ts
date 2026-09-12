import { lookup } from "node:dns/promises";
import * as os from "node:os";
import type { NetworkStatus } from "@repo/types";

const DNS_CHECK_TIMEOUT_MS = 3000;

export async function getNetworkStatus(): Promise<NetworkStatus> {
  const connected = Object.values(os.networkInterfaces()).some(
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
  const dnsReachable = await checkDnsReachability(host);
  return { connected: true, dnsReachable };
}

function checkDnsReachability(host: string): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const timeout = setTimeout(() => {
      settled = true;
      resolve(false);
    }, DNS_CHECK_TIMEOUT_MS);

    lookup(host).then(
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

export interface NetworkService {
  getNetworkStatus(): Promise<NetworkStatus>;
}

export class NetworkServiceImpl implements NetworkService {
  public getNetworkStatus(): Promise<NetworkStatus> {
    return getNetworkStatus();
  }
}
