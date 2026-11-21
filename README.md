# bijoy-to-unicode

Convert Bijoy (SutonnyMJ and other ANSI) Bangla to Unicode — as plain text, as formatted HTML copied from Word, or as whole `.docx` question papers with the equations turned into LaTeX.

- **Small:** about 25 kB packed, one dependency (`fast-xml-parser`).
- **Typed:** written in strict TypeScript, ships its own declarations.
- **Pick what you need:** four entry points; the text and HTML converters have no dependencies and run in browsers.

```bash
npm install bijoy-to-unicode
```

| Import | Converts | Runs in |
| --- | --- | --- |
| `bijoy-to-unicode` | Bijoy text to Unicode | Node, browsers |
| `bijoy-to-unicode/html` | Word HTML (clipboard) to formatted Unicode HTML | Browsers; Node with a DOM parser |
| `bijoy-to-unicode/latex` | Word equations (OMML) to LaTeX | Node, browsers |
| `bijoy-to-unicode/docx` | `.docx` question papers to questions with LaTeX | Node |

The package is ESM only and needs Node 20 or later.

## Plain text

```ts
import { convertBijoyToUnicode } from "bijoy-to-unicode";

convertBijoyToUnicode("Avwg evsjvq Mvb MvB"); // "আমি বাংলায় গান গাই"
convertBijoyToUnicode("wbY©q Ki");            // "নির্ণয় কর"
```

Text that already contains Unicode Bangla should not be passed in; check first:

```ts
import { hasUnicodeBangla, hasBijoyMarkers, isBijoyFont } from "bijoy-to-unicode";

hasUnicodeBangla("বাংলা");  // true: already Unicode, leave it
hasBijoyMarkers("‡hvM");    // true: contains characters only Bijoy text uses
isBijoyFont("SutonnyMJ");   // true; also other *MJ fonts. Nikosh, Kalpurush: false
```

`hasBijoyMarkers` is a guess from characters; words such as `Avwg` use only plain Latin letters and are not detected. When you know the font, `isBijoyFont` is reliable.

### Text split into pieces

Word and HTML often split one word over several runs or spans, for example when part of it is coloured. Converting each piece alone breaks the word (a reph typed in the next piece, a vowel sign before the consonant in the previous one). `convertBijoyRuns` converts the pieces of one line together and returns one result per piece, so each keeps its own formatting:

```ts
import { convertBijoyRuns } from "bijoy-to-unicode";

convertBijoyRuns(["eM", "©"]); // ["বর্গ", ""]: the reph moved into the first piece
convertBijoyRuns(["hw", "`"]); // ["য", "দি"]: the vowel sign moved to the second piece
```

## Formatted text from Word

`convertBijoyHtml` takes the HTML Word puts on the clipboard and returns clean HTML with the Bijoy text converted. Bold, italic, underline, colours, font sizes, alignment, lists, tables and images are kept. Bijoy text is found by its font, so English text in the same paragraph is left alone. The result is rebuilt from an allow-list of tags, attributes and styles; scripts, event handlers and `javascript:` links are removed, so it is safe to insert.

A paste handler for any `contenteditable` editor:

```ts
import { convertBijoyHtml } from "bijoy-to-unicode/html";
import { ommlToLatex } from "bijoy-to-unicode/latex";

editor.addEventListener("paste", (event) => {
  const data = event.clipboardData;
  const html = data?.getData("text/html");
  if (!html) return; // not from Word or a web page: let the editor handle it

  event.preventDefault();
  const result = convertBijoyHtml(html, {
    rtf: data.getData("text/rtf"),
    banglaFont: "Kalpurush",
    equation: (omml) => {
      const latex = ommlToLatex(omml);
      return latex ? `$${latex}$` : null;
    },
  });
  document.execCommand("insertHTML", false, result.html);
  if (result.warnings.length) console.warn(result.warnings);
});
```

Most editors (Quill, TipTap/ProseMirror, CKEditor, TinyMCE, Lexical) have their own paste hook; call `convertBijoyHtml` there and hand the result to the editor's HTML insert command.

Options:

| Option | Meaning |
| --- | --- |
| `rtf` | The clipboard's `text/rtf` data. Word's HTML points images at local files a page cannot read; the same images are taken from the RTF. Without it, those images are removed. |
| `banglaFont` | CSS `font-family` set on converted text. Left unset, the text uses the editor's font. |
| `equation(omml)` | Text to put where a Word equation was, or `null` to drop it. Without this option equations are dropped. |
| `parser` | Object with `parseFromString(html, "text/html")`. Defaults to the browser's `DOMParser`. |

The result has `html`, a plain-text version in `text`, `warnings` (removed images or equations) and `stats` (`bijoyRuns`, `equations`, `images`, `imagesDropped`).

In Node, pass a parser, for example from `happy-dom`:

```ts
import { Window } from "happy-dom";
import { convertBijoyHtml } from "bijoy-to-unicode/html";

