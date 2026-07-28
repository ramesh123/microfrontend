import { Download, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function GrabberTab() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-foreground">Grabber</h2>
        <Button variant="accent" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Grabber
        </Button>
      </div>
      
      <div className="text-center py-12 text-muted-foreground bg-card rounded-lg border border-dashed border-border">
        <Download className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
        <p className="font-medium">No Grabbers Found</p>
        <p className="text-sm max-w-md mx-auto">Set up data grabbers for automated information collection.</p>
      </div>
    </div>
  );
}
