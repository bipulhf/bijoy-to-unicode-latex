import type { ParsedParagraph, DocNode } from "../types.js";
import {
  toMarkedText,
  sliceMarked,
  trimMarked,
  type MarkedText,
} from "./MarkedText.js";

const MARKER_FAMILIES = ["ABCD", "abcd", "কখগঘ"];

// A marker needs closing punctuation: "(A)", "[A]", "A)", "A.", "A।".
// "A " alone is ordinary text ("A ball is thrown").
const OPTION_MARKER = /^\s*[\(\[]?[ABCDabcdকখগঘ][\)\].।]\s*/u;

// Same marker anywhere in a line, but only at the start of a word (or right
// after an equation), so the "গ।" ending "লাগ।", the "A." in "U.S.A." and the
// "c." in "c.m." are not markers.
const EMBEDDED_MARKER =
  /(?<![^\s\u2063])[\(\[]?([ABCDabcdকখগঘ])[\)\].।](?![A-Za-z.])\s*/gu;

const SINGLE_MARKER = /^\s*[\(\[]?[ABCDabcdকখগঘ][\)\].।]\s*$/u;

const LETTER_NUM_FORMATS = new Set(["lowerLetter", "upperLetter"]);

export function isOptionParagraph(p: ParsedParagraph): boolean {
  if (p.numFmt && LETTER_NUM_FORMATS.has(p.numFmt)) return true;
  const { masked } = toMarkedText(p.nodes, "");
  return OPTION_MARKER.test(masked);
}

export function hasMultipleOptionMarkers(p: ParsedParagraph): boolean {
  let count = 0;
  for (const node of p.nodes) {
    if (node.type === "text" && SINGLE_MARKER.test(node.text)) {
      count++;
    }
  }
  if (count >= 2) return true;

  return findMarkerChain(toMarkedText(p.nodes, "").masked).length >= 2;
}

export function stripOptionMarker(text: string): string {
  return text.replace(OPTION_MARKER, "").trim();
}

export function getOptionText(p: ParsedParagraph, imageToken: string): string {
  const marked = toMarkedText(p.nodes, imageToken);
  const match = OPTION_MARKER.exec(marked.masked);
  const rest = match ? sliceMarked(marked, match[0].length) : marked;
  return rest.text.trim();
}

export function parseMultiOptionNodes(
  nodes: DocNode[],
  imageToken: string,
): string[] {
  const markerIndices: number[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;
    if (node.type === "text" && SINGLE_MARKER.test(node.text)) {
      markerIndices.push(i);
    }
  }

  const marked = toMarkedText(nodes, imageToken);
  if (markerIndices.length < 2) {
    return splitEmbeddedText(marked);
  }

  // Markers sit in their own runs, but one may also be typed inside a value
  // ("14, 12, 4  গ) 0, 4, -4"); reading the whole line catches both.
  const chain = findMarkerChain(marked.masked);
  if (chain.length >= markerIndices.length) {
    return splitByChain(marked, chain);
  }

  // Strategy 1: content immediately after each marker until next marker
  const afterMarker: string[] = [];
  for (let m = 0; m < markerIndices.length; m++) {
    const start = markerIndices[m]! + 1;
    const end =
      m + 1 < markerIndices.length ? markerIndices[m + 1]! : nodes.length;
    afterMarker.push(nodeToString(nodes.slice(start, end), imageToken).trim());
  }

  const filledCount = afterMarker.filter((v) => v.length > 0).length;
  if (filledCount === markerIndices.length) {
    return afterMarker;
  }

  // Strategy 2: collect all non-marker content and pair by position
  const allValues: string[] = [];
  for (let i = 0; i < nodes.length; i++) {
    if (markerIndices.includes(i)) continue;
    const s = singleNodeToString(nodes[i]!, imageToken).trim();
    if (s) allValues.push(s);
  }

  if (allValues.length === markerIndices.length) {
    return allValues;
  }

  // Strategy 3: if more values than markers, group adjacent values
  if (allValues.length > markerIndices.length) {
    const perMarker = Math.ceil(allValues.length / markerIndices.length);
    const grouped: string[] = [];
    for (let m = 0; m < markerIndices.length; m++) {
      const start = m * perMarker;
      const end = Math.min(start + perMarker, allValues.length);
      grouped.push(allValues.slice(start, end).join(""));
    }
    return grouped;
  }

  // Fewer values than markers — pad with empty
  const result: string[] = [];
  const offset = markerIndices.length - allValues.length;
  for (let m = 0; m < markerIndices.length; m++) {
    const valIdx = m - offset;
    result.push(
      valIdx >= 0 && valIdx < allValues.length ? allValues[valIdx]! : "",
    );
  }
  return result;
}

