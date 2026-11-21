// ANSI (Bijoy-encoded) fonts. Unicode Bangla fonts such as Nikosh, Siyam Rupali,
// Rupali, AdorshoLipi, Charukola and Mukti store real Bangla code points and
// must never go through the Bijoy converter.
const BIJOY_EXACT = new Set([
  "SutonnyMJ",
  "SutonnyOMJ",
  "SutonnyMJBold",
  "SutonnyOMJBold",
  "BijoyBaijayanta",
  "BijoyBaijayantaMJ",
  "Bijoy",
  "BijoyMJ",
  "BanglaBijoy",
]);

const BIJOY_SUBSTRINGS = ["sutonny", "bijoy"];

// Bijoy font families are named "<Name>MJ" (e.g. ChandrabatiMJ, AtraiMJ),
// optionally followed by a style suffix.
const MJ_SUFFIX = /mj(?:bold|italic|bolditalic|regular)?$/;

export function isBijoyFont(fontName: string | null): boolean {
  if (!fontName) return false;
  if (BIJOY_EXACT.has(fontName)) return true;
  const lower = fontName.toLowerCase();
  if (BIJOY_SUBSTRINGS.some((s) => lower.includes(s))) return true;
  return MJ_SUFFIX.test(lower.replace(/[\s_-]/g, ""));
}

const UNICODE_BANGLA = /[ঀ-৿]/;

export function hasUnicodeBangla(text: string): boolean {
  return UNICODE_BANGLA.test(text);
}

// Latin-1 characters Bijoy uses for conjuncts and phala signs. Symbols that
// also appear in ordinary English/maths text (no-break space, °, ±, ², ³, µ,
// ·, ¹, ¼, ½, ¾, ©, ®, soft hyphen, « ») are left out so they alone never
// trigger conversion.
const BIJOY_HEURISTIC =
  /[\u0097\u009C\u009D\u009E\u009F\u00A1-\u00A8\u00AA\u00AC\u00AF\u00B4\u00B6\u00B8\u00BA\u00BF]/;

const BIJOY_VISUAL = /[‡†ƒœ™]/;

export function hasBijoyMarkers(text: string): boolean {
  if (hasUnicodeBangla(text)) return false;
  return BIJOY_HEURISTIC.test(text) || BIJOY_VISUAL.test(text);
}
