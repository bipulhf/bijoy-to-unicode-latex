import { readDocxFromFile } from "../src/reader/DocxReader.js";
import { walkDocument } from "../src/walker/DocumentWalker.js";

async function main() {
  const docx = await readDocxFromFile("output/matrix.docx");
  const { elements } = walkDocument(docx.documentXml, {});

  let shown = 0;
  for (const el of elements) {
    if (el.type === "paragraph") {
      const text = el.paragraph.nodes
        .map((n) => {
          if (n.type === "text") return n.text;
          if (n.type === "equation") return "[EQ]";
          return "[IMG]";
        })
        .join("");
      if (text.trim()) {
        console.log(`P[${shown}]: ${text.substring(0, 150)}`);
        shown++;
        if (shown >= 50) break;
      }
    } else if (el.type === "table") {
      const firstCellText = el.table.rows[0]
        ?.map((c) =>
          c.nodes
            .map((n) => (n.type === "text" ? n.text : n.type === "equation" ? "[EQ]" : "[IMG]"))
            .join(""),
        )
        .join(" | ");
      console.log(`T: [TABLE ${el.table.rows.length}x${el.table.rows[0]?.length ?? 0}] first: ${firstCellText?.substring(0, 120)}`);
      shown++;
      if (shown >= 50) break;
    }
  }
  console.log(`\nTotal elements: ${elements.length}`);
}

main();
