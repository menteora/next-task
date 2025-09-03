export interface Subtask {
  id: string;
  text: string;
  completed: boolean;
  dueDate?: string;
  isInstance?: boolean;
  completionDate?: string;
  order: number;
}

export interface Task {
  id:string;
  title: string;
  description: string;
  subtasks: Subtask[];
  recurring?: boolean;
  completed: boolean;
  completionDate?: string;
  snoozeUntil?: string;
  order: number;
}