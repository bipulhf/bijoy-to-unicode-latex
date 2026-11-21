export interface RtfImage {
  mime: "image/png" | "image/jpeg";
  /** Base64-encoded image bytes. */
  base64: string;
}

interface Group {
  parent: Group | null;
  words: string[];
  hex: string[];
}

// Groups whose pictures are not the document's images: Word stores a WMF
// copy of each picture under \nonshppict and an equation fallback picture
// under \mmathPict.
const EXCLUDED_ANCESTORS = new Set(["nonshppict", "mmathPict"]);

/**
 * Pictures of an RTF document in reading order, one entry per picture.
 * Entries are null for formats a browser cannot show (EMF, WMF, DIB), so the
 * list still lines up with the pictures in the HTML flavour of the clipboard.
 */
export function extractRtfImages(rtf: string): Array<RtfImage | null> {
  const images: Array<RtfImage | null> = [];
  let group: Group = { parent: null, words: [], hex: [] };
  let i = 0;

  while (i < rtf.length) {
    const ch = rtf[i]!;
    if (ch === "{") {
      group = { parent: group, words: [], hex: [] };
      i++;
    } else if (ch === "}") {
      if (group.words.includes("pict") && !isExcluded(group)) {
        images.push(toImage(group));
      }
      group = group.parent ?? group;
      i++;
    } else if (ch === "\\") {
      i = readControl(rtf, i, group);
    } else {
      let end = i;
      while (end < rtf.length && !"{}\\".includes(rtf[end]!)) end++;
      if (group.words.includes("pict")) group.hex.push(rtf.slice(i, end));
      i = end;
    }
  }
  return images;
}

/** Reads one control word or symbol starting at `start` (a backslash). */
function readControl(rtf: string, start: number, group: Group): number {
  let i = start + 1;
  const next = rtf[i];
  if (next === undefined) return i;
  if (next === "'") return i + 3; // \'hh escaped byte
  if (!/[A-Za-z]/.test(next)) return i + 1; // control symbol such as \* or \{

  let end = i;
  while (end < rtf.length && /[A-Za-z]/.test(rtf[end]!)) end++;
  const word = rtf.slice(i, end);
  let paramEnd = end;
  if (rtf[paramEnd] === "-") paramEnd++;
  while (paramEnd < rtf.length && /[0-9]/.test(rtf[paramEnd]!)) paramEnd++;
  group.words.push(word);

  if (word === "bin") {
    // \binN is followed by N raw bytes that must be skipped verbatim.
    const length = Number(rtf.slice(end, paramEnd)) || 0;
    return paramEnd + (rtf[paramEnd] === " " ? 1 : 0) + length;
  }
  return paramEnd + (rtf[paramEnd] === " " ? 1 : 0);
}

function isExcluded(group: Group): boolean {
  for (let g: Group | null = group; g; g = g.parent) {
    if (g.words.some((w) => EXCLUDED_ANCESTORS.has(w))) return true;
  }
  return false;
}

function toImage(group: Group): RtfImage | null {
  const mime = group.words.includes("pngblip")
    ? "image/png"
    : group.words.includes("jpegblip")
      ? "image/jpeg"
      : null;
  if (!mime) return null;
  const hex = group.hex.join("").replace(/[^0-9a-fA-F]/g, "");
  if (hex.length < 2) return null;
  return { mime, base64: hexToBase64(hex) };
}

function hexToBase64(hex: string): string {
  let binary = "";
  const chunk = 0x8000;
  for (let start = 0; start < hex.length; start += chunk * 2) {
    const piece = hex.slice(start, start + chunk * 2);
    const codes: number[] = [];
    for (let j = 0; j + 1 < piece.length; j += 2) {
      codes.push(parseInt(piece.slice(j, j + 2), 16));
    }
    binary += String.fromCharCode(...codes);
  }
  return btoa(binary);
}
