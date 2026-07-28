import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, subDays, subMonths, startOfMonth } from 'date-fns';

export interface SchedulerFormData {
  id?: string;
  name: string;
  scanType: 'run_recon' | 'get_feed_status' | 'monitor_feed_path' | '';
  statementDate: 'current' | 'previous' | 'day_before_yesterday' | 'three_days_ago' | 'previous_month' | '';
  schedulerType: 'every_15_minutes' | 'every_day' | 'hourly' | 'weekly' | 'days_in_month' | 'yearly' | '';
  time?: string;
  hourlyInterval?: number;
  weekNumber?: number;
  weekDay?: number;
  selectedDays?: number[];
  month?: number;
  day?: number;
  emails: string[];
  active: boolean;
}

interface SchedulerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: SchedulerFormData) => void;
  initialData?: SchedulerFormData;
  flowName?: string;
}

const SCAN_TYPES = [
  { value: 'run_recon', label: 'Run Recon' },
  { value: 'get_feed_status', label: 'Get Feed Status' },
  { value: 'monitor_feed_path', label: 'Monitor Feed Path' },
];

const STATEMENT_DATES = [
  { value: 'current', label: `Current (${format(new Date(), 'dd-MM-yyyy')})` },
  { value: 'previous', label: `Previous (${format(subDays(new Date(), 1), 'dd-MM-yyyy')})` },
  { value: 'day_before_yesterday', label: `Day Before Yesterday (${format(subDays(new Date(), 2), 'dd-MM-yyyy')})` },
  { value: 'three_days_ago', label: `Three Days Ago (${format(subDays(new Date(), 3), 'dd-MM-yyyy')})` },
  { value: 'previous_month', label: `Previous Month (${format(subMonths(startOfMonth(new Date()), 1), 'MMM yyyy')})` },
];

const SCHEDULER_TYPES = [
  { value: 'every_15_minutes', label: 'Every 15 Minutes' },
  { value: 'every_day', label: 'Every Day' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'days_in_month', label: 'Days In A Month' },
  { value: 'yearly', label: 'Yearly' },
];

const WEEK_NUMBERS = [
  { value: 1, label: '1st Week' },
  { value: 2, label: '2nd Week' },
  { value: 3, label: '3rd Week' },
  { value: 4, label: '4th Week' },
  { value: 5, label: '5th Week' },
];

const WEEK_DAYS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

