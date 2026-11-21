import { defineConfig } from "tsup";

// Browser bundle for the paste page (web/paste.html).
export default defineConfig({
  entry: { "bijoy-paste": "src/web/paste.ts" },
  format: ["esm"],
  platform: "browser",
  target: "es2020",
  outDir: "web/lib",
  dts: false,
  sourcemap: false,
  minify: true,
  splitting: false,
});
