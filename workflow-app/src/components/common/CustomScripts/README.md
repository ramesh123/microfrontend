# CustomScripts Component

A comprehensive React + TypeScript component for configuring and previewing custom Python scripts in a node-based workflow editor.

## Overview

The CustomScripts component provides an intuitive interface for defining Python custom scripts with:
- Module and class configuration
- Function definition
- Dynamic parameter management (class and function parameters)
- Live Python code preview with Monaco Editor
- Theme switching (VS Dark / VS Light)

## Component Structure

```
CustomScripts/
├── index.tsx                          # Main component
├── types.ts                           # TypeScript type definitions
├── components/
│   ├── ParameterList.tsx             # Key-value parameter list manager
│   └── MonacoEditorSection.tsx       # Monaco editor with theme toggle
└── utils/
    └── codeGenerator.ts              # Python code generation utilities
```

## Layout

```
┌──────────────────────────────────────────────┐
│ [Top 35%] Run Configuration / Template Form  │
│   - Module Name                              │
│   - Class Name                               │
│   - Function Name                            │
│   - Class Parameters [Key-Value List + Add]  │
│   - Function Parameters [Key-Value List + Add]│
├──────────────────────────────────────────────┤
│ [Bottom 65%] Python Code Editor (Monaco)     │
│   - Dropdown to select theme (Dark/Light)    │
│   - Prefilled script based on form data      │
└──────────────────────────────────────────────┘
```

## Usage

The component is automatically integrated into the workflow system and will render when a `custom_scripts` node is selected.

### Manual Integration

```tsx
import CustomScripts from '@/components/common/CustomScripts';

// In your node component
<CustomScripts
  data={nodeData}
  onChange={(formData) => {
    console.log('Updated configuration:', formData);
  }}
/>
```

### Integration Points

The component is integrated at multiple levels:

1. **NodeDetailsPage** ([src/pages/NodeDetailsPage/index.tsx](../../pages/NodeDetailsPage/index.tsx))
   - Renders CustomScripts when `node_id === "custom_scripts"`
   - Auto-saves form data to flow store with debouncing

2. **Sheet Component** ([src/components/common/sheet-component/index.tsx](../sheet-component/index.tsx))
   - Handles execute functionality
   - Passes dataframe from upstream nodes to custom script execution
   - Stores execution results in node output

3. **Node Data Flow**
   ```
   User Input → CustomScripts Component → Debounced Save → Flow Store → Backend API
   ```

## Props

### CustomScriptsNodeProps

| Prop | Type | Description |
|------|------|-------------|
| `data` | `any` | Node data containing payload and template configuration |
| `onChange` | `(data: CustomScriptsNodeData) => void` | Callback fired when form data changes |

## Data Structure

### Input Node Data

The component expects node data in the following format:

```typescript
{
  node: {
    payload: {
      module_name: string;
      class_name: string;
      function_name: string;
      // ... other payload fields
    },
    template: {
      module_name: { value: string; /* ... */ },
      class_name: { value: string; /* ... */ },
      function_name: { value: string; /* ... */ },
      class_parameter: [
        {
          key: { value: string; /* ... */ },
          value: { value: string; /* ... */ }
        }
      ],
      function_parameter: [
        {
          key: { value: string; /* ... */ },
          value: { value: string; /* ... */ }
        }
      ]
    }
  }
}
```

### Output Form Data

```typescript
{
  module_name: string;
  class_name: string;
  function_name: string;
  class_parameter: Array<{ key: string; value: string }>;
  function_parameter: Array<{ key: string; value: string }>;
}
```

## Features

### 1. Form Configuration (Top 35%)

- **Module Name**: Name of the Python module/file
- **Class Name**: Name of the Python class (defaults to "CustomScript")
- **Function Name**: Name of the method/function to execute
- **Class Parameters**: Dynamic key-value pairs for class initialization
- **Function Parameters**: Dynamic key-value pairs for function arguments

### 2. Live Code Preview (Bottom 65%)

- **Monaco Editor**: Full-featured Python editor with syntax highlighting
- **Read-only**: Preview-only mode to show generated code
- **Theme Toggle**: Switch between VS Dark and VS Light themes
- **Auto-generation**: Code updates in real-time as form changes

## Code Generation Examples

### Example 1: Class with Method

