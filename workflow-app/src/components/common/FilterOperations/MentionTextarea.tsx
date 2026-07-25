import React, { useState, useRef, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface Column {
  column: string;
  type?: string;
  description?: string;
}

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  columns: Column[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  variant?: 'textarea' | 'input';
  minHeight?: string;
}

export const MentionTextarea: React.FC<MentionTextareaProps> = ({
  value,
  onChange,
  columns,
  placeholder,
  disabled,
  className,
  onKeyDown,
  variant = 'textarea',
  minHeight = '60px',
}) => {
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [filteredColumns, setFilteredColumns] = useState<Column[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [mentionStartPos, setMentionStartPos] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);
  const mentionListRef = useRef<HTMLDivElement>(null);

  // Filter columns based on mention search
  useEffect(() => {
    if (mentionSearch) {
      const filtered = columns.filter(col =>
        col.column.toLowerCase().includes(mentionSearch.toLowerCase())
      );
      console.log('Filtered columns:', filtered.map(c => c.column));
      setFilteredColumns(filtered);
      setSelectedIndex(0);
    } else {
      console.log('All columns:', columns.map(c => c.column));
      setFilteredColumns(columns);
      setSelectedIndex(0);
    }
  }, [mentionSearch, columns]);

  // Debug showMentions state
  useEffect(() => {
    console.log('MentionTextarea state:', {
      showMentions,
      filteredColumnsLength: filteredColumns.length,
      filteredColumns: filteredColumns.map(c => c.column),
      mentionSearch
    });
  }, [showMentions, filteredColumns, mentionSearch]);

  // Handle text change and detect @ mentions
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    const newValue = e.target.value;
    const newCursorPos = e.target.selectionStart || 0;

    onChange(newValue);
    setCursorPosition(newCursorPos);

    // Check if we should show mention dropdown
    const textBeforeCursor = newValue.substring(0, newCursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      // Only show if @ is at start or preceded by whitespace
      const charBeforeAt = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' ';
      const isValidMention = /\s/.test(charBeforeAt) || lastAtIndex === 0;

      console.log('@ detected:', {
        lastAtIndex,
        textAfterAt,
        charBeforeAt,
        isValidMention,
        hasSpace: textAfterAt.includes(' '),
        columnsLength: columns.length,
        columns: columns.map(c => c.column)
      });

      if (isValidMention && !textAfterAt.includes(' ')) {
        console.log('Showing mentions dropdown');
        setShowMentions(true);
        setMentionSearch(textAfterAt);
        setMentionStartPos(lastAtIndex);
      } else {
        console.log('Not showing mentions - invalid or has space');
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  };

  // Insert selected column mention
  const insertMention = (columnName: string) => {
    const beforeMention = value.substring(0, mentionStartPos);
    const afterCursor = value.substring(cursorPosition);
    // Replace @ with just the column name
    const newValue = `${beforeMention}${columnName} ${afterCursor}`;
    const newCursorPos = beforeMention.length + columnName.length + 1; // +1 for space only

    onChange(newValue);
    setShowMentions(false);
    setMentionSearch('');

    // Restore focus and set cursor position
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  // Handle keyboard navigation in mention list
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if (showMentions && filteredColumns.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredColumns.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredColumns.length) % filteredColumns.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (filteredColumns[selectedIndex]) {
          e.preventDefault();
          insertMention(filteredColumns[selectedIndex].column);
          return;
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowMentions(false);
        return;
      }
    }

    // Call parent's onKeyDown if provided
    if (onKeyDown && (!showMentions || !['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(e.key))) {
      onKeyDown(e);
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    if (mentionListRef.current && showMentions) {
      const selectedItem = mentionListRef.current.children[selectedIndex] as HTMLElement;
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex, showMentions]);

  // Get caret position for dropdown placement
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (showMentions && textareaRef.current) {
      const textarea = textareaRef.current;
      const rect = textarea.getBoundingClientRect();

      // Position dropdown below the textarea
      setDropdownPosition({
        top: rect.height,
        left: 0,
      });
    }
  }, [showMentions]);

  const commonProps = {
    ref: textareaRef as any,
    value,
    onChange: handleChange,
    onKeyDown: handleKeyDown,
    placeholder,
    disabled,
    className: cn(className),
  };

  return (
    <div className="relative">
      {variant === 'textarea' ? (
        <Textarea
          {...commonProps}
          style={{ minHeight }}
        />
      ) : (
        <Input
          {...commonProps}
          type="text"
        />
      )}

      {/* Mention dropdown */}
      <AnimatePresence>
        {showMentions && filteredColumns.length > 0 && (
          <motion.div
            ref={mentionListRef}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 w-full max-w-md bg-popover border border-border rounded-lg shadow-lg overflow-hidden"
            style={{
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`,
              maxHeight: '240px',
            }}
          >
            <div className="p-2 bg-muted/50 border-b border-border">
              <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <span>@</span>
                <span>Select column</span>
              </div>
            </div>
            <div className="overflow-y-auto max-h-[200px]">
              {filteredColumns.map((col, index) => (
                <button
                  key={col.column}
                  type="button"
                  onClick={() => insertMention(col.column)}
                  className={cn(
                    'w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors cursor-pointer',
                    index === selectedIndex && 'bg-accent'
                  )}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="font-medium text-foreground">{col.column}</div>
                  {col.type && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {col.type}
                      {col.description && ` • ${col.description}`}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
