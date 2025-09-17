import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Task } from '../types';
// FIX: The SortOption type is exported from useUI.ts, not App.tsx.
import { SortOption } from '../hooks/useUI';
import TaskItem from '../components/TaskItem';
import { PlusIcon, ArrowsPointingInIcon, ArrowsPointingOutIcon, SpinnerIcon } from '../components/icons';
import MarkdownInput from '../components/MarkdownInput';

interface BacklogPageProps {
  backlogTasks: Task[];
  draggedTask: Task | null;
  allTags: string[];
  selectedTags: string[];
  isCompactView: boolean;
  sortOption: SortOption;
  onAddTask: (title: string, description: string) => void;
  onDeleteTask: (taskId: string) => void;
  onUpdateTask: (updatedTask: Task) => void;
  onOpenSubtaskModal: (task: Task) => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, task: Task) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>, targetTask: Task) => void;
  onToggleTaskComplete: (taskId: string) => void;
  onMoveTask: (taskId: string, direction: 'up' | 'down' | 'top' | 'bottom') => void;
  onSnoozeTask: (taskId: string, duration: 'day' | 'week' | 'month') => void;
  onUnsnoozeTask: (taskId: string) => void;
  onTagClick: (tag: string) => void;
  onClearTags: () => void;
  onSetSortOption: (option: SortOption) => void;
  onSetCompactView: (isCompact: boolean) => void;
  onUpdateSubtaskText: (taskId: string, subtaskId: string, newText: string) => void;
  onSetSubtaskDueDate: (subtaskId: string, taskId: string, date: string) => void;
  loadTasks: () => void;
  isLoading: boolean;
}

const extractTags = (text: string): string[] => {
    const regex = /#(\w+)/g;
    return text.match(regex) || [];
};

const calculateLastTouchedDaysAgo = (task: Task): number | null => {
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
};


