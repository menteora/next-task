import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Subtask } from '../types';
import { CalendarX2Icon, GripVerticalIcon, ChevronDoubleUpIcon, ChevronUpIcon, ChevronDownIcon, ChevronDoubleDownIcon, EditIcon } from './icons';
import MarkdownInput from './MarkdownInput';

interface TodaySubtaskItemProps {
  item: {
      subtask: Subtask;
      parentTaskTitle: string;
      parentTaskDescription: string;
      parentTaskId: string;
  };
  onToggleComplete: () => void;
  onRemove: () => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  isDragging: boolean;
  onMoveSubtask: (subtaskId: string, direction: 'up' | 'down' | 'top' | 'bottom') => void;
  subtaskIndex: number;
  totalSubtasks: number;
  onUpdateParentTaskDescription: (taskId: string, newDescription: string) => void;
  onUpdateSubtaskText: (taskId: string, subtaskId: string, newText: string) => void;
}

const TodaySubtaskItem: React.FC<TodaySubtaskItemProps> = ({ item, onToggleComplete, onRemove, onDragStart, onDragOver, onDrop, isDragging, onMoveSubtask, subtaskIndex, totalSubtasks, onUpdateParentTaskDescription, onUpdateSubtaskText }) => {
  const { subtask, parentTaskTitle, parentTaskDescription, parentTaskId } = item;
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editingDescriptionText, setEditingDescriptionText] = useState(parentTaskDescription);
  const [isEditing, setIsEditing] = useState(false);
  const [editingText, setEditingText] = useState(subtask.text);

  useEffect(() => {
    setEditingDescriptionText(parentTaskDescription);
  }, [parentTaskDescription]);
  
  useEffect(() => {
    if (!isEditing) {
        setEditingText(subtask.text);
    }
  }, [subtask.text, isEditing]);

  const handleSaveDescription = () => {
    onUpdateParentTaskDescription(parentTaskId, editingDescriptionText);
    setIsEditingDescription(false);
  };

  const handleStartEdit = () => {
    if (subtask.completed) return;
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingText(subtask.text);
  };
  
  const handleSaveEdit = () => {
    if (!editingText.trim()) {
        handleCancelEdit();
        return;
    }
    onUpdateSubtaskText(parentTaskId, subtask.id, editingText.trim());
    setIsEditing(false);
  };

  const isAtTop = subtaskIndex === 0;
  const isAtBottom = subtaskIndex === totalSubtasks - 1;

  let overdueDays = 0;
  if (!subtask.completed && subtask.dueDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dueDate = new Date(subtask.dueDate + 'T00:00:00');

    if (dueDate < today) {
      const diffTime = today.getTime() - dueDate.getTime();
      overdueDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    }
  }

  return (
    <div 
        draggable={!subtask.completed}
        onDragStart={!subtask.completed ? onDragStart : undefined}
        onDragOver={!subtask.completed ? onDragOver : undefined}
        onDrop={!subtask.completed ? onDrop : undefined}
        className={`bg-white dark:bg-gray-800 p-2 sm:p-3 rounded-lg shadow-md mb-3 flex flex-col transition-all ${isDragging ? 'opacity-50' : ''} ${subtask.completed ? 'opacity-70' : ''}`}
    >
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between">
        <div className="flex items-start flex-grow min-w-0">
          {!subtask.completed && (
            <div className="cursor-grab p-1 mr-1 sm:mr-2 mt-0.5">
              <GripVerticalIcon />
            </div>
          )}
          <input
            type="checkbox"
            id={`today-subtask-${subtask.id}`}
            className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 bg-gray-200 dark:bg-gray-700 text-teal-600 dark:text-teal-500 focus:ring-teal-500 dark:focus:ring-teal-600 cursor-pointer flex-shrink-0 mt-1"
            checked={subtask.completed}
            onChange={onToggleComplete}
          />
          <div className="ml-3 min-w-0 flex-grow">
              {isEditing && !subtask.completed ? (
                 <input
                    autoFocus
                    type="text"
                    value={editingText}
                    onChange={e => setEditingText(e.target.value)}
                    onBlur={handleSaveEdit}
                    onKeyDown={e => {
                        if (e.key === 'Enter') handleSaveEdit();
                        if (e.key === 'Escape') handleCancelEdit();
                    }}
                    className="w-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              ) : (
                <label htmlFor={`today-subtask-${subtask.id}`} className={`text-gray-700 dark:text-gray-200 cursor-pointer break-words ${subtask.completed ? 'line-through text-gray-500 dark:text-gray-500' : ''}`}>
                    {subtask.text}
                </label>
              )}
              {subtask.completed && subtask.completionDate && (
                  <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                      (Completed: {new Date(subtask.completionDate).toLocaleDateString()})
                  </span>
              )}
              <div className="flex items-center flex-wrap gap-x-2 mt-0.5">
                  <p className="text-xs text-cyan-600 dark:text-cyan-500 truncate">{parentTaskTitle}</p>
                  {overdueDays > 0 && (
                      <span className="text-xs font-semibold text-red-500 dark:text-red-400 bg-red-100 dark:bg-red-900/50 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                          {overdueDays} {overdueDays === 1 ? 'giorno in ritardo' : 'giorni in ritardo'}
                      </span>
                  )}
              </div>
          </div>
        </div>
        <div className="flex items-center justify-end flex-wrap gap-2 mt-2 sm:mt-0 sm:ml-4 flex-shrink-0">
          {!subtask.completed && (
              <div className="flex items-center border border-gray-200 dark:border-gray-600 rounded-md">
                  <button onClick={() => onMoveSubtask(subtask.id, 'top')} disabled={isAtTop} className="p-1.5 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500 hover:text-cyan-500 dark:text-gray-400 dark:hover:text-cyan-400 transition-colors" title="Move to top" aria-label="Move subtask to top"><ChevronDoubleUpIcon className="h-4 w-4" /></button>
                  <button onClick={() => onMoveSubtask(subtask.id, 'up')} disabled={isAtTop} className="p-1.5 border-l border-gray-200 dark:border-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500 hover:text-cyan-500 dark:text-gray-400 dark:hover:text-cyan-400 transition-colors" title="Move up" aria-label="Move subtask up"><ChevronUpIcon className="h-4 w-4" /></button>
                  <button onClick={() => onMoveSubtask(subtask.id, 'down')} disabled={isAtBottom} className="p-1.5 border-l border-gray-200 dark:border-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500 hover:text-cyan-500 dark:text-gray-400 dark:hover:text-cyan-400 transition-colors" title="Move down" aria-label="Move subtask down"><ChevronDownIcon className="h-4 w-4" /></button>
                  <button onClick={() => onMoveSubtask(subtask.id, 'bottom')} disabled={isAtBottom} className="p-1.5 border-l border-gray-200 dark:border-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500 hover:text-cyan-500 dark:text-gray-400 dark:hover:text-cyan-400 transition-colors" title="Move to bottom" aria-label="Move subtask to bottom"><ChevronDoubleDownIcon className="h-4 w-4" /></button>
              </div>
          )}
          {!subtask.completed && (
            <button 
              onClick={handleStartEdit} 
              className="text-gray-400 dark:text-gray-500 hover:text-cyan-500 dark:hover:text-cyan-400 transition-colors p-1"
              aria-label="Edit subtask"
              title="Edit subtask"
            >
                <EditIcon className="h-4 w-4"/>
            </button>
          )}
          {parentTaskDescription && (
            <button 
              onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)} 
              className="text-gray-400 dark:text-gray-500 hover:text-cyan-500 dark:hover:text-cyan-400 transition-colors p-1"
              aria-label="Toggle parent task description"
              title="Toggle parent task description"
            >
                {isDescriptionExpanded ? <ChevronUpIcon className="h-4 w-4"/> : <ChevronDownIcon className="h-4 w-4"/>}
            </button>
          )}
          <button
            onClick={onRemove}
            className="text-gray-400 dark:text-gray-500 hover:text-yellow-600 dark:hover:text-yellow-500 transition-colors p-1"
            aria-label={`Unschedule subtask ${subtask.text}`}
            title="Unschedule (remove from Today)"
          >
            <CalendarX2Icon />
          </button>
        </div>
      </div>
      {isDescriptionExpanded && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 w-full">
          {isEditingDescription ? (
            <div>
              <MarkdownInput
                value={editingDescriptionText}
                onChange={setEditingDescriptionText}
                rows={4}
                autoFocus
              />
              <div className="flex justify-end space-x-2 mt-2">
                <button onClick={() => setIsEditingDescription(false)} className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-1 px-3 rounded-md text-sm transition-colors">
                  Cancel
                </button>
                <button onClick={handleSaveDescription} className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-1 px-3 rounded-md text-sm transition-colors">
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div className="flex justify-between items-start">
              <div className="prose max-w-none text-sm flex-grow">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{parentTaskDescription || 'No description.'}</ReactMarkdown>
              </div>
              <button onClick={() => setIsEditingDescription(true)} className="text-gray-400 dark:text-gray-500 hover:text-cyan-500 dark:hover:text-cyan-400 transition-colors p-1 flex-shrink-0 ml-4 -mt-1" aria-label="Edit description">
                <EditIcon className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default React.memo(TodaySubtaskItem);