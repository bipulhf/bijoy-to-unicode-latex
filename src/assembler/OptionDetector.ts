import type { ParsedParagraph } from "../types.js";
import { getFirstTextContent } from "./QuestionDetector.js";

const OPTION_MARKER =
  /^[\s]*[\(\[]?(?:[ABCDabcdকখগঘ]|i{1,3}v?|vi{0,3})[\)\].)।\s]+/u;

const STRIP_PATTERN =
  /^[\s]*[\(\[]?(?:[ABCDabcdকখগঘ]|i{1,3}v?|vi{0,3})[\)\].)।\s]+/u;

const EMBEDDED_OPTIONS =
  /[\(\[]?(?:[ABCDকখগঘ])[\)\].)।]\s+/gu;

export function isOptionParagraph(p: ParsedParagraph): boolean {
  const text = getFirstTextContent(p).trim();
  return OPTION_MARKER.test(text);
}

export function stripOptionMarker(text: string): string {
  return text.replace(STRIP_PATTERN, "").trim();
}

export function getOptionText(
  p: ParsedParagraph,
  imageToken: string,
): string {
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
  return stripOptionMarker(text);
}

export function tryExtractEmbeddedOptions(text: string): string[] | null {
  const markers = [...text.matchAll(EMBEDDED_OPTIONS)];
  if (markers.length < 3) return null;

  const options: string[] = [];
  for (let i = 0; i < markers.length; i++) {
    const match = markers[i]!;
    const start = match.index! + match[0].length;
    const end =
      i + 1 < markers.length ? markers[i + 1]!.index! : text.length;
    const optionText = text.slice(start, end).trim();
    if (optionText) {
      options.push(optionText);
    }
  }

  return options.length >= 3 ? options : null;
}

export function getTextBeforeEmbeddedOptions(text: string): string | null {
  const markers = [...text.matchAll(EMBEDDED_OPTIONS)];
  if (markers.length < 3) return null;
  const firstIdx = markers[0]!.index!;
  return text.slice(0, firstIdx).trim();
}