const SchedulerDialog: React.FC<SchedulerDialogProps> = ({
  open,
  onOpenChange,
  onSave,
  initialData,
  flowName,
}) => {
  const [formData, setFormData] = useState<SchedulerFormData>({
    name: '',
    scanType: '',
    statementDate: '',
    schedulerType: '',
    time: '00:00',
    hourlyInterval: 1,
    weekNumber: 1,
    weekDay: 1,
    selectedDays: [],
    month: 1,
    day: 1,
    emails: [''],
    active: true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showDayPicker, setShowDayPicker] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      // Reset form when opening new scheduler
      setFormData({
        name: '',
        scanType: '',
        statementDate: '',
        schedulerType: '',
        time: '00:00',
        hourlyInterval: 1,
        weekNumber: 1,
        weekDay: 1,
        selectedDays: [],
        month: 1,
        day: 1,
        emails: [''],
        active: true,
      });
    }
    setErrors({});
  }, [initialData, open]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.scanType) {
      newErrors.scanType = 'Scan type is required';
    }

    if (!formData.statementDate) {
      newErrors.statementDate = 'Statement date is required';
    }

    if (!formData.schedulerType) {
      newErrors.schedulerType = 'Scheduler type is required';
    }

    if (formData.schedulerType === 'days_in_month' && formData.selectedDays?.length === 0) {
      newErrors.selectedDays = 'Please select at least one day';
    }

    const validEmails = formData.emails.filter(email => email.trim() !== '');
    if (validEmails.length === 0) {
      newErrors.emails = 'At least one email is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validateForm()) {
      const cleanedData = {
        ...formData,
        emails: formData.emails.filter(email => email.trim() !== ''),
      };
      onSave(cleanedData);
      onOpenChange(false);
    }
  };

  const handleAddEmail = () => {
    setFormData({ ...formData, emails: [...formData.emails, ''] });
  };

  const handleRemoveEmail = (index: number) => {
    const newEmails = formData.emails.filter((_, i) => i !== index);
    setFormData({ ...formData, emails: newEmails });
  };

  const handleEmailChange = (index: number, value: string) => {
    const newEmails = [...formData.emails];
    newEmails[index] = value;
    setFormData({ ...formData, emails: newEmails });
  };

  const toggleDaySelection = (day: number) => {
    const selectedDays = formData.selectedDays || [];
    const newSelectedDays = selectedDays.includes(day)
      ? selectedDays.filter(d => d !== day)
      : [...selectedDays, day].sort((a, b) => a - b);
    setFormData({ ...formData, selectedDays: newSelectedDays });
  };

  const renderSchedulerFields = () => {
    switch (formData.schedulerType) {
      case 'every_15_minutes':
        return null; // No additional fields

      case 'every_day':
        return (
          <div className="space-y-2">
            <Label htmlFor="time">Time *</Label>
            <Input
              id="time"
              type="time"
              value={formData.time}
              onChange={(e) => setFormData({ ...formData, time: e.target.value })}
            />
          </div>
        );

      case 'hourly':
        return (
          <div className="space-y-2">
            <Label htmlFor="hourly-interval">Interval *</Label>
            <Select
              value={formData.hourlyInterval?.toString()}
              onValueChange={(value) => setFormData({ ...formData, hourlyInterval: parseInt(value) })}
            >
              <SelectTrigger id="hourly-interval">
                <SelectValue placeholder="Select interval" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }, (_, i) => i + 1).map((hour) => (
                  <SelectItem key={hour} value={hour.toString()}>
                    Every {hour} {hour === 1 ? 'hour' : 'hours'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case 'weekly':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="week-number">Week *</Label>
              <Select
                value={formData.weekNumber?.toString()}
                onValueChange={(value) => setFormData({ ...formData, weekNumber: parseInt(value) })}
              >
                <SelectTrigger id="week-number">
                  <SelectValue placeholder="Select week" />
                </SelectTrigger>
                <SelectContent>
                  {WEEK_NUMBERS.map((week) => (
                    <SelectItem key={week.value} value={week.value.toString()}>
                      {week.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="week-day">Week Day *</Label>
              <Select
                value={formData.weekDay?.toString()}
                onValueChange={(value) => setFormData({ ...formData, weekDay: parseInt(value) })}
              >
                <SelectTrigger id="week-day">
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  {WEEK_DAYS.map((day) => (
                    <SelectItem key={day.value} value={day.value.toString()}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="week-time">Time *</Label>
              <Input
                id="week-time"
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
              />
            </div>
          </>
        );

      case 'days_in_month':
        return (
          <>
            <div className="space-y-2">
              <Label>Days *</Label>
              <Popover open={showDayPicker} onOpenChange={setShowDayPicker}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !formData.selectedDays?.length && 'text-muted-foreground',
                      errors.selectedDays && 'border-destructive'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.selectedDays?.length
                      ? `${formData.selectedDays.length} day(s) selected`
                      : 'Choose Date(s)'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-4" align="start">
                  <div className="space-y-3">
                    <div className="text-sm font-medium">Choose Date(s)</div>
                    <div className="grid grid-cols-7 gap-2">
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                        <Button
                          key={day}
                          variant={formData.selectedDays?.includes(day) ? 'default' : 'outline'}
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => toggleDaySelection(day)}
                        >
                          {day}
                        </Button>
                      ))}
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowDayPicker(false)}
                      >
                        Cancel
                      </Button>
                      <Button size="sm" onClick={() => setShowDayPicker(false)}>
                        Set
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              {errors.selectedDays && (
                <p className="text-sm text-destructive">{errors.selectedDays}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="month-time">Time *</Label>
              <Input
                id="month-time"
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
              />
            </div>
          </>
        );

      case 'yearly':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="month">Months *</Label>
              <Select
                value={formData.month?.toString()}
                onValueChange={(value) => setFormData({ ...formData, month: parseInt(value) })}
              >
                <SelectTrigger id="month">
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((month) => (
                    <SelectItem key={month.value} value={month.value.toString()}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="day">Days *</Label>
              <Select
                value={formData.day?.toString()}
                onValueChange={(value) => setFormData({ ...formData, day: parseInt(value) })}
              >
                <SelectTrigger id="day">
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                    <SelectItem key={day} value={day.toString()}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="yearly-time">Time *</Label>
              <Input
                id="yearly-time"
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
              />
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Scheduler</DialogTitle>
          {flowName && (
            <p className="text-sm text-muted-foreground">Flow: {flowName}</p>
          )}
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              placeholder="Enter scheduler name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={errors.name ? 'border-destructive' : ''}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          {/* Scan Type */}
          <div className="space-y-2">
            <Label htmlFor="scan-type">Scan Type *</Label>
            <Select
              value={formData.scanType}
              onValueChange={(value: any) => setFormData({ ...formData, scanType: value })}
            >
              <SelectTrigger id="scan-type" className={errors.scanType ? 'border-destructive' : ''}>
                <SelectValue placeholder="Select scan type" />
              </SelectTrigger>
              <SelectContent>
                {SCAN_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.scanType && (
              <p className="text-sm text-destructive">{errors.scanType}</p>
            )}
          </div>

          {/* Statement Date */}
          <div className="space-y-2">
            <Label htmlFor="statement-date">Statement Date *</Label>
            <Select
              value={formData.statementDate}
              onValueChange={(value: any) => setFormData({ ...formData, statementDate: value })}
            >
              <SelectTrigger id="statement-date" className={errors.statementDate ? 'border-destructive' : ''}>
                <SelectValue placeholder="Select statement date" />
              </SelectTrigger>
              <SelectContent>
                {STATEMENT_DATES.map((date) => (
                  <SelectItem key={date.value} value={date.value}>
                    {date.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.statementDate && (
              <p className="text-sm text-destructive">{errors.statementDate}</p>
            )}
          </div>

          {/* Scheduler Type */}
          <div className="space-y-2">
            <Label htmlFor="scheduler-type">Scheduler *</Label>
            <Select
              value={formData.schedulerType}
              onValueChange={(value: any) => setFormData({ ...formData, schedulerType: value })}
            >
              <SelectTrigger id="scheduler-type" className={errors.schedulerType ? 'border-destructive' : ''}>
                <SelectValue placeholder="Select scheduler" />
              </SelectTrigger>
              <SelectContent>
                {SCHEDULER_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.schedulerType && (
              <p className="text-sm text-destructive">{errors.schedulerType}</p>
            )}
          </div>

          {/* Dynamic scheduler fields */}
          {renderSchedulerFields()}

          {/* Report Notification Emails */}
          <div className="space-y-2">
            <Label>Report Notification Emails *</Label>
            <div className="space-y-2">
              {formData.emails.map((email, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder="Enter Email Address"
                    value={email}
                    onChange={(e) => handleEmailChange(index, e.target.value)}
                    className="flex-1"
                  />
                  <div className="flex gap-1">
                    {index === formData.emails.length - 1 && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={handleAddEmail}
                        className="h-9 w-9 text-blue-500 hover:text-blue-600"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    )}
                    {formData.emails.length > 1 && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => handleRemoveEmail(index)}
                        className="h-9 w-9 text-blue-500 hover:text-blue-600"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {errors.emails && (
              <p className="text-sm text-destructive">{errors.emails}</p>
            )}
          </div>

          {/* Active Switch */}
          <div className="flex items-center justify-between py-2">
            <Label htmlFor="active">Active</Label>
            <Switch
              id="active"
              checked={formData.active}
              onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SchedulerDialog;
