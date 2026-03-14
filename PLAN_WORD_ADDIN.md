# PLAN_WORD_ADDIN.md

**Project:** `BijoyToLatex.AddIn` — Microsoft Word Add-in (VSTO, C#)
**Goal:** A Word task-pane add-in that reads the active document, converts Bijoy Bangla text to Unicode and all embedded Word equations to LaTeX, and exports a structured `Question[]` JSON — the same output shape as the TypeScript CLI, but driven directly from inside Microsoft Word without ever touching the file system or unzipping anything.

---

## 1. Why VSTO over Office JS

| Concern | VSTO (this plan) | Office Web Add-in (JS) |
|---|---|---|
| Language | C# — user's choice | TypeScript / JavaScript |
| Word object model access | Full COM object model | Limited Office.js surface |
| Direct `OMath` object access | Yes — `Range.OMaths` | No — must round-trip via XML |
| `Run.Font.Name` per-character | Yes — direct | Indirect (via OOXML) |
| Table enumeration | `doc.Tables`, `Row.Cells` | Limited |
| WPF/WinForms task pane | Yes | No (HTML/CSS only) |
| Target platform | Windows (Office 2007+) | Cross-platform |
| Deployment | ClickOnce / MSI | App catalog / AppSource |

VSTO is the right choice because every piece of information needed (font names, OMath nodes, table cell order, paragraph numbering) is directly exposed through the Word COM object model — no manual XML parsing of the document body required.

---

## 2. Architecture Overview

```
┌────────────────────────────────────────────────────────────┐
│              Microsoft Word (Host Application)             │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         BijoyToLatex Task Pane (WPF)                 │  │
│  │                                                       │  │
│  │  [ Convert Active Document ]   [ Copy JSON ]         │  │
│  │  [ Options... ]                [ Save JSON... ]      │  │
│  │                                                       │  │
│  │  Progress bar                                         │  │
│  │  Warning list                                         │  │
│  │  Preview (first 3 questions)                         │  │
│  └───────────────────┬──────────────────────────────────┘  │
│                      │ calls                               │
│  ┌───────────────────▼──────────────────────────────────┐  │
│  │         ThisAddIn (VSTO entry point)                  │  │
│  │  • Registers task pane                                │  │
│  │  • Exposes ActiveDocument to Core library            │  │
│  └───────────────────┬──────────────────────────────────┘  │
└──────────────────────┼─────────────────────────────────────┘
                       │
           ┌───────────▼───────────┐
           │   BijoyToLatex.Core   │  (separate .NET class library)
           │                       │
           │   DocumentProcessor   │
           │   ├─ BodyWalker        │
           │   ├─ ParagraphParser   │
           │   ├─ TableParser       │
           │   ├─ BijoyDetector     │
           │   ├─ BijoyConverter    │
           │   ├─ EquationProcessor │
           │   │   ├─ OmmlExtractor │
           │   │   ├─ OmmlToMathml  │  (XSLT via XslCompiledTransform)
           │   │   ├─ OmmlWalker    │  (direct fallback)
           │   │   └─ MathmlWalker  │  (MathML → LaTeX)
           │   └─ QuestionAssembler │
           └───────────────────────┘
                       │
           ┌───────────▼───────────┐
           │  BijoyToLatex.Tests   │  (xUnit + FluentAssertions)
           └───────────────────────┘
```

---

## 3. Technology Stack

### Runtime & Framework

| Item | Choice | Reason |
|---|---|---|
| Framework | **.NET Framework 4.8** | Last .NET Framework release; runs on Windows 7 SP1+; supports Word 2007–365; all VSTO runtimes |
| VSTO version | **VSTO 2022** (Visual Studio 2022) | Builds for all Office versions back to 2007 |
| Language | **C# 9** (`<LangVersion>9.0</LangVersion>`) | Records and `init` work via Roslyn on .NET Framework; avoids C# 11/12 features unavailable on .NET FX |
| UI | **WPF** (task pane) | Available since .NET Framework 3.0 — no additional dependency |
| Target Office | **Word 2007 / 2010 / 2013 / 2016 / 2019 / 2021 / 365** | Full range — OMML (`m:oMath`) was introduced in Office 2007 |

> **Why .NET Framework 4.8, not .NET 8?**
> VSTO requires the host to load the add-in via the Office/COM runtime. .NET 8 VSTO support (via COM activation shims) is still experimental and does not reliably cover Office 2007/2010. .NET Framework 4.8 is the universally supported target for VSTO across all Office versions and is pre-installed on Windows 10/11.

### Interop Assembly

Use the **Word 2007 PIA** (`Microsoft.Office.Interop.Word` **version 12.0**) as the minimum interop surface. The same assembly works with all later Office versions — Word's object model is backwards-compatible. Install via NuGet: `Microsoft.Office.Interop.Word` (any version; references the GAC PIA on the build machine).

> `Range.OMaths`, `OMath`, `OMathPara`, and `CustomTaskPanes` all exist in the Word 12.0 (2007) object model.

### NuGet Packages

| Package | Version | Purpose |
|---|---|---|
| `Microsoft.Office.Interop.Word` | `15.*` | Word COM object model (PIA) |
| `DocumentFormat.OpenXml` | `2.*` | OpenXML SDK for .NET Framework (v3+ requires .NET 6+) |
| `Newtonsoft.Json` | `13.*` | JSON serialization — more reliable than `System.Text.Json` on .NET FX |
| `CommunityToolkit.Mvvm` | `8.*` | MVVM (targets `netstandard2.0`, compatible with .NET FX 4.6.1+) |
| `xunit` | `2.*` | Unit testing |
| `FluentAssertions` | `6.*` | Readable test assertions (.NET FX compatible) |
| `Moq` | `4.*` | Mocking Word interop in tests |

### Bundled Assets

| File | Purpose |
|---|---|
| `Assets/OMML2MML.XSL` | Microsoft's stylesheet: OMML → W3C MathML |
| `Assets/bijoy_charmap.json` | Full 256-entry Bijoy → Unicode lookup |

---

## 4. Solution Structure

```
BijoyToLatex.sln
│
├── BijoyToLatex.AddIn/              ← VSTO project
│   ├── ThisAddIn.cs
│   ├── TaskPane/
│   │   ├── TaskPaneControl.xaml
│   │   ├── TaskPaneControl.xaml.cs
│   │   └── TaskPaneViewModel.cs
│   ├── BijoyToLatex.AddIn.csproj
│   └── BijoyToLatex.AddIn.vsto
│
├── BijoyToLatex.Core/               ← Pure class library (no VSTO dependency)
│   ├── Models/
│   │   ├── Question.cs
│   │   ├── ConversionResult.cs
│   │   ├── ConversionOptions.cs
│   │   ├── ConversionWarning.cs
│   │   └── DocNode.cs
│   │
│   ├── Reader/
│   │   └── WordDocumentAdapter.cs   ← Wraps Word.Document COM object
│   │
│   ├── Walker/
│   │   ├── BodyWalker.cs
│   │   ├── ParagraphParser.cs
│   │   └── TableParser.cs
│   │
│   ├── Bijoy/
│   │   ├── BijoyDetector.cs
│   │   ├── BijoyConverter.cs
│   │   └── BijoyCharmap.cs
│   │
│   ├── Equations/
│   │   ├── EquationProcessor.cs
│   │   ├── OmmlExtractor.cs
│   │   ├── OmmlToMathml.cs          ← XSLT path (Path A)
│   │   ├── OmmlWalker.cs            ← Direct OMML path (Path B)
│   │   ├── MathmlWalker.cs          ← MathML → LaTeX
│   │   ├── LatexWrapper.cs
│   │   ├── Maps/
│   │   │   ├── OperatorMap.cs
│   │   │   ├── GreekMap.cs
│   │   │   ├── ArrowMap.cs
│   │   │   ├── AccentMap.cs
│   │   │   └── FontStyleMap.cs
│   │   └── Symbols/
│   │       └── BlackboardMap.cs
│   │
│   ├── Assembler/
│   │   ├── QuestionAssembler.cs
│   │   ├── QuestionDetector.cs
│   │   └── OptionDetector.cs
│   │
│   ├── Assets/
│   │   ├── OMML2MML.XSL             ← EmbeddedResource
│   │   └── bijoy_charmap.json       ← EmbeddedResource
│   │
│   └── BijoyToLatex.Core.csproj
│
└── BijoyToLatex.Tests/              ← xUnit project
    ├── Unit/
    │   ├── BijoyDetectorTests.cs
    │   ├── BijoyConverterTests.cs
    │   ├── OmmlWalkerTests.cs
    │   ├── OmmlToMathmlTests.cs
    │   ├── MathmlWalkerTests.cs
    │   ├── TableParserTests.cs
    │   ├── QuestionDetectorTests.cs
    │   └── OptionDetectorTests.cs
    ├── Integration/
    │   ├── PipelineTests.cs
    │   └── Fixtures/                ← .docx fixtures
    └── BijoyToLatex.Tests.csproj
```

---

## 5. C# Type Definitions

```csharp
// Models/Question.cs
// C# 9 positional record — works on .NET Framework 4.8 via Roslyn
public record Question(
    string QuestionText,
    IReadOnlyList<string> Options
);

// Models/ConversionResult.cs
public record ConversionResult(
    IReadOnlyList<Question> Questions,
    ConversionStats Stats
);

public record ConversionStats(
    int TotalQuestions,
    int TotalEquations,
    int BijoyRunsConverted,
    int TablesProcessed,
    int ImagesSkipped,
    IReadOnlyList<ConversionWarning> Warnings
)
{
    // Overload for callers that don't supply warnings yet
    public ConversionStats(int q, int e, int b, int t, int i)
        : this(q, e, b, t, i, new List<ConversionWarning>()) { }
}

// Models/ConversionOptions.cs
// Plain class — mutable so the WPF task pane can bind to it
public class ConversionOptions
{
    public bool SkipBijoy { get; set; } = false;
    public bool SkipEquations { get; set; } = false;
    public bool ForceDisplay { get; set; } = false;
    public bool ForceInline { get; set; } = false;
    public bool PreserveFormatting { get; set; } = false;
    public int MaxRecursionDepth { get; set; } = 50;
    public string ImageToken { get; set; } = "[image]";
    public TimeSpan XsltTimeout { get; set; } = TimeSpan.FromMilliseconds(500);
}

// Models/ConversionWarning.cs
public enum WarningType
{
    UnknownChar,
    UnsupportedEquation,
    AmbiguousOption,
    OleEquation,        // Equation Editor 2.x/3.x OLE object — cannot convert
    ImageSkipped,
    XsltFallback,
    EquationParseError,
    RecursionLimit,
}

public record ConversionWarning(
    WarningType Type,
    string Message,
    int ParagraphIndex
);

// Models/DocNode.cs — discriminated union using inheritance
public abstract class DocNode { }

public class TextNode : DocNode
{
    public string Text { get; }
    public bool IsBijoy { get; }
    public string FontName { get; }    // null = unknown
    public bool Bold { get; }
    public bool Italic { get; }

    public TextNode(string text, bool isBijoy, string fontName, bool bold, bool italic)
    {
        Text = text; IsBijoy = isBijoy; FontName = fontName; Bold = bold; Italic = italic;
    }
}

public class EquationNode : DocNode
{
    public string OmmlXml { get; }
    public bool IsDisplay { get; }     // true → \[...\],  false → $...$

    public EquationNode(string ommlXml, bool isDisplay)
    { OmmlXml = ommlXml; IsDisplay = isDisplay; }
}

public class OleEquationNode : DocNode
{
    /// <summary>
    /// An Equation Editor 2.x/3.x OLE object. Cannot be converted to LaTeX.
    /// A warning is emitted and ImageToken is placed in output.
    /// </summary>
    public int InlineShapeIndex { get; }
    public OleEquationNode(int index) { InlineShapeIndex = index; }
}

public class ImageNode : DocNode
{
    public string RelationshipId { get; }   // null = no relationship
    public ImageNode(string relationshipId) { RelationshipId = relationshipId; }
}
```

---

## 6. VSTO Entry Point

```csharp
// BijoyToLatex.AddIn/ThisAddIn.cs
public partial class ThisAddIn
{
    private TaskPaneControl? _taskPaneControl;
    private CustomTaskPane? _taskPane;

    private void ThisAddIn_Startup(object sender, EventArgs e)
    {
        _taskPaneControl = new TaskPaneControl();
        _taskPane = CustomTaskPanes.Add(_taskPaneControl, "Bijoy to LaTeX");
        _taskPane.Width = 400;
        _taskPane.Visible = false;

        // Register a ribbon button (see Ribbon.cs) to toggle the task pane
    }

    public void ToggleTaskPane()
    {
        if (_taskPane is not null)
            _taskPane.Visible = !_taskPane.Visible;
    }

    public Word.Document? GetActiveDocument()
        => Application.ActiveDocument;
}
```

---

## 7. Word Document Adapter

The `WordDocumentAdapter` bridges the VSTO COM object model to the Core library's pure C# processing pipeline.

```csharp
// Core/Reader/WordDocumentAdapter.cs
public sealed class WordDocumentAdapter
{
    private readonly Word.Document _doc;

    public WordDocumentAdapter(Word.Document doc)
        => _doc = doc;

    /// <summary>
    /// Returns all top-level body elements in document order.
    /// Handles paragraphs, tables, and content in text boxes.
    /// </summary>
    public IEnumerable<BodyElement> GetBodyElements()
    {
        // Word.Document.Content.Paragraphs does NOT preserve document order
        // when tables are involved. Use StoryRanges for correct ordering.
        var range = _doc.Content;
        return WalkRange(range);
    }

    private IEnumerable<BodyElement> WalkRange(Word.Range range)
    {
        // Iterate paragraphs and tables via the range's content
        // Use range.Tables to get table objects intersecting this range
        // Use range.Paragraphs for paragraphs not inside tables
        // Order them by paragraph index (Start property)
        ...
    }
}
```

### Key COM Object Properties Used

| COM property | Used for |
|---|---|
| `Paragraph.Range.Text` | Raw text content |
| `Run.Font.Name` (via `Range.Font.Name`) | Bijoy font detection |
| `Paragraph.Range.OMaths` | All OMath objects in the paragraph |
| `OMath.Range.XML` | Raw OOXML fragment containing `m:oMath` |
| `OMath.Range.Start` / `.End` | Position to split text around equations |
| `Paragraph.Range.Font.Bold` | Bold detection |
| `Paragraph.Range.Font.Italic` | Italic detection |
| `Paragraph.Format.Style.NameLocal` | Style ID |
| `Paragraph.Range.ListFormat.ListType` | Numbered list detection |
| `Table.Rows` / `Row.Cells` / `Cell.Range` | Table iteration |
| `Table.Columns.Count` | Column count |
| `Table.Cell(r, c).Width` | Cell width for layout table detection |
| `Paragraph.Range.InlineShapes` | Images |
| `Range.Revisions` | Track changes |
| `TextFrame.TextRange` | Text boxes |

---

## 8. Paragraph Parser — Splitting Text and Equations

The core challenge: a paragraph can interleave Bijoy text runs with `OMath` nodes. We need them in document order.

```csharp
// Core/Walker/ParagraphParser.cs
public sealed class ParagraphParser
{
    private readonly EquationProcessor _equations;
    private readonly ConversionOptions _opts;

    public IReadOnlyList<DocNode> Parse(Word.Paragraph paragraph)
    {
        var nodes = new List<DocNode>();
        var range = paragraph.Range;

        // Collect OMath positions
        var omaths = range.OMaths
            .Cast<Word.OMath>()
            .OrderBy(o => o.Range.Start)
            .ToList();

        int cursor = range.Start;

        foreach (var omath in omaths)
        {
            // Text before this equation
            if (omath.Range.Start > cursor)
            {
                var textRange = _doc.Range(cursor, omath.Range.Start);
                nodes.AddRange(ParseTextRange(textRange));
            }

            // The equation itself
            string ommlXml = ExtractOmmlXml(omath);
            bool isDisplay = IsDisplayEquation(omath);
            nodes.Add(new EquationNode(ommlXml, isDisplay));

            cursor = omath.Range.End;
        }

        // Remaining text after last equation
        if (cursor < range.End)
        {
            var tail = _doc.Range(cursor, range.End);
            nodes.AddRange(ParseTextRange(tail));
        }

        return nodes;
    }

    private IEnumerable<DocNode> ParseTextRange(Word.Range range)
    {
        // Iterate characters grouped by font name + bold + italic
        // Word.Range.Characters gives per-character access
        // Group consecutive chars with same font/bold/italic into runs
        foreach (var run in GroupByFont(range))
        {
            bool isBijoy = BijoyDetector.IsBijoyFont(run.FontName)
                        || BijoyDetector.HasBijoyMarkers(run.Text);

            yield return new TextNode(
                Text:     run.Text,
                IsBijoy:  isBijoy,
                FontName: run.FontName,
                Bold:     run.Bold,
                Italic:   run.Italic
            );
        }
    }

    private static bool IsDisplayEquation(Word.OMath omath)
    {
        // An OMath is display-mode if it lives inside an OMathPara
        // Check the parent XML context
        return omath.Range.XML.Contains("<m:oMathPara>");
    }
}
```

### Font Grouping

Iterating per-character is the most reliable but slow for large paragraphs. Optimization: use `Range.Find` to locate font boundaries, or iterate `Range.Words` and check font per word.

For production, use character-level grouping with batching — consecutive characters with the same `Font.Name`, `Bold`, and `Italic` are merged into a single `TextNode`.

---

## 9. OMML Extraction from COM Objects

```csharp
// Core/Equations/OmmlExtractor.cs
public static class OmmlExtractor
{
    private static readonly Regex OmmlPattern =
        new(@"<m:oMath[^>]*>.*?</m:oMath>",
            RegexOptions.Singleline | RegexOptions.Compiled);

    /// <summary>
    /// Extracts the raw <m:oMath>...</m:oMath> XML from a range's OOXML fragment.
    /// Range.XML returns the full OOXML fragment including surrounding w:p, w:r etc.
    /// </summary>
    public static string? ExtractOmmlElement(Word.OMath omath)
    {
        try
        {
            string ooxml = omath.Range.XML;
            var match = OmmlPattern.Match(ooxml);
            return match.Success ? match.Value : null;
        }
        catch (COMException)
        {
            return null; // OLE equation or embedded object — not OMML
        }
    }
}
```

---

## 10. OMML → LaTeX: Three-Path Strategy

Same strategy as the TypeScript plan, implemented in C#:

### Path A — XSLT (Primary)

```csharp
// Core/Equations/OmmlToMathml.cs
public sealed class OmmlToMathml : IDisposable
{
    private static readonly XslCompiledTransform _xslt;

    // Static constructor: load and compile the XSLT once per AppDomain
    static OmmlToMathml()
    {
        _xslt = new XslCompiledTransform(enableDebug: false);
        using var xslStream = typeof(OmmlToMathml).Assembly
            .GetManifestResourceStream("BijoyToLatex.Core.Assets.OMML2MML.XSL")!;
        using var xslReader = XmlReader.Create(xslStream);
        _xslt.Load(xslReader);
    }

    /// <summary>
    /// Transforms an OMML string to MathML.
    /// Returns null if transformation fails or produces empty output.
    /// Enforces a timeout via a cancellation token + Task.Run.
    /// </summary>
    public static async Task<string?> TransformAsync(
        string ommlXml,
        TimeSpan timeout,
        CancellationToken ct = default)
    {
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        cts.CancelAfter(timeout);

        try
        {
            return await Task.Run(() => TransformCore(ommlXml), cts.Token);
        }
        catch (OperationCanceledException)
        {
            return null; // timeout → fall through to Path B
        }
    }

    private static string? TransformCore(string ommlXml)
    {
        using var inputReader = XmlReader.Create(new StringReader(ommlXml));
        var sb = new StringBuilder();
        using var writer = XmlWriter.Create(sb, new XmlWriterSettings { OmitXmlDeclaration = true });
        _xslt.Transform(inputReader, writer);
        var result = sb.ToString();
        return string.IsNullOrWhiteSpace(result) ? null : result;
    }
}
```

### Path B — Direct OMML Walker (Fallback)

```csharp
// Core/Equations/OmmlWalker.cs
public sealed class OmmlWalker
{
    private readonly ConversionOptions _opts;
    private readonly List<ConversionWarning> _warnings;
    private int _paragraphIndex;

    public string Walk(XmlElement node, int depth = 0)
    {
        if (depth > _opts.MaxRecursionDepth)
        {
            AddWarning(WarningType.RecursionLimit, "Max recursion depth exceeded");
            return @"\ldots";
        }

        return node.LocalName switch
        {
            "f"         => HandleFrac(node, depth),
            "nary"      => HandleNary(node, depth),
            "rad"       => HandleRad(node, depth),
            "acc"       => HandleAcc(node, depth),
            "bar"       => HandleBar(node, depth),
            "func"      => HandleFunc(node, depth),
            "eqArr"     => HandleEqArr(node, depth),
            "groupChr"  => HandleGroupChr(node, depth),
            "limLow"    => HandleLimLow(node, depth),
            "limUpp"    => HandleLimUpp(node, depth),
            "sPre"      => HandleSPre(node, depth),
            "sSub"      => HandleSSub(node, depth),
            "sSup"      => HandleSSup(node, depth),
            "sSubSup"   => HandleSSubSup(node, depth),
            "m"         => HandleMatrix(node, depth),
            "d"         => HandleDelimiter(node, depth),
            "borderBox" => HandleBorderBox(node, depth),
            "phant"     => HandlePhantom(node, depth),
            "r"         => HandleRun(node, depth),
            "t"         => node.InnerText,
            "oMath"     => WalkChildren(node, depth),
            _           => WalkChildren(node, depth),
        };
    }

    // ── Fraction ──────────────────────────────────────────────────────────
    private string HandleFrac(XmlElement node, int depth)
    {
        var fPr  = node.SelectSingleNode("m:fPr/m:type", Ns) as XmlElement;
        var num  = node.SelectSingleNode("m:num",  Ns) as XmlElement;
        var den  = node.SelectSingleNode("m:den",  Ns) as XmlElement;
        string n = num is not null ? Walk(num, depth + 1) : "";
        string d = den is not null ? Walk(den, depth + 1) : "";

        return fPr?.GetAttribute("m:val") switch
        {
            "noBar" => n.Length == 1 && d.Length == 1
                         ? $@"\binom{{{n}}}{{{d}}}"
                         : $@"{{{n} \atop {d}}}",
            "lin"   => $"{n}/{d}",
            "skw"   => $@"{{}}^{{{n}}}/{{}}_{{{d}}}",
            _       => $@"\frac{{{n}}}{{{d}}}",
        };
    }

    // ── N-ary (sum, product, integral, etc.) ──────────────────────────────
    private string HandleNary(XmlElement node, int depth)
    {
        var chr     = node.SelectSingleNode("m:naryPr/m:chr", Ns)?.InnerText ?? "∑";
        var subHide = node.SelectSingleNode("m:naryPr/m:subHide", Ns)?.InnerText == "1";
        var supHide = node.SelectSingleNode("m:naryPr/m:supHide", Ns)?.InnerText == "1";
        var sub     = node.SelectSingleNode("m:sub", Ns) as XmlElement;
        var sup     = node.SelectSingleNode("m:sup", Ns) as XmlElement;
        var body    = node.SelectSingleNode("m:e",   Ns) as XmlElement;

        string cmd  = NaryMap.TryGetValue(chr, out var c) ? c : $@"\operatorname{{{chr}}}";
        string lo   = (!subHide && sub is not null) ? $"_{{{Walk(sub, depth+1)}}}" : "";
        string hi   = (!supHide && sup is not null) ? $"^{{{Walk(sup, depth+1)}}}" : "";
        string e    = body is not null ? Walk(body, depth + 1) : "";

        return $@"{cmd}{lo}{hi}{e}";
    }

    // ── Radical ───────────────────────────────────────────────────────────
    private string HandleRad(XmlElement node, int depth)
    {
        var degHide = node.SelectSingleNode("m:radPr/m:degHide", Ns)?.InnerText == "1";
        var deg     = node.SelectSingleNode("m:deg", Ns) as XmlElement;
        var body    = node.SelectSingleNode("m:e",   Ns) as XmlElement;
        string e    = body is not null ? Walk(body, depth + 1) : "";

        if (degHide || deg is null || string.IsNullOrWhiteSpace(deg.InnerText))
            return $@"\sqrt{{{e}}}";
        return $@"\sqrt[{Walk(deg, depth + 1)}]{{{e}}}";
    }

    // ── Accent ────────────────────────────────────────────────────────────
    private string HandleAcc(XmlElement node, int depth)
    {
        var chr  = node.SelectSingleNode("m:accPr/m:chr", Ns)?.InnerText ?? "\u0302";
        var body = node.SelectSingleNode("m:e", Ns) as XmlElement;
        string e = body is not null ? Walk(body, depth + 1) : "";
        string cmd = AccentMap.GetCommand(chr);
        return $@"{cmd}{{{e}}}";
    }

    // ── Bar (overline / underline) ─────────────────────────────────────────
    private string HandleBar(XmlElement node, int depth)
    {
        var pos  = node.SelectSingleNode("m:barPr/m:pos", Ns)?.InnerText ?? "top";
        var body = node.SelectSingleNode("m:e", Ns) as XmlElement;
        string e = body is not null ? Walk(body, depth + 1) : "";
        return pos == "bot" ? $@"\underline{{{e}}}" : $@"\overline{{{e}}}";
    }

    // ── Function Application ───────────────────────────────────────────────
    private string HandleFunc(XmlElement node, int depth)
    {
        var fname = node.SelectSingleNode("m:fName", Ns) as XmlElement;
        var body  = node.SelectSingleNode("m:e",     Ns) as XmlElement;
        string fn = fname is not null ? Walk(fname, depth + 1).Trim() : "";
        string e  = body  is not null ? Walk(body,  depth + 1) : "";

        // If the function name is a known operator, use it directly
        if (OperatorMap.ContainsKey(fn))
            return $@"{OperatorMap[fn]}{{{e}}}";

        return $@"\operatorname{{{fn}}}{{{e}}}";
    }

    // ── Equation Array ─────────────────────────────────────────────────────
    private string HandleEqArr(XmlElement node, int depth)
    {
        var rows = node.SelectNodes("m:e", Ns)!
            .Cast<XmlElement>()
            .Select(e => Walk(e, depth + 1));

        return @"\begin{aligned}" + "\n"
             + string.Join(@" \\" + "\n", rows) + "\n"
             + @"\end{aligned}";
    }

    // ── Group Character (underbrace/overbrace) ─────────────────────────────
    private string HandleGroupChr(XmlElement node, int depth)
    {
        var chr  = node.SelectSingleNode("m:groupChrPr/m:chr", Ns)?.InnerText ?? "⏟";
        var pos  = node.SelectSingleNode("m:groupChrPr/m:pos", Ns)?.InnerText ?? "bot";
        var body = node.SelectSingleNode("m:e", Ns) as XmlElement;
        string e = body is not null ? Walk(body, depth + 1) : "";

        return (chr, pos) switch
        {
            ("⏟", "bot") or ("_", "bot") => $@"\underbrace{{{e}}}",
            ("⏞", "top") or ("^", "top") => $@"\overbrace{{{e}}}",
            ("→", "top")                  => $@"\overrightarrow{{{e}}}",
            ("←", "top")                  => $@"\overleftarrow{{{e}}}",
            ("↔", "top")                  => $@"\overleftrightarrow{{{e}}}",
            _                             => $@"\overset{{{chr}}}{{{e}}}",
        };
    }

    // ── Limit (lower) ──────────────────────────────────────────────────────
    private string HandleLimLow(XmlElement node, int depth)
    {
        var e   = node.SelectSingleNode("m:e",   Ns) as XmlElement;
        var lim = node.SelectSingleNode("m:lim", Ns) as XmlElement;
        string b = e   is not null ? Walk(e,   depth + 1) : "";
        string l = lim is not null ? Walk(lim, depth + 1) : "";
        // If b is a known large operator, use subscript; otherwise \underset
        return IsLargeOperator(b)
            ? $@"{b}_{{{l}}}"
            : $@"\underset{{{l}}}{{{b}}}";
    }

    // ── Limit (upper) ──────────────────────────────────────────────────────
    private string HandleLimUpp(XmlElement node, int depth)
    {
        var e   = node.SelectSingleNode("m:e",   Ns) as XmlElement;
        var lim = node.SelectSingleNode("m:lim", Ns) as XmlElement;
        string b = e   is not null ? Walk(e,   depth + 1) : "";
        string l = lim is not null ? Walk(lim, depth + 1) : "";
        return IsLargeOperator(b)
            ? $@"{b}^{{{l}}}"
            : $@"\overset{{{l}}}{{{b}}}";
    }

    // ── Pre-Scripts (nuclear notation) ────────────────────────────────────
    private string HandleSPre(XmlElement node, int depth)
    {
        var sub  = node.SelectSingleNode("m:sub", Ns) as XmlElement;
        var sup  = node.SelectSingleNode("m:sup", Ns) as XmlElement;
        var body = node.SelectSingleNode("m:e",   Ns) as XmlElement;
        string b = body is not null ? Walk(body, depth + 1) : "";
        string lo = sub is not null ? $"_{{{Walk(sub, depth + 1)}}}" : "";
        string hi = sup is not null ? $"^{{{Walk(sup, depth + 1)}}}" : "";
        return $@"{{}}{lo}{hi}{b}";
    }

    // ── Subscript ─────────────────────────────────────────────────────────
    private string HandleSSub(XmlElement node, int depth)
    {
        var e   = node.SelectSingleNode("m:e",   Ns) as XmlElement;
        var sub = node.SelectSingleNode("m:sub", Ns) as XmlElement;
        string b = e   is not null ? Walk(e,   depth + 1) : "";
        string s = sub is not null ? Walk(sub, depth + 1) : "";
        return $@"{b}_{{{s}}}";
    }

    // ── Superscript ───────────────────────────────────────────────────────
    private string HandleSSup(XmlElement node, int depth)
    {
        var e   = node.SelectSingleNode("m:e",   Ns) as XmlElement;
        var sup = node.SelectSingleNode("m:sup", Ns) as XmlElement;
        string b = e   is not null ? Walk(e,   depth + 1) : "";
        string s = sup is not null ? Walk(sup, depth + 1) : "";
        return $@"{b}^{{{s}}}";
    }

    // ── Sub+Superscript ───────────────────────────────────────────────────
    private string HandleSSubSup(XmlElement node, int depth)
    {
        var e   = node.SelectSingleNode("m:e",   Ns) as XmlElement;
        var sub = node.SelectSingleNode("m:sub", Ns) as XmlElement;
        var sup = node.SelectSingleNode("m:sup", Ns) as XmlElement;
        string b = e   is not null ? Walk(e,   depth + 1) : "";
        string lo = sub is not null ? $"_{{{Walk(sub, depth + 1)}}}" : "";
        string hi = sup is not null ? $"^{{{Walk(sup, depth + 1)}}}" : "";
        return $@"{b}{lo}{hi}";
    }

    // ── Matrix ────────────────────────────────────────────────────────────
    private string HandleMatrix(XmlElement node, int depth)
    {
        // Matrix environment determined by the surrounding m:d delimiter
        // Default to pmatrix; overridden by caller context
        string env = _matrixEnvStack.Count > 0 ? _matrixEnvStack.Peek() : "pmatrix";

        var rows = node.SelectNodes("m:mr", Ns)!.Cast<XmlElement>();
        var sb   = new StringBuilder();
        sb.AppendLine($@"\begin{{{env}}}");

        foreach (var row in rows)
        {
            var cells = row.SelectNodes("m:e", Ns)!
                           .Cast<XmlElement>()
                           .Select(e => Walk(e, depth + 1));
            sb.AppendLine(string.Join(" & ", cells) + @" \\");
        }
        sb.AppendLine($@"\end{{{env}}}");
        return sb.ToString();
    }

    // ── Delimiter ─────────────────────────────────────────────────────────
    private string HandleDelimiter(XmlElement node, int depth)
    {
        var beg = node.SelectSingleNode("m:dPr/m:begChr", Ns)?.InnerText ?? "(";
        var end = node.SelectSingleNode("m:dPr/m:endChr", Ns)?.InnerText ?? ")";

        string latexBeg = DelimiterMap.GetLeft(beg);
        string latexEnd = DelimiterMap.GetRight(end);

        // Determine matrix environment from delimiter
        string env = (beg, end) switch
        {
            ("(", ")") => "pmatrix",
            ("[", "]") => "bmatrix",
            ("{", "}") => "Bmatrix",
            ("|", "|") => "vmatrix",
            ("‖", "‖") => "Vmatrix",
            _          => "matrix",
        };

        // Check if content is a matrix — if so, push env and render as matrix
        var inner = node.SelectNodes("m:e", Ns)!.Cast<XmlElement>().ToList();
        if (inner.Count == 1 && inner[0].SelectSingleNode("m:m", Ns) is XmlElement matrix)
        {
            _matrixEnvStack.Push(env);
            string result = HandleMatrix(matrix, depth + 1);
            _matrixEnvStack.Pop();
            return result;
        }

        // Otherwise render as delimited expression
        string content = string.Join("", inner.Select(e => Walk(e, depth + 1)));
        return $@"\left{latexBeg} {content} \right{latexEnd}";
    }

    // ── Border Box ────────────────────────────────────────────────────────
    private string HandleBorderBox(XmlElement node, int depth)
    {
        var body = node.SelectSingleNode("m:e", Ns) as XmlElement;
        string e = body is not null ? Walk(body, depth + 1) : "";
        return $@"\boxed{{{e}}}";
    }

    // ── Phantom ───────────────────────────────────────────────────────────
    private string HandlePhantom(XmlElement node, int depth)
    {
        var body = node.SelectSingleNode("m:e", Ns) as XmlElement;
        string e = body is not null ? Walk(body, depth + 1) : "";
        return $@"\phantom{{{e}}}";
    }

    // ── Math Run ──────────────────────────────────────────────────────────
    private string HandleRun(XmlElement node, int depth)
    {
        var rPr  = node.SelectSingleNode("m:rPr", Ns) as XmlElement;
        var text = node.SelectSingleNode("m:t",   Ns)?.InnerText ?? "";

        // Apply mathvariant / font style
        string sty = rPr?.SelectSingleNode("m:sty", Ns)?.GetAttribute("m:val") ?? "";
        string? fontWrapper = sty switch
        {
            "b"  => @"\mathbf",
            "i"  => @"\mathit",
            "bi" => @"\boldsymbol",
            _    => null,
        };

        // Resolve Greek, arrows, and operators
        string resolved = ResolveSymbols(text);

        return fontWrapper is not null ? $@"{fontWrapper}{{{resolved}}}" : resolved;
    }

    // ── Helpers ───────────────────────────────────────────────────────────
    private string WalkChildren(XmlElement node, int depth)
        => string.Concat(
               node.ChildNodes.Cast<XmlNode>()
                   .OfType<XmlElement>()
                   .Select(c => Walk(c, depth + 1)));

    private static bool IsLargeOperator(string latex)
        => latex is @"\sum" or @"\prod" or @"\coprod"
                or @"\int" or @"\iint" or @"\iiint" or @"\oint"
                or @"\bigcup" or @"\bigcap" or @"\bigoplus" or @"\bigotimes"
                or @"\bigvee" or @"\bigwedge" or @"\biguplus" or @"\bigodot";

    private readonly Stack<string> _matrixEnvStack = new();

    private static readonly XmlNamespaceManager Ns = BuildNs();
    private static XmlNamespaceManager BuildNs()
    {
        var nt = new NameTable();
        var ns = new XmlNamespaceManager(nt);
        ns.AddNamespace("m", "http://schemas.openxmlformats.org/officeDocument/2006/math");
        ns.AddNamespace("w", "http://schemas.openxmlformats.org/wordprocessingml/2006/main");
        return ns;
    }
}
```

---

## 11. MathML Walker

```csharp
// Core/Equations/MathmlWalker.cs
public sealed class MathmlWalker
{
    private readonly ConversionOptions _opts;
    private readonly List<ConversionWarning> _warnings;
    private int _depth;

    public string Walk(XmlElement node)
    {
        if (++_depth > _opts.MaxRecursionDepth)
        {
            AddWarning(WarningType.RecursionLimit, "Recursion depth exceeded in MathML walker");
            _depth--;
            return @"\ldots";
        }

        try
        {
            return node.LocalName switch
            {
                "math"          => WalkChildren(node),
                "mrow"          => WalkMrow(node),
                "mi"            => WalkMi(node),
                "mn"            => node.InnerText,
                "mo"            => WalkMo(node),
                "mtext"         => $@"\text{{{node.InnerText}}}",
                "ms"            => $@"\text{{""{node.InnerText}""}}",
                "mspace"        => WalkMspace(node),
                "mglyph"        => node.GetAttribute("alt"),
                "mfrac"         => WalkMfrac(node),
                "msqrt"         => $@"\sqrt{{{WalkChildren(node)}}}",
                "mroot"         => WalkMroot(node),
                "mstyle"        => WalkMstyle(node),
                "merror"        => $@"\text{{[error: {node.InnerText}]}}",
                "mpadded"       => WalkChildren(node),
                "mphantom"      => $@"\phantom{{{WalkChildren(node)}}}",
                "mfenced"       => WalkMfenced(node),
                "menclose"      => WalkMenclose(node),
                "msub"          => WalkMsub(node),
                "msup"          => WalkMsup(node),
                "msubsup"       => WalkMsubsup(node),
                "munder"        => WalkMunder(node),
                "mover"         => WalkMover(node),
                "munderover"    => WalkMunderover(node),
                "mmultiscripts" => WalkMmultiscripts(node),
                "mtable"        => WalkMtable(node),
                "mtr"           => WalkMtr(node),
                "mtd"           => WalkChildren(node),
                "mlabeledtr"    => WalkMtr(node, skipFirst: true),
                "maligngroup"   => "&",
                "malignmark"    => "&",
                _               => WalkChildren(node),
            };
        }
        finally
        {
            _depth--;
        }
    }

    // ── Identifiers ────────────────────────────────────────────────────────
    private string WalkMi(XmlElement node)
    {
        var text = node.InnerText;
        // Greek lookup first
        if (GreekMap.TryGet(text, out var greek)) return greek;
        // Blackboard bold (unicode single chars)
        if (BlackboardMap.TryGet(text, out var bb)) return bb;
        // mathvariant attribute
        var variant = node.GetAttribute("mathvariant");
        if (!string.IsNullOrEmpty(variant) && FontStyleMap.TryGet(variant, out var fn))
            return fn(text);
        return text;
    }

    // ── Operators ─────────────────────────────────────────────────────────
    private string WalkMo(XmlElement node)
    {
        var text = node.InnerText.Trim();
        if (OperatorMap.TryGet(text, out var op)) return op;
        if (ArrowMap.TryGet(text, out var arr))   return arr;
        // Stretchy delimiters are handled via \left/\right in mfenced
        return text;
    }

    // ── Space ─────────────────────────────────────────────────────────────
    private static string WalkMspace(XmlElement node)
    {
        var width = node.GetAttribute("width");
        return SpaceMap.TryGet(width, out var sp) ? sp : "";
    }

    // ── Fraction ──────────────────────────────────────────────────────────
    private string WalkMfrac(XmlElement node)
    {
        var children = Children(node);
        if (children.Count < 2) return WalkChildren(node);

        var lineThickness = node.GetAttribute("linethickness");
        string num = Walk(children[0]);
        string den = Walk(children[1]);

        if (lineThickness == "0")
            return $@"\binom{{{num}}}{{{den}}}";

        return $@"\frac{{{num}}}{{{den}}}";
    }

    // ── Root ───────────────────────────────────────────────────────────────
    private string WalkMroot(XmlElement node)
    {
        var children = Children(node);
        string base_ = children.Count > 0 ? Walk(children[0]) : "";
        string index = children.Count > 1 ? Walk(children[1]) : "";
        return string.IsNullOrWhiteSpace(index)
            ? $@"\sqrt{{{base_}}}"
            : $@"\sqrt[{index}]{{{base_}}}";
    }

    // ── Style ──────────────────────────────────────────────────────────────
    private string WalkMstyle(XmlElement node)
    {
        string inner = WalkChildren(node);
        var variant  = node.GetAttribute("mathvariant");
        var display  = node.GetAttribute("displaystyle");
        var level    = node.GetAttribute("scriptlevel");

        if (!string.IsNullOrEmpty(variant) && FontStyleMap.TryGet(variant, out var fn))
            inner = fn(inner);
        if (display == "true")
            inner = @"\displaystyle " + inner;
        if (level == "+1")
            inner = @"\scriptstyle " + inner;
        if (level == "+2")
            inner = @"\scriptscriptstyle " + inner;

        return inner;
    }

    // ── Fenced ────────────────────────────────────────────────────────────
    private string WalkMfenced(XmlElement node)
    {
        string open  = node.GetAttribute("open")  is { Length: > 0 } o ? o : "(";
        string close = node.GetAttribute("close") is { Length: > 0 } c ? c : ")";
        string sep   = node.GetAttribute("separators") is { Length: > 0 } s ? s : ",";

        string latexOpen  = DelimiterMap.GetLeft(open);
        string latexClose = DelimiterMap.GetRight(close);

        var rows = Children(node).Select(Walk);
        string content = string.Join($" {(sep == "," ? "," : @" \mid ")} ", rows);
        return $@"\left{latexOpen} {content} \right{latexClose}";
    }

    // ── Menclose ──────────────────────────────────────────────────────────
    private string WalkMenclose(XmlElement node)
    {
        string inner    = WalkChildren(node);
        string notation = node.GetAttribute("notation");
        var notations   = notation.Split(' ', StringSplitOptions.RemoveEmptyEntries);

        // Apply notations innermost-first
        foreach (var n in notations)
        {
            inner = n switch
            {
                "longdiv"         => $@"\overline{{{inner}}}",
                "actuarial"       => $@"\overline{{{inner}}}",
                "radical"         => $@"\sqrt{{{inner}}}",
                "box"             => $@"\boxed{{{inner}}}",
                "roundedbox"      => $@"\boxed{{{inner}}}",
                "circle"          => $@"\boxed{{{inner}}}",
                "left"            => $@"\left\vert {inner}",
                "right"           => $@"{inner} \right\vert",
                "top"             => $@"\overline{{{inner}}}",
                "bottom"          => $@"\underline{{{inner}}}",
                "updiagonalstrike"=> $@"\cancel{{{inner}}}",
                "downdiagonalstrike" => $@"\bcancel{{{inner}}}",
                "verticalstrike"  => $@"\hcancel{{{inner}}}",
                "horizontalstrike"=> $@"\xcancel{{{inner}}}",
                "madruwb"         => $@"\overline{{{inner}}}",
                "phasorangle"     => $@"\angle {inner}",
                _                 => inner,
            };
        }
        return inner;
    }

    // ── Sub / Sup ─────────────────────────────────────────────────────────
    private string WalkMsub(XmlElement node)
    {
        var c = Children(node);
        return $@"{(c.Count > 0 ? Walk(c[0]) : "")}_{{{(c.Count > 1 ? Walk(c[1]) : "")}}}";
    }

    private string WalkMsup(XmlElement node)
    {
        var c = Children(node);
        return $@"{(c.Count > 0 ? Walk(c[0]) : "")}^{{{(c.Count > 1 ? Walk(c[1]) : "")}}}";
    }

    private string WalkMsubsup(XmlElement node)
    {
        var c = Children(node);
        string b  = c.Count > 0 ? Walk(c[0]) : "";
        string lo = c.Count > 1 ? Walk(c[1]) : "";
        string hi = c.Count > 2 ? Walk(c[2]) : "";
        return $@"{b}_{{{lo}}}^{{{hi}}}";
    }

    // ── Under / Over ──────────────────────────────────────────────────────
    private string WalkMunder(XmlElement node)
    {
        var c = Children(node);
        string b  = c.Count > 0 ? Walk(c[0]) : "";
        string lo = c.Count > 1 ? Walk(c[1]) : "";
        return IsLargeOp(b) ? $@"{b}_{{{lo}}}" : $@"\underset{{{lo}}}{{{b}}}";
    }

    private string WalkMover(XmlElement node)
    {
        var c = Children(node);
        string b  = c.Count > 0 ? Walk(c[0]) : "";
        string hi = c.Count > 1 ? Walk(c[1]) : "";
        // Single-char accent
        if (AccentMap.IsAccentChar(hi) && Walk(c[0]).Length == 1)
            return $@"{AccentMap.GetCommand(hi)}{{{b}}}";
        return IsLargeOp(b) ? $@"{b}^{{{hi}}}" : $@"\overset{{{hi}}}{{{b}}}";
    }

    private string WalkMunderover(XmlElement node)
    {
        var c = Children(node);
        string b  = c.Count > 0 ? Walk(c[0]) : "";
        string lo = c.Count > 1 ? Walk(c[1]) : "";
        string hi = c.Count > 2 ? Walk(c[2]) : "";
        return IsLargeOp(b)
            ? $@"{b}_{{{lo}}}^{{{hi}}}"
            : $@"\underset{{{lo}}}{{\overset{{{hi}}}{{{b}}}}}";
    }

    // ── Multiscripts ──────────────────────────────────────────────────────
    private string WalkMmultiscripts(XmlElement node)
    {
        var children = Children(node);
        if (children.Count == 0) return "";

        string b = Walk(children[0]);
        var postSubs = new List<string>();
        var postSups = new List<string>();
        var preSubs  = new List<string>();
        var preSups  = new List<string>();

        bool inPre = false;
        for (int i = 1; i < children.Count; i++)
        {
            if (children[i].LocalName == "mprescripts") { inPre = true; continue; }
            string val = Walk(children[i]);
            bool isSub = (i % 2 == 1) ^ inPre; // odd = sub (post), even = sup (post)
            if (inPre) { if (isSub) preSubs.Add(val); else preSups.Add(val); }
            else       { if (isSub) postSubs.Add(val); else postSups.Add(val); }
        }

        string pre  = BuildScripts(preSubs,  preSups);
        string post = BuildScripts(postSubs, postSups);
        return $@"{{}}{pre}{b}{post}";
    }

    // ── Table ─────────────────────────────────────────────────────────────
    private string WalkMtable(XmlElement node)
    {
        // Check if this is an aligned table (cases, aligned, array)
        var colAlign = node.GetAttribute("columnalign");
        bool isAligned = colAlign.Contains("left");

        var rows = node.SelectNodes("mtr | mlabeledtr", Ns)!.Cast<XmlElement>();
        bool isCases = IsCasesTable(node);

        if (isCases)
        {
            var sb = new StringBuilder(@"\begin{cases}" + "\n");
            foreach (var row in rows)
            {
                var cells = Children(row).Select(Walk).ToList();
                sb.AppendLine(cells.Count >= 2
                    ? $@"{cells[0]} & {cells[1]} \\"
                    : $@"{cells.FirstOrDefault() ?? ""} \\");
            }
            sb.Append(@"\end{cases}");
            return sb.ToString();
        }

        if (isAligned)
        {
            var sb = new StringBuilder(@"\begin{aligned}" + "\n");
            foreach (var row in rows)
                sb.AppendLine(string.Join(" & ", Children(row).Select(Walk)) + @" \\");
            sb.Append(@"\end{aligned}");
            return sb.ToString();
        }

        // Default: generic array
        int cols = rows.FirstOrDefault()?.ChildNodes.Count ?? 1;
        string spec = string.Concat(Enumerable.Repeat("c", cols));
        var sb2 = new StringBuilder($@"\begin{{array}}{{{spec}}}" + "\n");
        foreach (var row in rows)
            sb2.AppendLine(string.Join(" & ", Children(row).Select(Walk)) + @" \\");
        sb2.Append(@"\end{array}");
        return sb2.ToString();
    }

    private static bool IsCasesTable(XmlElement node)
    {
        // Heuristic: 2 columns, left column is math, right column starts with text/condition
        var firstRow = node.SelectSingleNode("mtr", Ns) as XmlElement;
        if (firstRow is null) return false;
        var cells = Children(firstRow);
        if (cells.Count != 2) return false;
        string rightText = cells[1].InnerText;
        return rightText.StartsWith("if", StringComparison.OrdinalIgnoreCase)
            || rightText.StartsWith("when", StringComparison.OrdinalIgnoreCase)
            || rightText.StartsWith("for", StringComparison.OrdinalIgnoreCase)
            || rightText.Contains("যদি")     // Bangla "if"
            || rightText.Contains("হলে");    // Bangla "when"
    }

    // ── Helpers ───────────────────────────────────────────────────────────
    private string WalkChildren(XmlElement node)
        => string.Concat(Children(node).Select(Walk));

    private string WalkMrow(XmlElement node) => WalkChildren(node);

    private string WalkMtr(XmlElement node, bool skipFirst = false)
    {
        var cells = Children(node);
        if (skipFirst && cells.Count > 0) cells = cells.Skip(1).ToList();
        return string.Join(" & ", cells.Select(Walk));
    }

    private static List<XmlElement> Children(XmlElement node)
        => node.ChildNodes.Cast<XmlNode>().OfType<XmlElement>().ToList();

    private static string BuildScripts(List<string> subs, List<string> sups)
    {
        var sb = new StringBuilder();
        int count = Math.Max(subs.Count, sups.Count);
        for (int i = 0; i < count; i++)
        {
            if (i < subs.Count && subs[i] != "none") sb.Append($"_{{{subs[i]}}}");
            if (i < sups.Count && sups[i] != "none") sb.Append($"^{{{sups[i]}}}");
        }
        return sb.ToString();
    }

    private static bool IsLargeOp(string latex)
        => latex is @"\sum" or @"\prod" or @"\coprod"
                or @"\int" or @"\iint" or @"\iiint" or @"\oint"
                or @"\bigcup" or @"\bigcap" or @"\bigoplus" or @"\bigotimes"
                or @"\bigvee" or @"\bigwedge" or @"\biguplus" or @"\bigodot";

    private static readonly XmlNamespaceManager Ns = BuildNs();
    private static XmlNamespaceManager BuildNs()
    {
        var nt = new NameTable();
        var ns = new XmlNamespaceManager(nt);
        ns.AddNamespace("m", "http://www.w3.org/1998/Math/MathML");
        return ns;
    }
}
```

---

## 12. Bijoy Engine (C#)

### BijoyDetector

```csharp
// Core/Bijoy/BijoyDetector.cs
public static class BijoyDetector
{
    private static readonly HashSet<string> ExactNames = new(StringComparer.OrdinalIgnoreCase)
    {
        "SutonnyMJ",       "SutonnyOMJ",
        "SutonnyMJBold",   "SutonnyOMJBold",
        "BijoyBaijayanta", "BijoyBaijayantaMJ",
        "Bijoy",           "BijoyMJ",
        "BanglaBijoy",     "AdorshoLipi",
        "Adorsho Lipi",    "MuktinarrowBT",
        "Rupali",          "Charukola",
        "Siyam Rupali",    "Nikosh",
    };

    private static readonly string[] SubstringMarkers =
        ["sutonny", "bijoy", "adorsho", "charukola"];

    // Bijoy-specific codepoints that never appear in Unicode Bangla/English
    private static readonly Regex HeuristicPattern =
        new(@"[\u0097\u009C-\u009F\u00A0-\u00BF]",
            RegexOptions.Compiled);

    public static bool IsBijoyFont(string? fontName)
    {
        if (fontName is null) return false;
        if (ExactNames.Contains(fontName)) return true;
        string lower = fontName.ToLowerInvariant();
        return SubstringMarkers.Any(m => lower.Contains(m));
    }

    public static bool HasBijoyMarkers(string text)
        => HeuristicPattern.IsMatch(text);
}
```

### BijoyConverter

```csharp
// Core/Bijoy/BijoyConverter.cs
public static class BijoyConverter
{
    // Stage 2: loaded from embedded bijoy_charmap.json
    private static readonly IReadOnlyDictionary<char, string> CharMap;

    // Stage 1: multi-char sequences, sorted longest-first
    private static readonly (Regex Pattern, string Replacement)[] MultiCharSeq;

    static BijoyConverter()
    {
        CharMap = LoadCharMap();
        MultiCharSeq = BuildMultiCharSeq();
    }

    public static (string Unicode, IEnumerable<string> Warnings) Convert(string bijoy)
    {
        var warnings = new List<string>();

        // Stage 1: multi-char sequences
        string s = ApplyMultiChar(bijoy);

        // Stage 2: single-char lookup
        var sb = new StringBuilder(s.Length * 2);
        foreach (char c in s)
        {
            if (CharMap.TryGetValue(c, out string? mapped))
                sb.Append(mapped);
            else if (c > 127)
            {
                warnings.Add($"Unknown Bijoy char U+{(int)c:X4}");
                sb.Append(c); // pass through
            }
            else
                sb.Append(c); // ASCII pass-through (numbers, punctuation)
        }

        // Stage 3: vowel sign reorder
        string reordered = ReorderVowelSigns(sb.ToString());

        // Stage 4: NFC normalize + cleanup
        string result = Normalize(reordered);

        return (result, warnings);
    }

    private static string ReorderVowelSigns(string text)
    {
        // Primary reorder: vowel sign BEFORE consonant → consonant + vowel sign
        text = Regex.Replace(text,
            @"([েৈো])([\u09A6-\u09B9\u09DC-\u09DF\u09CE](?:্[\u09A6-\u09B9\u09DC-\u09DF])?)",
            "$2$1", RegexOptions.None);

        // Reph reorder: র্ + vowel + consonant → র্ + consonant + vowel
        text = Regex.Replace(text,
            @"(র্)([েৈো])([\u09A6-\u09B9])",
            "$1$3$2", RegexOptions.None);

        return text;
    }

    private static string Normalize(string text)
    {
        // Remove orphan hasanta at word boundary
        text = Regex.Replace(text, @"্(?=\s|$)", "");
        // Collapse redundant ZWNJs
        text = Regex.Replace(text, @"\u200C{2,}", "\u200C");
        return text.Normalize(NormalizationForm.FormC);
    }
}
```

---

## 13. Multi-Column Table Parser

```csharp
// Core/Walker/TableParser.cs
public sealed class TableParser
{
    private readonly ParagraphParser _paraParser;

    public TableType Classify(Word.Table table)
    {
        if (IsOptionTable(table)) return TableType.Option;
        if (IsLayoutTable(table)) return TableType.Layout;
        return TableType.Data;
    }

    private static bool IsOptionTable(Word.Table table)
    {
        // An option table's first non-empty cell starts with an option marker
        try
        {
            string firstCellText = table.Cell(1, 1).Range.Text.Trim();
            return OptionDetector.StartsWithOptionMarker(firstCellText)
                || OptionDetector.StartsWithBanglaOptionMarker(firstCellText);
        }
        catch { return false; }
    }

    private static bool IsLayoutTable(Word.Table table)
    {
        if (table.Columns.Count > 3) return false;

        // Layout table: first cell contains a full question paragraph
        try
        {
            foreach (Word.Paragraph para in table.Cell(1, 1).Range.Paragraphs)
            {
                if (QuestionDetector.IsQuestionParagraph(para))
                    return true;
            }
        }
        catch { }
        return false;
    }

    /// <summary>
    /// Extracts options from a 2×2, 2×3, 1×4, or 3×2 option table.
    /// Reads cells in left-to-right, top-to-bottom order.
    /// </summary>
    public IReadOnlyList<string> ExtractOptions(Word.Table table)
    {
        var options = new List<string>();
        foreach (Word.Row row in table.Rows)
        {
            foreach (Word.Cell cell in row.Cells)
            {
                string text = ProcessCell(cell);
                if (!string.IsNullOrWhiteSpace(text))
                    options.Add(OptionDetector.StripMarker(text));
            }
        }
        return options;
    }

    /// <summary>
    /// Recursively processes a layout table by walking each cell as a mini-document.
    /// </summary>
    public IEnumerable<BodyElement> ExtractLayoutElements(Word.Table table)
    {
        foreach (Word.Row row in table.Rows)
        {
            foreach (Word.Cell cell in row.Cells)
            {
                // Narrow column (< 20% page width) containing only a number → skip
                if (IsNarrowNumberColumn(cell)) continue;

                foreach (Word.Paragraph para in cell.Range.Paragraphs)
                    yield return new ParagraphElement(_paraParser.Parse(para));

                foreach (Word.Table nested in cell.Range.Tables)
                    foreach (var elem in ExtractLayoutElements(nested))
                        yield return elem;
            }
        }
    }

    private static bool IsNarrowNumberColumn(Word.Cell cell)
    {
        // Heuristic: width < 1.5cm and text is purely a number
        const float NarrowCm = 1.5f;
        float widthCm = cell.Width / 567f; // Word units → cm (567 twips per cm)
        string text = cell.Range.Text.Trim('\r', '\n', ' ');
        return widthCm < NarrowCm && Regex.IsMatch(text, @"^[০-৯0-9]+[.)।]?$");
    }
}

public enum TableType { Option, Layout, Data }
```

---

## 14. Question Assembler

The state machine that groups body elements into `Question` records:

```csharp
// Core/Assembler/QuestionAssembler.cs
public sealed class QuestionAssembler
{
    private enum State { Idle, Question, Options }

    private State _state = State.Idle;
    private readonly StringBuilder _questionText = new StringBuilder();
    private readonly List<string> _options = new List<string>();
    private readonly List<Question> _results = new List<Question>();
    private readonly ConversionOptions _opts;

    public IReadOnlyList<Question> Assemble(IEnumerable<BodyElement> elements)
    {
        foreach (var elem in elements)
            ProcessElement(elem);

        FinalizeQuestion(); // flush last question
        return _results;
    }

    private void ProcessElement(BodyElement elem)
    {
        switch (elem)
        {
            case ParagraphElement { ParsedNodes: var nodes } p:
                string text = RenderNodes(nodes);
                ProcessParagraph(text, p);
                break;

            case TableElement t:
                ProcessTable(t);
                break;
        }
    }

    private void ProcessParagraph(string text, ParagraphElement p)
    {
        if (string.IsNullOrWhiteSpace(text) && !p.HasEquations) return;

        bool isQuestion  = QuestionDetector.IsQuestion(p);
        bool isOption    = OptionDetector.IsOption(p);
        bool isSubPart   = QuestionDetector.IsSubPart(p);

        switch (_state)
        {
            case State.Idle:
                if (isQuestion) StartQuestion(text);
                break;

            case State.Question:
                if (isQuestion)           { FinalizeQuestion(); StartQuestion(text); }
                else if (isSubPart)       AppendToQuestion("\n" + text);
                else if (isOption)        { _options.Add(OptionDetector.StripMarker(text)); _state = State.Options; }
                else                      AppendToQuestion(" " + text);
                break;

            case State.Options:
                if (isQuestion)           { FinalizeQuestion(); StartQuestion(text); }
                else if (isOption)        _options.Add(OptionDetector.StripMarker(text));
                else if (string.IsNullOrWhiteSpace(text)) FinalizeQuestion();
                else                      AppendToLastOption(" " + text); // continuation line
                break;
        }
    }

    private void ProcessTable(TableElement t)
    {
        switch (t.Type)
        {
            case TableType.Option:
                // Complete the current question with these options
                if (_state is State.Question or State.Options)
                {
                    foreach (var opt in t.Options) _options.Add(opt);
                    FinalizeQuestion();
                }
                break;

            case TableType.Layout:
                // Recurse — each sub-element is processed as if at body level
                foreach (var sub in t.Elements)
                    ProcessElement(sub);
                break;

            case TableType.Data:
                // Append rendered table to question text
                if (_state == State.Question)
                    AppendToQuestion("\n" + t.RenderedLatex);
                break;
        }
    }

    private void StartQuestion(string text) { _state = State.Question; _questionText.Clear(); _questionText.Append(text); }
    private void AppendToQuestion(string s) => _questionText.Append(s);
    private void AppendToLastOption(string s) { if (_options.Count > 0) _options[^1] += s; }

    private void FinalizeQuestion()
    {
        if (_state == State.Idle) return;
        string q = _questionText.ToString().Trim();
        if (!string.IsNullOrEmpty(q))
            _results.Add(new Question { QuestionText = q, Options = _options.ToList() });
        _questionText.Clear();
        _options.Clear();
        _state = State.Idle;
    }
}
```

---

## 15. WPF Task Pane

```csharp
// BijoyToLatex.AddIn/TaskPane/TaskPaneViewModel.cs
public sealed class TaskPaneViewModel : ObservableObject
{
    private readonly IDocumentProcessor _processor;

    [ObservableProperty] private bool _isConverting;
    [ObservableProperty] private double _progress;
    [ObservableProperty] private string _statusText = "Ready";
    [ObservableProperty] private IReadOnlyList<ConversionWarning> _warnings = new List<ConversionWarning>();
    [ObservableProperty] private string _previewJson = "";
    [ObservableProperty] private ConversionOptions _options = new ConversionOptions();

    public IRelayCommand ConvertCommand { get; }
    public IRelayCommand CopyJsonCommand { get; }
    public IRelayCommand SaveJsonCommand { get; }

    public TaskPaneViewModel(IDocumentProcessor processor)
    {
        _processor = processor;
        ConvertCommand  = new AsyncRelayCommand(ConvertAsync, () => !IsConverting);
        CopyJsonCommand = new RelayCommand(CopyJson, () => !string.IsNullOrEmpty(PreviewJson));
        SaveJsonCommand = new AsyncRelayCommand(SaveJsonAsync, () => !string.IsNullOrEmpty(PreviewJson));
    }

    private async Task ConvertAsync()
    {
        IsConverting = true;
        StatusText   = "Converting…";
        Progress     = 0;

        try
        {
            var doc = Globals.ThisAddIn.GetActiveDocument();
            if (doc is null) { StatusText = "No document open."; return; }

            var progress = new Progress<double>(p => Progress = p);
            var result   = await Task.Run(() => _processor.Process(doc, Options, progress));

            Warnings    = result.Stats.Warnings;
            PreviewJson = JsonSerializer.Serialize(
                result.Questions,
                new JsonSerializerOptions { WriteIndented = true });

            StatusText = $"Done — {result.Stats.TotalQuestions} questions, "
                       + $"{result.Stats.Warnings.Count} warnings";
        }
        catch (Exception ex)
        {
            StatusText = $"Error: {ex.Message}";
        }
        finally
        {
            IsConverting = false;
        }
    }

    private void CopyJson()
        => Clipboard.SetText(PreviewJson);

    private async Task SaveJsonAsync()
    {
        var dlg = new SaveFileDialog { Filter = "JSON files (*.json)|*.json", DefaultExt = "json" };
        if (dlg.ShowDialog() != true) return;
        await File.WriteAllTextAsync(dlg.FileName, PreviewJson, Encoding.UTF8);
        StatusText = $"Saved to {dlg.FileName}";
    }
}
```

### XAML Layout (TaskPaneControl.xaml)

```xml
<UserControl xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <DockPanel>

    <!-- Header -->
    <TextBlock DockPanel.Dock="Top" Text="Bijoy → LaTeX" FontSize="16" Margin="8"/>

    <!-- Options expander -->
    <Expander DockPanel.Dock="Top" Header="Options" Margin="8,0">
      <StackPanel>
        <CheckBox Content="Preserve **bold** / _italic_"
                  IsChecked="{Binding Options.PreserveFormatting}"/>
        <CheckBox Content="Force display equations (\[...\])"
                  IsChecked="{Binding Options.ForceDisplay}"/>
        <CheckBox Content="Force inline equations ($...$)"
                  IsChecked="{Binding Options.ForceInline}"/>
      </StackPanel>
    </Expander>

    <!-- Actions -->
    <StackPanel DockPanel.Dock="Top" Orientation="Horizontal" Margin="8">
      <Button Content="Convert" Width="90" Command="{Binding ConvertCommand}"/>
      <Button Content="Copy JSON" Width="90" Margin="4,0,0,0" Command="{Binding CopyJsonCommand}"/>
      <Button Content="Save JSON…" Width="90" Margin="4,0,0,0" Command="{Binding SaveJsonCommand}"/>
    </StackPanel>

    <!-- Progress -->
    <ProgressBar DockPanel.Dock="Top" Value="{Binding Progress}"
                 Maximum="100" Height="6" Margin="8,0"/>
    <TextBlock DockPanel.Dock="Top" Text="{Binding StatusText}" Margin="8,2"/>

    <!-- Warnings -->
    <GroupBox DockPanel.Dock="Top" Header="Warnings" MaxHeight="120" Margin="8,4">
      <ListBox ItemsSource="{Binding Warnings}"
               DisplayMemberPath="Message" FontSize="11"/>
    </GroupBox>

    <!-- JSON Preview -->
    <GroupBox Header="Preview (first 3 questions)" Margin="8,0,8,8">
      <ScrollViewer>
        <TextBox Text="{Binding PreviewJson}" IsReadOnly="True"
                 FontFamily="Consolas" FontSize="11" TextWrapping="Wrap"/>
      </ScrollViewer>
    </GroupBox>

  </DockPanel>
</UserControl>
```

---

## 16. Symbol Tables (C#)

All symbol lookups are static readonly `Dictionary<string, string>` compiled at startup. Defined in `Core/Equations/Maps/`:

### OperatorMap (partial — full list in source)

```csharp
public static class OperatorMap
{
    private static readonly Dictionary<string, string> Map = new()
    {
        ["×"] = @"\times",        ["÷"] = @"\div",        ["±"] = @"\pm",
        ["∓"] = @"\mp",           ["·"] = @"\cdot",       ["∘"] = @"\circ",
        ["≤"] = @"\leq",          ["≥"] = @"\geq",        ["≠"] = @"\neq",
        ["≈"] = @"\approx",       ["≡"] = @"\equiv",      ["≅"] = @"\cong",
        ["≃"] = @"\simeq",        ["∼"] = @"\sim",        ["≪"] = @"\ll",
        ["≫"] = @"\gg",           ["⊥"] = @"\perp",       ["∥"] = @"\parallel",
        ["∈"] = @"\in",           ["∉"] = @"\notin",      ["⊂"] = @"\subset",
        ["∪"] = @"\cup",          ["∩"] = @"\cap",        ["∅"] = @"\emptyset",
        ["∧"] = @"\land",         ["∨"] = @"\lor",        ["¬"] = @"\lneg",
        ["∀"] = @"\forall",       ["∃"] = @"\exists",     ["∂"] = @"\partial",
        ["∇"] = @"\nabla",        ["∞"] = @"\infty",
        ["…"] = @"\ldots",        ["⋯"] = @"\cdots",      ["⋮"] = @"\vdots",
        ["⋱"] = @"\ddots",        ["∠"] = @"\angle",
        // ... (full list identical to TypeScript plan Section 13)
    };

    public static bool TryGet(string op, [NotNullWhen(true)] out string? latex)
        => Map.TryGetValue(op, out latex);
}
```

### ArrowMap, GreekMap, AccentMap, FontStyleMap, BlackboardMap

Follow the same pattern — static dictionaries with `TryGet` methods.
Full content mirrors the TypeScript plan Section 13 exactly.

---

## 17. Testing Strategy

### Unit Tests (xUnit + FluentAssertions)

| Test Class | Coverage |
|---|---|
| `BijoyDetectorTests` | All 16 exact font names, substring variants, null, heuristic markers |
| `BijoyConverterTests` | Full 256 charmap, reorder (simple/reph/conjunct), hasanta, chandrabindu, nukta |
| `OmmlWalkerTests` | Every `switch` branch in `OmmlWalker.Walk` with inline XML strings |
| `OmmlToMathmlTests` | XSLT transforms valid OMML → expected MathML for each type |
| `MathmlWalkerTests` | Every `switch` branch in `MathmlWalker.Walk` including `mmultiscripts`, all `menclose` types, all `mstyle` variants |
| `TableParserTests` | Option/Layout/Data classification, 2×2/3×2/1×4 layouts, narrow column detection |
| `QuestionDetectorTests` | Bangla+English numerals, list paragraphs, sub-parts |
| `OptionDetectorTests` | A/B/C/D, ক/খ/গ/ঘ, i/ii/iii/iv, embedded options in single paragraph |
| `QuestionAssemblerTests` | All 8 state machine transitions, layout table recursion, page-break continuity |

### Integration Tests

Integration tests for the add-in use **saved `.docx` fixture files** processed via `DocumentFormat.OpenXml` (OpenXML SDK) instead of the live COM object model. The `WordDocumentAdapter` interface is abstracted behind `IDocumentAdapter`, and an `OpenXmlDocumentAdapter` implements it for testing — no Word installation required in CI.

| Fixture file | Tests |
|---|---|
| All 24 fixtures from TypeScript plan Section 20 | Same coverage targets |

### COM Interop Tests (manual / integration)

For the VSTO layer itself (task pane, ribbon, COM object access), use Word automation tests in Visual Studio's built-in test runner with a live Word instance. These are tagged `[Trait("Category", "RequiresWord")]` and excluded from CI.

### Coverage Targets

| Metric | Target |
|---|---|
| Statement coverage (Core library) | ≥ 90% |
| Branch coverage (Core library) | ≥ 85% |
| OMML element coverage | 100% of Section 11 list |
| MathML element coverage | 100% of Section 12 list |
| Bijoy character accuracy | ≥ 99% |
| Multi-column layout detection | 100% on known patterns |

---

## 18. OLE Equation Handling (Word 2007 / Legacy Documents)

Before OMML was introduced in Office 2007, equations were inserted as **OLE objects** using:

- **Equation Editor 2.x** (built into Word 97–2003; also present in Word 2007/2010)
- **MathType** (third-party; produces OLE objects or, in newer versions, OMML)

These are **not** `m:oMath` nodes — they are `<w:object>` / `<w:pict>` elements with `InlineShape.OLEFormat.ProgID` like `"Equation.3"` or `"MathType.6"`.

### Detection

```csharp
// Core/Walker/ParagraphParser.cs (addition)
private IEnumerable<DocNode> DetectOleEquations(Word.Paragraph paragraph)
{
    foreach (Word.InlineShape shape in paragraph.Range.InlineShapes)
    {
        if (shape.Type != Word.WdInlineShapeType.wdInlineShapeEmbeddedOLEObject)
            continue;

        string progId = "";
        try { progId = shape.OLEFormat.ProgID ?? ""; }
        catch (COMException) { }

        if (progId.StartsWith("Equation.", StringComparison.OrdinalIgnoreCase) ||
            progId.StartsWith("MathType.",  StringComparison.OrdinalIgnoreCase))
        {
            yield return new OleEquationNode(shape.Range.Start);
        }
    }
}
```

### Handling Strategy

| OLE type | Action |
|---|---|
| `Equation.3` (Equation Editor 2.x / 3.x) | Emit `[equation]` + `OleEquation` warning. Binary format is undocumented and not decodable without Equation Editor installed. |
| `MathType.6` / `MathType.7` | Same — MathType's binary OLE format is proprietary. Emit `[equation]` + warning. |
| `MathType.MTEF` (if saved with OMML alt text) | Some MathType versions embed an OMML representation as alt text in `shape.AlternativeText`. **Try to extract it first** before falling back to `[equation]`. |

```csharp
private string TryExtractMathTypeOmml(Word.InlineShape shape)
{
    // MathType 6.9+ can save an OMML representation in the shape's alt text
    try
    {
        string altText = shape.AlternativeText ?? "";
        if (altText.Contains("<m:oMath"))
            return altText;  // valid OMML — process via normal equation pipeline
    }
    catch (COMException) { }
    return null;
}
```

### User Guidance

When OLE equations are detected, the task pane shows a specific warning:

> **3 legacy Equation Editor objects were skipped.** These were created with Equation Editor 2.x or MathType and cannot be automatically converted. To fix: in Word, right-click each `[equation]` placeholder → select the original object → use MathType's "Convert to OMML" feature, then re-run the converter.

---

## 19. Deployment

### Developer / Internal Distribution

1. **ClickOnce** — publish from Visual Studio; users install from a shared network path or URL
2. Self-signed certificate for development; replace with a code-signing cert for distribution

### Enterprise Distribution

- Package as `.msi` via **WiX Toolset v4** or Visual Studio Installer Projects
- Deploy via Group Policy (Office Trust Center settings must allow add-ins)

### Requirements for End Users

| Requirement | Minimum | Notes |
|---|---|---|
| Windows | Vista SP2 / 7 SP1 | .NET Framework 4.8 runs on Vista SP2+ |
| Microsoft Word | **2007** (Office 12) | OMML support starts here |
| .NET Framework | **4.8** | Pre-installed on Windows 10/11; free download for older OS |
| VSTO Runtime | **4.0** | Installed automatically by ClickOnce; also free standalone download |
| RAM | 256 MB free | Minimal overhead |

> The .NET Framework 4.8 installer and the VSTO 4.0 Runtime are both freely redistributable and can be bundled in the MSI so end users never need to install anything manually.

### CI/CD (.github/workflows/ci.yml)

```yaml
name: CI
on: [push, pull_request]

jobs:
  build-and-test:
    runs-on: windows-latest   # VSTO + .NET Framework build requires Windows
    steps:
      - uses: actions/checkout@v4

      # .NET Framework 4.8 is pre-installed on windows-latest; no setup needed.
      # The dotnet CLI builds .NET Framework projects via MSBuild on Windows.
      - uses: actions/setup-dotnet@v4
        with:
          dotnet-version: "8.x"   # SDK needed to run dotnet CLI commands

      # Restore via NuGet (not dotnet restore — VSTO legacy .csproj)
      - uses: nuget/setup-nuget@v2
      - run: nuget restore BijoyToLatex.sln

      # Build Core + Tests (SDK-style project)
      - run: dotnet build BijoyToLatex.Core/BijoyToLatex.Core.csproj
               --configuration Release --no-restore

      # Build AddIn via MSBuild (legacy VSTO project requires MSBuild, not dotnet build)
      - uses: microsoft/setup-msbuild@v2
      - run: msbuild BijoyToLatex.AddIn/BijoyToLatex.AddIn.csproj
               /p:Configuration=Release /p:Platform="Any CPU"

      # Run tests (Core library only; RequiresWord tests excluded — no Word in CI)
      - run: dotnet test BijoyToLatex.Tests/BijoyToLatex.Tests.csproj
               --filter "Category!=RequiresWord"
               --no-build --configuration Release
               --collect "XPlat Code Coverage"
      - uses: codecov/codecov-action@v4
```

---

## 20. Project File — Core Library

```xml
<!-- BijoyToLatex.Core/BijoyToLatex.Core.csproj -->
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net48</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>disable</ImplicitUsings>   <!-- Not available on .NET FX -->
    <LangVersion>9.0</LangVersion>             <!-- Records + init; avoids C# 11/12 features -->
    <GenerateDocumentationFile>true</GenerateDocumentationFile>
    <AssemblyOriginatorKeyFile>BijoyToLatex.snk</AssemblyOriginatorKeyFile>
  </PropertyGroup>

  <ItemGroup>
    <EmbeddedResource Include="Assets\OMML2MML.XSL"/>
    <EmbeddedResource Include="Assets\bijoy_charmap.json"/>
  </ItemGroup>

  <ItemGroup>
    <!-- v2.x = last version supporting .NET Framework; v3+ requires .NET 6+ -->
    <PackageReference Include="DocumentFormat.OpenXml" Version="2.*"/>
    <!-- Newtonsoft.Json works reliably on .NET Framework; System.Text.Json has quirks on FX -->
    <PackageReference Include="Newtonsoft.Json" Version="13.*"/>
    <!-- Targets netstandard2.0, compatible with .NET Framework 4.6.1+ -->
    <PackageReference Include="CommunityToolkit.Mvvm" Version="8.*"/>
  </ItemGroup>
</Project>
```

```xml
<!-- BijoyToLatex.AddIn/BijoyToLatex.AddIn.csproj (VSTO project — SDK-style not standard for VSTO;
     shown here as property reference. In VS2022, VSTO projects use the legacy .csproj format) -->
<Project ToolsVersion="15.0" DefaultTargets="Build"
         xmlns="http://schemas.microsoft.com/developer/msbuild/2003">
  <PropertyGroup>
    <TargetFrameworkVersion>v4.8</TargetFrameworkVersion>
    <LangVersion>9.0</LangVersion>
    <!-- Office version to target. "12.0" = Word 2007 minimum. -->
    <OfficeVersion>12.0</OfficeVersion>
    <ApplicationType>Word</ApplicationType>
    <ApplicationVersion>12.0</ApplicationVersion>
  </PropertyGroup>
</Project>
```

> **VSTO project property `<ApplicationVersion>12.0</ApplicationVersion>`** sets Word 2007 as the minimum. The same add-in binary loads in Word 2010, 2013, 2016, 2019, 2021, and 365 without recompiling — the VSTO loader handles version negotiation.

---

## 21. Implementation Phases

### Phase 1 — Solution Setup (Week 1)
- [ ] Create solution: Core + AddIn + Tests projects
- [ ] Configure `nullable`, `ImplicitUsings`, `LangVersion`
- [ ] Embed `OMML2MML.XSL` and `bijoy_charmap.json`
- [ ] Set up xUnit + FluentAssertions
- [ ] GitHub Actions CI (windows-latest)

### Phase 2 — Bijoy Engine (Week 2)
- [ ] `BijoyCharmap.cs` — load from embedded JSON
- [ ] `BijoyDetector.cs` (font + heuristic) + full tests
- [ ] `BijoyConverter.cs` (4 stages, all edge cases) + full tests

### Phase 3 — OMML Direct Walker (Week 3)
- [ ] `OmmlWalker.cs` — all elements from Section 11
- [ ] All symbol maps (`OperatorMap`, `ArrowMap`, `GreekMap`, `AccentMap`, `FontStyleMap`)
- [ ] Full unit tests for every OMML element

### Phase 4 — MathML Walker + XSLT (Week 4)
- [ ] `OmmlToMathml.cs` — XSLT with async timeout
- [ ] `MathmlWalker.cs` — all MathML elements from Section 12
- [ ] `EquationProcessor.cs` — orchestrates Paths A/B/C
- [ ] `LatexWrapper.cs` — inline/display detection
- [ ] Full unit tests

### Phase 5 — Document Walker (Week 5)
- [ ] `WordDocumentAdapter.cs` + `IDocumentAdapter` interface
- [ ] `OpenXmlDocumentAdapter.cs` — for testing without Word
- [ ] `ParagraphParser.cs` — font grouping, OMath interleaving
- [ ] `TableParser.cs` — all table types

### Phase 6 — Assembler (Week 6)
- [ ] `QuestionDetector.cs`, `OptionDetector.cs`
- [ ] `QuestionAssembler.cs` — full state machine
- [ ] Integration tests with all 24 fixture `.docx` files

### Phase 7 — VSTO Layer (Week 7)
- [ ] `ThisAddIn.cs` — VSTO startup, task pane registration
- [ ] `Ribbon.cs` — toggle task pane button
- [ ] `TaskPaneControl.xaml` + `TaskPaneViewModel.cs`
- [ ] Progress reporting via `IProgress<double>`
- [ ] ClickOnce publish profile

### Phase 8 — Hardening & Release (Week 8)
- [ ] Error handling audit (all cases from Plan §21)
- [ ] XML documentation on all public APIs
- [ ] Performance benchmark (target: 100q < 1s)
- [ ] WiX installer project
- [ ] Release notes

---

## 22. Performance Targets

| Document Size | Target |
|---|---|
| 50 questions | < 0.5s |
| 100 questions | < 1s |
| 500 questions | < 5s |

Achieved by:
- `XslCompiledTransform` compiled once at startup (static constructor)
- All `Dictionary<string, string>` lookup tables compiled at startup
- Regex patterns compiled at field initialization
- Async XSLT with 500ms timeout prevents blocking the UI thread
- Progress reporting via `IProgress<double>` keeps UI responsive
- `StringBuilder` used throughout — no string concatenation in loops
- COM calls batched: character-level font grouping uses range walks, not per-char COM calls
