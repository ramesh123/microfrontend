import { useState } from 'react';
import { Search, Plus, Eye, Trash2, Building2, Filter, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Organization } from '../types/organization';
import { AddOrganisationForm } from '../components/AddOrganisationForm';

interface OrgDetailsTabProps {
  organizations: Organization[];
  onUpdateOrganizations: (orgs: Organization[]) => void;
}

export function OrgDetailsTab({ organizations, onUpdateOrganizations }: OrgDetailsTabProps) {   

  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingOrganization, setEditingOrganization] = useState<Organization | null>(null);

  const filteredOrganizations = organizations.filter(org =>
    org.organisationName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.orgId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = (orgId: string) => { 
    onUpdateOrganizations(organizations.filter(org => org.orgId !== orgId));
  };

  const handleView = (orgId: string) => {  
    const orgToView = organizations.find(org => org.orgId === orgId);
    if (orgToView) { 
      setEditingOrganization(orgToView);
      setShowAddForm(true);
    }
  };

  const handleAddOrganisation = () => {  
    setEditingOrganization(null);
    setShowAddForm(true);
  };

  const handleSaveOrganisation = (updatedOrgData: Omit<Organization, 'orgId' | 'location'>, isNew: boolean) => {
    if (isNew) { 
      const newOrganization: Organization = { 
        ...updatedOrgData,
        orgId: `CLID-${Date.now()}`,
        location: `${updatedOrgData.city}, ${updatedOrgData.state}, ${updatedOrgData.country}`,
        businessUnits: [],
        businessProcesses: [],
        projects: [],
        applications: [],
      };
      onUpdateOrganizations([...organizations, newOrganization]);
    } else {   
      onUpdateOrganizations( 
        organizations.map(org =>  
          org.orgId === editingOrganization?.orgId
            ? { 
                ...org,
                ...updatedOrgData,
                location: `${updatedOrgData.city}, ${updatedOrgData.state}, ${updatedOrgData.country}`,
              }
            : org
        )
      );
    }
    setShowAddForm(false);
    setEditingOrganization(null);
  };

  const handleBackFromForm = () => {
    setShowAddForm(false);
    setEditingOrganization(null);
  };

  if (showAddForm) { 
    return (
      <AddOrganisationForm
        onBack={handleBackFromForm}
        onSave={handleSaveOrganisation}
        initialData={editingOrganization}
      />
    );
  }

  return (  
    <div className="space-y-4">
      {/* Enhanced Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-foreground">Organization Directory</h2>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
              {filteredOrganizations.length} Organizations
            </Badge>
          </div>
        </div>
      </div>

      {/* Enhanced Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-3 bg-muted/60 rounded-xl border">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search organizations, IDs, or emails..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-background focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <Button 
            variant="outline" 
            size="sm"
            className="bg-background hover:bg-secondary"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            className="bg-background hover:bg-secondary"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button 
            onClick={handleAddOrganisation}
            variant="accent"
            size="sm"
            className="whitespace-nowrap"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Organization
          </Button>
        </div>
      </div>

      {/* Enhanced Organizations Table */}
      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60 hover:bg-muted border-b">
              <TableHead className="font-semibold text-foreground">Organization ID</TableHead>
              <TableHead className="font-semibold text-foreground">Organization Name</TableHead>
              <TableHead className="font-semibold text-foreground">Company ID</TableHead>
              <TableHead className="font-semibold text-foreground">Email</TableHead>
              <TableHead className="font-semibold text-foreground">Location</TableHead>
              <TableHead className="font-semibold text-foreground">Address</TableHead>
              <TableHead className="font-semibold text-foreground text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrganizations.map((org) => (
              <TableRow 
                key={org.orgId} 
                className="hover:bg-muted/50 border-border/30 transition-all duration-200"
              >
                <TableCell>
                  <Badge variant="outline" className="font-mono text-xs bg-primary/10 text-primary border-primary/30">
                    {org.orgId}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium text-foreground">{org.organisationName}</TableCell>
                <TableCell>
                  {org.companyId ? (
                    <Badge variant="secondary" className="text-xs">
                      {org.companyId}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">Not Set</span>
                  )}
                </TableCell>
                <TableCell>
                  <a 
                    href={`mailto:${org.email}`}
                    className="text-primary hover:text-primary/80 transition-colors text-sm underline-offset-4 hover:underline"
                  >
                    {org.email}
                  </a>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{org.location}</TableCell>
                <TableCell className="max-w-xs truncate text-muted-foreground text-sm" title={org.address1}>
                  {org.address1}
                </TableCell>
                <TableCell>
                  <div className="flex justify-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleView(org.orgId)}
                      className="text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all h-8 w-8"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(org.orgId)}
                      className="text-red-500 hover:text-red-600 hover:bg-red-500/10 transition-all h-8 w-8"
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

      {filteredOrganizations.length === 0 && (
        <div className="text-center py-12 space-y-3">
          <div className="p-4 bg-primary/10 rounded-2xl w-20 h-20 mx-auto flex items-center justify-center">
            <Search className="h-10 w-10 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-1">No Organizations Found</h3>
            <p className="text-muted-foreground max-w-md mx-auto text-sm">
              {searchTerm 
                ? `Your search for "${searchTerm}" did not return any results.`
                : "Get started by adding your first organization to the directory."
              }
            </p>
          </div>
          {!searchTerm && (
            <div className="pt-2">
              <Button 
                onClick={handleAddOrganisation}
                variant="accent"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Organization
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
