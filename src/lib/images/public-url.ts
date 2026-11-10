import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { isBlockedHostname, isPrivateAddress } from "@/lib/meta-title/network";

export class FetchError extends Error {
  hint: string;
  constructor(message: string, hint: string) {
    super(message);
    this.name = "FetchError";
    this.hint = hint;
  }
}

export async function assertPublic(raw: string) {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new FetchError("This URL is not valid.", "Use a full domain such as example.com.");
  }
  const host = parsed.hostname.replace(/\.$/, "").toLowerCase();
  if (isBlockedHostname(host)) {
    throw new FetchError("That address is not a public website.", "Enter a public domain such as example.com.");
  }
  if (isIP(host)) {
    if (isPrivateAddress(host)) {
      throw new FetchError("That address is not a public website.", "Enter a public domain such as example.com.");
    }
    return;
  }

  let records: { address: string }[];
  try {
    records = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new FetchError("The site could not be reached.", "Check the spelling of the domain and try again.");
  }
  if (records.length === 0 || records.some((record) => isPrivateAddress(record.address))) {
    throw new FetchError("That address is not a public website.", "Enter a public domain such as example.com.");
  }
}
