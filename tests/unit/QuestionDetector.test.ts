import { describe, it, expect } from "vitest";
import {
  isQuestionParagraph,
  isSubPartParagraph,
  isBlankParagraph,
  isEquationOnlyParagraph,
  stripQuestionNumber,
  getFullTextContent,
  getParagraphText,
} from "../../src/assembler/QuestionDetector.js";
import type { ParsedParagraph } from "../../src/types.js";

function textPara(text: string): ParsedParagraph {
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

function emptyPara(): ParsedParagraph {
  return { nodes: [], styleId: null, numId: null, ilvl: null };
}

function equationPara(latex: string): ParsedParagraph {
  return {
    nodes: [
      { type: "equation", ommlXml: latex, isDisplay: false },
    ],
    styleId: null,
    numId: null,
    ilvl: null,
  };
}

describe("QuestionDetector", () => {
  describe("isQuestionParagraph", () => {
    it("detects English numeral question start", () => {
      expect(isQuestionParagraph(textPara("1. What is x?"))).toBe(true);
      expect(isQuestionParagraph(textPara("2) Find the value"))).toBe(true);
      expect(isQuestionParagraph(textPara("10. Determine"))).toBe(true);
      expect(isQuestionParagraph(textPara("99 Some question"))).toBe(true);
    });

    it("detects Bangla numeral question start", () => {
      expect(isQuestionParagraph(textPara("১. প্রশ্ন"))).toBe(true);
      expect(isQuestionParagraph(textPara("২) উত্তর"))).toBe(true);
      expect(isQuestionParagraph(textPara("১০। কোনটি সঠিক"))).toBe(true);
    });

    it("detects Word numbered list paragraphs", () => {
      const p: ParsedParagraph = {
        nodes: [
          {
            type: "text",
            text: "Some question text",
            isBijoy: false,
            fontName: null,
            bold: false,
            italic: false,
          },
        ],
        styleId: null,
        numId: 1,
        ilvl: 0,
      };
      expect(isQuestionParagraph(p)).toBe(true);
    });

    it("rejects non-question paragraphs", () => {
      expect(isQuestionParagraph(textPara("Some random text"))).toBe(false);
      expect(isQuestionParagraph(textPara("(A) Option text"))).toBe(false);
      expect(isQuestionParagraph(textPara(""))).toBe(false);
    });
  });

  describe("isSubPartParagraph", () => {
    it("detects sub-parts with lowercase letters", () => {
      expect(isSubPartParagraph(textPara("(a) Find x"))).toBe(true);
      expect(isSubPartParagraph(textPara("b) Calculate y"))).toBe(true);
      expect(isSubPartParagraph(textPara("c. Determine"))).toBe(true);
    });

    it("detects Roman numeral sub-parts", () => {
      expect(isSubPartParagraph(textPara("i) First part"))).toBe(true);
      expect(isSubPartParagraph(textPara("ii. Second part"))).toBe(true);
      expect(isSubPartParagraph(textPara("iii) Third part"))).toBe(true);
      expect(isSubPartParagraph(textPara("iv. Fourth part"))).toBe(true);
    });

    it("rejects question starts as sub-parts", () => {
      expect(isSubPartParagraph(textPara("1. Question"))).toBe(false);
      expect(isSubPartParagraph(textPara("Some text"))).toBe(false);
    });
  });

  describe("isBlankParagraph", () => {
    it("returns true for empty paragraph", () => {
      expect(isBlankParagraph(emptyPara())).toBe(true);
    });

    it("returns true for whitespace-only paragraph", () => {
      expect(isBlankParagraph(textPara("   "))).toBe(true);
    });

    it("returns false for paragraph with content", () => {
      expect(isBlankParagraph(textPara("hello"))).toBe(false);
    });
  });

  describe("isEquationOnlyParagraph", () => {
    it("returns true for equation-only paragraph", () => {
      expect(isEquationOnlyParagraph(equationPara("$x^2$"))).toBe(true);
    });

    it("returns false for text paragraph", () => {
      expect(isEquationOnlyParagraph(textPara("hello"))).toBe(false);
    });

    it("returns false for empty paragraph", () => {
      expect(isEquationOnlyParagraph(emptyPara())).toBe(false);
    });
  });

  describe("stripQuestionNumber", () => {
    it("strips English number prefix", () => {
      expect(stripQuestionNumber("1. What is x?")).toBe("What is x?");
      expect(stripQuestionNumber("2) Find y")).toBe("Find y");
      expect(stripQuestionNumber("10 Question")).toBe("Question");
    });

    it("strips Bangla number prefix", () => {
      expect(stripQuestionNumber("১. প্রশ্ন")).toBe("প্রশ্ন");
      expect(stripQuestionNumber("১০। কোনটি")).toBe("কোনটি");
    });
  });

  describe("getFullTextContent", () => {
    it("concatenates all text nodes", () => {
      const p: ParsedParagraph = {
        nodes: [
          { type: "text", text: "Hello ", isBijoy: false, fontName: null, bold: false, italic: false },
          { type: "equation", ommlXml: "$x$", isDisplay: false },
          { type: "text", text: " World", isBijoy: false, fontName: null, bold: false, italic: false },
        ],
        styleId: null,
        numId: null,
        ilvl: null,
      };
      expect(getFullTextContent(p)).toBe("Hello $x$ World");
    });
  });

  describe("getParagraphText", () => {
    it("replaces images with token", () => {
      const p: ParsedParagraph = {
        nodes: [
          { type: "text", text: "See ", isBijoy: false, fontName: null, bold: false, italic: false },
          { type: "image", relationshipId: null },
          { type: "text", text: " above", isBijoy: false, fontName: null, bold: false, italic: false },
        ],
        styleId: null,
        numId: null,
        ilvl: null,
      };
      expect(getParagraphText(p, "[img]")).toBe("See [img] above");
    });
  });
});
