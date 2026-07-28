import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  Suspense,
} from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  GripVertical,
  Trash2,
  Play,
  Plus,
  Code,
  AlertCircle,
  Loader2,
  RotateCcw,
  Pencil,
  MessageSquare,
} from "lucide-react";
import AiIcon from "@/assets/images/icons8-ai-64.png";
import { useNodeStore } from "@/stores/nodeStore";
import { deleteFilterById } from "@/utils/filterUtils";
import useFlowStore from "@/stores/flowStore";
import useExecutionResultStore from "@/stores/executionResultStore";
import { toast } from "sonner";
import useSourceNodes from "@/hooks/use-source-nodes";
import { saveNodeDetailsApi } from "@/controllers/API";
import { hydrateNodeOutputAfterExecution } from "@/utils/nodeDataUtils";
import { HorizontalAiPanel } from "@/components/common/FilterOperations/HorizontalAiPanel";
import { AiPredicateChatDialog } from "@/components/common/FilterOperations/AiPredicateChatDialog";
import { usePredicateChatStore } from '@/stores/usePredicateChatStore';
import { cn } from "@/lib/utils";
import { useTheme, isThemeDarkAppearance } from "@/context/theme";

interface CodeItem {
  id: string;
  code: string;
  filter_type: "auto" | "manual" | "ai_generated";
  sourceId?: string;
  user_request?: string;
}

interface CodeEditorProps {
  initialData?: Array<{
    id: string;
    filter: string;
    filter_type: "auto" | "manual" | "ai_generated";
    sourceId?: string;
  }>;
  onExecute?: (item: CodeItem, allItems?: CodeItem[]) => void | Promise<boolean>;
  onExecuteAll?: (codes: string[]) => void;
  onTriggerEdit?: (indexOrId: number | string) => void;
  sourceId?: string; // Source ID for per-source filter isolation
  selectedSourceKey?: string | null; // When previous node is multi-source (e.g. N-way matching), which source key to use (VBAK_DATA, VBAP_DATA, etc.)
  activeRuleId?: string; // Active rule ID for rule-specific filter isolation
  activeRuleName?: string | null; // Active rule name for rule-specific filter isolation
}

const FILTER_EXECUTE_ERROR_MSG =
  "Filter is not executed. Please check the filter once.";

interface SortableItemProps {
  item: CodeItem;
  index: number;
  isDragActive: boolean;
  isExecuted: boolean;
  isEditing: boolean;
  isRunning: boolean;
  onCodeChange: (id: string, newCode: string) => void;
  onDelete: (id: string) => void;
  onExecute: (item: CodeItem) => Promise<void>;
  onTriggerEdit: (indexOrId: number | string) => void;
  onToggleEdit: (id: string) => void;
  isReorderEnabled?: boolean;
  isEditEnabled?: boolean;
  onToggleEditEnabled: (id: string, enabled: boolean) => void;
}

// Lazy load Monaco Editor component
const MonacoEditor = React.lazy(async () => {
  try {
    const { default: Editor } = await import("@monaco-editor/react");
    // Return a wrapper component
    return {
      default: ({
        value,
        onChange,
        onError,
        height = "120px",
        readOnly = false,
      }: {
        value: string;
        onChange: (value: string | undefined) => void;
        onError: (error: any) => void;
        height?: string;
        readOnly?: boolean;
      }) => {
        const [hasError, setHasError] = useState(false);
        const editorRef = useRef<any>(null);
        const monacoApiRef = useRef<any>(null);
        const { theme } = useTheme();
        const editorTheme = isThemeDarkAppearance(theme) ? "vs-dark" : "vs";

        useEffect(() => {
          monacoApiRef.current?.editor?.setTheme(editorTheme);
        }, [editorTheme]);

        const handleEditorChange = useCallback(
          (value: string | undefined) => {
            try {
              onChange(value);
            } catch (error) {
              console.warn("Monaco onChange error:", error);
              setHasError(true);
              onError(error);
            }
          },
          [onChange, onError]
        );

        const handleEditorDidMount = useCallback(
          (editor: any, monaco: any) => {
            editorRef.current = editor;
            monacoApiRef.current = monaco;
            try {
              monaco.editor.setTheme(editorTheme);

              editor.updateOptions({
                readOnly,
                contextmenu: false,
                quickSuggestions: false,
                parameterHints: { enabled: false },
                hover: { enabled: false },
                suggestOnTriggerCharacters: false,
                acceptSuggestionOnEnter: "off",
                tabCompletion: "off",
                wordBasedSuggestions: "off",
                links: false,
                colorDecorators: false,
                codeLens: false,
                lightbulb: { enabled: false },
              });
            } catch (error) {
              console.warn("Monaco mount error:", error);
              setHasError(true);
              onError(error);
            }
          },
          [onError, readOnly, editorTheme]
        );

        useEffect(() => {
          editorRef.current?.updateOptions?.({ readOnly });
        }, [readOnly]);

        const handleEditorValidationResult = useCallback((markers: any[]) => {
          // Handle validation errors gracefully
          if (markers.length > 0) {
            console.debug("Monaco validation markers:", markers);
          }
        }, []);

        if (hasError) {
          return (
            <div
              style={{ height }}
              className="flex items-center justify-center rounded border border-destructive/30 bg-destructive/10"
            >
              <div className="text-center text-destructive">
                <AlertCircle className="h-6 w-6 mx-auto mb-2" />
                <p className="text-sm font-medium">Editor error occurred</p>
              </div>
            </div>
          );
        }

        return (
          <div className="overflow-hidden rounded-md border border-border bg-background">
            <Editor
              height={height}
              language="python"
              theme={editorTheme}
              value={value}
              onChange={handleEditorChange}
              onMount={handleEditorDidMount}
              onValidate={handleEditorValidationResult}
              options={{
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                fontSize: 13,
                lineNumbers: "off",
                wordWrap: "on",
                automaticLayout: true,
                folding: false,
                readOnly,
                // Disable features that might cause issues
                contextmenu: false,
                quickSuggestions: false,
                parameterHints: { enabled: false },
                hover: { enabled: false },
                suggestOnTriggerCharacters: false,
                acceptSuggestionOnEnter: "off",
                tabCompletion: "off",
                wordBasedSuggestions: "off",
                links: false,
                colorDecorators: false,
                codeLens: false,
                // lightbulb: { enabled: false },
                renderLineHighlight: "none",
                hideCursorInOverviewRuler: true,
                overviewRulerBorder: false,
                glyphMargin: false,
                lineDecorationsWidth: 0,
                scrollbar: {
                  vertical: "hidden", 
                  horizontal: "auto",
                  // Allow scroll events to pass through to parent
                  handleMouseWheel: false,
                },
              }}
              loading={
                <div
                  className="flex items-center justify-center rounded-md border border-border bg-muted"
                  style={{ height }}
                >
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Loading editor...</span>
                  </div>
                </div>
              }
            />
          </div>
        );
      },
    };
  } catch (error) {
    console.warn("Failed to load Monaco Editor:", error);
    throw error;
  }
});

