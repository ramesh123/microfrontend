import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, ArrowRight, Trash2 } from 'lucide-react';

interface Connection {
  id: string;
  sourceColumn: {
    name: string;
    type: string;
    source: 'left' | 'right';
    table: string;
    application: string;
  };
  targetColumn: {
    name: string;
    type: string;
    source: 'left' | 'right';
    table: string;
    application: string;
  };
  connectionType: 'drag-drop' | 'manual' | 'single' | 'mapped' | 'mapping' | 'join';
  sourceColumnValue?: any;
  targetColumnValue?: any;
  hasSelectedData?: boolean;
}

interface ValidationOperationsPanelProps {
  selectedConnection: Connection | null;
  targetFields: { source: boolean; target: boolean };
  setTargetFields: (fields: { source: boolean; target: boolean }) => void;
  currentOperationState: {
    validationCategory: string;
    operationType: string;
    operationConfig: any;
  };
  setCurrentOperationState: (state: any) => void;
  getCurrentConnectionOperations: () => any;
  validationCategories: Array<{ value: string; label: string }>;
  getOperationTypes: (category: string) => Array<{ value: string; label: string }>;
  handleApplyOperation: () => void;
  getCurrentOperationResult: () => any;
  getCurrentValidationStatus: () => any;
  setCurrentConnectionOperations: (ops: any) => void;
  setCurrentValidationStatus: (status: any) => void;
}

