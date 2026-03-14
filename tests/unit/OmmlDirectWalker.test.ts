import { describe, it, expect } from "vitest";
import { ommlToLatex } from "../../src/equations/OmmlDirectWalker.js";
import type { XmlNode, ConversionWarning } from "../../src/types.js";

function ctx(): { warnings: ConversionWarning[]; paragraphIndex: number } {
  return { warnings: [], paragraphIndex: 0 };
}

describe("OmmlDirectWalker", () => {
  describe("m:f (fractions)", () => {
    it("converts a basic fraction", () => {
      const node: XmlNode = {
        "m:num": { "m:r": [{ "m:t": [{ "#text": "a" }] }] },
        "m:den": { "m:r": [{ "m:t": [{ "#text": "b" }] }] },
      };
      const wrapper: XmlNode = { "m:f": [node] };
      const result = ommlToLatex(wrapper, ctx());
      expect(result).toContain("\\frac{a}{b}");
    });

    it("converts a noBar fraction as binom", () => {
      const node: XmlNode = {
        "m:fPr": { "m:type": { "@_m:val": "noBar" } },
        "m:num": { "m:r": [{ "m:t": [{ "#text": "n" }] }] },
        "m:den": { "m:r": [{ "m:t": [{ "#text": "k" }] }] },
      };
      const wrapper: XmlNode = { "m:f": [node] };
      const result = ommlToLatex(wrapper, ctx());
      expect(result).toContain("\\binom{n}{k}");
    });

    it("converts a linear fraction", () => {
      const node: XmlNode = {
        "m:fPr": { "m:type": { "@_m:val": "lin" } },
        "m:num": { "m:r": [{ "m:t": [{ "#text": "a" }] }] },
        "m:den": { "m:r": [{ "m:t": [{ "#text": "b" }] }] },
      };
      const wrapper: XmlNode = { "m:f": [node] };
      const result = ommlToLatex(wrapper, ctx());
      expect(result).toContain("a/b");
    });
  });

  describe("m:rad (radicals)", () => {
    it("converts a square root", () => {
      const node: XmlNode = {
        "m:radPr": { "m:degHide": { "@_m:val": "1" } },
        "m:e": { "m:r": [{ "m:t": [{ "#text": "x" }] }] },
      };
      const wrapper: XmlNode = { "m:rad": [node] };
      const result = ommlToLatex(wrapper, ctx());
      expect(result).toContain("\\sqrt{x}");
    });

    it("converts an nth root", () => {
      const node: XmlNode = {
        "m:deg": { "m:r": [{ "m:t": [{ "#text": "3" }] }] },
        "m:e": { "m:r": [{ "m:t": [{ "#text": "x" }] }] },
      };
      const wrapper: XmlNode = { "m:rad": [node] };
      const result = ommlToLatex(wrapper, ctx());
      expect(result).toContain("\\sqrt[3]{x}");
    });
  });

  describe("m:sSub / m:sSup / m:sSubSup", () => {
    it("converts subscript", () => {
      const node: XmlNode = {
        "m:e": { "m:r": [{ "m:t": [{ "#text": "x" }] }] },
        "m:sub": { "m:r": [{ "m:t": [{ "#text": "i" }] }] },
      };
      const wrapper: XmlNode = { "m:sSub": [node] };
      const result = ommlToLatex(wrapper, ctx());
      expect(result).toContain("x_{i}");
    });

    it("converts superscript", () => {
      const node: XmlNode = {
        "m:e": { "m:r": [{ "m:t": [{ "#text": "x" }] }] },
        "m:sup": { "m:r": [{ "m:t": [{ "#text": "2" }] }] },
      };
      const wrapper: XmlNode = { "m:sSup": [node] };
      const result = ommlToLatex(wrapper, ctx());
      expect(result).toContain("x^{2}");
    });

    it("converts sub+superscript", () => {
      const node: XmlNode = {
        "m:e": { "m:r": [{ "m:t": [{ "#text": "x" }] }] },
        "m:sub": { "m:r": [{ "m:t": [{ "#text": "i" }] }] },
        "m:sup": { "m:r": [{ "m:t": [{ "#text": "2" }] }] },
      };
      const wrapper: XmlNode = { "m:sSubSup": [node] };
      const result = ommlToLatex(wrapper, ctx());
      expect(result).toContain("x_{i}^{2}");
    });
  });

  describe("m:nary (n-ary operators)", () => {
    it("converts a sum with limits", () => {
      const node: XmlNode = {
        "m:naryPr": {
          "m:chr": { "@_m:val": "\u2211" },
        },
        "m:sub": { "m:r": [{ "m:t": [{ "#text": "i=1" }] }] },
        "m:sup": { "m:r": [{ "m:t": [{ "#text": "n" }] }] },
        "m:e": { "m:r": [{ "m:t": [{ "#text": "i" }] }] },
      };
      const wrapper: XmlNode = { "m:nary": [node] };
      const result = ommlToLatex(wrapper, ctx());
      expect(result).toContain("\\sum");
      expect(result).toContain("_{i=1}");
      expect(result).toContain("^{n}");
    });

    it("converts an integral", () => {
      const node: XmlNode = {
        "m:naryPr": {
          "m:chr": { "@_m:val": "\u222B" },
        },
        "m:sub": { "m:r": [{ "m:t": [{ "#text": "0" }] }] },
        "m:sup": { "m:r": [{ "m:t": [{ "#text": "1" }] }] },
        "m:e": { "m:r": [{ "m:t": [{ "#text": "f(x)dx" }] }] },
      };
      const wrapper: XmlNode = { "m:nary": [node] };
      const result = ommlToLatex(wrapper, ctx());
      expect(result).toContain("\\int");
      expect(result).toContain("_{0}");
      expect(result).toContain("^{1}");
    });
  });

  describe("m:acc (accents)", () => {
    it("converts hat accent", () => {
      const node: XmlNode = {
        "m:accPr": { "m:chr": { "@_m:val": "\u0302" } },
        "m:e": { "m:r": [{ "m:t": [{ "#text": "x" }] }] },
      };
      const wrapper: XmlNode = { "m:acc": [node] };
      const result = ommlToLatex(wrapper, ctx());
      expect(result).toContain("\\hat{x}");
    });

    it("converts vec accent", () => {
      const node: XmlNode = {
        "m:accPr": { "m:chr": { "@_m:val": "\u20D7" } },
        "m:e": { "m:r": [{ "m:t": [{ "#text": "v" }] }] },
      };
      const wrapper: XmlNode = { "m:acc": [node] };
      const result = ommlToLatex(wrapper, ctx());
      expect(result).toContain("\\vec{v}");
    });
  });

  describe("m:bar", () => {
    it("converts overline (top bar)", () => {
      const node: XmlNode = {
        "m:barPr": { "m:pos": { "@_m:val": "top" } },
        "m:e": { "m:r": [{ "m:t": [{ "#text": "x" }] }] },
      };
      const wrapper: XmlNode = { "m:bar": [node] };
      const result = ommlToLatex(wrapper, ctx());
      expect(result).toContain("\\overline{x}");
    });

    it("converts underline (bottom bar)", () => {
      const node: XmlNode = {
        "m:barPr": { "m:pos": { "@_m:val": "bot" } },
        "m:e": { "m:r": [{ "m:t": [{ "#text": "x" }] }] },
      };
      const wrapper: XmlNode = { "m:bar": [node] };
      const result = ommlToLatex(wrapper, ctx());
      expect(result).toContain("\\underline{x}");
    });
  });

  describe("m:eqArr (equation array)", () => {
    it("converts an aligned equation array", () => {
      const node: XmlNode = {
        "m:e": [
          { "m:r": [{ "m:t": [{ "#text": "x + y = 5" }] }] },
          { "m:r": [{ "m:t": [{ "#text": "2x - y = 1" }] }] },
        ],
      };
      const wrapper: XmlNode = { "m:eqArr": [node] };
      const result = ommlToLatex(wrapper, ctx());
      expect(result).toContain("\\begin{aligned}");
      expect(result).toContain("\\end{aligned}");
      expect(result).toContain("x + y = 5");
      expect(result).toContain("2x - y = 1");
    });
  });

  describe("m:d (delimiters)", () => {
    it("converts parentheses delimiter", () => {
      const node: XmlNode = {
        "m:dPr": {
          "m:begChr": { "@_m:val": "(" },
          "m:endChr": { "@_m:val": ")" },
        },
        "m:e": [{ "m:r": [{ "m:t": [{ "#text": "x+1" }] }] }],
      };
      const wrapper: XmlNode = { "m:d": [node] };
      const result = ommlToLatex(wrapper, ctx());
      expect(result).toContain("\\left(");
      expect(result).toContain("\\right)");
      expect(result).toContain("x+1");
    });
  });

  describe("m:borderBox", () => {
    it("wraps in boxed", () => {
      const node: XmlNode = {
        "m:e": { "m:r": [{ "m:t": [{ "#text": "E=mc^2" }] }] },
      };
      const wrapper: XmlNode = { "m:borderBox": [node] };
      const result = ommlToLatex(wrapper, ctx());
      expect(result).toContain("\\boxed{E=mc^2}");
    });
  });

  describe("m:m (matrix)", () => {
    it("converts a 2x2 matrix", () => {
      const node: XmlNode = {
        "m:mr": [
          {
            "m:e": [
              { "m:r": [{ "m:t": [{ "#text": "a" }] }] },
              { "m:r": [{ "m:t": [{ "#text": "b" }] }] },
            ],
          },
          {
            "m:e": [
              { "m:r": [{ "m:t": [{ "#text": "c" }] }] },
              { "m:r": [{ "m:t": [{ "#text": "d" }] }] },
            ],
          },
        ],
      };
      const wrapper: XmlNode = { "m:m": [node] };
      const result = ommlToLatex(wrapper, ctx());
      expect(result).toContain("\\begin{matrix}");
      expect(result).toContain("a & b");
      expect(result).toContain("c & d");
      expect(result).toContain("\\end{matrix}");
    });
  });

  describe("m:sPre (pre-scripts)", () => {
    it("converts pre-subscript and pre-superscript", () => {
      const node: XmlNode = {
        "m:sub": { "m:r": [{ "m:t": [{ "#text": "6" }] }] },
        "m:sup": { "m:r": [{ "m:t": [{ "#text": "14" }] }] },
        "m:e": { "m:r": [{ "m:t": [{ "#text": "C" }] }] },
      };
      const wrapper: XmlNode = { "m:sPre": [node] };
      const result = ommlToLatex(wrapper, ctx());
      expect(result).toContain("{}");
      expect(result).toContain("_{6}");
      expect(result).toContain("^{14}");
      expect(result).toContain("C");
    });
  });

  describe("symbol mapping", () => {
    it("maps Greek letters in runs", () => {
      const node: XmlNode = {
        "m:r": [{ "m:t": [{ "#text": "\u03B1" }] }],
      };
      const result = ommlToLatex(node, ctx());
      expect(result).toBe("\\alpha");
    });

    it("maps operators in runs", () => {
      const node: XmlNode = {
        "m:r": [{ "m:t": [{ "#text": "\u00D7" }] }],
      };
      const result = ommlToLatex(node, ctx());
      expect(result).toBe("\\times");
    });

    it("maps arrows in runs", () => {
      const node: XmlNode = {
        "m:r": [{ "m:t": [{ "#text": "\u2192" }] }],
      };
      const result = ommlToLatex(node, ctx());
      expect(result).toBe("\\to");
    });
  });

  describe("recursion guard", () => {
    it("emits warning and returns ldots on deep recursion", () => {
      const c = ctx();
      const node: XmlNode = {};
      const result = ommlToLatex(node, c, 51);
      expect(result).toBe("\\ldots");
      expect(c.warnings).toHaveLength(1);
      expect(c.warnings[0]!.type).toBe("recursion_limit");
    });
  });
});