**Form Input:**
- Module Name: `data_processor`
- Class Name: `DataProcessor`
- Function Name: `process`
- Class Parameters: `[{ key: "config", value: "{}" }]`
- Function Parameters: `[{ key: "data", value: "[]" }]`

**Generated Code:**
```python
# module: data_processor

class DataProcessor:
    def __init__(self, config):
        self.config = config

    def process(self, data):
        # TODO: Implement process
        pass

# Usage example:
# from data_processor import DataProcessor
# obj = DataProcessor(config="{}")
# obj.process(data="[]")
```

### Example 2: Standalone Function

**Form Input:**
- Module Name: `utils`
- Class Name: *(empty)*
- Function Name: `calculate_total`
- Function Parameters: `[{ key: "items", value: "[]" }]`

**Generated Code:**
```python
# module: utils

def calculate_total(items):
    # TODO: Implement calculate_total
    pass
```

## Subcomponents

### ParameterList

Manages dynamic lists of key-value parameter pairs with add/remove functionality.

**Features:**
- Add new parameter pairs
- Remove existing parameters
- Inline editing of keys and values
- Empty state placeholder

### MonacoEditorSection

Displays Python code preview with Monaco editor.

**Features:**
- Syntax highlighting for Python
- Read-only mode
- Theme selection (VS Dark / VS Light)
- Auto-resizing
- Loading states

## Styling

The component uses:
- **TailwindCSS** for utility styling
- **ShadCN UI** components for consistent design
- **Compact spacing** to maximize screen real estate
- **Responsive layout** with 35/65 vertical split

## Dependencies

- `@monaco-editor/react` - Monaco editor integration
- `lucide-react` - Icon components
- `@/components/ui/*` - ShadCN UI components
- `@/lib/utils` - Utility functions (cn)

## Type Safety

All components are fully typed with TypeScript. See [types.ts](./types.ts) for complete type definitions.

## Performance Considerations

- Uses `useCallback` for stable function references
- Uses `useMemo` for expensive code generation
- Optimized re-renders with proper dependency arrays
- Lazy loading of Monaco editor (handled by @monaco-editor/react)

## Accessibility

- Proper label associations
- Keyboard navigation support
- Focus management
- Semantic HTML structure

## Save & Execute Functionality

### Auto-Save
- Form changes are automatically saved to the flow store with **500ms debouncing**
- Prevents excessive API calls while typing
- Updates happen seamlessly in the background

### Execute Button (Sheet Component)
When the "Execute" button is clicked in the sheet:

1. **Payload Construction**
   ```typescript
   payload = {
     ...basePayload,
     node_id: targetId,
     flow_id: currentWorkflow?.flow_id,
     response_type: "json",
     dataframe: JSON.stringify(outputData), // From upstream nodes
   };
   ```

2. **Backend Execution**
   - Calls `execute_node` endpoint defined in node configuration
   - Passes upstream node data as `dataframe`
   - Executes the custom Python script

3. **Result Handling**
   - Response is stored in `node.output`
   - Data preview tab automatically updates
   - Success/error toasts notify the user

### API Endpoints

The node uses these endpoints from the backend:

- **save_node**: Saves configuration changes
  ```json
  {
    "klass": "create-workflow-node",
    "method": "post",
    "module": "work-flow-nodes",
    "enabled": true
  }
  ```

- **execute_node**: Executes the custom script
  ```json
  {
    "klass": "custom-scripts-actions",
    "method": "post",
    "module": "custom_scripts",
    "actions": "execute_custom_script",
    "enabled": true
  }
  ```

## Future Enhancements

Potential improvements for future iterations:
- [ ] Syntax validation for Python code
- [ ] Export/import functionality
- [ ] Code execution preview with test data
- [ ] Parameter type selection (string, number, boolean, etc.)
- [ ] Template library for common patterns
- [ ] Collapsible parameter sections
- [ ] Drag-and-drop parameter reordering
- [ ] Inline Python code editing (currently read-only preview)

## Contributing

When extending this component:
1. Maintain the existing folder structure
2. Add new types to `types.ts`
3. Create new subcomponents in `components/` folder
4. Add utilities to `utils/` folder
5. Update this README with new features
6. Ensure TypeScript strict mode compliance

## License

Part of the vite-react-workflow project.
