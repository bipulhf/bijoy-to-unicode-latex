import type { ConvertOptions } from "../types.js";

export function wrapLatex(
  latex: string,
  isDisplay: boolean,
  options: ConvertOptions,
): string {
  if (!latex || latex.trim().length === 0) return "";

  const trimmed = latex.trim();

  if (options.forceDisplay) {
    return `\\[${trimmed}\\]`;
  }

  if (options.forceInline) {
    return `$${trimmed}$`;
  }

  if (isDisplay) {
    return `\\[${trimmed}\\]`;
  }

  return `$${trimmed}$`;
}
