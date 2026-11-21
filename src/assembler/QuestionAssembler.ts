import type {
  BodyElement,
  Question,
  ConvertOptions,
  ConversionWarning,
  ParsedParagraph,
} from "../types.js";
import {
  isQuestionParagraph,
  isSubPartParagraph,
  isBlankParagraph,
  isEquationOnlyParagraph,
  isContentParagraph,
  isImageOnlyParagraph,
  getParagraphText,
  getFullTextContent,
  QUESTION_NUMBER,
} from "./QuestionDetector.js";
import {
  toMarkedText,
  sliceMarked,
  trimMarked,
  type MarkedText,
} from "./MarkedText.js";
import {
  isOptionParagraph,
  hasMultipleOptionMarkers,
  getOptionText,
  parseMultiOptionNodes,
  tryExtractEmbeddedOptions,
  getTextBeforeEmbeddedOptions,
} from "./OptionDetector.js";
import { classifyTable, flattenOptionTable } from "../walker/TableParser.js";

type State = "IDLE" | "QUESTION" | "OPTIONS";

interface AssemblerState {
  state: State;
  currentQuestion: string;
  currentOptions: string[];
  questions: Question[];
}

export function assembleQuestions(
  elements: BodyElement[],
  options: ConvertOptions,
  warnings: ConversionWarning[],
): Question[] {
  const imageToken = options.imageToken ?? "[image]";

  const st: AssemblerState = {
    state: "IDLE",
    currentQuestion: "",
    currentOptions: [],
    questions: [],
  };

  for (const elem of elements) {
    if (elem.type === "paragraph") {
      handleParagraph(elem.paragraph, st, imageToken, warnings);
    } else if (elem.type === "table") {
      handleTable(elem, st, imageToken, warnings, options);
    }
  }

  finalize(st);
  return st.questions;
}

function handleParagraph(
  p: ParsedParagraph,
  st: AssemblerState,
  imageToken: string,
  _warnings: ConversionWarning[],
): void {
  if (isBlankParagraph(p)) {
    if (st.state === "OPTIONS") {
      finalize(st);
    }
    return;
  }

  switch (st.state) {
    case "IDLE":
      handleIdle(p, st, imageToken);
      break;
    case "QUESTION":
      handleInQuestion(p, st, imageToken);
      break;
    case "OPTIONS":
      handleInOptions(p, st, imageToken);
      break;
  }
}

function handleIdle(
  p: ParsedParagraph,
  st: AssemblerState,
  imageToken: string,
): void {
  if (isQuestionParagraph(p)) {
    startQuestion(p, st, imageToken);
    return;
  }

  if (isOptionParagraph(p)) {
    return;
  }

  // A stray image before any question has nothing to attach to.
  if (isImageOnlyParagraph(p)) {
    return;
  }

  if (isContentParagraph(p)) {
    startUnnumberedQuestion(p, st, imageToken);
  }
}

function handleInQuestion(
  p: ParsedParagraph,
  st: AssemblerState,
  imageToken: string,
): void {
  if (isQuestionParagraph(p)) {
    finalize(st);
    startQuestion(p, st, imageToken);
    return;
  }

  if (isOptionParagraph(p)) {
    collectOptions(p, st, imageToken);
    st.state = "OPTIONS";
    return;
  }

  if (isSubPartParagraph(p)) {
    st.currentQuestion += "\n" + getParagraphText(p, imageToken).trim();
    return;
  }

  if (isEquationOnlyParagraph(p)) {
    st.currentQuestion += "\n" + getParagraphText(p, imageToken).trim();
    return;
  }

  const text = getParagraphText(p, imageToken);
  if (text.trim().length > 0) {
    const marked = toMarkedText(p.nodes, imageToken);
    const embedded = tryExtractEmbeddedOptions(marked);
    if (embedded) {
      const questionPart = getTextBeforeEmbeddedOptions(marked);
      if (questionPart) {
        st.currentQuestion += "\n" + questionPart;
      }
      st.currentOptions = embedded;
      finalize(st);
      return;
    }

    st.currentQuestion += "\n" + text.trim();
  }
}

