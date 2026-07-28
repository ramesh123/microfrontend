import { useState } from 'react';
import { Search, Plus, Trash2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Project, BusinessUnit, Organization } from '../types/organization';
import { ProjectForm } from './ProjectForm';
import { format } from 'date-fns';

interface ProjectManagerProps {
  organizationName: string;
  organizations: Omit<Organization, 'orgId' | 'location'>[];
  businessUnits: BusinessUnit[];
  projects: Project[];
  onProjectsChange: (projects: Project[]) => void;
}

export function ProjectManager({
  organizationName,
  organizations,
  businessUnits,
  projects,
  onProjectsChange,
}: ProjectManagerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const filteredProjects = projects.filter(
    (project) =>
      project.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.projectType.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAdd = () => {
    setEditingProject(null);
    setIsFormOpen(true);
  };

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setIsFormOpen(true);
  };

  const handleDelete = (projectId: string) => {
    onProjectsChange(projects.filter((p) => p.id !== projectId));
  };

  const handleSave = (projectData: Omit<Project, 'id'>) => {
    if (editingProject) {
      onProjectsChange(
        projects.map((p) => (p.id === editingProject.id ? { ...editingProject, ...projectData } : p))
      );
    } else {
      const newProject: Project = {
        id: `PROJ-${Date.now()}`,
        ...projectData,
      };
      onProjectsChange([...projects, newProject]);
    }
    setIsFormOpen(false);
  };

  if (isFormOpen) {
    return (
      <ProjectForm
        onClose={() => setIsFormOpen(false)}
        onSave={handleSave}
        initialData={editingProject}
        organizations={organizations}
        businessUnits={businessUnits}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-background focus:border-primary"
          />
        </div>
        <Button onClick={handleAdd} variant="accent" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Project
        </Button>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60 hover:bg-muted">
              <TableHead>Client Name</TableHead>
              <TableHead>Project Name</TableHead>
              <TableHead>Business Unit</TableHead>
              <TableHead>Project Type</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead>End Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProjects.map((project) => (
              <TableRow key={project.id}>
                <TableCell className="font-medium">{project.clientName}</TableCell>
                <TableCell>{project.projectName}</TableCell>
                <TableCell>{project.businessUnit}</TableCell>
                <TableCell>{project.projectType}</TableCell>
                <TableCell>{project.startDate ? format(project.startDate, 'PPP') : 'N/A'}</TableCell>
                <TableCell>{project.endDate ? format(project.endDate, 'PPP') : 'N/A'}</TableCell>
                <TableCell className="max-w-xs truncate text-muted-foreground">{project.description}</TableCell>
                <TableCell>
                  <div className="flex justify-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(project)}
                      className="text-muted-foreground hover:text-primary hover:bg-primary/10 h-8 w-8"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(project.id)}
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

      {filteredProjects.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>No projects found.</p>
        </div>
      )}
    </div>
  );
}
