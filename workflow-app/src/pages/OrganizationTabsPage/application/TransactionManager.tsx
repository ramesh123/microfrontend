import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Edit, Save, X } from 'lucide-react';
import { Transaction } from '../types/organization';
import { toast } from 'sonner';

interface TransactionManagerProps {
  transactions: Transaction[];
  onUpdate: (transactions: Transaction[]) => void;
}

export function TransactionManager({ transactions, onUpdate }: TransactionManagerProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  const handleSave = (txData: Omit<Transaction, 'id'>) => {
    if (editingTx) {
      onUpdate(transactions.map(t => t.id === editingTx.id ? { ...editingTx, ...txData } : t));
    } else {
      onUpdate([...transactions, { id: `TX-${Date.now()}`, ...txData }]);
    }
    setIsFormOpen(false);
    setEditingTx(null);
  };

  const handleDelete = (txId: string) => {
    onUpdate(transactions.filter(t => t.id !== txId));
  };

  return (
    <div className="space-y-4">
      {!isFormOpen && (
        <div className="flex justify-end">
          <Button onClick={() => { setEditingTx(null); setIsFormOpen(true); }} size="sm"><Plus className="mr-2 h-4 w-4" />Add Transaction</Button>
        </div>
      )}
      {isFormOpen && (
        <TransactionForm
          onClose={() => setIsFormOpen(false)}
          onSave={handleSave}
          initialData={editingTx}
        />
      )}
      <div className="bg-background border rounded-lg overflow-hidden">
        <Table>
          <TableHeader><TableRow><TableHead>Transaction</TableHead><TableHead>Transaction Code</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {transactions.map(tx => (
              <TableRow key={tx.id}>
                <TableCell>{tx.name}</TableCell>
                <TableCell>{tx.code}</TableCell>
                <TableCell>{tx.description}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => { setEditingTx(tx); setIsFormOpen(true); }}><Edit className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(tx.id)} className="text-red-500"><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// Inline Form Component
function TransactionForm({ onClose, onSave, initialData }: { onClose: () => void, onSave: (data: Omit<Transaction, 'id'>) => void, initialData: Transaction | null }) {
  const [formData, setFormData] = useState({ name: '', code: '', description: '' });

  useEffect(() => {
    if (initialData) setFormData(initialData);
    else setFormData({ name: '', code: '', description: '' });
  }, [initialData]);

  const handleSave = () => {
    if (!formData.name || !formData.code) {
      toast.error('Transaction Name and Code are required.');
      return;
    }
    onSave({ ...formData, tables: initialData?.tables ?? [] });
  };

  return (
    <div className="p-4 border rounded-lg space-y-3 bg-muted/50">
      <h3 className="font-semibold">{initialData ? 'Edit Transaction' : 'Add New Transaction'}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input placeholder="Transaction Name" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} />
        <Input placeholder="Transaction Code" value={formData.code} onChange={e => setFormData(p => ({ ...p, code: e.target.value }))} />
        <Textarea placeholder="Description" value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} className="md:col-span-2" />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onClose}><X className="mr-2 h-4 w-4" />Cancel</Button>
        <Button size="sm" onClick={handleSave}><Save className="mr-2 h-4 w-4" />Save</Button>
      </div>
    </div>
  );
}
