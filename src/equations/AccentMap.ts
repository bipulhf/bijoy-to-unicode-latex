export const ACCENT_MAP: Record<string, string> = {
  "\u0302": "\\hat",         // combining circumflex accent
  "\u030C": "\\check",       // combining caron
  "\u0303": "\\tilde",       // combining tilde
  "\u0301": "\\acute",       // combining acute accent
  "\u0300": "\\grave",       // combining grave accent
  "\u0304": "\\bar",         // combining macron
  "\u0306": "\\breve",       // combining breve
  "\u0307": "\\dot",         // combining dot above
  "\u0308": "\\ddot",        // combining diaeresis
  "\u20D7": "\\vec",         // combining right arrow above
  "\u20D6": "\\overleftarrow",    // combining left arrow above
  "\u20E1": "\\overleftrightarrow", // combining left-right arrow above
  "\u20DE": "\\square",      // combining enclosing square
  "\u030A": "\\mathring",    // combining ring above

  // Non-combining versions (sometimes used in OMML)
  "\u005E": "\\hat",         // ^
  "\u007E": "\\tilde",       // ~
  "\u02D9": "\\dot",         // dot above
  "\u00A8": "\\ddot",        // diaeresis
  "\u00AF": "\\bar",         // macron
};

export const NARY_MAP: Record<string, string> = {
  "\u2211": "\\sum",
  "\u220F": "\\prod",
  "\u2210": "\\coprod",
  "\u222B": "\\int",
  "\u222C": "\\iint",
  "\u222D": "\\iiint",
  "\u222E": "\\oint",
  "\u222F": "\\oiint",
  "\u2230": "\\oiiint",
  "\u22C0": "\\bigwedge",
  "\u22C1": "\\bigvee",
  "\u22C2": "\\bigcap",
  "\u22C3": "\\bigcup",
  "\u2295": "\\bigoplus",
  "\u2297": "\\bigotimes",
  "\u2299": "\\bigodot",
  "\u228E": "\\biguplus",
  "\u2A00": "\\bigodot",
};

export const GROUP_CHR_MAP: Record<string, { top: string; bot: string }> = {
  "\u23DF": { top: "\\overbrace", bot: "\\underbrace" },
  "\u23DE": { top: "\\overbrace", bot: "\\underbrace" },
  "_": { top: "\\overbrace", bot: "\\underbrace" },
  "\u2192": { top: "\\overrightarrow", bot: "\\underrightarrow" },
  "\u2190": { top: "\\overleftarrow", bot: "\\underleftarrow" },
  "\u2194": { top: "\\overleftrightarrow", bot: "\\underleftrightarrow" },
  "\u2323": { top: "\\overset{\\frown}", bot: "\\underset{\\frown}" },
};

export const DELIMITER_MAP: Record<string, string> = {
  "(": "(",
  ")": ")",
  "[": "[",
  "]": "]",
  "{": "\\{",
  "}": "\\}",
  "|": "\\lvert",
  "\u2016": "\\Vert",
  "\u230A": "\\lfloor",
  "\u230B": "\\rfloor",
  "\u2308": "\\lceil",
  "\u2309": "\\rceil",
  "\u27E8": "\\langle",
  "\u27E9": "\\rangle",
  "\u2329": "\\langle",
  "\u232A": "\\rangle",
};
