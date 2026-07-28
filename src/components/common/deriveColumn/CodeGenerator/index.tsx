import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Copy, Check } from 'lucide-react';
import { OperationResult } from '@/types/deriveColumn';

interface CodeGeneratorProps {
  result: OperationResult | null;
}

export const CodeGenerator: React.FC<CodeGeneratorProps> = ({ result }) => {
  const [copied, setCopied] = useState(false);

  const generateJavaScriptCode = (result: OperationResult): string => {
    const params = Object.entries(result.parameters)
      .map(([key, value]) => typeof value === 'string' ? `"${value}"` : value)
      .join(', ');
    
    return `// String operation example
const inputString = "Your input string here";
const result = inputString.${result.operation}(${params});
console.log(result); // ${JSON.stringify(result.result)}`;
  };

  const generateTypeScriptCode = (result: OperationResult): string => {
    const params = Object.entries(result.parameters)
      .map(([key, value]) => typeof value === 'string' ? `"${value}"` : value)
      .join(', ');
    
    return `// TypeScript string operation example
const inputString: string = "Your input string here";
const result: ${Array.isArray(result.result) ? 'string[]' : typeof result.result} = inputString.${result.operation}(${params});
console.log(result); // ${JSON.stringify(result.result)}`;
  };

  const generateFunctionCode = (result: OperationResult): string => {
    const paramNames = Object.keys(result.parameters);
    const params = paramNames.map(name => `${name}: ${typeof result.parameters[name] === 'string' ? 'string' : 'number'}`).join(', ');
    
    return `// Reusable function
function apply${result.operation.charAt(0).toUpperCase() + result.operation.slice(1)}(
  str: string${paramNames.length > 0 ? ', ' + params : ''}
): ${Array.isArray(result.result) ? 'string[]' : typeof result.result} {
  return str.${result.operation}(${paramNames.join(', ')});
}

// Usage example
const result = apply${result.operation.charAt(0).toUpperCase() + result.operation.slice(1)}(
  "Your input string here"${Object.values(result.parameters).map(v => typeof v === 'string' ? `, "${v}"` : `, ${v}`).join('')}
);`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!result) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Code Generator</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Execute an operation to generate code</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Code Generator
          <Badge variant="secondary">Live</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="javascript" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="javascript">JavaScript</TabsTrigger>
            <TabsTrigger value="typescript">TypeScript</TabsTrigger>
            <TabsTrigger value="function">Function</TabsTrigger>
          </TabsList>
          
          <TabsContent value="javascript" className="space-y-4">
            <div className="relative">
              <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                <code>{generateJavaScriptCode(result)}</code>
              </pre>
              <Button
                size="sm"
                variant="outline"
                className="absolute top-2 right-2"
                onClick={() => copyToClipboard(generateJavaScriptCode(result))}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="typescript" className="space-y-4">
            <div className="relative">
              <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                <code>{generateTypeScriptCode(result)}</code>
              </pre>
              <Button
                size="sm"
                variant="outline"
                className="absolute top-2 right-2"
                onClick={() => copyToClipboard(generateTypeScriptCode(result))}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="function" className="space-y-4">
            <div className="relative">
              <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                <code>{generateFunctionCode(result)}</code>
              </pre>
              <Button
                size="sm"
                variant="outline"
                className="absolute top-2 right-2"
                onClick={() => copyToClipboard(generateFunctionCode(result))}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
