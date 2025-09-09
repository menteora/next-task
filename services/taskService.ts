import { SupabaseClient, Session } from '@supabase/supabase-js';
import { Task, Subtask } from '../types';

const getTodayDateString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

// The contract that both local and online APIs will adhere to.
export interface TaskApi {
  getBacklogTasks(): Promise<Task[]>;
  getSnoozedTasks(): Promise<Task[]>;
  getArchivedTasks(): Promise<Task[]>;
  addTask(title: string, description: string, userId: string, order: number): Promise<Task>;
  updateTask(updatedTask: Task): Promise<void>;
  deleteTask(taskId: string): Promise<void>;
  reorderTasks(tasks: { id: string, order: number }[]): Promise<void>;
}

// A private helper function for the local API to get all tasks from storage.
const getAllLocalTasks = (): Task[] => {
    const savedTasks = localStorage.getItem('backlogTasks');
    if (!savedTasks) return [];
    try {
        const parsedTasks = JSON.parse(savedTasks);
        if (!Array.isArray(parsedTasks)) {
            console.error("Tasks from localStorage is not an array.");
            return [];
        }
        return parsedTasks
            .filter(task => task && typeof task === 'object')
            .map((task: any, index: number) => ({
            ...task,
            completed: task.completed ?? false,
            order: task.order ?? index,
            subtasks: (Array.isArray(task.subtasks) ? task.subtasks : [])
                .filter(st => st && typeof st === 'object')
                .map((st: any, stIndex: number) => ({
                ...st,
                order: st.order ?? stIndex
            }))
        }));
    } catch (e) {
        console.error("Failed to parse tasks from localStorage", e);
        return [];
    }
};


// --- Local Storage Implementation ---
const localApi: TaskApi = {
  async getBacklogTasks(): Promise<Task[]> {
    const tasks = getAllLocalTasks();
    const todayString = getTodayDateString();
    return tasks.filter(task => {
        const isSnoozed = task.snoozeUntil && task.snoozeUntil > todayString;
        return !task.completed && !isSnoozed;
    });
  },

  async getSnoozedTasks(): Promise<Task[]> {
    const tasks = getAllLocalTasks();
    const todayString = getTodayDateString();
    return tasks.filter(task => {
        const isSnoozed = task.snoozeUntil && task.snoozeUntil > todayString;
        return !task.completed && isSnoozed;
    });
  },

  async getArchivedTasks(): Promise<Task[]> {
    const tasks = getAllLocalTasks();
    return tasks.filter(task => task.completed);
  },
  
  async addTask(title: string, description: string, _userId: string, order: number): Promise<Task> {
    const tasks = getAllLocalTasks();
    const newTask: Task = {
      id: crypto.randomUUID(),
      title,
      description,
      subtasks: [],
      completed: false,
      order,
    };
    const updatedTasks = [newTask, ...tasks];
    localStorage.setItem('backlogTasks', JSON.stringify(updatedTasks));
    return newTask;
  },

  async updateTask(updatedTask: Task): Promise<void> {
    let tasks = getAllLocalTasks();
    tasks = tasks.map(task => (task.id === updatedTask.id ? updatedTask : task));
    localStorage.setItem('backlogTasks', JSON.stringify(tasks));
  },
  
  async deleteTask(taskId: string): Promise<void> {
    let tasks = getAllLocalTasks();
    tasks = tasks.filter(task => task.id !== taskId);
    localStorage.setItem('backlogTasks', JSON.stringify(tasks));
  },
  
  async reorderTasks(reorderedTasks: { id: string, order: number }[]): Promise<void> {
    let tasks = getAllLocalTasks();
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    reorderedTasks.forEach(reordered => {
      const task = taskMap.get(reordered.id);
      if (task) {
        task.order = reordered.order;
      }
    });
    localStorage.setItem('backlogTasks', JSON.stringify(Array.from(taskMap.values())));
  }
};

