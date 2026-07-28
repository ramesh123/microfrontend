import { useState } from 'react';
import { Search, Plus, Trash2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { BusinessUnit } from '../types/organization';
import { BusinessUnitForm } from './BusinessUnitForm';

interface BusinessUnitManagerProps {
  organizationName: string;
  businessUnits: BusinessUnit[];
  onBusinessUnitsChange: (businessUnits: BusinessUnit[]) => void;
}

export function BusinessUnitManager({ organizationName, businessUnits, onBusinessUnitsChange }: BusinessUnitManagerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<BusinessUnit | null>(null);

  const filteredUnits = businessUnits.filter(unit =>
    unit.businessUnitName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    unit.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAdd = () => {
    setEditingUnit(null);
    setIsFormOpen(true);
  };

  const handleEdit = (unit: BusinessUnit) => {
    setEditingUnit(unit);
    setIsFormOpen(true);
  };

  const handleDelete = (unitId: string) => {
    onBusinessUnitsChange(businessUnits.filter(unit => unit.id !== unitId));
  };

  const handleSave = (unitData: Omit<BusinessUnit, 'id'>) => {
    if (editingUnit) {
      // Update
      onBusinessUnitsChange(
        businessUnits.map(unit =>
          unit.id === editingUnit.id ? { ...editingUnit, ...unitData } : unit
        )
      );
    } else {
      // Add
      const newUnit: BusinessUnit = {
        id: `BU-${Date.now()}`,
        ...unitData,
      };
      onBusinessUnitsChange([...businessUnits, newUnit]);
    }
    setIsFormOpen(false);
  };

  if (isFormOpen) {
    return (
      <BusinessUnitForm
        onClose={() => setIsFormOpen(false)}
        onSave={handleSave}
        initialData={editingUnit}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search business units..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-background focus:border-primary"
          />
        </div>
        <Button onClick={handleAdd} variant="accent" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Business Unit
        </Button>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60 hover:bg-muted">
              <TableHead>Client Name</TableHead>
              <TableHead>Business Unit Name</TableHead>
              <TableHead>Company Code in ERP</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Address</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUnits.map((unit) => (
              <TableRow key={unit.id}>
                <TableCell className="font-medium">{organizationName}</TableCell>
                <TableCell>{unit.businessUnitName}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{unit.companyCode}</Badge>
                </TableCell>
                <TableCell>
                  <a href={`mailto:${unit.email}`} className="text-primary hover:underline">
                    {unit.email}
                  </a>
                </TableCell>
                <TableCell className="text-muted-foreground">{unit.city}, {unit.country}</TableCell>
                <TableCell className="max-w-xs truncate text-muted-foreground">{unit.address1}</TableCell>
                <TableCell>
                  <div className="flex justify-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(unit)}
                      className="text-muted-foreground hover:text-primary hover:bg-primary/10 h-8 w-8"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(unit.id)}
                      className="text-red-500 hover:text-red-600 hover:bg-red-500/10 h-8 w-8"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {filteredUnits.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>No business units found.</p>
        </div>
      )}
    </div>
  );
}
