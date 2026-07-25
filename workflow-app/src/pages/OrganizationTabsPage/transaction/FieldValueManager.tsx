import { useState, useMemo } from 'react';
import { Search, Plus, Edit, Trash2, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Transaction, TransactionTable, TransactionTableField, FieldValue } from '../types/organization';
import { BoundaryValueDialog } from './BoundaryValueDialog';
import { toast } from 'sonner';

interface FieldValueManagerProps {
  transaction: Transaction;
  table: TransactionTable;
  field: TransactionTableField;
  onBackToFields: () => void;
  onUpdateField: (updatedField: TransactionTableField) => void;
}

export function FieldValueManager({ transaction, table, field, onBackToFields, onUpdateField }: FieldValueManagerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingValue, setEditingValue] = useState<FieldValue | null>(null);
  const [isBoundaryDialogOpen, setIsBoundaryDialogOpen] = useState(false);
  const [selectedFieldValue, setSelectedFieldValue] = useState<FieldValue | null>(null);

  const filteredValues = useMemo(() =>
    field.values.filter(value =>
      value.testingTechnique.toLowerCase().includes(searchTerm.toLowerCase())
    ), [field.values, searchTerm]);

  const handleAdd = () => {
    setEditingValue(null);
    setIsFormOpen(true);
  };

  const handleEdit = (value: FieldValue) => {
    setEditingValue(value);
    setIsFormOpen(true);
  };

  const handleSave = (valueData: Omit<FieldValue, 'id'>) => {
    let updatedValues;
    if (editingValue) {
      updatedValues = field.values.map(v => v.id === editingValue.id ? { ...editingValue, ...valueData } : v);
    } else {
      const newValue: FieldValue = { id: `VAL-${Date.now()}`, ...valueData };
      updatedValues = [...field.values, newValue];
    }
    onUpdateField({ ...field, values: updatedValues });
    setIsFormOpen(false);
  };

  const handleDelete = (valueId: string) => {
    const updatedValues = field.values.filter(v => v.id !== valueId);
    onUpdateField({ ...field, values: updatedValues });
  };

  return (
    <div className="space-y-4">
      <BoundaryValueDialog 
        isOpen={isBoundaryDialogOpen} 
        onClose={() => setIsBoundaryDialogOpen(false)} 
        fieldValue={selectedFieldValue} 
      />
      <div className="flex items-center gap-2 text-foreground flex-wrap">
        <Home className="h-5 w-5 text-muted-foreground" />
        <span className="text-muted-foreground">/</span>
        <span className="cursor-default">TCode: {transaction.code}</span>
        <span className="text-muted-foreground">/</span>
        <span className="cursor-default">Table: {table.name}</span>
        <span className="text-muted-foreground">/</span>
        <button onClick={onBackToFields} className="hover:underline text-primary">Field: {field.name}</button>
        <span className="text-muted-foreground">/</span>
        <span className="font-semibold text-primary">Field Values</span>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input placeholder="Search techniques..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
        </div>
        <Button onClick={handleAdd} variant="accent" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add
        </Button>
      </div>

      {isFormOpen && (
        <ValueForm
          onClose={() => setIsFormOpen(false)}
          onSave={handleSave}
          initialData={editingValue}
        />
      )}

      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <Table>
          <TableHeader><TableRow className="bg-muted/60 hover:bg-muted">
            <TableHead>Testing Technique</TableHead>
            <TableHead>Field Value</TableHead>
            <TableHead>Lower Limit</TableHead>
            <TableHead>Upper Limit</TableHead>
            <TableHead className="text-center">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filteredValues.map((value) => (
              <TableRow key={value.id}>
                <TableCell className="font-medium">{value.testingTechnique}</TableCell>
                <TableCell>{value.fieldValue}</TableCell>
                <TableCell>{value.lowerLimit}</TableCell>
                <TableCell>{value.upperLimit}</TableCell>
                <TableCell>
                  <div className="flex justify-center gap-1">
                    <Button 
                      variant="accent" 
                      size="sm" 
                      className="h-8 text-xs" 
                      onClick={() => {
                        setSelectedFieldValue(value);
                        setIsBoundaryDialogOpen(true);
                      }}
                    >
                      Boundary Values
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(value)} className="text-muted-foreground hover:text-primary hover:bg-primary/10 h-8 w-8"><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(value.id)} className="text-red-500 hover:text-red-600 hover:bg-red-500/10 h-8 w-8"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ValueForm({ onClose, onSave, initialData }: {
    onClose: () => void;
    onSave: (data: Omit<FieldValue, 'id'>) => void;
    initialData: FieldValue | null;
}) {
    const [formData, setFormData] = useState({ testingTechnique: '', fieldValue: '', lowerLimit: '', upperLimit: '' });

    useState(() => {
        if (initialData) {
            setFormData(initialData);
        }
    });

    const handleSave = () => {
        if (!formData.testingTechnique) {
            toast.error('Testing Technique is required.');
            return;
        }
        onSave(formData);
    };

    return (
        <div className="p-4 border rounded-lg space-y-4 bg-muted/50">
            <h3 className="font-semibold text-lg">{initialData ? 'Edit Field Value' : 'Add New Field Value'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Input placeholder="Testing Technique" value={formData.testingTechnique} onChange={e => setFormData(p => ({ ...p, testingTechnique: e.target.value }))} />
                <Input placeholder="Field Value" value={formData.fieldValue} onChange={e => setFormData(p => ({ ...p, fieldValue: e.target.value }))} />
                <Input placeholder="Lower Limit" value={formData.lowerLimit} onChange={e => setFormData(p => ({ ...p, lowerLimit: e.target.value }))} />
                <Input placeholder="Upper Limit" value={formData.upperLimit} onChange={e => setFormData(p => ({ ...p, upperLimit: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
                <Button size="sm" onClick={handleSave} variant="accent">Save Value</Button>
            </div>
        </div>
    );
}
