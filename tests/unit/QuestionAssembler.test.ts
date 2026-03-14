import { describe, it, expect } from "vitest";
import { assembleQuestions } from "../../src/assembler/QuestionAssembler.js";
import type { BodyElement, ParsedParagraph, ConvertOptions } from "../../src/types.js";

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

function para(text: string): BodyElement {
  return { type: "paragraph", paragraph: textPara(text) };
}

function blankPara(): BodyElement {
  return {
    type: "paragraph",
    paragraph: { nodes: [], styleId: null, numId: null, ilvl: null },
  };
}

const defaultOpts: ConvertOptions = {};

describe("QuestionAssembler", () => {
  it("assembles a single question with inline options", () => {
    const elements: BodyElement[] = [
      para("1. What is 2+2?"),
      para("(A) 3"),
      para("(B) 4"),
      para("(C) 5"),
      para("(D) 6"),
    ];
    const result = assembleQuestions(elements, defaultOpts, []);
    expect(result).toHaveLength(1);
    expect(result[0]!.question).toBe("What is 2+2?");
    expect(result[0]!.options).toEqual(["3", "4", "5", "6"]);
  });

  it("assembles multiple questions", () => {
    const elements: BodyElement[] = [
      para("1. First question"),
      para("(A) a1"),
      para("(B) a2"),
      blankPara(),
      para("2. Second question"),
      para("(A) b1"),
      para("(B) b2"),
    ];
    const result = assembleQuestions(elements, defaultOpts, []);
    expect(result).toHaveLength(2);
    expect(result[0]!.question).toBe("First question");
    expect(result[1]!.question).toBe("Second question");
  });

  it("handles question without options", () => {
    const elements: BodyElement[] = [
      para("1. Solve for x"),
      blankPara(),
      para("2. Next question"),
      para("(A) yes"),
      para("(B) no"),
    ];
    const result = assembleQuestions(elements, defaultOpts, []);
    expect(result).toHaveLength(2);
    expect(result[0]!.question).toBe("Solve for x");
    expect(result[0]!.options).toEqual([]);
    expect(result[1]!.options).toEqual(["yes", "no"]);
  });

  it("handles multi-line question text", () => {
    const elements: BodyElement[] = [
      para("1. Given the following equation:"),
      para("x + y = 10"),
      para("(A) 5"),
      para("(B) 10"),
    ];
    const result = assembleQuestions(elements, defaultOpts, []);
    expect(result).toHaveLength(1);
    expect(result[0]!.question).toContain("equation:");
    expect(result[0]!.question).toContain("x + y = 10");
  });

  it("handles consecutive questions without blank lines", () => {
    const elements: BodyElement[] = [
      para("1. Question one"),
      para("(A) opt1"),
      para("(B) opt2"),
      para("2. Question two"),
      para("(A) opt3"),
      para("(B) opt4"),
    ];
    const result = assembleQuestions(elements, defaultOpts, []);
    expect(result).toHaveLength(2);
  });

  it("handles option table", () => {
    const elements: BodyElement[] = [
      para("1. What is x?"),
      {
        type: "table",
        table: {
          rows: [
            [textPara("(A) 5"), textPara("(B) 10")],
            [textPara("(C) 15"), textPara("(D) 20")],
          ],
        },
      },
    ];
    const result = assembleQuestions(elements, defaultOpts, []);
    expect(result).toHaveLength(1);
    expect(result[0]!.options).toHaveLength(4);
  });

  it("ignores blank paragraphs between question and options", () => {
    const elements: BodyElement[] = [
      para("1. Question text"),
      para("(A) first"),
      para("(B) second"),
      para("(C) third"),
      para("(D) fourth"),
    ];
    const result = assembleQuestions(elements, defaultOpts, []);
    expect(result).toHaveLength(1);
    expect(result[0]!.options).toHaveLength(4);
  });

  it("handles Bangla numeral question starts", () => {
    const elements: BodyElement[] = [
      para("১. কোনটি সঠিক?"),
      para("(ক) প্রথম"),
      para("(খ) দ্বিতীয়"),
    ];
    const result = assembleQuestions(elements, defaultOpts, []);
    expect(result).toHaveLength(1);
    expect(result[0]!.question).toBe("কোনটি সঠিক?");
  });

  it("captures unnumbered content before first numbered question", () => {
    const elements: BodyElement[] = [
      para("Math Exam 2024"),
      para("Total marks: 100"),
      blankPara(),
      para("1. First question"),
      para("(A) yes"),
      para("(B) no"),
    ];
    const result = assembleQuestions(elements, defaultOpts, []);
    expect(result).toHaveLength(2);
    expect(result[0]!.question).toContain("Math Exam 2024");
    expect(result[0]!.options).toHaveLength(0);
    expect(result[1]!.question).toBe("First question");
    expect(result[1]!.options).toHaveLength(2);
  });

  it("handles images in question text", () => {
    const elements: BodyElement[] = [
      {
        type: "paragraph",
        paragraph: {
          nodes: [
            { type: "text", text: "1. See ", isBijoy: false, fontName: null, bold: false, italic: false },
            { type: "image", relationshipId: "rId5" },
          ],
          styleId: null,
          numId: null,
          ilvl: null,
        },
      },
      para("(A) yes"),
      para("(B) no"),
    ];
    const result = assembleQuestions(elements, { imageToken: "[img]" }, []);
    expect(result).toHaveLength(1);
    expect(result[0]!.question).toContain("[img]");
  });
});
