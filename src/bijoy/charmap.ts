// Bijoy (SutonnyMJ) → Unicode Bengali character mapping
// Sources: standard Bijoy keyboard encoding + open-source converter tables
// Multi-char sequences sorted by key length descending for longest-match-first

export const MULTI_CHAR_MAP: [string, string][] = [
  // 4+ char sequences
  ["\u00AF\u00FA\u00A9\u006B", "\u09B8\u09CD\u09AA\u09B0\u09CD\u09B6"], // ¯ú©k → স্পর্শ
  ["\u00AF\u00FA\u006B\u00A9", "\u09B8\u09CD\u09AA\u09B0\u09CD\u09B6"], // ¯úk© → স্পর্শ
  ["\u201D\u0051\u00A1", "\u099A\u09CD\u099B\u09CD\u09AC"], // "Q¡ → চ্ছ্ব
  ["\u0060\u00AA\u201D", "\u09A6\u09CD\u09B0\u09C1"], // `ª" → দ্রু
  ["\u0161\u2014\u00A1", "\u09A8\u09CD\u09A4\u09CD\u09AC"], // š—¡ → ন্ত্ব
  ["\u00A4\u00A3", "\u09AE\u09CD\u09AD\u09CD\u09B0"], // ¤£ → ম্ভ্র
  ["\u00AF\u0152", "\u09B8\u09CD\u0995\u09CD\u09B0"], // ¯Œ → স্ক্র
  ["\u00AE\u0152", "\u09B7\u09CD\u0995\u09CD\u09B0"], // ®Œ → ষ্ক্র
  ["\u0161\u00BF", "\u09A8\u09CD\u09A4\u09CD\u09B0"], // š¿ → ন্ত্র
  ["\u00AF\u00BF", "\u09B8\u09CD\u09A4\u09CD\u09B0"], // ¯¿ → স্ত্র

  // 3 char sequences
  ["\u2022\u00B6", "\u0999\u09CD\u0995\u09CD\u09B7"], // •¶ → ঙ্ক্ষ
  ["\u2022\u004C", "\u0999\u09CD\u0996"], // •L → ঙ্খ
  ["\u2022\u004E", "\u0999\u09CD\u0998"], // •N → ঙ্ঘ
  ["\u00BE\u00A1", "\u099C\u09CD\u099C\u09CD\u09AC"], // ¾¡ → জ্জ্ব
  ["\u00CB\u00A1", "\u09A4\u09CD\u09A4\u09CD\u09AC"], // Ë¡ → ত্ত্ব
  ["\u203A\u00D8", "\u09A8\u09CD\u09A6\u09CD\u09AC"], // ›Ø → ন্দ্ব
  ["\u0161\u2019", "\u09A8\u09CD\u09A5"], // š' → ন্থ
  ["\u0161\u2018", "\u09A8\u09CD\u09A4\u09C1"], // š' → ন্তু
  ["\u0161\u2014", "\u09A8\u09CD\u09A4"], // š— → ন্ত
  ["\u0161\u00CD", "\u09A8\u09CD\u09A4"], // šÍ → ন্ত
  ["\u0161\u005E", "\u09A8\u09CD\u09AC"], // š^ → ন্ব
  ["\u00AF\u2019", "\u09B8\u09CD\u09A5"], // ¯' → স্থ
  ["\u00AF\u2018", "\u09B8\u09CD\u09A4\u09C1"], // ¯' → স্তু
  ["\u00AF\u2014", "\u09B8\u09CD\u09A4"], // ¯— → স্ত
  ["\u00AF\u00CD", "\u09B8\u09CD\u09A4"], // ¯Í → স্ত
  ["\u00AF\u00FA", "\u09B8\u09CD\u09AA"], // ¯ú → স্প
  ["\u00AF\u005E", "\u09B8\u09CD\u09AC"], // ¯^ → স্ব
  ["\u00AF\u00A7", "\u09B8\u09CD\u09AE"], // ¯§ → স্ম
  ["\u00AF\u00AD", "\u09B8\u09CD\u09B2"], // ¯­ → স্ল
  ["\u00AF\u2039", "\u09B8\u09CD\u0995"], // ¯‹ → স্ক
  ["\u00AE\u2039", "\u09B7\u09CD\u0995"], // ®‹ → ষ্ক
  ["\u00AE\u00FA", "\u09B7\u09CD\u09AA"], // ®ú → ষ্প
  ["\u00AE\u00A7", "\u09B7\u09CD\u09AE"], // ®§ → ষ্ম
  ["\u00A4\u00FA", "\u09AE\u09CD\u09AA"], // ¤ú → ম্প
  ["\u00A4\u005E", "\u09AE\u09CD\u09AC"], // ¤^ → ম্ব
  ["\u00A4\u00A2", "\u09AE\u09CD\u09AD"], // ¤¢ → ম্ভ
  ["\u00A4\u00A7", "\u09AE\u09CD\u09AE"], // ¤§ → ম্ম
  ["\u00A4\u00AD", "\u09AE\u09CD\u09B2"], // ¤­ → ম্ল
  ["\u00AA\u00A8", "\u09CD\u09B0\u09CD\u09AF"], // ª¨ → ্র্য
  ["i\u00A8", "\u09B0\u200C\u09CD\u09AF"], // i¨ → র‌্য

  // 2 char sequences
  ["\u201D\u0050", "\u099A\u09CD\u099A"], // "P → চ্চ
  ["\u201D\u0051", "\u099A\u09CD\u099B"], // "Q → চ্ছ
  ["\u201D\u0054", "\u099A\u09CD\u099E"], // "T → চ্ঞ
  ["K\u00A1", "\u0995\u09CD\u09AC"], // K¡ → ক্ব
  ["K\u00AC", "\u0995\u09CD\u09B2"], // K¬ → ক্ল
  ["M\u0153", "\u0997\u09CD\u09A8"], // Mœ → গ্ন
  ["M\u00A5", "\u0997\u09CD\u09AE"], // M¥ → গ্ম
  ["M\u00AD", "\u0997\u09CD\u09B2"], // M­ → গ্ল
  ["R\u00A1", "\u099C\u09CD\u09AC"], // R¡ → জ্ব
  ["U\u00A1", "\u099F\u09CD\u09AC"], // U¡ → ট্ব
  ["U\u00A5", "\u099F\u09CD\u09AE"], // U¥ → ট্ম
  ["Y\u005E", "\u09A3\u09CD\u09AC"], // Y^ → ণ্ব
  ["Z\u00A5", "\u09A4\u09CD\u09AE"], // Z¥ → ত্ম
  ["Z\u00A1", "\u09A4\u09CD\u09AC"], // Z¡ → ত্ব
  ["_\u00A1", "\u09A5\u09CD\u09AC"], // _¡ → থ্ব
  ["\u02DC\u004D", "\u09A6\u09CD\u0997"], // ˜M → দ্গ
  ["\u02DC\u004E", "\u09A6\u09CD\u0998"], // ˜N → দ্ঘ
  ["\u02DC\u00A1", "\u09A6\u09CD\u09AC"], // ˜¡ → দ্ব
  ["\u2122\u00A2", "\u09A6\u09CD\u09AD"], // ™¢ → দ্ভ
  ["a\u0178", "\u09A7\u09CD\u09AC"], // aŸ → ধ্ব
  ["a\u00A5", "\u09A7\u09CD\u09AE"], // a¥ → ধ্ম
  ["\u203A\u0055", "\u09A8\u09CD\u099F"], // ›U → ন্ট
  ["\u203A\u0060", "\u09A8\u09CD\u09A6"], // ›` → ন্দ
  ["b\u0153", "\u09A8\u09CD\u09A8"], // bœ → ন্ন
  ["b\u00A5", "\u09A8\u09CD\u09AE"], // b¥ → ন্ম
  ["c\u0153", "\u09AA\u09CD\u09A8"], // cœ → প্ন
  ["c\u00F8", "\u09AA\u09CD\u09B2"], // cø → প্ল
  ["c\u00AD", "\u09AA\u09CD\u09B2"], // c­ → প্ল
  ["d\u00AC", "\u09AB\u09CD\u09B2"], // d¬ → ফ্ল
  ["e\u0178", "\u09AC\u09CD\u09AC"], // eŸ → ব্ব
  ["e\u00AD", "\u09AC\u09CD\u09B2"], // e­ → ব্ল
  ["g\u0153", "\u09AE\u09CD\u09A8"], // gœ → ম্ন
  ["i\u201C", "\u09B0\u09C1"], // i" → রু
  ["i\u00E6", "\u09B0\u09C1"], // iæ → রু
  ["i\u0192", "\u09B0\u09C2"], // iƒ → রূ
  ["j\u00A6", "\u09B2\u09CD\u09AC"], // j¦ → ল্ব
  ["j\u00A5", "\u09B2\u09CD\u09AE"], // j¥ → ল্ম
  ["j\u00F8", "\u09B2\u09CD\u09B2"], // jø → ল্ল
  ["k\u0153", "\u09B6\u09CD\u09A8"], // kœ → শ্ন
  ["k\u00F8", "\u09B6\u09CD\u09B2"], // kø → শ্ল
  ["k\u00A6", "\u09B6\u09CD\u09AC"], // k¦ → শ্ব
  ["k\u00A5", "\u09B6\u09CD\u09AE"], // k¥ → শ্ম
  ["k\u00AD", "\u09B6\u09CD\u09B2"], // k­ → শ্ল
  ["m\u0153", "\u09B8\u09CD\u09A8"], // mœ → স্ন
  ["n\u00E8", "\u09B9\u09CD\u09A3"], // nè → হ্ণ
  ["n\u00AC", "\u09B9\u09CD\u09B2"], // n¬ → হ্ল
  ["\u201E\u201E", "\u09C3"], // „„ → ৃ (double ri-kar normalised)
  ["Av", "\u0986"], // Av → আ
];

