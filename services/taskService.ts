import { SupabaseClient, Session } from '@supabase/supabase-js';
import { Task, Subtask } from '../types';

// The contract that both local and online APIs will adhere to.
export interface TaskApi {
  getTasks(): Promise<Task[]>;
  addTask(title: string, description: string, userId: string, order: number): Promise<Task>;
  updateTask(updatedTask: Task): Promise<void>;
  deleteTask(taskId: string): Promise<void>;
  reorderTasks(tasks: { id: string, order: number }[]): Promise<void>;
}

// --- Local Storage Implementation ---
const localApi: TaskApi = {
  async getTasks(): Promise<Task[]> {
    const savedTasks = localStorage.getItem('backlogTasks');
    if (!savedTasks) return [];
    try {
      const parsedTasks = JSON.parse(savedTasks);
      // Fix: Add a type guard to ensure parsedTasks is an array. This helps with type safety and prevents runtime errors.
      if (!Array.isArray(parsedTasks)) {
        console.error("Tasks from localStorage is not an array.");
        return [];
      }
      // Ensure data integrity
      return parsedTasks.map((task: any, index: number) => ({
        ...task,
        completed: task.completed ?? false,
        order: task.order ?? index,
        subtasks: (task.subtasks || []).map((st: any, stIndex: number) => ({
            ...st,
            order: st.order ?? stIndex
        }))
      }));
    } catch (e) {
      console.error("Failed to parse tasks from localStorage", e);
      return [];
    }
  },
  
  async addTask(title: string, description: string, _userId: string, order: number): Promise<Task> {
    const tasks = await this.getTasks();
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
    let tasks = await this.getTasks();
    tasks = tasks.map(task => (task.id === updatedTask.id ? updatedTask : task));
    localStorage.setItem('backlogTasks', JSON.stringify(tasks));
  },
  
  async deleteTask(taskId: string): Promise<void> {
    let tasks = await this.getTasks();
    tasks = tasks.filter(task => task.id !== taskId);
    localStorage.setItem('backlogTasks', JSON.stringify(tasks));
  },
  
  async reorderTasks(reorderedTasks: { id: string, order: number }[]): Promise<void> {
    let tasks = await this.getTasks();
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
const createSupabaseApi = (supabase: SupabaseClient, session: Session): TaskApi => ({
  async getTasks(): Promise<Task[]> {
    const { data: tasksData, error: tasksError } = await supabase
      .from('online_tasks')
      .select('*')
      .order('order', { ascending: true });

    if (tasksError) {
      let msg = `Error fetching tasks: ${tasksError.message}`;
      if (tasksError.message.includes("does not exist")) {
          msg = "Error: 'online_tasks' table not found. Please run the setup SQL from Settings.";
      }
      throw new Error(msg);
    }

    const { data: subtasksData, error: subtasksError } = await supabase
      .from('online_subtasks')
      .select('*')
      .order('order', { ascending: true });
      
    if (subtasksError) throw new Error(`Error fetching subtasks: ${subtasksError.message}`);
    
    const subtasksByTaskId = new Map<string, Subtask[]>();
    subtasksData.forEach(st => {
      const subtask: Subtask = {
        id: st.id, text: st.text, completed: st.completed, dueDate: st.due_date,
        completionDate: st.completion_date, recurrence: st.recurrence, order: st.order,
      };
      const existing = subtasksByTaskId.get(st.task_id) || [];
      existing.push(subtask);
      subtasksByTaskId.set(st.task_id, existing);
    });

    return tasksData.map(t => ({
      id: t.id, title: t.title, description: t.description, completed: t.completed,
      completionDate: t.completion_date, snoozeUntil: t.snooze_until, order: t.order,
      subtasks: subtasksByTaskId.get(t.id) || [],
    }));
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
        snooze_until: updatedTask.snoozeUntil, completed: updatedTask.completed,
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
    const { error: subtaskError } = await supabase.from('online_subtasks').upsert(onlineSubtasks);

    if (subtaskError) throw new Error(`Failed to update subtasks: ${subtaskError.message}`);
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
});

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