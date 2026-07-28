import React from 'react';

interface Connection {
  id: string;
  sourceColumn?: {
    name: string;
    type?: string;
    table?: string;
  };
  targetColumn?: {
    name: string;
    type?: string;
    table?: string;
  };
  singleRule?: boolean;
  singleRuleType?: 'text' | 'field';
  singleOperation?: 'is_null' | 'equals';
  constantValue?: string;
  sourceColumnValue?: any;
}

interface FilterConnectionsPanelProps {
  connections: Connection[];
  selectedColumnForFilter: {
    name: string;
    type: string;
    table?: string;
    isSource: boolean;
    isTarget: boolean;
  } | null;
  onColumnSelect: (column: {
    name: string;
    type: string;
    table?: string;
    isSource: boolean;
    isTarget: boolean;
  }) => void;
}

export const FilterConnectionsPanel: React.FC<FilterConnectionsPanelProps> = ({
  connections,
  selectedColumnForFilter,
  onColumnSelect
}) => {
  return (
    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden flex flex-col">
      <div className="p-4 border-b border-slate-200 bg-slate-50">
        <h3 className="text-sm font-semibold text-slate-800">Connections</h3>
        <p className="text-xs text-slate-500 mt-1">
          {connections.length} connection{connections.length !== 1 ? 's' : ''}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Table Connections */}
        {(() => {
          const tableGroups = new Map<string, { sourceTable: string; targetTable: string; connections: Connection[] }>();
          connections.forEach(conn => {
            if (!conn.singleRule && conn.sourceColumn?.table && conn.targetColumn?.table) {
              const key = `${conn.sourceColumn.table}-${conn.targetColumn.table}`;
              if (!tableGroups.has(key)) {
                tableGroups.set(key, {
                  sourceTable: conn.sourceColumn.table,
                  targetTable: conn.targetColumn.table,
                  connections: []
                });
              }
              tableGroups.get(key)!.connections.push(conn);
            }
          });

          return Array.from(tableGroups.values()).map((tableGroup, tableIndex) => (
            <div key={`${tableGroup.sourceTable}-${tableGroup.targetTable}`} className="space-y-2">
              <div className="text-xs font-semibold text-slate-600 mb-2">Table Connection {tableIndex + 1}</div>
              <div className="flex items-center gap-2 flex-wrap p-2 border border-slate-200 rounded-lg bg-white">
                <button
                  onClick={() => onColumnSelect({
                    name: tableGroup.sourceTable,
                    type: 'table',
                    table: tableGroup.sourceTable,
                    isSource: true,
                    isTarget: false
                  })}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                    selectedColumnForFilter?.name === tableGroup.sourceTable && selectedColumnForFilter?.isSource && selectedColumnForFilter?.type === 'table'
                      ? 'bg-blue-600 text-white shadow-sm border-blue-600'
                      : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200'
                  }`}
                >
                  {tableGroup.sourceTable}
                </button>
                <span className="text-slate-400">→</span>
                <button
                  onClick={() => onColumnSelect({
                    name: tableGroup.targetTable,
                    type: 'table',
                    table: tableGroup.targetTable,
                    isSource: false,
                    isTarget: true
                  })}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                    selectedColumnForFilter?.name === tableGroup.targetTable && selectedColumnForFilter?.isTarget && selectedColumnForFilter?.type === 'table'
                      ? 'bg-blue-600 text-white shadow-sm border-blue-600'
                      : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200'
                  }`}
                >
                  {tableGroup.targetTable}
                </button>
                <span className="text-xs text-slate-500 ml-auto">
                  ({tableGroup.connections.length} column{tableGroup.connections.length !== 1 ? 's' : ''})
                </span>
              </div>
            </div>
          ));
        })()}

        {/* Column Connections */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-600 mb-2">Column Connections</div>
          {connections.map((conn, index) => (
            <div
              key={conn.id}
              className="p-3 border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
            >
              <div className="text-xs text-slate-600 mb-2">
                {index + 1}.
              </div>
              {conn.singleRule ? (
                <div className="text-xs font-medium text-slate-700">
                  {conn.sourceColumn?.name} → {conn.singleRuleType === 'field' 
                    ? (conn.singleOperation || 'is_null').replace(/_/g, '')
                    : `constant value(${conn.constantValue || ''})`}
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => onColumnSelect({
                      name: conn.sourceColumn?.name || '',
                      type: conn.sourceColumn?.type || 'string',
                      table: conn.sourceColumn?.table,
                      isSource: true,
                      isTarget: false
                    })}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                      selectedColumnForFilter?.name === conn.sourceColumn?.name && selectedColumnForFilter?.isSource && selectedColumnForFilter?.type !== 'table'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                    }`}
                  >
                    {conn.sourceColumn?.name}
                  </button>
                  <span className="text-slate-400">→</span>
                  <button
                    onClick={() => onColumnSelect({
                      name: conn.targetColumn?.name || '',
                      type: conn.targetColumn?.type || 'string',
                      table: conn.targetColumn?.table,
                      isSource: false,
                      isTarget: true
                    })}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                      selectedColumnForFilter?.name === conn.targetColumn?.name && selectedColumnForFilter?.isTarget && selectedColumnForFilter?.type !== 'table'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                    }`}
                  >
                    {conn.targetColumn?.name}
                  </button>
                </div>
              )}
              {conn.sourceColumnValue !== undefined && (
                <div className="text-xs text-slate-500 mt-1">
                  Value: {String(conn.sourceColumnValue)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

