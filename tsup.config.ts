import { defineConfig } from "tsup";

// Library build only; the CLI (src/cli.ts) and web server run from source.
export default defineConfig({
  // Package entry points; see "exports" in package.json.
  // Package root is the Unicode converter; src/index.ts (the .docx API) is
  // published as the "docx" subpath.
  entry: {
    index: "src/unicode.ts",
    html: "src/html.ts",
    latex: "src/latex.ts",
    docx: "src/index.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: false,
  minify: true,
  target: "node20",
  // Shared code (char map, OMML walker) goes into chunks instead of being
  // copied into every entry.
  splitting: true,
});
