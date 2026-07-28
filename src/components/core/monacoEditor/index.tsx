import React from 'react';
import Editor, { OnChange } from '@monaco-editor/react';
import { useTheme } from '@/context/theme'
import Spinner from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

interface MonacoEditorProps {
  value?: string;
  onChange?: OnChange;
  language?: string;
  className?: string;
  readOnly?: boolean;
}

const MonacoEditor: React.FC<MonacoEditorProps> = ({
  value,
  onChange,
  language = 'sql',
  className,
  readOnly = false,
}) => {
  const { theme } = useTheme();
  const editorTheme = theme === 'dark' || theme === 'blue-dark-g' ? 'vs-dark' : 'light';

  return (
    <div className={cn("rounded-md border border-input overflow-hidden h-64 w-full", className)}>
      <Editor
        height="100%"
        language={language}
        value={value}
        onChange={onChange}
        theme={editorTheme}
        loading={<Spinner />}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          wordWrap: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          readOnly,
          domReadOnly: readOnly,
          padding: {
            top: 10,
          },
        }}
      />
    </div>
  );
};

export default MonacoEditor;
