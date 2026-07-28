# Source Node Output Clearing Implementation

## Overview
Enhanced the workflow save functionality to explicitly clear the `output` key for source-only nodes (nodes that are always source columns and never target columns).

## What Are Source-Only Nodes?

**Source-Only Nodes** are nodes that:
- Have **NO incoming edges** (no other nodes connect TO them)
- Only send data OUT to other nodes
- Examples: Database connectors, file readers, API sources, datasets

These nodes fetch fresh data on execution, so storing their output in the database is unnecessary and wastes space.

## Implementation Details

### File Modified: `src/utils/workflowUtils.ts`

#### Enhanced `prepareWorkflowForSave()` Function

The function now:
1. **Identifies source-only nodes** using `getNodesWithoutInputs()`
2. **Clears output completely** for these nodes before saving
3. **Logs detailed information** about what's being cleared
4. **Preserves unique_id references** for transformation nodes

### Logic Flow

```typescript
// Step 1: Identify source-only nodes
const sourceNodeIds = getNodesWithoutInputs(workflow.data.edges);
// Returns nodes with NO incoming edges

// Step 2: For each node in the workflow
workflowToSave.data.nodes = workflowToSave.data.nodes.map((node) => {
  
  // Case 1: Source-only node (no incoming edges)
  if (isSourceOnlyNode(node)) {
    return {
      ...node,
      data: {
        ...node.data,
        node: {
          ...node.data.node,
          output: undefined  // ✅ CLEARED
        }
      }
    };
  }
  
  // Case 2: Transformation node with unique_id
  if (hasUniqueId(node)) {
    return {
      ...node,
      data: {
        ...node.data,
        node: {
          ...node.data.node,
          output: stripDataButKeepUniqueId(node.data.node.output)
        }
      }
    };
  }
  
  // Case 3: Other nodes - keep as-is
  return node;
});
```

## Console Output

When saving a workflow, you'll see detailed logs:

```
=== Preparing Workflow for Save ===
Total nodes: 5
Source-only nodes (no incoming edges, will have output cleared): ["node-1", "node-2"]
  - Node node-1: SOURCE-ONLY node, clearing output completely
  - Node node-2: SOURCE-ONLY node, clearing output completely
  - Node node-3: Has unique_id (abc123), stripping data but keeping reference
  - Node node-4: Has unique_id (def456), stripping data but keeping reference
  - Node node-5: Has output but no unique_id, keeping as-is
=== Workflow preparation complete ===
```

## When This Runs

The enhanced logic runs automatically when:

### 1. **Creating a New Workflow**
- File: `src/hooks/use-save-flow.tsx`
- Function: `useSaveWorkflow()`
- Line: 52 - `prepareWorkflowForSave(workflowData)`

### 2. **Updating an Existing Workflow**
- File: `src/controllers/API/index.ts`
- Function: `editWorkflow()`
- Line: 168-169 - `prepareWorkflowForSave(payload)`

## Benefits

### Before (Without Output Clearing):
```json
{
  "id": "db-source-node",
  "data": {
    "node": {
      "output": {
        "data": [...10000 rows...],  // ❌ Wasted space
        "columns": [...],
        "status": true
      }
    }
  }
}
```
**Database Size:** Large (includes all data)

### After (With Output Clearing):
```json
{
  "id": "db-source-node",
  "data": {
    "node": {
      "output": undefined  // ✅ Empty
    }
  }
}
```
**Database Size:** Minimal (no data stored)

## Node Type Handling

### Source-Only Nodes (No Incoming Edges)
- ✅ Output **CLEARED COMPLETELY**
- Examples: MySQL, PostgreSQL, CSV Reader, Excel Reader, API Connector
- Reasoning: They fetch fresh data on execution

### Transformation Nodes (With unique_id)
- ✅ Data stripped, **unique_id preserved**
- Examples: Filter, Sort, Merge, Join, Aggregate
- Reasoning: Can fetch data using unique_id API

### Terminal/Output Nodes
- ✅ Output **kept as-is**
- Examples: Reporting, Validation results, Data export
- Reasoning: May need output for display/reporting

## How to Verify

1. **Save a workflow** with source nodes (DB, File, API)
2. **Check browser console** for:
   ```
   Source-only nodes (no incoming edges, will have output cleared): [...]
   Node xyz: SOURCE-ONLY node, clearing output completely
   ```
3. **Verify in database** that source nodes have no output data
4. **Re-open workflow** - data should be fetched fresh on load

## Edge Cases Handled

### Empty Workflow
- ✅ Returns workflow as-is if no nodes exist

### Workflow with No Edges
- ✅ All nodes treated as source-only (all outputs cleared)

### Disconnected Nodes
- ✅ Nodes with no connections treated as source-only

### Circular Dependencies
- ✅ No nodes will be source-only (all have incoming edges)
- Output handling falls to unique_id logic

## Performance Impact

### Positive Impacts:
- ✅ **Reduced database size** (no redundant data)
- ✅ **Faster save operations** (less data to transmit)
- ✅ **Faster load operations** (less data to retrieve)
- ✅ **Fresh data guarantee** (source nodes always fetch latest)

### Minimal Overhead:
- Edge analysis: O(n) where n = number of edges
- Node mapping: O(m) where m = number of nodes
- Total: O(n + m) - negligible for typical workflows

## Testing Checklist

- [x] Enhanced output clearing logic
- [x] Added detailed console logging
- [x] Source-only nodes identified correctly
- [x] Output cleared for source-only nodes
- [x] unique_id preserved for transformation nodes
- [x] No linting errors
- [ ] Manual testing: Save workflow with DB source
- [ ] Manual testing: Verify console logs
- [ ] Manual testing: Check database for cleared output
- [ ] Manual testing: Re-open workflow and verify data loads

## Related Files

1. **src/utils/workflowUtils.ts** - Main implementation
2. **src/utils/nodeUtils.ts** - Helper function `getNodesWithoutInputs()`
3. **src/utils/nodeDataUtils.ts** - `stripDataForSave()` for unique_id nodes
4. **src/hooks/use-save-flow.tsx** - Calls preparation on create
5. **src/controllers/API/index.ts** - Calls preparation on update

## Notes

- This is a **data optimization feature** - it doesn't change workflow behavior
- Source nodes will **always fetch fresh data** when the workflow is opened
- Transformation nodes use **unique_id API** to fetch their data
- The user experience remains unchanged - data appears to load normally

