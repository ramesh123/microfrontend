import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ColumnMapping, DataSource } from './types/mapping';

interface MappingBuilderProps {
  applications: DataSource[];
  onMappingAdd: (mapping: Omit<ColumnMapping, 'id'>) => void;
  onClose: () => void;
}

export const MappingBuilder: React.FC<MappingBuilderProps> = ({
  applications,
  onMappingAdd,
  onClose
}) => {
  const [sourceApplication, setSourceApplication] = useState('');
  const [sourceTable, setSourceTable] = useState('');
  const [sourceColumn, setSourceColumn] = useState('');
  const [targetApplication, setTargetApplication] = useState('');
  const [targetTable, setTargetTable] = useState('');
  const [targetColumn, setTargetColumn] = useState('');

  const getTablesForApplication = (applicationName: string) => {
    const app = applications.find(app => app.name === applicationName);
    return app?.tables || [];
  };

  const getColumnsForTable = (applicationName: string, tableName: string) => {
    const app = applications.find(app => app.name === applicationName);
    const table = app?.tables.find(t => t.name === tableName);
    return table?.columns || [];
  };

  const validateMapping = () => {
    const sourceCol = getColumnsForTable(sourceApplication, sourceTable)
      .find(col => col.name === sourceColumn);
    const targetCol = getColumnsForTable(targetApplication, targetTable)
      .find(col => col.name === targetColumn);

    if (!sourceCol || !targetCol) {
      return {
        status: 'failed' as const,
        message: 'Column not found'
      };
    }

    if (sourceCol.type === targetCol.type) {
      return {
        status: 'passed' as const,
        message: `datatype ${sourceCol.type} = ${targetCol.type}`
      };
    }

    // Simple type compatibility check
    const compatibleTypes = [
      ['integer', 'bigint'],
      ['varchar', 'text'],
      ['decimal', 'float']
    ];

    const isCompatible = compatibleTypes.some(([type1, type2]) => 
      (sourceCol.type.includes(type1) && targetCol.type.includes(type2)) ||
      (sourceCol.type.includes(type2) && targetCol.type.includes(type1))
    );

    if (isCompatible) {
      return {
        status: 'warning' as const,
        message: `datatype ${sourceCol.type} ≠ ${targetCol.type} (compatible)`
      };
    }

    return {
      status: 'failed' as const,
      message: `datatype ${sourceCol.type} ≠ ${targetCol.type} (incompatible)`
    };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!sourceApplication || !sourceTable || !sourceColumn || 
        !targetApplication || !targetTable || !targetColumn) {
      return;
    }

    const validation = validateMapping();

    onMappingAdd({
      sourceTable,
      sourceColumn,
      targetTable,
      targetColumn,
      sourceApplication,
      targetApplication,
      validationStatus: validation.status,
      validationMessage: validation.message
    });

    onClose();
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Column Mapping</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <Label>Source</Label>
              
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Application</Label>
                <Select value={sourceApplication} onValueChange={setSourceApplication}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Select application" />
                  </SelectTrigger>
                  <SelectContent>
                    {applications.map(app => (
                      <SelectItem key={app.id} value={app.name}>
                        {app.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Table</Label>
                <Select value={sourceTable} onValueChange={setSourceTable}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Select table" />
                  </SelectTrigger>
                  <SelectContent>
                    {getTablesForApplication(sourceApplication).map(table => (
                      <SelectItem key={table.name} value={table.name}>
                        {table.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Column</Label>
                <Select value={sourceColumn} onValueChange={setSourceColumn}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    {getColumnsForTable(sourceApplication, sourceTable).map(column => (
                      <SelectItem key={column.name} value={column.name}>
                        {column.name} ({column.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <Label>Target</Label>
              
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Application</Label>
                <Select value={targetApplication} onValueChange={setTargetApplication}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Select application" />
                  </SelectTrigger>
                  <SelectContent>
                    {applications.map(app => (
                      <SelectItem key={app.id} value={app.name}>
                        {app.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Table</Label>
                <Select value={targetTable} onValueChange={setTargetTable}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Select table" />
                  </SelectTrigger>
                  <SelectContent>
                    {getTablesForApplication(targetApplication).map(table => (
                      <SelectItem key={table.name} value={table.name}>
                        {table.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Column</Label>
                <Select value={targetColumn} onValueChange={setTargetColumn}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    {getColumnsForTable(targetApplication, targetTable).map(column => (
                      <SelectItem key={column.name} value={column.name}>
                        {column.name} ({column.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Create Mapping</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
