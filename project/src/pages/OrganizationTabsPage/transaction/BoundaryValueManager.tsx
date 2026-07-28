import { useState, useMemo } from 'react';
import { Search, Plus, Edit, Trash2, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Transaction, TransactionTable, TransactionTableField, FieldValue as OriginalFieldValue } from '../types/organization';
import { toast } from 'sonner';

type FieldValue = OriginalFieldValue & { boundaryValues?: BoundaryValue[] };

// Note: The BoundaryValue type is inferred from usage, assuming it's part of an older data structure.
interface BoundaryValue {
  id: string;
  value: string;
  type: string;
}

interface BoundaryValueManagerProps {
  transaction: Transaction;
  table: TransactionTable;
  field: TransactionTableField;
  fieldValue: FieldValue;
  onBack: () => void;
  onUpdateFieldValue: (updatedFieldValue: FieldValue) => void;
}

export function BoundaryValueManager({ transaction, table, field, fieldValue, onBack, onUpdateFieldValue }: BoundaryValueManagerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingValue, setEditingValue] = useState<BoundaryValue | null>(null);

  const filteredValues = useMemo(() =>
    (fieldValue.boundaryValues || []).filter(value =>
      value.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      value.value.toLowerCase().includes(searchTerm.toLowerCase())
    ), [fieldValue.boundaryValues, searchTerm]);

  const handleAdd = () => { 
    setEditingValue(null);
    setIsFormOpen(true);
  };

  const handleEdit = (value: BoundaryValue) => {
    setEditingValue(value);
    setIsFormOpen(true);
  };

  const handleSave = (valueData: Omit<BoundaryValue, 'id'>) => {
    let updatedValues;
    if (editingValue) {
      updatedValues = (fieldValue.boundaryValues || []).map(v => v.id === editingValue.id ? { ...editingValue, ...valueData } : v);
    } else {
      const newValue: BoundaryValue = { id: `BV-${Date.now()}`, ...valueData };
      updatedValues = [...(fieldValue.boundaryValues || []), newValue];
    }
    onUpdateFieldValue({ ...fieldValue, boundaryValues: updatedValues });
    setIsFormOpen(false);
  };

  const handleDelete = (valueId: string) => {
    const updatedValues = (fieldValue.boundaryValues || []).filter(v => v.id !== valueId);
    onUpdateFieldValue({ ...fieldValue, boundaryValues: updatedValues });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-foreground flex-wrap">
        <Home className="h-5 w-5 text-muted-foreground" />
        <span className="text-muted-foreground">/</span>
        <span className="cursor-default">TCode: {transaction.code}</span>
        <span className="text-muted-foreground">/</span>
        <span className="cursor-default">Table: {table.name}</span>
        <span className="text-muted-foreground">/</span>
        <span className="cursor-default">Field: {field.name}</span>
        <span className="text-muted-foreground">/</span>
        <button onClick={onBack} className="hover:underline text-primary">Field Value: {fieldValue.testingTechnique}</button>
        <span className="text-muted-foreground">/</span>
        <span className="font-semibold text-primary">Boundary Values</span>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input placeholder="Search values or types..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
        </div>
        <Button onClick={handleAdd} variant="accent" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add
        </Button>
      </div>

      {isFormOpen && (
        <BoundaryForm
          onClose={() => setIsFormOpen(false)}
          onSave={handleSave}
          initialData={editingValue}
        />
      )}

      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <Table>
          <TableHeader><TableRow className="bg-muted/60 hover:bg-muted">
            <TableHead>Value</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-center">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filteredValues.length > 0 ? filteredValues.map((value) => (
              <TableRow key={value.id}>
                <TableCell className="font-medium">{value.value}</TableCell>
                <TableCell>{value.type}</TableCell>
                <TableCell>
                  <div className="flex justify-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(value)} className="text-muted-foreground hover:text-primary hover:bg-primary/10 h-8 w-8"><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(value.id)} className="text-red-500 hover:text-red-600 hover:bg-red-500/10 h-8 w-8"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">No boundary values found.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function BoundaryForm({ onClose, onSave, initialData }: {
    onClose: () => void;
    onSave: (data: Omit<BoundaryValue, 'id'>) => void;
    initialData: BoundaryValue | null;
}) {
    const [formData, setFormData] = useState({ value: '', type: '' });

    useState(() => {
        if (initialData) {
            setFormData(initialData);
        }
    });

    const handleSave = () => {
        if (!formData.value || !formData.type) {
            toast.error('Value and Type are required.');
            return;
        }
        onSave(formData);
    };

    return (
        <div className="p-4 border rounded-lg space-y-4 bg-muted/50">
            <h3 className="font-semibold text-lg">{initialData ? 'Edit Boundary Value' : 'Add New Boundary Value'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input placeholder="Value" value={formData.value} onChange={e => setFormData(p => ({ ...p, value: e.target.value }))} />
                <Input placeholder="Type (e.g., Min, Max, Min+)" value={formData.type} onChange={e => setFormData(p => ({ ...p, type: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
                <Button size="sm" onClick={handleSave} variant="accent">Save Value</Button>
            </div>
        </div>
    );
}
