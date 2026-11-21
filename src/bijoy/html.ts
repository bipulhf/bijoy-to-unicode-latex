/// <reference lib="dom" />
import { convertBijoyToUnicode } from "./BijoyConverter.js";
import {
  hasBijoyMarkers,
  hasUnicodeBangla,
  isBijoyFont,
} from "./BijoyDetector.js";
import { fixBijoyRunBoundaries, type BijoyRun } from "./runs.js";
import { extractRtfImages } from "./rtfImages.js";
import { cleanBody, firstFontFamily, parseDeclarations } from "./htmlClean.js";

export interface ConvertBijoyHtmlOptions {
  /** RTF flavour of the same clipboard content, used to recover images. */
  rtf?: string;
  /** CSS font-family for converted Bangla text; omit to leave it unset. */
  banglaFont?: string;
  /**
   * Text to insert for a Word equation, given its OMML markup, or null to
   * drop it. Without this option equations are dropped.
   */
  equation?: (omml: string) => string | null;
  /**
   * HTML parser to use; defaults to the global DOMParser (browsers). In Node
   * pass a DOMParser from happy-dom, linkedom or jsdom. Its document is typed
   * loosely because those libraries declare their own Document types.
   */
  parser?: { parseFromString(html: string, type: "text/html"): unknown };
}

export interface ConvertBijoyHtmlResult {
  /** Clean HTML fragment, safe to insert into a page or a rich text editor. */
  html: string;
  /** Plain-text version of the same content. */
  text: string;
  warnings: string[];
  stats: {
    bijoyRuns: number;
    equations: number;
    images: number;
    imagesDropped: number;
  };
}

const BLOCK_TAGS = new Set([
  "p", "div", "li", "td", "th", "tr", "table", "h1", "h2", "h3", "h4", "h5",
  "h6", "blockquote", "pre", "ul", "ol", "body",
]);

const EQUATION_ATTR = "data-bijoy-omml";

/**
 * Converts HTML copied from Word (the clipboard's text/html flavour) from
 * Bijoy to Unicode while keeping its formatting: bold, italic, underline,
 * colours, sizes, alignment, tables and lists. Bijoy text is found by its
 * font, words split across spans are repaired, Word-only markup is removed,
 * and the result is rebuilt from an allow-list so it is safe to insert.
 */
export function convertBijoyHtml(
  html: string,
  options: ConvertBijoyHtmlOptions = {},
): ConvertBijoyHtmlResult {
  const warnings: string[] = [];
  const stats = { bijoyRuns: 0, equations: 0, images: 0, imagesDropped: 0 };

  const equations: string[] = [];
  const prepared = prepareWordHtml(html, equations);

  const parser = options.parser ?? new DOMParser();
  const doc = parser.parseFromString(prepared, "text/html") as Document;
  const fontOf = createFontResolver(doc);

  const converted = convertTextNodes(doc, fontOf, stats);
  const imageSrc = createImageResolver(doc, options.rtf, warnings, stats);

  const fragment = cleanBody(doc.body, doc, {
    fontFor: (node) => (converted.has(node) ? (options.banglaFont ?? null) : null),
    replace: (el, d) => {
      const index = el.getAttribute(EQUATION_ATTR);
      if (index === null) return undefined;
      stats.equations++;
      const omml = equations[Number(index)] ?? "";
      const text = options.equation?.(omml) ?? null;
      return text ? d.createTextNode(text) : null;
    },
    imageSrc,
  });

  if (equations.length > 0 && !options.equation) {
    warnings.push(`${equations.length} equation(s) removed`);
  }

  const container = doc.createElement("div");
  container.appendChild(fragment);
  return {
    html: container.innerHTML,
    text: toPlainText(container),
    warnings,
    stats,
  };
}

/**
 * Pulls Word equations (OMML inside conditional comments) out before
 * parsing, and removes the equation and VML fallback markup around them.
 */
function prepareWordHtml(html: string, equations: string[]): string {
  return (
    html
      .replace(
        /<!--\[if gte msEquation 12\]>([\s\S]*?)<!\[endif\]-->/gi,
        (_m, omml: string) => {
          equations.push(omml);
          return `<span ${EQUATION_ATTR}="${equations.length - 1}"></span>`;
        },
      )
      .replace(/<!\[if !msEquation\]>[\s\S]*?<!\[endif\]>/gi, "")
      // Remaining downlevel-hidden blocks (VML shapes) are dropped whole.
      .replace(/<!--\[if [^\]]*\]>[\s\S]*?<!\[endif\]-->/gi, "")
      // Downlevel-revealed markers (<![if !vml]>) wrap content worth keeping.
      .replace(/<!\[(?:if [^\]]*|endif)\]>/gi, "")
  );
}

type FontLookup = (el: Element) => string | null;

/** Effective font of an element: inline style, <font face>, class rules, parents. */
function createFontResolver(doc: Document): FontLookup {
  const classFonts = readClassFonts(doc);
  const cache = new Map<Element, string | null>();

  const own = (el: Element): string | undefined => {
    const decls = new Map(parseDeclarations(el.getAttribute("style") ?? ""));
    const inline = decls.get("mso-ascii-font-family") ?? decls.get("font-family");
    if (inline) return firstFontFamily(inline);
    const face = el.getAttribute("face");
    if (face) return firstFontFamily(face);
    const tag = el.tagName.toLowerCase();
    for (const cls of Array.from(el.classList)) {
      const font = classFonts.get(`${tag}.${cls}`) ?? classFonts.get(`.${cls}`);
      if (font) return font;
    }
    return undefined;
  };

  const resolve = (el: Element | null): string | null => {
    if (!el) return null;
    const cached = cache.get(el);
    if (cached !== undefined) return cached;
    const font = own(el) ?? resolve(el.parentElement);
    cache.set(el, font);
    return font;
  };
  return resolve;
}

