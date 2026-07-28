/**
 * Utility functions for compressing large payload data using gzip and base64 encoding
 */
import pako from 'pako';

/**
 * Converts Uint8Array to Base64 string efficiently using chunking
 * @param uint8Array - The Uint8Array to convert
 * @returns Base64 encoded string
 */
function uint8ToBase64(uint8Array: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000; // 32KB chunks
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

/**
 * Compresses a data object/array to a gzip compressed base64 string
 * @param data - The data to compress (object, array, or string)
 * @returns Base64 encoded gzip compressed string
 */
export function compressData(data: any): string {
  if (!data) return '';
  
  try {
    // Convert data to JSON string
    const jsonString = typeof data === 'string' ? data : JSON.stringify(data);
    
    // Convert string to Uint8Array
    const uint8Array = new TextEncoder().encode(jsonString);
    
    // Compress using gzip
    const compressed = pako.gzip(uint8Array);
    
    // Convert compressed data to base64 using efficient chunking
    const base64String = uint8ToBase64(compressed);
    
    console.log(`Data compressed (gzip+base64): ${jsonString.length} bytes -> ${base64String.length} bytes (${Math.round((1 - base64String.length / jsonString.length) * 100)}% reduction)`);
    
    return base64String;
  } catch (error) {
    console.error('Failed to compress data:', error);
    return typeof data === 'string' ? data : JSON.stringify(data);
  }
}

/**
 * Decompresses a base64 encoded gzip string back to original data
 * @param compressedData - The base64 encoded gzip compressed string
 * @returns Decompressed data object/array
 */
export function decompressData(compressedData: string): any {
  if (!compressedData) return null;
  
  try {
    // Decode base64 to binary string
    const binaryString = atob(compressedData);
    
    // Convert binary string to Uint8Array
    const uint8Array = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      uint8Array[i] = binaryString.charCodeAt(i);
    }
    
    // Decompress using gunzip
    const decompressed = pako.ungzip(uint8Array);
    
    // Convert Uint8Array back to string
    const jsonString = new TextDecoder().decode(decompressed);
    
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Failed to decompress data:', error);
    return null;
  }
}

/**
 * Compresses dataframe, datasets, source_data, and target_data keys in a payload object
 * @param payload - The payload object that may contain data keys
 * @returns Payload with compressed data keys
 */
