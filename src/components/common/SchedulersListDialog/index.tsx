import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Pencil, Trash2, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import SchedulerDialog, { SchedulerFormData } from '@/components/common/SchedulerDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { format } from 'date-fns';

interface SchedulersListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface StoredScheduler extends SchedulerFormData {
  id: string;
  flowId: string;
  flowName: string;
  createdAt: string;
}

const SCAN_TYPE_LABELS: Record<string, string> = {
  run_recon: 'Run Recon',
  get_feed_status: 'Get Feed Status',
  monitor_feed_path: 'Monitor Feed Path',
};

const SCHEDULER_TYPE_LABELS: Record<string, string> = {
  every_15_minutes: 'Every 15 Minutes',
  every_day: 'Every Day',
  hourly: 'Hourly',
  weekly: 'Weekly',
  days_in_month: 'Days In A Month',
  yearly: 'Yearly',
};

const SchedulersListDialog: React.FC<SchedulersListDialogProps> = ({ open, onOpenChange }) => {
  const [schedulers, setSchedulers] = useState<StoredScheduler[]>([]);
  const [editingScheduler, setEditingScheduler] = useState<StoredScheduler | null>(null);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [schedulerToDelete, setSchedulerToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadSchedulers();
    }
  }, [open]);

  const loadSchedulers = () => {
    const stored = localStorage.getItem('schedulers');
    if (stored) {
      setSchedulers(JSON.parse(stored));
    }
  };

  const handleEdit = (scheduler: StoredScheduler) => {
    setEditingScheduler(scheduler);
    setOpenEditDialog(true);
  };

  const handleDelete = (id: string) => {
    setSchedulerToDelete(id);
  };

  const confirmDelete = () => {
    if (schedulerToDelete) {
      const updated = schedulers.filter((s) => s.id !== schedulerToDelete);
      localStorage.setItem('schedulers', JSON.stringify(updated));
      setSchedulers(updated);
      toast.success('Scheduler deleted successfully');
      setSchedulerToDelete(null);
    }
  };

  const handleSaveEdit = (data: SchedulerFormData) => {
    const existingSchedulers = JSON.parse(localStorage.getItem('schedulers') || '[]');
    const updatedSchedulers = existingSchedulers.map((s: StoredScheduler) =>
      s.id === data.id ? { ...s, ...data } : s
    );
    localStorage.setItem('schedulers', JSON.stringify(updatedSchedulers));
    loadSchedulers();
    setOpenEditDialog(false);
    setEditingScheduler(null);
    toast.success('Scheduler updated successfully');
  };

  const getSchedulerDetails = (scheduler: StoredScheduler): string => {
    switch (scheduler.schedulerType) {
      case 'every_15_minutes':
        return 'Every 15 minutes';
      case 'every_day':
        return `Daily at ${scheduler.time}`;
      case 'hourly':
        return `Every ${scheduler.hourlyInterval} hour(s)`;
      case 'weekly':
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return `Week ${scheduler.weekNumber}, ${days[scheduler.weekDay || 0]} at ${scheduler.time}`;
      case 'days_in_month':
        return `Days: ${scheduler.selectedDays?.join(', ')} at ${scheduler.time}`;
      case 'yearly':
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[(scheduler.month || 1) - 1]} ${scheduler.day} at ${scheduler.time}`;
      default:
        return '-';
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Scheduled Jobs ({schedulers.length})
            </DialogTitle>
          </DialogHeader>

          {schedulers.length === 0 ? ( 
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Schedulers Found</h3>
              <p className="text-sm text-muted-foreground">
                Create a scheduler by clicking the "Scheduler" option in the actions menu of any workflow run.
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Flow</TableHead>
                    <TableHead>Scan Type</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedulers.map((scheduler) => (
                    <TableRow key={scheduler.id}>
                      <TableCell className="font-medium">{scheduler.name}</TableCell>
                      <TableCell>
                        <div className="max-w-[200px] truncate" title={scheduler.flowName}>
                          {scheduler.flowName}
                        </div>
                      </TableCell>
                      <TableCell>{SCAN_TYPE_LABELS[scheduler.scanType] || scheduler.scanType}</TableCell>
                      <TableCell>
                        {SCHEDULER_TYPE_LABELS[scheduler.schedulerType] || scheduler.schedulerType}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {getSchedulerDetails(scheduler)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={scheduler.active ? 'default' : 'secondary'}>
                          {scheduler.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(scheduler.createdAt), 'dd MMM yyyy')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEdit(scheduler)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(scheduler.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Scheduler Dialog */}
      {editingScheduler && (  
        <SchedulerDialog
          open={openEditDialog}
          onOpenChange={setOpenEditDialog}
          onSave={handleSaveEdit}
          initialData={editingScheduler}
          flowName={editingScheduler.flowName}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!schedulerToDelete} onOpenChange={() => setSchedulerToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Scheduler</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this scheduler? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default SchedulersListDialog;
