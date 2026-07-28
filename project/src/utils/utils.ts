import { DRAG_EVENTS_CUSTOM_TYPESS } from "@/constants/constants";
import { InputPayload, OutputPayload } from "@/types/customColumn";

export function toCamelCase(str: string): string {
  return str
    .split(" ")
    .map((s, index) => (index !== 0 ? toNormalCase(s) : s.toLowerCase()))
    .join("");
}

export function toNormalCase(str: string): string {
  let result = str
    .split("_")
    .map((word, index) => {
      if (index === 0) {
        return word[0]?.toUpperCase() + word.slice(1)?.toLowerCase();
      }
      return word?.toLowerCase();
    })
    .join(" ");

  return result
    .split("-")
    .map((word, index) => {
      if (index === 0) {
        return word[0]?.toUpperCase() + word.slice(1)?.toLowerCase();
      }
      return word?.toLowerCase();
    })
    .join(" ");
}

const snakeCase = (str: string) => {
  if (!str) return str;
  return str.replace(/([A-Z])/g, "_$1").toLowerCase();
};

export function convertToSnakeCase(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(v => convertToSnakeCase(v));
  } else if (obj !== null && obj?.constructor === Object) {
    return Object.keys(obj).reduce((acc, key) => {
      const newKey = snakeCase(key);
      acc[newKey] = convertToSnakeCase(obj[key]);
      return acc;
    }, {} as Record<string, any>);
  }
  return obj;
}

export function isSupportedNodeTypes(type: string) {
  return Object.keys(DRAG_EVENTS_CUSTOM_TYPESS).some((key) => key === type);
}

// Helper function to map AG Grid conditions to your custom format
export const mapAgGridConditionToCustom = (agGridCondition: string) => {
  const conditionMap: { [key: string]: string } = {
      'contains': 'contains',
      'notContains': 'notContains',
      'equals': 'equals',
      'notEqual': 'notEquals',
      'startsWith': 'startsWith',
      'endsWith': 'endsWith',
      'lessThan': 'lessThan',
      'lessThanOrEqual': 'lessThanOrEqual',
      'greaterThan': 'greaterThan',
      'greaterThanOrEqual': 'greaterThanOrEqual',
      'inRange': 'inRange',
      'blank': 'blank',
      'notBlank': 'notBlank',
      // Add more mappings as needed
  };
  
  return conditionMap[agGridCondition] || agGridCondition;
};

/**
 * Sanitizes filter array by removing pure placeholder filters
 * @param filters - Array of filter objects to sanitize
 * @returns Array of filters with placeholder filters removed
 */
export const sanitizeFilters = (filters: any[]): any[] => {
  if (!Array.isArray(filters)) {
    return [];
  }

  return filters.filter((filter) => {
    // Check if filter is null, undefined, or not an object
    if (!filter || typeof filter !== 'object') {
      console.log('Removing invalid filter:', filter);
      return false;
    }

    // Check if this is a pure placeholder filter
    // A pure placeholder filter has all main fields as placeholders
    const hasPlaceholderColumn = filter.column && 
      typeof filter.column === "string" && 
      filter.column.includes("{{") && 
      filter.column.includes("}}");

    const hasPlaceholderValue = filter.value && 
      typeof filter.value === "string" && 
      filter.value.includes("{{") && 
      filter.value.includes("}}");

    const hasPlaceholderCondition = filter.condition && 
      typeof filter.condition === "string" && 
      filter.condition.includes("{{") && 
      filter.condition.includes("}}");

    // If all main fields are placeholders, it's a pure placeholder filter
    const isPurePlaceholderFilter = hasPlaceholderColumn && hasPlaceholderValue && hasPlaceholderCondition;

    if (isPurePlaceholderFilter) {
      console.log('Removing placeholder filter:', filter);
      return false;
    }

    // Keep the filter if it's not a pure placeholder
    console.log('Keeping valid filter:', filter);
    return true;
  });
};

export function transformToExpectedPayload(data: InputPayload[]): OutputPayload {
  return data.map((item) => ({
    id: item.id,
    name: item.name,
    new_custom_column: item.new_custom_column,
    custom_filter_list: item.custom_filter_list.map((filter) => {
      const symbol = filter.operation.split(" ")[0]; // extract symbol before space
      return {
        id: filter.id,
        operation: symbol,
        ...(filter.text_sf_box !== undefined && { text_sf_box: filter.text_sf_box }),
        text_slf_box: filter.text_slf_box,
        ...(filter.selected_field && { selected_field: filter.selected_field }),
        selected_last_field: filter.selected_last_field,
      };
    }),
  }));
}

export async function copyToClipboard(text: string): Promise<boolean> {
  // Try the modern Clipboard API first
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.warn('Clipboard API failed, falling back.', error);
      // Fallback will be attempted below
    }
  }

  // Fallback for older browsers or insecure contexts
  const textArea = document.createElement('textarea');
  textArea.value = text;
  
  // Make the textarea invisible
  textArea.style.position = 'absolute';
  textArea.style.left = '-9999px';
  textArea.style.top = '0';
  
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  
  try {
    const successful = document.execCommand('copy');
    if (!successful) {
      console.error('Fallback copy command was unsuccessful.');
      return false;
    }
    return true;
  } catch (err) {
    console.error('Fallback copy command failed.', err);
    return false;
  } finally {
    document.body.removeChild(textArea);
  }
}

export function transformToSampleModel(columns: string[], data: Record<string, any>[]) {
  return columns.map((col, index) => {
    // Get all values for this column (without filtering out nulls/falsy values)
    const allValues = data.map(row => row[col]);

    // Determine the type more accurately
    let detectedType = 'string'; // default

    // Find first non-null value to determine type
    const firstNonNullValue = allValues.find(val => val !== null && val !== undefined);

    if (firstNonNullValue !== undefined) {
      const jsType = typeof firstNonNullValue;
      if (jsType === 'object') {
        // Check if it's an array
        detectedType = Array.isArray(firstNonNullValue) ? 'array' : 'object';
      } else if (jsType === 'number') {
        // Check if it's an integer or float
        detectedType = Number.isInteger(firstNonNullValue) ? 'number' : 'number';
      } else if (jsType === 'boolean') {
        detectedType = 'boolean';
      } else {
        detectedType = 'string';
      }
    } else {
      // All values are null/undefined
      detectedType = 'null';
    }

    // Take first 10 values (including nulls) for sample data
    const sampleData = allValues.slice(0, 10).map(val => {
      if (val === null || val === undefined) {
        return null;
      }
      if (typeof val === 'object') {
        return JSON.stringify(val);
      }
      return val;
    });

    return {
      id: `sample-${index + 1}`,
      name: col,
      type: detectedType,
      sampleData: sampleData,
    };
  });
}
