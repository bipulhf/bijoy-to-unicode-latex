import { defineConfig } from "tsup";

// Library build only; the CLI (src/cli.ts) and web server run from source.
export default defineConfig({
  // Package entry points; see "exports" in package.json.
  entry: ["src/index.ts", "src/unicode.ts", "src/html.ts", "src/latex.ts"],
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
