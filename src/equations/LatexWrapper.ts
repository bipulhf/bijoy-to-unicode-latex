import type { ConvertOptions } from "../types.js";

/**
 * Returns the equation LaTeX, raw by default. forceDisplay wraps every
 * equation in \[...\] and forceInline wraps every equation in $...$;
 * forceDisplay wins if both are set.
 */
export function wrapLatex(
  latex: string,
  _isDisplay: boolean,
  options: ConvertOptions,
): string {
  const body = latex.trim();
  if (body.length === 0) return "";
  if (options.forceDisplay) return `\\[${body}\\]`;
  if (options.forceInline) return `$${body}$`;
  return body;
}
