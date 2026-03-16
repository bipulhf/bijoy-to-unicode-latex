import { MULTI_CHAR_MAP, SINGLE_CHAR_MAP } from "./charmap.js";

const BANGLA_CONSONANT = /[\u0995-\u09B9\u09DC-\u09DF\u09CE]/;

const BANGLA_KAR = /[\u09BE-\u09C8\u09CB-\u09CC\u09D7]/;

const BANGLA_PRE_KAR = /[\u09BF\u09C7\u09C8]/;

const BANGLA_HALANT = "\u09CD";

function isBanglaConsonant(ch: string): boolean {
  return BANGLA_CONSONANT.test(ch);
}

function isBanglaKar(ch: string): boolean {
  return BANGLA_KAR.test(ch);
}

function isBanglaPreKar(ch: string): boolean {
  return BANGLA_PRE_KAR.test(ch);
}

function isSpace(ch: string): boolean {
  return ch === " " || ch === "\t" || ch === "\n" || ch === "\r";
}

function applyMultiCharSequences(text: string): string {
  let result = text;
  for (const [bijoy, unicode] of MULTI_CHAR_MAP) {
    let idx = result.indexOf(bijoy);
    while (idx !== -1) {
      result =
        result.slice(0, idx) + unicode + result.slice(idx + bijoy.length);
      idx = result.indexOf(bijoy, idx + unicode.length);
    }
  }
  return result;
}

function applySingleCharMap(text: string): string {
  let result = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    const mapped = SINGLE_CHAR_MAP[ch];
    result += mapped ?? ch;
  }
  return result;
}

function rearrangeUnicode(str: string): string {
  const chars = [...str];
  let result = chars.join("");

  for (let i = 0; i < result.length; i++) {
    // Hasanta reordering: if hasanta follows a vowel sign, move consonant cluster before the vowel sign
    if (
      i > 0 &&
      result[i] === BANGLA_HALANT &&
      (isBanglaKar(result[i - 1]!) || isBanglaNukta(result[i - 1]!)) &&
      i < result.length - 1
    ) {
      result =
        result.substring(0, i - 1) +
        result[i]! +
        result[i + 1]! +
        result[i - 1]! +
        result.substring(i + 2);
    }

    // Reph handling: র্ + vowel sign → move reph before consonant cluster
    if (
      i > 0 &&
      i < result.length - 1 &&
      result[i] === BANGLA_HALANT &&
      result[i - 1] === "\u09B0" &&
      (i < 2 || result[i - 2] !== BANGLA_HALANT) &&
      isBanglaKar(result[i + 1]!)
    ) {
      result =
        result.substring(0, i - 1) +
        result[i + 1]! +
        result[i - 1]! +
        result[i]! +
        result.substring(i + 2);
    }

    // Reph movement: র্ before consonant cluster
    // Only move reph if it is NOT already directly followed by a consonant
    // (when © is typed before the consonant in Bijoy, র্ is already in correct Unicode order)
    if (
      i < result.length - 1 &&
      result[i] === "\u09B0" &&
      result[i + 1] === BANGLA_HALANT &&
      (i === 0 || result[i - 1] !== BANGLA_HALANT) &&
      (i + 2 >= result.length || !isBanglaConsonant(result[i + 2]!))
    ) {
      let j = 1;
      while (true) {
        if (i - j < 0) break;
        if (
          isBanglaConsonant(result[i - j]!) &&
          i - j - 1 >= 0 &&
          result[i - j - 1] === BANGLA_HALANT
        ) {
          j += 2;
        } else if (j === 1 && isBanglaKar(result[i - j]!)) {
          j++;
        } else {
          break;
        }
      }

      // Don't move reph over a multi-consonant conjunct when at end of string:
      // it likely belongs to the next run (cross-run split scenario)
      if (j > 0 && i - j >= 0 && !(i + 2 >= result.length && j > 1)) {
        result =
          result.substring(0, i - j) +
          result[i]! +
          result[i + 1]! +
          result.substring(i - j, i) +
          result.substring(i + 2);
        i += 1;
        continue;
      }
    }

    // Pre-kar reordering: ে, ি, ৈ appear before consonant cluster
    if (
      i < result.length - 1 &&
      isBanglaPreKar(result[i]!) &&
      !isSpace(result[i + 1]!)
    ) {
      let j = 1;
      while (i + j < result.length && isBanglaConsonant(result[i + j]!)) {
        if (i + j + 1 < result.length && result[i + j + 1] === BANGLA_HALANT) {
          j += 2;
        } else {
          break;
        }
      }

      if (j > 0) {
        const preKar = result[i]!;
        const consonantCluster = result.substring(i + 1, i + j + 1);
        let combined: string;

        // ে + া → ো
        if (
          preKar === "\u09C7" &&
          i + j + 1 < result.length &&
          result[i + j + 1] === "\u09BE"
        ) {
          combined =
            result.substring(0, i) +
            consonantCluster +
            "\u09CB" +
            result.substring(i + j + 2);
        }
        // ে + ৗ → ৌ
        else if (
          preKar === "\u09C7" &&
          i + j + 1 < result.length &&
          result[i + j + 1] === "\u09D7"
        ) {
          combined =
            result.substring(0, i) +
            consonantCluster +
            "\u09CC" +
            result.substring(i + j + 2);
        } else {
          combined =
            result.substring(0, i) +
            consonantCluster +
            preKar +
            result.substring(i + j + 1);
        }

        result = combined;
        i += j;
      }
    }

    // অ + vowel sign → use the full vowel letter form
    if (
      i < result.length - 1 &&
      result[i] === "\u0985" &&
      isBanglaPostKar(result[i + 1]!)
    ) {
      const vowel = mapKarToSwarabarna(result[i + 1]!);
      if (vowel) {
        result = result.substring(0, i) + vowel + result.substring(i + 2);
      }
    }
  }

  return result;
}

