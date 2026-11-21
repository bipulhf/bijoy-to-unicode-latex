/// <reference lib="dom" />
/**
 * Browser entry for web/paste.html, bundled to web/lib/bijoy-paste.js.
 */
import { convertBijoyHtml, type ConvertBijoyHtmlResult } from "../bijoy/html.js";
import { convertBijoyToUnicode } from "../bijoy/BijoyConverter.js";
import { hasBijoyMarkers, hasUnicodeBangla } from "../bijoy/BijoyDetector.js";
import { wordHtmlOmmlToLatex } from "../equations/htmlOmml.js";

export type EquationStyle = "dollar" | "paren" | "remove";

export interface ClipboardInput {
  html: string;
  rtf: string;
  text: string;
}

export interface PasteOptions {
  banglaFont: string | null;
  equations: EquationStyle;
}

export function convertClipboard(
  input: ClipboardInput,
  options: PasteOptions,
): ConvertBijoyHtmlResult {
  if (input.html.trim()) {
    return convertBijoyHtml(input.html, {
      rtf: input.rtf || undefined,
      banglaFont: options.banglaFont ?? undefined,
      equation:
        options.equations === "remove"
          ? undefined
          : (omml) => {
              const latex = wordHtmlOmmlToLatex(omml);
              if (!latex) return "[equation]";
              return options.equations === "dollar"
                ? `$${latex}$`
                : `\\(${latex}\\)`;
            },
    });
  }
  return convertPlainText(input.text);
}

/** Plain text has no fonts, so a line is converted only when it looks like Bijoy. */
function convertPlainText(text: string): ConvertBijoyHtmlResult {
  let bijoyRuns = 0;
  const lines = text.split(/\r?\n/).map((line) => {
    if (hasUnicodeBangla(line) || !hasBijoyMarkers(line)) return line;
    bijoyRuns++;
    return convertBijoyToUnicode(line);
  });
  const escape = (s: string): string =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return {
    html: lines.map((line) => `<p>${escape(line) || "<br>"}</p>`).join(""),
    text: lines.join("\n"),
    warnings: [
      "The clipboard had plain text only, so formatting is lost and Bijoy text was guessed from its characters.",
    ],
    stats: { bijoyRuns, equations: 0, images: 0, imagesDropped: 0 },
  };
}
