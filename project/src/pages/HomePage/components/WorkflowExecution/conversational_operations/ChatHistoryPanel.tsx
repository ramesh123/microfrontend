import { useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  History,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export type ConversationItem = {
  conversation_id: string;
  conversation_name?: string;
  updated_at?: string;
  created_at?: string;
};

type ChatHistoryPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversations: ConversationItem[];
  loading: boolean;
  activeConversationId: string;
  editingConversationId: string | null;
  editingName: string;
  deletingConversationId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onStartEdit: (id: string, name: string, e: React.MouseEvent) => void;
  onEditingNameChange: (name: string) => void;
  onSaveRename: (id: string) => void;
  onCancelEdit: () => void;
  onDeleteClick: (id: string, e: React.MouseEvent) => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
};

function formatRelativeTime(dateStr?: string): string | null {
  if (!dateStr) return null;

  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return null;

  // Add 5 hours 30 minutes (IST)
  const istDate = new Date(date.getTime() + (5.5 * 60 * 60 * 1000));

  const diffMs = Date.now() - istDate.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return istDate.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });
}

function getConversationLabel(conv: ConversationItem): string {
  return conv.conversation_name?.trim() || `Chat ${conv.conversation_id.slice(0, 8)}`;
}

export function ChatHistoryPanel({
  open,
  onOpenChange,
  conversations,
  loading,
  activeConversationId,
  editingConversationId,
  editingName,
  deletingConversationId,
  onSelect,
  onNewChat,
  onStartEdit,
  onEditingNameChange,
  onSaveRename,
  onCancelEdit,
  onDeleteClick,
  onConfirmDelete,
  onCancelDelete,
}: ChatHistoryPanelProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => getConversationLabel(c).toLowerCase().includes(q));
  }, [conversations, search]);

  return (
    <Card
      className={cn(
        'relative flex flex-col min-h-0 h-full overflow-hidden !py-0 transition-all duration-300 ease-in-out',
        open ? 'border shadow-sm' : 'border-0 shadow-none bg-transparent',
      )}
    >
      {!open ? (
        <div
          className="hidden xl:flex absolute inset-0 flex-col items-center justify-start pt-3 transition-opacity duration-300 pointer-events-auto opacity-100 select-none cursor-pointer space-y-5"
          onClick={() => onOpenChange(true)}
          title="Expand Chat History"
        >
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full hover:bg-muted"
            onClick={(e) => {
              e.stopPropagation();
              onOpenChange(true);
            }}
          >
            <ChevronLeft className="h-5 w-5 text-muted-foreground hover:text-foreground" />
          </Button>
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/75 [writing-mode:vertical-lr] rotate-180 flex items-center gap-1.5">
            <History className="size-3" /> History
          </span>
          {conversations.length > 0 ? (
            <Badge variant="secondary" className="text-[9px] h-4 px-1.5 tabular-nums">
              {conversations.length}
            </Badge>
          ) : null}
        </div>
      ) : null}

      <div className={cn('flex flex-col h-full min-h-0', !open && 'xl:hidden')}>
        <CardHeader className="py-3 px-3 border-b shrink-0 space-y-2.5 bg-muted/20">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 min-w-0">
              <div className="size-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <History className="size-3.5 text-primary" />
              </div>
              <span className="truncate">Chat History</span>
              {!loading && conversations.length > 0 ? (
                <Badge variant="secondary" className="text-[10px] h-5 shrink-0 tabular-nums">
                  {conversations.length}
                </Badge>
              ) : null}
            </CardTitle>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={onNewChat}
                title="New chat"
              >
                <Plus className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full hover:bg-muted"
                onClick={() => onOpenChange(false)}
                title="Collapse"
              >
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations…"
              className="h-8 pl-8 text-xs bg-background"
            />
          </div>
        </CardHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <CardContent className="p-2 space-y-1.5">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground">Loading history…</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center gap-3">
                <div className="size-11 rounded-full bg-muted flex items-center justify-center">
                  <MessageSquare className="size-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {search ? 'No matches found' : 'No conversations yet'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {search
                      ? 'Try a different search term'
                      : 'Start a new chat to build your history'}
                  </p>
                </div>
                {!search ? (
                  <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={onNewChat}>
                    <Plus className="size-3.5" />
                    New chat
                  </Button>
                ) : null}
              </div>
            ) : (
              filtered.map((conv) => {
                const isSelected = activeConversationId === conv.conversation_id;
                const isEditing = editingConversationId === conv.conversation_id;
                const label = getConversationLabel(conv);
                const relativeTime = formatRelativeTime(conv.updated_at ?? conv.created_at);

                return (
                  <div
                    key={conv.conversation_id}
                    onClick={() => !isEditing && onSelect(conv.conversation_id)}
                    className={cn(
                      'group relative rounded-xl border transition-all duration-200 cursor-pointer overflow-hidden',
                      isSelected
                        ? 'border-primary/50 bg-primary/5 shadow-sm ring-1 ring-primary/20'
                        : 'border-border/50 bg-card hover:border-border hover:bg-muted/40 hover:shadow-sm',
                    )}
                  >
                    {isSelected ? (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-xl" />
                    ) : null}

                    <div className="flex items-start gap-2.5 p-2.5 pl-3">
                      <div
                        className={cn(
                          'size-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
                          isSelected ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
                        )}
                      >
                        <MessageSquare className="size-3.5" />
                      </div>

                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => onEditingNameChange(e.target.value)}
                            onBlur={() => onSaveRename(conv.conversation_id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') onSaveRename(conv.conversation_id);
                              if (e.key === 'Escape') onCancelEdit();
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full bg-background border border-primary/40 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                            autoFocus
                          />
                        ) : (
                          <>
                            <p
                              className={cn(
                                'text-xs font-semibold truncate leading-snug',
                                isSelected ? 'text-foreground' : 'text-foreground/90',
                              )}
                              title={label}
                            >
                              {label}
                            </p>
                            {relativeTime ? (
                              <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                <Clock className="size-2.5 shrink-0" />
                                {relativeTime}
                              </p>
                            ) : (
                              <p className="text-[10px] text-muted-foreground font-mono truncate mt-0.5">
                                {conv.conversation_id.slice(0, 12)}…
                              </p>
                            )}
                          </>
                        )}
                      </div>

                      {!isEditing ? (
                        <div className="flex opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity gap-0.5 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 hover:bg-primary/10"
                            onClick={(e) => onStartEdit(conv.conversation_id, label, e)}
                            title="Rename"
                          >
                            <Pencil className="h-3 w-3 text-primary" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 hover:bg-destructive/10"
                            onClick={(e) => onDeleteClick(conv.conversation_id, e)}
                            title="Delete"
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </div>

        {deletingConversationId ? (
          <div className="p-3 border-t bg-destructive/5 border-destructive/20 text-xs shrink-0">
            <p className="text-destructive font-medium mb-2">Delete this conversation permanently?</p>
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" className="flex-1 h-7 text-[11px]" onClick={onConfirmDelete}>
                Delete
              </Button>
              <Button size="sm" variant="outline" className="flex-1 h-7 text-[11px]" onClick={onCancelDelete}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
