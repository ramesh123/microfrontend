import { CustomScriptsNodeData } from '../types';

/**
 * Generates Python code preview based on form data
 *
 * @param formData - The custom scripts configuration data
 * @returns Generated Python code as a string
 */
export const generatePythonCode = (formData: CustomScriptsNodeData): string => {
  const { module_name, class_name, function_name, class_parameter, function_parameter } = formData;

  // Return placeholder if no configuration
  if (!module_name && !class_name && !function_name) {
    return '# Configure the form above to generate Python code preview\n';
  }

  let code = '';

  // Add module comment
  if (module_name) {
    code += `# module: ${module_name}\n\n`;
  }

  // Generate class or function
  if (class_name) {
    // Class-based approach
    const classParamKeys = class_parameter.filter((p) => p.key).map((p) => p.key);
    const functionParamKeys = function_parameter.filter((p) => p.key).map((p) => p.key);

    code += `class ${class_name}:\n`;
    code += `    def __init__(self${classParamKeys.length > 0 ? ', ' + classParamKeys.join(', ') : ''}):\n`;

    if (class_parameter.length > 0 && class_parameter.some((p) => p.key)) {
      class_parameter.forEach((param) => {
        if (param.key) {
          code += `        self.${param.key} = ${param.key}\n`;
        }
      });
    } else {
      code += `        # Initialize your class here\n`;
      code += `        pass\n`;
    }

    if (function_name) {
      code += `\n    def ${function_name}(self${functionParamKeys.length > 0 ? ', ' + functionParamKeys.join(', ') : ''}):\n`;
      code += `        # TODO: Implement ${function_name}\n`;
      code += `        pass\n`;
    }
  } else if (function_name) {
    // Function-only approach
    const functionParamKeys = function_parameter.filter((p) => p.key).map((p) => p.key);

    code += `def ${function_name}(${functionParamKeys.join(', ')}):\n`;
    code += `    # TODO: Implement ${function_name}\n`;
    code += `    pass\n`;
  }

  // Add usage example
  if (module_name && class_name && function_name) {
    code += `\n\n# Usage example:\n`;
    code += `# from ${module_name} import ${class_name}\n`;

    const classParamExample = class_parameter
      .filter((p) => p.key && p.value)
      .map((p) => `${p.key}=${JSON.stringify(p.value)}`)
      .join(', ');

    const functionParamExample = function_parameter
      .filter((p) => p.key && p.value)
      .map((p) => `${p.key}=${JSON.stringify(p.value)}`)
      .join(', ');

    code += `# obj = ${class_name}(${classParamExample})\n`;
    code += `# obj.${function_name}(${functionParamExample})\n`;
  }

  return code;
};

/**
 * Parses template data from node configuration
 *
 * @param template - The template object from node data
 * @returns Parsed class and function parameters
 */
export const parseTemplateParameters = (template: any) => {
  const classParams = template?.class_parameter?.map((param: any) => ({
    key: param.key?.value || '',
    value: param.value?.value || '',
  })) || [];

  const functionParams = template?.function_parameter?.map((param: any) => ({
    key: param.key?.value || '',
    value: param.value?.value || '',
  })) || [];

  return { classParams, functionParams };
};
