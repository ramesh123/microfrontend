import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Filter, Database, Zap, Trash2, Edit, Pencil } from 'lucide-react';

export interface FilterOption {
  id: string;
  name: string;
  type: string;
  condition?: string;
  value?: string;
}

interface FilterListProps {
  filters: FilterOption[];
  onRemoveFilter: (id: string) => void;
  onEditFilter: (filter: FilterOption) => void;
}

const FilterList: React.FC<FilterListProps> = ({ filters, onRemoveFilter, onEditFilter }) => {
  const getFilterIcon = (type: string) => {
    switch (type) {
      case 'new-column':
        return <Database className="h-3 w-3 text-blue-600" />;
      case 'conditional-column':
        return <Zap className="h-3 w-3 text-amber-600" />;
      case 'conditional-filters':
        return <Filter className="h-3 w-3 text-green-600" />;
      default:
        return <Filter className="h-3 w-3" />;
    }
  };

  const getFilterTypeBadge = (type: string) => {
    switch (type) {
      case 'new-column':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200 text-xs px-1 py-0">New Column</Badge>;
      case 'conditional-column':
        return <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200 text-xs px-1 py-0">Conditional Column</Badge>;
      case 'conditional-filters':
        return <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200 text-xs px-1 py-0">Conditional Filter</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs px-1 py-0">{type}</Badge>;
    }
  };

  return (
    <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-900 backdrop-blur-sm h-fit">
      <CardHeader className="pb-2 px-4 pt-4">
        <CardTitle className="text-lg flex items-center justify-between">
          Active Filters
          <Badge variant="secondary" className="ml-2 text-xs px-2 py-0">
            {filters.length}
          </Badge>
        </CardTitle>
        <CardDescription className="text-sm">
          Currently applied filters and columns
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 px-4 pb-4">
        {filters.length === 0 ? (
          <div className="text-center py-6 text-slate-500">
            <Filter className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs">No filters created yet</p>
            <p className="text-xs text-slate-400 mt-1">Start by creating your first filter above</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filters.map((filter) => (
              <div
                key={filter.id}
                className="group p-3 bg-white rounded-lg border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all duration-200"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2 flex-1">
                    <div className="mt-1">
                      {getFilterIcon(filter.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-xs text-slate-900 truncate">{filter.name}</p>
                        {getFilterTypeBadge(filter.type)}
                      </div>
                      <div className="space-y-1">
                        {filter.condition && (
                          <p className="text-xs text-slate-500">
                            <span className="font-medium">Condition:</span> {filter.condition}
                          </p>
                        )}
                        {filter.value && (
                          <p className="text-xs text-slate-500">
                            <span className="font-medium">Value:</span> {filter.value}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                    <Button
                      variant="ghost"
                      size="iconSm"
                      onClick={() => onEditFilter(filter)}
                      className="h-6 w-6 p-0 !text-blue-600 hover:bg-blue-50 hover:text-blue-600"
                      title="Edit Filter"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="iconSm"
                      onClick={() => onRemoveFilter(filter.id)}
                      className="h-6 w-6 p-0 !text-red-600 hover:bg-red-50 hover:text-red-600"
                      title="Delete Filter"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FilterList;
