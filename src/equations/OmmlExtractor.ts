import type { XmlNode } from "../types.js";
import {
  getChild,
  getChildren,
  getTextContent,
  hasChild,
  getAllChildTags,
} from "../reader/XmlParser.js";

export function extractOmmlNodes(paragraphNode: XmlNode): XmlNode[] {
  const results: XmlNode[] = [];
  collectMathNodes(paragraphNode, results);
  return results;
}

function collectMathNodes(node: XmlNode, results: XmlNode[]): void {
  const oMathParas = getChildren(node, "m:oMathPara");
  for (const para of oMathParas) {
    const oMaths = getChildren(para, "m:oMath");
    results.push(...oMaths);
  }

  const oMaths = getChildren(node, "m:oMath");
  results.push(...oMaths);

  for (const tag of getAllChildTags(node)) {
    if (tag === "m:oMath" || tag === "m:oMathPara") continue;
    const children = getChildren(node, tag);
    for (const child of children) {
      collectMathNodes(child, results);
    }
  }
}

export function isDisplayMath(paragraphNode: XmlNode): boolean {
  return hasChild(paragraphNode, "m:oMathPara");
}

export function getOmmlText(node: XmlNode): string {
  let text = "";
  const runs = getChildren(node, "m:r");
  for (const run of runs) {
    const tNodes = getChildren(run, "m:t");
    for (const t of tNodes) {
      text += getTextContent(t);
    }
  }

  for (const tag of getAllChildTags(node)) {
    if (tag === "m:r") continue;
    const children = getChildren(node, tag);
    for (const child of children) {
      text += getOmmlText(child);
    }
  }

  return text;
}

export function getOmmlChildE(node: XmlNode): XmlNode | undefined {
  return getChild(node, "m:e");
}

export function getOmmlChildSub(node: XmlNode): XmlNode | undefined {
  return getChild(node, "m:sub");
}

export function getOmmlChildSup(node: XmlNode): XmlNode | undefined {
  return getChild(node, "m:sup");
}

export function getOmmlChildNum(node: XmlNode): XmlNode | undefined {
  return getChild(node, "m:num");
}

export function getOmmlChildDen(node: XmlNode): XmlNode | undefined {
  return getChild(node, "m:den");
}

export function getOmmlChildDeg(node: XmlNode): XmlNode | undefined {
  return getChild(node, "m:deg");
}

export function getOmmlChildFName(node: XmlNode): XmlNode | undefined {
  return getChild(node, "m:fName");
}

export function getOmmlRunText(node: XmlNode): string {
  const tNodes = getChildren(node, "m:t");
  return tNodes.map((t) => getTextContent(t)).join("");
}

export function getOmmlPropVal(
  node: XmlNode,
  propTag: string,
  childTag: string,
  attrName: string,
): string | undefined {
  const props = getChild(node, propTag);
  if (!props) return undefined;
  const child = getChild(props, childTag);
  if (!child) return undefined;
  const val = child[`@_${attrName}`];
  if (typeof val === "string") return val;
  if (typeof val === "number") return String(val);
  return undefined;
}

export function isOmmlPropOn(
  node: XmlNode,
  propTag: string,
  childTag: string,
): boolean {
  const props = getChild(node, propTag);
  if (!props) return false;
  const child = getChild(props, childTag);
  if (!child) return false;
  const val = child["@_m:val"];
  if (val === undefined) return true; // presence without val means "on"
  if (val === "1" || val === "on" || val === "true") return true;
  return false;
}
