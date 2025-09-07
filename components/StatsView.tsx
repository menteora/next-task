import React, { useMemo } from 'react';
import { Task } from '../types';

interface StatsViewProps {
  tasks: Task[];
}

const StatsCard = ({ title, value, colorClass = 'text-indigo-500 dark:text-indigo-400' }: { title: string, value: number | string, colorClass?: string }) => (
  <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md flex flex-col items-center justify-center">
    <span className={`text-3xl sm:text-4xl font-bold ${colorClass}`}>{value}</span>
    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-2 text-center">{title}</p>
  </div>
);

const StatsView: React.FC<StatsViewProps> = ({ tasks }) => {
  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999); 

    const getDateKey = (date: Date) => date.toISOString().split('T')[0];
    
    let completedTasks = 0;
    let pendingSubtasks = 0;
    let overdueSubtasks = 0;
    const weeklyCompletion: { [key: string]: number } = {};
    const tagCounts: { [key: string]: number } = {};

    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        weeklyCompletion[getDateKey(d)] = 0;
    }

    tasks.forEach(task => {
      if (task.completed) {
        completedTasks++;
      }
      
      const taskTags = (task.description.match(/#(\w+)/g) || []);
      taskTags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });

      task.subtasks.forEach(subtask => {
        if (!subtask.completed) {
          pendingSubtasks++;
          if (subtask.dueDate) {
            const dueDate = new Date(subtask.dueDate);
            dueDate.setHours(23, 59, 59, 999);
            if (dueDate < today) {
              overdueSubtasks++;
            }
          }
        } else if (subtask.completionDate) {
            const completionDate = new Date(subtask.completionDate);
            const completionDateKey = getDateKey(completionDate);
            if (completionDateKey in weeklyCompletion) {
                weeklyCompletion[completionDateKey]++;
            }
        }
      });
    });

    const topTags = Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
      
    return { completedTasks, pendingSubtasks, overdueSubtasks, weeklyCompletion, topTags };
  }, [tasks]);

  const maxWeeklyCompletion = Math.max(...Object.values(stats.weeklyCompletion), 1);

  return (
    <div className="space-y-8 animate-fade-in-down">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-700 dark:text-gray-300 mb-4">At a Glance</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatsCard title="Completed Tasks" value={stats.completedTasks} colorClass="text-green-500 dark:text-green-400" />
          <StatsCard title="Pending Sub-tasks" value={stats.pendingSubtasks} />
          <StatsCard title="Overdue Sub-tasks" value={stats.overdueSubtasks} colorClass="text-red-500 dark:text-red-400" />
        </div>
      </div>

      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-700 dark:text-gray-300 mb-4">Weekly Activity</h2>
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md">
            <div className="flex justify-between items-end h-48 space-x-1 sm:space-x-2">
                {Object.entries(stats.weeklyCompletion).map(([date, count]) => {
                    const day = new Date(date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' });
                    const height = (count / maxWeeklyCompletion) * 100;
                    return (
                        <div key={date} className="flex flex-col items-center justify-end flex-1 h-full">
                           <span className="text-xs font-bold text-gray-600 dark:text-gray-300">{count}</span>
                           <div
                             className="w-full bg-indigo-500 dark:bg-indigo-400 rounded-t-md mt-1"
                             style={{ height: `${height}%` }}
                             title={`${count} completed on ${new Date(date + 'T00:00:00').toLocaleDateString()}`}
                           ></div>
                           <span className="text-xs text-gray-500 dark:text-gray-400 mt-2">{day}</span>
                        </div>
                    );
                })}
            </div>
            <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">Sub-tasks completed in the last 7 days</p>
        </div>
      </div>
      
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-700 dark:text-gray-300 mb-4">Top Tags</h2>
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md">
            {stats.topTags.length > 0 ? (
                <ul className="space-y-3">
                    {stats.topTags.map(([tag, count]) => (
                        <li key={tag} className="flex justify-between items-center text-gray-700 dark:text-gray-300">
                           <span className="font-semibold bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400 rounded px-2 py-1">{tag}</span>
                           <span className="font-bold">{count} {count > 1 ? 'uses' : 'use'}</span>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-gray-500 italic text-center py-4">No tags used yet. Add tags to your task descriptions to see stats here.</p>
            )}
        </div>
      </div>

    </div>
  );
};

export default StatsView;