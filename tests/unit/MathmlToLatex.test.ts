import { describe, it, expect } from "vitest";
import { mathmlToLatex } from "../../src/equations/MathmlToLatex.js";
import type { XmlNode, ConversionWarning } from "../../src/types.js";

function ctx(): { warnings: ConversionWarning[]; paragraphIndex: number } {
  return { warnings: [], paragraphIndex: 0 };
}

describe("MathmlToLatex", () => {
  describe("mi (identifiers)", () => {
    it("converts a simple identifier", () => {
      const node: XmlNode = { mi: { "#text": "x" } };
      expect(mathmlToLatex(node, ctx())).toBe("x");
    });

    it("converts Greek identifiers", () => {
      const node: XmlNode = { mi: { "#text": "\u03B1" } };
      expect(mathmlToLatex(node, ctx())).toBe("\\alpha");
    });

    it("applies mathvariant", () => {
      const node: XmlNode = {
        mi: { "#text": "R", "@_mathvariant": "double-struck" },
      };
      expect(mathmlToLatex(node, ctx())).toBe("\\mathbb{R}");
    });
  });

  describe("mn (numbers)", () => {
    it("converts a number", () => {
      const node: XmlNode = { mn: { "#text": "42" } };
      expect(mathmlToLatex(node, ctx())).toBe("42");
    });
  });

  describe("mo (operators)", () => {
    it("converts an operator", () => {
      const node: XmlNode = { mo: { "#text": "+" } };
      expect(mathmlToLatex(node, ctx())).toBe("+");
    });

    it("converts a mapped operator", () => {
      const node: XmlNode = { mo: { "#text": "\u2264" } };
      expect(mathmlToLatex(node, ctx())).toBe("\\leq");
    });
  });

  describe("mtext", () => {
    it("wraps text in \\text{}", () => {
      const node: XmlNode = { mtext: { "#text": "if " } };
      expect(mathmlToLatex(node, ctx())).toBe("\\text{if }");
    });

    it("returns empty for whitespace-only", () => {
      const node: XmlNode = { mtext: { "#text": "   " } };
      expect(mathmlToLatex(node, ctx())).toBe("");
    });
  });

  describe("mfrac", () => {
    it("converts a fraction", () => {
      const node: XmlNode = {
        mfrac: {
          mn: [{ "#text": "1" }, { "#text": "2" }],
        },
      };
      const result = mathmlToLatex(node, ctx());
      expect(result).toContain("\\frac");
    });
  });

  describe("msqrt", () => {
    it("converts a square root", () => {
      const node: XmlNode = {
        msqrt: { mi: { "#text": "x" } },
      };
      expect(mathmlToLatex(node, ctx())).toBe("\\sqrt{x}");
    });
  });

  describe("msub / msup / msubsup", () => {
    it("converts subscript", () => {
      const node: XmlNode = {
        msub: {
          mi: [{ "#text": "x" }, { "#text": "i" }],
        },
      };
      const result = mathmlToLatex(node, ctx());
      expect(result).toContain("x_{i}");
    });

    it("converts superscript", () => {
      const node: XmlNode = {
        msup: {
          mi: [{ "#text": "x" }, { "#text": "2" }],
        },
      };
      const result = mathmlToLatex(node, ctx());
      expect(result).toContain("x^{2}");
    });
  });

  describe("mstyle", () => {
    it("applies bold variant", () => {
      const node: XmlNode = {
        mstyle: {
          "@_mathvariant": "bold",
          mi: { "#text": "v" },
        },
      };
      const result = mathmlToLatex(node, ctx());
      expect(result).toContain("\\mathbf");
    });

    it("applies displaystyle", () => {
      const node: XmlNode = {
        mstyle: {
          "@_displaystyle": "true",
          mi: { "#text": "x" },
        },
      };
      const result = mathmlToLatex(node, ctx());
      expect(result).toContain("\\displaystyle");
    });
  });

  describe("menclose", () => {
    it("converts box notation", () => {
      const node: XmlNode = {
        menclose: {
          "@_notation": "box",
          mi: { "#text": "x" },
        },
      };
      const result = mathmlToLatex(node, ctx());
      expect(result).toContain("\\boxed{x}");
    });

    it("converts strike notation", () => {
      const node: XmlNode = {
        menclose: {
          "@_notation": "updiagonalstrike",
          mi: { "#text": "x" },
        },
      };
      const result = mathmlToLatex(node, ctx());
      expect(result).toContain("\\cancel{x}");
    });
  });

  describe("mphantom", () => {
    it("converts phantom", () => {
      const node: XmlNode = {
        mphantom: { mi: { "#text": "x" } },
      };
      const result = mathmlToLatex(node, ctx());
      expect(result).toBe("\\phantom{x}");
    });
  });

  describe("recursion guard", () => {
    it("returns ldots on deep recursion", () => {
      const c = ctx();
      const node: XmlNode = { mi: { "#text": "x" } };
      const result = mathmlToLatex(node, c, 51);
      expect(result).toBe("\\ldots");
      expect(c.warnings[0]!.type).toBe("recursion_limit");
    });
  });
});
