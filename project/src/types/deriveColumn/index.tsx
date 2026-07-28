export interface StringOperation {
  name: string;
  display_name: string;
  parameters: Parameter[];
  returnType: 'string' | 'number' | 'boolean' | 'string[]';
  description: string;
  label?: string;
}

export interface Column {  
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean';
  sampleData: (string | number | boolean | string[])[];
}

export interface ColumnSourceConfig { 
  source_mode: 'full' | 'substring';
  column_id: string;
  start?: number;
  end?: number;
  prefix?: string;
  suffix?: string;
}

export interface ConcatPart {
  id: string;
  type: 'manual' | 'column';
  concat?: 'prefix' | 'suffix';
  value?: string;
  column_config?: ColumnSourceConfig;
}

export interface AppliedOperation {  
  id:string;
  operation_name: string;
  parameters: Record<string, any | unknown | ColumnSourceConfig | ConcatPart[]>;
  output_target?: {
    mode: 'inplace' | 'new-column';
    new_column_name?: string;
  };
}

export interface Parameter {
  name:string;
  type: 'string' | 'number' | 'boolean' | 'checkbox' | 'RegExp' | 'string-or-column' | 'concat-sources' | 'select';
  required: boolean;
  description: string;
  default_value?: any;
  label?: string;
  options?: { value: string; label: string }[];
}

export interface OperationResult {
  operation: string;
  parameters: Record<string, any>;
  result: any;
  code: string;
  timestamp: Date;
}

export interface StepResult { 
  id: string;
  operation_name: string;
  result: any;
  error?: string;
  parameters?: Record<string, any>;
}


export interface OperationBlockProps {  
  operation: AppliedOperation;
  onDelete: (id: string) => void;
  onUpdate: (id: string, newOpData: Partial<AppliedOperation>) => void;
  availableColumns: Column[];
  selectedRowIndex: number;
  operationsSet?: any[];
  selectedColumn: Column | null;
  hideOutputTarget?: boolean;
}



