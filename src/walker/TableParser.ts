import type {
  XmlNode,
  ParsedParagraph,
  ParsedTable,
  ConversionWarning,
  ConvertOptions,
} from "../types.js";
import {
  getChildren,
  oGetChildByRef,
  type OrderedEntry,
} from "../reader/XmlParser.js";
import { parseParagraph } from "./ParagraphParser.js";
import type { StyleResolver } from "../reader/StyleResolver.js";
import type { NumberingResolver } from "../reader/NumberingResolver.js";

interface TableParserContext {
  warnings: ConversionWarning[];
  paragraphIndex: number;
  options: ConvertOptions;
  stats: {
    bijoyRunsConverted: number;
    totalEquations: number;
    imagesSkipped: number;
    tablesProcessed: number;
  };
  /** Document-order view of the w:tbl element. */
  orderedEntries?: OrderedEntry[];
  styles?: StyleResolver;
  numbering?: NumberingResolver;
}

export type TableClassification = "option" | "layout" | "data";

export function parseTable(
  tblNode: XmlNode,
  ctx: TableParserContext,
): ParsedTable {
  ctx.stats.tablesProcessed++;

  const rows: ParsedParagraph[][] = [];
  const trNodes = getChildren(tblNode, "w:tr");

  for (const [ri, tr] of trNodes.entries()) {
    const row: ParsedParagraph[] = [];
    const tcNodes = getChildren(tr, "w:tc");
    const trOrdered = childOrdered(ctx.orderedEntries, "w:tr", ri);

    for (const [ci, tc] of tcNodes.entries()) {
      const paragraphs = getChildren(tc, "w:p");
      const tcOrdered = childOrdered(trOrdered, "w:tc", ci);
      const cellContent: ParsedParagraph = {
        nodes: [],
        styleId: null,
        numId: null,
        ilvl: null,
      };

      for (const [pi, p] of paragraphs.entries()) {
        const parsed = parseParagraph(p, {
          warnings: ctx.warnings,
          paragraphIndex: ctx.paragraphIndex,
          options: ctx.options,
          stats: ctx.stats,
          orderedEntries: childOrdered(tcOrdered, "w:p", pi),
          styles: ctx.styles,
          numbering: ctx.numbering,
        });
        cellContent.nodes.push(...parsed.nodes);
        if (!cellContent.styleId && parsed.styleId) {
          cellContent.styleId = parsed.styleId;
        }
      }

      row.push(cellContent);
    }

    if (row.length > 0) {
      rows.push(row);
    }
  }

  return { rows };
}

function childOrdered(
  parent: OrderedEntry[] | undefined,
  tag: string,
  index: number,
): OrderedEntry[] | undefined {
  return parent ? oGetChildByRef(parent, tag, index) : undefined;
}

export function classifyTable(table: ParsedTable): TableClassification {
  if (isOptionTable(table)) return "option";
  if (isLayoutTable(table)) return "layout";
  return "data";
}

const OPTION_MARKER = /^[\s]*[\(\[]?(?:[ABCDabcdকখগঘ])[\)\].)।\s]+/u;

export function isOptionTable(table: ParsedTable): boolean {
  if (table.rows.length === 0) return false;
  if (table.rows.length > 4) return false;

  const firstRow = table.rows[0]!;
  if (firstRow.length < 2 || firstRow.length > 4) return false;

  let optionCellCount = 0;
  for (const cell of firstRow) {
    const text = getCellText(cell);
    if (text.trim().length > 0 && OPTION_MARKER.test(text.trim())) {
      optionCellCount++;
    }
  }

  return optionCellCount >= 2;
}

const QUESTION_START = /^[০-৯0-9]+[.)।\s]/u;

export function isLayoutTable(table: ParsedTable): boolean {
  if (table.rows.length === 0) return false;
  const firstRow = table.rows[0]!;
  if (firstRow.length > 3) return false;

  for (const cell of firstRow) {
    const text = getCellText(cell);
    if (QUESTION_START.test(text.trim())) {
      return true;
    }
  }

  return false;
}

export function flattenOptionTable(table: ParsedTable): ParsedParagraph[] {
  const options: ParsedParagraph[] = [];

  for (const row of table.rows) {
    for (const cell of row) {
      const text = getCellText(cell);
      if (text.trim().length > 0) {
        options.push(cell);
      }
    }
  }

  return options;
}

function getCellText(cell: ParsedParagraph): string {
  let text = "";
  for (const node of cell.nodes) {
    if (node.type === "text") {
      text += node.text;
    } else if (node.type === "equation") {
      text += node.ommlXml;
    }
  }
  return text;
}
