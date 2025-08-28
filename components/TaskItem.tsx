import React, { useState } from 'react';
import { Task } from '../types';
import { TrashIcon, ChevronDownIcon, GripVerticalIcon, EditIcon, CalendarPlusIcon, RepeatIcon, CalendarIcon, ChevronUpIcon, ChevronDoubleUpIcon, ChevronDoubleDownIcon } from './icons';

interface TaskItemProps {
  task: Task;
  onDelete: (taskId: string) => void;
  onUpdate: (updatedTask: Task) => void;
  onOpenSubtaskModal: (task: Task) => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, task: Task) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>, targetTask: Task) => void;
  isDragging: boolean;
  onSetSubtaskDueDate: (subtaskId: string, taskId: string, date: string) => void;
  onToggleTaskComplete: (taskId: string) => void;
  allTags: string[];
  isCompactView: boolean;
  onMoveTask: (taskId: string, direction: 'up' | 'down' | 'top' | 'bottom') => void;
  taskIndex: number;
  totalTasks: number;
}

const TaskItem: React.FC<TaskItemProps> = ({ task, onDelete, onUpdate, onOpenSubtaskModal, onDragStart, onDragOver, onDrop, isDragging, onSetSubtaskDueDate, onToggleTaskComplete, allTags, isCompactView, onMoveTask, taskIndex, totalTasks }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editingTitle, setEditingTitle] = useState(task.title);
  const [editingDescription, setEditingDescription] = useState(task.description);
  const [isRecurring, setIsRecurring] = useState(task.recurring ?? false);

  const getTodayDateString = () => new Date().toISOString().split('T')[0];

  const handleSave = () => {
    if (editingTitle.trim()) {
      onUpdate({
        ...task,
        title: editingTitle.trim(),
        description: editingDescription.trim(),
        recurring: isRecurring,
      });
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setEditingTitle(task.title);
    setEditingDescription(task.description);
    setIsRecurring(task.recurring ?? false);
    setIsEditing(false);
  };

  const handleAddTag = (tag: string) => {
    setEditingDescription(prev => `${prev.trim()} ${tag}`.trim());
  };

  const nextAction = task.subtasks.find(st => !st.completed);
  const allSubtasksCompleted = task.subtasks.length > 0 && task.subtasks.every(st => st.completed);

  const handleCompleteNextAction = () => {
    if (nextAction) {
      const updatedSubtasks = task.subtasks.map(st => 
        st.id === nextAction.id ? { ...st, completed: true, completionDate: new Date().toISOString() } : st
      );
      onUpdate({ ...task, subtasks: updatedSubtasks });
    }
  };

  const renderDescriptionWithTags = (description: string) => {
    if (!description) return null;
    const parts = description.split(/(#\w+)/g);
    return parts.map((part, index) => {
      if (part.startsWith('#')) {
        return (
          <span key={index} className="bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-400 font-semibold rounded px-1.5 py-0.5">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const suggestedTags = allTags.filter(tag => !editingDescription.includes(tag));
  const isAtTop = taskIndex === 0;
  const isAtBottom = taskIndex === totalTasks - 1;

  if (isCompactView) {
    return (
        <div
          draggable={!task.completed}
          onDragStart={(e) => onDragStart(e, task)}
          onDragOver={onDragOver}
          onDrop={(e) => onDrop(e, task)}
          className={`bg-white dark:bg-gray-800 p-2 rounded-lg shadow-md mb-2 flex items-center transition-all ${isDragging ? 'opacity-50' : 'opacity-100'} ${task.completed ? 'opacity-50 line-through' : ''}`}
        >
          {!task.completed && (
              <div className="cursor-grab p-1">
                  <GripVerticalIcon />
              </div>
            )}
          <span className="font-bold text-gray-700 dark:text-gray-300 ml-2 flex-grow">{task.title}</span>
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded-full">
            {task.subtasks.length} sub-tasks
          </span>
        </div>
    );
  }

  return (
    <div
      draggable={!isEditing && !task.completed}
      onDragStart={(e) => onDragStart(e, task)}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, task)}
      className={`bg-white dark:bg-gray-800 p-3 sm:p-4 rounded-lg shadow-md mb-3 sm:mb-4 flex flex-col transition-all ${isDragging ? 'opacity-50' : 'opacity-100'} ${task.completed ? 'opacity-60' : ''}`}
    >
      <div className="flex flex-col sm:flex-row justify-between sm:items-start">
         <div className="flex-grow w-full sm:mr-4">
            {isEditing ? (
            <div>
                <input
                autoFocus
                type="text"
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                className="w-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white font-bold text-lg rounded-md px-2 py-1 mb-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <textarea
                value={editingDescription}
                onChange={(e) => setEditingDescription(e.target.value)}
                placeholder="Description... use #tag to add tags"
                rows={3}
                className="w-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white text-sm rounded-md px-2 py-1 mb-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                {suggestedTags.length > 0 && (
                <div className="mt-2">
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Suggested tags:</h4>
                    <div className="flex flex-wrap gap-1">
                    {suggestedTags.map(tag => (
                        <button 
                        key={tag} 
                        onClick={() => handleAddTag(tag)}
                        className="px-2 py-0.5 text-xs rounded-full bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 transition-colors"
                        >
                        {tag}
                        </button>
                    ))}
                    </div>
                </div>
                )}
                <label className="flex items-center mt-3 text-sm text-gray-500 dark:text-gray-400">
                    <input
                        type="checkbox"
                        checked={isRecurring}
                        onChange={e => setIsRecurring(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 bg-gray-200 dark:bg-gray-700 text-teal-600 dark:text-teal-500 focus:ring-teal-500 dark:focus:ring-teal-600 cursor-pointer"
                    />
                    <span className="ml-2">Recurring Task</span>
                </label>
            </div>
            ) : (
                <div>
                    <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                        <h3 className={`font-bold text-lg text-cyan-600 dark:text-cyan-400 ${task.completed ? 'line-through' : ''}`}>{task.title}</h3>
                        {task.recurring && !task.completed && <RepeatIcon />}
                    </div>
                    <p className="text-gray-500 dark:text-gray-400 mt-1 whitespace-pre-wrap text-sm sm:text-base">
                        {renderDescriptionWithTags(task.description)}
                    </p>
                </div>
            )}
         </div>
        <div className="flex items-center flex-wrap justify-end gap-2 flex-shrink-0 self-end sm:self-start mt-3 sm:mt-0">
            {!task.completed && !isEditing && (
              <>
                <div className="cursor-grab p-1">
                    <GripVerticalIcon />
                </div>
                 <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-md">
                    <button onClick={() => onMoveTask(task.id, 'top')} disabled={isAtTop} className="p-1.5 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500 hover:text-cyan-500 dark:text-gray-400 dark:hover:text-cyan-400 transition-colors" title="Move to top" aria-label="Move task to top"><ChevronDoubleUpIcon /></button>
                    <button onClick={() => onMoveTask(task.id, 'up')} disabled={isAtTop} className="p-1.5 border-l border-gray-200 dark:border-gray-700 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500 hover:text-cyan-500 dark:text-gray-400 dark:hover:text-cyan-400 transition-colors" title="Move up" aria-label="Move task up"><ChevronUpIcon /></button>
                    <button onClick={() => onMoveTask(task.id, 'down')} disabled={isAtBottom} className="p-1.5 border-l border-gray-200 dark:border-gray-700 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500 hover:text-cyan-500 dark:text-gray-400 dark:hover:text-cyan-400 transition-colors" title="Move down" aria-label="Move task down"><ChevronDownIcon /></button>
                    <button onClick={() => onMoveTask(task.id, 'bottom')} disabled={isAtBottom} className="p-1.5 border-l border-gray-200 dark:border-gray-700 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500 hover:text-cyan-500 dark:text-gray-400 dark:hover:text-cyan-400 transition-colors" title="Move to bottom" aria-label="Move task to bottom"><ChevronDoubleDownIcon /></button>
                </div>
              </>
            )}
            {isEditing ? (
                <div className="flex items-center space-x-2">
                    <button onClick={handleSave} className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-1 px-3 rounded-md text-sm transition-colors">
                        Save
                    </button>
                    <button onClick={handleCancel} className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-1 px-3 rounded-md text-sm transition-colors">
                        Cancel
                    </button>
                </div>
            ) : !task.completed ? (
                <div className="flex items-center">
                    <button
                        onClick={() => setIsEditing(true)}
                        className="text-gray-400 dark:text-gray-500 hover:text-cyan-500 dark:hover:text-cyan-400 transition-colors p-1"
                        aria-label={`Edit task ${task.title}`}
                    >
                        <EditIcon />
                    </button>
                    <button
                        onClick={() => onDelete(task.id)}
                        className="text-gray-400 dark:text-gray-500 hover:text-red-500 transition-colors p-1"
                        aria-label={`Delete task ${task.title}`}
                    >
                        <TrashIcon />
                    </button>
                </div>
            ) : null}
        </div>
      </div>
      
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        {task.completed && task.completionDate ? (
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
            <p className="text-green-600 dark:text-green-500 font-semibold mb-2 sm:mb-0">Completed on: {new Date(task.completionDate).toLocaleDateString()}</p>
            <button
              onClick={() => onToggleTaskComplete(task.id)}
              className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-1 px-3 rounded-md text-sm transition-colors self-end sm:self-center"
            >
              Re-open Task
            </button>
          </div>
        ) : nextAction ? (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between group">
            <div className="flex items-center">
              <input 
                type="checkbox"
                id={`next-action-${nextAction.id}`}
                className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 bg-gray-200 dark:bg-gray-700 text-teal-600 dark:text-teal-500 focus:ring-teal-500 dark:focus:ring-teal-600 cursor-pointer"
                onChange={handleCompleteNextAction}
                checked={false}
              />
              <label htmlFor={`next-action-${nextAction.id}`} className="ml-3 text-gray-600 dark:text-gray-300 cursor-pointer">{nextAction.text}</label>
              {nextAction.dueDate && (
                  <span className="ml-3 flex items-center text-xs text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded-full">
                      <CalendarIcon className="h-4 w-4 mr-1" />
                      {new Date(nextAction.dueDate + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' })}
                  </span>
              )}
            </div>
             <div className="flex items-center space-x-2 self-end mt-2 sm:mt-0 sm:self-center">
                <button
                    onClick={() => onSetSubtaskDueDate(nextAction.id, task.id, getTodayDateString())}
                    className="text-gray-400 dark:text-gray-500 hover:text-yellow-500 dark:hover:text-yellow-400 transition-colors opacity-0 group-hover:opacity-100"
                    aria-label={`Schedule subtask ${nextAction.text} for today`}
                >
                    <CalendarPlusIcon />
                </button>
                <span className="text-xs font-semibold text-teal-700 dark:text-teal-400 bg-teal-100 dark:bg-teal-900/50 px-2 py-1 rounded-full">
                NEXT ACTION
                </span>
            </div>
          </div>
        ) : allSubtasksCompleted ? (
           <div className="flex justify-between items-center">
             <p className="text-gray-400 dark:text-gray-500 text-sm italic">All sub-tasks completed! 🎉</p>
             <button
                onClick={() => onToggleTaskComplete(task.id)}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-3 rounded-md text-sm transition-colors"
              >
                Complete Task
              </button>
           </div>
        ) : (
          <p className="text-gray-400 dark:text-gray-500 text-sm italic">
            No sub-tasks yet.
          </p>
        )}
      </div>

      {!task.completed && (
        <button onClick={() => onOpenSubtaskModal(task)} className="mt-4 text-sm text-cyan-600 dark:text-cyan-500 hover:text-cyan-700 dark:hover:text-cyan-400 self-start flex items-center">
            Manage Sub-tasks ({task.subtasks.length}) <ChevronDownIcon className="h-5 w-5 ml-1"/>
        </button>
      )}
    </div>
  );
};

export default React.memo(TaskItem);