export const ValidationOperationsPanel: React.FC<ValidationOperationsPanelProps> = ({
  selectedConnection,
  targetFields,
  setTargetFields,
  currentOperationState,
  setCurrentOperationState,
  getCurrentConnectionOperations,
  validationCategories,
  getOperationTypes,
  handleApplyOperation,
  getCurrentOperationResult,
  getCurrentValidationStatus,
  setCurrentConnectionOperations,
  setCurrentValidationStatus,
}) => {
  return (
    <>
      {/* Middle Panel - Operations */}
      <div className="bg-white border border-slate-200 rounded-lg flex flex-col">
        <div className="p-3 border-b border-slate-200">
          <h3 className="text-sm font-medium text-slate-800">Validation Operations</h3>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3">
          {selectedConnection ? (
            <div className="space-y-3">
              {/* Column Selection Layout */}
              <div className="space-y-2">
                <Label className="text-xs text-slate-600">Select Column for Operation</Label>
                
                <div className="p-2 rounded-md border flex items-center justify-between gap-2 bg-muted/50">
                  {/* Source Column */}
                  <div 
                    className={`flex-1 flex flex-col items-start gap-1 p-2 rounded-md transition-all cursor-pointer relative ${
                      targetFields.source ? 'bg-blue-100' : 'bg-background hover:bg-accent'
                    }`}
                    onClick={() => {
                      setTargetFields({ source: true, target: false });
                      const connectionOps = getCurrentConnectionOperations();
                      if (connectionOps?.sourceOperations?.validationCategory && connectionOps?.sourceOperations?.operationType) {
                        // Use saved operations if available
                        setCurrentOperationState({
                          validationCategory: connectionOps.sourceOperations.validationCategory || '',
                          operationType: connectionOps.sourceOperations.operationType || '',
                          operationConfig: connectionOps.sourceOperations.operationConfig || {}
                        });
                      } else {
                        // No saved operations - don't auto-select, let user choose
                        setCurrentOperationState({
                          validationCategory: '',
                          operationType: '',
                          operationConfig: {}
                        });
                      }
                    }}
                  >
                    {/* Remove button for source column operation */}
                    {(() => {
                      const connectionOps = getCurrentConnectionOperations();
                      const hasSourceOperation = connectionOps?.sourceOperations?.operationType && connectionOps?.sourceOperations?.validationCategory;
                      return hasSourceOperation ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const connectionOps = getCurrentConnectionOperations();
                            if (connectionOps) {
                              // Clear source operations
                              const updatedOps = {
                                ...connectionOps,
                                sourceOperations: {
                                  validationCategory: '',
                                  operationType: '',
                                  operationConfig: {},
                                  result: null
                                },
                                // Also update operationResult to remove source result
                                operationResult: connectionOps.operationResult ? {
                                  ...connectionOps.operationResult,
                                  results: {
                                    ...connectionOps.operationResult.results,
                                    source: undefined
                                  }
                                } : null
                              };
                              setCurrentConnectionOperations(updatedOps);
                              
                              // Reset current state if source is selected
                              if (targetFields.source) {
                                setCurrentOperationState({
                                  validationCategory: '',
                                  operationType: '',
                                  operationConfig: {}
                                });
                              }
                              console.log('🗑️  Removed source column operation');
                            }
                          }}
                          className="absolute top-1 right-1 p-1 hover:bg-red-50 rounded text-red-600 hover:text-red-700 transition-colors z-10"
                          title="Remove operation for source column"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      ) : null;
                    })()}
                    
                    <Badge variant="outline" className="font-mono bg-white truncate max-w-full text-xs">
                      {selectedConnection.sourceColumn.name.toUpperCase()}
                    </Badge>
                    <div className="text-xs text-muted-foreground pl-1 truncate max-w-full">
                      {selectedConnection.sourceColumnValue ? (
                        <span className="font-mono text-primary font-bold">
                          {String(selectedConnection.sourceColumnValue)}
                        </span>
                      ) : (
                        <span className="italic text-gray-400">- no data -</span>
                      )}
                    </div>
                    {/* Show operation applied indicator */}
                    {(() => {
                      const connectionOps = getCurrentConnectionOperations();
                      const hasSourceOperation = connectionOps?.sourceOperations?.operationType && connectionOps?.sourceOperations?.validationCategory;
                      return hasSourceOperation ? (
                        <div className="text-xs text-green-600 font-medium mt-1">
                          ✓ {connectionOps.sourceOperations.operationType}
                        </div>
                      ) : null;
                    })()}
                  </div>
                  
                  {/* Arrow */}
                  <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mx-2" />

                  {/* Target Column */}
                  <div 
                    className={`flex-1 flex flex-col items-start gap-1 p-2 rounded-md transition-all cursor-pointer relative ${
                      targetFields.target ? 'bg-blue-100' : 'bg-background hover:bg-accent'
                    }`}
                    onClick={() => {
                      setTargetFields({ source: false, target: true });
                      const connectionOps = getCurrentConnectionOperations();
                      if (connectionOps?.targetOperations?.validationCategory && connectionOps?.targetOperations?.operationType) {
                        // Use saved operations if available
                        setCurrentOperationState({
                          validationCategory: connectionOps.targetOperations.validationCategory || '',
                          operationType: connectionOps.targetOperations.operationType || '',
                          operationConfig: connectionOps.targetOperations.operationConfig || {}
                        });
                      } else {
                        // No saved operations - don't auto-select, let user choose
                        setCurrentOperationState({
                          validationCategory: '',
                          operationType: '',
                          operationConfig: {}
                        });
                      }
                    }}
                  >
                    {/* Remove button for target column operation */}
                    {(() => {
                      const connectionOps = getCurrentConnectionOperations();
                      const hasTargetOperation = connectionOps?.targetOperations?.operationType && connectionOps?.targetOperations?.validationCategory;
                      return hasTargetOperation ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const connectionOps = getCurrentConnectionOperations();
                            if (connectionOps) {
                              // Clear target operations
                              const updatedOps = {
                                ...connectionOps,
                                targetOperations: {
                                  validationCategory: '',
                                  operationType: '',
                                  operationConfig: {},
                                  result: null
                                },
                                // Also update operationResult to remove target result
                                operationResult: connectionOps.operationResult ? {
                                  ...connectionOps.operationResult,
                                  results: {
                                    ...connectionOps.operationResult.results,
                                    target: undefined
                                  }
                                } : null
                              };
                              setCurrentConnectionOperations(updatedOps);
                              
                              // Reset current state if target is selected
                              if (targetFields.target) {
                                setCurrentOperationState({
                                  validationCategory: '',
                                  operationType: '',
                                  operationConfig: {}
                                });
                              }
                              console.log('🗑️  Removed target column operation');
                            }
                          }}
                          className="absolute top-1 right-1 p-1 hover:bg-red-50 rounded text-red-600 hover:text-red-700 transition-colors z-10"
                          title="Remove operation for target column"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      ) : null;
                    })()}
                    
                    <Badge variant="outline" className="font-mono bg-white truncate max-w-full text-xs">
                      {selectedConnection.targetColumn.name.toUpperCase()}
                    </Badge>
                    <div className="text-xs text-muted-foreground pl-1 truncate max-w-full">
                      {selectedConnection.targetColumnValue ? (
                        <span className="font-mono text-primary font-bold">
                          {String(selectedConnection.targetColumnValue)}
                        </span>
                      ) : (
                        <span className="italic text-gray-400">- no data -</span>
                      )}
                    </div>
                    {/* Show operation applied indicator */}
                    {(() => {
                      const connectionOps = getCurrentConnectionOperations();
                      const hasTargetOperation = connectionOps?.targetOperations?.operationType && connectionOps?.targetOperations?.validationCategory;
                      return hasTargetOperation ? (
                        <div className="text-xs text-green-600 font-medium mt-1">
                          ✓ {connectionOps.targetOperations.operationType}
                        </div>
                      ) : null;
                    })()}
                  </div>
                </div>
              </div>
              
              {/* Validation Category */}
              <div>
                <Label className="text-xs text-slate-600">Validation Category</Label>
                <Select value={currentOperationState.validationCategory} onValueChange={(value) => {
                  // When category changes, auto-select first operation type
                  const operationTypes = getOperationTypes(value);
                  const firstOperationType = operationTypes[0]?.value || '';
                  setCurrentOperationState({
                    ...currentOperationState,
                    validationCategory: value,
                    operationType: firstOperationType,
                    operationConfig: {}
                  });
                }}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {validationCategories.map((category) => (
                      <SelectItem key={category.value} value={category.value} className="text-xs">
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Operation Type */}
              {currentOperationState.validationCategory && (
                <div>
                  <Label className="text-xs text-slate-600">Operation Type</Label>
                  <Select value={currentOperationState.operationType} onValueChange={(value) => {
                    setCurrentOperationState({
                      ...currentOperationState,
                      operationType: value,
                      operationConfig: {}
                    });
                  }}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select operation" />
                    </SelectTrigger>
                    <SelectContent>
                      {getOperationTypes(currentOperationState.validationCategory).map((type) => (
                        <SelectItem key={type.value} value={type.value} className="text-xs">
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Dynamic Configuration Fields */}
              {currentOperationState.operationType && (
                <div className="space-y-2">
                  {/* Arithmetic Operations Config */}
                  {currentOperationState.validationCategory === 'arithmetic' && (
                    <>
                      {['equal', 'not_equal', 'greater_than', 'less_than', 'greater_equal', 'less_equal'].includes(currentOperationState.operationType) && (
                        <div>
                          <Label className="text-xs text-slate-600">
                            {currentOperationState.operationType === 'equal' ? 'Expected Value' :
                             currentOperationState.operationType === 'not_equal' ? 'Not Equal To' :
                             currentOperationState.operationType === 'greater_than' ? 'Greater Than' :
                             currentOperationState.operationType === 'less_than' ? 'Less Than' :
                             currentOperationState.operationType === 'greater_equal' ? 'Greater or Equal' :
                             'Less or Equal'}
                          </Label>
                          <Input
                            value={currentOperationState.operationConfig.expectedValue || ''}
                            onChange={(e) => setCurrentOperationState({
                              ...currentOperationState,
                              operationConfig: {...currentOperationState.operationConfig, expectedValue: e.target.value}
                            })}
                            className="h-8 text-xs"
                            placeholder="123203"
                          />
                        </div>
                      )}
                    </>
                  )}

                  {/* String Operations Config */}
                  {currentOperationState.validationCategory === 'string' && (
                    <>
                      {currentOperationState.operationType === 'substring' && (
                        <>
                          <div>
                            <Label className="text-xs text-slate-600">Start Position</Label>
                            <Input
                              type="number"
                              value={currentOperationState.operationConfig.start ?? ''}
                              onChange={(e) => setCurrentOperationState({
                                ...currentOperationState,
                                operationConfig: {...currentOperationState.operationConfig, start: parseInt(e.target.value) || 0}
                              })}
                              className="h-8 text-xs"
                              placeholder="0"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-slate-600">End Position</Label>
                            <Input
                              type="number"
                              value={currentOperationState.operationConfig.end ?? ''}
                              onChange={(e) => setCurrentOperationState({
                                ...currentOperationState,
                                operationConfig: {...currentOperationState.operationConfig, end: parseInt(e.target.value) || 0}
                              })}
                              className="h-8 text-xs"
                              placeholder="10"
                            />
                          </div>
                        </>
                      )}
                      {currentOperationState.operationType === 'replace' && (
                        <>
                          <div>
                            <Label className="text-xs text-slate-600">Search Text</Label>
                            <Input
                              value={currentOperationState.operationConfig.search || ''}
                              onChange={(e) => setCurrentOperationState({
                                ...currentOperationState,
                                operationConfig: {...currentOperationState.operationConfig, search: e.target.value}
                              })}
                              className="h-8 text-xs"
                              placeholder="text to find"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-slate-600">Replace With</Label>
                            <Input
                              value={currentOperationState.operationConfig.replace || ''}
                              onChange={(e) => setCurrentOperationState({
                                ...currentOperationState,
                                operationConfig: {...currentOperationState.operationConfig, replace: e.target.value}
                              })}
                              className="h-8 text-xs"
                              placeholder="replacement text"
                            />
                          </div>
                        </>
                      )}
                      {currentOperationState.operationType === 'concat' && (
                        <div>
                          <Label className="text-xs text-slate-600">Append Text</Label>
                          <Input
                            value={currentOperationState.operationConfig.appendText || ''}
                            onChange={(e) => setCurrentOperationState({
                              ...currentOperationState,
                              operationConfig: {...currentOperationState.operationConfig, appendText: e.target.value}
                            })}
                            className="h-8 text-xs"
                            placeholder="text to append"
                          />
                        </div>
                      )}
                    </>
                  )}

                  {/* Mathematical Operations Config */}
                  {currentOperationState.validationCategory === 'mathematical' && (
                    <div>
                      <Label className="text-xs text-slate-600">Operand</Label>
                      <Input
                        type="number"
                        value={currentOperationState.operationConfig.operand || ''}
                        onChange={(e) => setCurrentOperationState({
                          ...currentOperationState,
                          operationConfig: {...currentOperationState.operationConfig, operand: parseFloat(e.target.value) || 0}
                        })}
                        className="h-8 text-xs"
                        placeholder="0"
                      />
                    </div>
                  )}

                  {/* Error Validation Config */}
                  {currentOperationState.validationCategory === 'error' && (
                    <>
                      {(currentOperationState.operationType === 'format_check' || currentOperationState.operationType === 'pattern_check') && (
                        <div>
                          <Label className="text-xs text-slate-600">Pattern (Regex)</Label>
                          <Input
                            value={currentOperationState.operationConfig.pattern || ''}
                            onChange={(e) => setCurrentOperationState({
                              ...currentOperationState,
                              operationConfig: {...currentOperationState.operationConfig, pattern: e.target.value}
                            })}
                            className="h-8 text-xs"
                            placeholder="^[0-9]+$"
                          />
                        </div>
                      )}
                      {currentOperationState.operationType === 'range_check' && (
                        <>
                          <div>
                            <Label className="text-xs text-slate-600">Minimum</Label>
                            <Input
                              type="number"
                              value={currentOperationState.operationConfig.min || ''}
                              onChange={(e) => setCurrentOperationState({
                                ...currentOperationState,
                                operationConfig: {...currentOperationState.operationConfig, min: parseFloat(e.target.value) || 0}
                              })}
                              className="h-8 text-xs"
                              placeholder="0"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-slate-600">Maximum</Label>
                            <Input
                              type="number"
                              value={currentOperationState.operationConfig.max || ''}
                              onChange={(e) => setCurrentOperationState({
                                ...currentOperationState,
                                operationConfig: {...currentOperationState.operationConfig, max: parseFloat(e.target.value) || 100}
                              })}
                              className="h-8 text-xs"
                              placeholder="100"
                            />
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-slate-500 text-xs py-8">
              Select a connection to configure operations
            </div>
          )}
        </div>
        
        {/* Execute Button */}
        <div className="p-3 border-t border-slate-200 flex justify-end">
          <Button
            onClick={handleApplyOperation}
            className="h-8 px-4 text-xs font-medium"
            disabled={!currentOperationState.operationType || !currentOperationState.validationCategory || (!targetFields.source && !targetFields.target)}
          >
            <Play className="h-3 w-3 mr-1" />
            Execute
          </Button>
        </div>
      </div>

      {/* Right Panel - Output */}
      <div className="bg-white border border-slate-200 rounded-lg flex flex-col">
        <div className="p-3 border-b border-slate-200">
          <h3 className="text-sm font-medium text-slate-800">Validation Results</h3>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3">
          {getCurrentOperationResult() ? (
            <div className="space-y-3">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-slate-800">Operation Summary</span>
                  <Badge variant="outline" className="text-xs">
                    {validationCategories.find(c => c.value === getCurrentOperationResult()?.category)?.label}
                  </Badge>
                </div>
                <div className="text-xs text-slate-600">
                  <div>Operation: {getOperationTypes(getCurrentOperationResult()?.category).find(t => t.value === getCurrentOperationResult()?.operation)?.label}</div>
                  <div>Applied to: {getCurrentOperationResult()?.targetFields?.source ? 'Source Column' : 'Target Column'}</div>
                </div>
              </div>

              {/* Source Column Values */}
              <div className="border rounded-lg p-2">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span className="text-xs font-semibold text-slate-800">SOURCE</span>
                  <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                    {selectedConnection?.sourceColumn.name}
                  </Badge>
                </div>
                
                <div className="space-y-1">
                  <div className="flex items-center justify-between p-2 bg-slate-50 rounded">
                    <span className="text-xs text-slate-600">Original Value:</span>
                    <span className="text-xs font-medium text-slate-800">
                      {String(getCurrentOperationResult()?.input?.source || 'No value')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-slate-50 rounded">
                    <span className="text-xs text-slate-600">Current Value:</span>
                    <span className="text-xs font-medium text-slate-800">
                      {getCurrentOperationResult()?.results?.source !== undefined
                        ? (() => {
                            const result = getCurrentOperationResult()?.results?.source;
                            // Handle different result types
                            if (typeof result === 'boolean') {
                              return result ? '✓ True' : '✗ False';
                            } else if (typeof result === 'object' && result !== null) {
                              // Check if it's an error or validation object
                              if (result.error) {
                                return `❌ ${result.error}`;
                              } else if (result.isValid !== undefined) {
                                return `${result.isValid ? '✓' : '✗'} ${result.message || ''}`;
                              }
                              return JSON.stringify(result);
                            }
                            return String(result);
                          })()
                        : String(getCurrentOperationResult()?.input?.source || 'No value')
                      }
                    </span>
                  </div>
                </div>
              </div>

              {/* Target Column Values */}
              <div className="border rounded-lg p-2">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <span className="text-xs font-semibold text-slate-800">TARGET</span>
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                    {selectedConnection?.targetColumn.name}
                  </Badge>
                </div>
                
                <div className="space-y-1">
                  <div className="flex items-center justify-between p-2 bg-slate-50 rounded">
                    <span className="text-xs text-slate-600">Original Value:</span>
                    <span className="text-xs font-medium text-slate-800">
                      {String(getCurrentOperationResult()?.input?.target || 'No value')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-slate-50 rounded">
                    <span className="text-xs text-slate-600">Current Value:</span>
                    <span className="text-xs font-medium text-slate-800">
                      {getCurrentOperationResult()?.results?.target !== undefined
                        ? (() => {
                            const result = getCurrentOperationResult()?.results?.target;
                            // Handle different result types
                            if (typeof result === 'boolean') {
                              return result ? '✓ True' : '✗ False';
                            } else if (typeof result === 'object' && result !== null) {
                              // Check if it's an error or validation object
                              if (result.error) {
                                return `❌ ${result.error}`;
                              } else if (result.isValid !== undefined) {
                                return `${result.isValid ? '✓' : '✗'} ${result.message || ''}`;
                              }
                              return JSON.stringify(result);
                            }
                            return String(result);
                          })()
                        : String(getCurrentOperationResult()?.input?.target || 'No value')
                      }
                    </span>
                  </div>
                </div>
              </div>

              {/* Overall Validation Summary */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-slate-800">Summary</span>
                </div>
                <div className="text-xs space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-slate-600">Source:</span>
                    <span className="font-medium text-slate-800">
                      {getCurrentOperationResult()?.results?.source !== undefined 
                        ? `${getCurrentOperationResult()?.category} - ${getCurrentOperationResult()?.operation}`
                        : 'No Operation'
                      }
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <span className="text-slate-600">Target:</span>
                    <span className="font-medium text-slate-800">
                      {getCurrentOperationResult()?.results?.target !== undefined 
                        ? `${getCurrentOperationResult()?.category} - ${getCurrentOperationResult()?.operation}`
                        : 'No Operation'
                      }
                    </span>
                  </div>
                  
                  {/* Validation Status */}
                  {getCurrentValidationStatus() && (
                    <div className={`mt-2 p-2 rounded border ${
                      getCurrentValidationStatus()?.isValid 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-red-50 border-red-200'
                    }`}>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          getCurrentValidationStatus()?.isValid ? 'bg-green-500' : 'bg-red-500'
                        }`}></div>
                        <span className={`text-xs font-medium ${
                          getCurrentValidationStatus()?.isValid ? 'text-green-800' : 'text-red-800'
                        }`}>
                          {getCurrentValidationStatus()?.isValid ? '✓ VALIDATED' : '✗ NOT VALIDATED'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 mt-1">
                        {getCurrentValidationStatus()?.comparison}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Show existing values when no operations are performed */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-sm font-medium text-gray-800 mb-3">Current Values</div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 bg-white rounded border">
                    <span className="text-xs font-medium text-gray-700">Source:</span>
                    <span className="text-xs font-medium text-gray-800">
                      {selectedConnection?.sourceColumnValue !== undefined ? String(selectedConnection.sourceColumnValue) : 'No value'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-white rounded border">
                    <span className="text-xs font-medium text-gray-700">Target:</span>
                    <span className="text-xs font-medium text-gray-800">
                      {selectedConnection?.targetColumnValue !== undefined ? String(selectedConnection.targetColumnValue) : 'No value'}
                    </span>
                  </div>
                </div>
                
                {/* Validation Result */}
                {selectedConnection?.sourceColumnValue !== undefined && selectedConnection?.targetColumnValue !== undefined && (
                  <div className="mt-3 p-2 rounded border">
                    <div className="text-xs font-medium text-gray-700 mb-1">Validation:</div>
                    <div className={`text-xs font-medium ${
                      selectedConnection.sourceColumnValue === selectedConnection.targetColumnValue 
                        ? 'text-green-600' 
                        : 'text-red-600'
                    }`}>
                      {selectedConnection.sourceColumnValue === selectedConnection.targetColumnValue ? '✓ Validated' : '✗ Not Validated'}
                    </div>
                  </div>
                )}
                
                <div className="mt-3 p-2 bg-yellow-50 rounded border border-yellow-200">
                  <div className="text-xs text-yellow-800">
                    💡 Apply operations to see transformed values
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Validate Button */}
        <div className="p-3 border-t border-slate-200 flex justify-end">
          <Button
            onClick={() => {
              // Get values - either from operations or existing values
              let sourceValue, targetValue;
              
              const currentResult = getCurrentOperationResult();
              if (currentResult) {
                // Use operation results if available
                sourceValue = currentResult.results.source !== undefined
                  ? currentResult.results.source
                  : currentResult.input.source;
                
                targetValue = currentResult.results.target !== undefined
                  ? currentResult.results.target
                  : currentResult.input.target;
              } else {
                // Use existing values when no operations
                sourceValue = selectedConnection?.sourceColumnValue;
                targetValue = selectedConnection?.targetColumnValue;
              }
              
              if (!sourceValue && !targetValue) return;
              
              // Compare values
              const isValid = sourceValue === targetValue;
              
              const validationStatusData = {
                isValid: isValid,
                sourceValue: sourceValue,
                targetValue: targetValue,
                comparison: isValid ? 'Values are equal' : 'Values are not equal'
              };
              
              // Update validation status for this connection
              const updatedOps = {
                ...getCurrentConnectionOperations(),
                validationStatus: validationStatusData
              };
              setCurrentConnectionOperations(updatedOps);
              
              // Also store in global store
              setCurrentValidationStatus(validationStatusData);
            }}
            className="h-8 px-4 text-xs font-medium bg-green-600 hover:bg-green-700"
            disabled={!selectedConnection}
          >
            {getCurrentOperationResult() ? 'Validate Results' : 'Validate Values'}
          </Button>
        </div>
      </div>
    </>
  );
};