/**
 * Longest run of markers whose letters follow each other (A, B, C... or
 * ক, খ, গ...). Candidates that break the sequence are treated as text.
 */
function findMarkerChain(masked: string): RegExpMatchArray[] {
  const candidates = [...masked.matchAll(EMBEDDED_MARKER)];
  let best: RegExpMatchArray[] = [];
  for (let s = 0; s < candidates.length; s++) {
    const first = candidates[s]!;
    const family = MARKER_FAMILIES.find((f) => f.includes(first[1]!));
    if (!family) continue;
    let pos = family.indexOf(first[1]!);
    const chain = [first];
    for (let k = s + 1; k < candidates.length; k++) {
      const cand = candidates[k]!;
      if (family[pos + 1] === cand[1]) {
        chain.push(cand);
        pos++;
      }
    }
    // On a tie keep the later chain: "Is (A) or (B) true? (A) x (B) y ..."
    if (chain.length >= best.length) best = chain;
  }
  return best;
}

function splitByChain(
  marked: MarkedText,
  chain: RegExpMatchArray[],
): string[] {
  const options: string[] = [];
  for (let i = 0; i < chain.length; i++) {
    const match = chain[i]!;
    const start = match.index! + match[0].length;
    const end = i + 1 < chain.length ? chain[i + 1]!.index! : marked.text.length;
    options.push(trimMarked(sliceMarked(marked, start, end)).text);
  }
  return options;
}

function splitEmbeddedText(marked: MarkedText): string[] {
  const chain = findMarkerChain(marked.masked);
  if (chain.length < 2) {
    const match = OPTION_MARKER.exec(marked.masked);
    const rest = match ? sliceMarked(marked, match[0].length) : marked;
    return [rest.text.trim()];
  }
  return splitByChain(marked, chain);
}

function nodeToString(nodes: DocNode[], imageToken: string): string {
  return nodes.map((n) => singleNodeToString(n, imageToken)).join("");
}

function singleNodeToString(n: DocNode, imageToken: string): string {
  if (n.type === "text") return n.text;
  if (n.type === "equation") return n.ommlXml;
  return imageToken;
}

/** Options embedded in a question line: needs at least A, B, C in order. */
function embeddedChain(marked: MarkedText): RegExpMatchArray[] | null {
  const chain = findMarkerChain(marked.masked);
  if (chain.length < 3) return null;
  const firstLetter = chain[0]![1]!;
  const startsAtFirst = MARKER_FAMILIES.some((f) => f[0] === firstLetter);
  return startsAtFirst ? chain : null;
}

export function tryExtractEmbeddedOptions(
  text: string | MarkedText,
): string[] | null {
  const marked = typeof text === "string" ? { text, masked: text } : text;
  const chain = embeddedChain(marked);
  if (!chain) return null;
  const nonEmpty = splitByChain(marked, chain).filter((o) => o.length > 0);
  return nonEmpty.length >= 3 ? nonEmpty : null;
}

export function getTextBeforeEmbeddedOptions(
  text: string | MarkedText,
): string | null {
  const marked = typeof text === "string" ? { text, masked: text } : text;
  const chain = embeddedChain(marked);
  if (!chain) return null;
  return marked.text.slice(0, chain[0]!.index!).trim();
}