const parser = new new Window().DOMParser();
const { html } = convertBijoyHtml(wordHtml, { parser });
```

`extractRtfImages(rtf)` is exported from the same entry point if you need the PNG/JPEG images of an RTF document yourself.

## Equations

```ts
import { ommlToLatex } from "bijoy-to-unicode/latex";

ommlToLatex(
  "<m:oMath><m:f><m:num><m:r><m:t>a</m:t></m:r></m:num>" +
    "<m:den><m:r><m:t>b</m:t></m:r></m:den></m:f></m:oMath>",
); // "\\frac{a}{b}"
```

Accepts `m:oMath` or `m:oMathPara` markup from a `.docx` file or from Word's clipboard HTML, and returns `null` when it cannot be read. The LaTeX has no delimiters; add `$…$` or `\(…\)` as your renderer needs.

Covered: fractions (bar, linear, skewed, `\binom`), roots, scripts and pre-scripts, matrices and determinants (`pmatrix`, `bmatrix`, `vmatrix`, …), `cases`, equation arrays (`aligned`), integrals, sums, products and other n-ary operators, limits and functions (`\lim`, `\sin`, `\log`, …), delimiters, accents and over/under bars and braces, boxes, Greek letters, arrows, relations, set and logic symbols, and blackboard bold.

## Word question papers

```ts
import { convertDocx, convertBuffer } from "bijoy-to-unicode/docx";

const { questions, stats } = await convertDocx("questions.docx");
// or, for an upload: await convertBuffer(buffer)

for (const q of questions) {
  console.log(q.question, q.options);
}
```

Reads a multiple-choice paper written in Bijoy with Word equations and returns its questions. Bangla is converted to Unicode and equations to LaTeX, placed in the text where they were:

```json
{
  "question": "\\begin{bmatrix}2 & 3 & x \\\\3 & 4 & -5 \\\\4 & 1 & 2\\end{bmatrix}+ … হলে x, y ও z এর মান কত?",
  "options": ["-4, 8, 2", "6, -8, -2", "2, 5, 8", "6, 8, -2"]
}
```

Questions may be numbered (`1.`, `২।`) or not. Options are found as `ক)`/`(a)`/`A.` style markers in paragraphs, several on one line, or in option tables of 1–4 columns; the markers are removed from the option text. Word list numbering, Unicode Bangla fonts and English text are handled.

`ConvertOptions`:

| Option | Default | Meaning |
| --- | --- | --- |
| `forceInline` | `false` | Wrap every equation in `$…$` |
| `forceDisplay` | `false` | Wrap every equation in `\[…\]` (wins over `forceInline`) |
| `skipBijoy` | `false` | Leave Bijoy text as it is |
| `skipEquations` | `false` | Leave equations out |
| `preserveFormatting` | `false` | Mark bold as `**…**` and italic as `_…_` |
| `imageToken` | `"[image]"` | Text put where an image was |
| `maxRecursionDepth` | `50` | Nesting limit for equations |

Without `forceInline` or `forceDisplay` the LaTeX has no delimiters, which suits renderers that wrap Bangla in `\text{}` themselves; with mixed text, use one of them so equations can be told apart.

`stats` has `totalQuestions`, `totalEquations`, `bijoyRunsConverted`, `tablesProcessed`, `imagesSkipped` and `warnings` (each with `type`, `message` and `paragraphIndex`). A file that is not a `.docx` throws `InvalidDocxError`.

## Limits

- Bijoy is detected by font name. Text in an unknown Bijoy font with no tell-tale characters is not converted.
- Images in `.docx` papers are replaced by `imageToken`; old OLE (Equation 3.0) objects are reported in `warnings`, not converted.
- In Word's clipboard HTML, EMF/WMF images cannot be recovered; PNG and JPEG can.

## Development

The repository also has a command-line tool and a web UI; they are not part of the npm package.

```bash
git clone https://github.com/bipulhf/bijoy-to-unicode-latex.git
cd bijoy-to-unicode-latex
npm install

npm test                  # tests (Vitest)
npm run typecheck
npm run build             # package build into dist/
npm run dev -- paper.docx --pretty --stats   # CLI
npm run start:web         # web UI on http://localhost:3001
```

The web UI has two pages: `/` converts a `.docx` paper and shows the rendered questions; `/paste.html` takes a paste from Word and gives back formatted Unicode to copy into any editor.

Source layout:

```
src/
├── unicode.ts html.ts latex.ts   package entry points (root, /html, /latex)
├── index.ts      package entry point /docx
├── bijoy/        Bijoy to Unicode, run repair, Word HTML cleaning
├── equations/    OMML to LaTeX
├── reader/       .docx unzip and XML parsing
├── walker/       paragraphs, runs and tables of a document
├── assembler/    questions and options from paragraphs
├── cli.ts        command-line tool
├── server.ts     web UI server
└── web/          paste page script
```

When reporting a wrong conversion, include a small `.docx` (or, from the paste page, the file from **Save raw clipboard**), the output you expected and the output you got.

## License

[MIT](LICENSE)
