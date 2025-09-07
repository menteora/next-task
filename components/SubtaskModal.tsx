
import React, { useState } from 'react';
import { Task, Subtask } from '../types';
import ConfirmationModal from './ConfirmationModal';
import { TrashIcon, GripVerticalIcon, EditIcon, CalendarPlusIcon, RepeatIcon, ChevronDoubleUpIcon, ChevronUpIcon, ChevronDownIcon, ChevronDoubleDownIcon } from './icons';

interface SubtaskModalProps {
  task: Task;
  onClose: () => void;
  onUpdateTask: (updatedTask: Task) => void;
  onSetSubtaskDueDate: (subtaskId: string, taskId: string, date: string) => void;
}

const SubtaskModal: React.FC<SubtaskModalProps> = ({ task, onClose, onUpdateTask, onSetSubtaskDueDate }) => {
  const [newSubtaskText, setNewSubtaskText] = useState('');
  const [draggedSubtask, setDraggedSubtask] = useState<Subtask | null>(null);
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [editingSubtaskText, setEditingSubtaskText] = useState('');
  const [confirmingDeleteSubtaskId, setConfirmingDeleteSubtaskId] = useState<string | null>(null);

  const getTodayDateString = () => new Date().toISOString().split('T')[0];

  const handleAddSubtask = () => {
    if (newSubtaskText.trim()) {
      const newSubtask: Subtask = {
        id: crypto.randomUUID(),
        text: newSubtaskText.trim(),
        completed: false,
        order: -1, 
      };
      const incomplete = task.subtasks.filter(st => !st.completed);
      const completed = task.subtasks.filter(st => st.completed);
      const updatedSubtasks = [...incomplete, newSubtask, ...completed].map(
        (st, index) => ({ ...st, order: index }),
      );

      onUpdateTask({ ...task, subtasks: updatedSubtasks });
      setNewSubtaskText('');
    }
  };
  
  const handleDeleteSubtask = (subtaskId: string) => {
      const updatedSubtasks = task.subtasks
        .filter(st => st.id !== subtaskId)
        .map((st, index) => ({ ...st, order: index }));
      onUpdateTask({ ...task, subtasks: updatedSubtasks });
  };
  
  const handleToggleComplete = (subtaskId: string) => {
    const subtaskToToggle = task.subtasks.find(st => st.id === subtaskId);
    if (!subtaskToToggle) return;

    const isCompleting = !subtaskToToggle.completed;
    const completionDate = isCompleting ? new Date().toISOString() : undefined;
    let newSubtask: Subtask | null = null;
    let updatedSubtasks = task.subtasks.map(st => {
      if (st.id === subtaskId) {
        return { ...st, completed: isCompleting, completionDate };
      }
      return st;
    });

    if (isCompleting && subtaskToToggle.recurrence) {
        const { unit, value } = subtaskToToggle.recurrence;
        const baseDate = new Date();
        let nextDueDate = new Date(baseDate);

        if (unit === 'day') nextDueDate.setDate(nextDueDate.getDate() + value);
        else if (unit === 'week') nextDueDate.setDate(nextDueDate.getDate() + (value * 7));
        else if (unit === 'month') nextDueDate.setMonth(nextDueDate.getMonth() + value);
        else if (unit === 'year') nextDueDate.setFullYear(nextDueDate.getFullYear() + value);
        
        const maxOrder = task.subtasks.reduce((max, st) => Math.max(st.order, max), -1);

        newSubtask = {
            ...subtaskToToggle,
            id: crypto.randomUUID(),
            completed: false,
            dueDate: nextDueDate.toISOString().split('T')[0],
            completionDate: undefined,
            order: maxOrder + 1,
        };
        updatedSubtasks.push(newSubtask);
    }
    
    const incomplete = updatedSubtasks.filter(st => !st.completed).sort((a,b) => a.order - b.order);
    const completed = updatedSubtasks.filter(st => st.completed).sort((a,b) => {
        if (!a.completionDate) return 1;
        if (!b.completionDate) return -1;
        return new Date(a.completionDate).getTime() - new Date(b.completionDate).getTime()
    });
    const finalSubtasks = [...incomplete, ...completed].map((st, index) => ({ ...st, order: index }));

    onUpdateTask({ ...task, subtasks: finalSubtasks });
  }

  const handleDateChange = (subtaskId: string, date: string) => {
    const updatedSubtasks = task.subtasks.map(st =>
        st.id === subtaskId ? { ...st, dueDate: date || undefined } : st
    );
    onUpdateTask({ ...task, subtasks: updatedSubtasks });
  };
  
  const handleRecurrenceChange = (subtaskId: string, field: 'unit' | 'value', value: string | number) => {
    const updatedSubtasks = task.subtasks.map(st => {
        if (st.id !== subtaskId) return st;

        if (field === 'unit' && value === 'none') {
            const { recurrence, ...rest } = st;
            return rest;
        }

        const currentRecurrence = st.recurrence || { unit: 'week', value: 1 };
        let newRecurrence;

        if (field === 'unit') {
            newRecurrence = { ...currentRecurrence, unit: value as 'day'|'week'|'month'|'year' };
        } else {
            const numValue = parseInt(String(value), 10);
            // Use 0 as a temporary state for an empty or invalid input, which will be corrected on blur.
            const finalValue = !isNaN(numValue) && numValue >= 1 ? numValue : 0;
            newRecurrence = { ...currentRecurrence, value: finalValue };
        }
        
        return { ...st, recurrence: newRecurrence };
    });
    onUpdateTask({ ...task, subtasks: updatedSubtasks });
  };

  const handleRecurrenceBlur = (subtask: Subtask) => {
    if (subtask.recurrence && subtask.recurrence.value < 1) {
      handleRecurrenceChange(subtask.id, 'value', 1);
    }
  };

  const handleStartEdit = (subtask: Subtask) => {
    setEditingSubtaskId(subtask.id);
    setEditingSubtaskText(subtask.text);
  };

  const handleCancelEdit = () => {
    setEditingSubtaskId(null);
    setEditingSubtaskText('');
  };

  const handleSaveEdit = () => {
    if (!editingSubtaskId) return;
    if (editingSubtaskText.trim()) {
        const updatedSubtasks = task.subtasks.map(st =>
            st.id === editingSubtaskId ? { ...st, text: editingSubtaskText.trim() } : st
        );
        onUpdateTask({ ...task, subtasks: updatedSubtasks });
    }
    handleCancelEdit();
  };
  
  const handleMoveSubtask = (subtaskId: string, direction: 'up' | 'down' | 'top' | 'bottom') => {
    const incomplete = task.subtasks.filter(st => !st.completed);
    const fromIndex = incomplete.findIndex(st => st.id === subtaskId);
    if (fromIndex === -1) return;

    const newIncompleteSubtasks = [...incomplete];
    
    if (direction === 'top') {
        if (fromIndex === 0) return;
        const [item] = newIncompleteSubtasks.splice(fromIndex, 1);
        newIncompleteSubtasks.unshift(item);
    } else if (direction === 'bottom') {
        if (fromIndex === newIncompleteSubtasks.length - 1) return;
        const [item] = newIncompleteSubtasks.splice(fromIndex, 1);
        newIncompleteSubtasks.push(item);
    } else if (direction === 'up') {
        if (fromIndex === 0) return;
        [newIncompleteSubtasks[fromIndex], newIncompleteSubtasks[fromIndex - 1]] = [newIncompleteSubtasks[fromIndex - 1], newIncompleteSubtasks[fromIndex]];
    } else if (direction === 'down') {
        if (fromIndex === newIncompleteSubtasks.length - 1) return;
        [newIncompleteSubtasks[fromIndex], newIncompleteSubtasks[fromIndex + 1]] = [newIncompleteSubtasks[fromIndex + 1], newIncompleteSubtasks[fromIndex]];
    }

    const completed = task.subtasks.filter(st => st.completed);
    const updatedSubtasks = [...newIncompleteSubtasks, ...completed].map((st, index) => ({ ...st, order: index }));
    onUpdateTask({ ...task, subtasks: updatedSubtasks });
  };

  const onDragStart = (e: React.DragEvent<HTMLLIElement>, subtask: Subtask) => {
    if (subtask.completed) {
      e.preventDefault();
      return;
    }
    setDraggedSubtask(subtask);
  };

  const onDragOver = (e: React.DragEvent<HTMLLIElement>) => {
    e.preventDefault();
  };

  const onDrop = (e: React.DragEvent<HTMLLIElement>, targetSubtask: Subtask) => {
    if (!draggedSubtask || draggedSubtask.completed || targetSubtask.completed) return;
    
    const incomplete = task.subtasks.filter(st => !st.completed);
    const fromIndex = incomplete.findIndex(st => st.id === draggedSubtask.id);
    const toIndex = incomplete.findIndex(st => st.id === targetSubtask.id);
    
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;

    const [reorderedItem] = incomplete.splice(fromIndex, 1);
    incomplete.splice(toIndex, 0, reorderedItem);
    
    const completed = task.subtasks.filter(st => st.completed);

    const updatedSubtasks = [...incomplete, ...completed].map((st, index) => ({ ...st, order: index }));
    onUpdateTask({ ...task, subtasks: updatedSubtasks });
  };

  const onDragEnd = () => {
    setDraggedSubtask(null);
  };
  
  const subtaskToDelete = task.subtasks.find(st => st.id === confirmingDeleteSubtaskId);

  const incompleteSubtasks = task.subtasks.filter(st => !st.completed);
  const completedSubtasks = task.subtasks
    .filter(st => st.completed)
    .sort((a, b) => {
      if (!a.completionDate) return 1;
      if (!b.completionDate) return -1;
      return new Date(a.completionDate).getTime() - new Date(b.completionDate).getTime();
    });

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50" onClick={onClose}>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-4 m-2 sm:p-6 sm:m-4 md:max-w-2xl" onClick={(e) => e.stopPropagation()}>
          <h2 className="text-xl sm:text-2xl font-bold mb-2 text-indigo-600 dark:text-indigo-400">Sub-tasks for: <span className="text-gray-800 dark:text-white">{task.title}</span></h2>
          <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mb-6">Drag to reorder. Assign a date to enable recurrence options.</p>
          
          <div className="mb-6 max-h-72 overflow-y-auto pr-2">
            {incompleteSubtasks.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 px-1 pt-2 mb-2">To Do</h3>
                <ul className="space-y-2">
                    {incompleteSubtasks.map((subtask, index) => {
                        const isAtTop = index === 0;
                        const isAtBottom = index === incompleteSubtasks.length - 1;
                        return (
                        <li key={subtask.id}
                            draggable={!editingSubtaskId}
                            onDragStart={(e) => onDragStart(e, subtask)}
                            onDragOver={onDragOver}
                            onDrop={(e) => onDrop(e, subtask)}
                            onDragEnd={onDragEnd}
                            className={`flex flex-col items-stretch p-2 sm:p-3 rounded-md transition-all ${draggedSubtask?.id === subtask.id ? 'bg-indigo-100 dark:bg-indigo-900/50' : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600/80'}`}
                            >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center flex-grow">
                                    <div className="cursor-grab p-1 mr-2">
                                        <GripVerticalIcon />
                                    </div>
                                    <input 
                                        type="checkbox"
                                        checked={subtask.completed}
                                        onChange={() => handleToggleComplete(subtask.id)}
                                        className="h-4 w-4 rounded border-gray-400 dark:border-gray-500 bg-gray-200 dark:bg-gray-600 text-teal-600 dark:text-teal-500 focus:ring-teal-500 dark:focus:ring-teal-600 cursor-pointer flex-shrink-0"
                                    />
                                    {editingSubtaskId === subtask.id ? (
                                        <input
                                            autoFocus
                                            type="text"
                                            value={editingSubtaskText}
                                            onChange={e => setEditingSubtaskText(e.target.value)}
                                            onBlur={handleSaveEdit}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') handleSaveEdit();
                                                if (e.key === 'Escape') handleCancelEdit();
                                            }}
                                            className="ml-3 flex-grow bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    ) : (
                                        <div className="ml-3 flex-grow" onClick={() => handleStartEdit(subtask)}>
                                            <span className={'text-gray-700 dark:text-gray-200'}>
                                                {subtask.text}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                {editingSubtaskId !== subtask.id && (
                                    <div className="flex items-center justify-end flex-wrap gap-2 sm:ml-4">
                                        <div className="flex items-center border border-gray-200 dark:border-gray-600 rounded-md">
                                            <button onClick={() => handleMoveSubtask(subtask.id, 'top')} disabled={isAtTop} className="p-1.5 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500 hover:text-indigo-500 dark:text-gray-400 dark:hover:text-indigo-400 transition-colors" title="Move to top" aria-label="Move subtask to top"><ChevronDoubleUpIcon className="h-4 w-4" /></button>
                                            <button onClick={() => handleMoveSubtask(subtask.id, 'up')} disabled={isAtTop} className="p-1.5 border-l border-gray-200 dark:border-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500 hover:text-indigo-500 dark:text-gray-400 dark:hover:text-indigo-400 transition-colors" title="Move up" aria-label="Move subtask up"><ChevronUpIcon className="h-4 w-4" /></button>
                                            <button onClick={() => handleMoveSubtask(subtask.id, 'down')} disabled={isAtBottom} className="p-1.5 border-l border-gray-200 dark:border-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500 hover:text-indigo-500 dark:text-gray-400 dark:hover:text-indigo-400 transition-colors" title="Move down" aria-label="Move subtask down"><ChevronDownIcon className="h-4 w-4" /></button>
                                            <button onClick={() => handleMoveSubtask(subtask.id, 'bottom')} disabled={isAtBottom} className="p-1.5 border-l border-gray-200 dark:border-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500 hover:text-indigo-500 dark:text-gray-400 dark:hover:text-indigo-400 transition-colors" title="Move to bottom" aria-label="Move subtask to bottom"><ChevronDoubleDownIcon className="h-4 w-4" /></button>
                                        </div>
                                        <input
                                            type="date"
                                            value={subtask.dueDate || ''}
                                            onChange={(e) => handleDateChange(subtask.id, e.target.value)}
                                            className="bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 border-none rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                        <button onClick={() => onSetSubtaskDueDate(subtask.id, task.id, getTodayDateString())} className="text-gray-400 dark:text-gray-500 hover:text-yellow-500 dark:hover:text-yellow-400 transition-colors p-1" aria-label={`Schedule for today`}>
                                            <CalendarPlusIcon />
                                        </button>
                                        <button onClick={() => handleStartEdit(subtask)} className="text-gray-400 dark:text-gray-500 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors p-1">
                                            <EditIcon />
                                        </button>
                                        <button onClick={() => setConfirmingDeleteSubtaskId(subtask.id)} className="text-gray-400 dark:text-gray-500 hover:text-red-500 transition-colors p-1">
                                            <TrashIcon />
                                        </button>
                                    </div>
                                )}
                            </div>
                            {subtask.dueDate && editingSubtaskId !== subtask.id && (
                                <div className="mt-2 pl-8 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                    <RepeatIcon className="h-4 w-4 flex-shrink-0" />
                                    <span className="font-medium">Every</span>
                                    <input
                                      type="number"
                                      min="1"
                                      value={subtask.recurrence?.value === 0 ? '' : subtask.recurrence?.value || 1}
                                      onChange={(e) => handleRecurrenceChange(subtask.id, 'value', e.target.value)}
                                      onBlur={() => handleRecurrenceBlur(subtask)}
                                      className="w-16 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 border-none rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                    <select
                                      value={subtask.recurrence?.unit || 'none'}
                                      onChange={(e) => handleRecurrenceChange(subtask.id, 'unit', e.target.value)}
                                      className="bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 border-none rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                      <option value="none">No Recurrence</option>
                                      <option value="day">Day(s)</option>
                                      <option value="week">Week(s)</option>
                                      <option value="month">Month(s)</option>
                                      <option value="year">Year(s)</option>
                                    </select>
                                </div>
                            )}
                        </li>
                    )})}
                </ul>
              </div>
            )}
            
            {incompleteSubtasks.length > 0 && completedSubtasks.length > 0 && (
                <hr className="my-4 border-gray-200 dark:border-gray-600" />
            )}

            {completedSubtasks.length > 0 && (
                 <div>
                    <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 px-1 pt-2 mb-2">Completed</h3>
                    <ul className="space-y-2">
                        {completedSubtasks.map((subtask) => (
                           <li key={subtask.id} className="flex items-center p-2 sm:p-3 rounded-md bg-gray-50 dark:bg-gray-900/50 opacity-80">
                                <input 
                                    type="checkbox"
                                    checked={subtask.completed}
                                    onChange={() => handleToggleComplete(subtask.id)}
                                    className="h-4 w-4 rounded border-gray-400 dark:border-gray-500 bg-gray-200 dark:bg-gray-600 text-teal-600 dark:text-teal-500 focus:ring-teal-500 dark:focus:ring-teal-600 cursor-pointer flex-shrink-0"
                                />
                                <div className="ml-3 flex-grow">
                                    <span className="line-through text-gray-500 dark:text-gray-500">
                                        {subtask.text}
                                    </span>
                                    {subtask.completionDate && (
                                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                                            (Completed: {new Date(subtask.completionDate).toLocaleDateString()})
                                        </span>
                                    )}
                                </div>
                                <button onClick={() => setConfirmingDeleteSubtaskId(subtask.id)} className="text-gray-400 dark:text-gray-500 hover:text-red-500 transition-colors p-1 ml-4">
                                    <TrashIcon />
                                </button>
                           </li>
                        ))}
                    </ul>
                 </div>
            )}

            {task.subtasks.length === 0 && (
              <p className="text-gray-500 italic text-center py-4">No sub-tasks yet. Add one below!</p>
            )}
          </div>
          
          <div className="flex space-x-2">
            <input
              type="text"
              value={newSubtaskText}
              onChange={(e) => setNewSubtaskText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddSubtask()}
              placeholder="Add a new sub-task..."
              className="flex-grow bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white placeholder-gray-500 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
            <button onClick={handleAddSubtask} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md transition-colors">
              Add
            </button>
          </div>
          
          <button onClick={onClose} className="mt-6 w-full bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition-colors">
            Close
          </button>
        </div>
      </div>
      <ConfirmationModal
        isOpen={!!confirmingDeleteSubtaskId}
        onClose={() => setConfirmingDeleteSubtaskId(null)}
        onConfirm={() => {
          if (confirmingDeleteSubtaskId) {
            handleDeleteSubtask(confirmingDeleteSubtaskId);
            setConfirmingDeleteSubtaskId(null);
          }
        }}
        title="Confirm Subtask Deletion"
        message={`Are you sure you want to delete the subtask "${subtaskToDelete?.text || ''}"? This action cannot be undone.`}
        confirmButtonText="Delete"
        confirmButtonClass="bg-red-600 hover:bg-red-700"
      />
    </>
  );
};

export default SubtaskModal;
