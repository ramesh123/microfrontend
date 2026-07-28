import { useState, lazy, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Search } from 'lucide-react';
const TreeView = lazy(() => import('../TreeView'));
import { mockProjects, mockUsers, mockTemplates, allMockWorkflows } from '@/data/masterMockData';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import WorkflowData from '../WorkflowData';
import TemplateCard from '../TemplateCard';


export default function ProjectsAndWorkflowsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [tab, setTab] = useState('projects');

  const filteredTemplates = mockTemplates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = Array.from(new Set(mockTemplates.map(t => t.category)));


  const handleOpenCreateProject = () => {
    // onOpenCreateProject();
  };

  const handleOpenCreateWorkflowDialog = () => {
    // onOpenCreateWorkflowDialog();
  };

  return (
    <div className="space-y-1">
      <Tabs defaultValue="projects" className="w-full gap-0" onValueChange={(value) => setTab(value)}>
        <div className="flex items-center justify-between">
          <TabsList className="grid w-full grid-cols-3 sm:w-[350px]">
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="workflows">All Workflows</TabsTrigger>
          </TabsList>
          {
            tab !== 'workflows' && (
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search templates..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
                <Select onValueChange={(value) => setSelectedCategory(value === 'all' ? null : value)} defaultValue="all">
                  <SelectTrigger className="w-full sm:w-[180px] h-9">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={handleOpenCreateProject}>
                  <Plus className="h-5 w-5" />
                  New Pipeline
                </Button>
              </div>
            )}
        </div>

        <TabsContent value="projects" className="mt-2">
          <Suspense fallback={<div>Loading...</div>}>
            <TreeView
              projects={mockProjects}
              templates={mockTemplates}
              users={mockUsers}
              onUseTemplate={() => handleOpenCreateWorkflowDialog()}
              searchTerm={searchTerm}
              selectedCategory={selectedCategory}
            />
          </Suspense>
        </TabsContent>
        <TabsContent value="templates" className="mt-2">
          <Card className="py-2 gap-2">
            <CardContent className="p-0">
              {/* <WorkflowData /> */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredTemplates.length > 0 ? (
                  filteredTemplates.map((template) => (
                    <TemplateCard key={template.id} template={template} onUseTemplate={handleOpenCreateWorkflowDialog} />
                  ))
                ) : (
                  <div className="col-span-full">
                    <Card className="text-center py-12">
                      <CardContent>
                        <div className="text-gray-500">
                          <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <h3 className="text-lg font-semibold mb-2">No templates found</h3>
                          <p>Try adjusting your search or filter criteria.</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workflows" className="mt-2">
          <Card className="py-2 gap-2">
            <CardContent className="p-0">
              <WorkflowData />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
