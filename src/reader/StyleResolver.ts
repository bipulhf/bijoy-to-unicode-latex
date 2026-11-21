import type { XmlNode } from "../types.js";
import { getAttr, getAttrVal, getChild, getChildren } from "./XmlParser.js";

interface StyleInfo {
  type: string | null;
  basedOn: string | null;
  font: FontLookup;
}

// undefined: this level does not set a font, keep looking further up.
// null: this level sets a font we cannot name (theme font), stop here.
type FontLookup = string | null | undefined;

const MAX_BASED_ON_DEPTH = 20;

/**
 * Resolves the effective font of a run from styles.xml: the run's own
 * w:rFonts, then its character style, then the paragraph style chain
 * (or the default paragraph style), then w:docDefaults.
 */
export class StyleResolver {
  private readonly styles = new Map<string, StyleInfo>();
  private readonly defaultParagraphStyle: string | null = null;
  private readonly docDefaultFont: FontLookup;

  constructor(stylesXml: XmlNode | null) {
    const root = stylesXml ? getChild(stylesXml, "w:styles") : undefined;
    if (!root) {
      this.docDefaultFont = undefined;
      return;
    }

    for (const style of getChildren(root, "w:style")) {
      const id = getAttr(style, "w:styleId");
      if (!id) continue;
      const type = getAttr(style, "w:type") ?? null;
      this.styles.set(id, {
        type,
        basedOn: getAttrVal(style, "w:basedOn", "w:val") ?? null,
        font: fontFromRPr(getChild(style, "w:rPr")),
      });
      const isDefault = getAttr(style, "w:default");
      if (type === "paragraph" && (isDefault === "1" || isDefault === "true")) {
        this.defaultParagraphStyle = id;
      }
    }

    const rPrDefault = getChild(
      getChild(root, "w:docDefaults") ?? {},
      "w:rPrDefault",
    );
    this.docDefaultFont = rPrDefault
      ? fontFromRPr(getChild(rPrDefault, "w:rPr"))
      : undefined;
  }

  resolveRunFont(
    rPr: XmlNode | undefined,
    paragraphStyleId: string | null,
  ): string | null {
    const own = fontFromRPr(rPr);
    if (own !== undefined) return own;

    const charStyle = rPr ? getAttrVal(rPr, "w:rStyle", "w:val") : undefined;
    if (charStyle) {
      const fromChar = this.fontFromStyleChain(charStyle);
      if (fromChar !== undefined) return fromChar;
    }

    const pStyle = paragraphStyleId ?? this.defaultParagraphStyle;
    if (pStyle) {
      const fromPara = this.fontFromStyleChain(pStyle);
      if (fromPara !== undefined) return fromPara;
    }

    return this.docDefaultFont ?? null;
  }

  private fontFromStyleChain(styleId: string): FontLookup {
    let id: string | null = styleId;
    for (let depth = 0; id && depth < MAX_BASED_ON_DEPTH; depth++) {
      const style = this.styles.get(id);
      if (!style) return undefined;
      if (style.font !== undefined) return style.font;
      id = style.basedOn;
    }
    return undefined;
  }
}

export function fontFromRPr(rPr: XmlNode | undefined): FontLookup {
  if (!rPr) return undefined;
  const rFonts = getChild(rPr, "w:rFonts");
  if (!rFonts) return undefined;
  // Bijoy text is ASCII, drawn with the ascii/hAnsi font; w:cs only affects
  // complex-script characters, so it neither sets nor blocks the font here.
  const named = getAttr(rFonts, "w:ascii") ?? getAttr(rFonts, "w:hAnsi");
  if (named) return named;
  if (getAttr(rFonts, "w:asciiTheme") || getAttr(rFonts, "w:hAnsiTheme")) {
    return null;
  }
  return undefined;
}
