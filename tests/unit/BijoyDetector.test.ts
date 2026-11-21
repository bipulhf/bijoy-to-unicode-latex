import { describe, it, expect } from "vitest";
import { isBijoyFont, hasBijoyMarkers } from "../../src/bijoy/BijoyDetector.js";

describe("isBijoyFont", () => {
  it("returns true for exact SutonnyMJ font names", () => {
    expect(isBijoyFont("SutonnyMJ")).toBe(true);
    expect(isBijoyFont("SutonnyOMJ")).toBe(true);
    expect(isBijoyFont("SutonnyMJBold")).toBe(true);
    expect(isBijoyFont("SutonnyOMJBold")).toBe(true);
  });

  it("returns true for other known Bijoy fonts", () => {
    expect(isBijoyFont("BijoyBaijayanta")).toBe(true);
    expect(isBijoyFont("BijoyBaijayantaMJ")).toBe(true);
    expect(isBijoyFont("Bijoy")).toBe(true);
    expect(isBijoyFont("BijoyMJ")).toBe(true);
    expect(isBijoyFont("BanglaBijoy")).toBe(true);
  });

  it("returns true for MJ-suffixed Bijoy families", () => {
    expect(isBijoyFont("ChandrabatiMJ")).toBe(true);
    expect(isBijoyFont("AtraiMJ Bold")).toBe(true);
  });

  it("returns false for Unicode Bangla fonts", () => {
    expect(isBijoyFont("AdorshoLipi")).toBe(false);
    expect(isBijoyFont("Charukola")).toBe(false);
    expect(isBijoyFont("Rupali")).toBe(false);
    expect(isBijoyFont("Siyam Rupali")).toBe(false);
    expect(isBijoyFont("Nikosh")).toBe(false);
    expect(isBijoyFont("NikoshBAN")).toBe(false);
  });

  it("returns true for bold/italic font name variants via substring match", () => {
    expect(isBijoyFont("SutonnyMJ Bold")).toBe(true);
    expect(isBijoyFont("SutonnyMJ Bold Italic")).toBe(true);
    expect(isBijoyFont("SutonnyMJ Italic")).toBe(true);
    expect(isBijoyFont("Bijoy Regular")).toBe(true);
  });

  it("returns false for non-Bijoy fonts", () => {
    expect(isBijoyFont("Times New Roman")).toBe(false);
    expect(isBijoyFont("Arial")).toBe(false);
    expect(isBijoyFont("Calibri")).toBe(false);
    expect(isBijoyFont("Cambria Math")).toBe(false);
    expect(isBijoyFont("Kalpurush")).toBe(false);
    expect(isBijoyFont("Noto Sans Bengali")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isBijoyFont(null)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isBijoyFont("")).toBe(false);
  });
});

describe("hasBijoyMarkers", () => {
  it("detects Bijoy heuristic characters in extended ASCII range", () => {
    expect(hasBijoyMarkers("g¨vwUª")).toBe(true);
  });

  it("ignores symbols common in English and maths text", () => {
    expect(hasBijoyMarkers("30°C")).toBe(false);
    expect(hasBijoyMarkers("5 ± 0.1")).toBe(false);
    expect(hasBijoyMarkers("x² + ½")).toBe(false);
    expect(hasBijoyMarkers("hello\u00A0world")).toBe(false);
  });

  it("detects Bijoy visual marker characters", () => {
    expect(hasBijoyMarkers("†KvbwU")).toBe(true);
    expect(hasBijoyMarkers("‡·")).toBe(true);
    expect(hasBijoyMarkers("™")).toBe(true);
  });

  it("returns false for plain English text", () => {
    expect(hasBijoyMarkers("Hello World")).toBe(false);
    expect(hasBijoyMarkers("x + y = 5")).toBe(false);
  });

  it("returns false for Unicode Bengali text", () => {
    expect(hasBijoyMarkers("বাংলাদেশ")).toBe(false);
    expect(hasBijoyMarkers("কোনটি")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(hasBijoyMarkers("")).toBe(false);
  });
});
