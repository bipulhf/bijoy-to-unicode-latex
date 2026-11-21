import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { convertBuffer } from "../../src/index.js";
import type { ConvertOptions } from "../../src/types.js";

const NS =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
  'xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"';

async function makeDocx(
  body: string,
  parts: { styles?: string; numbering?: string } = {},
): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8"?><w:document ${NS}><w:body>${body}</w:body></w:document>`,
  );
  if (parts.styles) {
    zip.file("word/styles.xml", `<w:styles ${NS}>${parts.styles}</w:styles>`);
  }
  if (parts.numbering) {
    zip.file(
      "word/numbering.xml",
      `<w:numbering ${NS}>${parts.numbering}</w:numbering>`,
    );
  }
  return zip.generateAsync({ type: "nodebuffer" });
}

async function convert(
  body: string,
  parts: { styles?: string; numbering?: string } = {},
  options: ConvertOptions = {},
) {
  return convertBuffer(await makeDocx(body, parts), options);
}

const run = (text: string, font?: string) =>
  `<w:r>${font ? `<w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}"/></w:rPr>` : ""}<w:t xml:space="preserve">${text}</w:t></w:r>`;
const para = (...runs: string[]) => `<w:p>${runs.join("")}</w:p>`;
const math = (text: string) => `<m:oMath><m:r><m:t>${text}</m:t></m:r></m:oMath>`;

