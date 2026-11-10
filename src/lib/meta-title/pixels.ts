import widths from "./arial-20.json";

/** Google desktop title cut-off. Arial at 20px. Over this is an error. */
export const DESKTOP_LIMIT = 600;
/** Google mobile title cut-off. Same Arial 20px rendering. Over this is a warning. */
export const MOBILE_LIMIT = 620;
/** Width of the ellipsis Google adds once a title overflows, Arial 20px. */
const ELLIPSIS_PX = 20;

const TABLE = widths as Record<string, number>;

const EXTRA: Record<number, number> = {
  0x00a0: 5.56,
  0x00b7: 6.66,
  0x00bb: 11.12,
  0x2013: 11.12,
  0x2014: 20,
  0x2018: 4.44,
  0x2019: 4.44,
  0x201c: 6.66,
  0x201d: 6.66,
  0x2022: 7,
  0x2026: 20,
  0x203a: 6.66,
  0x2122: 20,
  0x2011: 6.66,
};

export type PixelMeasure = {
  /** Nearest whole pixel. Pass/fail uses this so the number on screen matches the verdict. */
  width: number;
  desktopCut: number;
  mobileCut: number;
};

function isCombining(code: number) {
  return (
    (code >= 0x0300 && code <= 0x036f) ||
    (code >= 0x1ab0 && code <= 0x1aff) ||
    (code >= 0x1dc0 && code <= 0x1dff) ||
    (code >= 0x20d0 && code <= 0x20ff) ||
    (code >= 0xfe20 && code <= 0xfe2f)
  );
}

function isWide(code: number) {
  return (
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2e80 && code <= 0x9fff) ||
    (code >= 0xac00 && code <= 0xd7af) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe10 && code <= 0xfe6f) ||
    (code >= 0xff01 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6)
  );
}

function isEmoji(char: string) {
  return /\p{Extended_Pictographic}/u.test(char);
}

export function charWidth(char: string): number {
  const code = char.codePointAt(0) ?? 0;
  if (EXTRA[code] !== undefined) return EXTRA[code];
  if (code < 32 || (code >= 127 && code <= 159) || isCombining(code)) return 0;
  if (code >= 32 && code <= 126) return TABLE[String(code)] ?? 11.12;
  if (code >= 160 && code <= 255) return TABLE[String(code)] ?? 11.12;
  if (isEmoji(char)) return 22;
  if (isWide(code)) return 20;
  return 11.12;
}

/**
 * Pixel width of a title in Arial at 20px.
 * Desktop and mobile use the same rendering and two cut-offs: 600 and 620.
 * When the title overflows, the cut reserves room for Google's ellipsis.
 */
export function measurePixels(text: string): PixelMeasure {
  let raw = 0;
  for (const char of text) raw += charWidth(char);

  const desktopBudget = raw > DESKTOP_LIMIT ? DESKTOP_LIMIT - ELLIPSIS_PX : Infinity;
  const mobileBudget = raw > MOBILE_LIMIT ? MOBILE_LIMIT - ELLIPSIS_PX : Infinity;

  let acc = 0;
  let desktopCut = text.length;
  let mobileCut = text.length;
  let desktopSet = desktopBudget === Infinity;
  let mobileSet = mobileBudget === Infinity;

  for (let i = 0; i < text.length; ) {
    const code = text.codePointAt(i) ?? 0;
    const char = String.fromCodePoint(code);
    const w = charWidth(char);
    if (!desktopSet && acc + w > desktopBudget) {
      desktopCut = i;
      desktopSet = true;
    }
    if (!mobileSet && acc + w > mobileBudget) {
      mobileCut = i;
      mobileSet = true;
    }
    acc += w;
    i += code > 0xffff ? 2 : 1;
  }

  return {
    width: Math.round(raw),
    desktopCut,
    mobileCut,
  };
}