function isBanglaNukta(ch: string): boolean {
  return ch === "\u0982" || ch === "\u0983" || ch === "\u0981";
}

function isBanglaPostKar(ch: string): boolean {
  return (
    ch === "\u09BE" || // া
    ch === "\u09CB" || // ো
    ch === "\u09CC" || // ৌ
    ch === "\u09D7" || // ৗ
    ch === "\u09C1" || // ু
    ch === "\u09C2" || // ূ
    ch === "\u09C0" || // ী
    ch === "\u09C3" // ৃ
  );
}

function mapKarToSwarabarna(kar: string): string | null {
  switch (kar) {
    case "\u09BE":
      return "\u0986"; // া → আ
    case "\u09BF":
      return "\u0987"; // ি → ই
    case "\u09C0":
      return "\u0988"; // ী → ঈ
    case "\u09C1":
      return "\u0989"; // ু → উ
    case "\u09C2":
      return "\u098A"; // ূ → ঊ
    case "\u09C3":
      return "\u098B"; // ৃ → ঋ
    case "\u09C7":
      return "\u098F"; // ে → এ
    case "\u09C8":
      return "\u0990"; // ৈ → ঐ
    case "\u09CB":
      return "\u0993"; // ো → ও
    case "\u09CC":
      return "\u0994"; // ৌ → ঔ
    default:
      return null;
  }
}

function cleanupText(text: string): string {
  // অ + া → আ
  let result = text.replace(/\u0985\u09BE/g, "\u0986");
  // Remove orphan hasanta at word boundaries, but NOT রেফ (র্) which may belong to the next run
  result = result.replace(/(?<!\u09B0)\u09CD(?=\s|$)/g, "");
  // Remove duplicate ZWNJ
  result = result.replace(/\u200C{2,}/g, "\u200C");
  return result.normalize("NFC");
}

export { isBanglaConsonant, isBanglaPreKar, BANGLA_HALANT };

export function convertBijoyToUnicode(text: string): string {
  let result = applyMultiCharSequences(text);
  result = applySingleCharMap(result);
  result = rearrangeUnicode(result);
  result = cleanupText(result);
  return result;
}
