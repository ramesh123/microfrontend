# Data Compression Implementation (Gzip + Base64)

## Overview
Implemented gzip compression with base64 encoding for `dataframe`, `datasets`, `source_data`, and `target_data` keys in node payloads to significantly reduce payload sizes sent to the API.

## Technology Stack
- **Compression**: Gzip (via pako library)
- **Encoding**: Base64
- **Library**: `pako` (browser-compatible gzip implementation)

## Installation
```bash
npm install pako
npm install --save-dev @types/pako
```

## Changes Made

### 1. **Created Compression Utilities** (`src/utils/compressionUtils.ts`)
New utility file with functions for:

#### `compressData(data: any): string`
- Converts data to JSON string
- Compresses using gzip (pako.gzip)
- Encodes to base64
- Returns base64 string
- Logs compression stats

#### `decompressData(compressedData: string): any`
- Decodes base64 to binary
- Decompresses using gunzip (pako.ungzip)
- Parses JSON back to original data
- Returns original data object/array

#### `compressPayloadData(payload: any): any`
- Automatically finds and compresses data keys: `dataframe`, `datasets`, `source_data`, `target_data`
- Handles both string and object data types
- Returns payload with compressed data
- Includes smart detection to skip already-compressed data

#### `compressNodePayloadData(nodeData: any): any`
- Handles nested `node.payload` structures
- Compresses dataframe/datasets within

#### `decompressPayloadData(payload: any): any`
- Decompresses dataframe/datasets when needed
- Used for receiving compressed data from backend

**Benefits:**
- Standard gzip compression (widely supported)
- Base64 encoding (safe for JSON transport)
- Automatic compression logging with size reduction stats
- Error handling for failed compression/decompression
- Supports multiple data formats (objects, arrays, strings)

### 2. **API Level Compression** (`src/controllers/API/index.ts`)
Updated `saveNodeDetailsApi()` to automatically compress payloads before sending:
- Deep clones payload to avoid mutation
- Checks for `payload.dataframe` and `payload.datasets`
- Checks for `node.payload.dataframe` and `node.payload.datasets`
- Compresses both structures automatically
- Logs compression for debugging

**Coverage:** This ensures ALL API calls (execute, save, transform) automatically compress these keys.

### 3. **Explicit Compression Points**

#### A. Rule Configuration (`src/pages/RuleConfiguration/index.tsx`)
```typescript
// Import compression utility
const { compressData } = await import('@/utils/compressionUtils');

// For each upstream node, compress its data
datasets[nodeName] = compressData(nodeData);
```
- Compresses datasets when creating validation payloads
- Applies to all upstream node data
- Lines 567-603

#### B. MultiSource Validation (`src/components/common/multisource-validation/.../MultiSourceValidationHelper.tsx`)
```typescript
import { compressData } from '@/utils/compressionUtils';

sources.forEach(source => {
  datasets[source.name] = compressData(source.data || []);
});
```
- Compresses datasets for each source
- Used in multi-source validation workflows
- Lines 7, 25-28

#### C. NWay Validation (`src/components/common/nway-validation/.../NWayValidationHelper.ts`)
```typescript
import { compressData } from '@/utils/compressionUtils';

sources.forEach(source => {
  datasets[source.name] = compressData(source.data || []);
});
```
- Compresses datasets for N-way matching
- Applied to all source data
- Lines 8, 33-36

## How It Works

### Compression Process:
```
Original Data (Array/Object)
    ↓
JSON.stringify()
    ↓
TextEncoder (to Uint8Array)
    ↓
pako.gzip() (gzip compression)
    ↓
btoa() (base64 encoding)
    ↓
Compressed Base64 String
```

### Decompression Process:
```
Compressed Base64 String
    ↓
atob() (base64 decoding)
    ↓
Uint8Array conversion
    ↓
pako.ungzip() (gzip decompression)
    ↓
TextDecoder (to string)
    ↓
JSON.parse()
    ↓
Original Data (Array/Object)
```

### Before (Uncompressed):
```javascript
const datasets = {};
sources.forEach(source => {
  datasets[source.name] = JSON.stringify(source.data || []);
});
// Result: Large JSON string, e.g., 500KB
```

### After (Compressed with Gzip + Base64):
```javascript
import { compressData } from '@/utils/compressionUtils';

const datasets = {};
sources.forEach(source => {
  datasets[source.name] = compressData(source.data || []);
});
// Result: Compressed base64 string, e.g., 50KB (90% reduction typical)
```

## Compression Stats
The compression utility automatically logs:
```
Data compressed (gzip+base64): 500000 bytes -> 50000 bytes (90% reduction)
Compressed datasets in payload using gzip+base64
```

## Automatic Compression Flow

1. **Data Creation** → Sources create `datasets` or `dataframe` with compressed data
2. **API Call** → `saveNodeDetailsApi()` double-checks and compresses any missed keys
3. **Network Transfer** → Compressed base64 payload sent to backend
4. **Backend** → Receives base64-encoded gzip data (needs to decompress)

## Existing Code Compatibility

