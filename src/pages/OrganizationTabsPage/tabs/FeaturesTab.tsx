import { useState, useMemo } from 'react';
import { Search, Plus, Trash2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Organization, Feature } from '../types/organization';
import { FeatureForm } from '../components/FeatureForm';

interface FeaturesTabProps {
  organizations: Organization[];
  onUpdateOrganizations: (orgs: Organization[]) => void;
}

export function FeaturesTab({ organizations, onUpdateOrganizations }: FeaturesTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingFeature, setEditingFeature] = useState<{ feature: Feature; orgId: string; appId: string } | null>(null);

  const allFeatures = useMemo(() => organizations.flatMap(org =>
    org.applications.flatMap(app =>
      app.features.map(feat => ({
        ...feat,
        orgId: org.orgId,
        orgName: org.organisationName,
        appId: app.id,
        appName: app.name,
      }))
    )
  ), [organizations]);

  const filteredFeatures = useMemo(() => allFeatures.filter(feat =>
    feat.name.toLowerCase().includes(searchTerm.toLowerCase())
  ), [allFeatures, searchTerm]);

  const handleAdd = () => {
    setEditingFeature(null);
    setIsFormOpen(true);
  };

  const handleEdit = (feature: Feature, orgId: string, appId: string) => {
    setEditingFeature({ feature, orgId, appId });
    setIsFormOpen(true);
  };

  const handleDelete = (featureId: string, orgId: string, appId: string) => {
    const updatedOrgs = organizations.map(org => {
      if (org.orgId === orgId) {
        const updatedApps = org.applications.map(app => {
          if (app.id === appId) {
            return { ...app, features: app.features.filter(f => f.id !== featureId) };
          }
          return app;
        });
        return { ...org, applications: updatedApps };
      }
      return org;
    });
    onUpdateOrganizations(updatedOrgs);
  };

  const handleSave = (featureData: Omit<Feature, 'id'>, orgId: string, appId: string) => {
    const updatedOrgs = organizations.map(org => {
      if (org.orgId === orgId) {
        const updatedApps = org.applications.map(app => {
          if (app.id === appId) {
            if (editingFeature) { // Update
              const updatedFeats = app.features.map(f => f.id === editingFeature.feature.id ? { ...editingFeature.feature, ...featureData } : f);
              return { ...app, features: updatedFeats };
            } else { // Add
              const newFeature: Feature = { id: `F-${Date.now()}`, ...featureData };
              return { ...app, features: [...app.features, newFeature] };
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

  if (isFormOpen) {
    return (
      <FeatureForm
        onClose={() => setIsFormOpen(false)}
        onSave={handleSave}
        initialData={editingFeature}
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
            placeholder="Search features..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
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
              <TableHead>Feature Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Application</TableHead>
              <TableHead>Organization</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredFeatures.map((feature) => (
              <TableRow key={feature.id}>
                <TableCell className="font-medium">{feature.name}</TableCell>
                <TableCell className="max-w-xs truncate">{feature.description}</TableCell>
                <TableCell>{feature.appName}</TableCell>
                <TableCell>{feature.orgName}</TableCell>
                <TableCell>
                  <div className="flex justify-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(feature, feature.orgId, feature.appId)} className="text-muted-foreground hover:text-primary hover:bg-primary/10 h-8 w-8">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(feature.id, feature.orgId, feature.appId)} className="text-red-500 hover:text-red-600 hover:bg-red-500/10 h-8 w-8">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {filteredFeatures.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>No features found.</p>
        </div>
      )}
    </div>
  );
}
