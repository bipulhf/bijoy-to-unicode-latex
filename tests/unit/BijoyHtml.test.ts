// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { convertBijoyHtml } from "../../src/bijoy/html.js";
import { extractRtfImages } from "../../src/bijoy/rtfImages.js";
import { convertBijoyRuns } from "../../src/bijoy/runs.js";
import { wordHtmlOmmlToLatex } from "../../src/equations/htmlOmml.js";

// Shaped like the text/html flavour Word puts on the clipboard.
function wordHtml(body: string, css = ""): string {
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office"
xmlns:m="http://schemas.microsoft.com/office/2004/12/omml">
<head><meta charset="utf-8"><style><!--
p.MsoNormal, li.MsoNormal, div.MsoNormal
	{margin:0in;font-size:12.0pt;font-family:"Times New Roman",serif;}
@font-face {font-family:SutonnyMJ;}
${css}
--></style></head>
<body lang=EN-US><!--StartFragment-->${body}<!--EndFragment--></body></html>`;
}

describe("convertBijoyHtml", () => {
  it("converts Bijoy spans and keeps bold, italic, colour and size", () => {
    const { html, text } = convertBijoyHtml(
      wordHtml(
        `<p class=MsoNormal><b><span style='font-size:14.0pt;font-family:SutonnyMJ;color:red'>Avwg</span></b>` +
          `<span style='font-family:SutonnyMJ'> </span>` +
          `<i><span style='font-family:SutonnyMJ'>evsjvq</span></i>` +
          `<span lang=EN-US> English<o:p></o:p></span></p>`,
      ),
    );
    expect(html).toBe(
      "<p><b><span style=\"font-size: 14.0pt; color: red\">আমি</span></b> " +
        "<i>বাংলায়</i> English</p>",
    );
    expect(text).toBe("আমি বাংলায় English");
  });

  it("finds the Bijoy font through Word's class rules", () => {
    const { html } = convertBijoyHtml(
      wordHtml(
        `<p class=MsoBijoy>Avwg</p>`,
        `p.MsoBijoy {font-family:SutonnyMJ;}`,
      ),
    );
    expect(html).toBe("<p>আমি</p>");
  });

  it("repairs a reph typed in the next span", () => {
    const { html } = convertBijoyHtml(
      wordHtml(
        `<p class=MsoNormal><span style='font-family:SutonnyMJ'>eM</span>` +
          `<span style='font-family:SutonnyMJ;color:blue'>©</span></p>`,
      ),
    );
    expect(html).toContain("বর্গ".normalize("NFC"));
  });

  it("sets the chosen font on converted text only", () => {
    const { html } = convertBijoyHtml(
      wordHtml(
        `<p class=MsoNormal><span style='font-family:SutonnyMJ'>Avwg</span>` +
          `<span style='font-family:Arial'> Hi</span></p>`,
      ),
      { banglaFont: "Kalpurush" },
    );
    expect(html).toBe(
      '<p><span style="font-family: Kalpurush;">আমি</span>' +
        '<span style="font-family: Arial"> Hi</span></p>',
    );
  });

  it("keeps tables and cell attributes", () => {
    const { html } = convertBijoyHtml(
      wordHtml(
        `<table class=MsoTableGrid border=1 cellspacing=0 cellpadding=0 style='border-collapse:collapse;mso-yfti-tbllook:1184'>` +
          `<tr><td width=100 valign=top style='border:solid windowtext 1.0pt'><p class=MsoNormal><span style='font-family:SutonnyMJ'>K)</span></p></td>` +
          `<td colspan=2><p class=MsoNormal>x</p></td></tr></table>`,
      ),
    );
    expect(html).toBe(
      '<table border="1" cellpadding="0" cellspacing="0" style="border-collapse: collapse">' +
        '<tbody><tr><td valign="top" width="100" style="border: solid windowtext 1.0pt"><p>ক)</p></td>' +
        '<td colspan="2"><p>x</p></td></tr></tbody></table>',
    );
  });

  it("turns equations into the text the equation option returns", () => {
    const omml =
      "<m:oMathPara><m:oMath><i><span style='font-family:\"Cambria Math\"'><m:r>x</m:r></span></i>" +
      "<m:sSup><m:sSupPr><span style='font-family:\"Cambria Math\"'><m:ctrlPr></m:ctrlPr></span></m:sSupPr>" +
      "<m:e><i><span><m:r>y</m:r></span></i></m:e><m:sup><i><span><m:r>2</m:r></span></i></m:sup></m:sSup>" +
      "</m:oMath></m:oMathPara>";
    const { html, stats } = convertBijoyHtml(
      wordHtml(
        `<p class=MsoNormal><span style='font-family:SutonnyMJ'>gvb </span>` +
          `<!--[if gte msEquation 12]>${omml}<![endif]-->` +
          `<![if !msEquation]><img width=20 src="file:///C:/Temp/clip_image001.png"><![endif]></p>`,
      ),
      { equation: (o) => `$${wordHtmlOmmlToLatex(o)}$` },
    );
    expect(html).toBe("<p>মান $xy^{2}$</p>");
    expect(stats.equations).toBe(1);
  });

  it("drops equations and warns when no equation option is given", () => {
    const { html, warnings } = convertBijoyHtml(
      wordHtml(`<p class=MsoNormal>a<!--[if gte msEquation 12]><m:oMath><m:r>x</m:r></m:oMath><![endif]--></p>`),
    );
    expect(html).toBe("<p>a</p>");
    expect(warnings[0]).toMatch(/equation/);
  });

  it("restores images from the RTF flavour", () => {
    const rtf =
      "{\\rtf1{\\*\\shppict{\\pict\\picw10\\pngblip 89504e47}}" +
      "{\\nonshppict{\\pict\\wmetafile8 0100}}}";
    const { html, stats } = convertBijoyHtml(
      wordHtml(
        `<p class=MsoNormal><!--[if gte vml 1]><v:shape><v:imagedata src="file:///C:/x.png"/></v:shape><![endif]-->` +
          `<![if !vml]><img width=50 height=40 src="file:///C:/Temp/clip_image002.png" v:shapes="Picture_1"><![endif]></p>`,
      ),
      { rtf },
    );
    expect(html).toBe(
      '<p><img width="50" height="40" src="data:image/png;base64,iVBORw=="></p>',
    );
    expect(stats.images).toBe(1);
  });

  it("removes local images it cannot recover and says so", () => {
    const { html, warnings } = convertBijoyHtml(
      wordHtml(`<p class=MsoNormal><img src="file:///C:/a.png">x</p>`),
    );
    expect(html).toBe("<p>x</p>");
    expect(warnings[0]).toMatch(/image/);
  });

  it("strips scripts, event handlers and unsafe links", () => {
    const { html } = convertBijoyHtml(
      `<p onclick="alert(1)">a<script>alert(2)</script>` +
        `<a href="javascript:alert(3)">b</a><a href="https://x.test">c</a>` +
        `<span style="background:url(javascript:alert(4))">d</span></p>`,
    );
    expect(html).toBe('<p>ab<a href="https://x.test">c</a>d</p>');
  });

  it("leaves Unicode Bangla alone", () => {
    const { html } = convertBijoyHtml(
      `<p><span style="font-family:SutonnyMJ">বাংলা</span></p>`,
    );
    expect(html).toBe("<p>বাংলা</p>");
  });
});

describe("extractRtfImages", () => {
  it("skips WMF copies and equation pictures, keeps order", () => {
    const rtf =
      "{\\rtf1" +
      "{\\*\\shppict{\\pict\\jpegblip ffd8}}{\\nonshppict{\\pict\\wmetafile8 01}}" +
      "{\\mmath{\\*\\mmathPict{\\pict\\pngblip 0102}}}" +
      "{\\*\\shppict{\\pict\\emfblip 0102}}" +
      "{\\*\\shppict{\\pict{\\*\\blipuid abc}\\pngblip 0a0b}}}";
    const images = extractRtfImages(rtf);
    expect(images.map((i) => i?.mime ?? null)).toEqual(["image/jpeg", null, "image/png"]);
    expect(images[2]!.base64).toBe("Cgs=");
  });
});

describe("convertBijoyRuns", () => {
  it("converts pieces and repairs words split between them", () => {
    expect(convertBijoyRuns(["hw", "`"])).toEqual(["য", "দি"]);
    expect(convertBijoyRuns(["eM", "©"]).join("")).toBe("বর্গ".normalize("NFC"));
  });
});
