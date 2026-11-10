import { charWidth } from "@/lib/meta-title/pixels";

/** Google desktop snippet cut-off for descriptions. */
export const DESKTOP_LIMIT = 920;
/** Google mobile snippet cut-off for descriptions. */
export const MOBILE_LIMIT = 680;
/** Snippet text is smaller than the title; scale Arial 20 widths to ~13px. */
const FONT_SCALE = 13 / 20;
const ELLIPSIS_PX = 13;

export type DescriptionPixelMeasure = {
  width: number;
  desktopCut: number;
  mobileCut: number;
};

function widthOf(char: string) {
  return charWidth(char) * FONT_SCALE;
}

export function measureDescriptionPixels(text: string): DescriptionPixelMeasure {
  let raw = 0;
  for (const char of text) raw += widthOf(char);

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
    const w = widthOf(char);
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
