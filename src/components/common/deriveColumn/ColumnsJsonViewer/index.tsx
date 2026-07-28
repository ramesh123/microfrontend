import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Copy, Check } from 'lucide-react';

interface Column {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean';
  sampleData: string[];
}

interface ColumnsJsonViewerProps {
  columns: Column[];
}

export const ColumnsJsonViewer: React.FC<ColumnsJsonViewerProps> = ({ columns }) => {
  const [copied, setCopied] = useState(false);

  const formattedJson = JSON.stringify(columns, null, 2);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(formattedJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Available Columns (JSON)</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col">
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
      </CardContent>
    </Card>
  );
};
