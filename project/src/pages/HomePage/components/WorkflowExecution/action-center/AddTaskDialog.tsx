import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { AddTaskTarget } from './types';

interface AddTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: AddTaskTarget | null;
  onSubmit: (data: {
    title: string;
    assigneeInitials: string;
    isOverdue: boolean;
    overdueTime?: string;
  }) => void;
}

function getDialogTitle(target: AddTaskTarget | null): string {
  if (!target) return 'Add task';
  if (target.type === 'quick') {
    const labels = { open: 'Open', completed: 'Completed', accepted: 'Accepted' };
    return `Add quick task — ${labels[target.category]}`;
  }
  const columnLabels = {
    pending: 'Pending',
    unmatched: 'Unmatched',
    matched: 'Matched',
    total: 'Total',
  };
  return `Add task — ${columnLabels[target.status]}`;
}

export function AddTaskDialog({ open, onOpenChange, target, onSubmit }: AddTaskDialogProps) {
  const [title, setTitle] = useState('');
  const [assigneeInitials, setAssigneeInitials] = useState('');
  const [isOverdue, setIsOverdue] = useState(false);
  const [overdueTime, setOverdueTime] = useState('1 day');

  useEffect(() => {
    if (open) {
      setTitle('');
      setAssigneeInitials('');
      setIsOverdue(false);
      setOverdueTime('1 day');
    }
  }, [open, target]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    const initials = assigneeInitials.trim().toUpperCase().slice(0, 3);
    if (!trimmedTitle || !initials) return;

    onSubmit({
      title: trimmedTitle,
      assigneeInitials: initials,
      isOverdue,
      overdueTime: isOverdue ? overdueTime.trim() || '1 day' : undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{getDialogTitle(target)}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="task-title">Title</Label>
              <Input
                id="task-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Describe the task..."
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="assignee-initials">Assignee initials</Label>
              <Input
                id="assignee-initials"
                value={assigneeInitials}
                onChange={(e) => setAssigneeInitials(e.target.value)}
                placeholder="e.g. SK"
                maxLength={3}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="overdue"
                checked={isOverdue}
                onCheckedChange={(checked) => setIsOverdue(checked === true)}
              />
              <Label htmlFor="overdue" className="font-normal cursor-pointer">
                Mark as overdue
              </Label>
            </div>
            {isOverdue && (
              <div className="grid gap-2">
                <Label htmlFor="overdue-time">Overdue by</Label>
                <Input
                  id="overdue-time"
                  value={overdueTime}
                  onChange={(e) => setOverdueTime(e.target.value)}
                  placeholder="e.g. 2 days"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim() || !assigneeInitials.trim()}>
              Add task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