export const SINGLE_CHAR_MAP: Record<string, string> = {
  // Vowels (Swarabarna)
  A: "\u0985", // অ
  B: "\u0987", // ই
  C: "\u0988", // ঈ
  D: "\u0989", // উ
  E: "\u098A", // ঊ
  F: "\u098B", // ঋ
  G: "\u098F", // এ
  H: "\u0990", // ঐ
  I: "\u0993", // ও
  J: "\u0994", // ঔ

  // Consonants (Banjonbarna)
  K: "\u0995", // ক
  L: "\u0996", // খ
  M: "\u0997", // গ
  N: "\u0998", // ঘ
  O: "\u0999", // ঙ
  P: "\u099A", // চ
  Q: "\u099B", // ছ
  R: "\u099C", // জ
  S: "\u099D", // ঝ
  T: "\u099E", // ঞ
  U: "\u099F", // ট
  V: "\u09A0", // ঠ
  W: "\u09A1", // ড
  X: "\u09A2", // ঢ
  Y: "\u09A3", // ণ
  Z: "\u09A4", // ত
  _: "\u09A5", // থ
  "`": "\u09A6", // দ
  a: "\u09A7", // ধ
  b: "\u09A8", // ন
  c: "\u09AA", // প
  d: "\u09AB", // ফ
  e: "\u09AC", // ব
  f: "\u09AD", // ভ
  g: "\u09AE", // ম
  h: "\u09AF", // য
  i: "\u09B0", // র
  j: "\u09B2", // ল
  k: "\u09B6", // শ
  l: "\u09B7", // ষ
  m: "\u09B8", // স
  n: "\u09B9", // হ
  o: "\u09DC", // ড়
  p: "\u09DD", // ঢ়
  q: "\u09DF", // য়
  r: "\u09CE", // ৎ

  // Digits
  "0": "\u09E6", // ০
  "1": "\u09E7", // ১
  "2": "\u09E8", // ২
  "3": "\u09E9", // ৩
  "4": "\u09EA", // ৪
  "5": "\u09EB", // ৫
  "6": "\u09EC", // ৬
  "7": "\u09ED", // ৭
  "8": "\u09EE", // ৮
  "9": "\u09EF", // ৯

  // Vowel signs (Kar)
  v: "\u09BE", // া (aa-kar)
  w: "\u09BF", // ি (i-kar, pre-kar)
  x: "\u09C0", // ী (ii-kar)
  y: "\u09C1", // ু (u-kar)
  z: "\u09C1", // ু (u-kar, alternate)
  "~": "\u09C2", // ূ (uu-kar)
  "\u201E": "\u09C3", // „ → ৃ (ri-kar)
  "\u2026": "\u09C3", // … → ৃ (ri-kar, alternate)
  "\u2021": "\u09C7", // ‡ → ে (e-kar, pre-kar)
  "\u2020": "\u09C7", // † → ে (e-kar, pre-kar, alternate)
  "\u2030": "\u09C8", // ‰ → ৈ (ai-kar, pre-kar)
  "\u02C6": "\u09C8", // ˆ → ৈ (ai-kar, alternate)
  "\u0160": "\u09D7", // Š → ৗ (au-length mark)

  // Special signs
  s: "\u0982", // ং (anusvara)
  t: "\u0983", // ঃ (visarga)
  u: "\u0981", // ঁ (chandrabindu)

  // Conjunct triggers
  "\u00AA": "\u09CD\u09B0", // ª → ্র (ra-phala)
  "\u00D6": "\u09CD\u09B0", // Ö → ্র (ra-phala, alternate)
  "\u00AB": "\u09CD\u09B0", // « → ্র (ra-phala, alternate)
  "\u00A8": "\u09CD\u09AF", // ¨ → ্য (ya-phala)
  "&": "\u09CD", // & → ্ (hasanta/virama)

  // Reph
  "\u00A9": "\u09B0\u09CD", // © → র্ (reph)

  // Punctuation
  "|": "\u0964", // | → । (dari/purna biram)

  // Quotation marks (preserve as Unicode equivalents)
  "\u00D4": "\u2018", // Ô → ' (left single quote)
  "\u00D5": "\u2019", // Õ → ' (right single quote)
  "\u00D2": "\u201C", // Ò → " (left double quote)
  "\u00D3": "\u201D", // Ó → " (right double quote)

  // Single-char conjuncts (extended ASCII range)
  "\u00B0": "\u0995\u09CD\u0995", // ° → ক্ক
  "\u00B1": "\u0995\u09CD\u099F", // ± → ক্ট
  "\u00B3": "\u0995\u09CD\u09A4", // ³ → ক্ত
  "\u00B5": "\u0995\u09CD\u09B0", // µ → ক্র
  "\u00B6": "\u0995\u09CD\u09B7", // ¶ → ক্ষ
  "\u00FF": "\u0995\u09CD\u09B7", // ÿ → ক্ষ (alternate)
  "\u00B7": "\u0995\u09CD\u09B8", // · → ক্স
  "\u00B8": "\u0997\u09C1", // ¸ → গু
  "\u00BB": "\u0997\u09CD\u09A7", // » → গ্ধ
  "\u00BC": "\u0999\u09CD\u0995", // ¼ → ঙ্ক
  "\u00BD": "\u0999\u09CD\u0997", // ½ → ঙ্গ
  "\u00BE": "\u099C\u09CD\u099C", // ¾ → জ্জ
  "\u00C0": "\u099C\u09CD\u099D", // À → জ্ঝ
  "\u00C1": "\u099C\u09CD\u099E", // Á → জ্ঞ
  "\u00C2": "\u099E\u09CD\u099A", // Â → ঞ্চ
  "\u00C3": "\u099E\u09CD\u099B", // Ã → ঞ্ছ
  "\u00C4": "\u099E\u09CD\u099C", // Ä → ঞ্জ
  "\u00C5": "\u099E\u09CD\u099D", // Å → ঞ্ঝ
  "\u00C6": "\u099F\u09CD\u099F", // Æ → ট্ট
  "\u00C7": "\u09A1\u09CD\u09A1", // Ç → ড্ড
  "\u00C8": "\u09A3\u09CD\u099F", // È → ণ্ট
  "\u00C9": "\u09A3\u09CD\u09A0", // É → ণ্ঠ
  "\u00CA": "\u09A3\u09CD\u09A1", // Ê → ণ্ড
  "\u00CB": "\u09A4\u09CD\u09A4", // Ë → ত্ত
  "\u00CC": "\u09A4\u09CD\u09A5", // Ì → ত্থ
  "\u00CE": "\u09A4\u09CD\u09B0", // Î → ত্র
  "\u00CF": "\u09A6\u09CD\u09A6", // Ï → দ্দ
  "\u00D0": "-", // Ð → - (dash/hyphen)
  "\u00D1": "-", // Ñ → - (dash/hyphen)
  "\u00D7": "\u09A6\u09CD\u09A7", // × → দ্ধ
  "\u00D8": "\u09A6\u09CD\u09AC", // Ø → দ্ব
  "\u00D9": "\u09A6\u09CD\u09AE", // Ù → দ্ম
  "\u00DB": "\u09A8\u09CD\u09A1", // Û → ন্ড
  "\u00DC": "\u09A8\u09CD\u09A7", // Ü → ন্ধ
  "\u00DD": "\u09A8\u09CD\u09B8", // Ý → ন্স
  "\u00DE": "\u09AA\u09CD\u099F", // Þ → প্ট
  "\u00DF": "\u09AA\u09CD\u09A4", // ß → প্ত
  "\u00E0": "\u09AA\u09CD\u09AA", // à → প্প
  "\u00E1": "\u09AA\u09CD\u09B8", // á → প্স
  "\u00E2": "\u09AC\u09CD\u099C", // â → ব্জ
  "\u00E3": "\u09AC\u09CD\u09A6", // ã → ব্দ
  "\u00E4": "\u09AC\u09CD\u09A7", // ä → ব্ধ
  "\u00E5": "\u09AD\u09CD\u09B0", // å → ভ্র
  "\u00E7": "\u09AE\u09CD\u09AB", // ç → ম্ফ
  "\u00E9": "\u09B2\u09CD\u0995", // é → ল্ক
  "\u00EA": "\u09B2\u09CD\u0997", // ê → ল্গ
  "\u00EB": "\u09B2\u09CD\u099F", // ë → ল্ট
  "\u00EC": "\u09B2\u09CD\u09A1", // ì → ল্ড
  "\u00ED": "\u09B2\u09CD\u09AA", // í → ল্প
  "\u00EE": "\u09B2\u09CD\u09AB", // î → ল্ফ
  "\u00EF": "\u09B6\u09C1", // ï → শু
  "\u00F0": "\u09B6\u09CD\u099A", // ð → শ্চ
  "\u00F2": "\u09B7\u09CD\u09A3", // ò → ষ্ণ
  "\u00F3": "\u09B7\u09CD\u099F", // ó → ষ্ট
  "\u00F4": "\u09B7\u09CD\u09A0", // ô → ষ্ঠ
  "\u00F5": "\u09B7\u09CD\u09AB", // õ → ষ্ফ
  "\u00F6": "\u09B8\u09CD\u0996", // ö → স্খ
  "\u00F7": "\u09B8\u09CD\u099F", // ÷ → স্ট
  "\u00F9": "\u09B8\u09CD\u09AB", // ù → স্ফ
  "\u00FB": "\u09B9\u09C1", // û → হু
  "\u00FC": "\u09B9\u09C3", // ü → হৃ
  "\u00FD": "\u09B9\u09CD\u09A8", // ý → হ্ন
  "\u00FE": "\u09B9\u09CD\u09AE", // þ → হ্ম

  // Windows-1252 chars used in multi-char conjuncts as standalone fallbacks
  "\u2022": "\u0999\u09CD", // • → ঙ্ (standalone; •¶/•L/•N handled in multi-char)

  // ASCII characters with Bengali meanings in Bijoy encoding
  '"': "\u09C1", // " (U+0022) → ু (u-kar variant)
  "^": "\u09CD\u09AC", // ^ → ্ব (ba-phala)

  // Conjunct prefix/suffix fallbacks (Latin-1 Supplement range)
  // These fire when the character appears without a recognised preceding consonant
  "\u00A1": "\u09CD\u09AC", // ¡ → ্ব
  "\u00A2": "\u09CD\u09AD", // ¢ → ্ভ
  "\u00A3": "\u09CD\u09AD\u09CD\u09B0", // £ → ্ভ্র
  "\u00A4": "\u09AE\u09CD", // ¤ → ম্
  "\u00A5": "\u09CD\u09AE", // ¥ → ্ম
  "\u00A6": "\u09CD\u09AC", // ¦ → ্ব
  "\u00A7": "\u09CD\u09AE", // § → ্ম
  "\u00AC": "\u09CD\u09B2", // ¬ → ্ল
  "\u00AD": "\u09CD\u09B2", // ­ → ্ল (soft-hyphen used as ্ল in Bijoy)
  "\u00AE": "\u09B7\u09CD", // ® → ষ্
  "\u00AF": "\u09B8\u09CD", // ¯ → স্
  "\u00B2": "\u0995\u09CD\u09B7\u09CD\u09A3", // ² → ক্ষ্ণ
  "\u00B4": "\u0995\u09CD\u09AE", // ´ → ক্ম
  "\u00B9": "\u099C\u09CD\u099E", // ¹ → জ্ঞ
  "\u00BA": "\u0997\u09CD\u09A6", // º → গ্দ
  "\u00BF": "\u09CD\u09A4\u09CD\u09B0", // ¿ → ্ত্র
  "\u00CD": "\u09A4\u09CD\u09AE", // Í → ত্ম
  "\u00DA": "\u09A8\u09CD\u09A0", // Ú → ন্ঠ
  "\u00E6": "\u09AE\u09CD\u09A8", // æ → ম্ন (standalone; iæ → রু handled in multi-char)
  "\u00E8": "\u09CD\u09A8", // è → ্ন (standalone; nè handled in multi-char)
  "\u00F1": "\u09B6\u09CD\u099B", // ñ → শ্ছ
  "\u00F8": "\u09B8\u09CD\u09A8", // ø → স্ন (standalone; cø/jø/kø handled in multi-char)
  "\u00FA": "\u09CD\u09AA", // ú → ্প (standalone; ¯ú/®ú/¤ú handled in multi-char)

  // Latin Extended-A / B fallbacks
  "\u0152": "\u09CD\u0995\u09CD\u09B0", // Œ → ্ক্র (standalone; ¯Œ/®Œ handled in multi-char)
  "\u0153": "\u09CD\u09A8", // œ → ্ন (standalone; bœ/gœ/kœ/mœ handled in multi-char)
  "\u0161": "\u09A8\u09CD", // š → ন্ (standalone; many compounds in multi-char)
  "\u0178": "\u09CD\u09AC", // Ÿ → ্ব (standalone; aŸ/eŸ handled in multi-char)
  "\u0192": "\u09C2", // ƒ → ূ (standalone; iƒ → রূ handled in multi-char)

  // Spacing Modifier / General Punctuation fallbacks
  "\u02DC": "\u09A6\u09CD", // ˜ → দ্ (standalone; ˜M/˜N handled in multi-char)
  "\u201A": "\u09C2", // ‚ → ূ (u-kar variant)
  "\u201C": "\u09C1", // " → ু (u-kar; i" → রু handled in multi-char)
  "\u201D": "\u099A\u09CD", // " → চ্ (standalone; "P/"Q/"T handled in multi-char)
  "\u2013": "\u09C1", // – → ু (u-kar variant)
  "\u2014": "\u09CD\u09A4", // — → ্ত (standalone; š—/¯— etc. handled in multi-char)
  "\u2018": "\u09CD\u09A4\u09C1", // ' → ্তু (standalone; š' etc. handled in multi-char)
  "\u2019": "\u09CD\u09A5", // ' → ্থ (standalone; š' etc. handled in multi-char)
  "\u2039": "\u09CD\u0995", // ‹ → ্ক (standalone; ¯‹/®‹ etc. handled in multi-char)
  "\u203A": "\u09A8\u09CD", // › → ন্ (standalone; ›U/›` etc. handled in multi-char)
  "\u2122": "\u09A6\u09CD", // ™ → দ্ (standalone; ™¢ handled in multi-char)
};
