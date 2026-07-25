import React, { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Filter {
  id: string;
  name: string;
  editable: boolean;
}

interface FiltersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FiltersDialog({ open, onOpenChange }: FiltersDialogProps) {
  const [filters, setFilters] = useState<Filter[]>([]);

  const handleAddFilter = () => {
    const newFilter: Filter = {
      id: `filter-${Date.now()}`,
      name: `New Filter ${filters.length + 1}`,
      editable: true,
    };
    setFilters([...filters, newFilter]);
  };

  const handleSave = () => {
    // TODO: Implement save logic
    console.log("Saving filters:", filters);
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0" closeButtonClassName="hidden">
        <DialogHeader className="bg-[#5b7fa3] px-6 py-4 rounded-t-lg">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-white text-xl font-normal">
              Filters
            </DialogTitle>
            <button
              onClick={() => onOpenChange(false)}
              className="text-white hover:bg-white/10 rounded p-1 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </DialogHeader>

        <div className="px-6 py-4">
          {/* Table Header */}
          <div className="grid grid-cols-2 gap-4 pb-3 border-b border-gray-200">
            <div className="text-sm font-medium text-gray-600">Filter</div>
            <div className="text-sm font-medium text-gray-600">Editable</div>
          </div>

          {/* Table Content */}
          <div className="min-h-[200px] max-h-[400px] overflow-y-auto">
            {filters.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-gray-400">
                No filters added yet
              </div>
            ) : (
              <div className="divide-y">
                {filters.map((filter) => (
                  <div
                    key={filter.id}
                    className="grid grid-cols-2 gap-4 py-3"
                  >
                    <div className="text-sm">{filter.name}</div>
                    <div className="text-sm">
                      {filter.editable ? "Yes" : "No"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200 mt-4">
            <Button
              type="button"
              onClick={handleAddFilter}
              className="bg-[#4a6a8a] hover:bg-[#3d5a75]"
            >
              Add filter
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={handleCancel}
                className="text-[#5b7fa3] hover:bg-gray-100"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                className="bg-gray-200 text-gray-700 hover:bg-gray-300"
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
