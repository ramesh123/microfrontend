import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Copy, Check } from 'lucide-react';
import { Column } from '@/types/deriveColumn';

interface CustomColumnsJsonViewerProps {
  columns: Column[];
}

export const CustomColumnsJsonViewer: React.FC<CustomColumnsJsonViewerProps> = ({ columns }) => {
  const [copied, setCopied] = useState(false);

  const customColumns = useMemo(() => 
    columns.filter(col => col.id.startsWith('custom-')), 
    [columns]
  );

  const formattedJson = useMemo(() => 
    JSON.stringify(customColumns, null, 2), 
    [customColumns]
  );

  const copyToClipboard = () => {
    navigator.clipboard.writeText(formattedJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Custom Columns (JSON)</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col">
        {customColumns.length === 0 ? (
          <div className="flex-grow flex items-center justify-center">
            <p className="text-muted-foreground text-center">
              Add a custom column to see its JSON data here.
            </p>
          </div>
        ) : (
          <div className="relative flex-grow">
            <ScrollArea className="absolute inset-0 h-full w-full">
              <pre className="bg-muted p-4 rounded-lg text-sm">
                <code>{formattedJson}</code>
              </pre>
            </ScrollArea>
            <Button
              size="sm"
              variant="outline"
              className="absolute top-2 right-2"
              onClick={copyToClipboard}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
