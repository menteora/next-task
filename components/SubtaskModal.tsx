import React, { useState } from 'react';
import { Task, Subtask } from '../types';
import { TrashIcon, GripVerticalIcon, EditIcon, CalendarPlusIcon, CalendarIcon, ChevronDoubleUpIcon, ChevronUpIcon, ChevronDownIcon, ChevronDoubleDownIcon } from './icons';

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

  const getTodayDateString = () => new Date().toISOString().split('T')[0];

  const handleAddSubtask = () => {
    if (newSubtaskText.trim()) {
      const newSubtask: Subtask = {
        id: crypto.randomUUID(),
        text: newSubtaskText.trim(),
        completed: false,
      };
      const updatedSubtasks = [...task.subtasks, newSubtask];
      onUpdateTask({ ...task, subtasks: updatedSubtasks });
      setNewSubtaskText('');
    }
  };
  
  const handleDeleteSubtask = (subtaskId: string) => {
      const updatedSubtasks = task.subtasks.filter(st => st.id !== subtaskId);
      onUpdateTask({ ...task, subtasks: updatedSubtasks });
  };
  
  const handleToggleComplete = (subtaskId: string) => {
    const updatedSubtasks = task.subtasks.map(st => {
      if (st.id === subtaskId) {
        const isCompleted = !st.completed;
        return {
          ...st,
          completed: isCompleted,
          completionDate: isCompleted ? new Date().toISOString() : undefined,
        };
      }
      return st;
    });
    onUpdateTask({ ...task, subtasks: updatedSubtasks });
  }

  const handleDateChange = (subtaskId: string, date: string) => {
    const updatedSubtasks = task.subtasks.map(st =>
        st.id === subtaskId ? { ...st, dueDate: date || undefined } : st
    );
    onUpdateTask({ ...task, subtasks: updatedSubtasks });
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
    const fromIndex = task.subtasks.findIndex(st => st.id === subtaskId);
    if (fromIndex === -1) return;

    const newSubtasks = [...task.subtasks];
    
    if (direction === 'top') {
        if (fromIndex === 0) return;
        const [item] = newSubtasks.splice(fromIndex, 1);
        newSubtasks.unshift(item);
    } else if (direction === 'bottom') {
        if (fromIndex === newSubtasks.length - 1) return;
        const [item] = newSubtasks.splice(fromIndex, 1);
        newSubtasks.push(item);
    } else if (direction === 'up') {
        if (fromIndex === 0) return;
        [newSubtasks[fromIndex], newSubtasks[fromIndex - 1]] = [newSubtasks[fromIndex - 1], newSubtasks[fromIndex]];
    } else if (direction === 'down') {
        if (fromIndex === newSubtasks.length - 1) return;
        [newSubtasks[fromIndex], newSubtasks[fromIndex + 1]] = [newSubtasks[fromIndex + 1], newSubtasks[fromIndex]];
    }

    onUpdateTask({ ...task, subtasks: newSubtasks });
  };

  const onDragStart = (e: React.DragEvent<HTMLLIElement>, subtask: Subtask) => {
    setDraggedSubtask(subtask);
  };

  const onDragOver = (e: React.DragEvent<HTMLLIElement>) => {
    e.preventDefault();
  };

  const onDrop = (e: React.DragEvent<HTMLLIElement>, targetSubtask: Subtask) => {
    if (!draggedSubtask) return;
    const fromIndex = task.subtasks.findIndex(st => st.id === draggedSubtask.id);
    const toIndex = task.subtasks.findIndex(st => st.id === targetSubtask.id);
    
    if (fromIndex === -1 || toIndex === -1) return;

    const items = [...task.subtasks];
    const [reorderedItem] = items.splice(fromIndex, 1);
    items.splice(toIndex, 0, reorderedItem);

    onUpdateTask({ ...task, subtasks: items });
  };

  const onDragEnd = () => {
    setDraggedSubtask(null);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-4 m-2 sm:p-6 sm:m-4 md:max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl sm:text-2xl font-bold mb-2 text-cyan-600 dark:text-cyan-400">Sub-tasks for: <span className="text-gray-800 dark:text-white">{task.title}</span></h2>
        <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mb-6">Drag to reorder. Assign a date to see it in the 'Today' view.</p>
        
        <div className="space-y-2 mb-6 max-h-72 overflow-y-auto pr-2">
          {task.subtasks.length > 0 ? (
            <ul>
                {task.subtasks.map((subtask, index) => {
                    const isAtTop = index === 0;
                    const isAtBottom = index === task.subtasks.length - 1;
                    return (
                    <li key={subtask.id}
                        draggable={!editingSubtaskId}
                        onDragStart={(e) => onDragStart(e, subtask)}
                        onDragOver={onDragOver}
                        onDrop={(e) => onDrop(e, subtask)}
                        onDragEnd={onDragEnd}
                        className={`flex flex-col sm:flex-row items-stretch sm:items-center justify-between p-2 sm:p-3 rounded-md transition-all ${draggedSubtask?.id === subtask.id ? 'bg-cyan-100 dark:bg-cyan-900/50' : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600/80'}`}
                        >
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
                                    className="ml-3 flex-grow bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                />
                            ) : (
                                <div className="ml-3 flex-grow" onClick={() => handleStartEdit(subtask)}>
                                    <span className={`${subtask.completed ? 'line-through text-gray-500 dark:text-gray-500' : 'text-gray-700 dark:text-gray-200'}`}>
                                        {subtask.text}
                                    </span>
                                    {subtask.completed && subtask.completionDate && (
                                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                                            (Completed: {new Date(subtask.completionDate).toLocaleDateString()})
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                        {editingSubtaskId !== subtask.id && (
                           <div className="flex items-center justify-end flex-wrap gap-2 mt-2 sm:mt-0 sm:ml-4">
                                <div className="flex items-center border border-gray-200 dark:border-gray-600 rounded-md">
                                    <button onClick={() => handleMoveSubtask(subtask.id, 'top')} disabled={isAtTop} className="p-1.5 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500 hover:text-cyan-500 dark:text-gray-400 dark:hover:text-cyan-400 transition-colors" title="Move to top" aria-label="Move subtask to top"><ChevronDoubleUpIcon className="h-4 w-4" /></button>
                                    <button onClick={() => handleMoveSubtask(subtask.id, 'up')} disabled={isAtTop} className="p-1.5 border-l border-gray-200 dark:border-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500 hover:text-cyan-500 dark:text-gray-400 dark:hover:text-cyan-400 transition-colors" title="Move up" aria-label="Move subtask up"><ChevronUpIcon className="h-4 w-4" /></button>
                                    <button onClick={() => handleMoveSubtask(subtask.id, 'down')} disabled={isAtBottom} className="p-1.5 border-l border-gray-200 dark:border-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500 hover:text-cyan-500 dark:text-gray-400 dark:hover:text-cyan-400 transition-colors" title="Move down" aria-label="Move subtask down"><ChevronDownIcon className="h-4 w-4" /></button>
                                    <button onClick={() => handleMoveSubtask(subtask.id, 'bottom')} disabled={isAtBottom} className="p-1.5 border-l border-gray-200 dark:border-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500 hover:text-cyan-500 dark:text-gray-400 dark:hover:text-cyan-400 transition-colors" title="Move to bottom" aria-label="Move subtask to bottom"><ChevronDoubleDownIcon className="h-4 w-4" /></button>
                                </div>
                                <input
                                  type="date"
                                  value={subtask.dueDate || ''}
                                  onChange={(e) => handleDateChange(subtask.id, e.target.value)}
                                  className="bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 border-none rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                />
                                <button onClick={() => onSetSubtaskDueDate(subtask.id, task.id, getTodayDateString())} className="text-gray-400 dark:text-gray-500 hover:text-yellow-500 dark:hover:text-yellow-400 transition-colors p-1" aria-label={`Schedule for today`}>
                                    <CalendarPlusIcon />
                                </button>
                                <button onClick={() => handleStartEdit(subtask)} className="text-gray-400 dark:text-gray-500 hover:text-cyan-500 dark:hover:text-cyan-400 transition-colors p-1">
                                    <EditIcon />
                                </button>
                                <button onClick={() => handleDeleteSubtask(subtask.id)} className="text-gray-400 dark:text-gray-500 hover:text-red-500 transition-colors p-1">
                                    <TrashIcon />
                                </button>
                            </div>
                        )}
                    </li>
                )})}
            </ul>
          ) : (
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
            className="flex-grow bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white placeholder-gray-500 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            autoFocus
          />
          <button onClick={handleAddSubtask} className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-md transition-colors">
            Add
          </button>
        </div>
        
        <button onClick={onClose} className="mt-6 w-full bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition-colors">
          Close
        </button>
      </div>
    </div>
  );
};

export default SubtaskModal;