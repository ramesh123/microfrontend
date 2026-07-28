import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Combobox } from '@/components/ui/comboboxV2';
import { TemplateField } from '@/types/dataset';
import { checkFieldDependencies } from '@/utils/formDependencyUtils';

export interface ConnectionConfig {
  // Additional hardcoded fields
  tdate?: string;
  tmonth?: string;
  date_folder_pattern?: string;
  date_folder_date?: string;
  date_folder_month?: string;
  move_input_to_process?: boolean;
  remote_process_path?: string;
  // Dynamic fields from template
  [key: string]: any;
}

interface ConnectionConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionType: 'sftp' | 'amazon_s3';
  initialConfig?: ConnectionConfig;
  onSave: (config: ConnectionConfig) => void;
  templateFields?: TemplateField[];
  dynamicOptions?: Record<string, any[]>;
  loadingFields?: Record<string, boolean>;
  onFieldChange?: (fieldKey: string, value: any) => void;
  formValues?: Record<string, any>; // Current form values to check dependencies
}

export const ConnectionConfigDialog = ({
  open,
  onOpenChange,
  connectionType,
  initialConfig,
  onSave,
  templateFields = [],
  dynamicOptions = {},
  loadingFields = {},
  onFieldChange,
  formValues = {},
}: ConnectionConfigDialogProps) => {
  const [config, setConfig] = useState<ConnectionConfig>(initialConfig || {});

  const title = connectionType === 'sftp' ? 'SFTP Configuration' : 'Amazon S3 Configuration';

  // Filter template fields that should appear in this dialog
  // These are fields with type dependency AND sftp/amazon_s3 value
  // Also check if the field is actually visible based on current form values
  const dialogFields = templateFields.filter(field => {
    const hasTypeDependency = field.depends_key?.includes('type');
    const dependsValueArray = Array.isArray(field.depends_value) ? field.depends_value : [];
    const hasSftpOrS3Value = dependsValueArray.some((val: string) =>
      val === 'sftp' || val === 'amazon_s3'
    );

    if (!hasTypeDependency || !hasSftpOrS3Value) {
      return false;
    }

    // Check if field is visible based on current form values (including mode)
    const fieldForCheck = {
      ...field,
      depends_key: field.depends_key || field.depends_on
    };

    // Merge formValues with current config for dependency checking
    const currentValues = { ...formValues, ...config };
    const isVisible = checkFieldDependencies(fieldForCheck, currentValues);

    return isVisible;
  });

  useEffect(() => {
    if (open && initialConfig) {
      const updatedConfig = { ...initialConfig };
      dialogFields.forEach(field => {
        if (field.type === 'number') {
          const val = updatedConfig[field.key];
          if (val === undefined || val === null || val === '') {
            updatedConfig[field.key] = 0;
          }
        }
      });
      setConfig(updatedConfig);
    }
  }, [open, initialConfig, dialogFields]);

  const handleSave = () => {
    const updatedConfig = { ...config };
    dialogFields.forEach(field => {
      if (field.type === 'number') {
        const val = updatedConfig[field.key];
        if (val === undefined || val === null || val === '') {
          updatedConfig[field.key] = 0;
        }
      }
    });
    onSave(updatedConfig);
    onOpenChange(false);
  };

  const handleFieldChange = (field: string, value: string | boolean | number) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    onFieldChange?.(field, value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Configure additional settings for {connectionType === 'sftp' ? 'SFTP' : 'Amazon S3'} connection
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 py-4">
            {/* Dynamic fields from template */}
            {dialogFields.map((field) => {
              const options = dynamicOptions[field.key] || field.options || [];
              const isLoading = loadingFields[field.key] || false;
              const currentValue = config[field.key];

              return (
                <div key={field.key} className="space-y-2">
                  <Label className="text-xs font-medium">
                    {field.display_name}
                    {field.required && <span className="text-destructive">*</span>}
                  </Label>
                  {field.type === 'number' ? (
                    <Input
                      type="number"
                      className="h-9 text-xs px-2"
                      placeholder={field.placeholder}
                      value={currentValue !== undefined && currentValue !== null ? String(currentValue) : '0'}
                      onChange={(e) => {
                        const val = e.target.value === '' ? '' : Number(e.target.value);
                        handleFieldChange(field.key, val);
                      }}
                    />
                  ) : field.type === 'text' ? (
                    <Input
                      className="h-9 text-xs px-2"
                      placeholder={field.placeholder}
                      value={currentValue ?? ''}
                      onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    />
                  ) : field.type === 'dropdown' ? (
                    <Combobox
                      options={options}
                      value={currentValue ?? ''}
                      onChange={(v) => handleFieldChange(field.key, v)}
                      placeholder={field.placeholder}
                      isLoading={isLoading}
                    />
                  ) : null}
                </div>
              );
            })}

            {/* Hardcoded additional fields */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">T+Date</Label>
              <Input
                className="h-9 text-xs px-2"
                placeholder="Enter T+Date"
                value={config.tdate ?? ''}
                onChange={(e) => handleFieldChange('tdate', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">T+Month</Label>
              <Input
                className="h-9 text-xs px-2"
                placeholder="Enter T+Month"
                value={config.tmonth ?? ''}
                onChange={(e) => handleFieldChange('tmonth', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">Date Folder Pattern</Label>
              <Input
                className="h-9 text-xs px-2"
                placeholder="Enter Date Folder Pattern"
                value={config.date_folder_pattern ?? ''}
                onChange={(e) => handleFieldChange('date_folder_pattern', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">Date Folder+Date</Label>
              <Input
                className="h-9 text-xs px-2"
                placeholder="Enter Date Folder+Date"
                value={config.date_folder_date ?? ''}
                onChange={(e) => handleFieldChange('date_folder_date', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">Date Folder+Month</Label>
              <Input
                className="h-9 text-xs px-2"
                placeholder="Enter Date Folder+Month"
                value={config.date_folder_month ?? ''}
                onChange={(e) => handleFieldChange('date_folder_month', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border border-gray-300 focus:ring-2"
                  checked={!!config.move_input_to_process}
                  onChange={(e) => handleFieldChange('move_input_to_process', e.target.checked)}
                />
                Move Input File To Process
              </Label>
            </div>

            {config.move_input_to_process && (
              <div className="space-y-2 col-span-2">
                <Label className="text-xs font-medium">Remote Process Path</Label>
                <Input
                  className="h-9 text-xs px-2"
                  placeholder="Enter Remote Process Path"
                  value={config.remote_process_path ?? ''}
                  onChange={(e) => handleFieldChange('remote_process_path', e.target.value)}
                />
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="h-8 px-3 text-xs">
            Cancel
          </Button>
          <Button onClick={handleSave} className="h-8 px-3 text-xs">
            Save Configuration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
