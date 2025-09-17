import React, { useEffect } from 'react';
import { Task } from '../types';
import TaskItem from '../components/TaskItem';
import { SpinnerIcon } from '../components/icons';

interface ArchivePageProps {
  archivedTasks: Task[];
  allTags: string[];
  onDeleteTask: (taskId: string) => void;
  onUpdateTask: (updatedTask: Task) => void;
  onOpenSubtaskModal: (task: Task) => void;
  onToggleTaskComplete: (taskId: string) => void;
  onUpdateSubtaskText: (taskId: string, subtaskId: string, newText: string) => void;
  onSetSubtaskDueDate: (subtaskId: string, taskId: string, date: string) => void;
  loadTasks: () => void;
  isLoading: boolean;
}

const ArchivePage: React.FC<ArchivePageProps> = ({
  archivedTasks, allTags, onDeleteTask, onUpdateTask, onOpenSubtaskModal,
  onToggleTaskComplete, onUpdateSubtaskText, onSetSubtaskDueDate,
  loadTasks, isLoading
}) => {
  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const sortedArchivedTasks = [...archivedTasks].sort((a,b) => (b.completionDate || '').localeCompare(a.completionDate || ''));

  return (
    <div className="animate-fade-in-down">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-700 dark:text-gray-300 mb-4">Archived Tasks</h2>
      {isLoading ? (
        <div className="flex items-center justify-center py-10">
            <SpinnerIcon />
            <span className="ml-2">Loading archive...</span>
        </div>
      ) : sortedArchivedTasks.length > 0 ? (
        sortedArchivedTasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            onDelete={onDeleteTask}
            onUpdate={onUpdateTask}
            onOpenSubtaskModal={onOpenSubtaskModal}
            onDragStart={() => {}}
            onDragOver={() => {}}
            onDrop={() => {}}
            isDragging={false}
            onSetSubtaskDueDate={onSetSubtaskDueDate}
            onToggleTaskComplete={onToggleTaskComplete}
            allTags={allTags}
            isCompactView={false}
            onMoveTask={() => {}}
            taskIndex={-1}
            totalTasks={-1}
            onSnoozeTask={() => {}}
            isDraggable={false}
            onUpdateSubtaskText={onUpdateSubtaskText}
          />
        ))
      ) : (
        <p className="text-center py-10 text-gray-500">No completed tasks yet.</p>
      )}
    </div>
  );
};

export default ArchivePage;