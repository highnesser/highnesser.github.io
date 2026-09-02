import dns from "node:dns/promises";
import net from "node:net";

export class UnsafeUrlError extends Error {
  constructor(url: string, reason: string) {
    super(`Refusing to fetch ${url}: ${reason}`);
    this.name = "UnsafeUrlError";
  }
}

const MAX_REDIRECTS = 5;

/**
 * Fetches a user-supplied URL while blocking SSRF: only http(s), no
 * loopback/private/link-local/metadata addresses (checked on the hostname
 * itself and on every DNS-resolved IP, since a hostname can be re-pointed at
 * an internal address - "DNS rebinding"). Redirects are followed manually so
 * each hop is re-validated instead of trusting the final response.url.
 */
export async function safeFetch(
  url: string,
  init?: RequestInit
): Promise<Response> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertSafeUrl(current);
    const res = await fetch(current, { ...init, redirect: "manual" });
    if (res.status >= 300 && res.status < 400 && res.headers.has("location")) {
      current = new URL(res.headers.get("location")!, current).toString();
      continue;
    }
    return res;
  }
  throw new UnsafeUrlError(url, "too many redirects");
}

export async function assertSafeUrl(rawUrl: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError(rawUrl, "not a valid URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new UnsafeUrlError(rawUrl, `unsupported scheme ${parsed.protocol}`);
  }

  const hostname = parsed.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new UnsafeUrlError(rawUrl, "localhost is not allowed");
  }

  // Hostname may itself be an IP literal.
  if (net.isIP(hostname)) {
    if (isUnsafeIp(hostname)) {
      throw new UnsafeUrlError(rawUrl, `${hostname} is a private/internal address`);
    }
    return;
  }

  let addresses: string[];
  try {
    const records = await dns.lookup(hostname, { all: true });
    addresses = records.map((r) => r.address);
  } catch {
    throw new UnsafeUrlError(rawUrl, "could not resolve hostname");
  }

  if (addresses.length === 0) {
    throw new UnsafeUrlError(rawUrl, "hostname resolved to no addresses");
  }

  for (const addr of addresses) {
    if (isUnsafeIp(addr)) {
      throw new UnsafeUrlError(
        rawUrl,
        `resolves to private/internal address ${addr}`
      );
    }
  }
}

function isUnsafeIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const octets = ip.split(".").map(Number);
    const [a, b] = octets;
    if (a === 127) return true; // loopback
    if (a === 10) return true; // private
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 169 && b === 254) return true; // link-local incl. cloud metadata (169.254.169.254)
    if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
    if (a === 0) return true; // "this network"
    return false;
  }

  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    if (normalized === "::1") return true; // loopback
    if (normalized.startsWith("fe80:")) return true; // link-local
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // unique local
    if (normalized.startsWith("::ffff:")) {
      // IPv4-mapped IPv6 - re-check the embedded IPv4 address.
      const v4 = normalized.split(":").pop();
      if (v4 && net.isIPv4(v4)) return isUnsafeIp(v4);
    }
    return false;
  }

  return true; // unrecognized format - fail closed
}
