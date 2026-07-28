import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Plus } from 'lucide-react';
import { mockTemplates } from '@/data/mockData';
import TemplateCard from '../TemplateCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { allMockWorkflows } from '@/data/allWorkflows';
// import { WorkflowTable } from '../WorkflowTable';
// import { columns } from './WorkflowTable/columns';

interface LibraryPageProps {
  onOpenCreateDialog?: () => void;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export default function LibraryPage({ onOpenCreateDialog, activeTab = 'templates', onTabChange }: LibraryPageProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredTemplates = mockTemplates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = Array.from(new Set(mockTemplates.map(t => t.category)));

  return (
    <Tabs defaultValue='templates' className="w-full">
      <div className="flex items-center">
        <TabsList className="grid w-full grid-cols-2 sm:w-[400px]">
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="workflows">All Workflows</TabsTrigger>
        </TabsList>
        <div className="ml-auto">
          <Button className="h-9" onClick={onOpenCreateDialog}>
            <Plus className="w-4 h-4 mr-2" />
            New Workflow
          </Button>
        </div>
      </div>

      <TabsContent value="templates">
        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1 sm:flex-initial sm:w-64">
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
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredTemplates.length > 0 ? (
            filteredTemplates.map((template) => (
              <TemplateCard key={template.id} template={template} onUseTemplate={onOpenCreateDialog} />
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
      </TabsContent>
      <TabsContent value="workflows">
         <Card>
          <CardContent className="pt-6">
            {/* <WorkflowTable columns={columns} data={allMockWorkflows} /> */}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
