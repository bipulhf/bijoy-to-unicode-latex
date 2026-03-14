import type { XmlNode, ConversionWarning } from "../types.js";
import { buildXml, parseXml } from "../reader/XmlParser.js";

let xsltStylesheet: string | null = null;
let xsltAvailable = false;

export async function initXslt(xslPath?: string): Promise<boolean> {
  if (!xslPath) return false;
  try {
    const { readFile } = await import("node:fs/promises");
    xsltStylesheet = await readFile(xslPath, "utf-8");
    xsltAvailable = true;
    return true;
  } catch {
    xsltAvailable = false;
    return false;
  }
}

export function isXsltAvailable(): boolean {
  return xsltAvailable;
}

export function ommlToMathml(
  ommlNode: XmlNode,
  warnings: ConversionWarning[],
  paragraphIndex: number,
): string | null {
  if (!xsltAvailable || !xsltStylesheet) return null;

  try {
    const ommlXml = buildXml(wrapInMathNode(ommlNode));
    const result = applyXslt(ommlXml, xsltStylesheet);

    if (!result || result.trim().length === 0) {
      warnings.push({
        type: "xslt_fallback",
        message: "XSLT produced empty output, falling back to direct walker",
        paragraphIndex,
      });
      return null;
    }

    return result;
  } catch {
    warnings.push({
      type: "xslt_fallback",
      message: "XSLT transform failed, falling back to direct walker",
      paragraphIndex,
    });
    return null;
  }
}

function wrapInMathNode(node: XmlNode): XmlNode {
  return {
    "m:oMath": node,
    "@_xmlns:m": "http://schemas.openxmlformats.org/officeDocument/2006/math",
  };
}

function applyXslt(xmlStr: string, xslStr: string): string | null {
  try {
    // Dynamic import to avoid failure when xslt-processor is not installed
    // The actual XSLT processing would use the xslt-processor package
    // For now, return null to fall back to Path B
    void xmlStr;
    void xslStr;
    return null;
  } catch {
    return null;
  }
}

export function parseMathmlString(mathmlStr: string): XmlNode | null {
  try {
    return parseXml(mathmlStr);
  } catch {
    return null;
  }
}
