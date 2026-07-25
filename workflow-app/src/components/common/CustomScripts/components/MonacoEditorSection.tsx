import React from 'react';
import Editor from '@monaco-editor/react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Code2, Sun, Moon } from 'lucide-react';
import Spinner from '@/components/ui/spinner';
import { MonacoEditorSectionProps } from '../types';

/**
 * MonacoEditorSection Component
 *
 * Displays a read-only Monaco editor with Python syntax highlighting
 * and theme toggle functionality (VS Dark / VS Light).
 */
const MonacoEditorSection: React.FC<MonacoEditorSectionProps> = ({
  code,
  theme,
  onThemeChange,
}) => {
  return (
    <div className="flex flex-col h-full">
      {/* Editor Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b">
        <div className="flex items-center gap-2">
          <Code2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground">Python Preview</span>
        </div>

        {/* Theme Selector */}
        <Select value={theme} onValueChange={(val) => onThemeChange(val as 'vs-dark' | 'light')}>
          <SelectTrigger className="h-7 w-32 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="vs-dark">
              <div className="flex items-center gap-2">
                <Moon className="h-3 w-3" />
                VS Dark
              </div>
            </SelectItem>
            <SelectItem value="light">
              <div className="flex items-center gap-2">
                <Sun className="h-3 w-3" />
                VS Light
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Monaco Editor */}
      <div className="flex-1 overflow-hidden">
        <Editor
          height="100%"
          language="python"
          value={code}
          theme={theme}
          loading={
            <div className="flex items-center justify-center h-full">
              <Spinner />
            </div>
          }
          options={{
            readOnly: true,
            minimap: { enabled: false },
            fontSize: 13,
            wordWrap: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            lineNumbers: 'on',
            padding: { top: 12, bottom: 12 },
            scrollbar: {
              vertical: 'auto',
              horizontal: 'auto',
            },
            contextmenu: false,
            renderLineHighlight: 'none',
          }}
        />
      </div>
    </div>
  );
};

export default MonacoEditorSection;
