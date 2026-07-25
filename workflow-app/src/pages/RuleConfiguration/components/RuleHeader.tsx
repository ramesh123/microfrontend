import React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Save, Plus } from 'lucide-react';

interface RuleHeaderProps {
  onAddRule: () => void;
  onSave: () => void;
  isSaving: boolean;
}

export const RuleHeader: React.FC<RuleHeaderProps> = ({
  onAddRule,
  onSave,
  isSaving,
}) => {
  return (
    <div className="flex items-center justify-between p-3 border-b bg-background flex-wrap gap-2">
      <h2 className="text-lg font-semibold text-foreground">
        Manage Validation Rule
      </h2>
      <div className="flex items-center gap-2">
        <Button 
          size="sm" 
          className="bg-foreground text-background hover:bg-foreground/90" 
          onClick={onAddRule}
        >
          <Plus className="mr-2 h-4 w-4" /> Add Match Rule
        </Button>
        <Button 
          size="sm" 
          onClick={onSave} 
          disabled={isSaving} 
          className="bg-foreground text-background hover:bg-foreground/90"
        >
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save
        </Button>
      </div>
    </div>
  );
};

