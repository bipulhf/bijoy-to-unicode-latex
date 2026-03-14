import JSZip from "jszip";
import { readFile } from "node:fs/promises";
import { InvalidDocxError } from "../types.js";
import { parseXml } from "./XmlParser.js";
import type { XmlNode } from "../types.js";

export interface DocxContent {
  documentXml: XmlNode;
  stylesXml: XmlNode | null;
  numberingXml: XmlNode | null;
  footnotesXml: XmlNode | null;
  endnotesXml: XmlNode | null;
}

async function loadZip(input: Buffer): Promise<JSZip> {
  try {
    return await JSZip.loadAsync(input);
  } catch {
    throw new InvalidDocxError("File is not a valid ZIP archive");
  }
}

async function readEntry(zip: JSZip, path: string): Promise<string | null> {
  const entry = zip.file(path);
  if (!entry) return null;
  return entry.async("string");
}

export async function readDocxFromBuffer(buffer: Buffer): Promise<DocxContent> {
  const zip = await loadZip(buffer);

  const docXml = await readEntry(zip, "word/document.xml");
  if (!docXml) {
    throw new InvalidDocxError("Missing word/document.xml — not a valid .docx file");
  }

  const [stylesStr, numberingStr, footnotesStr, endnotesStr] =
    await Promise.all([
      readEntry(zip, "word/styles.xml"),
      readEntry(zip, "word/numbering.xml"),
      readEntry(zip, "word/footnotes.xml"),
      readEntry(zip, "word/endnotes.xml"),
    ]);

  return {
    documentXml: parseXml(docXml),
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
