import { Workflow, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function BusinessProcessTab() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-foreground">Business Process</h2>
        <Button variant="accent" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Process
        </Button>
      </div>
      
      <div className="text-center py-12 text-muted-foreground bg-card rounded-lg border border-dashed border-border">
        <Workflow className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
        <p className="font-medium">No Business Processes Found</p>
        <p className="text-sm max-w-md mx-auto">Configure your business processes to streamline operations.</p>
      </div>
    </div>
  );
}