export function compressPayloadData(payload: any): any {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  const compressedPayload = { ...payload };
  
  // Debug: Log which keys exist in the payload
  const dataKeys = ['dataframe', 'source_data', 'target_data', 'datasets'];
  const foundKeys = dataKeys.filter(key => compressedPayload[key] !== undefined);
  if (foundKeys.length > 0) {
    console.log('🔍 Found data keys in payload:', foundKeys);
  }

  // Compress dataframe: string, object-of-JSON-strings (Excel write multi-upstream), or other object/array
  if (compressedPayload.dataframe !== undefined) {
    const original = compressedPayload.dataframe;
    const originalType = typeof original;
    console.log(`📦 Compressing dataframe (type: ${originalType}, size: ${originalType === 'string' ? original.length : JSON.stringify(original).length} bytes)`);

    if (typeof original === 'string') {
      compressedPayload.dataframe = compressDataString(original);
      console.log('✅ Compressed dataframe in payload using gzip+base64');
    } else if (
      original !== null &&
      typeof original === 'object' &&
      !Array.isArray(original)
    ) {
      const entries = Object.entries(original as Record<string, unknown>);
      const allStringLikeValues =
        entries.length > 0 &&
        entries.every(
          ([, v]) => v === null || v === undefined || typeof v === 'string'
        );
      if (allStringLikeValues) {
        const compressedByKey: Record<string, string> = {};
        for (const [key, val] of entries) {
          const s = val == null ? '' : String(val);
          compressedByKey[key] = s ? compressDataString(s) : '';
        }
        compressedPayload.dataframe = compressedByKey;
        console.log(
          `✅ Compressed dataframe (${entries.length} keys) using gzip+base64 per upstream`
        );
      } else {
        compressedPayload.dataframe = compressData(original);
        console.log('✅ Compressed dataframe object in payload using gzip+base64');
      }
    } else {
      compressedPayload.dataframe = compressData(original);
      console.log('✅ Compressed dataframe in payload using gzip+base64');
    }
  }

  // Compress source_data if it exists (single string value)
  if (compressedPayload.source_data !== undefined) {
    const original = compressedPayload.source_data;
    const originalType = typeof original;
    console.log(`📦 Compressing source_data (type: ${originalType}, size: ${originalType === 'string' ? original.length : JSON.stringify(original).length} bytes)`);
    
    if (typeof original === 'string') {
      compressedPayload.source_data = compressDataString(original);
    } else {
      compressedPayload.source_data = compressData(original);
    }
    console.log('✅ Compressed source_data in payload using gzip+base64');
  }

  // Compress target_data if it exists (single string value)
  if (compressedPayload.target_data !== undefined) {
    const original = compressedPayload.target_data;
    const originalType = typeof original;
    console.log(`📦 Compressing target_data (type: ${originalType}, size: ${originalType === 'string' ? original.length : JSON.stringify(original).length} bytes)`);
    
    if (typeof original === 'string') {
      compressedPayload.target_data = compressDataString(original);
    } else {
      compressedPayload.target_data = compressData(original);
    }
    console.log('✅ Compressed target_data in payload using gzip+base64');
  }

  // Compress datasets if it exists (object with multiple string values)
  if (compressedPayload.datasets !== undefined && typeof compressedPayload.datasets === 'object') {
    const compressedDatasets: { [key: string]: string } = {};
    
    // Compress each dataset value individually (each is already a JSON string)
    Object.keys(compressedPayload.datasets).forEach(key => {
      const value = compressedPayload.datasets[key];
      // Each value is already a JSON string, compress it directly
      compressedDatasets[key] = compressDataString(value);
    });
    
    compressedPayload.datasets = compressedDatasets;
    console.log(`Compressed ${Object.keys(compressedDatasets).length} datasets in payload using gzip+base64`);
  }

  return compressedPayload;
}

/**
 * Checks if a string is already compressed (base64 encoded)
 * Compressed strings don't start with JSON markers like [ or {
 * @param str - The string to check
 * @returns true if likely already compressed
 */
function isAlreadyCompressed(str: string): boolean {
  if (!str || typeof str !== 'string') return false;
  
  // JSON strings start with [ or { (after trimming whitespace)
  const trimmed = str.trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{') || trimmed.startsWith('"')) {
    return false; // This is JSON, not compressed
  }
  
  // Base64 strings only contain: A-Z, a-z, 0-9, +, /, =
  // If it matches this pattern and doesn't look like JSON, it's likely compressed
  const base64Pattern = /^[A-Za-z0-9+/]+=*$/;
  return base64Pattern.test(str);
}

/**
 * Compresses a string directly without JSON.stringify
 * Used when the data is already a JSON string
 * @param dataString - The string to compress
 * @returns Base64 encoded gzip compressed string
 */
export function compressDataString(dataString: string): string {
  if (!dataString) {
    console.log('⚠️  Empty string, skipping compression');
    return '';
  }
  
  // Skip compression if already compressed
  if (isAlreadyCompressed(dataString)) {
    console.log('⚠️  Skipping compression - data is already compressed (base64 detected)');
    return dataString;
  }
  
  try {
    // Convert string to Uint8Array
    const uint8Array = new TextEncoder().encode(dataString);
    
    // Compress using gzip
    const compressed = pako.gzip(uint8Array);
    
    // Convert compressed data to base64 using efficient chunking
    const base64String = uint8ToBase64(compressed);
    
    const reduction = Math.round((1 - base64String.length / dataString.length) * 100);
    console.log(`✅ String compressed (gzip+base64): ${dataString.length} bytes -> ${base64String.length} bytes (${reduction}% reduction)`);
    
    return base64String;
  } catch (error) {
    console.error('❌ Failed to compress string:', error);
    return dataString;
  }
}

/**
 * Compresses dataframe and datasets in nested node.payload structure
 * @param nodeData - The node data object
 * @returns Node data with compressed payload data
 */
