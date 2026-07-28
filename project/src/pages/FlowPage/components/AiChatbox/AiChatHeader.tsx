"use client";

import * as React from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { X, ChevronDown, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { WorkflowDropdownMenu } from "./WorkflowDropdownMenu";

interface AiChatHeaderProps {
  workflowName: string;
  isWorkflowLocked?: boolean;
  showWorkflowDropdown: boolean;
  onWorkflowDropdownToggle: () => void;
  onSelectHistory: () => void;
  onSelectWorkflows: () => void;
  onSelectRename: () => void;
  onNewChat: () => void;
  onClose: () => void;
}

export function AiChatHeader({
  workflowName,
  isWorkflowLocked,
  showWorkflowDropdown,
  onWorkflowDropdownToggle,
  onSelectHistory,
  onSelectWorkflows,
  onSelectRename,
  onNewChat,
  onClose,
}: AiChatHeaderProps) {
  const isLongName = workflowName.length > 15;

  const button = (
    <button
      onClick={onWorkflowDropdownToggle}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-muted transition text-sm font-medium"
    >
      <span className="max-w-[150px] truncate">{workflowName}</span>
      {isWorkflowLocked && (
        <Lock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
      )}
      <ChevronDown
        className={cn(
          "h-3.5 w-3.5 transition-transform flex-shrink-0",
          showWorkflowDropdown && "rotate-180"
        )}
      />
    </button>
  );

  return (
    <div className="bg-muted/30 rounded-xl p-2 flex items-center gap-2">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full border-2 relative overflow-hidden flex-shrink-0 ai-pulse">
            <div
              className="absolute inset-0 rounded-full animate-gradient-spin"
              style={{
                background:
                  "conic-gradient(from 0deg, #6366f1, #a21caf, #6366f1 100%)",
              }}
            />
            <div className="absolute inset-1 rounded-full bg-background" />
          </div>
          <span className="text-xs font-semibold">ASK AI</span>
        </div>

        <div className="flex-1" />

        <div className="relative" data-workflow-dropdown>
          {isLongName ? (
            <Tooltip>
              <TooltipTrigger asChild>{button}</TooltipTrigger>
              <TooltipContent>
                <p>{workflowName}</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            button
          )}

          <WorkflowDropdownMenu
            open={showWorkflowDropdown}
            onSelectHistory={onSelectHistory}
            onSelectWorkflows={onSelectWorkflows}
            onSelectRename={onSelectRename}
            onNewChat={onNewChat}
          />
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="h-8 w-8 flex items-center justify-center hover:bg-muted rounded-lg transition"
        >
          <X className="h-4.5 w-4.5" />
        </button>
      </div>
  );
}