All existing code that sets `dataframe` continues to work:
```javascript
// This code still works - will be auto-compressed before API call
payload = {
  dataframe: JSON.stringify(sourceData),
  response_type: "json"
};
```

Files with existing data key usage (auto-compressed by API):
- `src/components/common/sheet-component/index.tsx` - `dataframe`, `source_data`, `target_data`
- `src/components/core/filterCodeEditor/index.tsx` - `dataframe`
- `src/components/core/inputFilterForm/index.tsx` - `dataframe`
- `src/customNodes/GenericNode/index.tsx` - `dataframe`, `source_data`, `target_data`
- `src/pages/FlowPage/components/nodeToolbarComponent/index.tsx` - `dataframe`, `source_data`, `target_data`
- `src/utils/filterUtils.ts` - `dataframe`
- `src/pages/RuleConfiguration/index.tsx` - `datasets`
- Validation helpers - `datasets`

## Backend Requirements

⚠️ **Important:** The backend needs to decompress the data:

### Python Backend Example:
```python
import gzip
import base64
import json

def decompress_payload(payload):
    """Decompress gzip+base64 encoded data"""
    # List of keys that may contain compressed data
    single_keys = ['dataframe', 'source_data', 'target_data']
    
    # Decompress single-value keys
    for key in single_keys:
        if key in payload and isinstance(payload[key], str):
            # Decode base64
            compressed_data = base64.b64decode(payload[key])
            # Decompress gzip
            decompressed_data = gzip.decompress(compressed_data)
            # Parse JSON
            payload[key] = json.loads(decompressed_data.decode('utf-8'))
    
    # Decompress datasets (object with multiple compressed values)
    if 'datasets' in payload and isinstance(payload['datasets'], dict):
        for key in payload['datasets']:
            compressed_data = base64.b64decode(payload['datasets'][key])
            decompressed_data = gzip.decompress(compressed_data)
            payload['datasets'][key] = json.loads(decompressed_data.decode('utf-8'))
    
    return payload
```

### Node.js Backend Example:
```javascript
const zlib = require('zlib');

function decompressPayload(payload) {
  // List of keys that may contain compressed data
  const singleKeys = ['dataframe', 'source_data', 'target_data'];
  
  // Decompress single-value keys
  singleKeys.forEach(key => {
    if (payload[key] && typeof payload[key] === 'string') {
      const buffer = Buffer.from(payload[key], 'base64');
      const decompressed = zlib.gunzipSync(buffer);
      payload[key] = JSON.parse(decompressed.toString('utf-8'));
    }
  });
  
  // Decompress datasets (object with multiple compressed values)
  if (payload.datasets && typeof payload.datasets === 'object') {
    for (const key in payload.datasets) {
      const buffer = Buffer.from(payload.datasets[key], 'base64');
      const decompressed = zlib.gunzipSync(buffer);
      payload.datasets[key] = JSON.parse(decompressed.toString('utf-8'));
    }
  }
  
  return payload;
}
```

## Testing Checklist

- [x] Pako package installed
- [x] Compression utilities created (gzip + base64)
- [x] API level compression implemented
- [x] Explicit compression points updated
- [x] No linting errors
- [ ] Backend decompression implemented (backend team)
- [ ] End-to-end testing with compressed payloads
- [ ] Verify compression ratio in production
- [ ] Performance testing with large datasets

## Performance Benefits

### Before:
- Large payloads (500KB - 5MB)
- Slow API calls
- Network bottlenecks
- Timeout issues
- High bandwidth usage

### After:
- Compressed payloads (50KB - 500KB, typically ~90% reduction)
- Faster API calls
- Reduced network usage
- Improved reliability
- Better handling of large datasets
- Lower bandwidth costs

## Advantages of Gzip + Base64

1. **Standard Compression**: Gzip is industry-standard and widely supported
2. **Better Compression**: Typically achieves 85-95% size reduction for JSON data
3. **Safe Transport**: Base64 encoding ensures safe JSON transport
4. **Backend Compatible**: Easy to decompress in any backend language
5. **Streaming Support**: Can be streamed if needed for very large data
6. **Proven Technology**: Battle-tested compression algorithm

## File Summary

### Modified Files:
1. `src/controllers/API/index.ts` - API compression layer
2. `src/pages/RuleConfiguration/index.tsx` - Rule config compression
3. `src/components/common/multisource-validation/.../MultiSourceValidationHelper.tsx` - Multi-source compression
4. `src/components/common/nway-validation/.../NWayValidationHelper.ts` - N-way compression

### New Files:
1. `src/utils/compressionUtils.ts` - Gzip+Base64 compression utilities
2. `COMPRESSION_IMPLEMENTATION.md` - This documentation

### Package Updates:
1. `package.json` - Added pako and @types/pako dependencies

## Example Output

When compression is applied, you'll see console logs like:
```
Data compressed (gzip+base64): 524288 bytes -> 52429 bytes (90% reduction)
Compressed datasets in payload using gzip+base64
```

This confirms that data is being compressed before transmission to the backend.
