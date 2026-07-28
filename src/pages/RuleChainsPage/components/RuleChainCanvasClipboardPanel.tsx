import { useCallback, useEffect, type Dispatch, type SetStateAction } from "react";
import { Panel, useReactFlow } from "@xyflow/react";
import { ClipboardCopy, ClipboardPaste, Move } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  pasteFromSessionClipboardIfAny,
  pasteRuleChainClipboardIntoCanvas,
} from "../rule-node/ruleChainClipboardActions";
import { readRuleChainClipboardPayload } from "../rule-node/ruleChainSessionClipboard";

type Props = {
  copyMarqueeActive: boolean;
  setCopyMarqueeActive: Dispatch<SetStateAction<boolean>>;
  moveMarqueeActive: boolean;
  setMoveMarqueeActive: Dispatch<SetStateAction<boolean>>;
  /** Same handler as context menu Copy (writes clipboard + exits copy mode). */
  onConfirmCopy: () => void;
};

/**
 * Canvas rail: copy / move selection modes + paste from session clipboard.
 */
export function RuleChainCanvasClipboardPanel({
  copyMarqueeActive,
  setCopyMarqueeActive,
  moveMarqueeActive,
  setMoveMarqueeActive,
  onConfirmCopy,
}: Props) {
  const { setNodes, setEdges } = useReactFlow();

  const onCopyToolbarClick = useCallback(() => {
    if (!copyMarqueeActive) {
      setMoveMarqueeActive(false);
      setCopyMarqueeActive(true);
      toast.message(
        "Copy mode: drag on the canvas to box-select nodes (Input is never copied), or ⌘/Ctrl/Shift-click. Right-click → Copy when done. Middle- or right-drag pans. Click the Copy icon again to exit without copying.",
      );
      return;
    }
    setCopyMarqueeActive(false);
    toast.message("Copy mode off.");
  }, [copyMarqueeActive, setCopyMarqueeActive, setMoveMarqueeActive]);

  const onMoveToolbarClick = useCallback(() => {
    if (!moveMarqueeActive) {
      setCopyMarqueeActive(false);
      setMoveMarqueeActive(true);
      toast.message(
        "Move mode: box-select rule nodes (Input is fixed), or ⌘/Ctrl/Shift-click. Drag any selected node to move the whole group. Middle- or right-drag pans. Click the Move icon again to exit.",
      );
      return;
    }
    setMoveMarqueeActive(false);
    toast.message("Move mode off.");
  }, [moveMarqueeActive, setCopyMarqueeActive, setMoveMarqueeActive]);

  const onPasteToolbarClick = useCallback(() => {
    const p = readRuleChainClipboardPayload();
    if (!p?.nodes.length) {
      toast.message("Nothing in the rule-chain clipboard. Use Copy on a chain first.");
      return;
    }
    const n = pasteRuleChainClipboardIntoCanvas(p, setNodes, setEdges);
    toast.success(`Pasted ${n} node(s) with full configuration.`);
  }, [setNodes, setEdges]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (copyMarqueeActive) {
          e.preventDefault();
          setCopyMarqueeActive(false);
          toast.message("Copy mode canceled.");
          return;
        }
        if (moveMarqueeActive) {
          e.preventDefault();
          setMoveMarqueeActive(false);
          toast.message("Move mode canceled.");
        }
        return;
      }
      if (!e.ctrlKey && !e.metaKey) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, textarea, select, [contenteditable=true]")) return;
      if (el?.closest(".monaco-editor, [class*='monaco']")) return;
      const k = e.key.toLowerCase();
      if (k === "c") {
        e.preventDefault();
        if (!copyMarqueeActive) {
          toast.message("Click the Copy icon on the canvas to enter copy mode first.");
          return;
        }
        onConfirmCopy();
      } else if (k === "v") {
        e.preventDefault();
        const n = pasteFromSessionClipboardIfAny(setNodes, setEdges);
        if (n > 0) toast.success(`Pasted ${n} node(s).`);
        else toast.message("Nothing in the rule-chain clipboard.");
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [copyMarqueeActive, moveMarqueeActive, onConfirmCopy, setNodes, setEdges, setCopyMarqueeActive, setMoveMarqueeActive]);

  return (
    <Panel position="center-right" className="m-2 flex flex-col gap-1">
      <Button
        type="button"
        size="icon"
        variant={copyMarqueeActive ? "default" : "secondary"}
        className={cn(
          "h-9 w-9 shrink-0 rounded-md border border-border shadow-md",
          copyMarqueeActive ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "bg-card",
        )}
        title={
          copyMarqueeActive
            ? "Exit copy mode (no copy)"
            : "Enter copy mode: select nodes, then right-click → Copy"
        }
        onClick={onCopyToolbarClick}
      >
        <ClipboardCopy className="h-4 w-4" aria-hidden />
      </Button>
      <Button
        type="button"
        size="icon"
        variant={moveMarqueeActive ? "default" : "secondary"}
        className={cn(
          "h-9 w-9 shrink-0 rounded-md border border-border shadow-md",
          moveMarqueeActive ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "bg-card",
        )}
        title={
          moveMarqueeActive
            ? "Exit move mode"
            : "Enter move mode: select nodes, then drag to reposition the group"
        }
        onClick={onMoveToolbarClick}
      >
        <Move className="h-4 w-4" aria-hidden />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="secondary"
        className="h-9 w-9 shrink-0 rounded-md border border-border bg-card shadow-md"
        title="Paste from rule-chain clipboard (full configuration). Shortcut: ⌘/Ctrl+V"
        onClick={onPasteToolbarClick}
      >
        <ClipboardPaste className="h-4 w-4" aria-hidden />
      </Button>
    </Panel>
  );
}
