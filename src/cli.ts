#!/usr/bin/env node

import { Command } from "commander";
import { readFile, writeFile } from "node:fs/promises";
import { convertBuffer } from "./index.js";
import { InvalidDocxError } from "./types.js";
import type { ConvertOptions } from "./types.js";

const program = new Command();

program
  .name("bijoy-to-latex")
  .description(
    "Convert a Bijoy Bangla Word (.docx) file to structured question JSON with LaTeX equations.",
  )
  .version("0.1.0")
  .argument("<file>", "Path to the .docx file")
  .option("-o, --output <path>", "Write JSON to file (default: stdout)")
  .option("--pretty", "Pretty-print JSON output")
  .option("--skip-bijoy", "Skip Bijoy → Unicode conversion")
  .option("--skip-equations", "Skip equation → LaTeX conversion")
  .option("--force-display", "Force all equations to \\[...\\] mode")
  .option("--force-inline", "Force all equations to $...$ mode")
  .option("--preserve-formatting", "Emit **bold** / _italic_ markers")
  .option(
    "--image-token <token>",
    "Placeholder for images",
    "[image]",
  )
  .option("--stats", "Print conversion stats to stderr")
  .action(async (file: string, opts: Record<string, string | boolean | undefined>) => {
    try {
      const buffer = await readFile(file);

      const options: ConvertOptions = {
        skipBijoy: opts["skipBijoy"] === true,
        skipEquations: opts["skipEquations"] === true,
        forceDisplay: opts["forceDisplay"] === true,
        forceInline: opts["forceInline"] === true,
        preserveFormatting: opts["preserveFormatting"] === true,
        imageToken: typeof opts["imageToken"] === "string" ? opts["imageToken"] : "[image]",
      };

      const result = await convertBuffer(buffer, options);

      const json = opts["pretty"]
        ? JSON.stringify(result.questions, null, 2)
        : JSON.stringify(result.questions);

      if (typeof opts["output"] === "string") {
        await writeFile(opts["output"], json, "utf-8");
        process.stderr.write(
          `Wrote ${result.questions.length} questions to ${opts["output"]}\n`,
        );
      } else {
        process.stdout.write(json + "\n");
      }

      if (opts["stats"]) {
        process.stderr.write(
          `\nConversion Stats:\n` +
            `  Questions: ${result.stats.totalQuestions}\n` +
            `  Equations: ${result.stats.totalEquations}\n` +
            `  Bijoy runs converted: ${result.stats.bijoyRunsConverted}\n` +
            `  Tables processed: ${result.stats.tablesProcessed}\n` +
            `  Images skipped: ${result.stats.imagesSkipped}\n` +
            `  Warnings: ${result.stats.warnings.length}\n`,
        );

        if (result.stats.warnings.length > 0) {
          process.stderr.write("\nWarnings:\n");
          for (const w of result.stats.warnings) {
            process.stderr.write(
              `  [${w.type}] ${w.message} (paragraph ${w.paragraphIndex})\n`,
            );
          }
        }
      }
    } catch (err) {
      if (err instanceof InvalidDocxError) {
        process.stderr.write(`Error: ${err.message}\n`);
        process.exit(1);
      }
      throw err;
    }
  });

program.parse();
