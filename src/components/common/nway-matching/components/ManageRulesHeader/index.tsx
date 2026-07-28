import { Button } from "@/components/ui/button";
import { Loader2, Plus, Save, ArrowUpDown, Filter, MessageSquare } from "lucide-react";
import AiIcon from "@/assets/images/icons8-ai-64.png";

interface ManageRulesHeaderProps {
  onAddRule: () => void;
  onOrderRule: () => void;
  onOpenMatchCriteria: () => void;
  onOpenRuleFilters: () => void;
  onToggleRuleFilters: () => void;
  isRuleFiltersOpen: boolean;
  onSave: () => void;
  isSaving: boolean;
  mode: 'view' | 'edit';
  onOpenAiChat?: () => void;
  onToggleAiPanel?: () => void;
}

export const ManageRulesHeader = ({ onAddRule, onOrderRule, onOpenMatchCriteria, onOpenRuleFilters, onSave, isSaving, mode='edit', onOpenAiChat, onToggleAiPanel}: ManageRulesHeaderProps) => {
  return (
    <div className="flex items-center justify-between p-3 border-b bg-background flex-wrap gap-2">
      <h2 className="text-lg font-semibold text-foreground">
        Manage Matching Rule
      </h2>
      <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
        {/* AI Buttons */}
        {onOpenAiChat && onToggleAiPanel && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              onClick={onOpenAiChat}
              variant="outline"
              size="sm"
              className="border-purple-300 hover:bg-purple-50 shadow-sm flex-shrink-0"
              title="AI Chat with History"
            >
              <MessageSquare className="h-4 w-4 text-purple-600" />
            </Button>
            <Button
              onClick={onToggleAiPanel}
              variant="outline"
              size="sm"
              className="border-primary/30 hover:bg-primary/10 shadow-sm flex-shrink-0"
              title="AI N-way Match Configuration (Quick)"
            >
              <img src={AiIcon} alt="AI" className="h-4 w-4" />
            </Button>
          </div>
        )}
        <Button size="sm" className="bg-foreground flex-shrink-0" onClick={onAddRule}>
          <Plus className="mr-2 h-4 w-4" /> Add Match Rule
        </Button>
        <div className="flex items-center gap-0 border border-input rounded-md overflow-hidden flex-shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={onOpenRuleFilters}
            className="flex-shrink-0 border-0 rounded-none"
          >
            <Filter className="mr-2 h-4 w-4" /> Rule filters
          </Button>
        </div>
        {/* <Button size="sm" variant="outline" onClick={onOpenMatchCriteria} className="flex-shrink-0 whitespace-nowrap">
           Match Criteria
        </Button> */}
        <Button size="sm" variant="outline" onClick={onOrderRule} className="flex-shrink-0 whitespace-nowrap">
          <ArrowUpDown className="mr-2 h-4 w-4" /> Order Matching Rule
        </Button>
        
        <Button size="sm" onClick={onSave} disabled={isSaving || mode === 'view'}
         className="bg-foreground text-background disabled:cursor-not-allowed flex-shrink-0">
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
