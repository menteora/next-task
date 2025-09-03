import React from 'react';
import { Subtask } from '../types';
import { TrashIcon, GripVerticalIcon, ChevronDoubleUpIcon, ChevronUpIcon, ChevronDownIcon, ChevronDoubleDownIcon } from './icons';

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
  onMoveSubtask: (subtaskId: string, direction: 'up' | 'down' | 'top' | 'bottom') => void;
  subtaskIndex: number;
  totalSubtasks: number;
}

const TodaySubtaskItem: React.FC<TodaySubtaskItemProps> = ({ item, onToggleComplete, onRemove, onDragStart, onDragOver, onDrop, isDragging, onMoveSubtask, subtaskIndex, totalSubtasks }) => {
  const { subtask, parentTaskTitle } = item;
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
        className={`bg-white dark:bg-gray-800 p-2 sm:p-3 rounded-lg shadow-md mb-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between transition-all ${isDragging ? 'opacity-50' : ''} ${subtask.completed ? 'opacity-70' : ''}`}
    >
      <div className="flex items-center flex-grow min-w-0">
        {!subtask.completed && (
          <div className="cursor-grab p-1 mr-1 sm:mr-2">
            <GripVerticalIcon />
          </div>
        )}
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
        <button
          onClick={onRemove}
          className="text-gray-400 dark:text-gray-500 hover:text-red-500 transition-colors p-1"
          aria-label={`Remove subtask ${subtask.text} from today`}
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  );
};

export default React.memo(TodaySubtaskItem);