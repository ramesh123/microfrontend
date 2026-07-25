import type { Monaco } from "@monaco-editor/react";

let tbelLanguageRegistered = false;

/** Register a TBEL-ish Monarch grammar (ThingsBoard TBEL is Java-like) once per Monaco instance. */
export function ensureTbelMonacoLanguage(monaco: Monaco): void {
  if (tbelLanguageRegistered) return;
  tbelLanguageRegistered = true;
  monaco.languages.register({ id: "tbel" });
  monaco.languages.setMonarchTokensProvider("tbel", {
    defaultToken: "",
    keywords: [
      "if",
      "else",
      "for",
      "while",
      "return",
      "break",
      "continue",
      "switch",
      "case",
      "default",
      "var",
      "let",
      "function",
      "true",
      "false",
      "null",
      "new",
      "try",
      "catch",
      "finally",
      "throw",
      "instanceof",
      "typeof",
      "msg",
      "metadata",
      "msgType",
      "JSON",
      "Math",
      "Date",
    ],
    tokenizer: {
      root: [
        [/\/\/.*$/, "comment"],
        [/\/\*/, "comment", "@comment"],
        [/"([^"\\]|\\.)*"/, "string"],
        [/'([^'\\]|\\.)*'/, "string"],
        [/\d*\.\d+([eE][\-+]?\d+)?/, "number.float"],
        [/(0[xX][0-9a-fA-F]+|\d+)/, "number"],
        [/[a-z_$][\w$]*/, { cases: { "@keywords": "keyword", "@default": "identifier" } }],
        [/[{}()\[\]]/, "delimiter.bracket"],
        [/[;,?:]/, "delimiter"],
        [/[=<>!%&|^+\-*/]+/, "operator"],
        [/\s+/, "white"],
      ],
      comment: [
        [/[^\/*]+/, "comment"],
        [/\*\//, "comment", "@pop"],
        [/[\/*]/, "comment"],
      ],
    },
  });
}

export type SimpleMarker = {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  message: string;
};

/** Brackets outside strings/comments — structural mistakes as markers for TBEL. */
export function computeTbelStructuralMarkers(code: string): SimpleMarker[] {
  const markers: SimpleMarker[] = [];
  const pairs: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
  const closers = new Set([")", "]", "}"]);
  type StackEntry = { ch: string; line: number; column: number };
  const stack: StackEntry[] = [];

  let line = 1;
  let column = 1;
  let i = 0;
  type StrMode = null | '"' | "'";
  let str: StrMode = null;
  let escape = false;
  let blockComment = false;
  let lineComment = false;

  const advance = (n = 1) => {
    for (let k = 0; k < n; k++) {
      const ch = code[i + k];
      if (ch === "\n") {
        line++;
        column = 1;
      } else if (ch !== undefined) {
        column++;
      }
    }
    i += n;
  };

  while (i < code.length) {
    const c = code[i]!;
    const next = code[i + 1];

    if (lineComment) {
      if (c === "\n") lineComment = false;
      advance(1);
      continue;
    }
    if (blockComment) {
      if (c === "*" && next === "/") {
        advance(2);
        blockComment = false;
        continue;
      }
      advance(1);
      continue;
    }
    if (str) {
      if (escape) {
        escape = false;
        advance(1);
        continue;
      }
      if (c === "\\") {
        escape = true;
        advance(1);
        continue;
      }
      if (c === str) str = null;
      advance(1);
      continue;
    }

    if (c === "\n") {
      advance(1);
      continue;
    }

    if (c === "/" && next === "/") {
      lineComment = true;
      advance(2);
      continue;
    }
    if (c === "/" && next === "*") {
      blockComment = true;
      advance(2);
      continue;
    }
    if (c === '"' || c === "'") {
      str = c as '"' | "'";
      advance(1);
      continue;
    }

    if (c in pairs) {
      stack.push({ ch: c, line, column });
    } else if (closers.has(c)) {
      const last = stack.pop();
      if (!last) {
        markers.push({
          startLineNumber: line,
          startColumn: column,
          endLineNumber: line,
          endColumn: column + 1,
          message: `Unexpected '${c}'`,
        });
      } else if (pairs[last.ch] !== c) {
        markers.push({
          startLineNumber: last.line,
          startColumn: last.column,
          endLineNumber: last.line,
          endColumn: last.column + 1,
          message: `Expected '${pairs[last.ch]}' to close '${last.ch}'`,
        });
      }
    }

    advance(1);
  }

  while (stack.length) {
    const last = stack.pop()!;
    markers.push({
      startLineNumber: last.line,
      startColumn: last.column,
      endLineNumber: last.line,
      endColumn: last.column + 1,
      message: `Unclosed '${last.ch}'`,
    });
  }

  return markers;
}
