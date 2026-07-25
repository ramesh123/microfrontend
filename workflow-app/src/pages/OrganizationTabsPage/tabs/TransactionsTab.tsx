import { useState, useMemo } from 'react';
import { Search, Plus, Edit, Trash2, Home, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Organization, Transaction, TransactionTable } from '../types/organization';
import { Pagination, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, PaginationContent } from '@/components/ui/pagination';
import { Combobox } from '@/components/ui/combobox';
import { Textarea } from '@/components/ui/textarea';
import { TransactionTableManager } from '../transaction/TransactionTableManager';
import { TransactionFieldManager } from '../transaction/TransactionFieldManager';
import { toast } from 'sonner';

interface TransactionsTabProps {
  organizations: Organization[];
  onUpdateOrganizations: (orgs: Organization[]) => void;
}

type EnrichedTransaction = Transaction & { orgId: string; orgName: string; appId: string; appName: string; };

const ITEMS_PER_PAGE = 10;

export function TransactionsTab({ organizations, onUpdateOrganizations }: TransactionsTabProps) { 
  const [searchTerm, setSearchTerm] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [subModuleFilter, setSubModuleFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<{ tx: Transaction; orgId: string; appId: string } | null>(null);
  
  const [viewingTransaction, setViewingTransaction] = useState<EnrichedTransaction | null>(null);
  const [viewingTable, setViewingTable] = useState<TransactionTable | null>(null);

  const allTransactions = useMemo(() => organizations.flatMap(org =>
    org.applications.flatMap(app =>
      app.transactions.map(tx => ({
        ...tx,
        orgId: org.orgId,
        orgName: org.organisationName,
        appId: app.id,
        appName: app.name,
      }))
    )
  ), [organizations]);

  const filteredTransactions = useMemo(() => allTransactions.filter(tx =>
    tx.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tx.code.toLowerCase().includes(searchTerm.toLowerCase())
  ), [allTransactions, searchTerm]);

  const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE);
  const paginatedTransactions = filteredTransactions.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleAdd = () => {
    setEditingTx(null);
    setIsFormOpen(true);
  };

  const handleEdit = (tx: Transaction, orgId: string, appId: string) => {
    setEditingTx({ tx, orgId, appId });
    setIsFormOpen(true);
  };

  const handleSave = (txData: Omit<Transaction, 'id' | 'tables'>, orgId: string, appId: string) => {
    const updatedOrgs = organizations.map(org => {
      if (org.orgId === orgId) {
        const updatedApps = org.applications.map(app => {
          if (app.id === appId) {
            if (editingTx) { // Update
              const updatedTxs = app.transactions.map(t => t.id === editingTx.tx.id ? { ...editingTx.tx, ...txData } : t);
              return { ...app, transactions: updatedTxs };
            } else { // Add
              const newTx: Transaction = { id: `TX-${Date.now()}`, ...txData, tables: [] };
              return { ...app, transactions: [...app.transactions, newTx] };
            }
          }
          return app;
        });
        return { ...org, applications: updatedApps };
      }
      return org;
    });
    onUpdateOrganizations(updatedOrgs);
    setIsFormOpen(false);
  };
  
  const handleDelete = (txId: string, orgId: string, appId: string) => {
    const updatedOrgs = organizations.map(org => {
        if (org.orgId === orgId) {
            const updatedApps = org.applications.map(app => {
                if (app.id === appId) {
                    return { ...app, transactions: app.transactions.filter(tx => tx.id !== txId) };
                }
                return app;
            });
            return { ...org, applications: updatedApps };
        }
        return org;
    });
    onUpdateOrganizations(updatedOrgs);
  };

  const handleUpdateTransaction = (updatedTx: Transaction) => {
    const updatedOrgs = organizations.map(org => {
      if (org.orgId === viewingTransaction?.orgId) {
        const updatedApps = org.applications.map(app => {
          if (app.id === viewingTransaction.appId) {
            const updatedTxs = app.transactions.map(t => t.id === updatedTx.id ? updatedTx : t);
            return { ...app, transactions: updatedTxs };
          }
          return app;
        });
        return { ...org, applications: updatedApps };
      }
      return org;
    });
    onUpdateOrganizations(updatedOrgs);
    setViewingTransaction({ ...viewingTransaction!, ...updatedTx });
  };

  if (viewingTransaction && viewingTable) {
    return <TransactionFieldManager 
              transaction={viewingTransaction}
              table={viewingTable}
              onBackToTables={() => setViewingTable(null)}
              onUpdateTable={(updatedTable) => {
                const updatedTx = {
                  ...viewingTransaction,
                  tables: viewingTransaction.tables.map(t => t.id === updatedTable.id ? updatedTable : t)
                };
                handleUpdateTransaction(updatedTx);
                setViewingTable(updatedTable);
              }}
            />
  }

  if (viewingTransaction) {
    return <TransactionTableManager 
              transaction={viewingTransaction} 
              onBack={() => setViewingTransaction(null)} 
              onUpdateTransaction={handleUpdateTransaction}
              onViewFields={(table) => setViewingTable(table)}
            />;
  }

  if (isFormOpen) {
    return <TransactionForm 
              onClose={() => setIsFormOpen(false)} 
              onSave={handleSave} 
              initialData={editingTx}
              organizations={organizations}
            />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Home className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-bold text-foreground">Transactions</h2>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-3 bg-muted/60 rounded-xl border">
        <div className="flex items-center gap-2 flex-wrap w-full">
            <div className="relative flex-grow sm:flex-grow-0 sm:w-60">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
            <div className="flex-grow sm:flex-grow-0">
                <Select value={moduleFilter} onValueChange={setModuleFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Select Module" /></SelectTrigger>
                    <SelectContent><SelectItem value="finance">Finance</SelectItem><SelectItem value="hr">HR</SelectItem></SelectContent>
                </Select>
            </div>
            <div className="flex-grow sm:flex-grow-0">
                <Select value={subModuleFilter} onValueChange={setSubModuleFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Select Sub Module" /></SelectTrigger>
                    <SelectContent><SelectItem value="invoicing">Invoicing</SelectItem></SelectContent>
                </Select>
            </div>
            <Button variant="outline" className="bg-background border-green-500/50 text-green-600 hover:bg-green-500/10 hover:text-green-700">
                <RefreshCw className="h-4 w-4 mr-2"/>
                Sync with SAP
            </Button>
        </div>
        <Button onClick={handleAdd} variant="accent" size="sm" className="w-full sm:w-auto flex-shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          Add
        </Button>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60 hover:bg-muted">
              <TableHead>Transaction</TableHead>
              <TableHead>Transaction Code</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedTransactions.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell className="font-medium">{tx.name}</TableCell>
                <TableCell>{tx.code}</TableCell>
                <TableCell className="max-w-xs truncate">{tx.description}</TableCell>
                <TableCell>
                  <div className="flex justify-center gap-1">
                    <Button variant="accent" size="sm" className="h-8 text-xs" onClick={() => setViewingTransaction(tx)}>Tables</Button>
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(tx, tx.orgId, tx.appId)} className="text-muted-foreground hover:text-primary hover:bg-primary/10 h-8 w-8"><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(tx.id, tx.orgId, tx.appId)} className="text-red-500 hover:text-red-600 hover:bg-red-500/10 h-8 w-8"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      
      <div className="flex justify-between items-center pt-2">
        <p className="text-sm text-muted-foreground">Showing {paginatedTransactions.length} of {filteredTransactions.length} transactions.</p>
        <Pagination>
          <PaginationContent>
            <PaginationItem><PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); setCurrentPage(p => Math.max(1, p - 1)); }} /></PaginationItem>
            {[...Array(totalPages)].map((_, i) => (
              <PaginationItem key={i}>
                <PaginationLink href="#" isActive={currentPage === i + 1} onClick={(e) => { e.preventDefault(); setCurrentPage(i + 1); }}>{i + 1}</PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem><PaginationNext href="#" onClick={(e) => { e.preventDefault(); setCurrentPage(p => Math.min(totalPages, p + 1)); }} /></PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}

// Inline Form for Add/Edit
function TransactionForm({ onClose, onSave, initialData, organizations }: { 
    onClose: () => void; 
    onSave: (data: Omit<Transaction, 'id' | 'tables'>, orgId: string, appId: string) => void; 
    initialData: { tx: Transaction; orgId: string; appId: string } | null;
    organizations: Organization[];
}) {
  const [formData, setFormData] = useState({ name: '', code: '', description: '' });
  const [selectedOrgId, setSelectedOrgId] = useState<string | undefined>(initialData?.orgId);
  const [selectedAppId, setSelectedAppId] = useState<string | undefined>(initialData?.appId);

  const availableApps = useMemo(() => {
    if (!selectedOrgId) return [];
    return organizations.find(o => o.orgId === selectedOrgId)?.applications || [];
  }, [selectedOrgId, organizations]);

  useState(() => {
    if (initialData) {
        setFormData({ name: initialData.tx.name, code: initialData.tx.code, description: initialData.tx.description });
    }
  });

  const handleSave = () => {
    if (!selectedOrgId || !selectedAppId || !formData.name || !formData.code) {
      toast.error('Organization, Application, Transaction Name, and Code are required.');
      return;
    }
    onSave(formData, selectedOrgId, selectedAppId);
  };

  return (
    <div className="p-4 border rounded-lg space-y-4 bg-card">
      <h3 className="font-semibold text-lg">{initialData ? 'Edit Transaction' : 'Add New Transaction'}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Combobox
            options={organizations.map(o => ({ value: o.orgId, label: o.organisationName }))}
            value={selectedOrgId || ''}
            onChange={(val) => { setSelectedOrgId(val); setSelectedAppId(undefined); }}
            placeholder="Select Organization..."
            className={initialData ? 'pointer-events-none bg-muted' : ''}
        />
        <Combobox
            options={availableApps.map(a => ({ value: a.id, label: a.name }))}
            value={selectedAppId || ''}
            onChange={setSelectedAppId}
            placeholder="Select Application..."
            className={initialData ? 'pointer-events-none bg-muted' : ''}
        />
        <Input placeholder="Transaction Name" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} />
        <Input placeholder="Transaction Code" value={formData.code} onChange={e => setFormData(p => ({ ...p, code: e.target.value }))} />
        <Textarea placeholder="Description" value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} className="md:col-span-2" />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" onClick={handleSave} variant="accent">Save Transaction</Button>
      </div>
    </div>
  );
}
