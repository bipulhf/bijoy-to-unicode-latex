import { readFile } from "node:fs/promises";
import type {
  ConversionResult,
  ConvertOptions,
  Question,
  ConversionStats,
  ConversionWarning,
  WarningType,
} from "./types.js";
import { InvalidDocxError } from "./types.js";
import { readDocxFromBuffer } from "./reader/DocxReader.js";
import { walkDocument } from "./walker/DocumentWalker.js";
import { assembleQuestions } from "./assembler/QuestionAssembler.js";

export async function convertDocx(
  filePath: string,
  options: ConvertOptions = {},
): Promise<ConversionResult> {
  let buffer: Buffer;
  try {
    buffer = await readFile(filePath);
  } catch {
    throw new InvalidDocxError(`File not found: ${filePath}`);
  }
  return convertBuffer(buffer, options);
}

export async function convertBuffer(
  buffer: Buffer,
  options: ConvertOptions = {},
): Promise<ConversionResult> {
  const docx = await readDocxFromBuffer(buffer);
  const { elements, stats } = walkDocument(
    docx.documentXml,
    options,
    docx.documentXmlOrdered,
  );
  const questions = assembleQuestions(elements, options, stats.warnings);

  return {
    questions,
    stats: {
      totalQuestions: questions.length,
      totalEquations: stats.totalEquations,
      bijoyRunsConverted: stats.bijoyRunsConverted,
      tablesProcessed: stats.tablesProcessed,
      imagesSkipped: stats.imagesSkipped,
      warnings: stats.warnings,
    },
  };
}

export { InvalidDocxError };
export type {
  Question,
  ConversionResult,
  ConversionStats,
  ConversionWarning,
  ConvertOptions,
  WarningType,
};
