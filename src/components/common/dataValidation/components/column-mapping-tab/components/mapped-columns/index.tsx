import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Plus, ArrowRight, Edit } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ColumnMapping } from '@/types/dataValidation';
import { MAPPING_COLORS, HOVER_BG_COLORS } from '@/constants/constants';

interface MappedColumnsProps {
  mappings: ColumnMapping[];
  onRemoveMapping: (mappingId: string) => void;
  onEdit: () => void;
  isEditing: boolean;
  mappingMode: 'single' | 'multi';
}

const MappedColumnItem: React.FC<{
  mapping: ColumnMapping;
  onRemove: () => void;
}> = ({ mapping, onRemove }) => {
  const colorClass = MAPPING_COLORS[mapping.colorIndex % MAPPING_COLORS.length];
  const hoverBgClass = HOVER_BG_COLORS[mapping.colorIndex % HOVER_BG_COLORS.length];

  return (
    <div className={cn('flex items-center gap-2 p-2 bg-card border border-l-4 rounded-md group transition-all duration-200 text-sm', colorClass, `hover:${hoverBgClass}`)}>
      <div className="flex-1 flex items-center gap-2 truncate">
        <span className="font-medium truncate" title={mapping.sourceColumn.name}>{mapping.sourceColumn.name}</span>
        {mapping.sourceColumn.type && <Badge variant="secondary" className="text-[10px] py-0 px-1 h-4">{mapping.sourceColumn.type}</Badge>}
      </div>

      <ArrowRight className="h-4 w-4 text-muted-foreground" />

      <div className="flex-1 flex items-center gap-2 truncate">
        <span className="font-medium truncate" title={mapping.targetColumn.name}>{mapping.targetColumn.name}</span>
        {mapping.targetColumn.type && <Badge variant="secondary" className="text-[10px] py-0 px-1 h-4">{mapping.targetColumn.type}</Badge>}
      </div>

      <Button variant="ghost" size="sm" onClick={onRemove} className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 h-6 w-6 p-0">
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
};

const MappedColumns: React.FC<MappedColumnsProps> = ({ mappings, onRemoveMapping, onEdit, isEditing, mappingMode }) => {
  if (mappings.length === 0 && !isEditing) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="text-center py-6 text-gray-500 dark:text-gray-400">
            <Plus className="h-8 w-8 mx-auto opacity-30 mb-2" />
            <p className="text-sm font-medium">No Mappings Yet</p>
            <p className="text-xs">Select columns above to create mappings.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isEditing && mappingMode === 'multi') {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center gap-2 relative">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          Final Mapped Columns ({mappings.length})
        </h2>
        {mappingMode === 'multi' && mappings.length > 0 && (
          <Button onClick={onEdit} variant="outline" size="sm" className="absolute right-0 top-1/2 -translate-y-1/2">
            <Edit className="h-3 w-3 mr-1.5" /> Edit
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-3">
          <div className="space-y-1.5">
            {mappings.map((m) => (
              <MappedColumnItem key={m.id} mapping={m}
                onRemove={() => onRemoveMapping(m.id)} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MappedColumns;