export const STRING_OPERATIONS: StringOperation[] = [
  // {
  //   name: 'slice',
  //   display_name: 'slice()',
  //   parameters: [
  //     { name: 'start', label: 'start', type: 'number', required: true, description: 'Start index' },
  //     { name: 'end', label: 'end', type: 'number', required: false, description: 'End index (optional)' }
  //   ],
  //   returnType: 'string',
  //   description: 'Extracts a section of string and returns it as a new string'
  // },
  {
    name: 'substring',
    display_name: 'substring()',
    parameters: [
      { name: 'start', label: 'start', type: 'number', required: true, description: 'Start index' },
      { name: 'end', label: 'end', type: 'number', required: false, description: 'End index (optional)' }
    ],
    returnType: 'string',
    description: 'Returns the part of the string between start and end indexes'
  },
  // {
  //   name: 'substr',
  //   display_name: 'substr()',
  //   parameters: [
  //     { name: 'start', label: 'start', type: 'number', required: true, description: 'Start index' },
  //     { name: 'length', label: 'length', type: 'number', required: false, description: 'Length of substring (optional)' }
  //   ],
  //   returnType: 'string',
  //   description: 'Returns a substring beginning at the specified location'
  // },
  {  
    name: 'replace',
    display_name: 'replace()',
    parameters: [
      { name: 'is_regex', label: 'Is Regex', type: 'checkbox', required: true, description: 'Is Regex' },
      { name: 'search_value', label: 'searchValue', type: 'string-or-column', required: true, description: 'String to search for (manual or from column)' },
      { name: 'replace_value', label: 'replaceValue', type: 'string-or-column', required: true, description: 'String to replace with (manual or from column)' }
    ],
    returnType: 'string',
    description: 'Replaces the first occurrence of a substring'
  },
  {
    name: 'replaceAll',
    display_name: 'replaceAll()',
    parameters: [
      { name: 'is_regex', label: 'Is Regex', type: 'checkbox', required: true, description: 'Is Regex' },
      { name: 'search_value', label: 'searchValue', type: 'string-or-column', required: true, description: 'String to search for (manual or from column)' },
      { name: 'replace_value', label: 'replaceValue', type: 'string-or-column', required: true, description: 'String to replace with (manual or from column)' }
    ],
    returnType: 'string',
    description: 'Replaces all occurrences of a substring'
  },
  {
    name: 'toUpperCase',
    display_name: 'toUpperCase()',
    parameters: [],
    returnType: 'string',
    description: 'Converts string to uppercase'
  },
  {
    name: 'toLowerCase',
    display_name: 'toLowerCase()',
    parameters: [],
    returnType: 'string',
    description: 'Converts string to lowercase'
  },
  {
    name: 'concat',
    display_name: 'concat()',
    parameters: [
      { name: 'sources', label: 'sources', type: 'concat-sources', required: true, description: 'A list of strings or column values to join together.' }
    ],
    returnType: 'string',
    description: 'Joins multiple strings or column values to the end of the current string.'
  },
  // {
  //   name: 'indexOf',
  //   display_name: 'indexOf()',
  //   parameters: [
  //     { name: 'search_value', label: 'searchValue', type: 'string', required: true, description: 'String to search for' },
  //     { name: 'from_index', label: 'fromIndex', type: 'number', required: false, description: 'Starting index (optional)' }
  //   ],
  //   returnType: 'number',
  //   description: 'Returns the index of the first occurrence of a substring'
  // },
  // {
  //   name: 'lastIndexOf',
  //   display_name: 'lastIndexOf()',
  //   parameters: [
  //     { name: 'search_value', label: 'searchValue', type: 'string', required: true, description: 'String to search for' },
  //     { name: 'from_index', label: 'fromIndex', type: 'number', required: false, description: 'Starting index (optional)' }
  //   ],
  //   returnType: 'number',
  //   description: 'Returns the index of the last occurrence of a substring'
  // },
  // {
  //   name: 'contains',
  //   display_name: 'includes()',
  //   parameters: [
  //     { name: 'search_value', label: 'searchValue', type: 'string', required: true, description: 'String to search for' },
  //     { name: 'position', label: 'position', type: 'number', required: false, description: 'Position to start searching (optional)' }
  //   ],
  //   returnType: 'boolean',
  //   description: 'Checks if string contains the specified substring'
  // },
  {
    name: 'trim',
    display_name: 'trim()',
    parameters: [
      // { name: 'is_regex', label: 'Is Regex', type: 'checkbox', required: true, description: 'Is Regex' },
      { name: 'strip', label: 'Strip (optional)', type: 'string', required: false, description: 'Character to strip' },
    ],
    returnType: 'string',
    description: 'Removes whitespace from both ends of the string'
  },
  {
    name: 'trimStart',
    display_name: 'trimStart()',
    parameters: [
      // { name: 'is_regex', label: 'Is Regex', type: 'checkbox', required: true, description: 'Is Regex' },
      { name: 'strip', label: 'Strip (optional)', type: 'string', required: false, description: 'Character to strip' },
    ],
    returnType: 'string',
    description: 'Removes whitespace from the beginning of the string'
  },
  {
    name: 'trimEnd',
    display_name: 'trimEnd()',
    parameters: [
      // { name: 'is_regex', label: 'Is Regex', type: 'checkbox', required: true, description: 'Is Regex' },
      { name: 'strip', label: 'Strip (optional)', type: 'string', required: false, description: 'Character to strip' },
    ],
    returnType: 'string',
    description: 'Removes whitespace from the end of the string'
  },
  {
    name: 'split',
    display_name: 'split()',
    parameters: [
      { name: 'is_regex', label: 'Is Regex', type: 'checkbox', required: true, description: 'Is Regex' },
      { name: 'separator', label: 'separator', type: 'string', required: false, description: 'String or regex to split on (optional)' },
      { name: 'limit', label: 'Index', type: 'number', required: false, description: 'Maximum number of splits (optional)' }
    ],
    returnType: 'string[]',
    description: 'Splits string into an array of substrings'
  },
  {
  name: 'extract',
  display_name: 'extract()',
  parameters: [
    { 
      name: 'pattern', 
      label: 'pattern', 
      type: 'string', 
      required: true, 
      description: 'A valid regular expression pattern containing at least one capture group' 
    },
    { 
      name: 'group_index', 
      label: 'groupIndex', 
      type: 'number', 
      required: false, 
      description: 'Index of the targeted capture group. Group 0 means the whole pattern, the first group begins at index 1. Defaults to 1.' 
    }
  ],
  returnType: 'string',
  description: 'Extract the target capture group from provided patterns. Returns null if original value is null or regex captures nothing.'
},
{
  name: 'extract_all',
  display_name: 'extract_all()',
  parameters: [
    { 
      name: 'pattern', 
      label: 'pattern', 
      type: 'string', 
      required: true, 
      description: 'A valid regular expression pattern compatible with the regex crate' 
    }
  ],
  returnType: 'string[]',
  description: 'Extract all matches for the given regex pattern. Extract each successive non-overlapping regex match in an individual string as a list. Returns null if the haystack string is null.'
},
  // {
  //   name: 'startsWith',
  //   display_name: 'startsWith()',
  //   parameters: [
  //     { name: 'search_value', label: 'searchValue', type: 'string', required: true, description: 'String to search for' },
  //     { name: 'position', label: 'position', type: 'number', required: false, description: 'Position to start searching (optional)' }
  //   ],
  //   returnType: 'boolean',
  //   description: 'Checks if string starts with the specified substring'
  // },
  // {
  //   name: 'endsWith',
  //   display_name: 'endsWith()',
  //   parameters: [
  //     { name: 'search_value', label: 'searchValue', type: 'string', required: true, description: 'String to search for' },
  //     { name: 'position', label: 'position', type: 'number', required: false, description: 'Position to end searching (optional)' }
  //   ],
  //   returnType: 'boolean',
  //   description: 'Checks if string ends with the specified substring'
  // },
  {
    name: 'reverse',
    display_name: 'reverse()',
    parameters: [],
    returnType: 'string',
    description: 'Reverses the order of the characters in the string.'
  },
  {
    name: 'to_titlecase',
    display_name: 'to_titlecase()',
    parameters: [],
    returnType: 'string',
    description: 'Converts the string to title case (e.g., "hello world" -> "Hello World").'
  },
  {
    name: 'padStart',
    display_name: 'padStart()',
    parameters: [
        { name: 'target_length', label: 'targetLength', type: 'number', required: true, description: 'The desired final length of the string.' },
        { name: 'pad_string', label: 'padString', type: 'string', required: false, description: 'The string to pad with. Defaults to a space.' }
    ],
    returnType: 'string',
    description: 'Pads the start of the string until it reaches the target length.'
  },
  {
      name: 'padEnd',
      display_name: 'padEnd()',
      parameters: [
          { name: 'target_length', label: 'targetLength', type: 'number', required: true, description: 'The desired final length of the string.' },
          { name: 'pad_string', label: 'padString', type: 'string', required: false, description: 'The string to pad with. Defaults to a space.' }
      ],
      returnType: 'string',
      description: 'Pads the end of the string until it reaches the target length.'
  },
  {
      name: 'containsAny',
      display_name: 'containsAny()',
      parameters: [
        { name: 'is_regex', label: 'Is Regex', type: 'checkbox', required: true, description: 'Is Regex' },
          { name: 'values', type: 'string', required: true, description: 'A comma-separated list of substrings to check for.' }
      ],
      returnType: 'boolean',
      description: 'Checks if the string contains any of the specified substrings.'
  },
  {
    name: 'to_str',
    display_name: 'to_str()',
    parameters: [],
    returnType: 'string',
    description: 'Converts the input value to its string representation.'
  },
  {
    name: 'to_int',
    display_name: 'to_int()',
    parameters: [],
    returnType: 'number',
    description: 'Converts the string to an integer (base 10).'
  },
  {
    name: 'to_float',
    display_name: 'to_float()',
    parameters: [],
    returnType: 'number',
    description: 'Converts the string to a floating-point number.'
  },
  {
    name: 'to_date',
    display_name: 'to_date()',
    parameters: [
      { name: 'input_format', label: 'inputFormat', type: 'string', required: false, description: 'Optional: The Polars-like format of the input string (e.g., %Y-%m-%d %H:%M:%S).' }
    ],
    returnType: 'string', 
    description: 'Parses the string as a date and returns its yyyy-MM-dd format.'
  },
  {
    name: 'to_datetime',
    display_name: 'to_datetime()',
    parameters: [
      { name: 'input_format', label: 'inputFormat', type: 'string', required: false, description: 'Optional: The format of the input string (e.g., MM/dd/yyyy HH:mm).' }
    ],
    returnType: 'string',
    description: 'Parses the string as a datetime and returns its ISO string format.'
  },
  {
    name: 'to_time',
    display_name: 'to_time()',
    parameters: [
      { name: 'input_format', label: 'inputFormat', type: 'string', required: false, description: 'Optional: The Polars-like format of the input string (e.g., %H:%M:%S).' }
    ],
    returnType: 'string',
    description: 'Parses the string as a date and returns the time portion (HH:mm:ss).'
  },
  {
    name: 'strftime',
    display_name: 'strftime()',
    parameters: [
        { name: 'format', type: 'string', required: true, description: 'The Polars-like format string (e.g., %Y-%m-%d).' }
    ],
    returnType: 'string',
    description: 'Formats a date string according to a Polars-like format string.'
  },
  {
    name: 'from_epoch',
    display_name: 'from_epoch()',
    parameters: [
        {
          name: 'time_unit',
          label: 'timeUnit',
          type: 'select',
          required: true,
          description: 'Time unit for epoch conversion',
          options: [
            { value: 'd', label: 'd (Date)' },
            { value: 's', label: 's (Datetime[us])' },
            { value: 'ms', label: 'ms (Datetime[ms])' },
            { value: 'us', label: 'us (Datetime[us])' },
            { value: 'ns', label: 'ns (Datetime[ns])' }
          ]
        }
    ],
    returnType: 'string',
    description: 'Converts epoch timestamp to date or datetime. Returns Date if time_unit="d", otherwise returns Datetime with specified precision.'
  },
  {
    name: "len_chars",
    display_name: "len_chars()",
    parameters: [],
    returnType: "number",
    description: "Returns the number of characters in each string." 
  },
  {
    name: "len_bytes",
    display_name: "len_bytes()",
    parameters: [],
    returnType: "number",
    description: "Returns the number of bytes in each string."
  },
  {
    name: 'abs',
    display_name: 'abs()',
    parameters: [],
    returnType: 'number',
    description: 'Returns the absolute value of a number (converts string to number first).'
  },
  {
    name: 'round',
    display_name: 'round()',
    parameters: [
      { name: 'decimals', label: 'decimals', type: 'number', required: false, description: 'Number of decimal places to round to (optional, default: 0).' }
    ],
    returnType: 'number',
    description: 'Rounds a number to the specified number of decimal places (converts string to number first).'
  },
  {
    name: 'cumsum',
    display_name: 'cumsum()',
    parameters: [     { name: 'is_reverse', label: 'Is Reverse', type: 'checkbox', required: true, description: 'Is Regex' },
],
    returnType: 'number',
    description: 'Calculates the cumulative sum over the column (converts string to number first).'
  },
  {
    name: 'floor',
    display_name: 'floor()',
    parameters: [],
    returnType: 'number',
    description: 'Returns the largest integer less than or equal to the number (converts string to number first).'
  },
  {
    name: 'ceil',
    display_name: 'ceil()',
    parameters: [],
    returnType: 'number',
    description: 'Returns the smallest integer greater than or equal to the number (converts string to number first).'
  },
  {
    name: 'clip',
    display_name: 'clip()',
    parameters: [
      { name: 'min_value', label: 'minValue', type: 'number', required: false, description: 'Minimum value to clip to (optional).' },
      { name: 'max_value', label: 'maxValue', type: 'number', required: false, description: 'Maximum value to clip to (optional).' }
    ],
    returnType: 'number',
    description: 'Clips (constrains) values to be within the specified range (converts string to number first).'
  },
  // {
  //   name: 'count',
  //   display_name: 'count()',
  //   parameters: [],
  //   returnType: 'number',
  //   description: 'Returns the count of non-null values in the column.'
  // },
  {
    name: 'fill_null',
    display_name: 'fill_null()',
    parameters: [
      { name: 'fill_value', label: 'fillValue', type: 'string-or-column', required: true, description: 'Value to replace null/empty values with (manual value or from column).' }
    ],
    returnType: 'string',
    description: 'Replaces null or empty values with the specified fill value.'
  }
];