/** Maps "p.MsoNormal" / ".Class" selectors in Word's <style> blocks to fonts. */
function readClassFonts(doc: Document): Map<string, string> {
  const fonts = new Map<string, string>();
  for (const style of Array.from(doc.querySelectorAll("style"))) {
    const css = (style.textContent ?? "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/<!--|-->/g, "");
    for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selectors = match[1]!.trim();
      if (selectors.startsWith("@")) continue;
      const decls = new Map(parseDeclarations(match[2]!));
      const family = decls.get("mso-ascii-font-family") ?? decls.get("font-family");
      if (!family) continue;
      for (const selector of selectors.split(",")) {
        const m = /^([a-z0-9]*)\.([\w-]+)$/i.exec(selector.trim());
        if (m) fonts.set(`${m[1]!.toLowerCase()}.${m[2]}`, firstFontFamily(family));
      }
    }
  }
  return fonts;
}

/**
 * Converts Bijoy text nodes in place and returns them. Text nodes of one
 * block are treated as continuous text so split words can be repaired;
 * line breaks, images, equations and whitespace-only nodes separate them.
 */
function convertTextNodes(
  doc: Document,
  fontOf: FontLookup,
  stats: { bijoyRuns: number },
): Set<Text> {
  const converted = new Set<Text>();
  let segment: Array<BijoyRun | null> = [];
  const pending: Array<[Text, BijoyRun]> = [];

  const flush = (): void => {
    fixBijoyRunBoundaries(segment);
    segment = [];
  };

  const walker = doc.createTreeWalker(doc.body, 0x1 | 0x4); // elements + text
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === 1) {
      const el = node as Element;
      const tag = el.tagName.toLowerCase();
      if (BLOCK_TAGS.has(tag)) flush();
      else if (tag === "br" || tag === "img" || el.hasAttribute(EQUATION_ATTR)) {
        segment.push(null);
      }
      continue;
    }

    const text = node as Text;
    const raw = text.data;
    if (raw.trim().length === 0 || isInsideDropped(text)) {
      segment.push(null);
      continue;
    }
    const font = fontOf(text.parentElement!);
    const isBijoy =
      !hasUnicodeBangla(raw) &&
      (isBijoyFont(font) || (!font && hasBijoyMarkers(raw)));
    if (!isBijoy) {
      segment.push(null);
      continue;
    }
    const run: BijoyRun = { text: convertBijoyToUnicode(raw), isBijoy: true, rawText: raw };
    segment.push(run);
    pending.push([text, run]);
    stats.bijoyRuns++;
  }
  flush();

  for (const [text, run] of pending) {
    text.data = run.text;
    converted.add(text);
  }
  return converted;
}

function isInsideDropped(node: Node): boolean {
  for (let el = node.parentElement; el; el = el.parentElement) {
    const tag = el.tagName.toLowerCase();
    if (tag === "style" || tag === "script" || tag === "title") return true;
  }
  return false;
}

/**
 * Word's clipboard HTML points images at temporary local files the page
 * cannot read; the same pictures, in the same order, are embedded in the
 * RTF flavour. Images are matched by position only when the counts agree.
 */
function createImageResolver(
  doc: Document,
  rtf: string | undefined,
  warnings: string[],
  stats: { images: number; imagesDropped: number },
): (img: Element) => string | null {
  const localImages: Element[] = Array.from(doc.querySelectorAll("img")).filter((img) =>
    /^file:/i.test(img.getAttribute("src") ?? ""),
  );
  const rtfImages = rtf ? extractRtfImages(rtf) : [];
  const usable = localImages.length > 0 && rtfImages.length === localImages.length;

  if (localImages.length > 0 && !usable) {
    warnings.push(
      rtf
        ? `Could not match ${localImages.length} image(s) with the RTF data; images removed`
        : `${localImages.length} image(s) removed: no RTF data on the clipboard`,
    );
  }

  return (img) => {
    const src = img.getAttribute("src") ?? "";
    if (!/^file:/i.test(src)) {
      stats.images++;
      return src;
    }
    const picture = usable ? rtfImages[localImages.indexOf(img)] : null;
    if (!picture) {
      stats.imagesDropped++;
      return null;
    }
    stats.images++;
    return `data:${picture.mime};base64,${picture.base64}`;
  };
}

function toPlainText(root: Element): string {
  let out = "";
  const walk = (node: Node): void => {
    if (node.nodeType === 3) {
      out += (node as Text).data.replace(/\s+/g, " ");
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = (node as Element).tagName.toLowerCase();
    if (tag === "br") {
      out += "\n";
      return;
    }
    if (tag === "td" || tag === "th") out += "\t";
    for (const child of Array.from(node.childNodes)) walk(child);
    if (BLOCK_TAGS.has(tag) && tag !== "td" && tag !== "th") out += "\n";
  };
  walk(root);
  return out
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