// Error boundary for Monaco Editor
class MonacoErrorBoundary extends React.Component<
  { children: React.ReactNode; onError: (error: any) => void },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.warn("Monaco Error Boundary caught error:", error, errorInfo);
    this.props.onError(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center rounded border border-destructive/30 bg-destructive/10 p-4">
          <div className="text-center text-destructive">
            <AlertCircle className="h-6 w-6 mx-auto mb-2" />
            <p className="text-sm font-medium">Editor failed to load</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const SortableItem: React.FC<SortableItemProps> = ({
  item,
  index,
  isDragActive,
  isExecuted,
  isEditing,
  isRunning,
  onCodeChange,
  onDelete,
  onExecute,
  onTriggerEdit,
  onToggleEdit,
  isReorderEnabled = false,
  isEditEnabled = false,
  onToggleEditEnabled,
}) => {
  const [useMonaco, setUseMonaco] = useState(true); // Start with textarea by default
  const [monacoError, setMonacoError] = useState<string | null>(null);
  const monacoInstanceRef = useRef(null); // Add this ref

  // Only use sortable when reorder is enabled
  const sortableResult = isReorderEnabled
    ? useSortable({ id: item.id })
    : null;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = sortableResult || {
    attributes: {},
    listeners: {},
    setNodeRef: null,
    transform: null,
    transition: null,
    isDragging: false,
  };

  const style = isReorderEnabled && sortableResult
    ? {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }
    : {};

  const shouldUseTextarea =
    isDragActive || isDragging || monacoError || !useMonaco;

  useEffect(() => {  
    if (isDragging) {
      // Clear any Monaco errors when dragging starts
      setMonacoError(null);
      // Force use of textarea during drag for stability
      if (useMonaco) {
        setUseMonaco(false);
      }
    }
  }, [isDragging, useMonaco]);

  // Add another effect to restore Monaco after drag ends
  useEffect(() => {
    if (!isDragging && !useMonaco && !monacoError) {  
      // Restore Monaco editor after drag ends (with a small delay)
      const timer = setTimeout(() => {
        setUseMonaco(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isDragging, useMonaco, monacoError]);

  const isAiFilter = item.filter_type === "ai_generated";
  const isReadOnly =
    isAiFilter
      ? true
      : item.filter_type === "manual"
        ? false
        : !isEditEnabled || (isExecuted && !isEditing);

  const editorValue = item.code;
  const aiDisplayText = item.user_request || item.code;

  const handleTextChange = useCallback(   
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (isReadOnly) return;
      onCodeChange(item.id, e.target.value);
    },
    [item.id, onCodeChange, isReadOnly]
  );

  const handleMonacoChange = useCallback(
    (value: string | undefined) => {
      if (isReadOnly) return;
      onCodeChange(item.id, value || "");
    },
    [item.id, onCodeChange, isReadOnly]
  );

  const switchToTextarea = useCallback(() => {
    setUseMonaco(false); // Changed from true to false
    setMonacoError(null);
  }, []);
  const switchToMonaco = useCallback(() => {
    setUseMonaco(true);
    setMonacoError(null);
  }, []);

  const handleMonacoError = useCallback(
    (error: any) => {
      console.warn("Monaco error for item:", item.id, error);
      setMonacoError("Failed to load enhanced editor");
    },
    [item.id]
  );

  const handleEditClick = useCallback(() => {
    if (!isEditing && item.filter_type === "auto") {
      onTriggerEdit(item.id);
    }
    onToggleEdit(item.id);
  }, [isEditing, item.filter_type, item.id, onTriggerEdit, onToggleEdit]);

  const filterTypeLabel =
    item.filter_type === "ai_generated"
      ? "AI Generated"
      : item.filter_type === "manual"
        ? "Manual"
        : item.filter_type === "auto"
          ? "Custom"
          : null;

  return (   
    <Card
      ref={isReorderEnabled ? setNodeRef : null}
      style={style}
      className={`mb-3 p-0 ${isDragging ? "shadow-lg" : "shadow-sm"
        } hover:shadow-md transition-shadow border-l-4 border-l-blue-500`}
    >
      <CardContent className="p-2">
        <div className="flex items-start gap-3">
          {/* Drag Handle - Only show when reorder is enabled */}
          {isReorderEnabled && (
            <div
              {...attributes}
              {...listeners}
              className="mt-2 cursor-grab active:cursor-grabbing rounded p-1 transition-colors flex-shrink-0"
              title="Drag to reorder"
            >
              <GripVertical className="h-5 w-5 " />
            </div>
          )}

          {/* Code Editor */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Code className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-semibold">
                  Command {index + 1}
                </span>
                {/* <div className="flex items-center gap-1">
                  {useMonaco ? (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                      Enhanced
                    </span>
                  ) : (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      Simple
                    </span>
                  )} // span ClassName="text-xs bg-blue" // simple
                </div> */}
                {/* Editor Mode Switcher */}
                <div className="flex items-center gap-1 flex-wrap">
                  {filterTypeLabel && (
                    <div
                      className={cn(
                        "flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-medium",
                        item.filter_type === "ai_generated"
                          ? "bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/30 dark:to-blue-900/30 border-purple-200 dark:border-purple-700 text-purple-700 dark:text-purple-300"
                          : item.filter_type === "manual"
                            ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-300"
                            : "bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300"
                      )}
                    >
                      {item.filter_type === "ai_generated" && (
                        <img src={AiIcon} alt="AI" className="h-3.5 w-3.5" />
                      )}
                      <span>{filterTypeLabel}</span>
                    </div>
                  )}
                  {isRunning && (
                    <span className="text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Running
                    </span>
                  )}
                  {!isRunning && isEditEnabled && isEditing && item.filter_type === "auto" && (
                    <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">Editing</span>
                  )}
                  {!isRunning && !isEditing && isExecuted && (
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium">Executed</span>
                  )}
                  {!isRunning && !isEditing && !isExecuted && (
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Draft</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {item.filter_type === "auto" && (
                  <label
                    className="flex items-center gap-1.5 cursor-pointer text-xs whitespace-nowrap text-muted-foreground"
                    title="Enable edit for this filter"
                  >
                    <input
                      type="checkbox"
                      checked={isEditEnabled}
                      onChange={(e) => onToggleEditEnabled(item.id, e.target.checked)}
                      className="w-3.5 h-3.5 text-primary"
                    />
                    <span>Enable Edit</span>
                  </label>
                )}
                {item.filter_type === "auto" && isEditEnabled && (
                  <Button
                    variant="outline"
                    size="iconMd"
                    className={cn(
                      "cursor-pointer",
                      isEditing
                        ? "text-blue-700 hover:text-blue-800 hover:!bg-blue-100 !border-blue-400 ring-1 ring-blue-300"
                        : "text-blue-500 hover:text-blue-600 hover:!bg-blue-50 !border-blue-200"
                    )}
                    onClick={handleEditClick}
                    title={
                      isEditing
                        ? isExecuted
                          ? "Done editing (lock filter code)"
                          : "Done editing"
                        : "Edit custom filter configuration"
                    }
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="iconMd"
                  disabled={isRunning}
                  className={cn(
                    "cursor-pointer",
                    isRunning
                      ? "text-amber-600 hover:text-amber-600 hover:!bg-amber-50 !border-amber-300"
                      : "text-green-500 hover:text-green-600 hover:!bg-green-50 !border-green-200"
                  )}
                  onClick={() => void onExecute(item)}
                  title={isRunning ? "Running filter..." : "Execute this command"}
                >
                  {isRunning ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild >
                    <Button
                      variant="outline"
                      size="iconMd"
                      className="cursor-pointer border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>  
                  </AlertDialogTrigger>
                  <AlertDialogContent className="min-w-[50rem] max-w-[70rem]">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Command</AlertDialogTitle>
                      <AlertDialogDescription className="flex flex-col gap-2">
                        <span className="text-sm text-muted-foreground">
                          Are you sure you want to delete this command? This
                          action cannot be undone.
                        </span>
                        <span className="mt-0 overflow-hidden rounded bg-muted p-3 font-mono text-xs">
                          {isAiFilter
                            ? aiDisplayText.substring(0, 100)
                            : item.code.substring(0, 100)}
                          {(isAiFilter ? aiDisplayText.length : item.code.length) > 100 ? "..." : ""}
                        </span>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => onDelete(item.id)}
                        className="text-destructive bg-destructive/10 hover:text-destructive hover:bg-red-200 border-red-200"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>

            {isAiFilter ? (
              <div className="min-h-[75px] rounded-md border border-purple-200/60 bg-purple-50/50 px-3 py-2.5 text-sm text-purple-900 dark:border-purple-800/40 dark:bg-purple-950/20 dark:text-purple-100">
                {aiDisplayText}
              </div>
            ) : (
            /* Editor Container */
            <div className="relative">
              {!shouldUseTextarea ? (  
                <MonacoErrorBoundary onError={handleMonacoError}>
                  <Suspense
                    fallback={
                      <div className="flex h-[75px] items-center justify-center rounded-md border border-border bg-muted">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm">
                            Loading Monaco Editor...
                          </span>
                        </div>
                      </div>
                    }
                  >
                    <MonacoEditor
                      key={`monaco-${item.id}-${isDragActive ? "drag" : "normal"}-${isReadOnly ? "ro" : "rw"}`}
                      value={editorValue}
                      onChange={handleMonacoChange}
                      onError={handleMonacoError}
                      height="75px"
                      readOnly={isReadOnly}
                    />
                  </Suspense>
                </MonacoErrorBoundary>
              ) : (
                <Textarea
                  value={editorValue}
                  onChange={handleTextChange}
                  readOnly={isReadOnly}
                  className={cn(
                    "min-h-[75px] resize-none rounded-md border border-input bg-background font-mono text-sm text-foreground",
                    isReadOnly && "cursor-default bg-muted/50"
                  )}
                  placeholder="# Enter your Python code here"
                />
              )}

              {monacoError && useMonaco && !isDragActive && (  
                <div className="absolute inset-0 flex items-center justify-center rounded bg-destructive/10 backdrop-blur-sm">
                  <div className="text-center text-destructive">
                    <AlertCircle className="h-6 w-6 mx-auto mb-2" />
                    <p className="text-sm font-medium">{monacoError}</p>
                    <div className="flex gap-2 mt-3 justify-center">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 border-red-300"
                        onClick={switchToMonaco}
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Retry
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-orange-600 border-orange-300"
                        onClick={switchToTextarea}
                      >
                        Simple Mode
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const CodeEditor: React.FC<CodeEditorProps> = ({
  initialData,
  onExecute = () => { },
  onExecuteAll = () => { },
  onTriggerEdit = () => { },
  sourceId,
  selectedSourceKey = null,
  activeRuleId,
  activeRuleName,
}) => {
  // Subscribe to the nodes array to detect changes in filter_conditions after deletion
  const selectedNode = useFlowStore((state) =>
    state.currentWorkflow?.data.nodes.find(n => n.selected)
  );
  const [items, setItems] = useState<CodeItem[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [isReorderEnabled, setIsReorderEnabled] = useState(false);
  const [editEnabledFilterIds, setEditEnabledFilterIds] = useState<Set<string>>(new Set());
  const [executedFilterIds, setExecutedFilterIds] = useState<Set<string>>(new Set());
  const [editingFilterIds, setEditingFilterIds] = useState<Set<string>>(new Set());
  const [runningFilterIds, setRunningFilterIds] = useState<Set<string>>(new Set());
  const [isRunningAll, setIsRunningAll] = useState(false);
  /** Filters added in this session stay editable until explicitly executed */
  const sessionNewFilterIdsRef = useRef<Set<string>>(new Set());
  const itemsRef = useRef<CodeItem[]>([]);
  const editingFilterIdsRef = useRef<Set<string>>(new Set());
  const { sourceNodes }: { sourceNodes: any[] } = useSourceNodes(selectedNode?.id);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    editingFilterIdsRef.current = editingFilterIds;
  }, [editingFilterIds]);

  const clearPendingFilterSaveTimeouts = useCallback(() => {
    const allTimeoutKeys = Object.keys(window).filter((key) => key.startsWith("timeout_"));
    allTimeoutKeys.forEach((key) => {
      clearTimeout((window as any)[key]);
      delete (window as any)[key];
    });
  }, []);

  const nodeHasPersistedOutput = useCallback((): boolean => {
    const output = selectedNode?.data?.node?.output;
    if (!output?.data) return false;
    const rawData = output.data;
    if (Array.isArray(rawData)) return rawData.length > 0;
    if (typeof rawData === "object") {
      return Object.keys(rawData as Record<string, unknown>).length > 0;
    }
    return false;
  }, [selectedNode?.data?.node?.output]);

  const applyExecutedStateForItems = useCallback(
    (loadedItems: CodeItem[]) => {
      if (!nodeHasPersistedOutput()) {
        setExecutedFilterIds(new Set());
        return;
      }
      if (loadedItems.length === 0) return;

      setExecutedFilterIds((prev) => {
        const next = new Set<string>();
        loadedItems.forEach((item) => {
          if (!sessionNewFilterIdsRef.current.has(item.id)) {
            next.add(item.id);
          }
        });
        prev.forEach((id) => {
          if (loadedItems.some((i) => i.id === id)) {
            next.add(id);
          }
        });
        return next;
      });
    },
    [nodeHasPersistedOutput]
  );

  useEffect(() => {
    sessionNewFilterIdsRef.current = new Set();
    setEditingFilterIds(new Set());
    setEditEnabledFilterIds(new Set());
  }, [selectedNode?.id, sourceId, activeRuleId, activeRuleName]);
  
  // Use global store for PREDICATE chat dialog
  const predicateChatState = usePredicateChatStore();

  // useEffect(() => {
  //   if (Array.isArray(initialData) && initialData.length > 0) {
  //     const initialItems = initialData.map((code, index) => ({
  //       id: `initial-${index}-${Date.now()}`,
  //       code: code || '',
  //     }));
  //     setItems(initialItems);
  //   } else {
  //     // Optionally, you can clear the items if initialData is empty or not provided
  //     // setItems([]);
  //   }
  // }, [initialData]);

  // Inside the CodeEditor component

  // Single source of truth: ALWAYS use node payload data (filter_conditions)
  // This is the most reliable source after any CRUD operation
  // CRITICAL: Filter by sourceId AND rule to ensure per-source AND per-rule isolation
  useEffect(() => {
    const filterConditions = selectedNode?.data?.node?.payload?.filter_conditions;

    // Always use filter_conditions if available
    if (Array.isArray(filterConditions)) {
      // CRITICAL: Filter by sourceId AND rule if provided (for per-source and per-rule isolation)
      let filteredConditions = filterConditions;
      if (sourceId || activeRuleName || activeRuleId) {
        filteredConditions = filterConditions.filter((condition: any) => {
          // Only include filters that match this sourceId
          const matchesSource = sourceId ? condition?.sourceId === sourceId : true;
          // CRITICAL: Also filter by rule to ensure per-rule isolation
          // This prevents filters from other rules with the same source from appearing
          const matchesRule = activeRuleName
            ? (condition?.rule === activeRuleName || !condition?.rule)  // Include if matches rule OR no rule property (legacy)
            : activeRuleId
            ? (condition?.rule?.includes(activeRuleId) || !condition?.rule)  // Fallback check by ruleId if rule name not available
            : !condition?.rule;  // If no rule name/id, only include filters without rule property
          return matchesSource && matchesRule;
        });
      }

      if (filteredConditions.length > 0) {
        const itemsFromNode: CodeItem[] = filteredConditions.map((data, index) => {
          let type: "auto" | "manual" | "ai_generated" = "auto";
          if (data.filter_type === "auto" || data.filter_type === "manual" || data.filter_type === "ai_generated") {
            type = data.filter_type;
          }

          return {
            id: data.id || `item-${Date.now()}-${index}`,
            code: data.filter || "",
            filter_type: type,
            sourceId: data.sourceId || sourceId,
            user_request: data.user_request,
          };
        });

        // Only update if items actually changed (prevent unnecessary re-renders)
        setItems(prev => {
          const prevIds = prev.map(p => p.id).sort().join(',');
          const newIds = itemsFromNode.map(i => i.id).sort().join(',');

          // Check if IDs are the same
          if (prevIds === newIds) {
            // IDs are the same, but check if filter content has changed
            const prevFilters = prev.map(p => `${p.id}:${p.code}`).sort().join('||');
            const newFilters = itemsFromNode.map(i => `${i.id}:${i.code}`).sort().join('||');

            if (prevFilters === newFilters) {
              return prev; // No change in content, keep previous reference
            }
            return itemsFromNode;
          }

          return itemsFromNode;
        });
        applyExecutedStateForItems(itemsFromNode);
      } else {
        // Filter conditions exist but empty array for this source/rule - clear items
        console.log('🔄 CodeEditor: Clearing items (no filter_conditions for sourceId:', sourceId, ', rule:', activeRuleName || activeRuleId, ')');
        setItems([]);
        setExecutedFilterIds(new Set());
        setEditingFilterIds(new Set());
        setEditEnabledFilterIds(new Set());
      }
    } else {
      // If no filter_conditions in payload, items should be empty
      console.log('🔄 CodeEditor: No filter_conditions in payload, clearing items');
      setItems([]);
      setExecutedFilterIds(new Set());
      setEditingFilterIds(new Set());
      setEditEnabledFilterIds(new Set());
    }

  }, [
    selectedNode?.data?.node?.payload?.filter_conditions,
    selectedNode?.data?.node?.output,
    sourceId,
    activeRuleId,
    activeRuleName,
    applyExecutedStateForItems,
  ]);

  const sensors = useSensors(  
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const saveUpdatedFilters = useCallback(
    async (updatedItems: CodeItem[]) => {
      const nodes = useFlowStore.getState().currentWorkflow?.data?.nodes;
      const currentNode: any = nodes.find(
        (n: any) => n.id === selectedNode?.id
      );
      if (!currentNode) return;

      const existingPayload = currentNode.data.node.payload || {};
      const originalFilters = existingPayload.filters || [];

      const originalFiltersMap = new Map(
        originalFilters.map((f: any) => [f.id, f])
      );

      // CRITICAL: Get existing filter_conditions from other sources (to preserve them)
      // CRITICAL: Also filter by rule to ensure per-rule isolation
      // CRITICAL FIX: Also exclude any IDs that exist in updatedItems to prevent duplicates
      const updatedItemIds = new Set(updatedItems.map(item => item.id));
      const otherSourcesFilterConditions = Array.isArray(existingPayload.filter_conditions)
        ? existingPayload.filter_conditions.filter((filter: any) => {  
            // CRITICAL: Exclude if this ID is being updated (prevents duplicates when filter_type changes)
            if (updatedItemIds.has(filter.id)) {
              return false;
            }
            // If sourceId is provided, only include filters from other sources
            if (sourceId) {
              const matchesSource = filter?.sourceId !== sourceId;
              // CRITICAL: Also check rule property - only include filters from other sources that belong to this rule
              const matchesRule = activeRuleName
                ? (filter?.rule === activeRuleName || !filter?.rule)  // Include if matches rule OR no rule property (legacy)
                : activeRuleId
                ? (filter?.rule?.includes(activeRuleId) || !filter?.rule)  // Fallback check by ruleId if rule name not available
                : !filter?.rule;  // If no rule name/id, only include filters without rule property
              return matchesSource && matchesRule;
            }
            // If no sourceId, we still need to exclude updated IDs (already done above)
            return false; // Don't include in otherSourcesFilterConditions since we'll add from updatedFilterConditions
          })
        : [];

      // CRITICAL: Only update filter_conditions for the current source
      // CRITICAL: Also tag with rule for per-rule isolation
      const updatedFilterConditions = updatedItems.map((item, index) => ({
        id: item.id,
        index: index, // Assign the new index based on the current order
        filter: item.code,
        filter_type: item.filter_type,
        sourceId: sourceId || item.sourceId, // Preserve sourceId
        ...(activeRuleName && { rule: activeRuleName }), // Tag with rule name for per-rule isolation
        user_request: item.user_request,
      }));

      // CRITICAL: Combine filter_conditions from other sources + updated filter_conditions for this source
      const allFilterConditions = [...otherSourcesFilterConditions, ...updatedFilterConditions];

      // CRITICAL: Get existing filters from other sources (to preserve them)
      // CRITICAL: Also filter by rule to ensure per-rule isolation
      // CRITICAL FIX: Also exclude any IDs that exist in updatedItems to prevent duplicates
      const otherSourcesFilters = Array.isArray(existingPayload.filters)
        ? existingPayload.filters.filter((filter: any) => {
            // CRITICAL: Exclude if this ID is being updated (prevents duplicates when filter_type changes)
            if (updatedItemIds.has(filter.id)) {
              return false;
            }
            // If sourceId is provided, only include filters from other sources
            if (sourceId) {
              const matchesSource = filter?.sourceId !== sourceId;
              // CRITICAL: Also check rule property - only include filters from other sources that belong to this rule
              const matchesRule = activeRuleName
                ? (filter?.rule === activeRuleName || !filter?.rule)  // Include if matches rule OR no rule property (legacy)
                : activeRuleId
                ? (filter?.rule?.includes(activeRuleId) || !filter?.rule)  // Fallback check by ruleId if rule name not available
                : !filter?.rule;  // If no rule name/id, only include filters without rule property
              return matchesSource && matchesRule;
            }
            // If no sourceId, we still need to exclude updated IDs (already done above)
            return false; // Don't include in otherSourcesFilters since we'll add from reorderedFilters
          })
        : [];

      // CRITICAL: Only get filters for the current source
      const reorderedFilters = updatedItems
        .map((item) => {
          if (item.filter_type === "auto") {
            // Find the original full filter object from the map
            const filter = originalFiltersMap.get(item.id);
            // Ensure filter has correct sourceId
            if (filter && sourceId && typeof filter === 'object') {
              return { ...filter, sourceId: sourceId };
            }
            return filter;
          } else if (item.filter_type === "ai_generated") {
            // For AI-generated filters, create a simple filter object
            return {
              id: item.id,
              predicate: item.code,
              filter_type: "ai_generated",
              sourceId: sourceId,
              user_request: item.user_request,
            };
          } else if (item.filter_type === "manual") {
            // For manual filters, create a simple filter object
            return {
              id: item.id,
              predicate: item.code,
              filter_type: "manual",
              sourceId: sourceId,
            };
          }
          return null;
        })
        .filter(Boolean);

      // CRITICAL: Combine filters from other sources + reordered filters for this source
      const allFilters = [...otherSourcesFilters, ...reorderedFilters];

      selectedNode.data.node.payload.filter_conditions = allFilterConditions;
      selectedNode.data.node.payload.filters = allFilters;

      useFlowStore.getState().updateNodeData(selectedNode.id, selectedNode.data);

      // try {
      //   const response = await saveNodeDetailsApi(
      //     selectedNode?.data?.node?.save_node,
      //     selectedNode?.data
      //   );
      //   if (response?.id) {
      //     // useFlowStore.getState().updateNodeData(selectedNode.id, response?.data);
      //   }
      // } catch (error) {
      //   console.error("Failed to save updated filter order:", error);
      //   toast.error("Failed to save filter order");
      // }
    },
    [selectedNode]
  );

  // Replace the old handleDragEnd with this one
  
  const handleDragEnd = useCallback(  
    async (event: DragEndEvent) => {  
      const { active, over } = event;

      if (active.id !== over?.id) {  
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over!.id);
        const newItems = arrayMove(items, oldIndex, newIndex);

        // Update the UI state immediately for a responsive feel
        setItems(newItems);
        // Call the centralized save function with the newly ordered items
        await saveUpdatedFilters(newItems);
        toast.success("Filter order updated successfully");
      }
    },
    [items, saveUpdatedFilters]
  );

  const saveManualFilters = useCallback(  
    async (updatedItems: CodeItem[]) => { 
      const nodes = useFlowStore.getState().currentWorkflow?.data?.nodes;
      const currentNode: any = nodes.find( 
        (n: any) => n.id === selectedNode?.id
      );

      if (!currentNode) return;

      const existingPayload = currentNode?.data?.node?.payload || {};

      // CRITICAL: Get existing filter_conditions from other sources (to preserve them)
      // CRITICAL: Also filter by rule to ensure per-rule isolation
      // CRITICAL FIX: Also exclude any IDs that exist in updatedItems to prevent duplicates

      const updatedItemIds = new Set(updatedItems.map(item => item.id));
      const otherSourcesFilterConditions = Array.isArray(existingPayload.filter_conditions)
        ? existingPayload.filter_conditions.filter((filter: any) => {
            // CRITICAL: Exclude if this ID is being updated (prevents duplicates when filter_type changes)
            if (updatedItemIds.has(filter.id)) {  
              return false;
            }
            // If sourceId is provided, only include filters from other sources
            if (sourceId) {
              const matchesSource = filter?.sourceId !== sourceId;
              // CRITICAL: Also check rule property - only include filters from other sources that belong to this rule
              const matchesRule = activeRuleName
                ? (filter?.rule === activeRuleName || !filter?.rule)  // Include if matches rule OR no rule property (legacy)
                : activeRuleId
                ? (filter?.rule?.includes(activeRuleId) || !filter?.rule)  // Fallback check by ruleId if rule name not available
                : !filter?.rule;  // If no rule name/id, only include filters without rule property
              return matchesSource && matchesRule;
            }
            // If no sourceId, we still need to exclude updated IDs (already done above)
            return false; // Don't include in otherSourcesFilterConditions since we'll add from updatedFilterConditions
          })
        : [];

      // Construct the new `filter_conditions` array from the component's state
      // CRITICAL: Also tag with rule for per-rule isolation
      const updatedFilterConditions = updatedItems.map((item, index) => ({
        id: item.id,
        index: index, // Ensure the index is always current
        filter: item.code,
        filter_type: item.filter_type,
        sourceId: item.sourceId || sourceId, // Preserve sourceId
        ...(activeRuleName && { rule: activeRuleName }), // Tag with rule name for per-rule isolation
      }));

      // CRITICAL: Get existing filters from other sources (to preserve them)
      const otherSourcesFilters = Array.isArray(existingPayload.filters)
        ? existingPayload.filters.filter((filter: any) => {
            // CRITICAL: Exclude if this ID is being updated (prevents duplicates)
            if (updatedItemIds.has(filter.id)) {  
              return false;
            }
            // If sourceId is provided, only include filters from other sources
            if (sourceId) {
              const matchesSource = filter?.sourceId !== sourceId;
              const matchesRule = activeRuleName
                ? (filter?.rule === activeRuleName || !filter?.rule)
                : activeRuleId
                ? (filter?.rule?.includes(activeRuleId) || !filter?.rule)
                : !filter?.rule;
              return matchesSource && matchesRule;
            }
            return false;
          })
        : [];

      // Construct the new `filters` array from the component's state
      const updatedFilters = updatedItems.map((item) => ({
        id: item.id,
        predicate: item.code,
        filter_type: item.filter_type,
        sourceId: item.sourceId || sourceId,
        ...(activeRuleName && { rule: activeRuleName }),
      }));

      // CRITICAL: Combine filters from other sources + updated filters for this source
      const allFilters = [...otherSourcesFilters, ...updatedFilters];

      // CRITICAL: Combine filter_conditions from other sources + updated filter_conditions for this source
      const allFilterConditions = [...otherSourcesFilterConditions, ...updatedFilterConditions];

      const updatedNode = {   
        ...currentNode,
        data: { 
          ...currentNode.data,
          node: {
            ...currentNode.data.node,
              payload: {
                ...existingPayload,
                filter_conditions: allFilterConditions,
                filters: allFilters,
              },
          },
        },
      };

      try {
        // Add required fields for the save API
        const savePayload = {
          ...updatedNode.data,
          current_node_id: currentNode?.id,
          flow_id: currentNode?.data?.flow_id || useFlowStore.getState().currentWorkflow?.flow_id,
        };

        const response = await saveNodeDetailsApi(
          currentNode?.data?.node?.save_node,
          savePayload
        );

        if (response?.id) {
          const updatedNodes = nodes.map((n: any) =>
            n.id === currentNode.id ? { ...n, data: response } : n
          );
          useFlowStore.getState().updateNodeData(currentNode.id, updatedNode);
        }
      } catch (error) {
        console.error("Failed to save manual filters:", error);
      }
    },
    [selectedNode, sourceId]
  );

  // In handleCodeChange, change the last line:
  const handleCodeChange = useCallback( 
    (id: string, newCode: string) => {
      const currentItems = itemsRef.current;
      const targetItem = currentItems.find((item) => item.id === id);
      if (!targetItem) return;

      if (newCode === targetItem.code) return;

      const isExplicitlyEditing = editingFilterIdsRef.current.has(id);
      if (targetItem.filter_type === "ai_generated" && !isExplicitlyEditing) {
        return;
      }

      const updatedItems: CodeItem[] = currentItems.map((item): CodeItem => {
        if (item.id !== id) return item;

        let nextFilterType = item.filter_type;
        if (item.filter_type === "auto" || (item.filter_type === "ai_generated" && isExplicitlyEditing)) {
          nextFilterType = "manual";
        }

        return {
          ...item,
          code: newCode,
          filter_type: nextFilterType,
          sourceId: item.sourceId || sourceId,
        };
      });

      itemsRef.current = updatedItems;
      setItems(updatedItems);

      const timeoutKey = `timeout_${id}`;
      if ((window as any)[timeoutKey]) {
        clearTimeout((window as any)[timeoutKey]);
      }

      const timeoutId = setTimeout(() => {
        saveUpdatedFilters(itemsRef.current);
      }, 1000);
      (window as any)[timeoutKey] = timeoutId;
    },
    [saveUpdatedFilters, sourceId]
  );

  const handleDelete = useCallback(   
    (id: string) => {   
      // CRITICAL: Clear all pending debounced saves to prevent them from overwriting the deletion
      // Pending saves from handleCodeChange can restore deleted filters if not cleared
      clearPendingFilterSaveTimeouts();

      const setResult = useExecutionResultStore.getState().setResult;

      // Get source nodes directly instead of relying on the hook
      const nodes = useFlowStore.getState().currentWorkflow?.data?.nodes;
      const edges = useFlowStore.getState().currentWorkflow?.data?.edges;
      const incomingEdges = edges?.filter(edge => edge.target === selectedNode?.id);
      const sourceIds = incomingEdges?.map(edge => edge.source);
      const directSourceNodes = nodes?.filter(node => sourceIds?.includes(node.id));

      deleteFilterById({ id, selectedNode, items, setItems, sourceNodes: directSourceNodes, setResult, sourceId });
      setExecutedFilterIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setEditingFilterIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setEditEnabledFilterIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },
    [selectedNode, items, sourceId, clearPendingFilterSaveTimeouts]
  );

  const handleToggleEdit = useCallback((id: string) => {
    setEditingFilterIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleToggleEditEnabled = useCallback((id: string, enabled: boolean) => {
    setEditEnabledFilterIds((prev) => {
      const next = new Set(prev);
      if (enabled) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
    if (!enabled) {
      setEditingFilterIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, []);

  const handleItemExecute = useCallback(
    async (item: CodeItem) => {
      if (runningFilterIds.has(item.id)) return;

      if (!item.code?.trim()) {
        toast.error(FILTER_EXECUTE_ERROR_MSG);
        return;
      }

      setRunningFilterIds((prev) => new Set(prev).add(item.id));
      try {
        const result = await onExecute(item, items);
        if (result !== false) {
          sessionNewFilterIdsRef.current.delete(item.id);
          setExecutedFilterIds((prev) => new Set(prev).add(item.id));
          setEditingFilterIds((prev) => {
            const next = new Set(prev);
            next.delete(item.id);
            return next;
          });
          toast.success("Filter executed successfully");
        } else {
          toast.error(FILTER_EXECUTE_ERROR_MSG);
        }
      } catch (error) {
        console.error("Filter execution error:", error);
        toast.error(FILTER_EXECUTE_ERROR_MSG);
      } finally {
        setRunningFilterIds((prev) => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
      }
    },
    [onExecute]
  );

  const handleAddNew = useCallback(async () => {   
    clearPendingFilterSaveTimeouts();

    const newItem: CodeItem = {
      id: `manual-${Date.now()}`,
      code: "# Enter your Python code here\n",
      filter_type: "manual",
      sourceId: sourceId,
    };
    sessionNewFilterIdsRef.current.add(newItem.id);
    const updatedItems = [...itemsRef.current, newItem];
    itemsRef.current = updatedItems;
    setItems(updatedItems);
    await saveUpdatedFilters(updatedItems);
    toast.success("New filter added successfully");
  }, [saveUpdatedFilters, sourceId, clearPendingFilterSaveTimeouts]);

  const handleExecuteAll = useCallback(async () => {
    if (isRunningAll) return;

    const nodes = useFlowStore.getState().currentWorkflow?.data?.nodes;
    const edges = useFlowStore.getState().currentWorkflow?.data?.edges;
    const currentNode: any = nodes?.find(
      (node: any) => node.id === selectedNode?.id
    );
    // CRITICAL: Read filters from currentNode (fresh from store), not selectedNode (may be stale)
    const filters = currentNode?.data?.node?.payload?.filters;
    const setResult = useExecutionResultStore.getState().setResult;

    if (!Array.isArray(filters) || filters.length === 0) {
      toast.info("No filters to execute");
      return;
    }
    // Get source nodes directly instead of relying on the hook
    const incomingEdges = edges?.filter(edge => edge.target === selectedNode?.id);
    const sourceIds = incomingEdges?.map(edge => edge.source);
    const directSourceNodes = nodes?.filter(node => sourceIds?.includes(node.id));

    if (!directSourceNodes || directSourceNodes.length === 0) {  
      toast.error("No source data available. Please connect a source node to this filter node.");
      return;
    }

    const output = directSourceNodes[0]?.data?.node?.output;
    const rawData = output?.data;
    let sourceData: any[] = [];
    if (rawData && typeof rawData === 'object' && !Array.isArray(rawData)) {
      const key = selectedSourceKey && rawData.hasOwnProperty(selectedSourceKey) ? selectedSourceKey : Object.keys(rawData)[0];
      sourceData = key ? (rawData[key] || []) : [];
    } else {
      sourceData = Array.isArray(rawData) ? rawData : [];
    }
    if (!sourceData || sourceData.length === 0) {  
      toast.error("Source node has no output data. Please execute the source node first.");
      return;
    }

    setIsRunningAll(true);
    try {
      // Construct fresh payload for execution
      const payload = {
        key: "on-submit",
        records: {},
        stmtDate: new Date().toISOString().split('T')[0],
        is_pandas: false,
        is_polars: true,
        data_fields: [
          {
            key: "dataframe",
            type: "node-input",
            required: true,
            display_name: "Input Datasets"
          }
        ],
        ...currentNode.data.node.payload,
        dataframe: JSON.stringify(sourceData),
        actions: "filter_executor",
        response_type: "json",
        node_id: selectedNode?.id,
        flow_id: selectedNode?.data?.flow_id,
      };

      const response = await saveNodeDetailsApi(  
        currentNode?.data?.node?.execute_node,
        { payload: payload }
      );

      if (response?.status) {
        const flowId = selectedNode?.data?.flow_id || useFlowStore.getState().currentWorkflow?.flow_id;
        const nodeOutput = await hydrateNodeOutputAfterExecution(
          flowId,
          currentNode?.id,
          response
        );

        useFlowStore.getState().updateNodeData(currentNode?.id, {
          node: {
            ...currentNode?.data?.node,
            output: nodeOutput,
          },
        });

        toast.success("Filters executed successfully");

        setResult({
          id: currentNode?.id,
          columns: nodeOutput?.columns,
          data: nodeOutput?.data,
          execution_time: response?.execution_time,
          message: response?.message,
          status: response?.status,
        });

        items.forEach((item) => sessionNewFilterIdsRef.current.delete(item.id));
        setExecutedFilterIds(new Set(items.map((item) => item.id)));
        setEditingFilterIds(new Set());
      } else {
        toast.error(FILTER_EXECUTE_ERROR_MSG);
      }
    } catch (error) {
      console.error("Failed to execute filters:", error);
      toast.error(FILTER_EXECUTE_ERROR_MSG);
    } finally {
      setIsRunningAll(false);
    }

  }, [selectedNode, selectedSourceKey, items, isRunningAll]);

  const handleAiApply = useCallback(async (filter: string, userRequest?: string) => {
    clearPendingFilterSaveTimeouts();

    const newItem: CodeItem = {
      id: `ai-${Date.now()}`,
      code: filter,
      filter_type: "ai_generated",
      sourceId: sourceId,
      user_request: userRequest,
    };
    sessionNewFilterIdsRef.current.add(newItem.id);
    const updatedItems = [...itemsRef.current, newItem];
    itemsRef.current = updatedItems;
    setItems(updatedItems);

    await saveUpdatedFilters(updatedItems);
    toast.success("AI-generated filter added successfully");
    setShowAiPanel(false);
  }, [saveUpdatedFilters, sourceId, clearPendingFilterSaveTimeouts]);

  const handleAiChatCodeGenerated = useCallback(async (code: string) => {
    clearPendingFilterSaveTimeouts();

    const userRequest = usePredicateChatStore.getState().initialUserRequest;
    const newItem: CodeItem = {
      id: `ai-${Date.now()}`,
      code: code,
      filter_type: "ai_generated",
      sourceId: sourceId,
      user_request: userRequest,
    };
    sessionNewFilterIdsRef.current.add(newItem.id);
    const updatedItems = [...itemsRef.current, newItem];
    itemsRef.current = updatedItems;
    setItems(updatedItems);

    await saveUpdatedFilters(updatedItems);
    toast.success("AI-generated filter added successfully");
    // Keep chat dialog open for further interactions
  }, [saveUpdatedFilters, sourceId, clearPendingFilterSaveTimeouts]);

  const handleAiDiscard = useCallback(() => {
    setShowAiPanel(false);
  }, []);

  const handleOpenChatDialog = useCallback((initialData: {
    question: string;
    options: { [key: string]: string[] };
    conversationId?: string;
    eventId?: string;
    userRequest?: string;
  }) => {
    const context = getTableContext();
    predicateChatState.openChat({
      tableContext: context,
      initialQuestion: initialData.question,
      initialOptions: initialData.options,
      initialConversationId: initialData.conversationId,
      initialEventId: initialData.eventId,
      initialUserRequest: initialData.userRequest,
      onCodeGenerated: handleAiChatCodeGenerated,
    });
    setShowAiPanel(false); // Close the horizontal panel
  }, [predicateChatState, handleAiChatCodeGenerated]);

  // Get table context from current node's output (filtered data) for AI panel
  const getTableContext = useCallback(() => {
    // Helper function to detect data type
    const detectType = (value: any): string => {
      if (value === null || value === undefined) return 'Utf8';

      const valueType = typeof value;
      if (valueType === 'number') {
        return Number.isInteger(value) ? 'Int64' : 'Float64';
      }
      if (valueType === 'boolean') return 'Boolean';

      // Check if it's a date string
      const dateStr = String(value);
      if (!isNaN(Date.parse(dateStr)) && dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
        return 'Datetime';
      }

      return 'Utf8';
    };

    // First try to get data from the current node's output (if filters have been executed)
    let data: any[] | undefined = selectedNode?.data?.node?.output?.data;
    let columns = selectedNode?.data?.node?.output?.columns;

    // If current node doesn't have output data, fall back to source node
    if (!data || !Array.isArray(data) || data.length === 0) {
      if (!sourceNodes || sourceNodes.length === 0) return undefined;
      const output = sourceNodes[0]?.data?.node?.output;
      const rawData = output?.data;
      if (rawData && typeof rawData === 'object' && !Array.isArray(rawData)) {
        const key = selectedSourceKey && rawData.hasOwnProperty(selectedSourceKey) ? selectedSourceKey : Object.keys(rawData)[0];
        data = key ? (rawData[key] || []) : [];
        columns = data.length > 0 && data[0] ? Object.keys(data[0]) : [];
      } else {
        data = output?.data;
        columns = output?.columns;
      }
    }

    // If still no data, return undefined
    if (!data || !Array.isArray(data) || data.length === 0) {
      return undefined;
    }

    // If no columns provided, extract from first data row
    if (!columns || columns.length === 0) {
      const firstRow = data[0];
      columns = firstRow ? Object.keys(firstRow) : [];
    }

    // Prepare sample row for type detection
    const sampleRow = data[0] || {};

    // Build schema with proper type detection
    const schema = columns.map((column: string) => ({
      column: column,
      type: detectType(sampleRow[column]),
      description: ''
    }));

    return {
      schema,
      data: [sampleRow] // Send first row as sample
    };
  }, [selectedNode, sourceNodes, selectedSourceKey]);

  const totalLines = items.reduce(
    (acc, item) => acc + item?.code?.split("\n").length,
    0
  );

  const totalChars = items.reduce((acc, item) => acc + item?.code?.length, 0);
  const executableCommands = items.filter((item) => item?.code?.trim()).length;

  return (  
    <div className="w-full mx-auto p-0">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-md flex items-center gap-3 font-bold text-foreground">
            <Code className="h-5 w-5 text-blue-500" />
            Code Editor
          </h2>
          <p className=" flex items-center gap-4">
            <span className="text-sm">
              Edit, reorder, and execute your Python commands
            </span>
            {items.length > 0 && (
              <span className="text-sm px-2 py-1 rounded  ">
                {totalLines} lines • {totalChars} characters
              </span>
            )}
          </p>
        </div>
<div className="flex items-center gap-3 flex-shrink-0">
    {items.length > 0 && (
    <div className="rounded-lg border border-slate-200 bg-primary-800 px-3 py-2 shadow-sm">
      <label className="flex items-center gap-2 cursor-pointer text-sm whitespace-nowrap ">
        <input
          type="checkbox"
          checked={isReorderEnabled}
          onChange={(e) => setIsReorderEnabled(e.target.checked)}
          className="w-4 h-4 text-primary"
        />
        <span>Enable Reorder</span>
      </label>
    </div>
  )}
                    <Button
  onClick={() => {
    const context = getTableContext();
    predicateChatState.openChat({
      tableContext: context,
      onCodeGenerated: handleAiChatCodeGenerated,
    });
  }}
  variant="outline"
  size="icon"
  className="w-9 h-9 shrink-0 border-purple-300 hover:bg-purple-50 shadow-sm"
  title="AI Chat with History"
>
  <MessageSquare className="h-5 w-5 text-purple-600" />
</Button>
         <Button
  onClick={() => setShowAiPanel(!showAiPanel)}
  variant="outline"
  size="icon"
  className="w-9 h-9 shrink-0 border-primary/30 hover:bg-primary/10 shadow-sm"
  title="AI Generate Filter (Quick)"
>
  <img src={AiIcon} alt="AI" className="h-6 w-6" />
</Button>

          <Button
            onClick={handleAddNew}
            variant="outline"
            className="flex items-center gap-2 hover:bg-primary/10 border-blue-200"
          >
            <Plus className="h-4 w-4" />
            Add Command
          </Button>
          <Button
            onClick={() => void handleExecuteAll()}
            disabled={executableCommands === 0 || isRunningAll}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
          >
            {isRunningAll ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {isRunningAll ? "Running..." : `Run All (${executableCommands})`}
          </Button>
        </div>
      </div>

      {/* AI Panel - shown above commands when toggled */}
      {showAiPanel && (() => {
        const context = getTableContext();
        console.log('🔍 AI Panel Context:', context);
        console.log('📊 Source Nodes:', sourceNodes);
        console.log('🎯 Selected Node Output:', selectedNode?.data?.node?.output);
        return (
          <div className="mb-4">
            <HorizontalAiPanel
              onApply={handleAiApply}
              onDiscard={handleAiDiscard}
              context={context}
              showExecuteButton={false}
              onOpenChatDialog={handleOpenChatDialog}
            />
          </div>
        );
      })()}

      {items.length === 0 ? (
        <Card className="border-2 border-dashed border-border transition-colors hover:border-primary/50">
          <CardContent className="flex flex-col items-center justify-center py-3">
            <div className="text-center text-muted-foreground">
              <Code className="mx-auto mb-4 h-10 w-10 text-muted-foreground/50" />
              <h3 className="text-xl font-medium mb-2">No commands yet</h3>
              <p className="text-sm mb-6 max-w-md">
                Create your first Filter command to get started. Start with
                simple mode and upgrade to enhanced mode when needed.
              </p>
              <Button
                onClick={handleAddNew}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Add Your First Filter
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : isReorderEnabled ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={() => setIsDragActive(true)}
          onDragEnd={(event) => {
            setIsDragActive(false);
            handleDragEnd(event);
          }}
          onDragCancel={() => setIsDragActive(false)}
        >
          <SortableContext
            items={items.map((item) => item.id)}
            strategy={verticalListSortingStrategy}
          >
            {items.map((item, index) => (
              <SortableItem
                key={item.id}
                item={item}
                index={index}
                isDragActive={isDragActive}
                isExecuted={executedFilterIds.has(item.id)}
                isEditing={editingFilterIds.has(item.id)}
                isRunning={runningFilterIds.has(item.id)}
                onCodeChange={handleCodeChange}
                onDelete={handleDelete}
                onExecute={handleItemExecute}
                onTriggerEdit={onTriggerEdit}
                onToggleEdit={handleToggleEdit}
                isReorderEnabled={isReorderEnabled}
                isEditEnabled={editEnabledFilterIds.has(item.id)}
                onToggleEditEnabled={handleToggleEditEnabled}
              />
            ))}
          </SortableContext>
        </DndContext>
      ) : (
        // When reorder is disabled, just render regular items without drag/drop
        <div>
          {items.map((item, index) => (
            <SortableItem
              key={item.id}
              item={item}
              index={index}
              isDragActive={false} // Disable drag indicators
              isExecuted={executedFilterIds.has(item.id)}
              isEditing={editingFilterIds.has(item.id)}
              isRunning={runningFilterIds.has(item.id)}
              onCodeChange={handleCodeChange}
              onDelete={handleDelete}
              onExecute={handleItemExecute}
              onTriggerEdit={onTriggerEdit}
              onToggleEdit={handleToggleEdit}
              isReorderEnabled={false}
              isEditEnabled={editEnabledFilterIds.has(item.id)}
              onToggleEditEnabled={handleToggleEditEnabled}
            />
          ))}
        </div>
      )}

      {/* {items.length > 0 && (
        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-blue-700">
              <Code className="h-4 w-4" />
              <span className="font-medium">Smart Editor Features:</span>
              <span>Enhanced & Simple Modes • Error Recovery • Drag & Drop</span>
            </div>
            <span className="text-blue-600">
              💡 Start with simple mode, upgrade to enhanced when needed
            </span>
          </div>
        </div>
      )} */}



      <AiPredicateChatDialog
        isOpen={predicateChatState.isOpen}
        onClose={() => predicateChatState.closeChat()}
        onCodeGenerated={predicateChatState.onCodeGenerated}
        tableContext={predicateChatState.tableContext}
        initialQuestion={predicateChatState.initialQuestion}
        initialOptions={predicateChatState.initialOptions}
        initialMissingColumns={predicateChatState.initialMissingColumns}
        initialConversationId={predicateChatState.initialConversationId}
        initialEventId={predicateChatState.initialEventId}
        initialUserRequest={predicateChatState.initialUserRequest}
      />
    </div>
  );
};

export default CodeEditor;