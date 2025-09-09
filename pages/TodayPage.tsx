import React from 'react';
import { Subtask, Task } from '../types';
import TodaySubtaskItem from '../components/TodaySubtaskItem';

type TodayItem = { subtask: Subtask, parentTask: Task };

interface TodayPageProps {
  incompleteTodaySubtasks: TodayItem[];
  completedTodaySubtasks: TodayItem[];
  draggedTodayItem: TodayItem | null;
  onToggleComplete: (subtaskId: string, taskId: string) => void;
  onRemoveDueDate: (subtaskId: string, taskId: string) => void;
  onDragStart: (item: TodayItem) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (targetItem: TodayItem) => void;
  onMoveSubtask: (subtaskId: string, direction: 'up' | 'down' | 'top' | 'bottom') => void;
  onUpdateParentTaskDescription: (taskId: string, newDescription: string) => void;
  onUpdateSubtaskText: (taskId: string, subtaskId: string, newText: string) => void;
}

const TodayPage: React.FC<TodayPageProps> = ({
  incompleteTodaySubtasks, completedTodaySubtasks, draggedTodayItem,
  onToggleComplete, onRemoveDueDate, onDragStart, onDragOver, onDrop,
  onMoveSubtask, onUpdateParentTaskDescription, onUpdateSubtaskText
}) => {
  return (
    <div className="animate-fade-in-down">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-700 dark:text-gray-300 mb-4">Today's Focus</h2>
      {incompleteTodaySubtasks.length > 0 && (
          <div>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">To Do</h3>
              {incompleteTodaySubtasks.map((item, index) => (
                  <TodaySubtaskItem 
                      key={item.subtask.id}
                      item={{...item, parentTaskTitle: item.parentTask.title, parentTaskDescription: item.parentTask.description, parentTaskId: item.parentTask.id}}
                      onToggleComplete={() => onToggleComplete(item.subtask.id, item.parentTask.id)}
                      onRemove={() => onRemoveDueDate(item.subtask.id, item.parentTask.id)}
                      onDragStart={() => onDragStart(item)}
                      onDragOver={onDragOver}
                      onDrop={() => onDrop(item)}
                      isDragging={draggedTodayItem?.subtask.id === item.subtask.id}
                      onMoveSubtask={onMoveSubtask}
                      subtaskIndex={index}
                      totalSubtasks={incompleteTodaySubtasks.length}
                      onUpdateParentTaskDescription={onUpdateParentTaskDescription}
                      onUpdateSubtaskText={onUpdateSubtaskText}
                  />
              ))}
          </div>
      )}
      
      {completedTodaySubtasks.length > 0 && (
          <div className={incompleteTodaySubtasks.length > 0 ? "mt-8" : ""}>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">Completed Today</h3>
              {completedTodaySubtasks.map(item => (
                    <TodaySubtaskItem 
                      key={item.subtask.id}
                      item={{...item, parentTaskTitle: item.parentTask.title, parentTaskDescription: item.parentTask.description, parentTaskId: item.parentTask.id}}
                      onToggleComplete={() => onToggleComplete(item.subtask.id, item.parentTask.id)}
                      onRemove={() => onRemoveDueDate(item.subtask.id, item.parentTask.id)}
                      onDragStart={(e) => e.preventDefault()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => e.preventDefault()}
                      isDragging={false}
                      onMoveSubtask={() => {}}
                      subtaskIndex={-1}
                      totalSubtasks={-1}
                      onUpdateParentTaskDescription={onUpdateParentTaskDescription}
                      onUpdateSubtaskText={onUpdateSubtaskText}
                  />
              ))}
          </div>
      )}

      {incompleteTodaySubtasks.length === 0 && completedTodaySubtasks.length === 0 && (
        <p className="text-center py-10 text-gray-500">Nothing scheduled for today. Enjoy your day!</p>
      )}
    </div>
  );
};

export default TodayPage;