function handleInOptions(
  p: ParsedParagraph,
  st: AssemblerState,
  imageToken: string,
): void {
  if (isQuestionParagraph(p)) {
    finalize(st);
    startQuestion(p, st, imageToken);
    return;
  }

  if (isOptionParagraph(p)) {
    collectOptions(p, st, imageToken);
    return;
  }

  // A line holding only an equation or image continues the last option.
  if (
    st.currentOptions.length > 0 &&
    (isEquationOnlyParagraph(p) || isImageOnlyParagraph(p))
  ) {
    const lastIdx = st.currentOptions.length - 1;
    st.currentOptions[lastIdx] =
      st.currentOptions[lastIdx]! + " " + getParagraphText(p, imageToken);
    return;
  }

  if (isContentParagraph(p)) {
    finalize(st);
    startUnnumberedQuestion(p, st, imageToken);
  }
}

function collectOptions(
  p: ParsedParagraph,
  st: AssemblerState,
  imageToken: string,
): void {
  if (hasMultipleOptionMarkers(p)) {
    const parsed = parseMultiOptionNodes(p.nodes, imageToken);
    st.currentOptions.push(...parsed);
  } else {
    const optText = getOptionText(p, imageToken);
    st.currentOptions.push(optText);
  }
}

function handleTable(
  elem: BodyElement & { type: "table" },
  st: AssemblerState,
  imageToken: string,
  warnings: ConversionWarning[],
  _options: ConvertOptions,
): void {
  const classification = classifyTable(elem.table);

  switch (classification) {
    case "option": {
      const optionCells = flattenOptionTable(elem.table);
      const opts = optionCells.map((cell) => getOptionText(cell, imageToken));
      if (st.state === "QUESTION" || st.state === "OPTIONS") {
        st.currentOptions.push(...opts);
        finalize(st);
      }
      break;
    }
    case "layout": {
      for (const row of elem.table.rows) {
        for (const cell of row) {
          const text = getFullTextContent(cell);
          if (text.trim().length > 0) {
            handleParagraph(cell, st, imageToken, warnings);
          }
        }
      }
      break;
    }
    case "data": {
      if (st.state === "QUESTION") {
        const tableText = renderDataTable(elem.table, imageToken);
        st.currentQuestion += "\n" + tableText;
      }
      break;
    }
  }
}

function startQuestion(
  p: ParsedParagraph,
  st: AssemblerState,
  imageToken: string,
): void {
  let marked = toMarkedText(p.nodes, imageToken);
  // Word list numbering is not part of the text, so only strip a typed number.
  if (p.numId === null) {
    const match = QUESTION_NUMBER.exec(marked.masked);
    if (match) marked = sliceMarked(marked, match[0].length);
  }
  setQuestionText(trimMarked(marked), st);
}

function setQuestionText(marked: MarkedText, st: AssemblerState): void {
  const embedded = tryExtractEmbeddedOptions(marked);
  if (embedded) {
    const questionPart = getTextBeforeEmbeddedOptions(marked);
    st.currentQuestion = questionPart ?? marked.text;
    st.currentOptions = embedded;
    st.state = "QUESTION";
    finalize(st);
    return;
  }

  st.currentQuestion = marked.text;
  st.currentOptions = [];
  st.state = "QUESTION";
}

function startUnnumberedQuestion(
  p: ParsedParagraph,
  st: AssemblerState,
  imageToken: string,
): void {
  setQuestionText(toMarkedText(p.nodes, imageToken), st);
}

function finalize(st: AssemblerState): void {
  if (st.currentQuestion.trim().length > 0) {
    st.questions.push({
      question: st.currentQuestion.trim(),
      options: st.currentOptions
        .map((o) => o.trim())
        .filter((o) => o.length > 0),
    });
  }
  st.currentQuestion = "";
  st.currentOptions = [];
  st.state = "IDLE";
}

function renderDataTable(
  table: { rows: ParsedParagraph[][] },
  imageToken: string,
): string {
  const rows = table.rows.map((row) =>
    row.map((cell) => getParagraphText(cell, imageToken)).join(" | "),
  );
  return rows.join("\n");
}
