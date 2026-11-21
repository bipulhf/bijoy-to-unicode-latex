import type { ParsedParagraph } from "../types.js";
import { toMarkedText } from "./MarkedText.js";

const QUESTION_START = /^[০-৯0-9]+[.)।\s]/u;
const SUBPART_START = /^[\s]*[\(\[]?(?:[a-z]|i{1,3}v?|vi{0,3})[\)\].]\s/u;

// List formats that number options, sub-parts or bullets rather than questions.
const NON_QUESTION_NUM_FORMATS = new Set([
  "lowerLetter",
  "upperLetter",
  "lowerRoman",
  "upperRoman",
  "bullet",
  "none",
]);
const ROMAN_NUM_FORMATS = new Set(["lowerRoman", "upperRoman"]);

/** Paragraph text with equations and images blanked out, for marker tests. */
function leadingMarkerText(p: ParsedParagraph): string {
  return toMarkedText(p.nodes, "").masked.trim();
}

export function isQuestionParagraph(p: ParsedParagraph): boolean {
  if (p.numId !== null) {
    return !(p.numFmt && NON_QUESTION_NUM_FORMATS.has(p.numFmt));
  }
  return QUESTION_START.test(leadingMarkerText(p));
}

export function isNumberedQuestion(p: ParsedParagraph): boolean {
  return isQuestionParagraph(p);
}

export function isContentParagraph(p: ParsedParagraph): boolean {
  if (isBlankParagraph(p)) return false;
  const text = getFullTextContent(p);
  return text.trim().length > 0;
}

export function isSubPartParagraph(p: ParsedParagraph): boolean {
  if (p.numId !== null && p.numFmt && ROMAN_NUM_FORMATS.has(p.numFmt)) {
    return true;
  }
  return SUBPART_START.test(leadingMarkerText(p));
}

export function isBlankParagraph(p: ParsedParagraph): boolean {
  if (p.nodes.length === 0) return true;
  if (p.nodes.some((n) => n.type === "image")) return false;
  const text = getFullTextContent(p);
  return text.trim().length === 0;
}

export function isImageOnlyParagraph(p: ParsedParagraph): boolean {
  const nonEmpty = p.nodes.filter(
    (n) => n.type !== "text" || n.text.trim().length > 0,
  );
  return nonEmpty.length > 0 && nonEmpty.every((n) => n.type === "image");
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

export const QUESTION_NUMBER = /^\s*[০-৯0-9]+[.)।\s]+/u;

export function stripQuestionNumber(text: string): string {
  return text.replace(QUESTION_NUMBER, "").trim();
}
