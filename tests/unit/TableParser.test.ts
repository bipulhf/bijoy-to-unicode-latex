import { describe, it, expect } from "vitest";
import {
  classifyTable,
  isOptionTable,
  isLayoutTable,
  flattenOptionTable,
} from "../../src/walker/TableParser.js";
import type { ParsedTable, ParsedParagraph } from "../../src/types.js";

function cell(text: string): ParsedParagraph {
  return {
    nodes: [
      {
        type: "text",
        text,
        isBijoy: false,
        fontName: null,
        bold: false,
        italic: false,
      },
    ],
    styleId: null,
    numId: null,
    ilvl: null,
  };
}

describe("TableParser classification", () => {
  describe("isOptionTable", () => {
    it("detects a 2x2 option table with (A)(B)(C)(D) markers", () => {
      const table: ParsedTable = {
        rows: [
          [cell("(A) 5"), cell("(B) 10")],
          [cell("(C) 15"), cell("(D) 20")],
        ],
      };
      expect(isOptionTable(table)).toBe(true);
    });

    it("detects a 1x4 option table", () => {
      const table: ParsedTable = {
        rows: [[cell("(A) yes"), cell("(B) no"), cell("(C) maybe"), cell("(D) none")]],
      };
      expect(isOptionTable(table)).toBe(true);
    });

    it("detects Bangla option markers", () => {
      const table: ParsedTable = {
        rows: [
          [cell("(ক) ৫"), cell("(খ) ১০")],
          [cell("(গ) ১৫"), cell("(ঘ) ২০")],
        ],
      };
      expect(isOptionTable(table)).toBe(true);
    });

    it("rejects a table with too many rows", () => {
      const table: ParsedTable = {
        rows: [
          [cell("(A) 1"), cell("(B) 2")],
          [cell("(C) 3"), cell("(D) 4")],
          [cell("(E) 5"), cell("(F) 6")],
          [cell("(G) 7"), cell("(H) 8")],
          [cell("(I) 9"), cell("(J) 10")],
        ],
      };
      expect(isOptionTable(table)).toBe(false);
    });

    it("rejects a table with single column", () => {
      const table: ParsedTable = {
        rows: [[cell("some text")]],
      };
      expect(isOptionTable(table)).toBe(false);
    });
  });

  describe("isLayoutTable", () => {
    it("detects a layout table with question numbers in cells", () => {
      const table: ParsedTable = {
        rows: [[cell("1. What is x?"), cell("Additional info")]],
      };
      expect(isLayoutTable(table)).toBe(true);
    });

    it("detects Bangla numeral question start", () => {
      const table: ParsedTable = {
        rows: [[cell("১. প্রশ্ন কি?")]],
      };
      expect(isLayoutTable(table)).toBe(true);
    });

    it("rejects a table with too many columns", () => {
      const table: ParsedTable = {
        rows: [[cell("a"), cell("b"), cell("c"), cell("d")]],
      };
      expect(isLayoutTable(table)).toBe(false);
    });
  });

  describe("classifyTable", () => {
    it("classifies option tables", () => {
      const table: ParsedTable = {
        rows: [
          [cell("(A) 5"), cell("(B) 10")],
          [cell("(C) 15"), cell("(D) 20")],
        ],
      };
      expect(classifyTable(table)).toBe("option");
    });

    it("classifies layout tables", () => {
      const table: ParsedTable = {
        rows: [[cell("1. Question text")]],
      };
      expect(classifyTable(table)).toBe("layout");
    });

    it("classifies data tables", () => {
      const table: ParsedTable = {
        rows: [
          [cell("Header 1"), cell("Header 2")],
          [cell("Data 1"), cell("Data 2")],
          [cell("Data 3"), cell("Data 4")],
          [cell("Data 5"), cell("Data 6")],
          [cell("Data 7"), cell("Data 8")],
        ],
      };
      expect(classifyTable(table)).toBe("data");
    });
  });

  describe("flattenOptionTable", () => {
    it("flattens a 2x2 option table into 4 cells", () => {
      const table: ParsedTable = {
        rows: [
          [cell("(A) 5"), cell("(B) 10")],
          [cell("(C) 15"), cell("(D) 20")],
        ],
      };
      const flattened = flattenOptionTable(table);
      expect(flattened).toHaveLength(4);
    });

    it("skips empty cells", () => {
      const table: ParsedTable = {
        rows: [
          [cell("(A) 5"), cell("")],
          [cell("(C) 15"), cell("(D) 20")],
        ],
      };
      const flattened = flattenOptionTable(table);
      expect(flattened).toHaveLength(3);
    });
  });
});
