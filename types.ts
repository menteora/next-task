export interface RecurrenceRule {
  frequency: 'daily' | 'weekly';
  interval: number;
  daysOfWeek?: ('sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat')[];
}

export interface Subtask {
  id: string;
  text: string;
  completed: boolean;
  dueDate?: string;
  isInstance?: boolean;
  masterSubtaskId?: string;
  completionDate?: string;
  order: number;
  recurrenceRule?: RecurrenceRule;
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
