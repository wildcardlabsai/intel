/**
 * Guards against server-side request forgery.
 *
 * Most endpoints this application talks to come from environment variables set
 * at deploy time. Planning endpoints do not: an administrator types them into
 * a form, and the server then fetches them. That makes the admin panel a route
 * into anything the server can reach — cloud instance metadata, an internal
 * database admin page, a service on localhost — and the fetched body is stored
 * and displayed, so it is an exfiltration channel as well as a probe.
 *
 * Being an administrator is not a reason to allow this. The point of the guard
 * is that a compromised or careless admin account cannot reach the internal
 * network.
 *
 * The address classification here is pure and unit-tested; the hostname check
 * that resolves DNS lives below it.
 */

/** Ranges that must never be fetched, whatever the hostname resolves to. */
export type BlockedReason = string | null;

function parseIpv4(value: string): number[] | null {
  const parts = value.split(".");
  if (parts.length !== 4) return null;

  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    octets.push(octet);
  }
  return octets;
}

/**
 * Says why an address must not be fetched, or null when it is fine.
 *
 * Deliberately a denylist of non-routable space rather than an allowlist of
 * the public internet, because the public internet is what we actually want
 * to reach and it has no stable definition.
 */
export function blockedAddressReason(address: string): BlockedReason {
  const value = address.trim().toLowerCase().replace(/^\[|\]$/g, "");

  const ipv4 = parseIpv4(value);
  if (ipv4) {
    const [a, b] = ipv4 as [number, number, number, number];

    if (a === 0) return "an unspecified address";
    if (a === 127) return "a loopback address";
    if (a === 10) return "a private network address";
    if (a === 172 && b >= 16 && b <= 31) return "a private network address";
    if (a === 192 && b === 168) return "a private network address";
    if (a === 169 && b === 254) return "a link-local address (cloud instance metadata lives here)";
    if (a === 100 && b >= 64 && b <= 127) return "a carrier-grade NAT address";
    if (a === 192 && b === 0) return "a reserved address";
    if (a >= 224) return "a multicast or reserved address";
    return null;
  }

  // IPv6, including the forms that wrap an IPv4 address.
  if (value.includes(":")) {
    if (value === "::" || value === "::0") return "an unspecified address";
    if (value === "::1") return "a loopback address";
    if (value.startsWith("fe8") || value.startsWith("fe9") || value.startsWith("fea") || value.startsWith("feb")) {
      return "a link-local address";
    }
    // fc00::/7 — unique local addresses.
    if (value.startsWith("fc") || value.startsWith("fd")) return "a private network address";
    if (value.startsWith("ff")) return "a multicast address";

    // ::ffff:169.254.169.254 and friends must not slip through.
    const embedded = value.split(":").pop();
    if (embedded && embedded.includes(".")) {
      const reason = blockedAddressReason(embedded);
      if (reason) return reason;
    }
    return null;
  }

  return null;
}

/** Hostnames that are never a public data publisher. */
export function blockedHostnameReason(hostname: string): BlockedReason {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "");

  if (host.length === 0) return "an empty hostname";
  if (host === "localhost") return "localhost";

  // A literal IP is never how a council publishes open data, and allowing one
  // would skip the DNS step this guard depends on.
  if (parseIpv4(host) || host.includes(":")) {
    return blockedAddressReason(host) ?? "a bare IP address rather than a hostname";
  }

  // Single-label names resolve through internal search domains.
  if (!host.includes(".")) return "a hostname with no domain";

  for (const suffix of [".local", ".internal", ".localdomain", ".home.arpa"]) {
    if (host.endsWith(suffix)) return `an internal hostname (${suffix})`;
  }

  return null;
}

export type UrlCheck = { ok: true } | { ok: false; reason: string };

/**
 * Checks a URL's scheme and hostname without touching the network.
 *
 * This is the check that can run inside form validation. It cannot catch a
 * public hostname that resolves to a private address — `assertFetchableUrl`
 * below does that.
 */
export function checkUrlShape(rawUrl: string): UrlCheck {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "That is not a valid URL." };
  }

  if (url.protocol !== "https:") {
    return { ok: false, reason: "The endpoint must be an https URL." };
  }

  // Credentials in a URL are never needed for open data and would be stored.
  if (url.username || url.password) {
    return { ok: false, reason: "The endpoint must not contain credentials." };
  }

  const reason = blockedHostnameReason(url.hostname);
  if (reason) {
    return { ok: false, reason: `The endpoint points at ${reason}, which cannot be fetched.` };
  }

  return { ok: true };
}

/**
 * Resolves the hostname and checks every address it points at.
 *
 * This closes the case that `checkUrlShape` cannot see: a perfectly ordinary
 * hostname whose A record is 169.254.169.254.
 *
 * It does not close DNS rebinding, where the name resolves differently between
 * this check and the fetch that follows. Fully closing that needs the
 * connection pinned to the address checked here, which Node's fetch does not
 * expose. The remaining exposure is one request to an internal address by
 * someone who already controls both an admin account and a DNS zone; the
 * ranges above stop the straightforward attempt.
 */
export async function assertFetchableUrl(rawUrl: string): Promise<void> {
  const shape = checkUrlShape(rawUrl);
  if (!shape.ok) throw new Error(shape.reason);

  const { hostname } = new URL(rawUrl);

  const { lookup } = await import("node:dns/promises");
  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    throw new Error(`The endpoint's hostname (${hostname}) could not be resolved.`);
  }

  if (addresses.length === 0) {
    throw new Error(`The endpoint's hostname (${hostname}) resolved to no addresses.`);
  }

  for (const { address } of addresses) {
    const reason = blockedAddressReason(address);
    if (reason) {
      throw new Error(
        `The endpoint's hostname (${hostname}) resolves to ${reason}, which cannot be fetched.`
      );
    }
  }
}