const BacklogPage: React.FC<BacklogPageProps> = ({
  backlogTasks, draggedTask, allTags, selectedTags, isCompactView, sortOption,
  onAddTask, onDeleteTask, onUpdateTask, onOpenSubtaskModal, onDragStart, onDragOver, onDrop,
  onToggleTaskComplete, onMoveTask, onSnoozeTask, onUnsnoozeTask, onTagClick, onClearTags,
  onSetSortOption, onSetCompactView, onUpdateSubtaskText, onSetSubtaskDueDate,
  loadTasks, isLoading
}) => {
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [isFormVisible, setIsFormVisible] = useState(false);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleAddTagToDescription = useCallback((tag: string, setter: React.Dispatch<React.SetStateAction<string>>) => {
    setter(prev => `${prev.trim()} ${tag}`.trim());
  }, []);

  const handleAddTaskClick = () => {
    if (newTaskTitle.trim()) {
      onAddTask(newTaskTitle, newTaskDescription);
      setNewTaskTitle('');
      setNewTaskDescription('');
      setIsFormVisible(false);
    }
  };

  const sortedAndFilteredTasks = useMemo(() => {
    let tasksToDisplay = [...backlogTasks];

    if (selectedTags.length > 0) {
        tasksToDisplay = tasksToDisplay.filter(task => {
            const taskTags = extractTags(task.description);
            return selectedTags.every(selectedTag => taskTags.includes(selectedTag));
        });
    }

    if (sortOption === 'days_passed') {
        tasksToDisplay = tasksToDisplay
            .map(task => ({ task, daysAgo: calculateLastTouchedDaysAgo(task) }))
            .sort((a, b) => {
                const daysA = a.daysAgo;
                const daysB = b.daysAgo;

                if (daysA === null && daysB === null) return a.task.order - b.task.order;
                if (daysA === null) return 1; 
                if (daysB === null) return -1; 
                
                return daysB - daysA;
            })
            .map(item => item.task);
    } else {
      tasksToDisplay.sort((a, b) => a.order - b.order);
    }
    
    return tasksToDisplay;
  }, [backlogTasks, selectedTags, sortOption]);

  return (
    <>
      <div className="mb-6">
        {!isFormVisible ? (
          <button onClick={() => setIsFormVisible(true)} className="w-full bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-indigo-600 dark:text-indigo-400 font-bold py-3 px-4 rounded-lg shadow-md transition-colors flex items-center justify-center">
            <PlusIcon className="mr-2"/> Add New Task
          </button>
        ) : (
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md space-y-4 animate-fade-in-down" style={{animationDuration: '0.3s'}}>
            <input
              autoFocus
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddTaskClick()}
              placeholder="New task title..."
              className="w-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white placeholder-gray-500 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <MarkdownInput
              value={newTaskDescription}
              onChange={setNewTaskDescription}
              placeholder="Add description... use #tag for tags"
            />
              {allTags.length > 0 && (
                <div className="pt-1">
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Available tags:</h4>
                    <div className="flex flex-wrap gap-1">
                    {allTags.map(tag => (
                        <button 
                        key={tag} 
                        onClick={() => handleAddTagToDescription(tag, setNewTaskDescription)}
                        className="px-2 py-0.5 text-xs rounded-full bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 transition-colors"
                        >
                        {tag}
                        </button>
                    ))}
                    </div>
                </div>
            )}
            <div className="flex justify-end space-x-2">
              <button onClick={() => setIsFormVisible(false)} className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition-colors">
                Cancel
              </button>
              <button onClick={handleAddTaskClick} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md transition-colors">
                Add Task
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center space-x-2">
            <label htmlFor="sort-select" className="text-sm font-medium text-gray-600 dark:text-gray-300">Sort by:</label>
            <select
                id="sort-select"
                value={sortOption}
                onChange={(e) => onSetSortOption(e.target.value as SortOption)}
                className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
                <option value="manual">Manual</option>
                <option value="days_passed">Days Since Last Action</option>
            </select>
            <button onClick={() => onSetCompactView(!isCompactView)} className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700" title={isCompactView ? "Expand view" : "Compact view"}>
                {isCompactView ? <ArrowsPointingOutIcon /> : <ArrowsPointingInIcon />}
            </button>
        </div>
        {allTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
                {allTags.map(tag => (
                    <button
                        key={tag}
                        onClick={() => onTagClick(tag)}
                        className={`px-2 py-0.5 text-xs rounded-full transition-colors ${selectedTags.includes(tag) ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
                    >
                        {tag}
                    </button>
                ))}
                {selectedTags.length > 0 && (
                    <button onClick={onClearTags} className="px-2 py-0.5 text-xs rounded-full bg-red-500 text-white hover:bg-red-600">
                        Clear
                    </button>
                )}
            </div>
        )}
      </div>

      <div>
        {isLoading ? (
            <div className="flex items-center justify-center py-10">
                <SpinnerIcon />
                <span className="ml-2">Loading tasks...</span>
            </div>
        ) : sortedAndFilteredTasks.length > 0 ? (
            sortedAndFilteredTasks.map((task, index) => (
                <TaskItem
                    key={task.id}
                    task={task}
                    onDelete={onDeleteTask}
                    onUpdate={onUpdateTask}
                    onOpenSubtaskModal={onOpenSubtaskModal}
                    onDragStart={onDragStart}
                    onDragOver={onDragOver}
                    onDrop={onDrop}
                    isDragging={draggedTask?.id === task.id}
                    onSetSubtaskDueDate={onSetSubtaskDueDate}
                    onToggleTaskComplete={onToggleTaskComplete}
                    allTags={allTags}
                    isCompactView={isCompactView}
                    onMoveTask={onMoveTask}
                    taskIndex={index}
                    totalTasks={sortedAndFilteredTasks.length}
                    onSnoozeTask={onSnoozeTask}
                    onUnsnoozeTask={onUnsnoozeTask}
                    isDraggable={sortOption === 'manual'}
                    onUpdateSubtaskText={onUpdateSubtaskText}
                />
            ))
        ) : (
            <div className="text-center py-10">
                <p className="text-gray-500">No active tasks found. Time to add some!</p>
            </div>
        )}
      </div>
    </>
  );
};

export default BacklogPage;