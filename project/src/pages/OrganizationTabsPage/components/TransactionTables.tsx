import { useState, useMemo, useEffect } from 'react';
import { Search, Plus, Edit, Trash2, Home, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Transaction, TransactionTable } from '../types/organization';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';


interface TransactionTablesProps {
  transaction: Transaction;
  onBack: () => void;
  onUpdateTransaction: (updatedTx: Transaction) => void;
}

export function TransactionTables({ transaction, onBack, onUpdateTransaction }: TransactionTablesProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<TransactionTable | null>(null);

  const filteredTables = useMemo(() => 
    transaction.tables.filter(table =>
      table.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      table.description.toLowerCase().includes(searchTerm.toLowerCase())
    ), [transaction.tables, searchTerm]);

  const handleSelectAll = (checked: boolean) => {
    setSelectedRows(checked ? filteredTables.map(t => t.id) : []);
  };

  const handleSelectRow = (tableId: string, checked: boolean) => {
    setSelectedRows(prev => 
      checked ? [...prev, tableId] : prev.filter(id => id !== tableId)
    );
  };
  
  const handleAdd = () => {
    setEditingTable(null);
    setIsFormOpen(true);
  };

  const handleEdit = (table: TransactionTable) => {
    setEditingTable(table);
    setIsFormOpen(true);
  };

  const handleSave = (tableData: Omit<TransactionTable, 'id'>) => {
    let updatedTables;
    if (editingTable) {
      updatedTables = transaction.tables.map(t => t.id === editingTable.id ? { ...editingTable, ...tableData } : t);
    } else {
      const newTable: TransactionTable = { id: `TBL-${Date.now()}`, ...tableData };
      updatedTables = [...transaction.tables, newTable];
    }
    onUpdateTransaction({ ...transaction, tables: updatedTables });
    setIsFormOpen(false);
  };
  
  const handleDelete = (tableId: string) => {
    const updatedTables = transaction.tables.filter(t => t.id !== tableId);
    onUpdateTransaction({ ...transaction, tables: updatedTables });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-foreground">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
          <Home className="h-5 w-5 text-muted-foreground" />
          <span className="text-muted-foreground">/</span>
          <span>TCode: {transaction.code}</span>
          <span className="text-muted-foreground">/</span>
          <span className="font-semibold text-primary">Tables</span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input placeholder="Search tables..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
        </div>
        <Button onClick={handleAdd} variant="success" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add
        </Button>
      </div>

      {isFormOpen && (
        <TableForm 
          onClose={() => setIsFormOpen(false)}
          onSave={handleSave}
          initialData={editingTable}
        />
      )}

      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60 hover:bg-muted">
              <TableHead className="w-12"><Checkbox onCheckedChange={handleSelectAll} checked={selectedRows.length === filteredTables.length && filteredTables.length > 0} /></TableHead>
              <TableHead>Table Name</TableHead>
              <TableHead>TableType</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTables.map((table) => (
              <TableRow key={table.id}>
                <TableCell><Checkbox onCheckedChange={(checked) => handleSelectRow(table.id, !!checked)} checked={selectedRows.includes(table.id)} /></TableCell>
                <TableCell className="font-medium">{table.name}</TableCell>
                <TableCell>{table.type}</TableCell>
                <TableCell className="max-w-xs truncate">{table.description}</TableCell>
                <TableCell>
                  <div className="flex justify-center gap-1">
                    <Button variant="accent" size="sm" className="h-8 text-xs">Fields</Button>
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(table)} className="text-muted-foreground hover:text-primary hover:bg-primary/10 h-8 w-8"><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(table.id)} className="text-red-500 hover:text-red-600 hover:bg-red-500/10 h-8 w-8"><Trash2 className="h-4 w-4" /></Button>
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

function TableForm({ onClose, onSave, initialData }: { 
    onClose: () => void; 
    onSave: (data: Omit<TransactionTable, 'id'>) => void; 
    initialData: TransactionTable | null;
}) {
  const [formData, setFormData] = useState<Omit<TransactionTable, 'id'>>({ name: '', type: '', description: '', fields: [] });

  useEffect(() => {
    if (initialData) {
      setFormData({ name: initialData.name, type: initialData.type, description: initialData.description, fields: initialData.fields });
    } else {
      setFormData({ name: '', type: '', description: '', fields: [] });
    }
  }, [initialData]);

  const handleSave = () => {
    if (!formData.name || !formData.type) {
      toast.error('Table Name and Type are required.');
      return;
    }
    onSave(formData);
  };

  return (
    <div className="p-4 border rounded-lg space-y-4 bg-muted/50">
      <h3 className="font-semibold text-lg">{initialData ? 'Edit Table' : 'Add New Table'}</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Input placeholder="Table Name" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} />
        <Input placeholder="Table Type" value={formData.type} onChange={e => setFormData(p => ({ ...p, type: e.target.value }))} />
        <Textarea placeholder="Description" value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} className="md:col-span-3" />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" onClick={handleSave} variant="success">Save Table</Button>
      </div>
    </div>
  );
}