export interface TransformationOperation {  
  name: string;
  label: string;
  category: 'string' | 'arithmetic' | 'logical' | 'aggregation';
  parameters: {
    name: string;
    label: string;
    type: 'text' | 'number' | 'select' | 'checkbox' | 'column' | 'textarea' | 'concat-sources';
    options?: { value: string; label: string }[];
    defaultValue?: any;
    placeholder?: string;
  }[];
}

export const TRANSFORMATION_OPERATIONS: TransformationOperation[] = [
  // String Operations
  { name: 'to_uppercase', label: 'To Uppercase', category: 'string', parameters: [] },
  { name: 'to_lowercase', label: 'To Lowercase', category: 'string', parameters: [] },
  { name: 'to_titlecase', label: 'To Title Case', category: 'string', parameters: [] },
  { name: 'reverse', label: 'Reverse', category: 'string', parameters: [] },
  { name: 'trim', label: 'Trim', category: 'string', parameters: [{ name: 'strip', label: 'Characters to Strip', type: 'text', placeholder: 'e.g., #*' }] },
  { name: 'trimStart', label: 'Trim Start', category: 'string', parameters: [{ name: 'strip', label: 'Characters to Strip', type: 'text', placeholder: 'e.g., #*' }] },
  { name: 'trimEnd', label: 'Trim End', category: 'string', parameters: [{ name: 'strip', label: 'Characters to Strip', type: 'text', placeholder: 'e.g., #*' }] },
  { name: 'replace', label: 'Replace', category: 'string', parameters: [ { name: 'search_value', label: 'Search For', type: 'text', placeholder: 'Text or Regex' }, { name: 'replace_value', label: 'Replace With', type: 'text' }, { name: 'is_regex', label: 'Use Regex', type: 'checkbox', defaultValue: false } ] },
  { name: 'replaceAll', label: 'Replace All', category: 'string', parameters: [ { name: 'search_value', label: 'Search For', type: 'text', placeholder: 'Text or Regex' }, { name: 'replace_value', label: 'Replace With', type: 'text' }, { name: 'is_regex', label: 'Use Regex', type: 'checkbox', defaultValue: false } ] },
  { name: 'split', label: 'Split', category: 'string', parameters: [ { name: 'separator', label: 'Separator', type: 'text' }, { name: 'is_regex', label: 'Use Regex', type: 'checkbox', defaultValue: false }, { name: 'limit', label: 'Return Index', type: 'number', placeholder: 'e.g., 0' } ] },
  { name: 'substring', label: 'Substring', category: 'string', parameters: [ { name: 'start', label: 'Start Index', type: 'number', placeholder: '0' }, { name: 'end', label: 'End Index (optional)', type: 'number' } ] },
  { name: 'padStart', label: 'Pad Start', category: 'string', parameters: [ { name: 'targetLength', label: 'Target Length', type: 'number' }, { name: 'padString', label: 'Pad With', type: 'text', placeholder: ' ' } ] },
  { name: 'padEnd', label: 'Pad End', category: 'string', parameters: [ { name: 'targetLength', label: 'Target Length', type: 'number' }, { name: 'padString', label: 'Pad With', type: 'text', placeholder: ' ' } ] },
  { name: 'concat', label: 'Concatenate', category: 'string', parameters: [{ name: 'sources', label: 'Sources to Concatenate', type: 'concat-sources' }] },
  { name: 'fill_null', label: 'Fill Null', category: 'string', parameters: [{ name: 'fill_value', label: 'Fill With', type: 'text' }] },
  { name: 'to_str', label: 'Convert to String', category: 'string', parameters: [] },
  { name: 'to_date', label: 'To Date', category: 'string', parameters: [{ name: 'inputFormat', label: 'Input Format (optional)', type: 'text', placeholder: '%Y-%m-%d' }] },
  { name: 'to_datetime', label: 'To Datetime', category: 'string', parameters: [{ name: 'inputFormat', label: 'Input Format (optional)', type: 'text', placeholder: '%Y-%m-%d %H:%M:%S' }] },
  { name: 'to_time', label: 'To Time', category: 'string', parameters: [{ name: 'inputFormat', label: 'Input Format (optional)', type: 'text', placeholder: '%H:%M:%S' }] },
  { name: 'strftime', label: 'Format Date/Time', category: 'string', parameters: [{ name: 'outputFormat', label: 'Output Format', type: 'text', placeholder: '%Y-%m-%d' }] },
  {
    name: 'from_epoch',
    label: 'From Epoch',
    category: 'string',
    parameters: [
      {
        name: 'time_unit',
        label: 'Time Unit',
        type: 'select',
        options: [
          { value: 'd', label: 'd (Date)' },
          { value: 's', label: 's (Datetime[us])' },
          { value: 'ms', label: 'ms (Datetime[ms])' },
          { value: 'us', label: 'us (Datetime[us])' },
          { value: 'ns', label: 'ns (Datetime[ns])' }
        ]
      }
    ]
  },

  // Logical Operations
  // { name: 'equals', label: '=', category: 'logical', parameters: [{ name: 'value', label: 'Value', type: 'text' }] },
  // { name: 'greater_than', label: '>', category: 'logical', parameters: [{ name: 'value', label: 'Value', type: 'number' }] },
  // { name: 'less_than', label: '<', category: 'logical', parameters: [{ name: 'value', label: 'Value', type: 'number' }] },
  // { name: 'greater_than_or_equal', label: '>=', category: 'logical', parameters: [{ name: 'value', label: 'Value', type: 'number' }] },
  // { name: 'less_than_or_equal', label: '<=', category: 'logical', parameters: [{ name: 'value', label: 'Value', type: 'number' }] },
  
  // Aggregation/Arithmetic Operations
  { name: 'sum', label: 'Sum', category: 'aggregation', parameters: [] },
  { name: 'count', label: 'Count', category: 'aggregation', parameters: [] },
  { name: 'min', label: 'Min', category: 'aggregation', parameters: [] },
  { name: 'max', label: 'Max', category: 'aggregation', parameters: [] },
  { name: 'to_int', label: 'To Integer', category: 'aggregation', parameters: [] },
  { name: 'to_float', label: 'To Float', category: 'aggregation', parameters: [] },
  { name: 'abs', label: 'Absolute Value', category: 'aggregation', parameters: [] },
  { name: 'round', label: 'Round', category: 'aggregation', parameters: [{ name: 'decimals', label: 'Decimal Places', type: 'number', defaultValue: 0 }] },
  { name: 'floor', label: 'Floor', category: 'aggregation', parameters: [] },
  { name: 'ceil', label: 'Ceil', category: 'aggregation', parameters: [] },
];

