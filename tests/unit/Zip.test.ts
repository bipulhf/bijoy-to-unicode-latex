import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { ZipArchive } from "../../src/reader/zip.js";
import { InvalidDocxError } from "../../src/types.js";

async function makeZip(compression: "STORE" | "DEFLATE"): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("word/document.xml", "<w:document>বাংলা ".repeat(200) + "</w:document>");
  zip.file("নাম.txt", "x");
  return zip.generateAsync({ type: "nodebuffer", compression, comment: "zip comment" });
}

describe("ZipArchive", () => {
  for (const compression of ["STORE", "DEFLATE"] as const) {
    it(`reads ${compression} entries and UTF-8 names`, async () => {
      const zip = ZipArchive.open(await makeZip(compression));
      const text = await zip.readText("word/document.xml", 1 << 20);
      expect(text).toMatch(/^<w:document>বাংলা /);
      expect(await zip.readText("নাম.txt", 10)).toBe("x");
      expect(await zip.readText("missing.xml", 10)).toBeNull();
    });

    it(`stops ${compression} entries larger than the limit`, async () => {
      const zip = ZipArchive.open(await makeZip(compression));
      await expect(zip.readText("word/document.xml", 100)).rejects.toThrow(/too large/);
    });
  }

  it("rejects data that is not a ZIP archive", () => {
    expect(() => ZipArchive.open(Buffer.from("not a zip at all, just some text"))).toThrow(
      InvalidDocxError,
    );
    expect(() => ZipArchive.open(Buffer.alloc(0))).toThrow(/not a valid ZIP/);
  });

  it("rejects a truncated archive", async () => {
    const data = await makeZip("DEFLATE");
    expect(() => ZipArchive.open(data.subarray(0, data.length - 40))).toThrow(InvalidDocxError);
  });
});
