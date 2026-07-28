import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
  } from "@/components/ui/dialog";
  import { Button } from "@/components/ui/button";
import { FileText, SquareDashedMousePointerIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
  
  interface CreateWorkflowDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    // onNavigate: (page: string) => void;
  }
  
  export default function CreateWorkflowDialog({ open, onOpenChange }: CreateWorkflowDialogProps) {
    
    const navigate = useNavigate();
    const handleNavigateToTemplates = () => {
      navigate('/project/templates');
      onOpenChange(false);
    }
  
    const handleCreateFromScratch = () => {
      // This can be connected to a new page or logic for creating a blank workflow
      console.log("Creating workflow from scratch...");
      navigate('/workflows/create');
      onOpenChange(false);
    }
  
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px] p-8 md:p-12">
          <DialogHeader className="text-center mb-6">
            <DialogTitle className="text-2xl md:text-3xl font-bold">Create New Workflow</DialogTitle>
            <DialogDescription className="text-base text-muted-foreground max-w-md mx-auto">
              Boards cumulate data, design workflow into doable steps, and automate end-to-end processes in one go.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Option 1: Choose from templates */}
            <div 
              className="group p-6 border rounded-2xl text-center flex flex-col items-center justify-between hover:border-lime-500 hover:shadow-lg transition-all duration-300 cursor-pointer"
              onClick={handleNavigateToTemplates}
            >
              <div className="flex flex-col items-center flex-grow justify-center">
                <FileText className="mb-4" />
                <h3 className="font-semibold text-lg mb-2">Choose from templates</h3>
                <p className="text-muted-foreground text-sm mb-6">
                  I'd like to explore and install pre-created Board templates.
                </p>
              </div>
              <Button 
                className="w-full bg-lime-500 hover:bg-lime-600 text-lime-950 font-semibold"
              >
                Explore
              </Button>
            </div>
  
            {/* Option 2: Start from scratch */}
            <div 
              className="group p-6 border rounded-2xl text-center flex flex-col items-center justify-between hover:border-lime-500 hover:shadow-lg transition-all duration-300 cursor-pointer"
              onClick={handleCreateFromScratch}
            >
              <div className="flex flex-col items-center flex-grow justify-center">
                <SquareDashedMousePointerIcon className="mb-4" />
                <h3 className="font-semibold text-lg mb-2">Start from scratch</h3>
                <p className="text-muted-foreground text-sm mb-6">
                  I'd like to create the Board and its components myself.
                </p>
              </div>
              <Button 
                className="w-full bg-lime-500 hover:bg-lime-600 text-lime-950 font-semibold"
              >
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
  