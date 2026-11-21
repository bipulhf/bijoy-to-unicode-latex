import type { XmlNode } from "../types.js";
import { getAttr, getAttrVal, getChild, getChildren } from "./XmlParser.js";

/**
 * Looks up the number format (decimal, lowerLetter, bullet, ...) of a list
 * level from numbering.xml, honouring w:lvlOverride on the w:num instance.
 */
export class NumberingResolver {
  private readonly abstractLevels = new Map<string, Map<number, string>>();
  private readonly nums = new Map<
    number,
    { abstractId: string | null; overrides: Map<number, string> }
  >();

  constructor(numberingXml: XmlNode | null) {
    const root = numberingXml ? getChild(numberingXml, "w:numbering") : undefined;
    if (!root) return;

    for (const abs of getChildren(root, "w:abstractNum")) {
      const id = getAttr(abs, "w:abstractNumId");
      if (id === undefined) continue;
      this.abstractLevels.set(id, levelFormats(getChildren(abs, "w:lvl")));
    }

    for (const num of getChildren(root, "w:num")) {
      const numId = Number(getAttr(num, "w:numId"));
      if (!Number.isInteger(numId)) continue;
      const overrides = new Map<number, string>();
      for (const ov of getChildren(num, "w:lvlOverride")) {
        const ilvl = Number(getAttr(ov, "w:ilvl"));
        const fmt = getChild(ov, "w:lvl");
        const val = fmt ? getAttrVal(fmt, "w:numFmt", "w:val") : undefined;
        if (Number.isInteger(ilvl) && val) overrides.set(ilvl, val);
      }
      this.nums.set(numId, {
        abstractId: getAttrVal(num, "w:abstractNumId", "w:val") ?? null,
        overrides,
      });
    }
  }

  getNumFmt(numId: number | null, ilvl: number | null): string | null {
    if (numId === null) return null;
    const num = this.nums.get(numId);
    if (!num) return null;
    const level = ilvl ?? 0;
    const override = num.overrides.get(level);
    if (override) return override;
    if (num.abstractId === null) return null;
    return this.abstractLevels.get(num.abstractId)?.get(level) ?? null;
  }
}

function levelFormats(levels: XmlNode[]): Map<number, string> {
  const formats = new Map<number, string>();
  for (const lvl of levels) {
    const ilvl = Number(getAttr(lvl, "w:ilvl"));
    const fmt = getAttrVal(lvl, "w:numFmt", "w:val");
    if (Number.isInteger(ilvl) && fmt) formats.set(ilvl, fmt);
  }
  return formats;
}
