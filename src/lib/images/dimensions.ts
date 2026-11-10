export type PixelSize = { width: number | null; height: number | null; format: string };

const SUPPORTED = new Set(["jpeg", "png", "webp", "avif", "gif", "svg"]);

export function sniffFormat(bytes: Uint8Array, contentType: string | null, url: string): string {
  const sniffed = sniff(bytes);
  if (sniffed) return sniffed;
  const type = (contentType ?? "").toLowerCase();
  if (type.includes("jpeg") || type.includes("jpg")) return "jpeg";
  if (type.includes("png")) return "png";
  if (type.includes("webp")) return "webp";
  if (type.includes("avif")) return "avif";
  if (type.includes("gif")) return "gif";
  if (type.includes("svg")) return "svg";
  const ext = url.split("?")[0]?.split("#")[0]?.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "jpg" || ext === "jpeg") return "jpeg";
  if (SUPPORTED.has(ext)) return ext;
  return "unknown";
}

export function readPixelSize(bytes: Uint8Array, format: string): { width: number | null; height: number | null } {
  if (format === "png") return pngSize(bytes);
  if (format === "gif") return gifSize(bytes);
  if (format === "jpeg") return jpegSize(bytes);
  if (format === "webp") return webpSize(bytes);
  if (format === "avif") return avifSize(bytes);
  if (format === "bmp") return bmpSize(bytes);
  if (format === "svg") return svgSize(bytes);
  return { width: null, height: null };
}

function sniff(bytes: Uint8Array) {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes.length >= 6 && ascii(bytes, 0, 6) === "GIF87a") return "gif";
  if (bytes.length >= 6 && ascii(bytes, 0, 6) === "GIF89a") return "gif";
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return "webp";
  if (isAvif(bytes)) return "avif";
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) return "bmp";
  const head = Buffer.from(bytes.subarray(0, 240)).toString("utf8").trimStart().toLowerCase();
  if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"))) return "svg";
  return "";
}

function isAvif(bytes: Uint8Array) {
  if (bytes.length < 16 || ascii(bytes, 4, 4) !== "ftyp") return false;
  const brand = ascii(bytes, 8, 4);
  return brand === "avif" || brand === "avis";
}

function pngSize(bytes: Uint8Array) {
  if (bytes.length < 24 || ascii(bytes, 12, 4) !== "IHDR") return { width: null, height: null };
  return { width: u32be(bytes, 16), height: u32be(bytes, 20) };
}

function gifSize(bytes: Uint8Array) {
  if (bytes.length < 10) return { width: null, height: null };
  return { width: u16le(bytes, 6), height: u16le(bytes, 8) };
}

function jpegSize(bytes: Uint8Array) {
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    if (offset + 4 > bytes.length) break;
    const length = u16be(bytes, offset + 2);
    if (length < 2) break;
    const startOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (startOfFrame && offset + 8 < bytes.length) {
      return { height: u16be(bytes, offset + 5), width: u16be(bytes, offset + 7) };
    }
    offset += 2 + length;
  }
  return { width: null, height: null };
}

function webpSize(bytes: Uint8Array) {
  if (bytes.length < 30) return { width: null, height: null };
  const chunk = ascii(bytes, 12, 4);
  if (chunk === "VP8X" && bytes.length >= 30) {
    return { width: u24le(bytes, 24) + 1, height: u24le(bytes, 27) + 1 };
  }
  if (chunk === "VP8 " && bytes.length >= 30) {
    const start = 23;
    if (bytes[start] !== 0x9d || bytes[start + 1] !== 0x01 || bytes[start + 2] !== 0x2a) {
      return { width: null, height: null };
    }
    return { width: u16le(bytes, start + 3) & 0x3fff, height: u16le(bytes, start + 5) & 0x3fff };
  }
  if (chunk === "VP8L" && bytes.length >= 25) {
    const b0 = bytes[21];
    const b1 = bytes[22];
    const b2 = bytes[23];
    const b3 = bytes[24];
    return { width: (b0 | ((b1 & 0x3f) << 8)) + 1, height: (((b1 & 0xc0) >> 6) | (b2 << 2) | ((b3 & 0x0f) << 10)) + 1 };
  }
  return { width: null, height: null };
}

function avifSize(bytes: Uint8Array) {
  const marker = asciiIndex(bytes, "ispe");
  if (marker < 0 || marker + 12 >= bytes.length) return { width: null, height: null };
  return { width: u32be(bytes, marker + 4), height: u32be(bytes, marker + 8) };
}

function bmpSize(bytes: Uint8Array) {
  if (bytes.length < 26) return { width: null, height: null };
  return { width: u32le(bytes, 18), height: Math.abs(signed32(bytes, 22)) };
}

function svgSize(bytes: Uint8Array) {
  const text = Buffer.from(bytes.subarray(0, 4000)).toString("utf8");
  const width = attrNumber(text, "width");
  const height = attrNumber(text, "height");
  if (width && height) return { width, height };
  const box = text.match(/viewBox\s*=\s*["']\s*[\d.]+\s+[\d.]+\s+([\d.]+)\s+([\d.]+)/i);
  if (!box) return { width: null, height: null };
  return { width: Math.round(Number(box[1])), height: Math.round(Number(box[2])) };
}

function attrNumber(text: string, name: string) {
  const match = text.match(new RegExp(`${name}\\s*=\\s*["']\\s*(\\d+(?:\\.\\d+)?)`, "i"));
  if (!match) return null;
  const value = Math.round(Number(match[1]));
  return value > 0 ? value : null;
}

function ascii(bytes: Uint8Array, start: number, length: number) {
  return Buffer.from(bytes.subarray(start, start + length)).toString("ascii");
}

function asciiIndex(bytes: Uint8Array, needle: string) {
  const text = Buffer.from(bytes).toString("latin1");
  return text.indexOf(needle);
}

function u16be(bytes: Uint8Array, offset: number) {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function u16le(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function u24le(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function u32be(bytes: Uint8Array, offset: number) {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

function u32le(bytes: Uint8Array, offset: number) {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

function signed32(bytes: Uint8Array, offset: number) {
  const value = u32le(bytes, offset);
  return value > 0x7fffffff ? value - 0x100000000 : value;
}
