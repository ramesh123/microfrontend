import { useState, useMemo } from 'react';
import { Search, Plus, Edit, Trash2, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Transaction, TransactionTable, TransactionTableField } from '../types/organization';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { FieldValueManager } from './FieldValueManager';
import { toast } from 'sonner';

interface TransactionFieldManagerProps {
  transaction: Transaction;
  table: TransactionTable;
  onBackToTables: () => void;
  onUpdateTable: (updatedTable: TransactionTable) => void;
}

const ITEMS_PER_PAGE = 10;

export function TransactionFieldManager({ transaction, table, onBackToTables, onUpdateTable }: TransactionFieldManagerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingField, setEditingField] = useState<TransactionTableField | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewingField, setViewingField] = useState<TransactionTableField | null>(null);

  const filteredFields = useMemo(() =>
    table.fields.filter(field =>
      field.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      field.description.toLowerCase().includes(searchTerm.toLowerCase())
    ), [table.fields, searchTerm]);

  const totalPages = Math.ceil(filteredFields.length / ITEMS_PER_PAGE);
  const paginatedFields = filteredFields.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleSelectAll = (checked: boolean) => {
    setSelectedRows(checked ? paginatedFields.map(f => f.id) : []);
  };

  const handleSelectRow = (fieldId: string, checked: boolean) => {
    setSelectedRows(prev =>
      checked ? [...prev, fieldId] : prev.filter(id => id !== fieldId)
    );
  };

  const handleAdd = () => {
    setEditingField(null);
    setIsFormOpen(true);
  };

  const handleEdit = (field: TransactionTableField) => {
    setEditingField(field);
    setIsFormOpen(true);
  };

  const handleSave = (fieldData: Omit<TransactionTableField, 'id' | 'values'>) => {
    let updatedFields;
    if (editingField) {
      updatedFields = table.fields.map(f => f.id === editingField.id ? { ...editingField, ...fieldData } : f);
    } else {
      const newField: TransactionTableField = { id: `FIELD-${Date.now()}`, ...fieldData, values: [] };
      updatedFields = [...table.fields, newField];
    }
    onUpdateTable({ ...table, fields: updatedFields });
    setIsFormOpen(false);
  };

  const handleDelete = (fieldId: string) => {
    const updatedFields = table.fields.filter(f => f.id !== fieldId);
    onUpdateTable({ ...table, fields: updatedFields });
  };
  
  const handleUpdateField = (updatedField: TransactionTableField) => {
    const updatedFields = table.fields.map(f => f.id === updatedField.id ? updatedField : f);
    onUpdateTable({ ...table, fields: updatedFields });
    setViewingField(updatedField); // Keep viewing the updated field
  };

  if (viewingField) {
    return (
      <FieldValueManager
        transaction={transaction}
        table={table}
        field={viewingField}
        onBackToFields={() => setViewingField(null)}
        onUpdateField={handleUpdateField}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-foreground">
        <Home className="h-5 w-5 text-muted-foreground" />
        <span className="text-muted-foreground">/</span>
        <span className="cursor-default">TCode: {transaction.code}</span>
        <span className="text-muted-foreground">/</span>
        <button onClick={onBackToTables} className="hover:underline text-primary">Table: {table.name}</button>
        <span className="text-muted-foreground">/</span>
        <span className="font-semibold text-primary">Fields</span>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input placeholder="Search fields..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
        </div>
        <Button onClick={handleAdd} variant="accent" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add
        </Button>
      </div>

      {isFormOpen && (
        <FieldForm
          onClose={() => setIsFormOpen(false)}
          onSave={handleSave}
          initialData={editingField}
        />
      )}

      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <Table>
          <TableHeader><TableRow className="bg-muted/60 hover:bg-muted">
            <TableHead className="w-12"><Checkbox onCheckedChange={handleSelectAll} checked={selectedRows.length === paginatedFields.length && paginatedFields.length > 0} /></TableHead>
            <TableHead>Field Name</TableHead>
            <TableHead>Field Type</TableHead>
            <TableHead>Key</TableHead>
            <TableHead>Verification</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-center">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {paginatedFields.map((field) => (
              <TableRow key={field.id}>
                <TableCell><Checkbox onCheckedChange={(checked) => handleSelectRow(field.id, !!checked)} checked={selectedRows.includes(field.id)} /></TableCell>
                <TableCell className="font-medium">{field.name}</TableCell>
                <TableCell>{field.type}</TableCell>
                <TableCell>{field.key ? 'Yes' : 'No'}</TableCell>
                <TableCell>{field.verification ? 'Yes' : 'No'}</TableCell>
                <TableCell>{field.description}</TableCell>
                <TableCell>
                  <div className="flex justify-center gap-1">
                    <Button variant="accent" size="sm" className="h-8 text-xs" onClick={() => setViewingField(field)}>Values</Button>
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(field)} className="text-muted-foreground hover:text-primary hover:bg-primary/10 h-8 w-8"><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(field.id)} className="text-red-500 hover:text-red-600 hover:bg-red-500/10 h-8 w-8"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      
      <div className="flex justify-between items-center pt-2">
        <p className="text-sm text-muted-foreground">Showing {paginatedFields.length} of {filteredFields.length} fields.</p>
        <Pagination>
          <PaginationContent>
            <PaginationItem><PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); setCurrentPage(p => Math.max(1, p - 1)); }} /></PaginationItem>
            {[...Array(totalPages)].map((_, i) => (
              <PaginationItem key={i}><PaginationLink href="#" isActive={currentPage === i + 1} onClick={(e) => { e.preventDefault(); setCurrentPage(i + 1); }}>{i + 1}</PaginationLink></PaginationItem>
            ))}
            <PaginationItem><PaginationNext href="#" onClick={(e) => { e.preventDefault(); setCurrentPage(p => Math.min(totalPages, p + 1)); }} /></PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}

function FieldForm({ onClose, onSave, initialData }: {
    onClose: () => void;
    onSave: (data: Omit<TransactionTableField, 'id' | 'values'>) => void;
    initialData: TransactionTableField | null;
}) {
    const [formData, setFormData] = useState({ name: '', type: '', key: false, verification: false, description: '' });

    useState(() => {
        if (initialData) {
            setFormData(initialData);
        }
    });

    const handleSave = () => {
        if (!formData.name || !formData.type) {
            toast.error('Field Name and Type are required.');
            return;
        }
        onSave(formData);
    };

    return (
        <div className="p-4 border rounded-lg space-y-4 bg-muted/50">
            <h3 className="font-semibold text-lg">{initialData ? 'Edit Field' : 'Add New Field'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                <Input placeholder="Field Name" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} />
                <Input placeholder="Field Type" value={formData.type} onChange={e => setFormData(p => ({ ...p, type: e.target.value }))} />
                <Input placeholder="Description" value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} />
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2"><Checkbox id="key" checked={formData.key} onCheckedChange={c => setFormData(p => ({ ...p, key: !!c }))} /><label htmlFor="key">Key</label></div>
                    <div className="flex items-center gap-2"><Checkbox id="verification" checked={formData.verification} onCheckedChange={c => setFormData(p => ({ ...p, verification: !!c }))} /><label htmlFor="verification">Verification</label></div>
                </div>
            </div>
            <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
                <Button size="sm" onClick={handleSave} variant="accent">Save Field</Button>
            </div>
        </div>
    );
}