describe("document pipeline", () => {
  describe("Bijoy detection", () => {
    it("leaves Unicode Bangla in a Unicode font untouched", async () => {
      const r = await convert(para(run("1. কিন্তু বাংলা লেখা", "Nikosh")));
      expect(r.questions[0]!.question).toBe("কিন্তু বাংলা লেখা");
      expect(r.stats.bijoyRunsConverted).toBe(0);
    });

    it("does not convert English text with ° or ± in a run without a font", async () => {
      const r = await convert(para(run("1. Water boils at 100°C ± 1")));
      expect(r.questions[0]!.question).toBe("Water boils at 100°C ± 1");
    });

    it("uses the Bijoy font inherited from the default paragraph style", async () => {
      const styles =
        '<w:style w:type="paragraph" w:default="1" w:styleId="Normal">' +
        '<w:rPr><w:rFonts w:ascii="SutonnyMJ" w:hAnsi="SutonnyMJ"/></w:rPr></w:style>';
      const r = await convert(para(run("1. Avwg")), { styles });
      expect(r.questions[0]!.question).toBe("আমি");
    });

    it("joins a reph typed in the next run onto the previous run's conjunct", async () => {
      const r = await convert(
        para(run("1. ", "Arial"), run("EaŸ", "SutonnyMJ"), run("©", "SutonnyMJ")),
      );
      expect(r.questions[0]!.question).toBe("ঊর্ধ্ব".normalize("NFC"));
    });

    it("leaves a reph alone when the run split falls before its consonant", async () => {
      const r = await convert(
        para(run("1. ", "Arial"), run("e", "SutonnyMJ"), run("M©", "SutonnyMJ")) +
          para(run("2. ", "Arial"), run("Kxw", "SutonnyMJ"), run("Z©", "SutonnyMJ")),
      );
      expect(r.questions.map((q) => q.question)).toEqual(["বর্গ", "কীর্তি"]);
    });

    it("joins e-kar and aa-kar split across runs into o-kar", async () => {
      const r = await convert(
        para(run("1. ", "Arial"), run("‡K", "SutonnyMJ"), run("vb", "SutonnyMJ")),
      );
      expect(r.questions[0]!.question).toBe("কোন");
    });

    it("ignores a complex-script font when resolving a run's font", async () => {
      const styles =
        '<w:style w:type="paragraph" w:default="1" w:styleId="Normal">' +
        '<w:rPr><w:rFonts w:ascii="SutonnyMJ" w:hAnsi="SutonnyMJ"/></w:rPr></w:style>';
      const r = await convert(
        para('<w:r><w:rPr><w:rFonts w:cs="Arial"/></w:rPr><w:t>1. Avwg</w:t></w:r>'),
        { styles },
      );
      expect(r.questions[0]!.question).toBe("আমি");
    });

    it("moves a pre-kar left dangling at the end of a run", async () => {
      const r = await convert(
        para(run("1. ", "Arial"), run("hw", "SutonnyMJ"), run("`", "SutonnyMJ")),
      );
      expect(r.questions[0]!.question).toBe("যদি");
    });
  });

  describe("inline content", () => {
    it("keeps run text and equations in document order inside table cells", async () => {
      const cell = (inner: string) => `<w:tc>${inner}</w:tc>`;
      const r = await convert(
        para(run("1. Pick one")) +
          "<w:tbl><w:tr>" +
          cell(para(run("(A) x = "), math("5"), run(" cm"))) +
          cell(para(run("(B) y"))) +
          "</w:tr></w:tbl>",
      );
      expect(r.questions[0]!.options).toEqual(["x = 5 cm", "y"]);
    });

    it("reads text inside hyperlinks and inline content controls", async () => {
      const r = await convert(
        para(
          run("1. See "),
          `<w:hyperlink>${run("the link")}</w:hyperlink>`,
          `<w:sdt><w:sdtContent>${run(" and more")}${run(" text")}</w:sdtContent></w:sdt>`,
        ),
      );
      expect(r.questions[0]!.question).toBe("See the link and more text");
    });

    it("turns tabs into spaces and line breaks into newlines", async () => {
      const r = await convert(
        para(
          '<w:r><w:t>1. one</w:t><w:tab/><w:t>two</w:t><w:br/><w:t>three</w:t></w:r>',
        ),
      );
      expect(r.questions[0]!.question).toBe("one two\nthree");
    });

    it("reports OLE objects such as MathType equations", async () => {
      const r = await convert(
        para(run("1. Solve "), '<w:r><w:object><v:shape/></w:object></w:r>'),
      );
      expect(r.questions[0]!.question).toBe("Solve [image]");
      expect(r.stats.warnings.map((w) => w.type)).toContain("ole_equation");
    });

    it("separates an equation's trailing command from following text", async () => {
      const r = await convert(para(run("1. p"), math("×"), run("q")));
      expect(r.questions[0]!.question).toBe("p\\times q");
    });
  });

  describe("options next to equations", () => {
    it("finds a marker written right after an equation", async () => {
      const r = await convert(
        para(run("1. Find x. (A) "), math("1"), run("(B) "), math("2"), run("(C) "), math("3")),
      );
      expect(r.questions[0]).toEqual({ question: "Find x.", options: ["1", "2", "3"] });
    });
  });

  describe("equation flags", () => {
    it("wraps equations in $...$ with forceInline", async () => {
      const r = await convert(para(run("1. "), math("x")), {}, { forceInline: true });
      expect(r.questions[0]!.question).toBe("$x$");
    });

    it("wraps equations in \\[...\\] with forceDisplay", async () => {
      const r = await convert(para(run("1. "), math("x")), {}, { forceDisplay: true });
      expect(r.questions[0]!.question).toBe("\\[x\\]");
    });
  });

  describe("Word list numbering", () => {
    const numbering =
      '<w:abstractNum w:abstractNumId="0">' +
      '<w:lvl w:ilvl="0"><w:numFmt w:val="decimal"/></w:lvl>' +
      '<w:lvl w:ilvl="1"><w:numFmt w:val="lowerLetter"/></w:lvl>' +
      "</w:abstractNum>" +
      '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>';
    const listPara = (ilvl: number, text: string) =>
      `<w:p><w:pPr><w:numPr><w:ilvl w:val="${ilvl}"/><w:numId w:val="1"/></w:numPr></w:pPr>${run(text)}</w:p>`;

    it("treats letter-numbered list items as options, not questions", async () => {
      const r = await convert(
        listPara(0, "What is 2 + 2?") + listPara(1, "3") + listPara(1, "4"),
        { numbering },
      );
      expect(r.questions).toEqual([{ question: "What is 2 + 2?", options: ["3", "4"] }]);
    });

    it("keeps a leading number in an auto-numbered question", async () => {
      const r = await convert(listPara(0, "10 g of water is heated"), { numbering });
      expect(r.questions[0]!.question).toBe("10 g of water is heated");
    });

    it("ignores numId 0 (numbering removed)", async () => {
      const r = await convert(
        para(run("1. Question")) +
          `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="0"/></w:numPr></w:pPr>${run("more text")}</w:p>`,
        { numbering },
      );
      expect(r.questions).toEqual([{ question: "Question\nmore text", options: [] }]);
    });
  });

  describe("input validation", () => {
    it("rejects a file that is not a zip", async () => {
      await expect(convertBuffer(Buffer.from("hello"))).rejects.toThrow(
        "not a valid ZIP",
      );
    });
  });
});
