import React from 'react';
import { Subtask } from '../types';
import { TrashIcon, GripVerticalIcon } from './icons';

interface TodaySubtaskItemProps {
  item: {
      subtask: Subtask;
      parentTaskTitle: string;
  };
  onToggleComplete: () => void;
  onRemove: () => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  isDragging: boolean;
}

const TodaySubtaskItem: React.FC<TodaySubtaskItemProps> = ({ item, onToggleComplete, onRemove, onDragStart, onDragOver, onDrop, isDragging }) => {
  const { subtask, parentTaskTitle } = item;
  return (
    <div 
        draggable
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        className={`bg-white dark:bg-gray-800 p-2 sm:p-3 rounded-lg shadow-md mb-3 flex items-center justify-between transition-opacity ${isDragging ? 'opacity-50' : 'opacity-100'}`}
    >
      <div className="flex items-center flex-grow min-w-0">
        <div className="cursor-grab p-1 mr-1 sm:mr-2">
          <GripVerticalIcon />
        </div>
        <input
          type="checkbox"
          id={`today-subtask-${subtask.id}`}
          className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 bg-gray-200 dark:bg-gray-700 text-teal-600 dark:text-teal-500 focus:ring-teal-500 dark:focus:ring-teal-600 cursor-pointer flex-shrink-0"
          checked={subtask.completed}
          onChange={onToggleComplete}
        />
        <div className="ml-3 min-w-0">
            <label htmlFor={`today-subtask-${subtask.id}`} className={`text-gray-700 dark:text-gray-200 cursor-pointer break-words ${subtask.completed ? 'line-through text-gray-500 dark:text-gray-500' : ''}`}>
                {subtask.text}
            </label>
             {subtask.completed && subtask.completionDate && (
                <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                    (Completed: {new Date(subtask.completionDate).toLocaleDateString()})
                </span>
            )}
            <p className="text-xs text-cyan-600 dark:text-cyan-500 mt-0.5 truncate">{parentTaskTitle}</p>
        </div>
      </div>
      <button
        onClick={onRemove}
        className="text-gray-400 dark:text-gray-500 hover:text-red-500 transition-colors ml-2 p-1 flex-shrink-0"
        aria-label={`Remove subtask ${subtask.text} from today`}
      >
        <TrashIcon />
      </button>
    </div>
  );
};

export default React.memo(TodaySubtaskItem);