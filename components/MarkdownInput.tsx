import React from 'react';
import { LinkIcon, CalendarPlusIcon } from './icons';

interface MarkdownInputProps {
  value: string;
  onChange: (newValue: string) => void;
  placeholder?: string;
  rows?: number;
  autoFocus?: boolean;
}

const MarkdownInput: React.FC<MarkdownInputProps> = ({ value, onChange, placeholder, rows = 3, autoFocus = false }) => {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const getCurrentDateTimeStringForLog = () => {
    return new Date().toLocaleString(undefined, {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  };

  const insertTextAndSelect = (textToInsert: string, selectionStartOffset: number, selectionEndOffset: number) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    
    // Replace selected text or insert at cursor position
    const newText = text.substring(0, start) + textToInsert + text.substring(end);
    
    onChange(newText);
    
    // After re-render, focus and select the text
    setTimeout(() => {
        if (textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.selectionStart = start + selectionStartOffset;
            textareaRef.current.selectionEnd = start + selectionEndOffset;
        }
    }, 0);
  };
  
  const insertText = (textToInsert: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;

      // Add a newline before if the cursor is not at the start of a line
      const shouldPrependNewline = start > 0 && text.substring(start - 1, start) !== '\n';
      const final_text_to_insert = (shouldPrependNewline ? '\n' : '') + textToInsert;

      const newText = text.substring(0, start) + final_text_to_insert + text.substring(end);
      onChange(newText);

      setTimeout(() => {
          if (textareaRef.current) {
              textareaRef.current.focus();
              const newCursorPos = start + final_text_to_insert.length;
              textareaRef.current.selectionStart = newCursorPos;
              textareaRef.current.selectionEnd = newCursorPos;
          }
      }, 0);
  }

  const handleInsertLink = () => {
    insertTextAndSelect('[link text](url)', 12, 15);
  };

  const handleInsertDateLog = () => {
    insertText(`### ${getCurrentDateTimeStringForLog()}\n`);
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-1 p-1 rounded-md bg-gray-200 dark:bg-gray-800 w-fit">
        <button 
            type="button" 
            onClick={handleInsertLink}
            className="flex items-center gap-1 p-1 rounded-md text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
            title="Insert Link (Markdown)"
        >
            <LinkIcon />
        </button>
        <button 
            type="button" 
            onClick={handleInsertDateLog}
            className="flex items-center gap-1 p-1 rounded-md text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
            title="Insert Today's Date Log"
        >
            <CalendarPlusIcon className="h-4 w-4" />
        </button>
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        autoFocus={autoFocus}
        className="w-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white text-sm rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
      />
    </div>
  );
};

export default MarkdownInput;