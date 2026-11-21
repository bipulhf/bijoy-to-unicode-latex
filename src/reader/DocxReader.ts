import JSZip from "jszip";
import { readFile } from "node:fs/promises";
import { InvalidDocxError } from "../types.js";
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

async function loadZip(input: Buffer): Promise<JSZip> {
  try {
    return await JSZip.loadAsync(input);
  } catch {
    throw new InvalidDocxError("File is not a valid ZIP archive");
  }
}

// Upper bound on one decompressed XML part, so a small zip bomb cannot
// exhaust memory. Real document.xml files are a few MB at most.
const MAX_ENTRY_BYTES = 200 * 1024 * 1024;

async function readEntry(zip: JSZip, path: string): Promise<string | null> {
  const entry = zip.file(path);
  if (!entry) return null;

  const chunks: Buffer[] = [];
  let total = 0;
  // JSZip's stream is an old-style readable without async iteration.
  await new Promise<void>((resolve, reject) => {
    const stream = entry.nodeStream("nodebuffer");
    stream.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_ENTRY_BYTES) {
        stream.pause();
        reject(new InvalidDocxError(`${path} is too large to process`));
        return;
      }
      chunks.push(chunk);
    });
    stream.on("error", () =>
      reject(new InvalidDocxError(`Cannot read ${path} from the archive`)),
    );
    stream.on("end", () => resolve());
  });
  return new TextDecoder("utf-8").decode(Buffer.concat(chunks));
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
