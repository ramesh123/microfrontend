import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Database, GripVertical, Loader2 } from 'lucide-react';
import { Source } from '@/types';
import { useState } from 'react';

interface SourceSelectionProps {
  sources: Source[];
  onToggleSource: (sourceId: string) => void;
  onReorderSources: (newOrder: string[]) => void;
  onSave?: () => void;
  onCancel?: () => void;
  isLoading?: boolean;
}

export const SourceSelection = ({ sources, onToggleSource, onReorderSources, onSave, onCancel, isLoading }: SourceSelectionProps) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newOrder = [...sources];
    const draggedSource = newOrder[draggedIndex];
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(dropIndex, 0, draggedSource);

    const newSourceIds = newOrder.map(source => source.id);
    onReorderSources(newSourceIds);

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="space-y-1.5 p-1 flex-shrink-0 text-left">
      <h3 className="text-sm font-medium">Select Sources</h3>
      
      <div className="flex flex-wrap gap-1.5 items-center">
        {sources.map((source, index) => (
          <Card 
            key={source.id} 
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            className={`p-1 cursor-pointer transition-all hover:shadow-md w-full sm:w-auto sm:flex-1 max-w-[200px] ${
              source.selected ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted/50'
            } ${
              draggedIndex === index ? 'opacity-50 bg-blue-50' : ''
            } ${
              dragOverIndex === index && draggedIndex !== index ? 'bg-green-50 border-t-2 border-green-500' : ''
            }`}
            onClick={() => onToggleSource(source.id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <GripVertical className="h-3.5 w-3.5 text-gray-400 cursor-grab" />
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
        
        {onSave && onCancel && (
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={onCancel} disabled={isLoading} size="sm">
              Cancel
            </Button>
            <Button onClick={onSave} disabled={isLoading} size="sm">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
