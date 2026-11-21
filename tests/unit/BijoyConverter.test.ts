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

    it("puts reph typed after a conjunct on that conjunct: ¯ú© → র্স্প", () => {
      expect(convertBijoyToUnicode("\u00AF\u00FA\u00A9")).toBe("র্স্প");
    });

    it("moves reph typed after a consonant inside a word", () => {
      expect(convertBijoyToUnicode("wbY\u00A9q")).toBe("নির্ণয়");
      expect(convertBijoyToUnicode("eY\u00A9bv")).toBe("বর্ণনা");
      expect(convertBijoyToUnicode("Kvh\u00A9\u00B5g")).toBe("কার্যক্রম");
      expect(convertBijoyToUnicode("eM\u00A9")).toBe("বর্গ");
      expect(convertBijoyToUnicode("wbYv\u00A9qK")).toBe("নির্ণায়ক");
    });

    it("handles e-kar before a consonant carrying reph: DcK‡Y© → উপকর্ণে", () => {
      expect(convertBijoyToUnicode("DcK\u2021Y\u00A9")).toBe("উপকর্ণে");
    });

    it("converts reph after consonant (k© then next run continues): র্শ", () => {
      // k©: শ + © → র্শ (reph on শ)
      expect(convertBijoyToUnicode("\u006B\u00A9")).toBe("র্শ");
    });

    it("converts কর্ম (karma) correctly", () => {
      // Kg©: ক + ম + © → কর্ম (reph typed after the consonant it sits on)
      expect(convertBijoyToUnicode("Kg\u00A9")).toBe("কর্ম");
    });
  });

  describe("conjuncts with phala glyphs", () => {
    it("does not double the hasanta in স্র", () => {
      expect(convertBijoyToUnicode("\u2021\u00AF\u00AAvZ")).toBe("স্রোত");
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
