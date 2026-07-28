import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Plus } from 'lucide-react';
import { DataSource } from './types/mapping';

interface AddSourceDialogProps {
  onAddSource: (source: Omit<DataSource, 'id'>) => void;
}

export const AddSourceDialog: React.FC<AddSourceDialogProps> = ({ onAddSource }) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<'mysql' | 'postgresql' | 'sqlite' | 'mongodb'>('mysql');
  const [connectionString, setConnectionString] = useState('');

  const generateMockTables = async () => {
    const { faker } = await import('@faker-js/faker');
    const tableNames = ['users', 'products', 'orders', 'payments', 'analytics', 'logs'];
    const columnTypes = ['integer', 'varchar(255)', 'text', 'timestamp', 'decimal', 'boolean'];

    return tableNames.slice(0, faker.number.int({ min: 2, max: 4 })).map(tableName => ({
      name: tableName,
      selected: false,
      columns: Array.from({ length: faker.number.int({ min: 3, max: 6 }) }, () => ({
        name: faker.database.column(),
        type: faker.helpers.arrayElement(columnTypes),
        selected: true
      }))
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onAddSource({
      name: name.trim(),
      type,
      connected: false,
      tables: await generateMockTables()
    });

    setName('');
    setType('mysql');
    setConnectionString('');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" className="!h-8 px-3 text-sm">
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add Application
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Application</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="source-name" className="text-sm">Application Name</Label>
            <Input
              id="source-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter application name"
              required
              className="h-8 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="source-type" className="text-sm">Database Type</Label>
            <Select value={type} onValueChange={(value) => setType(value as any)}>
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mysql">MySQL</SelectItem>
                <SelectItem value="postgresql">PostgreSQL</SelectItem>
                <SelectItem value="sqlite">SQLite</SelectItem>
                <SelectItem value="mongodb">MongoDB</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="connection-string" className="text-sm">Connection String</Label>
            <Input
              id="connection-string"
              value={connectionString}
              onChange={(e) => setConnectionString(e.target.value)}
              placeholder="Enter connection string"
              type="password"
              className="h-8 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="h-8 px-3 text-sm">
              Cancel
            </Button>
            <Button type="submit" className="h-8 px-3 text-sm">Add Application</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
