/**
 * Extract complete JSON objects from a streaming text buffer.
 * Returns parsed objects and any remaining incomplete string.
 */
export function extractCompleteJSON(text: string): { parsed: any[]; remaining: string } {
  const results: any[] = [];
  let remaining = text;
  let startIndex = 0;

  while (startIndex < remaining.length) {
    while (startIndex < remaining.length && /\s/.test(remaining[startIndex])) {
      startIndex++;
    }
    if (startIndex >= remaining.length) break;

    const char = remaining[startIndex];
    if (char !== '{' && char !== '[') {
      startIndex++;
      continue;
    }

    let depth = 0;
    let inString = false;
    let escapeNext = false;
    let endIndex = startIndex;

    for (let i = startIndex; i < remaining.length; i++) {
      const c = remaining[i];
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      if (c === '\\') {
        escapeNext = true;
        continue;
      }
      if (c === '"' && !escapeNext) {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (c === '{' || c === '[') {
          depth++;
        } else if (c === '}' || c === ']') {
          depth--;
          if (depth === 0) {
            endIndex = i + 1;
            break;
          }
        }
      }
    }

    if (depth === 0 && endIndex > startIndex) {
      try {
        const jsonStr = remaining.substring(startIndex, endIndex).trim();
        if (jsonStr) {
          const parsed = JSON.parse(jsonStr);
          results.push(parsed);
        }
        remaining = remaining.substring(endIndex);
        startIndex = 0;
      } catch {
        break;
      }
    } else {
      break;
    }
  }

  return { parsed: results, remaining };
}
