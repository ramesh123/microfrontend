import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface InputStringEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export const InputStringEditor: React.FC<InputStringEditorProps> = ({ value, onChange }) => {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Input String
          <Badge variant="outline">{value.length} chars</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Label htmlFor="input-string">Enter your text to manipulate</Label>
          <Textarea
            id="input-string"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Type your string here..."
            className="min-h-[120px] resize-none"
          />
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>Characters: {value.length}</span>
            <span>Words: {value.trim().split(/\s+/).filter(Boolean).length}</span>
            <span>Lines: {value.split('\n').length}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
