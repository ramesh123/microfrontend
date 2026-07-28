import { useState, useMemo } from 'react';
import { Search, Plus, Trash2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Organization, Integration } from '../types/organization';
import { IntegrationForm } from '../components/IntegrationForm';

interface IntegrationsTabProps {
  organizations: Organization[];
  onUpdateOrganizations: (orgs: Organization[]) => void;
}

export function IntegrationsTab({ organizations, onUpdateOrganizations }: IntegrationsTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<{ integration: Integration; orgId: string } | null>(null);

  const allIntegrations = useMemo(() => organizations.flatMap(org => 
    (org.integrations || []).map(integration => ({ ...integration, orgId: org.orgId, orgName: org.organisationName }))
  ), [organizations]);

  const filteredIntegrations = useMemo(() => allIntegrations.filter(integration =>
    integration.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    integration.source.toLowerCase().includes(searchTerm.toLowerCase()) ||
    integration.target.toLowerCase().includes(searchTerm.toLowerCase())
  ), [allIntegrations, searchTerm]);

  const handleAdd = () => {
    setEditingIntegration(null);
    setIsFormOpen(true);
  };

  const handleEdit = (integration: Integration, orgId: string) => {
    setEditingIntegration({ integration, orgId });
    setIsFormOpen(true);
  };

  const handleDelete = (integrationId: string, orgId: string) => {
    const updatedOrgs = organizations.map(org => {
      if (org.orgId === orgId) {
        return {
          ...org,
          integrations: (org.integrations || []).filter(i => i.id !== integrationId),
        };
      }
      return org;
    });
    onUpdateOrganizations(updatedOrgs);
  };

  const handleSave = (integrationData: Omit<Integration, 'id'>, orgId: string) => {
    const updatedOrgs = organizations.map(org => {
      if (org.orgId === orgId) {
        if (editingIntegration) { // Update
          return {
            ...org,
            integrations: (org.integrations || []).map(i => i.id === editingIntegration.integration.id ? { ...editingIntegration.integration, ...integrationData } : i),
          };
        } else { // Add
          const newIntegration: Integration = { id: `INTID-${Date.now()}`, ...integrationData };
          return { ...org, integrations: [...(org.integrations || []), newIntegration] };
        }
      }
      return org;
    });
    onUpdateOrganizations(updatedOrgs);
    setIsFormOpen(false);
  };

  if (isFormOpen) {
    return (
      <IntegrationForm
        onClose={() => setIsFormOpen(false)}
        onSave={handleSave}
        initialData={editingIntegration}
        organizations={organizations}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search integrations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-background focus:border-primary"
          />
        </div>
        <Button onClick={handleAdd} variant="accent" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add
        </Button>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60 hover:bg-muted">
              <TableHead>#ID</TableHead>
              <TableHead>Integration Name</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Integration Mode</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredIntegrations.map((integration) => (
              <TableRow key={integration.id}>
                <TableCell>
                  <Badge variant="secondary">{integration.id}</Badge>
                </TableCell>
                <TableCell className="font-medium">{integration.name}</TableCell>
                <TableCell>{integration.source}</TableCell>
                <TableCell>{integration.target}</TableCell>
                <TableCell>{integration.mode}</TableCell>
                <TableCell>
                  <div className="flex justify-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(integration, integration.orgId)}
                      className="text-muted-foreground hover:text-primary hover:bg-primary/10 h-8 w-8"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(integration.id, integration.orgId)}
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

      {filteredIntegrations.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>No integrations found.</p>
        </div>
      )}
    </div>
  );
}