export function compressNodePayloadData(nodeData: any): any {
  if (!nodeData?.node?.payload) {
    return nodeData;
  }

  return {
    ...nodeData,
    node: {
      ...nodeData.node,
      payload: compressPayloadData(nodeData.node.payload),
    },
  };
}

/**
 * Decompresses dataframe, datasets, source_data, and target_data keys in a payload object
 * @param payload - The payload object that may contain compressed data keys
 * @returns Payload with decompressed data keys
 */
export function decompressPayloadData(payload: any): any {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  const decompressedPayload = { ...payload };

  // Decompress dataframe: object of per-upstream compressed strings (Excel write) or single string
  if (
    decompressedPayload.dataframe &&
    typeof decompressedPayload.dataframe === 'object' &&
    !Array.isArray(decompressedPayload.dataframe)
  ) {
    const dfObj = decompressedPayload.dataframe as Record<string, unknown>;
    const keys = Object.keys(dfObj);
    const allStrings =
      keys.length > 0 && keys.every((k) => typeof dfObj[k] === 'string');
    if (allStrings) {
      const decompressedByKey: Record<string, unknown> = {};
      keys.forEach((key) => {
        const compressedValue = dfObj[key] as string;
        if (!compressedValue) {
          decompressedByKey[key] = compressedValue;
          return;
        }
        const decompressedString = decompressDataString(compressedValue);
        try {
          decompressedByKey[key] = JSON.parse(decompressedString);
        } catch {
          decompressedByKey[key] = decompressedString;
        }
      });
      decompressedPayload.dataframe = decompressedByKey;
      console.log(`Decompressed dataframe (${keys.length} keys) in payload`);
    }
  } else if (typeof decompressedPayload.dataframe === 'string') {
    decompressedPayload.dataframe = decompressDataString(decompressedPayload.dataframe);
    console.log('Decompressed dataframe in payload');
  }

  // Decompress source_data if it exists (single compressed string)
  if (typeof decompressedPayload.source_data === 'string') {
    decompressedPayload.source_data = decompressDataString(decompressedPayload.source_data);
    console.log('Decompressed source_data in payload');
  }

  // Decompress target_data if it exists (single compressed string)
  if (typeof decompressedPayload.target_data === 'string') {
    decompressedPayload.target_data = decompressDataString(decompressedPayload.target_data);
    console.log('Decompressed target_data in payload');
  }

  // Decompress datasets if it exists (object with compressed string values)
  if (decompressedPayload.datasets && typeof decompressedPayload.datasets === 'object') {
    const decompressedDatasets: { [key: string]: any } = {};
    
    // Decompress each dataset value individually
    Object.keys(decompressedPayload.datasets).forEach(key => {
      const compressedValue = decompressedPayload.datasets[key];
      if (typeof compressedValue === 'string') {
        // Decompress the string and parse the JSON
        const decompressedString = decompressDataString(compressedValue);
        decompressedDatasets[key] = JSON.parse(decompressedString);
      } else {
        decompressedDatasets[key] = compressedValue;
      }
    });
    
    decompressedPayload.datasets = decompressedDatasets;
    console.log(`Decompressed ${Object.keys(decompressedDatasets).length} datasets in payload`);
  }

  return decompressedPayload;
}

/**
 * Decompresses a base64 gzip string directly to a string
 * Used when we want the decompressed string, not parsed JSON
 * @param compressedString - The base64 encoded gzip compressed string
 * @returns Decompressed string
 */
function decompressDataString(compressedString: string): string {
  if (!compressedString) return '';
  
  try {
    // Decode base64 to binary string
    const binaryString = atob(compressedString);
    
    // Convert binary string to Uint8Array
    const uint8Array = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      uint8Array[i] = binaryString.charCodeAt(i);
    }
    
    // Decompress using gunzip
    const decompressed = pako.ungzip(uint8Array);
    
    // Convert Uint8Array back to string
    const originalString = new TextDecoder().decode(decompressed);
    
    return originalString;
  } catch (error) {
    console.error('Failed to decompress string:', error);
    return compressedString;
  }
}