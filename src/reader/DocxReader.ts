import { readFile } from "node:fs/promises";
import { InvalidDocxError } from "../types.js";
import { ZipArchive } from "./zip.js";
import { parseXml, parseXmlOrdered } from "./XmlParser.js";
import type { XmlNode } from "../types.js";
import type { OrderedEntry } from "./XmlParser.js";

export interface DocxContent {
  documentXml: XmlNode;
  documentXmlOrdered: OrderedEntry[];
  stylesXml: XmlNode | null;
  numberingXml: XmlNode | null;
  footnotesXml: XmlNode | null;
  endnotesXml: XmlNode | null;
}

// Upper bound on one decompressed XML part, so a small zip bomb cannot
// exhaust memory. Real document.xml files are a few MB at most.
const MAX_ENTRY_BYTES = 200 * 1024 * 1024;

export async function readDocxFromBuffer(buffer: Buffer): Promise<DocxContent> {
  const zip = ZipArchive.open(buffer);

  const docXml = await zip.readText("word/document.xml", MAX_ENTRY_BYTES);
  if (!docXml) {
    throw new InvalidDocxError("Missing word/document.xml — not a valid .docx file");
  }

  const [stylesStr, numberingStr, footnotesStr, endnotesStr] =
    await Promise.all([
      zip.readText("word/styles.xml", MAX_ENTRY_BYTES),
      zip.readText("word/numbering.xml", MAX_ENTRY_BYTES),
      zip.readText("word/footnotes.xml", MAX_ENTRY_BYTES),
      zip.readText("word/endnotes.xml", MAX_ENTRY_BYTES),
    ]);

  return {
    documentXml: parseXml(docXml),
    documentXmlOrdered: parseXmlOrdered(docXml),
    stylesXml: stylesStr ? parseXml(stylesStr) : null,
    numberingXml: numberingStr ? parseXml(numberingStr) : null,
    footnotesXml: footnotesStr ? parseXml(footnotesStr) : null,
    endnotesXml: endnotesStr ? parseXml(endnotesStr) : null,
  };
}

export async function readDocxFromFile(filePath: string): Promise<DocxContent> {
  let buffer: Buffer;
  try {
    buffer = await readFile(filePath);
  } catch {
    throw new InvalidDocxError(`File not found: ${filePath}`);
  }
  return readDocxFromBuffer(buffer);
}
