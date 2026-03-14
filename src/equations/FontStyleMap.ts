export const MATH_FONT_MAP: Record<string, (x: string) => string> = {
  bold: (x) => `\\mathbf{${x}}`,
  italic: (x) => `\\mathit{${x}}`,
  "bold-italic": (x) => `\\boldsymbol{${x}}`,
  "double-struck": (x) => `\\mathbb{${x}}`,
  fraktur: (x) => `\\mathfrak{${x}}`,
  "bold-fraktur": (x) => `\\mathbf{\\mathfrak{${x}}}`,
  script: (x) => `\\mathcal{${x}}`,
  "bold-script": (x) => `\\mathbf{\\mathcal{${x}}}`,
  "sans-serif": (x) => `\\mathsf{${x}}`,
  "sans-serif-bold": (x) => `\\mathbf{\\mathsf{${x}}}`,
  monospace: (x) => `\\mathtt{${x}}`,
  normal: (x) => `\\mathrm{${x}}`,
  initial: (x) => x,
  tailed: (x) => x,
  looped: (x) => x,
  stretched: (x) => x,
};

export const BLACKBOARD_MAP: Record<string, string> = {
  "\u211D": "\\mathbb{R}",
  "\u211A": "\\mathbb{Q}",
  "\u2124": "\\mathbb{Z}",
  "\u2115": "\\mathbb{N}",
  "\u2102": "\\mathbb{C}",
  "\u2119": "\\mathbb{P}",
  "\uD835\uDD3D": "\\mathbb{F}",
  "\uD835\uDD5C": "\\mathbb{k}",
};

export const SPACE_MAP: Record<string, string> = {
  "0.0em": "",
  "0.1em": "\\,",
  "0.2em": "\\:",
  "0.3em": "\\;",
  "1.0em": "\\quad",
  "2.0em": "\\qquad",
  negativethinmathspace: "\\!",
};
