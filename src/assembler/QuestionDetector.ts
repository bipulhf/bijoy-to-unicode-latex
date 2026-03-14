import type { ParsedParagraph } from "../types.js";

const QUESTION_START = /^[০-৯0-9]+[.)।\s]/u;
const SUBPART_START = /^[\s]*[\(\[]?(?:[a-z]|i{1,3}v?|vi{0,3})[\)\].]\s/u;

export function isQuestionParagraph(p: ParsedParagraph): boolean {
  if (p.numId !== null) return true;
  const text = getFirstTextContent(p);
  return QUESTION_START.test(text.trim());
}

export function isSubPartParagraph(p: ParsedParagraph): boolean {
  const text = getFirstTextContent(p);
  return SUBPART_START.test(text.trim());
}

export function isBlankParagraph(p: ParsedParagraph): boolean {
  if (p.nodes.length === 0) return true;
  const text = getFullTextContent(p);
  return text.trim().length === 0;
}

export function isEquationOnlyParagraph(p: ParsedParagraph): boolean {
  const nonEmpty = p.nodes.filter((n) => {
    if (n.type === "text") return n.text.trim().length > 0;
    return true;
  });
  return nonEmpty.length > 0 && nonEmpty.every((n) => n.type === "equation");
}

export function getFirstTextContent(p: ParsedParagraph): string {
  for (const node of p.nodes) {
    if (node.type === "text" && node.text.trim().length > 0) {
      return node.text;
    }
  }
  return "";
}

export function getFullTextContent(p: ParsedParagraph): string {
  let text = "";
  for (const node of p.nodes) {
    if (node.type === "text") {
      text += node.text;
    } else if (node.type === "equation") {
      text += node.ommlXml;
    }
  }
  return text;
}

export function getParagraphText(p: ParsedParagraph, imageToken: string): string {
  let text = "";
  for (const node of p.nodes) {
    if (node.type === "text") {
      text += node.text;
    } else if (node.type === "equation") {
      text += node.ommlXml;
    } else if (node.type === "image") {
      text += imageToken;
    }
  }
  return text;
}

export function stripQuestionNumber(text: string): string {
  return text.replace(/^[০-৯0-9]+[.)।\s]+/u, "").trim();
}
