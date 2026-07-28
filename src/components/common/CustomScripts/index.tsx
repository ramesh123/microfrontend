import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Code2, Plus, Trash2, Sun, Moon, Save, FileCode } from 'lucide-react';
import Editor from '@monaco-editor/react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Spinner from '@/components/ui/spinner';
import useFlowStore from '@/stores/flowStore';
import { saveNodeDetailsApi } from '@/controllers/API';
import { toast } from 'sonner';
import { ApiRequestError, getDisplayErrorMessage } from '@/utils/exceptionHelper';

interface ParameterPair {
  key: string;
  value: string;
}

/**
 * CustomScripts Component - Redesigned
 * - No initial data (empty form)
 * - Scrollable within sheet
 * - Fill button to populate editor
 * - Save Node button
 */
function CustomScripts() {
  const currentNode = useFlowStore((state) => state.getSelectedNode());

  // Form state - start empty
  const [moduleName, setModuleName] = useState('');
  const [className, setClassName] = useState('');
  const [functionName, setFunctionName] = useState('');
  const [classParameters, setClassParameters] = useState<ParameterPair[]>([]);
  const [functionParameters, setFunctionParameters] = useState<ParameterPair[]>([]);
  const [editorTheme, setEditorTheme] = useState<'vs-dark' | 'light'>('vs-dark');
  const [editorCode, setEditorCode] = useState('# Configure the form and click "Fill" to generate Python code');
  const [isSaving, setIsSaving] = useState(false);

  // Helper to clean template placeholders
  const cleanValue = (val: any, defaultVal: string = ''): string => {
    if (!val) return defaultVal;
    if (typeof val === 'string' && val.startsWith('{{') && val.endsWith('}}')) {
      return defaultVal;
    }
    return String(val);
  };

  // Initialize from saved node data only
  useEffect(() => {
    if (!currentNode?.data?.node) return;

    const payload = currentNode.data.node.payload || {};

    // Only load if data was previously saved
    const savedModuleName = cleanValue(payload.module_name);
    const savedClassName = cleanValue(payload.class_name);
    const savedFunctionName = cleanValue(payload.function_name);

    if (savedModuleName) setModuleName(savedModuleName);
    if (savedClassName) setClassName(savedClassName);
    if (savedFunctionName) setFunctionName(savedFunctionName);

    // Load saved parameters
    const classParamValue = payload.class_parameter;
    if (Array.isArray(classParamValue) && classParamValue.length > 0) {
      if (classParamValue[0]?.key !== undefined && classParamValue[0]?.value !== undefined) {
        setClassParameters(classParamValue);
      }
    }

    const funcParamValue = payload.function_parameter;
    if (Array.isArray(funcParamValue) && funcParamValue.length > 0) {
      if (funcParamValue[0]?.key !== undefined && funcParamValue[0]?.value !== undefined) {
        setFunctionParameters(funcParamValue);
      }
    }

    // Load saved editor code from custom_script_data field
    if (payload.custom_script_data) {
      const savedCode = cleanValue(payload.custom_script_data);
      if (savedCode) {
        setEditorCode(savedCode);
      }
    }
  }, [currentNode?.id]);

  // Parameter management
  const addClassParameter = () => {
    setClassParameters([...classParameters, { key: '', value: '' }]);
  };

  const removeClassParameter = (index: number) => {
    setClassParameters(classParameters.filter((_, i) => i !== index));
  };

  const updateClassParameter = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...classParameters];
    updated[index] = { ...updated[index], [field]: value };
    setClassParameters(updated);
  };

  const addFunctionParameter = () => {
    setFunctionParameters([...functionParameters, { key: '', value: '' }]);
  };

  const removeFunctionParameter = (index: number) => {
    setFunctionParameters(functionParameters.filter((_, i) => i !== index));
  };

  const updateFunctionParameter = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...functionParameters];
    updated[index] = { ...updated[index], [field]: value };
    setFunctionParameters(updated);
  };

  // Generate Python code
  const generatePythonCode = useCallback(() => {
    if (!moduleName && !className && !functionName) {
      return '# Configure the form and click "Fill" to generate Python code\n';
    }

    let code = '';

    if (moduleName) {
      code += `# module: ${moduleName}\n\n`;
    }

    if (className) {
      const classParamKeys = classParameters.filter(p => p.key).map(p => p.key).join(', ');
      const functionParamKeys = functionParameters.filter(p => p.key).map(p => p.key).join(', ');

      code += `class ${className}:\n`;
      code += `    def __init__(self${classParamKeys ? ', ' + classParamKeys : ''}):\n`;

      if (classParameters.length > 0 && classParameters.some(p => p.key)) {
        classParameters.forEach(param => {
          if (param.key) {
            code += `        self.${param.key} = ${param.key}\n`;
          }
        });
      } else {
        code += `        pass\n`;
      }

      if (functionName) {
        code += `\n    def ${functionName}(self${functionParamKeys ? ', ' + functionParamKeys : ''}):\n`;
        code += `        # TODO: Implement ${functionName}\n`;
        code += `        pass\n`;
      }
    } else if (functionName) {
      const functionParamKeys = functionParameters.filter(p => p.key).map(p => p.key).join(', ');
      code += `def ${functionName}(${functionParamKeys}):\n`;
      code += `    # TODO: Implement ${functionName}\n`;
      code += `    pass\n`;
    }

    // Usage example
    if (moduleName && className && functionName) {
      code += `\n\n# Usage example:\n`;
      code += `# from ${moduleName} import ${className}\n`;

      const classParamExample = classParameters
        .filter(p => p.key && p.value)
        .map(p => `${p.key}=${JSON.stringify(p.value)}`)
        .join(', ');

      const functionParamExample = functionParameters
        .filter(p => p.key && p.value)
        .map(p => `${p.key}=${JSON.stringify(p.value)}`)
        .join(', ');

      code += `# obj = ${className}(${classParamExample})\n`;
      code += `# obj.${functionName}(${functionParamExample})\n`;
    }

    return code;
  }, [moduleName, className, functionName, classParameters, functionParameters]);

  // Fill button handler
  const handleFill = () => {
    const code = generatePythonCode();
    setEditorCode(code);
    toast.success('Python code generated successfully');
  };

  // Save Node handler
  const handleSaveNode = async () => {
    if (!currentNode) {
      toast.error('No node selected');
      return;
    }

    setIsSaving(true);

    try {
      const updatedPayload = {
        ...currentNode.data.node.payload,
        module_name: moduleName,
        class_name: className,
        function_name: functionName,
        class_parameter: classParameters,
        function_parameter: functionParameters,
        custom_script_data: editorCode, // Save to custom_script_data field
      };

      const updatedNodeData = {
        ...currentNode.data,
        node: {
          ...currentNode.data.node,
          payload: updatedPayload,
        },
      };

      // Get current workflow and flow_id
      const currentWorkflow = useFlowStore.getState().currentWorkflow;
      const flow_id = currentWorkflow?.flow_id || '';

      // Construct payload with required fields
      const savePayload = {
        ...updatedNodeData,
        current_node_id: currentNode.id, // Add required field
        flow_id: flow_id, // Add required field
      };

      // Save to backend
      const saveEndpoint = currentNode.data.node.save_node;
      if (saveEndpoint) {
        const response = await saveNodeDetailsApi(saveEndpoint, savePayload);
        useFlowStore.getState().updateNodeData(currentNode.id, response);
        toast.success('Node saved successfully');
      } else {
        // Update flow store only
        useFlowStore.getState().updateNodeData(currentNode.id, updatedNodeData);
        toast.success('Node updated in store');
      }
    } catch (error) {
      console.error('Failed to save node:', error);
      if (!(error instanceof ApiRequestError)) {
        toast.error(getDisplayErrorMessage(error, 'Failed to save node configuration'));
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (!currentNode) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <Code2 className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-lg font-medium">No Custom Scripts Node Selected</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Please select a Custom Scripts node to configure it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-background">
      {/* Save Button at Top Right */}
      <div className="flex justify-end items-center p-2 border-b bg-background">
        <Button
          onClick={handleSaveNode}
          disabled={isSaving}
          size="sm"
          className="h-8 text-sm"
        >
          {isSaving ? (
            <>
              <Spinner />
              <span className="ml-1.5">Saving...</span>
            </>
          ) : (
            <>
              <Save className="h-3.5 w-3.5 mr-1.5" />
              Save Node
            </>
          )}
        </Button>
      </div>

      {/* Scrollable Form Content */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="space-y-2 max-w-full">
          {/* Module, Class, Function in Single Row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-0.5">
              <Label className="text-xs">Module Name</Label>
              <Input
                placeholder="e.g., my_module"
                value={moduleName}
                onChange={(e) => setModuleName(e.target.value)}
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-0.5">
              <Label className="text-xs">Class Name</Label>
              <Input
                placeholder="e.g., CustomScript"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-0.5">
              <Label className="text-xs">Function Name</Label>
              <Input
                placeholder="e.g., process_data"
                value={functionName}
                onChange={(e) => setFunctionName(e.target.value)}
                className="h-7 text-xs"
              />
            </div>
          </div>

          {/* Class Parameters and Function Parameters - Side by Side */}
          <div className="grid grid-cols-2 gap-2">
            {/* Class Parameters - Left Column */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs font-semibold">Class Parameters</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={addClassParameter}
                  className="h-5 px-1.5 text-xs"
                >
                  <Plus className="h-3 w-3 mr-0.5" />
                  Add
                </Button>
              </div>
              <div className="max-h-28 overflow-y-auto border rounded-md p-1.5 bg-muted/20">
                {classParameters.length === 0 ? (
                  <div className="text-xs text-muted-foreground italic py-1.5 text-center">
                    No parameters
                  </div>
                ) : (
                  <div className="space-y-1">
                    {classParameters.map((param, index) => (
                      <div key={index} className="flex items-center gap-1">
                        <Input
                          placeholder="Key"
                          value={param.key}
                          onChange={(e) => updateClassParameter(index, 'key', e.target.value)}
                          className="h-6 text-xs flex-1"
                        />
                        <Input
                          placeholder="Value"
                          value={param.value}
                          onChange={(e) => updateClassParameter(index, 'value', e.target.value)}
                          className="h-6 text-xs flex-1"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeClassParameter(index)}
                          className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Function Parameters - Right Column */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs font-semibold">Function Parameters</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={addFunctionParameter}
                  className="h-5 px-1.5 text-xs"
                >
                  <Plus className="h-3 w-3 mr-0.5" />
                  Add
                </Button>
              </div>
              <div className="max-h-28 overflow-y-auto border rounded-md p-1.5 bg-muted/20">
                {functionParameters.length === 0 ? (
                  <div className="text-xs text-muted-foreground italic py-1.5 text-center">
                    No parameters
                  </div>
                ) : (
                  <div className="space-y-1">
                    {functionParameters.map((param, index) => (
                      <div key={index} className="flex items-center gap-1">
                        <Input
                          placeholder="Key"
                          value={param.key}
                          onChange={(e) => updateFunctionParameter(index, 'key', e.target.value)}
                          className="h-6 text-xs flex-1"
                        />
                        <Input
                          placeholder="Value"
                          value={param.value}
                          onChange={(e) => updateFunctionParameter(index, 'value', e.target.value)}
                          className="h-6 text-xs flex-1"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFunctionParameter(index)}
                          className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Fill Button */}
          <div className="flex justify-end pt-1">
            <Button
              onClick={handleFill}
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
            >
              <FileCode className="h-3 w-3 mr-1" />
              Fill Editor
            </Button>
          </div>

          {/* Python Preview Editor */}
          <div className="border rounded-lg overflow-hidden mt-1">
            <div className="flex items-center justify-between px-2 py-1.5 bg-muted/50 border-b">
              <div className="flex items-center gap-1.5">
                <Code2 className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground">Python Preview</span>
              </div>
              <Select value={editorTheme} onValueChange={(val) => setEditorTheme(val as 'vs-dark' | 'light')}>
                <SelectTrigger className="h-6 w-28 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vs-dark">
                    <div className="flex items-center gap-1.5">
                      <Moon className="h-3 w-3" />
                      VS Dark
                    </div>
                  </SelectItem>
                  <SelectItem value="light">
                    <div className="flex items-center gap-1.5">
                      <Sun className="h-3 w-3" />
                      VS Light
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="h-96">
              <Editor
                height="100%"
                defaultLanguage="python"
                language="python"
                value={editorCode}
                onChange={(value) => setEditorCode(value || '')}
                theme={editorTheme}
                loading={
                  <div className="flex items-center justify-center h-full">
                    <Spinner />
                  </div>
                }
                options={{
                  readOnly: false,
                  minimap: { enabled: false },
                  fontSize: 14,
                  wordWrap: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  lineNumbers: 'on',
                  padding: { top: 16, bottom: 16 },
                  scrollbar: {
                    vertical: 'visible',
                    horizontal: 'visible',
                    verticalScrollbarSize: 10,
                    horizontalScrollbarSize: 10,
                  },
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CustomScripts;
