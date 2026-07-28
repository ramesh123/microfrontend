/**
 * Sample Output Panel
 *
 * Displays sample data output for filter operations.
 * Can be toggled with AI Predicate Panel using animation.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Table, FileText } from 'lucide-react';

interface SampleOutputPanelProps {
  sampleData?: any[];
  columns?: string[];
}

export const SampleOutputPanel: React.FC<SampleOutputPanelProps> = ({
  sampleData = [],
  columns = []
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col h-full space-y-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border"
    >
      <div className="flex items-center gap-2 text-foreground">
        <Table className="w-5 h-5" />
        <h3 className="font-semibold text-lg">Sample Output</h3>
      </div>

      {sampleData.length > 0 && columns.length > 0 ? (
        <div className="flex-1 overflow-auto">
          <div className="min-w-full">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b bg-gray-100 dark:bg-gray-800">
                  {columns.map((col, idx) => (
                    <th
                      key={idx}
                      className="px-3 py-2 text-left font-medium text-foreground"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sampleData.slice(0, 10).map((row, rowIdx) => (
                  <tr
                    key={rowIdx}
                    className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    {columns.map((col, colIdx) => (
                      <td
                        key={colIdx}
                        className="px-3 py-2 text-foreground"
                      >
                        {row[col] !== null && row[col] !== undefined
                          ? String(row[col])
                          : '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sampleData.length > 10 && (
            <div className="mt-2 text-xs text-muted-foreground text-center">
              Showing 10 of {sampleData.length} rows
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground px-4">
          <FileText className="w-12 h-12 mb-3 opacity-20" />
          <p className="text-sm text-center">
            Configure your operations and click 'Execute' to see the results.
          </p>
        </div>
      )}
    </motion.div>
  );
};
