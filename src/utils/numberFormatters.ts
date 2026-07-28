/**
 * Formats a number with standard financial abbreviations (K, M, B)
 * @param num - The number to format
 * @param options - Formatting options
 * @returns Formatted string
 */
export interface FormatNumberOptions {
  /** Show short format (1.25M) or full format (1,250,000) */
  format?: 'short' | 'full' | 'both';
  /** Minimum value to apply formatting (default: 1000) */
  minValue?: number;
}

export function formatNumber(num: number, options: FormatNumberOptions = {}): string {
  const { format = 'short', minValue = 1000 } = options;

  if (typeof num !== 'number' || isNaN(num)) {
    return String(num || '0');
  }

  // Handle zero and small values without conversion
  const absNum = Math.abs(num);
  if (absNum < minValue) {
    // For values less than minValue, show with up to 2 decimal places if needed
    if (format === 'full') {
      return num.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
    }
    // Round intelligently: show decimals only if needed
    const rounded = absNum < 1 ? absNum.toFixed(2).replace(/\.?0+$/, '') : Math.round(absNum).toString();
    return num < 0 ? `-${rounded}` : rounded;
  }

  const sign = num < 0 ? '-' : '';
  let formatted: string;
  let fullFormatted: string;

  if (absNum >= 1000000000) {
    // Billions
    const bValue = absNum / 1000000000;
    const rounded = Math.round(bValue * 100) / 100; // Round to 2 decimal places
    formatted = rounded.toFixed(2).replace(/\.?0+$/, '');
    fullFormatted = num.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    
    if (format === 'full') {
      return fullFormatted;
    } else if (format === 'both') {
      return `${sign}${formatted}B (${fullFormatted})`;
    }
    return `${sign}${formatted}B`;
  } else if (absNum >= 1000000) {
    // Millions
    const mValue = absNum / 1000000;
    const rounded = Math.round(mValue * 100) / 100; // Round to 2 decimal places
    formatted = rounded.toFixed(2).replace(/\.?0+$/, '');
    fullFormatted = num.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    
    if (format === 'full') {
      return fullFormatted;
    } else if (format === 'both') {
      return `${sign}${formatted}M (${fullFormatted})`;
    }
    return `${sign}${formatted}M`;
  } else if (absNum >= 1000) {
    // Thousands
    const kValue = absNum / 1000;
    const rounded = Math.round(kValue * 100) / 100; // Round to 2 decimal places
    formatted = rounded.toFixed(2).replace(/\.?0+$/, '');
    fullFormatted = num.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    
    if (format === 'full') {
      return fullFormatted;
    } else if (format === 'both') {
      return `${sign}${formatted}K (${fullFormatted})`;
    }
    return `${sign}${formatted}K`;
  } else {
    // Less than 1000
    fullFormatted = num.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    
    if (format === 'full') {
      return fullFormatted;
    } else if (format === 'both') {
      return `${fullFormatted} (${fullFormatted})`;
    }
    return fullFormatted;
  }
}

