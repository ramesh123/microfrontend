import React, { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Plus, Filter, Database, Zap, Edit, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

import SetNewColumn from './SetNewColumn';
import ConditionalNewColumn from './ConditionalNewColumn';
import ConditionalFilters from './ConditionalFilters';
import FilterList, { FilterOption } from './FilterList';

const FilterCreation: React.FC = () => {
  const [activeTab, setActiveTab] = useState('new-column');
  const [filters, setFilters] = useState<FilterOption[]>([]);
  const [editingFilter, setEditingFilter] = useState<FilterOption | null>(null);
  const [newFilter, setNewFilter] = useState({
    name: '',
    condition: '',
    value: '',
  });
  
  // Track original values to detect changes
  const originalEditingValues = useRef<{ name: string; condition: string; value: string } | null>(null);
  const { toast } = useToast();

  const hasUnsavedChanges = () => {
    if (!editingFilter || !originalEditingValues.current) return false;
    
    return (
      newFilter.name !== originalEditingValues.current.name ||
      newFilter.condition !== originalEditingValues.current.condition ||
      newFilter.value !== originalEditingValues.current.value
    );
  };

  const handleAddFilter = () => {
    if (newFilter.name.trim()) {
      if (editingFilter) {
        // Update existing filter
        const updatedFilter: FilterOption = {
          ...editingFilter,
          name: newFilter.name.trim(),
          type: activeTab,
          condition: newFilter.condition,
          value: newFilter.value,
        };
        setFilters(filters.map(filter => 
          filter.id === editingFilter.id ? updatedFilter : filter
        ));
        setEditingFilter(null);
        originalEditingValues.current = null;
        
        toast({
          title: "Filter Updated",
          description: `Filter "${updatedFilter.name}" has been successfully updated.`,
        });
      } else {
        // Add new filter
        const filter: FilterOption = {
          id: Date.now().toString(),
          name: newFilter.name.trim(),
          type: activeTab,
          condition: newFilter.condition,
          value: newFilter.value,
        };
        setFilters([...filters, filter]);
        
        toast({
          title: "Filter Created",
          description: `Filter "${filter.name}" has been successfully created.`,
        });
      }
      console.log(filters);
      setNewFilter({ name: '', condition: '', value: '' });
    }
  };

  const handleRemoveFilter = (id: string) => {
    const filterToRemove = filters.find(f => f.id === id);
    setFilters(filters.filter(filter => filter.id !== id));
    
    // Clear editing state if the edited filter is being removed
    if (editingFilter && editingFilter.id === id) {
      setEditingFilter(null);
      originalEditingValues.current = null;
      setNewFilter({ name: '', condition: '', value: '' });
    }
    
    if (filterToRemove) {
      toast({
        title: "Filter Deleted",
        description: `Filter "${filterToRemove.name}" has been removed.`,
      });
    }
  };

  const handleEditFilter = (filter: FilterOption) => {
    // Check if there are unsaved changes
    if (editingFilter && hasUnsavedChanges()) {
      toast({
        title: "Unsaved Changes",
        description: "Please save or cancel your current changes before editing another filter.",
        variant: "destructive",
      });
      return;
    }

    setEditingFilter(filter);
    setActiveTab(filter.type);
    const newValues = {
      name: filter.name,
      condition: filter.condition || '',
      value: filter.value || '',
    };
    setNewFilter(newValues);
    
    // Store original values for comparison
    originalEditingValues.current = { ...newValues };
  };

  const handleCancelEdit = () => {
    setEditingFilter(null);
    originalEditingValues.current = null;
    setNewFilter({ name: '', condition: '', value: '' });
    
    toast({
      title: "Edit Cancelled",
      description: "Changes have been discarded.",
    });
  };
  
  const handleNameChange = useCallback((value: string) => {
    setNewFilter(prev => ({ ...prev, name: value }));
  }, []);

  const handleConditionChange = useCallback((value: string) => {
      setNewFilter(prev => ({ ...prev, condition: value }));
  }, []);

  const handleValueChange = useCallback((value: string) => {
      setNewFilter(prev => ({ ...prev, value: value }));
  }, []);

  const isFormValid = () => {
    switch (activeTab) {
      case 'new-column':
        return newFilter.name.trim() && newFilter.condition;
      case 'conditional-column':
        return newFilter.name.trim() && newFilter.condition && newFilter.value.trim();
      case 'conditional-filters':
        return newFilter.name.trim() && newFilter.condition;
      default:
        return false;
    }
  };

  return (
    <div className="p-2 sm:p-4 dark:bg-primary-900">
      <div className="mx-auto max-w-7xl space-y-4">
        {/* Header */}
        <div className="text-left space-y-2">
          {/* <div className="inline-flex items-center justify-center w-12 h-12 bg-primary rounded-full mb-2">
            <Filter className="h-6 w-6 text-primary-foreground" />
          </div> */}
          <h1 className="text-xl font-bold tracking-tight light:text-slate-900 dark:text-primary-50">
            Custom Filter Creator
          </h1>
          {/* <p className="text-sm text-slate-600 max-w-2xl mx-auto light:text-slate-600 dark:text-slate-400">
            Create powerful custom filters with our intuitive interface. Choose from three different filter types to transform your data.
          </p> */}
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          {/* Filter Creation Panel */}
          <div className="lg:col-span-2">
            <Card className="shadow-lg border-0 backdrop-blur-sm">
              <CardHeader className="pb-2 px-4 pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {editingFilter ? (
                        <>
                          <Edit className="h-5 w-5 text-blue-600" />
                          Edit Filter
                        </>
                      ) : (
                        <>
                          <Plus className="h-5 w-5 text-primary" />
                          Create New Filter
                        </>
                      )}
                    </CardTitle>
                    <CardDescription className="text-sm light:text-slate-600 dark:text-slate-400">
                      {editingFilter 
                        ? 'Modify your existing filter configuration' 
                        : 'Choose your filter type and configure the parameters below'
                      }
                    </CardDescription>
                  </div>
                  {editingFilter && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCancelEdit}
                      className="text-slate-500 hover:text-slate-700 h-8"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  )}
                </div>
                {editingFilter && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mt-2">
                    <p className="text-xs text-blue-800 light:text-blue-600 dark:text-blue-400">
                      <span className="font-medium">Editing:</span> {editingFilter.name}
                      {hasUnsavedChanges() && (
                        <span className="ml-2 text-amber-600 font-medium">• Unsaved changes</span>
                      )}
                    </p>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-4 px-4 pb-4">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-3 h-8 dark:bg-slate-900">
                    <TabsTrigger 
                      value="new-column" 
                      className="data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs px-2"
                    >
                      <Database className="h-3 w-3 mr-1" />
                      New Column
                    </TabsTrigger>
                    <TabsTrigger 
                      value="conditional-column"
                      className="data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs px-2"
                    >
                      <Zap className="h-3 w-3 mr-1" />
                      Conditional Column
                    </TabsTrigger>
                    <TabsTrigger 
                      value="conditional-filters"
                      className="data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs px-2"
                    >
                      <Filter className="h-3 w-3 mr-1" />
                      Conditional Filters
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="new-column" className="mt-4">
                    <SetNewColumn
                      name={newFilter.name}
                      condition={newFilter.condition}
                      value={newFilter.value}
                      onNameChange={handleNameChange}
                      onConditionChange={handleConditionChange}
                      onValueChange={handleValueChange}
                    />
                  </TabsContent>

                  <TabsContent value="conditional-column" className="mt-4">
                    <ConditionalNewColumn
                      name={newFilter.name}
                      condition={newFilter.condition}
                      value={newFilter.value}
                      onNameChange={handleNameChange}
                      onConditionChange={handleConditionChange}
                      onValueChange={handleValueChange}
                      isEditing={!!editingFilter}
                    />
                  </TabsContent>

                  <TabsContent value="conditional-filters" className="mt-4">
                    <ConditionalFilters
                      name={newFilter.name}
                      condition={newFilter.condition}
                      value={newFilter.value}
                      onNameChange={handleNameChange}
                      onConditionChange={handleConditionChange}
                      onValueChange={handleValueChange}
                    />
                  </TabsContent>
                </Tabs>

                <Separator />

                <div className="flex justify-end gap-2">
                  {editingFilter && (
                    <Button 
                      variant="outline"
                      onClick={handleCancelEdit}
                      className="px-4 h-8 text-xs"
                    >
                      Cancel
                    </Button>
                  )}
                  <Button 
                    onClick={handleAddFilter} 
                    className="px-4 h-8 text-xs"
                    disabled={!isFormValid()}
                  >
                    {editingFilter ? (
                      <>
                        <Edit className="h-3 w-3 mr-1" />
                        Update Filter
                      </>
                    ) : (
                      <>
                        <Plus className="h-3 w-3 mr-1" />
                        Add Filter
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Active Filters Panel */}
          <div className="lg:col-span-1">
            <FilterList 
              filters={filters}
              onRemoveFilter={handleRemoveFilter}
              onEditFilter={handleEditFilter}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilterCreation;
