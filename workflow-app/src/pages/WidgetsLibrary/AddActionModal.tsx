// components/actions/AddActionModal.tsx

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Switch } from "@/components/ui/switch";

type AddActionModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function AddActionModal({
  open,
  onClose,
}: AddActionModalProps) {
  const [mobileView, setMobileView] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden">
        
        {/* Header */}
        <div className="bg-primary px-6 py-4">
          <DialogHeader>
            <DialogTitle className="text-white text-xl font-semibold">
              Add action
            </DialogTitle>
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">

          {/* Action Source */}
          <div className="grid grid-cols-12 items-center gap-4">
            <label className="col-span-3 text-sm font-medium">
              Action source*
            </label>

            <div className="col-span-9">
              <Select>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select action source" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="dashboard">
                    Dashboard
                  </SelectItem>

                  <SelectItem value="widget">
                    Widget
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Name */}
          <div className="grid grid-cols-12 items-center gap-4">
            <label className="col-span-3 text-sm font-medium">
              Name*
            </label>

            <div className="col-span-9">
              <Input placeholder="Set" />
            </div>
          </div>

          {/* Icon */}
          <div className="grid grid-cols-12 items-center gap-4">
            <label className="col-span-3 text-sm font-medium">
              Icon
            </label>

            <div className="col-span-9 flex gap-2">
              <Input placeholder="Select icon" />

              <Button
                type="button"
                variant="outline"
                className="px-4"
              >
                ...
              </Button>
            </div>
          </div>

          {/* Action */}
          <div className="grid grid-cols-12 items-center gap-4">
            <label className="col-span-3 text-sm font-medium">
              Action
            </label>

            <div className="col-span-9">
              <Select>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Update current dashboard state" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="update-state">
                    Update current dashboard state
                  </SelectItem>

                  <SelectItem value="navigate">
                    Navigate
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Target Dashboard */}
          <div className="grid grid-cols-12 items-center gap-4">
            <label className="col-span-3 text-sm font-medium">
              Target dashboard state
            </label>

            <div className="col-span-9">
              <Input placeholder="Target dashboard state" />
            </div>
          </div>

          {/* Switch */}
          <div className="border rounded-lg px-4 py-5 flex items-center gap-4">
            <Switch
              checked={mobileView}
              onCheckedChange={setMobileView}
            />

            <p className="text-sm">
              Open right dashboard layout (mobile view)
            </p>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
            >
              Cancel
            </Button>

            <Button>
              Add
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}