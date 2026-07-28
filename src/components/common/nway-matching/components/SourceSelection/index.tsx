import { Card } from '@/components/ui/card';
import { CheckCircle2, Database } from 'lucide-react';
import { Source } from '@/types';

interface SourceSelectionProps {
  sources: Source[];
  onToggleSource: (sourceId: string) => void;
}

export const SourceSelection = ({ sources, onToggleSource }: SourceSelectionProps) => {
  return (
    <div className="p-0 text-left">
      <div className={`flex gap-1.5 p-1 ${
        sources.length > 7 
          ? 'overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100' 
          : 'flex-wrap'
      }`}>
        {sources.map((source) => (
          <Card 
            key={source.id} 
            className={`p-1 cursor-pointer transition-all hover:shadow-md ${
              sources.length > 7 
                ? 'flex-shrink-0 w-[200px]' 
                : 'w-full sm:w-auto sm:flex-1 max-w-[200px]'
            } ${
              source.selected ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted/50'
            }`}
            onClick={() => onToggleSource(source.id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Database className="h-3.5 w-3.5 text-muted-foreground" />
                <div className="leading-tight">
                  <p className="text-sm font-medium">{source.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {source.selected && (
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
