import { memo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Database } from 'lucide-react';

interface SourceTitleNodeProps {
  data: {
    name: string;
    tag: string;
  };
}

export const SourceTitleNode = memo(({ data }: SourceTitleNodeProps) => {
  return (
    <div className="flex items-center gap-2 w-48 justify-center p-1 rounded-md bg-muted/50">
      <Database className="h-3 w-3 text-muted-foreground" />
      <span className="text-xs font-semibold">{data.name}</span>
      <Badge variant="outline" className="text-xs px-1 py-0 ml-auto">
        {data.tag}
      </Badge>
    </div>
  );
});

SourceTitleNode.displayName = 'SourceTitleNode';
