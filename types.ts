export type SyncStatus = 'synced' | 'pending' | 'error' | 'local';

export interface Subtask {
  id: string;
  text: string;
  completed: boolean;
  dueDate?: string;
  isInstance?: boolean;
  completionDate?: string;
  syncStatus?: SyncStatus;
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
  syncStatus?: SyncStatus;
}
