import * as React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

type PreserveScrollAreaProps = React.ComponentProps<typeof ScrollArea>;

/**
 * ScrollArea that keeps viewport scrollTop across child re-renders
 * (e.g. customize panel dropdowns updating parent state).
 */
export function PreserveScrollArea({ className, children, ...props }: PreserveScrollAreaProps) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const scrollTopRef = React.useRef(0);

  React.useEffect(() => {
    const viewport = rootRef.current?.querySelector('[data-slot="scroll-area-viewport"]');
    if (!(viewport instanceof HTMLElement)) return;

    const onScroll = () => {
      scrollTopRef.current = viewport.scrollTop;
    };

    viewport.addEventListener('scroll', onScroll, { passive: true });
    return () => viewport.removeEventListener('scroll', onScroll);
  }, []);

  React.useLayoutEffect(() => {
    const viewport = rootRef.current?.querySelector('[data-slot="scroll-area-viewport"]');
    if (viewport instanceof HTMLElement) {
      viewport.scrollTop = scrollTopRef.current;
    }
  });

  return (
    <div ref={rootRef} className={cn('h-full min-h-0', className)}>
      <ScrollArea className="h-full" {...props}>
        {children}
      </ScrollArea>
    </div>
  );
}
