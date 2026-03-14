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
  "AdorshoLipi",
  "Adorsho Lipi",
  "MuktinarrowBT",
  "Rupali",
  "Charukola",
  "Siyam Rupali",
  "Nikosh",
]);

const BIJOY_SUBSTRINGS = ["sutonny", "bijoy", "adorsho", "charukola"];

export function isBijoyFont(fontName: string | null): boolean {
  if (!fontName) return false;
  if (BIJOY_EXACT.has(fontName)) return true;
  const lower = fontName.toLowerCase();
  return BIJOY_SUBSTRINGS.some((s) => lower.includes(s));
}

const BIJOY_HEURISTIC =
  /[\u0097\u009C\u009D\u009E\u009F\u00A0-\u00AF\u00B0-\u00BF]/;

const BIJOY_VISUAL = /[\u2021\u2020\u0192\u0153\u2122]/;

export function hasBijoyMarkers(text: string): boolean {
  return BIJOY_HEURISTIC.test(text) || BIJOY_VISUAL.test(text);
}
