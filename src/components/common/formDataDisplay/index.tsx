import React from 'react';
import { Button } from '@/components/ui/button';
import { FormField, FormSubmissionData } from '@/types/form';
import { cn } from '@/lib/utils';
import { FileText, Hash, CheckSquare, Braces, Mail, Pencil, Type, Database, Table2 } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { checkFieldDependencies } from '@/utils/formDependencyUtils';

interface FormDataDisplayProps {
  data: FormSubmissionData;
  title?: string;
  isDataSetNode: boolean;
  className?: string;
  onEdit: () => void;
  fields?: FormField[];
}

const FormDataDisplay: React.FC<FormDataDisplayProps> = ({
  data,
  title = 'Form Submission Data',
  className,
  onEdit,
  isDataSetNode,
  fields,
}) => {
  const isFieldVisible = (key: string) => {
    if (!fields?.length) return true;
    const field = fields.find((f) => f.key === key);
    if (!field?.depends_key) return true;
    return checkFieldDependencies(field, data);
  };
  const getIconForValue = (key: string, value: any) => {
    if (key.toLowerCase().includes('email')) return <Mail className="h-5 w-5 text-blue-500" />;
    if (typeof value === 'boolean') return <CheckSquare className="h-5 w-5 text-green-500" />;
    if (typeof value === 'number') return <Hash className="h-5 w-5 text-purple-500" />;
    if (Array.isArray(value)) return <Braces className="h-5 w-5 text-orange-500" />;
    if (typeof value === 'string' && value.length > 50) return <FileText className="h-5 w-5 text-indigo-500" />;
    return <Type className="h-5 w-5 text-gray-500" />;
  };

  const formatValue = (value: any): React.ReactNode => {
    if (typeof value === 'boolean') {
      return value ?
        <span className="font-semibold text-green-600 dark:text-green-400">Yes</span> :
        <span className="font-semibold text-red-600 dark:text-red-400">No</span>;
    }
    if (Array.isArray(value)) {
      return value.length > 0 ? value.join(', ') : <span className="text-gray-500 italic">None</span>;
    }
    if (!value) {
      return <span className="text-gray-500 ">Not provided</span>;
    }
    return String(value);
  };

  const { name, table, properties, ...rest } = data;
  const showTable = isFieldVisible('table');
  const remainingData = Object.fromEntries(
    Object.entries(rest).filter(([key]) => isFieldVisible(key)),
  );

return ( 
    <div className={cn('sticky top-8 w-full rounded-2xl border border-gray-200 dark:border-gray-700 bg-background dark:bg-gray-900 p-6 shadow-lg', className)}>
      {!isDataSetNode &&          
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">{title}</h3>
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </div>
      }
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="item-1" className="border-b-0">
          <AccordionTrigger className="rounded-lg hover:no-underline hover:bg-transparent px-4 py-3 -mx-4">
            <div className="flex items-center justify-between w-full text-left gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <Database className="h-5 w-5 text-blue-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Connection</p>
                  <p className="text-sm font-semibold text-foreground truncate">{name || 'N/A'}</p>
                </div>
              </div>
              {showTable && (
                <div className="flex items-center gap-3 min-w-0">
                  <Table2 className="h-5 w-5 text-green-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Table</p>
                    <p className="text-sm font-semibold text-foreground truncate">{table || 'N/A'}</p>
                  </div>
                </div>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="space-y-5">
              {Object.entries(remainingData).map(([key, value]) => (
                <div key={key} className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-1 bg-gray-100 dark:bg-gray-800 rounded-full p-2">
                    {getIconForValue(key, value)}
                  </div>
                  <div className="flex-grow">
                    <p className="text-xs  capitalize">
                      {key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim()}
                    </p>
                    <p className="text-sm font-medium break-words">
                      {formatValue(value)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};

export default FormDataDisplay;
