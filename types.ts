
export interface Subtask {
  id: string;
  text: string;
  completed: boolean;
  dueDate?: string;
  recurrence?: {
    unit: 'day' | 'week' | 'month' | 'year';
    value: number;
  };
  completionDate?: string;
  order: number;
}

export interface Task {
  id:string;
  title: string;
  description: string;
  subtasks: Subtask[];
  completed: boolean;
  completionDate?: string;
  snoozeUntil?: string;
  order: number;
}
