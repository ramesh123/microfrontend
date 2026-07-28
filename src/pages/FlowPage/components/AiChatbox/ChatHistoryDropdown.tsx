"use client";

import * as React from "react";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateToIST } from "@/utils/formatters";

interface Conversation {
  conversation_id: string;
  conversation_name?: string;
  updated_at: string;
}

interface ChatHistoryDropdownProps {
  open: boolean;
  isLoading: boolean;
  conversations: Conversation[];
  currentConversationId: string | null;
  editingConversationId: string | null;
  editingName: string;
  deletingConversationId: string | null;
  onConversationSelect: (id: string) => void;
  onStartEditName: (id: string, currentName: string, e: React.MouseEvent) => void;
  onNameChange: (id: string, value: string) => void;
  onCancelEdit: () => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onReloadConversations: () => void;
}

export function ChatHistoryDropdown({
  open,
  isLoading,
  conversations,
  currentConversationId,
  editingConversationId,
  editingName,
  deletingConversationId,
  onConversationSelect,
  onStartEditName,
  onNameChange,
  onCancelEdit,
  onDelete,
  onConfirmDelete,
  onCancelDelete,
  onReloadConversations,
}: ChatHistoryDropdownProps) {
  if (!open) return null;

  return (
    <div className="mt-1.5 bg-muted/30 rounded-lg p-1.5 space-y-0.5">
      <div className="px-2.5 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase">
        Chat History
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="px-2.5 py-3 text-xs text-muted-foreground text-center">
          No chat history available
        </div>
      ) : (
        <div className="max-h-[300px] overflow-y-auto space-y-0.5">
          {conversations.map((conv) => {
            const isEditing = editingConversationId === conv.conversation_id;
            return (
              <div
                key={conv.conversation_id}
                onClick={() =>
                  !isEditing && onConversationSelect(conv.conversation_id)
                }
                className={cn(
                  "w-full px-2.5 py-1.5 hover:bg-muted rounded-md transition flex items-center justify-between group",
                  currentConversationId === conv.conversation_id && "bg-muted",
                  !isEditing && "cursor-pointer"
                )}
              >
                <div className="flex-1 min-w-0 mr-2">
                  {isEditing ? (
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) =>
                        onNameChange(conv.conversation_id, e.target.value)
                      }
                      onBlur={onCancelEdit}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") onCancelEdit();
                        else if (e.key === "Escape") {
                          onReloadConversations();
                          onCancelEdit();
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                      className="w-full text-xs font-medium bg-background border border-primary/50 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary/30"
                    />
                  ) : (
                    <div
                      className="text-xs font-medium truncate cursor-text"
                      onClick={(e) =>
                        onStartEditName(
                          conv.conversation_id,
                          conv.conversation_name || conv.conversation_id,
                          e
                        )}
                      title="Click to edit"
                    >
                      {conv.conversation_name || conv.conversation_id}
                    </div>
                  )}
                  <div className="text-[10px] text-muted-foreground">
                    {formatDateToIST(conv.updated_at)}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {!isEditing && (
                    <button
                      onClick={(e) =>
                        onStartEditName(
                          conv.conversation_id,
                          conv.conversation_name || conv.conversation_id,
                          e
                        )}
                      className="p-1 opacity-0 group-hover:opacity-100 hover:bg-primary/10 rounded transition"
                      title="Edit name"
                    >
                      <Pencil className="h-3 w-3 text-primary" />
                    </button>
                  )}
                  {!isEditing && (
                    <button
                      onClick={(e) => onDelete(conv.conversation_id, e)}
                      className="p-1 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 rounded transition"
                      title="Delete chat"
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {deletingConversationId && (
        <div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded-md">
          <p className="text-xs text-destructive mb-2">Delete this chat?</p>
          <div className="flex gap-2">
            <button
              onClick={onConfirmDelete}
              className="flex-1 px-2 py-1 text-xs bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 transition"
            >
              Delete
            </button>
            <button
              onClick={onCancelDelete}
              className="flex-1 px-2 py-1 text-xs bg-muted rounded hover:bg-muted/80 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
