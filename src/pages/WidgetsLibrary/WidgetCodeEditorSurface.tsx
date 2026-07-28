import { useMemo } from "react";
import Editor from "@monaco-editor/react";
import { cn } from "@/lib/utils";
import { isThemeDarkAppearance, useTheme } from "@/context/theme";
import { widgetsLibraryEditPanelCodeSurfaceClass } from "./widgetsLibraryClasses";

const CODE_EDITOR_LINE_HEIGHT_PX = 20;
const CODE_EDITOR_PADDING_Y_PX = 16;

export type WidgetCodeEditorLanguage =
  | "html"
  | "css"
  | "javascript"
  | "json"
  | "plaintext";

type WidgetCodeEditorSurfaceProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  language?: WidgetCodeEditorLanguage;
  minRows?: number;
  maxHeightPx?: number;
  fillHeight?: boolean;
  compact?: boolean;
};

export function WidgetCodeEditorSurface({
  value,
  onChange,
  language = "plaintext",
  minRows = 3,
  maxHeightPx = 360,
  fillHeight = false,
  compact = false,
}: WidgetCodeEditorSurfaceProps) {
  const { theme } = useTheme();
  const monacoTheme = isThemeDarkAppearance(theme) ? "vs-dark" : "vs";

  const lineCount = useMemo(() => {
    const lines = value.split("\n").length;
    return Math.max(minRows, lines);
  }, [value, minRows]);

  const contentHeightPx = lineCount * CODE_EDITOR_LINE_HEIGHT_PX + CODE_EDITOR_PADDING_Y_PX;
  const editorHeight = fillHeight
    ? "100%"
    : `${Math.min(contentHeightPx, maxHeightPx)}px`;

  return (
    <div
      className={cn(
        "widgets-library-code-editor w-full overflow-hidden",
        fillHeight
          ? cn(widgetsLibraryEditPanelCodeSurfaceClass, "flex h-full min-h-0 flex-1 flex-col")
          : "min-h-0",
      )}
    >
      <Editor
        height={editorHeight}
        language={language}
        value={value}
        theme={monacoTheme}
        onChange={(next) => onChange(next ?? "")}
        loading={
          <div className="flex h-full min-h-[80px] items-center justify-center text-xs text-muted-foreground">
            Loading editor…
          </div>
        }
        options={{
          minimap: { enabled: false },
          fontSize: compact ? 11 : 13,
          lineHeight: compact ? 16 : 20,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          wordWrap: "on",
          scrollBeyondLastLine: false,
          automaticLayout: true,
          lineNumbers: "on",
          glyphMargin: false,
          folding: true,
          renderLineHighlight: "line",
          bracketPairColorization: { enabled: true },
          guides: { bracketPairs: true, indentation: true },
          padding: { top: 8, bottom: 8 },
          tabSize: 2,
          insertSpaces: true,
          scrollbar: {
            vertical: "auto",
            horizontal: "auto",
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8,
          },
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
        }}
      />
    </div>
  );
}
