/**
 * bijoy-to-unicode: plain Bijoy (ANSI) text to Unicode Bangla.
 * No dependencies; works in Node and browsers.
 */
export { convertBijoyToUnicode } from "./bijoy/BijoyConverter.js";
export { convertBijoyRuns } from "./bijoy/runs.js";
export { isBijoyFont, hasBijoyMarkers, hasUnicodeBangla } from "./bijoy/BijoyDetector.js";
