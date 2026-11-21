import {
  convertBijoyToUnicode,
  isBanglaConsonant,
  isBanglaPreKar,
  BANGLA_HALANT,
} from "./BijoyConverter.js";

export interface BijoyRun {
  /** Text after conversion; edited in place by fixBijoyRunBoundaries. */
  text: string;
  isBijoy: boolean;
  /** Bijoy source text before conversion. */
  rawText?: string;
}

/**
 * Converts a sequence of Bijoy text pieces that form continuous text (for
 * example the spans of one paragraph) and repairs words split between them.
 */
export function convertBijoyRuns(pieces: readonly string[]): string[] {
  const runs: BijoyRun[] = pieces.map((raw) => ({
    text: convertBijoyToUnicode(raw),
    isBijoy: true,
    rawText: raw,
  }));
  fixBijoyRunBoundaries(runs);
  return runs.map((r) => r.text);
}

// Bijoy glyphs for ি, ে and ৈ, typed before the consonant they follow in Unicode.
const BIJOY_PRE_KAR_GLYPH = /^[w\u2021\u2020\u2030\u02C6]$/;
const BIJOY_REPH = "\u00A9";
const BANGLA_SIGN = /[\u0981-\u0983\u09BE-\u09CC\u09D7]/;

/**
 * Repairs Bangla split across neighbouring runs (Word runs, HTML spans) after
 * each run was converted on its own: a reph (©) typed at the start of a run
 * belongs to the previous run's consonant, a pre-kar typed at the end of a
 * run belongs to the next run's consonant, and ে + া split across runs is ো.
 * Runs are edited in place; `null` entries (equations, images) separate runs.
 */
export function fixBijoyRunBoundaries(
  runs: ReadonlyArray<BijoyRun | null>,
): void {
  for (let i = 0; i < runs.length - 1; i++) {
    const curr = runs[i];
    const next = runs[i + 1];
    if (!curr || !next) continue;
    if (!curr.isBijoy || !next.isBijoy) continue;
    if (!curr.text || !next.text) continue;

    // Bijoy types © (রেফ) after its consonant, so a run whose source starts
    // with © carries the reph of the previous run's last consonant cluster.
    if (
      next.rawText?.startsWith(BIJOY_REPH) &&
      next.text.startsWith("\u09B0\u09CD")
    ) {
      const insertAt = lastClusterStart(curr.text);
      if (insertAt >= 0) {
        curr.text =
          curr.text.slice(0, insertAt) +
          "\u09B0\u09CD" +
          curr.text.slice(insertAt);
        next.text = next.text.slice(2);
        if (!next.text) continue;
      }
    }

    const lastIdx = curr.text.length - 1;
    const lastChar = curr.text[lastIdx]!;
    const prevIsConsonant =
      lastIdx > 0 && isBanglaConsonant(curr.text[lastIdx - 1]!);
    // A pre-kar glyph typed last in the run never found its consonant.
    const dangling =
      curr.rawText !== undefined &&
      BIJOY_PRE_KAR_GLYPH.test(curr.rawText.slice(-1));

    // ে already placed on its consonant, with া / ৗ starting the next run.
    if (!isBanglaPreKar(lastChar) || (!dangling && prevIsConsonant && /^[\u09BE\u09D7]/.test(next.text))) {
      fixEKarAaKarBoundary(curr, next);
      continue;
    }

    const nextFirst = next.text[0]!;
    const nextStartsWithHalant = nextFirst === BANGLA_HALANT;

    if (nextStartsWithHalant || !prevIsConsonant || dangling) {
      curr.text = curr.text.slice(0, -1);
      next.text = insertPreKar(lastChar, next.text);
    }
  }
}

/** Start index of the consonant cluster (e.g. ধ্ব) the text ends on, or -1. */
function lastClusterStart(text: string): number {
  let j = text.length - 1;
  if (j >= 0 && BANGLA_SIGN.test(text[j]!)) j--; // one trailing vowel sign
  if (j < 0 || !isBanglaConsonant(text[j]!)) return -1;
  while (
    j >= 2 &&
    text[j - 1] === BANGLA_HALANT &&
    isBanglaConsonant(text[j - 2]!)
  ) {
    j -= 2;
  }
  return j;
}

function fixEKarAaKarBoundary(curr: BijoyRun, next: BijoyRun): void {
  if (curr.text.length < 2) return;
  const last = curr.text[curr.text.length - 1]!;
  const secondLast = curr.text[curr.text.length - 2]!;

  if (last !== "\u09C7" || !isBanglaConsonant(secondLast)) return;

  const nextFirst = next.text[0];
  if (nextFirst === "\u09BE") {
    curr.text = curr.text.slice(0, -1) + "\u09CB";
    next.text = next.text.slice(1);
  } else if (nextFirst === "\u09D7") {
    curr.text = curr.text.slice(0, -1) + "\u09CC";
    next.text = next.text.slice(1);
  }
}

function insertPreKar(preKar: string, text: string): string {
  let j = 0;

  if (text[0] === BANGLA_HALANT) {
    while (
      j < text.length - 1 &&
      text[j] === BANGLA_HALANT &&
      isBanglaConsonant(text[j + 1]!)
    ) {
      j += 2;
    }
  } else {
    while (j < text.length && isBanglaConsonant(text[j]!)) {
      if (j + 1 < text.length && text[j + 1] === BANGLA_HALANT) {
        j += 2;
      } else {
        j += 1;
        break;
      }
    }
  }

  if (j === 0) return preKar + text;

  if (preKar === "\u09C7" && j < text.length && text[j] === "\u09BE") {
    return text.substring(0, j) + "\u09CB" + text.substring(j + 1);
  }
  if (preKar === "\u09C7" && j < text.length && text[j] === "\u09D7") {
    return text.substring(0, j) + "\u09CC" + text.substring(j + 1);
  }

  return text.substring(0, j) + preKar + text.substring(j);
}
