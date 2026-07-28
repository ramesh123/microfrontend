import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Pencil, Trash2, Calendar, ArrowLeft, Plus } from 'lucide-react';
import { toast } from 'sonner';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getSchedulers, deleteScheduler, type SchedulerData } from '@/controllers/API/schedulerApi';
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';

const SCAN_TYPE_LABELS: Record<string, string> = {
  run_workflow: 'Execute Workflow',
  run_recon: 'Run Recon',
  get_feed_status: 'Get Feed Status',
  monitor_feed_path: 'Monitor Feed Path',
};

const SCHEDULER_TYPE_LABELS: Record<string, string> = {
  every_15_mins: 'Every 15 Minutes',
  daily: 'Daily',
  hourly: 'Hourly',
  weekly: 'Weekly',
  days_in_a_month: 'Days In A Month',
  yearly: 'Yearly',
};

const SchedulersListPage: React.FC = () => {
  const navigate = useNavigate();
  const [schedulers, setSchedulers] = useState<SchedulerData[]>([]);
  const [schedulerToDelete, setSchedulerToDelete] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    loadSchedulers();
  }, []);

  const loadSchedulers = async () => {
    try {
      setIsLoading(true);
      setHasError(false);
      const response = await getSchedulers();
      setSchedulers(response.data || []);
    } catch (error: any) {
      console.error('Failed to load schedulers:', error);
      setHasError(true);
      setSchedulers([]);
      // Don't show red error toast - just show gray no data state
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (scheduler: SchedulerData) => {
    navigate(`/scheduler/edit/${scheduler.id}`, {
      state: {
        flowId: Array.isArray(scheduler.workflow) ? scheduler.workflow[0] : scheduler.workflow,
        flowName: scheduler.name,
        schedulerId: scheduler.id,
      },
    });
  };

  const handleDelete = (id: string) => {
    setSchedulerToDelete(id);
  };

  const confirmDelete = async () => {
    if (schedulerToDelete) {
      try {
        await deleteScheduler(schedulerToDelete);
        toast.success('Scheduler deleted successfully');
        setSchedulerToDelete(null);
        // Reload schedulers after deletion
        loadSchedulers();
      } catch (error) {
        console.error('Failed to delete scheduler:', error);
        toast.error(getDisplayErrorMessage(error, 'Failed to delete scheduler'));
      }
    }
  };

  const getSchedulerDetails = (scheduler: SchedulerData): string => {
    const settings = scheduler.settings || {};
    const schedulerType = scheduler.scheduler;

    switch (schedulerType) {
      case 'every_15_mins':
        return 'Every 15 minutes';
      case 'daily':
        return `Daily at ${settings.time || '00:00'}`;
      case 'hourly':
        return `Every ${settings.hourly || 1} hour(s)`;
      case 'weekly':
        const weekDays = Array.isArray(settings.week_days) ? settings.week_days : [];
        const weekly = Array.isArray(settings.weekly) ? settings.weekly : [];
        return `Week ${weekly.join(', ') || '1'}, ${weekDays.map((d: string) => d.substring(0, 3)).join(', ') || '-'}`;
      case 'days_in_a_month':
        const daysArray = Array.isArray(settings.days) ? settings.days : [];
        return `Days: ${daysArray.join(', ') || '-'} at ${settings.time || '00:00'}`;
      case 'yearly':
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthsArray = Array.isArray(settings.months) ? settings.months.map((m: string) => months[parseInt(m) - 1]) : [];
        const yearlyDays = Array.isArray(settings.days) ? settings.days : [];
        return `${monthsArray.join(', ')} ${yearlyDays.join(', ')} at ${settings.time || '00:00'}`;
      default:
        return '-';
    }
  };

  return (  
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-2 py-2">
          <div className="flex items-center gap-3">
           
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <h1 className="text-[16px] font-bold">Schedulers ({schedulers.length})</h1>
              <Button
                size="icon"
                variant="outline"
                className="h-[1.7rem] w-[1.7rem] bg-white hover:bg-gray-50"
                onClick={() => navigate('/scheduler/create')}
                title="Add Scheduler"
              >
                <Plus className="h-4 w-4 text-primary" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-0 py-1 max-w-7xl">
        {isLoading ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
              <p className="text-sm text-muted-foreground">Loading schedulers...</p>
            </CardContent>
          </Card>
        ) : schedulers.length === 0 ? ( 
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar className="h-12 w-12 text-gray-400 mb-3" />
              <h3 className="text-[16px] font-semibold mb-2 text-gray-500">
                {hasError ? 'No Data Available' : 'No Schedulers Found'}
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                {hasError
                  ? 'Unable to load schedulers at this time.'
                  : 'Create a scheduler by clicking the "Scheduler" option in the actions menu of any workflow run.'}
              </p>
              {!hasError && (
                <Button onClick={() => navigate('/reconciliation/operations')} className="!h-8">
                  Go to Workflows
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (  
          <Card className='gap-1'>
            <CardHeader className="flex flex-row items-center space-y-0">              
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead className="h-9">Name</TableHead>
                      <TableHead className="h-9">Flow</TableHead>
                      <TableHead className="h-9">Scan Type</TableHead>
                      <TableHead className="h-9">Schedule</TableHead>
                      <TableHead className="h-9">Details</TableHead>
                      <TableHead className="h-9">Status</TableHead>
                      <TableHead className="h-9">Created</TableHead>
                      <TableHead className="h-9 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schedulers.map((scheduler) => (
                      <TableRow key={scheduler.id}>
                        <TableCell className="font-medium py-2">{scheduler.name}</TableCell>
                        <TableCell className="py-2">
                          <div className="max-w-[200px] truncate" title={scheduler.name}>
                            {Array.isArray(scheduler.workflow)
                              ? `${scheduler.workflow.length} workflow(s)`
                              : scheduler.workflow || '-'}
                          </div>
                        </TableCell>
                        <TableCell className="py-2">
                          {SCAN_TYPE_LABELS[scheduler.scan_type] || scheduler.scan_type || '-'}
                        </TableCell>
                        <TableCell className="py-2">
                          {SCHEDULER_TYPE_LABELS[scheduler.scheduler] || scheduler.scheduler || '-'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground py-2">
                          {getSchedulerDetails(scheduler)}
                        </TableCell>
                        <TableCell className="py-2">
                          <Badge variant={scheduler.is_active ? 'default' : 'secondary'} className="text-xs">
                            {scheduler.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground py-2">
                          {format(new Date(scheduler.created_at), 'dd MMM yyyy')}
                        </TableCell>
                        <TableCell className="text-right py-2">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleEdit(scheduler)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(scheduler.id.toString())}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

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
    </div>
  );
};

export default SchedulersListPage;
