/// <reference lib="dom" />
import { isBijoyFont } from "./BijoyDetector.js";

/**
 * Rebuilds pasted HTML from an allow-list of tags, attributes and CSS
 * properties. Everything else is unwrapped (its children kept) or dropped,
 * so the output is safe to insert into a page and free of Word markup.
 */

const KEEP_TAGS = new Set([
  "p", "div", "span", "br", "hr",
  "b", "strong", "i", "em", "u", "s", "strike", "sub", "sup", "small", "mark",
  "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "pre", "code",
  "ul", "ol", "li",
  "table", "thead", "tbody", "tfoot", "tr", "td", "th", "caption", "colgroup", "col",
  "a", "img",
]);

// Removed together with their content.
const DROP_TAGS = new Set([
  "script", "style", "title", "head", "meta", "link", "xml", "template",
  "noscript", "iframe", "object", "embed", "frame", "frameset", "applet",
  "form", "input", "button", "select", "textarea", "option", "svg", "math",
]);

const KEEP_ATTRS: Record<string, readonly string[]> = {
  td: ["colspan", "rowspan", "align", "valign", "width"],
  th: ["colspan", "rowspan", "align", "valign", "width"],
  col: ["span", "width"],
  colgroup: ["span", "width"],
  table: ["border", "cellpadding", "cellspacing", "width"],
  img: ["alt", "width", "height"],
  p: ["align"],
  div: ["align"],
  ol: ["start", "type"],
};

const KEEP_CSS = new Set([
  "color", "background-color", "font-weight", "font-style", "font-size",
  "font-family", "text-decoration", "text-decoration-line", "text-align",
  "text-indent", "vertical-align", "line-height", "margin-left",
  "padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
  "border", "border-top", "border-right", "border-bottom", "border-left",
  "border-collapse", "width", "height",
]);

const UNSAFE_CSS_VALUE = /url\s*\(|expression\s*\(|javascript:|behavior\s*:|@import/i;
const SAFE_HREF = /^(?:https?:|mailto:|#)/i;
const SAFE_IMG_SRC = /^(?:data:image\/(?:png|jpe?g|gif|webp|bmp);base64,|https?:)/i;

export interface CleanHooks {
  /** CSS font-family to use for this text node, or null for none. */
  fontFor(node: Text): string | null;
  /** Replacement for an element (equation placeholder), or undefined. */
  replace(el: Element, doc: Document): Node | null | undefined;
  /** Image src to use instead of the original, or null to drop the image. */
  imageSrc(img: Element): string | null;
}

export function cleanBody(source: Element, doc: Document, hooks: CleanHooks): DocumentFragment {
  const out = doc.createDocumentFragment();
  for (const child of Array.from(source.childNodes)) {
    appendClean(child, out, doc, hooks);
  }
  return out;
}

function appendClean(node: Node, parent: Node, doc: Document, hooks: CleanHooks): void {
  if (node.nodeType === 3) {
    const text = node as Text;
    const font = hooks.fontFor(text);
    const copy = doc.createTextNode(text.data);
    if (font) {
      const span = doc.createElement("span");
      span.style.setProperty("font-family", font);
      span.appendChild(copy);
      parent.appendChild(span);
    } else {
      parent.appendChild(copy);
    }
    return;
  }
  if (node.nodeType !== 1) return; // comments, processing instructions

  const el = node as Element;
  const replacement = hooks.replace(el, doc);
  if (replacement !== undefined) {
    if (replacement) parent.appendChild(replacement);
    return;
  }

  const tag = el.tagName.toLowerCase();
  if (DROP_TAGS.has(tag) || tag.startsWith("v:") || tag.startsWith("w:")) return;

  const outTag = tag === "font" ? "span" : tag;
  if (!KEEP_TAGS.has(outTag)) {
    for (const child of Array.from(el.childNodes)) appendClean(child, parent, doc, hooks);
    return;
  }

  const copy = doc.createElement(outTag);
  copyAttributes(el, copy, tag);
  // A link without a safe target is just text (bookmarks, javascript:).
  if (outTag === "a" && !copy.hasAttribute("href")) {
    for (const child of Array.from(el.childNodes)) appendClean(child, parent, doc, hooks);
    return;
  }
  if (outTag === "img") {
    const src = hooks.imageSrc(el);
    if (!src || !SAFE_IMG_SRC.test(src)) return;
    copy.setAttribute("src", src);
  }
  for (const child of Array.from(el.childNodes)) appendClean(child, copy, doc, hooks);

  // An unstyled span (Word's lang/class wrappers) adds nothing.
  if (outTag === "span" && copy.attributes.length === 0) {
    while (copy.firstChild) parent.appendChild(copy.firstChild);
    return;
  }
  parent.appendChild(copy);
}

function copyAttributes(el: Element, copy: Element, tag: string): void {
  for (const name of KEEP_ATTRS[tag] ?? []) {
    const value = el.getAttribute(name);
    if (value !== null && !/[<>"]/.test(value)) copy.setAttribute(name, value);
  }

  if (tag === "a") {
    const href = el.getAttribute("href")?.trim();
    if (href && SAFE_HREF.test(href)) copy.setAttribute("href", href);
  }

  const css = cleanStyle(el.getAttribute("style") ?? "");
  if (tag === "font") {
    const color = el.getAttribute("color");
    if (color && /^#?[\w]+$/.test(color)) css.unshift(`color: ${color}`);
  }
  if (css.length > 0) copy.setAttribute("style", css.join("; "));
}

export function parseDeclarations(style: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const part of style.split(";")) {
    const colon = part.indexOf(":");
    if (colon < 0) continue;
    const prop = part.slice(0, colon).trim().toLowerCase();
    const value = part.slice(colon + 1).trim();
    if (prop && value) out.push([prop, value]);
  }
  return out;
}

function cleanStyle(style: string): string[] {
  const kept: string[] = [];
  for (let [prop, value] of parseDeclarations(style)) {
    if (UNSAFE_CSS_VALUE.test(value) || /[<>]/.test(value)) continue;
    // Word writes highlight as "background:yellow".
    if (prop === "background" && /^[#\w(),.\s%]+$/.test(value)) prop = "background-color";
    if (!KEEP_CSS.has(prop)) continue;
    // Bijoy fonts are dropped; converted text gets its font from fontFor.
    if (prop === "font-family" && isBijoyFont(firstFontFamily(value))) continue;
    kept.push(`${prop}: ${value}`);
  }
  return kept;
}

/** First family of a CSS font-family list, without quotes. */
export function firstFontFamily(value: string): string {
  return (value.split(",")[0] ?? "").trim().replace(/^["']|["']$/g, "");
}
