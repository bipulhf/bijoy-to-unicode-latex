import type { XmlNode } from "../types.js";
import {
  getChildren,
  oFindChild,
  oGetChildByRef,
  parseXml,
  parseXmlOrdered,
  type OrderedEntry,
} from "../reader/XmlParser.js";
import { joinLatex, ommlToLatex } from "./OmmlDirectWalker.js";

/**
 * Converts an equation from Word's clipboard HTML to LaTeX. Word writes the
 * OMML there with HTML formatting tags mixed in (<i>, <span style=...>),
 * run text directly inside <m:r> without <m:t>, and possibly unquoted
 * attributes; this normalises it to the OMML the walker expects.
 * Returns null when the markup cannot be read.
 */
export function wordHtmlOmmlToLatex(fragment: string): string | null {
  const xml = normaliseOmml(fragment);
  try {
    const root = parseXml(`<root>${xml}</root>`)["root"];
    const orderedRoot = oFindChild(parseXmlOrdered(`<root>${xml}</root>`), "root");
    if (!root || typeof root !== "object" || Array.isArray(root)) return null;

    const parts: string[] = [];
    collect(root as XmlNode, orderedRoot, parts);
    const latex = joinLatex(parts.filter((p) => p.trim().length > 0)).trim();
    return latex || null;
  } catch {
    return null;
  }
}

function collect(node: XmlNode, ordered: OrderedEntry[] | undefined, parts: string[]): void {
  for (const tag of ["m:oMathPara", "m:oMath"] as const) {
    getChildren(node, tag).forEach((child, i) => {
      const childOrdered = ordered ? oGetChildByRef(ordered, tag, i) : undefined;
      if (tag === "m:oMathPara") {
        collect(child, childOrdered, parts);
      } else {
        parts.push(ommlToLatex(child, { warnings: [], paragraphIndex: 0 }, 0, childOrdered));
      }
    });
  }
}

function normaliseOmml(fragment: string): string {
  return (
    fragment
      // Drop every non-OMML tag (HTML formatting, w:rPr) but keep its text.
      .replace(/<\/?(?!m:)[A-Za-z][\w:-]*(?:\s[^>]*)?\/?>/g, "")
      .replace(/&nbsp;/g, " ")
      // Quote bare attribute values: m:val=lin → m:val="lin".
      .replace(/(<m:[^>]*?\s[\w:]+=)([^\s"'>/]+)/g, '$1"$2"')
      // Word puts run text straight into <m:r>; the walker reads <m:t>.
      .replace(
        /<m:r>((?:<m:rPr>[\s\S]*?<\/m:rPr>)?)([^<]+)<\/m:r>/g,
        "<m:r>$1<m:t>$2</m:t></m:r>",
      )
  );
}
