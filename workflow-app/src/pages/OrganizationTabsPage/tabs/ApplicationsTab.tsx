import { useState } from 'react';
import { Search, Plus, Eye, Trash2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Organization, Application } from '../types/organization';
import { ApplicationEditor } from '../application/ApplicationEditor';

interface ApplicationsTabProps {
  organizations: Organization[];
  onUpdateOrganizations: (orgs: Organization[]) => void;
}

export function ApplicationsTab({ organizations, onUpdateOrganizations }: ApplicationsTabProps) { 
  const [searchTerm, setSearchTerm] = useState('');
  const [viewState, setViewState] = useState<'list' | 'edit'>('list');
  const [editingAppContext, setEditingAppContext] = useState<{ app: Application; orgId: string } | null>(null);

  const allApplications = organizations.flatMap(org => 
    org.applications.map(app => ({ ...app, orgId: org.orgId, orgName: org.organisationName }))
  );

  const filteredApps = allApplications.filter(app =>
    app.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    app.orgName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAdd = () => {
    setEditingAppContext(null);
    setViewState('edit');
  };

  const handleViewOrEdit = (app: Application, orgId: string) => {
    setEditingAppContext({ app, orgId });
    setViewState('edit');
  };

  const handleDelete = (appId: string, orgId: string) => {
    const updatedOrgs = organizations.map(org => {
      if (org.orgId === orgId) {
        return { ...org, applications: org.applications.filter(app => app.id !== appId) };
      }
      return org;
    });
    onUpdateOrganizations(updatedOrgs);
  };

  const handleSave = (appData: Application, orgId: string) => {
    const updatedOrgs = organizations.map(org => {
      if (org.orgId === orgId) {
        if (editingAppContext) { // Update
          return {
            ...org,
            applications: org.applications.map(a => a.id === appData.id ? appData : a),
          };
        } else { // Add
          return { ...org, applications: [...org.applications, appData] };
        }
      }
      return org;
    });
    onUpdateOrganizations(updatedOrgs);
    setViewState('list');
  };

  if (viewState === 'edit') {
    return (
      <ApplicationEditor
        initialData={editingAppContext}
        organizations={organizations}
        onSave={handleSave}
        onClose={() => setViewState('list')}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-full sm:w-60">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input placeholder="Search applications..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
            <Select><SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Select Module" /></SelectTrigger><SelectContent><SelectItem value="finance">Finance</SelectItem></SelectContent></Select>
            <Select><SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Select Sub-Module" /></SelectTrigger><SelectContent><SelectItem value="invoicing">Invoicing</SelectItem></SelectContent></Select>
        </div>
        <Button onClick={handleAdd} variant="accent" size="sm" className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Add Application
        </Button>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60 hover:bg-muted">
              <TableHead>App ID</TableHead>
              <TableHead>Application Name</TableHead>
              <TableHead>Organization</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredApps.map((app) => (
              <TableRow key={app.id}>
                <TableCell><Badge variant="secondary">{app.id}</Badge></TableCell>
                <TableCell className="font-medium">{app.name}</TableCell>
                <TableCell>{app.orgName}</TableCell>
                <TableCell className="max-w-xs truncate">{app.description}</TableCell>
                <TableCell>
                  <div className="flex justify-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleViewOrEdit(app, app.orgId)} className="text-muted-foreground hover:text-primary hover:bg-primary/10 h-8 w-8"><Eye className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleViewOrEdit(app, app.orgId)} className="text-muted-foreground hover:text-primary hover:bg-primary/10 h-8 w-8"><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(app.id, app.orgId)} className="text-red-500 hover:text-red-600 hover:bg-red-500/10 h-8 w-8"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {filteredApps.length === 0 && (
        <div className="text-center py-12 text-muted-foreground"><p>No applications found.</p></div>
      )}
    </div>
  );
}
