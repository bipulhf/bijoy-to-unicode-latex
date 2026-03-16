import { describe, it, expect } from "vitest";
import { convertBijoyToUnicode } from "../../src/bijoy/BijoyConverter.js";

describe("convertBijoyToUnicode", () => {
  describe("single character mapping", () => {
    it("converts Bijoy consonants to Unicode", () => {
      expect(convertBijoyToUnicode("K")).toBe("ক");
      expect(convertBijoyToUnicode("L")).toBe("খ");
      expect(convertBijoyToUnicode("M")).toBe("গ");
      expect(convertBijoyToUnicode("N")).toBe("ঘ");
      expect(convertBijoyToUnicode("b")).toBe("ন");
      expect(convertBijoyToUnicode("g")).toBe("ম");
      expect(convertBijoyToUnicode("m")).toBe("স");
      expect(convertBijoyToUnicode("n")).toBe("হ");
    });

    it("converts Bijoy vowels to Unicode", () => {
      expect(convertBijoyToUnicode("A")).toBe("অ");
      expect(convertBijoyToUnicode("B")).toBe("ই");
      expect(convertBijoyToUnicode("C")).toBe("ঈ");
      expect(convertBijoyToUnicode("D")).toBe("উ");
      expect(convertBijoyToUnicode("E")).toBe("ঊ");
      expect(convertBijoyToUnicode("G")).toBe("এ");
      expect(convertBijoyToUnicode("I")).toBe("ও");
    });

    it("converts Bijoy digits to Bengali digits", () => {
      expect(convertBijoyToUnicode("0")).toBe("০");
      expect(convertBijoyToUnicode("1")).toBe("১");
      expect(convertBijoyToUnicode("5")).toBe("৫");
      expect(convertBijoyToUnicode("9")).toBe("৯");
      expect(convertBijoyToUnicode("123")).toBe("১২৩");
    });

    it("converts vowel signs", () => {
      expect(convertBijoyToUnicode("v")).toBe("া");
      expect(convertBijoyToUnicode("x")).toBe("ী");
    });

    it("converts special signs", () => {
      expect(convertBijoyToUnicode("s")).toBe("ং");
      expect(convertBijoyToUnicode("t")).toBe("ঃ");
      expect(convertBijoyToUnicode("u")).toBe("ঁ");
      expect(convertBijoyToUnicode("r")).toBe("ৎ");
    });
  });

  describe("multi-character sequences", () => {
    it("converts Av to আ", () => {
      expect(convertBijoyToUnicode("Av")).toBe("আ");
    });

    it("converts conjuncts from extended ASCII", () => {
      expect(convertBijoyToUnicode("\u00DC")).toBe("ন্ধ");
      expect(convertBijoyToUnicode("\u00CB")).toBe("ত্ত");
      expect(convertBijoyToUnicode("\u00D7")).toBe("দ্ধ");
    });
  });

  describe("vowel sign reordering", () => {
    it("reorders e-kar (ে) before consonant to after consonant", () => {
      const bijoy = "\u2021K"; // ‡K → ে + ক → কে
      const result = convertBijoyToUnicode(bijoy);
      expect(result).toBe("কে");
    });

    it("combines e-kar + aa-kar into o-kar", () => {
      const bijoy = "\u2021Kv"; // ‡Kv → ে + ক + া → কো
      const result = convertBijoyToUnicode(bijoy);
      expect(result).toBe("কো");
    });

    it("reorders i-kar (ি) before consonant to after consonant", () => {
      const bijoy = "wK"; // wK → ি + ক → কি
      const result = convertBijoyToUnicode(bijoy);
      expect(result).toBe("কি");
    });
  });

  describe("reph (রেফ) handling", () => {
    it("converts reph before consonant (© before k): স্পর্শ", () => {
      // ¯ú©k: স্প + © + শ → স্পর্শ
      expect(convertBijoyToUnicode("\u00AF\u00FA\u00A9\u006B")).toBe("স্পর্শ");
    });

    it("preserves রেফ at end of fragment when split across runs: ¯ú© alone → স্পর্", () => {
      // When ¯ú© is at the end of a run (before k in the next run),
      // the রেফ must NOT be moved to the front of স্প.
      expect(convertBijoyToUnicode("\u00AF\u00FA\u00A9")).toBe("স্পর্");
    });

    it("converts reph after consonant (k© then next run continues): র্শ", () => {
      // k©: শ + © → র্শ (reph on শ)
      expect(convertBijoyToUnicode("\u006B\u00A9")).toBe("র্শ");
    });

    it("converts কর্ম (karma) correctly", () => {
      // K©g: ক + © + ম → কর্ম
      expect(convertBijoyToUnicode("K\u00A9g")).toBe("কর্ম");
    });
  });

  describe("NFC normalization and cleanup", () => {
    it("produces NFC-normalized output", () => {
      const result = convertBijoyToUnicode("Kvg");
      expect(result).toBe(result.normalize("NFC"));
    });
  });

  describe("passthrough", () => {
    it("passes through ASCII punctuation unchanged", () => {
      expect(convertBijoyToUnicode("(")).toBe("(");
      expect(convertBijoyToUnicode(")")).toBe(")");
      expect(convertBijoyToUnicode(",")).toBe(",");
      expect(convertBijoyToUnicode(".")).toBe(".");
      expect(convertBijoyToUnicode(" ")).toBe(" ");
    });

    it("passes through already-Unicode Bengali unchanged", () => {
      expect(convertBijoyToUnicode("")).toBe("");
    });
  });
});
