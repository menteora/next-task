import React, { useState, useMemo, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Task } from '../types';
import { TrashIcon, ChevronDownIcon, GripVerticalIcon, EditIcon, CalendarPlusIcon, CalendarIcon, ChevronUpIcon, ChevronDoubleUpIcon, ChevronDoubleDownIcon, ClockIcon, SnoozeIcon, CheckIcon, CalendarClockIcon } from './icons';
import MarkdownInput from './MarkdownInput';

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
  onSnoozeTask: (taskId: string, duration: 'day' | 'week' | 'month') => void;
  onUnsnoozeTask?: (taskId: string) => void;
  isDraggable: boolean;
  onUpdateSubtaskText: (taskId: string, subtaskId: string, newText: string) => void;
}

const TaskItem: React.FC<TaskItemProps> = ({ task, onDelete, onUpdate, onOpenSubtaskModal, onDragStart, onDragOver, onDrop, isDragging, onSetSubtaskDueDate, onToggleTaskComplete, allTags, isCompactView, onMoveTask, taskIndex, totalTasks, onSnoozeTask, onUnsnoozeTask, isDraggable, onUpdateSubtaskText }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editingTitle, setEditingTitle] = useState(task.title);
  const [editingDescription, setEditingDescription] = useState(task.description);
  const [editingSnoozeUntil, setEditingSnoozeUntil] = useState(task.snoozeUntil);
  const [isSnoozeMenuOpen, setIsSnoozeMenuOpen] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isEditingNextAction, setIsEditingNextAction] = useState(false);
  const [editingNextActionText, setEditingNextActionText] = useState('');

  useEffect(() => {
    // When task prop changes, if we are NOT editing, we should update our editing state
    // so that when editing begins, it has the latest data.
    if (!isEditing) {
        setEditingTitle(task.title);
        setEditingDescription(task.description);
        setEditingSnoozeUntil(task.snoozeUntil);
    }
  }, [isEditing, task.title, task.description, task.snoozeUntil]);

  const lastTouchedDaysAgo = useMemo(() => {
    const completedSubtasks = task.subtasks.filter(st => st.completed && st.completionDate);
    if (completedSubtasks.length === 0) {
      return null;
    }

    const lastCompletionDate = new Date(
      Math.max(
        ...completedSubtasks.map(st => new Date(st.completionDate!).getTime())
      )
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    lastCompletionDate.setHours(0, 0, 0, 0);
    
    const diffTime = today.getTime() - lastCompletionDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  }, [task.subtasks]);

  const getTodayDateString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const handleSave = () => {
    if (editingTitle.trim()) {
      onUpdate({
        ...task,
        title: editingTitle.trim(),
        description: editingDescription.trim(),
        snoozeUntil: editingSnoozeUntil,
      });
      setIsEditing(false);
      if (isDescriptionExpanded) setIsDescriptionExpanded(false);
    }
  };

  const handleCancel = () => {
    setEditingTitle(task.title);
    setEditingDescription(task.description);
    setEditingSnoozeUntil(task.snoozeUntil);
    setIsEditing(false);
  };

  const handleAddTag = (tag: string) => {
    setEditingDescription(prev => `${prev.trim()} ${tag}`.trim());
  };
  
  const handleSnooze = (duration: 'day' | 'week' | 'month') => {
    console.log(`[TaskItem] Snooze button clicked for task "${task.title}" (ID: ${task.id}) with duration: ${duration}`);
    onSnoozeTask(task.id, duration);
    setIsSnoozeMenuOpen(false);
  };

  const nextAction = task.subtasks.find(st => !st.completed);
  const allSubtasksCompleted = task.subtasks.length > 0 && task.subtasks.every(st => st.completed);
  const todayDateString = getTodayDateString();
  const isNextActionScheduledForToday = nextAction?.dueDate === todayDateString;
  const isNextActionScheduledForFuture = nextAction?.dueDate && nextAction.dueDate > todayDateString;
  const isSnoozedInFuture = task.snoozeUntil && task.snoozeUntil > todayDateString;


  const handleStartEditNextAction = () => {
    if (!nextAction) return;
    setIsEditingNextAction(true);
    setEditingNextActionText(nextAction.text);
  };

  const handleCancelEditNextAction = () => {
    setIsEditingNextAction(false);
    setEditingNextActionText('');
  };

  const handleSaveNextAction = () => {
    if (!nextAction || !editingNextActionText.trim()) {
        handleCancelEditNextAction();
        return;
    }
    onUpdateSubtaskText(task.id, nextAction.id, editingNextActionText.trim());
    handleCancelEditNextAction();
  };

  const suggestedTags = allTags.filter(tag => !editingDescription.includes(tag));
  const isAtTop = taskIndex === 0;
  const isAtBottom = taskIndex === totalTasks - 1;

  if (isCompactView) {
    return (
        <div
          draggable={isDraggable && !task.completed}
          onDragStart={(e) => onDragStart(e, task)}
          onDragOver={onDragOver}
          onDrop={(e) => onDrop(e, task)}
          className={`bg-white dark:bg-gray-800 p-2 rounded-lg shadow-md mb-2 flex items-center transition-all ${isDragging ? 'opacity-50' : 'opacity-100'} ${task.completed ? 'opacity-50 line-through' : ''}`}
        >
          {isDraggable && !task.completed && (
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
      draggable={isDraggable && !isEditing && !task.completed}
      onDragStart={(e) => onDragStart(e, task)}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, task)}
      className={`bg-white dark:bg-gray-800 p-3 sm:p-4 rounded-lg shadow-md mb-3 sm:mb-4 flex flex-col transition-all ${isDragging ? 'opacity-50' : 'opacity-100'} ${task.completed ? 'opacity-60' : ''}`}
    >
      <div className="flex flex-col sm:flex-row justify-between sm:items-start">
         <div className="flex-grow w-full sm:mr-4">
            {isEditing ? (
            <div className="space-y-2">
                <input
                autoFocus
                type="text"
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                className="w-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white font-bold text-lg rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <MarkdownInput
                  value={editingDescription}
                  onChange={setEditingDescription}
                  placeholder="Description... use #tag to add tags"
                  rows={4}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div>
                        <label htmlFor={`snooze-${task.id}`} className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Snooze Until</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                id={`snooze-${task.id}`}
                                value={editingSnoozeUntil || ''}
                                onChange={(e) => setEditingSnoozeUntil(e.target.value)}
                                min={todayDateString}
                                className="w-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            {editingSnoozeUntil && (
                                <button onClick={() => setEditingSnoozeUntil(undefined)} className="text-xs text-gray-500 hover:text-red-500">Clear</button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            ) : (
                <div>
                    <div className="flex items-center flex-wrap gap-2 text-gray-700 dark:text-gray-300">
                        <h3 className={`font-bold text-lg text-indigo-600 dark:text-indigo-400 ${task.completed ? 'line-through' : ''}`}>{task.title}</h3>
                        {lastTouchedDaysAgo !== null && !task.completed && (
                            <span className="flex items-center text-xs text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded-full font-medium whitespace-nowrap">
                                <ClockIcon className="h-4 w-4 mr-1" />
                                {lastTouchedDaysAgo === 0 ? 'Oggi' : `${lastTouchedDaysAgo}g fa`}
                            </span>
                        )}
                    </div>
                    {task.description && (
                      <button onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)} className="mt-2 flex items-center text-xs text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium">
                          {isDescriptionExpanded ? 'Nascondi Descrizione' : 'Mostra Descrizione'}
                          {isDescriptionExpanded ? <ChevronUpIcon className="h-4 w-4 ml-1" /> : <ChevronDownIcon className="h-4 w-4 ml-1" />}
                      </button>
                    )}
                </div>
            )}
         </div>
        <div className="flex items-center flex-wrap justify-end gap-2 flex-shrink-0 self-end sm:self-start mt-3 sm:mt-0">
            {isDraggable && !task.completed && !isEditing && (
              <>
                <div className="cursor-grab p-1">
                    <GripVerticalIcon />
                </div>
                 <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-md">
                    <button onClick={() => onMoveTask(task.id, 'top')} disabled={isAtTop} className="p-1.5 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500 hover:text-indigo-500 dark:text-gray-400 dark:hover:text-indigo-400 transition-colors" title="Move to top" aria-label="Move task to top"><ChevronDoubleUpIcon /></button>
                    <button onClick={() => onMoveTask(task.id, 'up')} disabled={isAtTop} className="p-1.5 border-l border-gray-200 dark:border-gray-700 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500 hover:text-indigo-500 dark:text-gray-400 dark:hover:text-indigo-400 transition-colors" title="Move up" aria-label="Move task up"><ChevronUpIcon /></button>
                    <button onClick={() => onMoveTask(task.id, 'down')} disabled={isAtBottom} className="p-1.5 border-l border-gray-200 dark:border-gray-700 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500 hover:text-indigo-500 dark:text-gray-400 dark:hover:text-indigo-400 transition-colors" title="Move down" aria-label="Move task down"><ChevronDownIcon /></button>
                    <button onClick={() => onMoveTask(task.id, 'bottom')} disabled={isAtBottom} className="p-1.5 border-l border-gray-200 dark:border-gray-700 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500 hover:text-indigo-500 dark:text-gray-400 dark:hover:text-indigo-400 transition-colors" title="Move to bottom" aria-label="Move task to bottom"><ChevronDoubleDownIcon /></button>
                </div>
              </>
            )}
            {isEditing ? (
                <div className="flex items-center space-x-2">
                    <button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1 px-3 rounded-md text-sm transition-colors">
                        Save
                    </button>
                    <button onClick={handleCancel} className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-1 px-3 rounded-md text-sm transition-colors">
                        Cancel
                    </button>
                </div>
            ) : !task.completed ? (
                <div className="flex items-center">
                    <div className="relative inline-block text-left">
                        <button
                            onClick={() => setIsSnoozeMenuOpen(o => !o)}
                            onBlur={() => setTimeout(() => setIsSnoozeMenuOpen(false), 100)}
                            className="text-gray-400 dark:text-gray-500 hover:text-yellow-500 dark:hover:text-yellow-400 transition-colors p-1"
                            aria-label={`Snooze task ${task.title}`}
                        >
                            <SnoozeIcon className="h-5 w-5" />
                        </button>
                        {isSnoozeMenuOpen && (
                            <div className="origin-top-right absolute right-0 mt-2 w-40 rounded-md shadow-lg bg-white dark:bg-gray-900 ring-1 ring-black dark:ring-gray-700 ring-opacity-5 z-10 focus:outline-none">
                                <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
                                    <button onClick={() => handleSnooze('day')} className="w-full text-left block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800" role="menuitem">Snooze 1 Day</button>
                                    <button onClick={() => handleSnooze('week')} className="w-full text-left block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800" role="menuitem">Snooze 1 Week</button>
                                    <button onClick={() => handleSnooze('month')} className="w-full text-left block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800" role="menuitem">Snooze 1 Month</button>
                                </div>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={() => setIsEditing(true)}
                        className="text-gray-400 dark:text-gray-500 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors p-1"
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
      
      {!isEditing && isDescriptionExpanded && task.description && (
         <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-md border border-gray-200 dark:border-gray-700 prose max-w-none text-sm sm:text-base">
           <ReactMarkdown remarkPlugins={[remarkGfm]}>{task.description}</ReactMarkdown>
         </div>
      )}
      
       {isSnoozedInFuture && !task.completed && onUnsnoozeTask && (
        <div className="mt-3 p-2 bg-yellow-100 dark:bg-yellow-900/50 rounded-md flex items-center justify-between">
          <p className="text-sm text-yellow-800 dark:text-yellow-300 flex items-center">
            <SnoozeIcon className="h-4 w-4 inline mr-2" />
            Snoozed until: {new Date(task.snoozeUntil + 'T00:00:00').toLocaleDateString()}
          </p>
          <button
            onClick={() => onUnsnoozeTask(task.id)}
            className="text-xs font-semibold bg-yellow-200 dark:bg-yellow-800/60 text-yellow-800 dark:text-yellow-200 hover:bg-yellow-300 dark:hover:bg-yellow-700/60 px-2 py-1 rounded-md transition-colors"
          >
            Unsnooze
          </button>
        </div>
      )}
      
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        {task.completed && task.completionDate ? (
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
              <p className="text-green-600 dark:text-green-500 font-semibold mb-2 sm:mb-0">Completed on: {new Date(task.completionDate).toLocaleDateString()}</p>
              <button
                onClick={() => onToggleTaskComplete(task.id)}
                className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-1 px-3 rounded-md text-sm transition-colors self-end sm:self-center"
              >
                Re-open Task
              </button>
            </div>
            {task.subtasks.length > 0 && (
              <ul className="space-y-2 mt-4 pl-1">
                {task.subtasks.map(subtask => (
                  <li key={subtask.id} className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                    <CheckIcon className="h-4 w-4 mr-2 text-green-500 flex-shrink-0" />
                    <span className="line-through">{subtask.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : nextAction ? (
          <div className="flex items-stretch gap-3">
            <div className="w-1 bg-amber-500 dark:bg-amber-600 rounded-full flex-shrink-0" aria-hidden="true"></div>
            <div className="flex-grow flex flex-col sm:flex-row sm:items-center justify-between min-w-0 py-1">
              <div className="flex items-center flex-grow mb-2 sm:mb-0 sm:mr-2 min-w-0">
                <button
                  onClick={() => !isNextActionScheduledForToday && nextAction && onSetSubtaskDueDate(nextAction.id, task.id, todayDateString)}
                  className={`p-2 rounded-full transition-colors flex-shrink-0 ${
                    isNextActionScheduledForToday 
                      ? 'text-green-500 cursor-default' 
                      : isNextActionScheduledForFuture
                      ? 'text-blue-500 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/50 hover:text-yellow-600 dark:hover:text-yellow-400'
                  }`}
                  aria-label={
                    isNextActionScheduledForToday
                      ? `Subtask '${nextAction.text}' is scheduled for today`
                      : isNextActionScheduledForFuture
                      ? `Reschedule subtask '${nextAction.text}' for today`
                      : `Schedule subtask '${nextAction.text}' for today`
                  }
                  title={
                    isNextActionScheduledForToday
                      ? "Scheduled for Today"
                      : isNextActionScheduledForFuture
                      ? "Scheduled for a future date. Click to move to Today."
                      : "Schedule for Today"
                  }
                  disabled={isNextActionScheduledForToday || !nextAction}
                >
                  {isNextActionScheduledForToday ? <CalendarIcon /> : isNextActionScheduledForFuture ? <CalendarClockIcon /> : <CalendarPlusIcon />}
                </button>
                {isEditingNextAction && nextAction ? (
                   <input
                      autoFocus
                      type="text"
                      value={editingNextActionText}
                      onChange={e => setEditingNextActionText(e.target.value)}
                      onBlur={handleSaveNextAction}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleSaveNextAction();
                        if (e.key === 'Escape') handleCancelEditNextAction();
                      }}
                      className="ml-2 w-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                ) : nextAction ? (
                  <div className="flex items-center min-w-0">
                    <span className="ml-2 text-gray-600 dark:text-gray-300 break-words">{nextAction.text}</span>
                    <button
                        onClick={handleStartEditNextAction}
                        className="ml-2 text-gray-400 dark:text-gray-500 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors p-1 flex-shrink-0"
                        aria-label={`Edit next action subtask: ${nextAction.text}`}
                        title="Edit next action"
                    >
                        <EditIcon className="h-4 w-4" />
                    </button>
                  </div>
                ) : null}
              </div>
              {nextAction.dueDate && (
                <div className="self-end sm:self-center flex-shrink-0">
                  <span className="flex items-center text-xs text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded-full whitespace-nowrap">
                    <CalendarIcon className="h-4 w-4 mr-1" />
                    {new Date(
                      nextAction.dueDate + 'T00:00:00'
                    ).toLocaleDateString(undefined, {
                      weekday: 'short',
                      month: 'numeric',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              )}
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
        <button onClick={() => onOpenSubtaskModal(task)} className="mt-4 text-sm text-indigo-600 dark:text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-400 self-start flex items-center">
            Manage Sub-tasks ({task.subtasks.length}) <ChevronDownIcon className="h-5 w-5 ml-1"/>
        </button>
      )}
    </div>
  );
};

export default React.memo(TaskItem);