// Data Filter Operations for filter nodes
export const DATA_FILTER_OPERATIONS: StringOperation[] = [
  {
    name: 'equals',
    display_name: 'Equals (=)',
    parameters: [
      { name: 'value', label: 'value', type: 'string', required: true, description: 'Value to compare with' }
    ],
    returnType: 'boolean',
    description: 'Checks if column value equals the specified value'
  },
  {
    name: 'notEquals',
    display_name: 'Not Equals (≠)',
    parameters: [
      { name: 'value', label: 'value', type: 'string', required: true, description: 'Value to compare with' }
    ],
    returnType: 'boolean',
    description: 'Checks if column value does not equal the specified value'
  },
  {
    name: 'greater_than',
    display_name: 'Greater Than (>)',
    parameters: [
      { name: 'value', label: 'value', type: 'number', required: true, description: 'Number to compare with' }
    ],
    returnType: 'boolean',
    description: 'Checks if column value is greater than the specified value'
  },
  {
    name: 'less_than',
    display_name: 'Less Than (<)',
    parameters: [
      { name: 'value', label: 'value', type: 'number', required: true, description: 'Number to compare with' }
    ],
    returnType: 'boolean',
    description: 'Checks if column value is less than the specified value'
  },
  {
    name: 'greater_than_or_equal',
    display_name: 'Greater Than or Equal (≥)',
    parameters: [
      { name: 'value', label: 'value', type: 'number', required: true, description: 'Number to compare with' }
    ],
    returnType: 'boolean',
    description: 'Checks if column value is greater than or equal to the specified value'
  },
  {
    name: 'less_than_or_equal',
    display_name: 'Less Than or Equal (≤)',
    parameters: [
      { name: 'value', label: 'value', type: 'number', required: true, description: 'Number to compare with' }
    ],
    returnType: 'boolean',
    description: 'Checks if column value is less than or equal to the specified value'
  },
  {
    name: 'is_null',
    display_name: 'Is Null',
    parameters: [],
    returnType: 'boolean',
    description: 'Checks if column value is null or empty'
  },
  {
    name: 'is_not_null',
    display_name: 'Is Not Null',
    parameters: [],
    returnType: 'boolean',
    description: 'Checks if column value is not null or empty'
  },
  {
    name: 'startsWith',
    display_name: 'Starts With',
    parameters: [
      { name: 'value', label: 'value', type: 'string', required: true, description: 'String to check if column starts with' }
    ],
    returnType: 'boolean',
    description: 'Checks if column value starts with the specified string'
  },
  {
    name: 'endsWith',
    display_name: 'Ends With',
    parameters: [
      { name: 'value', label: 'value', type: 'string', required: true, description: 'String to check if column ends with' }
    ],
    returnType: 'boolean',
    description: 'Checks if column value ends with the specified string'
  },
  {
    name: 'not_starts_with',
    display_name: 'Does Not Start With',
    parameters: [
      { name: 'value', label: 'value', type: 'string', required: true, description: 'String to check if column does not start with' }
    ],
    returnType: 'boolean',
    description: 'Checks if column value does not start with the specified string'
  },
  {
    name: 'not_ends_with',
    display_name: 'Does Not End With',
    parameters: [
      { name: 'value', label: 'value', type: 'string', required: true, description: 'String to check if column does not end with' }
    ],
    returnType: 'boolean',
    description: 'Checks if column value does not end with the specified string'
  },
  {
    name: 'is_in',
    display_name: 'Is In (comma separated)',
    parameters: [
      { name: 'values', label: 'values', type: 'string', required: true, description: 'Comma-separated list of values' }
    ],
    returnType: 'boolean',
    description: 'Checks if column value is in the specified list of values'
  },
  {
    name: 'not_is_in',
    display_name: 'Is Not In (comma separated)',
    parameters: [
      { name: 'values', label: 'values', type: 'string', required: true, description: 'Comma-separated list of values' }
    ],
    returnType: 'boolean',
    description: 'Checks if column value is not in the specified list of values'
  }
];

