import { isIP } from "node:net";

const BLOCKED_HOSTS = new Set([
  "localhost",
  "localhost.localdomain",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
  "metadata.google",
]);

export function isBlockedHostname(hostname: string) {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (!host || BLOCKED_HOSTS.has(host)) return true;
  if (host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return true;
  }
  if (isIP(host) && isPrivateAddress(host)) return true;
  return false;
}

export function isPrivateAddress(address: string) {
  const ip = address.trim().toLowerCase().split("%")[0] ?? "";
  const kind = isIP(ip);
  if (kind === 4) return isPrivateIpv4(ip);
  if (kind === 6) return isPrivateIpv6(ip);
  return true;
}

function isPrivateIpv4(ip: string) {
  const parts = ip.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 192 && b === 0) return true;
  if (a === 198 && (b === 18 || b === 19 || b === 51)) return true;
  if (a === 203 && b === 0) return true;
  if (a >= 224) return true;
  return false;
}

function isPrivateIpv6(ip: string) {
  if (ip === "::1" || ip === "::") return true;
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIpv4(mapped[1]);

  const expanded = expandIpv6(ip);
  if (!expanded) return true;
  if (expanded.startsWith("ff")) return true;

  const mappedTail = expanded.match(/^0{20}ffff([0-9a-f]{8})$/);
  if (mappedTail) {
    const hex = mappedTail[1];
    const v4 = [0, 4, 8, 12].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(".");
    return isPrivateIpv4(v4);
  }

  const first = parseInt(expanded.slice(0, 4), 16);
  if ((first & 0xfe00) === 0xfc00) return true;
  if ((first & 0xffc0) === 0xfe80) return true;
  if ((first & 0xffc0) === 0xfec0) return true;
  return false;
}

function expandIpv6(ip: string) {
  if (ip.split("::").length > 2) return null;
  const [left, right] = ip.split("::");
  const parse = (value: string | undefined) => {
    if (!value) return [];
    const parts = value.split(":");
    if (parts.some((part) => part.length < 1 || part.length > 4 || /[^0-9a-f]/i.test(part))) {
      return null;
    }
    return parts;
  };
  const leftParts = parse(left);
  const rightParts = ip.includes("::") ? parse(right) : [];
  if (!leftParts || !rightParts) return null;
  if (!ip.includes("::")) {
    if (leftParts.length !== 8) return null;
    return leftParts.map((part) => part.padStart(4, "0")).join("").toLowerCase();
  }
  const missing = 8 - leftParts.length - rightParts.length;
  if (missing < 1) return null;
  const parts = [...leftParts, ...Array.from({ length: missing }, () => "0"), ...rightParts];
  return parts.map((part) => part.padStart(4, "0")).join("").toLowerCase();
}
