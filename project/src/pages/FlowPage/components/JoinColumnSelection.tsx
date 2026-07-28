/**
 * JoinColumnSelection - Component for selecting join column pairs in chat dialog
 * Allows multiple source-target key pair selections similar to Create Connections UI
 */

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, X, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface JoinColumnSelectionProps {
  sourceColumns: string[];
  targetColumns: string[];
  sourceTableName: string;
  targetTableName: string;
  onSubmit: (pairs: Array<{ source: string; target: string }>) => void;
  isLoading?: boolean;
  isHistoryItem?: boolean;
  preSelectedPairs?: Array<{ source: string; target: string }>;
}

const CONNECTION_COLORS = [
  { border: 'border-sky-500', bg: 'bg-sky-500' },
  { border: 'border-emerald-500', bg: 'bg-emerald-500' },
  { border: 'border-amber-500', bg: 'bg-amber-500' },
  { border: 'border-rose-500', bg: 'bg-rose-500' },
  { border: 'border-indigo-500', bg: 'bg-indigo-500' },
  { border: 'border-lime-500', bg: 'bg-lime-500' },
  { border: 'border-fuchsia-500', bg: 'bg-fuchsia-500' },
  { border: 'border-cyan-500', bg: 'bg-cyan-500' },
];

export const JoinColumnSelection: React.FC<JoinColumnSelectionProps> = ({
  sourceColumns,
  targetColumns,
  sourceTableName,
  targetTableName,
  onSubmit,
  isLoading = false,
  isHistoryItem = false,
  preSelectedPairs = []
}) => {
  const [keyPairs, setKeyPairs] = useState<Array<{ source: string; target: string }>>(preSelectedPairs);
  const [selectedSourceColumn, setSelectedSourceColumn] = useState<string | null>(null);
  const [sourceSearchTerm, setSourceSearchTerm] = useState('');
  const [targetSearchTerm, setTargetSearchTerm] = useState('');

  const filteredSourceColumns = useMemo(() => {
    return sourceColumns.filter(col => col.toLowerCase().includes(sourceSearchTerm.toLowerCase()));
  }, [sourceColumns, sourceSearchTerm]);

  const filteredTargetColumns = useMemo(() => {
    return targetColumns.filter(col => col.toLowerCase().includes(targetSearchTerm.toLowerCase()));
  }, [targetColumns, targetSearchTerm]);

  const columnToColorMap = useMemo(() => {
    const map = new Map<string, string>();
    keyPairs.forEach((pair, index) => {
      const color = CONNECTION_COLORS[index % CONNECTION_COLORS.length].border;
      if (pair.source) map.set(pair.source, color);
      if (pair.target) map.set(pair.target, color);
    });
    return map;
  }, [keyPairs]);

  const handleSourceColumnClick = (columnName: string) => {
    if (isHistoryItem) return;
    if (keyPairs.some(p => p.source === columnName)) return;
    setSelectedSourceColumn(columnName);
  };

  const handleTargetColumnClick = (columnName: string) => {
    if (isHistoryItem) return;
    if (!selectedSourceColumn || keyPairs.some(p => p.target === columnName)) return;
    setKeyPairs(prev => [...prev, { source: selectedSourceColumn, target: columnName }]);
    setSelectedSourceColumn(null);
  };

  const removeKeyPair = (index: number) => {
    if (isHistoryItem) return;
    setKeyPairs(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (keyPairs.length > 0) {
      onSubmit(keyPairs);
    }
  };

  return (
    <div className="space-y-2 mt-2">
      {/* Column Selection Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Source Columns */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-semibold text-xs text-sky-600">
              Source
            </h4>

          </div>
          <div className="flex flex-col gap-1 max-h-[120px] overflow-y-auto p-1 rounded-lg border border-slate-200 bg-slate-50">
            {filteredSourceColumns.length > 0 ? (
              filteredSourceColumns.map(col => (
                <button
                  key={col}
                  onClick={() => handleSourceColumnClick(col)}
                  disabled={isHistoryItem || !!columnToColorMap.get(col)}
                  className={cn(
                    "flex items-center gap-2 w-full px-2 py-1 text-xs text-left rounded-md border transition-all",
                    "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500",
                    selectedSourceColumn === col && "ring-2 ring-blue-500 border-blue-500 bg-blue-50",
                    columnToColorMap.get(col) ? `border-l-4 ${columnToColorMap.get(col)} bg-white` : 'border-l-4 border-gray-200 bg-white hover:bg-slate-50',
                    (isHistoryItem || columnToColorMap.get(col)) && "opacity-70 cursor-not-allowed"
                  )}
                >
                  <span className="flex-1 truncate">{col}</span>
                </button>
              ))
            ) : (
              <p className="text-xs text-center text-slate-500 p-2">No matching columns</p>
            )}
          </div>
        </div>

        {/* Target Columns */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-semibold text-xs text-yellow-600">
              Lookup 
            </h4>

          </div>
          <div className="flex flex-col gap-1 max-h-[120px] overflow-y-auto p-1 rounded-lg border border-slate-200 bg-slate-50">
            {filteredTargetColumns.length > 0 ? (
              filteredTargetColumns.map(col => (
                <button
                  key={col}
                  onClick={() => handleTargetColumnClick(col)}
                  disabled={isHistoryItem || !selectedSourceColumn || !!columnToColorMap.get(col)}
                  className={cn(
                    "flex items-center gap-2 w-full px-2 py-1 text-xs text-left rounded-md border transition-all",
                    "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500",
                    columnToColorMap.get(col) ? `border-l-4 ${columnToColorMap.get(col)} bg-white` : 'border-l-4 border-gray-200 bg-white hover:bg-slate-50',
                    (isHistoryItem || !selectedSourceColumn || columnToColorMap.get(col)) && "opacity-70 cursor-not-allowed"
                  )}
                >
                  <span className="flex-1 truncate">{col}</span>
                </button>
              ))
            ) : (
              <p className="text-xs text-center text-slate-500 p-2">No matching columns</p>
            )}
          </div>
        </div>
      </div>

      {/* Review Connections */}
      {keyPairs.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-slate-700">Selected Connections:</h4>
          <div className="space-y-1 max-h-[80px] overflow-y-auto p-2 bg-slate-50 rounded-lg border border-slate-200">
            {keyPairs.map((pair, index) => (
              <div
                key={index}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 text-xs rounded-md border-2",
                  CONNECTION_COLORS[index % CONNECTION_COLORS.length].border.replace('border-', 'border-2 border-')
                )}
              >
                <span className={cn("w-1.5 h-1.5 rounded-full", CONNECTION_COLORS[index % CONNECTION_COLORS.length].bg)}></span>
                <span className="font-medium text-slate-700 flex-1 truncate" title={pair.source}>{pair.source}</span>
                <ArrowRight size={12} className="text-slate-900 shrink-0" />
                <span className="font-medium text-slate-700 flex-1 truncate" title={pair.target}>{pair.target}</span>
                {!isHistoryItem && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 shrink-0 hover:bg-black/10 rounded-full p-0"
                    onClick={() => removeKeyPair(index)}
                  >
                    <X size={10} />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Submit Button */}
      {!isHistoryItem && (
        <div className="flex justify-end pt-2">
          <Button
            onClick={handleSubmit}
            disabled={keyPairs.length === 0 || isLoading}
            size="sm"
            className="h-7 text-xs"
          >
            {isLoading ? 'Submitting...' : 'Submit'}
          </Button>
        </div>
      )}
    </div>
  );
};