// --- Supabase Implementation ---
const createSupabaseApi = (supabase: SupabaseClient, session: Session): TaskApi => {
    
    const fetchAndCombineSubtasks = async (tasksData: any[]): Promise<Task[]> => {
        if (!tasksData || tasksData.length === 0) {
            return [];
        }

        const taskIds = tasksData.map(t => t.id);
        const { data: subtasksData, error: subtasksError } = await supabase
            .from('online_subtasks')
            .select('*')
            .in('task_id', taskIds)
            .order('order', { ascending: true });

        if (subtasksError) throw new Error(`Error fetching subtasks: ${subtasksError.message}`);

        const subtasksByTaskId = new Map<string, Subtask[]>();
        if (subtasksData) {
            subtasksData.forEach(st => {
                const subtask: Subtask = {
                    id: st.id, text: st.text, completed: st.completed, dueDate: st.due_date,
                    completionDate: st.completion_date, recurrence: st.recurrence, order: st.order,
                };
                const existing = subtasksByTaskId.get(st.task_id) || [];
                existing.push(subtask);
                subtasksByTaskId.set(st.task_id, existing);
            });
        }

        return tasksData.map(t => ({
            id: t.id, title: t.title, description: t.description, completed: t.completed,
            completionDate: t.completion_date, snoozeUntil: t.snooze_until, order: t.order,
            subtasks: subtasksByTaskId.get(t.id) || [],
        }));
    };

    return {
        async getBacklogTasks(): Promise<Task[]> {
            const todayString = getTodayDateString();
            const { data: tasksData, error: tasksError } = await supabase
              .from('online_tasks')
              .select('*')
              .eq('completed', false)
              .or(`snooze_until.is.null,snooze_until.lte.${todayString}`)
              .order('order', { ascending: true });
            
            if (tasksError) throw new Error(`Error fetching backlog tasks: ${tasksError.message}`);
            return fetchAndCombineSubtasks(tasksData);
        },

        async getSnoozedTasks(): Promise<Task[]> {
            const todayString = getTodayDateString();
            const { data: tasksData, error: tasksError } = await supabase
              .from('online_tasks')
              .select('*')
              .eq('completed', false)
              .not('snooze_until', 'is', null)
              .gt('snooze_until', todayString)
              .order('snooze_until', { ascending: true });

            if (tasksError) throw new Error(`Error fetching snoozed tasks: ${tasksError.message}`);
            return fetchAndCombineSubtasks(tasksData);
        },

        async getArchivedTasks(): Promise<Task[]> {
            const { data: tasksData, error: tasksError } = await supabase
              .from('online_tasks')
              .select('*')
              .eq('completed', true)
              .order('completion_date', { ascending: false });

            if (tasksError) throw new Error(`Error fetching archived tasks: ${tasksError.message}`);
            return fetchAndCombineSubtasks(tasksData);
        },

        async addTask(title: string, description: string, userId: string, order: number): Promise<Task> {
            const { data, error } = await supabase.from('online_tasks').insert({
            title, description, user_id: userId, order,
            }).select().single();
            
            if (error) throw new Error(`Failed to add task: ${error.message}`);
            
            return {
            id: data.id, title: data.title, description: data.description,
            completed: data.completed, order: data.order, subtasks: [],
            };
        },
  
        async updateTask(updatedTask: Task): Promise<void> {
            const { error } = await supabase.from('online_tasks').update({
                title: updatedTask.title, description: updatedTask.description,
                snooze_until: updatedTask.snoozeUntil || null,
                completed: updatedTask.completed,
                completion_date: updatedTask.completionDate,
            }).match({ id: updatedTask.id });

            if (error) throw new Error(`Failed to update task: ${error.message}`);

            const onlineSubtasks = updatedTask.subtasks.map(st => ({
                id: st.id, task_id: updatedTask.id, user_id: session.user.id,
                text: st.text, completed: st.completed, due_date: st.dueDate,
                completion_date: st.completionDate, recurrence: st.recurrence, order: st.order,
            }));
            
            // Replace all subtasks for simplicity, matching the previous app logic.
            await supabase.from('online_subtasks').delete().match({ task_id: updatedTask.id });
            
            if (onlineSubtasks.length > 0) {
              const { error: subtaskError } = await supabase.from('online_subtasks').upsert(onlineSubtasks);
              if (subtaskError) throw new Error(`Failed to update subtasks: ${subtaskError.message}`);
            }
        },
        
        async deleteTask(taskId: string): Promise<void> {
            const { error } = await supabase.from('online_tasks').delete().match({ id: taskId });
            if (error) throw new Error(`Failed to delete task: ${error.message}`);
        },

        async reorderTasks(reorderedTasks: { id: string, order: number }[]): Promise<void> {
            const updates = reorderedTasks.map(t =>
            supabase.from('online_tasks').update({ order: t.order }).match({ id: t.id })
            );
            const results = await Promise.all(updates);
            const firstError = results.find(res => res.error);
            if (firstError) throw new Error(`Failed to reorder tasks: ${firstError.error!.message}`);
        },
    }
};

/**
 * Factory function to create the appropriate task service based on the current mode.
 * @param isOnlineMode - Flag to determine if the app is in online or local mode.
 * @param supabase - The Supabase client instance, required for online mode.
 * @param session - The active Supabase session, required for online mode.
 * @returns An implementation of the TaskApi.
 */
export const createTaskService = (
    isOnlineMode: boolean,
    supabase: SupabaseClient | null,
    session: Session | null
): TaskApi => {
    if (isOnlineMode && supabase && session) {
        return createSupabaseApi(supabase, session);
    }
    return localApi;
};