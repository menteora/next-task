import React from 'react';
import { Task } from '../types';
import TaskItem from '../components/TaskItem';

interface ArchivePageProps {
  archivedTasks: Task[];
  allTags: string[];
  onDeleteTask: (taskId: string) => void;
  onUpdateTask: (updatedTask: Task) => void;
  onOpenSubtaskModal: (task: Task) => void;
  onToggleTaskComplete: (taskId: string) => void;
  onUpdateSubtaskText: (taskId: string, subtaskId: string, newText: string) => void;
  onSetSubtaskDueDate: (subtaskId: string, taskId: string, date: string) => void;
}

const ArchivePage: React.FC<ArchivePageProps> = ({
  archivedTasks, allTags, onDeleteTask, onUpdateTask, onOpenSubtaskModal,
  onToggleTaskComplete, onUpdateSubtaskText, onSetSubtaskDueDate
}) => {
  return (
    <div className="animate-fade-in-down">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-700 dark:text-gray-300 mb-4">Archived Tasks</h2>
      {archivedTasks.map((task) => (
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
      ))}
      {archivedTasks.length === 0 && <p className="text-center py-10 text-gray-500">No completed tasks yet.</p>}
    </div>
  );
};

export default ArchivePage;
