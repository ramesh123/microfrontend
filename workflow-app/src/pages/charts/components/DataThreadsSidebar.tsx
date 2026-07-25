import {
    Anchor,
    ChevronRight,
    ChevronLeft,
    Trash2,
    BarChart,
    GitFork,
  } from 'lucide-react';
  import { Button } from '@/components/ui/button';
  import { Card, CardHeader } from '@/components/ui/card';
  import { ScrollArea } from '@/components/ui/scroll-area';
  import { Separator } from '@/components/ui/separator';
  import { Badge } from '@/components/ui/badge';
  import { cn } from '@/lib/utils';
  
  interface DataThreadsSidebarProps {
    isCollapsed: boolean;
    onToggle: () => void;
    threads: { id: string; name: string }[];
    activeThreadId: string | null;
    onSelectThread: (id: string) => void;
    onDeleteThread: (id: string) => void;
  }
  
  export function DataThreadsSidebar({
    isCollapsed,
    onToggle,
    threads,
    activeThreadId,
    onSelectThread,
    onDeleteThread,
  }: DataThreadsSidebarProps) {
    if (isCollapsed) {
      return (
        <div className="flex h-full flex-col items-center p-2">
          <div className="flex w-full items-center justify-center">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onToggle}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Separator className="my-2" />
          <ScrollArea className="flex-1">
            <div className="flex flex-col items-center justify-start gap-2 py-2">
              {threads.map((thread) => (
                <Button
                  key={thread.id}
                  variant={thread.id === activeThreadId ? 'outline' : 'ghost'}
                  size="icon"
                  className={cn(
                    'h-8 w-8',
                    thread.id === activeThreadId && 'border-primary border-2'
                  )}
                  onClick={() => onSelectThread(thread.id)}
                >
                  <Anchor className="h-4 w-4" />
                </Button>
              ))}
              <Button
                variant="outline"
                size="icon"
                className="mt-2 h-8 w-8"
              >
                <BarChart className="h-4 w-4" />
              </Button>
            </div>
          </ScrollArea>
        </div>
      );
    }
  
    return (
      <div className="flex h-full flex-col p-2">
        <div className="flex items-center justify-between p-2">
          <h2 className="text-lg font-semibold">Data Threads</h2>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{threads.length}</Badge>
            <Button
              variant="ghost"
              size="icon" 
              className="h-6 w-6"
              onClick={onToggle}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <Separator />
        <ScrollArea className="flex-1 p-2">
          <div className="space-y-4">
            {threads.map((thread, index) => (
              <div key={thread.id}>
                <p className="mb-1 text-xs text-muted-foreground">
                  thread - {index + 1}
                </p>
                <Card
                  onClick={() => onSelectThread(thread.id)}
                  className={cn(
                    'cursor-pointer',
                    thread.id === activeThreadId
                      ? 'border-primary border-2'
                      : 'bg-secondary'
                  )}
                >
                  <CardHeader className="flex flex-row items-center justify-between p-2">
                    <div className="flex items-center gap-2 font-medium">
                      <Anchor className="h-4 w-4" />
                      <span className="truncate">{thread.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-6 w-6 border-destructive/50 text-destructive/90 hover:border-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteThread(thread.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-6 w-6 border-primary/50 text-primary hover:border-primary hover:bg-primary/10 hover:text-primary"
                      >
                        <GitFork className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                </Card>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    );
  }
  