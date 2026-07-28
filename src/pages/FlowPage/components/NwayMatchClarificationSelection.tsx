/**
 * NwayMatchClarificationSelection - Component for selecting column matches in N-way matching clarifications
 * Handles the needs_clarification response from the N-way matching API
 * Allows users to add MULTIPLE column pair matches (match-1, match-2, etc.) per rule
 */

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowRight, X, Search, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NwayMatchClarificationSelectionProps {
  // Structure from the API response - provides available columns for matching
  options: {
    [ruleId: string]: {
      [matchId: string]: {
        left_column: string[];
        right_column: string[];
      };
    };
  };
  missingFields: Array<{
    rule_id: string;
    match_id: string;
    field: string;
  }>;
  onSubmit: (answers: {
    [ruleId: string]: {
      [matchId: string]: {
        left_column: string;
        right_column: string;
      };
    };
  }) => void;
  isLoading?: boolean;
  isHistoryItem?: boolean;
  preSelectedAnswers?: {
    [ruleId: string]: {
      [matchId: string]: {
        left_column?: string;
        right_column?: string;
      };
    };
  };
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

export const NwayMatchClarificationSelection: React.FC<NwayMatchClarificationSelectionProps> = ({
  options,
  missingFields,
  onSubmit,
  isLoading = false,
  isHistoryItem = false,
  preSelectedAnswers = {}
}) => {
  console.log('[NWAY CLARIFICATION] Component rendered');
  console.log('[NWAY CLARIFICATION] options:', options);
  console.log('[NWAY CLARIFICATION] missingFields:', missingFields);

  // State to track all matches for each rule
  // Structure: { [ruleId]: { "match-1": { left_column, right_column }, "match-2": {...}, ... } }
  const [matches, setMatches] = useState<{
    [ruleId: string]: {
      [matchId: string]: {
        left_column: string;
        right_column: string;
      };
    };
  }>(preSelectedAnswers as any || {});

  // Track which left column is currently selected for pairing
  const [selectedLeftColumn, setSelectedLeftColumn] = useState<{
    ruleId: string;
    column: string;
  } | null>(null);

  // Track search terms for each rule
  const [searchTerms, setSearchTerms] = useState<{
    [ruleId: string]: {
      left: string;
      right: string;
    };
  }>({});

  // Get all rules with their available columns
  const rules = useMemo(() => {
    console.log('[NWAY CLARIFICATION] Computing rules from options:', options);
    const ruleList: Array<{
      ruleId: string;
      leftColumns: string[];
      rightColumns: string[];
    }> = [];

    if (!options || typeof options !== 'object') {
      console.warn('[NWAY CLARIFICATION] options is invalid:', options);
      return ruleList;
    }

    Object.entries(options).forEach(([ruleId, matchOptions]) => {
      console.log('[NWAY CLARIFICATION] Processing ruleId:', ruleId, 'matchOptions:', matchOptions);
      if (matchOptions && typeof matchOptions === 'object') {
        // Get columns from the first match (they should all have the same columns available)
        const firstMatch = Object.values(matchOptions)[0];
        if (firstMatch) {
          ruleList.push({
            ruleId,
            leftColumns: firstMatch.left_column || [],
            rightColumns: firstMatch.right_column || []
          });
        }
      }
    });

    console.log('[NWAY CLARIFICATION] Final rules:', ruleList);
    return ruleList;
  }, [options]);

  // Helper to get search term for a specific rule
  const getSearchTerm = (ruleId: string, side: 'left' | 'right') => {
    return searchTerms[ruleId]?.[side] || '';
  };

  // Helper to update search term
  const updateSearchTerm = (ruleId: string, side: 'left' | 'right', value: string) => {
    setSearchTerms(prev => ({
      ...prev,
      [ruleId]: {
        ...(prev[ruleId] || { left: '', right: '' }),
        [side]: value
      }
    }));
  };

  // Helper to filter columns based on search
  const filterColumns = (columns: string[], searchTerm: string) => {
    if (!searchTerm.trim()) return columns;
    return columns.filter(col => col.toLowerCase().includes(searchTerm.toLowerCase()));
  };

  // Get the next match ID for a rule
  const getNextMatchId = (ruleId: string) => {
    const ruleMatches = matches[ruleId] || {};
    const existingIds = Object.keys(ruleMatches)
      .map(id => parseInt(id.replace('match-', ''), 10))
      .filter(n => !isNaN(n));
    const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
    return `match-${maxId + 1}`;
  };

  // Find which match a column belongs to
  const findMatchForColumn = (ruleId: string, column: string, side: 'left' | 'right') => {
    const ruleMatches = matches[ruleId] || {};
    for (const [matchId, match] of Object.entries(ruleMatches)) {
      if (side === 'left' && match.left_column === column) {
        return matchId;
      }
      if (side === 'right' && match.right_column === column) {
        return matchId;
      }
    }
    return null;
  };

  const handleLeftColumnClick = (ruleId: string, column: string) => {
    if (isHistoryItem) return;

    // Check if this column is already part of a match - if so, remove that match
    const existingMatchId = findMatchForColumn(ruleId, column, 'left');
    if (existingMatchId) {
      removeMatch(ruleId, existingMatchId);
      return;
    }

    // Toggle selection
    if (selectedLeftColumn?.ruleId === ruleId && selectedLeftColumn?.column === column) {
      setSelectedLeftColumn(null);
    } else {
      setSelectedLeftColumn({ ruleId, column });
    }
  };

  const handleRightColumnClick = (ruleId: string, column: string) => {
    if (isHistoryItem) return;

    // Check if this column is already part of a match - if so, remove that match
    const existingMatchId = findMatchForColumn(ruleId, column, 'right');
    if (existingMatchId) {
      removeMatch(ruleId, existingMatchId);
      setSelectedLeftColumn(null); // Clear selection after removing
      return;
    }

    // Check if a left column is selected for this rule
    if (!selectedLeftColumn || selectedLeftColumn.ruleId !== ruleId) {
      return;
    }

    // Create a new match
    const matchId = getNextMatchId(ruleId);
    setMatches(prev => ({
      ...prev,
      [ruleId]: {
        ...(prev[ruleId] || {}),
        [matchId]: {
          left_column: selectedLeftColumn.column,
          right_column: column
        }
      }
    }));

    setSelectedLeftColumn(null);
  };

  const removeMatch = (ruleId: string, matchId: string) => {
    if (isHistoryItem) return;

    setMatches(prev => {
      const newMatches = { ...prev };
      if (newMatches[ruleId]) {
        delete newMatches[ruleId][matchId];
        if (Object.keys(newMatches[ruleId]).length === 0) {
          delete newMatches[ruleId];
        }
      }
      return newMatches;
    });
  };

  const handleSubmit = () => {
    // Check if at least one match exists for each rule
    const hasMatchesForAllRules = rules.every(rule => {
      const ruleMatches = matches[rule.ruleId];
      return ruleMatches && Object.keys(ruleMatches).length > 0;
    });

    if (hasMatchesForAllRules) {
      onSubmit(matches);
    }
  };

  // Get match numbers for a column (which matches use this column)
  const getColumnMatchNumbers = (ruleId: string, column: string, side: 'left' | 'right') => {
    const ruleMatches = matches[ruleId] || {};
    const matchNumbers: { number: number; color: typeof CONNECTION_COLORS[0] }[] = [];

    Object.entries(ruleMatches).forEach(([matchId, match], index) => {
      const isUsed = side === 'left' ? match.left_column === column : match.right_column === column;
      if (isUsed) {
        const matchNum = parseInt(matchId.replace('match-', ''), 10);
        matchNumbers.push({
          number: matchNum,
          color: CONNECTION_COLORS[index % CONNECTION_COLORS.length]
        });
      }
    });

    return matchNumbers;
  };

  // Get color for a specific match
  const getMatchColor = (matchIndex: number) => {
    return CONNECTION_COLORS[matchIndex % CONNECTION_COLORS.length];
  };

  // Get all matches for a rule as an array with their match IDs
  const getMatchesArray = (ruleId: string) => {
    const ruleMatches = matches[ruleId] || {};
    return Object.entries(ruleMatches).map(([matchId, match]) => ({
      matchId,
      ...match
    }));
  };

  console.log('[NWAY CLARIFICATION] Rendering with rules:', rules);
  console.log('[NWAY CLARIFICATION] Current matches:', matches);

  if (rules.length === 0) {
    return (
      <div className="mt-2 p-3 border border-amber-200 rounded-lg bg-amber-50 text-amber-700 text-sm">
        No column pairs to configure. Please check the options data structure.
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-2">
      {rules.map((rule) => {
        const ruleMatches = getMatchesArray(rule.ruleId);
        const isCurrentlySelecting = selectedLeftColumn?.ruleId === rule.ruleId;

        return (
          <div key={rule.ruleId} className="space-y-2 p-3 border border-slate-200 rounded-lg bg-white">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-700">
                {rule.ruleId}
              </h4>
              <span className="text-xs text-slate-500">
                {ruleMatches.length} match{ruleMatches.length !== 1 ? 'es' : ''} added
              </span>
            </div>

            {/* Column Selection Grid */}
            <div className="grid grid-cols-2 gap-4">
              {/* Left Columns */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <h5 className="font-semibold text-xs text-sky-600">
                    Left Column (Source 1)
                  </h5>
                </div>
                {/* Search Input for Left Columns */}
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="Search columns..."
                    value={getSearchTerm(rule.ruleId, 'left')}
                    onChange={(e) => updateSearchTerm(rule.ruleId, 'left', e.target.value)}
                    disabled={isHistoryItem}
                    className="h-7 text-xs pl-7 pr-2"
                  />
                </div>
                <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto p-1 rounded-lg border border-slate-200 bg-slate-50">
                  {(() => {
                    const filteredCols = filterColumns(rule.leftColumns, getSearchTerm(rule.ruleId, 'left'));
                    return filteredCols.length > 0 ? (
                      filteredCols.map(col => {
                        const matchNumbers = getColumnMatchNumbers(rule.ruleId, col, 'left');
                        const isMatched = matchNumbers.length > 0;
                        const isSelected = selectedLeftColumn?.ruleId === rule.ruleId &&
                                          selectedLeftColumn?.column === col;

                        return (
                          <button
                            key={col}
                            onClick={() => handleLeftColumnClick(rule.ruleId, col)}
                            disabled={isHistoryItem}
                            title={isMatched ? `Click to unpair ${col}` : col}
                            className={cn(
                              "flex items-center gap-2 w-full px-2 py-1 text-xs text-left rounded-md border transition-all",
                              "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500",
                              isSelected && "ring-2 ring-blue-500 border-blue-500 bg-blue-50",
                              isMatched
                                ? "border-l-4 border-gray-300 bg-slate-100 hover:bg-red-50 hover:border-red-300"
                                : "border-l-4 border-gray-200 bg-white hover:bg-slate-50",
                              isHistoryItem && "opacity-70 cursor-not-allowed"
                            )}
                          >
                            <span className="flex-1 truncate">{col}</span>
                            {matchNumbers.length > 0 && (
                              <span className="flex gap-0.5">
                                {matchNumbers.map(m => (
                                  <span
                                    key={m.number}
                                    className={cn(
                                      "w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center text-white",
                                      m.color.bg
                                    )}
                                  >
                                    {m.number}
                                  </span>
                                ))}
                              </span>
                            )}
                          </button>
                        );
                      })
                    ) : (
                      <p className="text-xs text-center text-slate-500 p-2">
                        {getSearchTerm(rule.ruleId, 'left') ? 'No matching columns' : 'No columns available'}
                      </p>
                    );
                  })()}
                </div>
              </div>

              {/* Right Columns */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <h5 className="font-semibold text-xs text-amber-600">
                    Right Column (Source 2)
                  </h5>
                </div>
                {/* Search Input for Right Columns */}
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="Search columns..."
                    value={getSearchTerm(rule.ruleId, 'right')}
                    onChange={(e) => updateSearchTerm(rule.ruleId, 'right', e.target.value)}
                    disabled={isHistoryItem}
                    className="h-7 text-xs pl-7 pr-2"
                  />
                </div>
                <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto p-1 rounded-lg border border-slate-200 bg-slate-50">
                  {(() => {
                    const filteredCols = filterColumns(rule.rightColumns, getSearchTerm(rule.ruleId, 'right'));
                    return filteredCols.length > 0 ? (
                      filteredCols.map(col => {
                        const matchNumbers = getColumnMatchNumbers(rule.ruleId, col, 'right');
                        const isMatched = matchNumbers.length > 0;

                        return (
                          <button
                            key={col}
                            onClick={() => handleRightColumnClick(rule.ruleId, col)}
                            disabled={isHistoryItem || (!isCurrentlySelecting && !isMatched)}
                            title={isMatched ? `Click to unpair ${col}` : col}
                            className={cn(
                              "flex items-center gap-2 w-full px-2 py-1 text-xs text-left rounded-md border transition-all",
                              "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500",
                              isMatched
                                ? "border-l-4 border-gray-300 bg-slate-100 hover:bg-red-50 hover:border-red-300"
                                : "border-l-4 border-gray-200 bg-white hover:bg-slate-50",
                              (isHistoryItem || (!isCurrentlySelecting && !isMatched)) && "opacity-70 cursor-not-allowed"
                            )}
                          >
                            <span className="flex-1 truncate">{col}</span>
                            {matchNumbers.length > 0 && (
                              <span className="flex gap-0.5">
                                {matchNumbers.map(m => (
                                  <span
                                    key={m.number}
                                    className={cn(
                                      "w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center text-white",
                                      m.color.bg
                                    )}
                                  >
                                    {m.number}
                                  </span>
                                ))}
                              </span>
                            )}
                          </button>
                        );
                      })
                    ) : (
                      <p className="text-xs text-center text-slate-500 p-2">
                        {getSearchTerm(rule.ruleId, 'right') ? 'No matching columns' : 'No columns available'}
                      </p>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Instruction text */}
            {!isHistoryItem && (
              <p className="text-xs text-slate-500 italic">
                {isCurrentlySelecting
                  ? `Click a right column to pair with "${selectedLeftColumn?.column}"`
                  : null}
              </p>
            )}

            {/* Added Matches Display */}
            {ruleMatches.length > 0 && (
              <div className="mt-2 space-y-1">
                <h5 className="text-xs font-medium text-slate-600 flex items-center gap-1">
                  <Plus size={12} />
                  Added Matches:
                </h5>
                <div className="flex flex-wrap gap-2">
                  {ruleMatches.map((match, index) => {
                    const color = getMatchColor(index);
                    const matchNum = parseInt(match.matchId.replace('match-', ''), 10);
                    return (
                      <div
                        key={match.matchId}
                        className={cn(
                          "flex items-center gap-1.5 px-2 py-1 text-xs rounded-md border-2",
                          color.border
                        )}
                      >
                        <span className={cn("w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center text-white shrink-0", color.bg)}>
                          {matchNum}
                        </span>
                        <span className="font-medium text-slate-700 truncate max-w-[80px]" title={match.left_column}>
                          {match.left_column}
                        </span>
                        <ArrowRight size={12} className="text-slate-500 shrink-0" />
                        <span className="font-medium text-slate-700 truncate max-w-[80px]" title={match.right_column}>
                          {match.right_column}
                        </span>
                        {!isHistoryItem && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 shrink-0 hover:bg-black/10 rounded-full p-0 ml-1"
                            onClick={() => removeMatch(rule.ruleId, match.matchId)}
                          >
                            <X size={10} />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Submit Button */}
      {!isHistoryItem && (
        <div className="flex justify-end pt-2">
          <Button
            onClick={handleSubmit}
            disabled={
              isLoading ||
              !rules.every(rule => {
                const ruleMatches = matches[rule.ruleId];
                return ruleMatches && Object.keys(ruleMatches).length > 0;
              })
            }
            size="sm"
            className="h-7 text-xs"
          >
            {isLoading ? 'Submitting...' : 'Submit Matches'}
          </Button>
        </div>
      )}
    </div>
  );
};
