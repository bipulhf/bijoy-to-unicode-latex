import type { DocNode } from "../types.js";

/**
 * Paragraph text paired with a masked copy of the same length in which
 * equation LaTeX and image tokens are blanked out. Marker searches (question
 * numbers, option letters) run on `masked` so that `f(A)` inside an equation
 * is never read as option "A)"; slices are then taken from `text`.
 */
export interface MarkedText {
  text: string;
  masked: string;
}

const MASK_CHAR = "⁣"; // invisible separator: not whitespace, not a marker

export function toMarkedText(nodes: DocNode[], imageToken: string): MarkedText {
  let text = "";
  let masked = "";
  for (const node of nodes) {
    let piece: string;
    if (node.type === "text") {
      text += node.text;
      masked += node.text;
      continue;
    }
    piece = node.type === "equation" ? node.ommlXml : imageToken;
    text += piece;
    masked += MASK_CHAR.repeat(piece.length);
  }
  return { text, masked };
}

export function sliceMarked(m: MarkedText, start: number, end?: number): MarkedText {
  return { text: m.text.slice(start, end), masked: m.masked.slice(start, end) };
}

export function trimMarked(m: MarkedText): MarkedText {
  const start = m.masked.length - m.masked.trimStart().length;
  const end = m.masked.trimEnd().length;
  return end <= start ? { text: "", masked: "" } : sliceMarked(m, start, end);
}
