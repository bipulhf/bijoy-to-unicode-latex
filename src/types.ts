export interface Question {
  question: string;
  options: string[];
}

export interface ConversionResult {
  questions: Question[];
  stats: ConversionStats;
}

export interface ConversionStats {
  totalQuestions: number;
  totalEquations: number;
  bijoyRunsConverted: number;
  tablesProcessed: number;
  imagesSkipped: number;
  warnings: ConversionWarning[];
}

export type WarningType =
  | "unknown_char"
  | "unsupported_equation"
  | "ambiguous_option"
  | "ole_equation"
  | "image_skipped"
  | "xslt_fallback"
  | "equation_parse_error"
  | "recursion_limit";

export interface ConversionWarning {
  type: WarningType;
  message: string;
  paragraphIndex: number;
}

export interface RunNode {
  type: "text";
  text: string;
  isBijoy: boolean;
  fontName: string | null;
  bold: boolean;
  italic: boolean;
}

export interface EquationNode {
  type: "equation";
  ommlXml: string;
  isDisplay: boolean;
}

export interface ImageNode {
  type: "image";
  relationshipId: string | null;
}

export type DocNode = RunNode | EquationNode | ImageNode;

export interface ParsedParagraph {
  nodes: DocNode[];
  styleId: string | null;
  numId: number | null;
  ilvl: number | null;
}

export interface ParsedTable {
  rows: ParsedParagraph[][];
}

export type BodyElement =
  | { type: "paragraph"; paragraph: ParsedParagraph }
  | { type: "table"; table: ParsedTable };

export interface ConvertOptions {
  skipBijoy?: boolean;
  skipEquations?: boolean;
  forceDisplay?: boolean;
  forceInline?: boolean;
  preserveFormatting?: boolean;
  maxRecursionDepth?: number;
  imageToken?: string;
}

export interface XmlNode {
  [key: string]: XmlNodeValue;
}

export type XmlNodeValue =
  | string
  | number
  | boolean
  | XmlNode
  | XmlNode[]
  | undefined;

export class InvalidDocxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidDocxError";
  }
}
