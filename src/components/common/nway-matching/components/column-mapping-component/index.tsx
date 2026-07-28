import { useMemo } from 'react';
import { Source, MatchRule, Connection as AppConnection, AggregationRule, ConnectionType, SourceFilter } from '@/types';
import { ConnectionsPanel } from '../ConnectionsPanel';
import { FlowDiagram } from '@/components/common/multisource-validation/components/FlowDiagram';
import { SourceSelection } from '../SourceSelection';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SourceFilters } from '../SourceFilters';

interface ColumnMappingComponentProps {
  rule: MatchRule;
  sources: Source[];
  selectedSourceIds: string[];
  onToggleSource: (sourceId: string) => void;
  onAddConnection: (connection: AppConnection) => void;
  onRemoveConnection: (connectionId: string) => void;
  onSetConnectionType: (connectionId: string, type: ConnectionType) => void;
  onUpdateAggregationRule: (rule: Partial<AggregationRule> & { connectionId: string }) => void;
  onUpdateRuleSettings: (settings: Partial<Omit<MatchRule, 'id' | 'name' | 'connections' | 'aggregationRules' | 'connectionTypes'>>) => void;
  onUpdateSourceFilter: (sourceId: string, settings: Partial<SourceFilter>) => void;
  onToggleAggregation: (connectionId: string) => void;
  isRuleFiltersOpen?: boolean;
}

const RuleSettingCheckbox = ({ id, label, checked, onCheckedChange }: { id: string, label: string, checked: boolean, onCheckedChange: (checked: boolean) => void }) => (
  <div className="flex items-center space-x-2">
    <Checkbox id={id} checked={checked} onCheckedChange={onCheckedChange} />
    <Label htmlFor={id} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
      {label}
    </Label>
  </div>
);

export function ColumnMappingComponent({
  rule,
  sources,
  selectedSourceIds,
  onToggleSource,
  onAddConnection,
  onRemoveConnection,
  onSetConnectionType,
  onUpdateAggregationRule,
  onUpdateRuleSettings,
  onUpdateSourceFilter,
  onToggleAggregation,
  isRuleFiltersOpen = false,
}: ColumnMappingComponentProps) {

  const displaySources = useMemo(() => {
    return sources.map(s => ({
      ...s,
      selected: selectedSourceIds.includes(s.id),
    }));
  }, [sources, selectedSourceIds]);

  const flowSources = useMemo(() => {
    if (rule.isSelfMatch && rule.selfMatchSourceId) {
      return sources.filter(s => s.id === rule.selfMatchSourceId);
    }
    return sources.filter(s => selectedSourceIds.includes(s.id));
  }, [sources, selectedSourceIds, rule.isSelfMatch, rule.selfMatchSourceId]);

  const diagramSources = useMemo(() => {
    if (rule.isSelfMatch && rule.selfMatchSourceId) {
      const originalSource = sources.find(s => s.id === rule.selfMatchSourceId);
      if (!originalSource) return [];

      const source1 = JSON.parse(JSON.stringify(originalSource));

      const source2 = JSON.parse(JSON.stringify(originalSource));
      source2.id = `${originalSource.id}_right`;
      source2.name = `${originalSource.name} (Right)`;
      source2.columns.forEach((col: any) => {
        col.sourceId = source2.id;
      });

      return [source1, source2];
    }
    return flowSources;
  }, [flowSources, rule.isSelfMatch, rule.selfMatchSourceId, sources]);

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* Checkboxes - Always Visible by Default */}
      <div className="p-3 border-b flex-shrink-0">
        <div className="flex flex-row flex-wrap items-center gap-x-6 gap-y-4">
          <RuleSettingCheckbox id={`processAll-${rule.id}`} label="Process All Records" checked={rule.processAllRecords} onCheckedChange={(c) => onUpdateRuleSettings({ processAllRecords: c })} />

          <div className="flex items-center gap-4">
            <RuleSettingCheckbox id={`tolerance-${rule.id}`} label="Tolerance Match" checked={rule.toleranceMatch} onCheckedChange={(c) => onUpdateRuleSettings({ toleranceMatch: c })} />
            {rule.toleranceMatch && (
              <div className="flex items-center gap-2">
                <Label htmlFor={`toleranceValue-${rule.id}`} className="text-sm whitespace-nowrap">Tolerance Value:</Label>
                <Input
                  id={`toleranceValue-${rule.id}`}
                  type="number"
                  value={rule.toleranceValue}
                  onChange={(e) => onUpdateRuleSettings({ toleranceValue: e.target.value })}
                  className="h-8 w-30"
                  placeholder="e.g., 0.5"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            <RuleSettingCheckbox id={`bucket-${rule.id}`} label="Bucket Match" checked={rule.bucketMatch} onCheckedChange={(c) => onUpdateRuleSettings({ bucketMatch: c })} />
            {rule.bucketMatch && (
              <div className="flex items-center gap-2">
                <Select
                  value={rule.bucketSourceSide}
                  onValueChange={(v: 'LEFT' | 'RIGHT') => onUpdateRuleSettings({ bucketSourceSide: v })}
                >
                  <SelectTrigger id={`bucketSide-${rule.id}`} className="h-8 w-48">
                    <SelectValue placeholder="Choose Source Side" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LEFT">LEFT</SelectItem>
                    <SelectItem value="RIGHT">RIGHT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <RuleSettingCheckbox id={`duplicate-${rule.id}`} label="Match Duplicate" checked={rule.matchDuplicate} onCheckedChange={(c) => onUpdateRuleSettings({ matchDuplicate: c })} />
          {/* <RuleSettingCheckbox id={`mapCompare-${rule.id}`} label="Map and Compare" checked={rule.mapAndCompare} onCheckedChange={(c) => onUpdateRuleSettings({ mapAndCompare: c })} /> */}
        </div>
      </div>

      {/* Main Content - No outer scroll */}
      <div className="flex-1 flex flex-col min-h-0">
        {isRuleFiltersOpen && (
          <div className="p-3 border-b flex-shrink-0">
            <SourceFilters
              sources={flowSources}
              sourceFilters={rule.sourceFilters}
              onUpdateFilter={onUpdateSourceFilter}
            />
          </div>
        )}

        {!rule.isSelfMatch && (
          <div className="flex-shrink-0">
            <SourceSelection
              sources={displaySources}
              onToggleSource={onToggleSource}
            />
          </div>
        )}

        {/* Flex container for FlowDiagram and ConnectionsPanel - each with independent scroll */}
        <div className="flex-1 flex flex-col lg:flex-row gap-2 p-2 min-h-0">
          <div className="flex-1 lg:w-[920px] lg:max-w-[920px] min-h-0">
            <FlowDiagram
              sources={diagramSources}
              connections={rule.connections}
              onAddConnection={onAddConnection}
              onRemoveConnection={onRemoveConnection}
              connectionTypes={rule.connectionTypes}
            />
          </div>
          <div className="w-full lg:w-[420px] lg:max-w-[420px] flex-shrink-0 min-h-0">
            <ConnectionsPanel
              sources={sources}
              connections={rule.connections}
              aggregationRules={rule.aggregationRules}
              onUpdateAggregationRule={onUpdateAggregationRule}
              onToggleAggregation={onToggleAggregation}
              onRemoveConnection={onRemoveConnection}
            />
          </div>
        </div>
      </div>
    </div>
  );
}