import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { AlternativeSelect } from '@/components/ui/alternative-select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';

interface ExecuteWorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExecute: (params: ExecuteParams) => void;
  isExecuting?: boolean;
}

export interface ExecuteParams {
  stmtdate: string;
  process_cycle: string;
  exec_number: string;
}

const processCycleOptions = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Quarterly', value: 'quarterly' },
  { label: 'Yearly', value: 'yearly' },
];

const execNumberOptions = [
  { label: '1', value: '1' },
  { label: '2', value: '2' },
  { label: '3', value: '3' },
  { label: '4', value: '4' },
  { label: '5', value: '5' },
  { label: '6', value: '6' },
  { label: '7', value: '7' },
  { label: '8', value: '8' },
  { label: '9', value: '9' },
  { label: '10', value: '10' },
];

export const ExecuteWorkflowDialog = ({
  open,
  onOpenChange,
  onExecute,
  isExecuting = false,
}: ExecuteWorkflowDialogProps) => {
  const [date, setDate] = useState<Date>(new Date());
  const [processCycle, setProcessCycle] = useState<string>('daily');
  const [execNumber, setExecNumber] = useState<string>('1');

  const handleExecute = () => {
    const params: ExecuteParams = {
      stmtdate: format(date, 'dd-MM-yyyy'),
      process_cycle: processCycle,
      exec_number: execNumber,
    };
    onExecute(params);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Execute Workflow</DialogTitle>
          <DialogDescription>
            Configure execution parameters for this workflow run
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-4 py-4">
          {/* Statement Date */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Statement Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "w-full h-10 justify-start text-left font-normal",
                    "flex items-center rounded-md border border-neutral-300 bg-white",
                    "px-3 py-2 text-sm text-neutral-800 hover:bg-neutral-100",

                    !date && "text-neutral-500"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 text-neutral-600" />
                  {date ? format(date, "dd-MM-yyyy") : <span>Pick a date</span>}
                </button>
              </PopoverTrigger>

              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(newDate) => newDate && setDate(newDate)}
                  disabled={{ after: new Date() }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

          </div>

          {/* Process Cycle */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Process Cycle</Label>
            <AlternativeSelect
              options={processCycleOptions}
              value={processCycle}
              onChange={(val) => setProcessCycle(String(val))}
              placeholder="Select process cycle"
              allowCustomValue={true}
            />
          </div>

          {/* Exec Number */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Execution Number</Label>
            <AlternativeSelect
              options={execNumberOptions}
              value={execNumber}
              onChange={(val) => setExecNumber(String(val))}
              placeholder="Select execution number"
              allowCustomValue={true}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isExecuting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleExecute}
            disabled={isExecuting}
          >
            {isExecuting ? 'Executing...' : 'Execute'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
