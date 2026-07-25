/**
 * Utility functions to convert AI-generated N-way match responses to UI format
 */

import { MatchRule, Connection, Source, SourceFilter, CustomFilter, ConnectionType } from '@/types';

/**
 * Converts the AI-generated N-way match response to the format expected by the UI
 * This handles the "status: ok" response from /semantic-nway-match/compile-nway-request
 */
export const convertAiNwayMatchResponseToUiFormat = (
    aiResponse: any,
    sources: Source[]
): {
    rules: MatchRule[];
    conversationId: string;
    conversationName: string;
} => {
    console.log('[AI CONVERTER] convertAiNwayMatchResponseToUiFormat called');
    console.log('[AI CONVERTER] aiResponse:', aiResponse);
    console.log('[AI CONVERTER] sources:', sources);
    console.log('[AI CONVERTER] sources names:', sources.map(s => s.name));

    try {
        const getSourceIdByName = (name: string) => {
            const found = sources.find(s => s.name === name);
            if (!found) {
                console.warn(`[AI CONVERTER] No source found for "${name}". Available: ${sources.map(s => s.name).join(', ')}`);
            }
            return found?.id || name;
        };
        const getSourceByName = (name: string) => {
            return sources.find(s => s.name === name);
        };

        console.log('[AI CONVERTER] aiResponse.rules:', aiResponse.rules);
        console.log('[AI CONVERTER] Number of rules:', (aiResponse.rules || []).length);

        const convertedRules: MatchRule[] = (aiResponse.rules || []).map((backendRule: any, index: number): MatchRule => {
            console.log(`[AI CONVERTER] Processing rule ${index}:`, backendRule);
            const ruleName = backendRule.ruleName || backendRule.rule_settings?.ruleName || `Rule-${index + 1}`;
            const ruleSettings = backendRule.rule_settings || {};
            console.log(`[AI CONVERTER] Rule name: ${ruleName}, settings:`, ruleSettings);

            // Parse connections from backend format
            console.log('[AI CONVERTER] Backend connections:', backendRule.connections);
            const connections: Connection[] = (backendRule.connections || []).map((conn: any): Connection => {
                const sourceId = getSourceIdByName(conn.source_name);
                const targetId = getSourceIdByName(conn.target_name);
                const sourceInfo = getSourceByName(conn.source_name);
                const targetInfo = getSourceByName(conn.target_name);

                const connection = {
                    id: `conn-${sourceId}-${targetId}-${Date.now()}-${Math.random()}`,
                    sourceId,
                    sourceColumn: conn.source_column,
                    targetId,
                    targetColumn: conn.target_column,
                    sourceTag: sourceInfo?.tag || '',
                    targetTag: targetInfo?.tag || '',
                };
                console.log('[AI CONVERTER] Created connection:', connection);
                return connection;
            });

            console.log('[AI CONVERTER] Total connections created:', connections.length);

            // Parse source filters
            const sourceFilters: Record<string, SourceFilter> = {};
            (backendRule.sources || []).forEach((backendSource: any) => {
                const sourceInfo = getSourceByName(backendSource.source);
                if (sourceInfo) {
                    const customFilters: CustomFilter[] = (backendSource.ruleFilters || []).map((filter: any, idx: number) => {
                        if (typeof filter === 'string') {
                            return { id: `filter-${idx}-${Date.now()}`, value: filter };
                        }
                        return null;
                    }).filter((f): f is CustomFilter => f !== null);

                    sourceFilters[sourceInfo.id] = {
                        dropDuplicates: backendSource.dropDuplicates ?? false,
                        duplicateColumns: backendSource.dropDuplicatedColumns || [],
                        customFilters,
                    };
                }
            });

            // Determine if this is a self-match rule
            const isSelfMatch = ruleSettings.self_match ?? false;
            let selfMatchSourceId: string | undefined;
            let selfMatchDebitCreditColumn: string | undefined;

            if (isSelfMatch) {
                // Find the source with debitCreditColumn
                const selfMatchSource = (backendRule.sources || []).find((s: any) =>
                    s.columns?.debitCreditColumn && s.columns.debitCreditColumn.length > 0
                );
                if (selfMatchSource) {
                    const sourceInfo = getSourceByName(selfMatchSource.source);
                    if (sourceInfo) {
                        selfMatchSourceId = sourceInfo.id;
                        selfMatchDebitCreditColumn = selfMatchSource.columns.debitCreditColumn[0];
                    }
                }
            }

            // Create connection types map (default to 'key' for all connections)
            const connectionTypes = new Map<string, ConnectionType>();

            // Parse aggregation rules from backend connections
            const aggregationRules: any[] = [];

            (backendRule.connections || []).forEach((conn: any, idx: number) => {
                const connectionId = connections[idx]?.id;
                if (!connectionId) return;

                // Check if aggregation is enabled for this connection
                const hasAggregation = conn.aggregation?.enabled ?? false;
                connectionTypes.set(connectionId, hasAggregation ? 'aggregation' : 'key');

                if (hasAggregation) {
                    aggregationRules.push({
                        connectionId,
                        sourceColumnAggregation: conn.aggregation?.source_aggregation || 'sum',
                        targetColumnAggregation: conn.aggregation?.target_aggregation || 'sum',
                        tolerance: ''
                    });
                }
            });

            const newRule: MatchRule = {
                id: `rule-${Date.now()}-${index}`,
                name: ruleName,
                connections,
                aggregationRules,
                connectionTypes,
                mapAndCompare: false,
                processAllRecords: ruleSettings.process_all_records ?? false,
                toleranceMatch: ruleSettings.is_tolerance_match ?? false,
                toleranceValue: ruleSettings.tolerance_value?.toString() ?? '',
                bucketMatch: ruleSettings.is_bucket_match ?? false,
                bucketSourceSide: ruleSettings.bucket_side?.toUpperCase() || 'LEFT',
                matchDuplicate: ruleSettings.duplicate_match ?? false,
                isSelfMatch,
                selfMatchSourceId,
                selfMatchDebitCreditColumn,
                sourceFilters,
                matchCriteria: [], // Match criteria will be populated separately if needed
                dropDuplicates: false,
                roundTo: 0
            };

            console.log('[AI CONVERTER] Created rule:', newRule);
            return newRule;
        });

        console.log('[AI CONVERTER] Final converted rules:', convertedRules);
        console.log('[AI CONVERTER] Total rules converted:', convertedRules.length);

        return {
            rules: convertedRules,
            conversationId: aiResponse.conversation_id || '',
            conversationName: aiResponse.conversation_name || ''
        };
    } catch (error) {
        console.error('[AI CONVERTER] Failed to convert AI N-way match response:', error);
        return {
            rules: [],
            conversationId: '',
            conversationName: ''
        };
    }
};
