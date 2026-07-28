import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, Folder, Layers, Eye, CheckCircle, XCircle } from 'lucide-react';
import { Project, Template, User } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { projectTypes } from '@/data/masterMockData';

interface TreeViewProps {
  projects: Project[];
  templates: Template[];
  users: User[];
  onUseTemplate: (templateId: string) => void;
  searchTerm: string;
  selectedCategory: string | null;
}

const TemplateNode = ({ template, onUseTemplate }: { template: Template; onUseTemplate: (templateId: string) => void; }) => {
  return (
    <div className="group flex items-center gap-4 pl-12 pr-4 py-2 rounded-md hover:bg-muted/50 transition-colors">
      <div className="flex-1 flex items-center gap-3">
        <Layers className="h-5 w-5 text-muted-foreground" />
        <div className="flex-1">
          <p className="font-medium text-sm truncate text-left">{template.name}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{template.category}</span>
          </div>
        </div>
      </div>
      <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => onUseTemplate(template.id)}>
        <Eye className="h-4 w-4" />
        Use Template
      </Button>
    </div>
  );
};

export default function TreeView({ projects, templates, users, onUseTemplate, searchTerm, selectedCategory }: TreeViewProps) {
  return (
    <Card className="gap-3 py-4">
      <CardHeader>
        <CardTitle>Project Explorer</CardTitle>
        <CardDescription>Browse your projects and their templates.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="space-y-1">
          {projects.map((project: any) => {
            const projectTemplates = templates.filter(t => {
              if (t.projectId !== project.id) return false;
              const matchesCategory = !selectedCategory || t.category === selectedCategory;
              const matchesSearch = searchTerm === '' || t.name.toLowerCase().includes(searchTerm.toLowerCase());
              return matchesCategory && matchesSearch;
            });

            if (projectTemplates.length === 0 && (searchTerm || selectedCategory)) {
              return null;
            }

            const owner = users.find(u => u.id === project.ownerId);
            const statusConfig = project.status === 'enabled'
              ? { text: 'Enabled', icon: CheckCircle, className: 'text-green-600 bg-green-100' }
              : { text: 'Disabled', icon: XCircle, className: 'text-gray-600 bg-gray-100' };
            const projectTypeInfo = projectTypes.find(pt => pt.id === project.projectType);

            return (
              <Collapsible key={project.id} className="border-b last:border-b-0" defaultOpen>
                <CollapsibleTrigger asChild>
                  <div className="group flex items-center gap-4 px-4 py-3 rounded-md hover:bg-muted/50 transition-colors cursor-pointer">
                    <div className="flex-1 flex items-center gap-3">
                      <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-90" />
                      <Folder className="h-5 w-5 text-primary" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-base">{project.name}</span>
                          {projectTypeInfo && <Badge variant="outline">{projectTypeInfo.name}</Badge>}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          {owner && (
                            <div className="flex items-center gap-2">
                              <Avatar className="h-4 w-4">
                                <AvatarImage src={owner.avatar} alt={owner.name} />
                                <AvatarFallback>{owner.name.charAt(0)}</AvatarFallback>
                              </Avatar>
                              <span>{owner.name}</span>
                            </div>
                          )}
                          {owner && <span>•</span>}
                          <span>Created {formatDistanceToNow(new Date(project.createdAt), { addSuffix: true })}</span>
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className={`text-xs ${statusConfig.className}`}>
                      <statusConfig.icon className="mr-1 h-3 w-3" />
                      {statusConfig.text}
                    </Badge>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="py-2 space-y-1">
                    {projectTemplates.length > 0 ? (
                      projectTemplates.map(template => (
                        <TemplateNode key={template.id} template={template} onUseTemplate={onUseTemplate} />
                      ))
                    ) : (
                      <p className="pl-12 py-2 text-sm text-muted-foreground">No templates found for this project.</p>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
