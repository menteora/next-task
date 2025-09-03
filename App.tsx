import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Task, Subtask } from './types';
import TaskItem from './components/TaskItem';
import SubtaskModal from './components/SubtaskModal';
import TodaySubtaskItem from './components/TodaySubtaskItem';
import StatsView from './components/StatsView';
import SettingsView from './components/SettingsView';
import ConfirmationModal from './components/ConfirmationModal';
import { createSupabaseClient } from './supabaseClient';
import { PlusIcon, SunIcon, MoonIcon, ListIcon, CalendarIcon, BarChartIcon, ArrowsPointingInIcon, ArrowsPointingOutIcon, DownloadIcon, UploadIcon, SettingsIcon, CloudUploadIcon, CloudDownloadIcon, SpinnerIcon, LogOutIcon, ArchiveIcon, SnoozeIcon, ChevronDownIcon } from './components/icons';
import { Session, SupabaseClient } from '@supabase/supabase-js';

type TodayItem = { subtask: Subtask, parentTask: Task };
type Theme = 'light' | 'dark';
type View = 'backlog' | 'today' | 'snoozed' | 'archive' | 'stats' | 'settings';
type SupabaseAction = 'import' | 'export';
type SortOption = 'manual' | 'days_passed';


interface SupabaseConfig {
  url: string;
  anonKey: string;
  email: string;
}

interface StatusMessage {
  type: 'success' | 'error';
  text: string;
}

interface ConfirmationState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  confirmClass: string;
  onConfirm: () => void;
}


const App: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  
  const [todayOrder, setTodayOrder] = useState<string[]>(() => {
      const savedOrder = localStorage.getItem('todayOrder');
      return savedOrder ? JSON.parse(savedOrder) : [];
  });

  const [view, setView] = useState<View>(() => {
    const savedView = localStorage.getItem('backlogView') as View;
    return savedView || 'backlog';
  });

  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem('theme') as Theme;
    if (savedTheme) return savedTheme;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });
  
  const [isOnlineMode, setIsOnlineMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('isOnlineMode');
    return saved ? JSON.parse(saved) : false;
  });

  const [supabaseConfig, setSupabaseConfig] = useState<SupabaseConfig | null>(() => {
    const savedConfig = localStorage.getItem('supabaseConfig');
    return savedConfig ? JSON.parse(savedConfig) : null;
  });

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [isNewTaskRecurring, setIsNewTaskRecurring] = useState(false);
  const [isFormVisible, setIsFormVisible] = useState(false);
  
  const [modalTask, setModalTask] = useState<Task | null>(null);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [draggedTodayItem, setDraggedTodayItem] = useState<TodayItem | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>(() => {
    const savedTags = localStorage.getItem('selectedTags');
    return savedTags ? JSON.parse(savedTags) : [];
  });
  const [isCompactView, setIsCompactView] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>('manual');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Supabase state
  const supabase = useMemo(() => {
    if (supabaseConfig) {
        return createSupabaseClient(supabaseConfig.url, supabaseConfig.anonKey);
    }
    return null;
  }, [supabaseConfig]);
  const [supabaseSession, setSupabaseSession] = useState<Session | null>(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [supabaseAction, setSupabaseAction] = useState<SupabaseAction | null>(null);
  const [isSupabaseLoading, setIsSupabaseLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Confirmation Modal State
  const [confirmationState, setConfirmationState] = useState<ConfirmationState>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    confirmClass: 'bg-cyan-600 hover:bg-cyan-700',
    onConfirm: () => {},
  });


  useEffect(() => {
    if (!isOnlineMode) {
      localStorage.setItem('backlogTasks', JSON.stringify(tasks));
    }
  }, [tasks, isOnlineMode]);

  useEffect(() => {
    localStorage.setItem('todayOrder', JSON.stringify(todayOrder));
  }, [todayOrder]);
  
  useEffect(() => {
    localStorage.setItem('backlogView', view);
  }, [view]);
  
  useEffect(() => {
    localStorage.setItem('isOnlineMode', JSON.stringify(isOnlineMode));
  }, [isOnlineMode]);

  useEffect(() => {
    localStorage.setItem('selectedTags', JSON.stringify(selectedTags));
  }, [selectedTags]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);
  
   useEffect(() => {
    if (supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSupabaseSession(session);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setSupabaseSession(session);
      });

      return () => subscription.unsubscribe();
    }
  }, [supabase]);
  
  // Data Loading Logic
  const fetchOnlineTasks = useCallback(async (db: SupabaseClient) => {
    setIsLoading(true);
    const { data: tasksData, error: tasksError } = await db
      .from('online_tasks')
      .select('*')
      .order('order', { ascending: true });

    if (tasksError) {
      let errorMessage = `Error fetching tasks: ${tasksError.message}`;
      if (tasksError.message.includes("does not exist") || tasksError.message.includes("Could not find the table")) {
          errorMessage = "Error: 'online_tasks' table not found. Please run the setup SQL from the Settings page in your Supabase project.";
      }
      setStatusMessage({ type: 'error', text: errorMessage });
      setIsLoading(false);
      return;
    }

    const { data: subtasksData, error: subtasksError } = await db
      .from('online_subtasks')
      .select('*')
      .order('order', { ascending: true });
      
    if (subtasksError) {
      let errorMessage = `Error fetching subtasks: ${subtasksError.message}`;
      if (subtasksError.message.includes("does not exist") || subtasksError.message.includes("Could not find the table")) {
          errorMessage = "Error: 'online_subtasks' table not found. Please run the setup SQL from the Settings page in your Supabase project.";
      }
      setStatusMessage({ type: 'error', text: errorMessage });
      setIsLoading(false);
      return;
    }
    
    const subtasksByTaskId = new Map<string, Subtask[]>();
    subtasksData.forEach(st => {
      const subtask: Subtask = {
        id: st.id,
        text: st.text,
        completed: st.completed,
        dueDate: st.due_date,
        completionDate: st.completion_date,
        isInstance: st.is_instance,
        order: st.order,
      };
      const existing = subtasksByTaskId.get(st.task_id) || [];
      existing.push(subtask);
      subtasksByTaskId.set(st.task_id, existing);
    });

    const fetchedTasks: Task[] = tasksData.map(t => ({
      id: t.id,
      title: t.title,
      description: t.description,
      completed: t.completed,
      completionDate: t.completion_date,
      recurring: t.recurring,
      snoozeUntil: t.snooze_until,
      order: t.order,
      subtasks: subtasksByTaskId.get(t.id) || [],
    }));
    
    setTasks(fetchedTasks);
    setIsLoading(false);
  }, []);

  const loadLocalTasks = () => {
    const savedTasks = localStorage.getItem('backlogTasks');
    if (savedTasks) {
      try {
        const parsedTasks = JSON.parse(savedTasks);
        setTasks(parsedTasks.map((task: any, index: number) => ({
          ...task,
          completed: task.completed ?? false,
          order: task.order ?? index,
          subtasks: (task.subtasks || []).map((st: any, stIndex: number) => ({
              ...st,
              order: st.order ?? stIndex
          }))
        })));
      } catch (e) {
        console.error("Failed to parse tasks from localStorage", e);
        setTasks([]);
      }
    } else {
        setTasks([]);
    }
  };

  useEffect(() => {
    if (isOnlineMode && supabase && supabaseSession) {
        fetchOnlineTasks(supabase);
    } else if (!isOnlineMode) {
        loadLocalTasks();
    }
  }, [isOnlineMode, supabase, supabaseSession, fetchOnlineTasks]);


  const handleSaveSupabaseConfig = (config: SupabaseConfig) => {
    setSupabaseConfig(config);
    localStorage.setItem('supabaseConfig', JSON.stringify(config));
    setStatusMessage({ type: 'success', text: 'Supabase settings saved!' });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const getTodayDateString = () => new Date().toISOString().split('T')[0];

  const extractTags = (text: string): string[] => {
    const regex = /#(\w+)/g;
    return text.match(regex) || [];
  };

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    tasks.forEach(task => {
        if (!task.completed) {
            extractTags(task.description).forEach(tag => tags.add(tag));
        }
    });
    return Array.from(tags).sort();
  }, [tasks]);

  const handleAddTagToDescription = (tag: string, setter: React.Dispatch<React.SetStateAction<string>>) => {
    setter(prev => `${prev.trim()} ${tag}`.trim());
  };
  
  const calculateLastTouchedDaysAgo = (task: Task): number | null => {
    const completedSubtasks = task.subtasks.filter(st => st.completed && st.completionDate);
    if (completedSubtasks.length === 0) {
      return null;
    }

    const lastCompletionDate = new Date(
      Math.max(
        ...completedSubtasks.map(st => new Date(st.completionDate!).getTime())
      )
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    lastCompletionDate.setHours(0, 0, 0, 0);
    
    const diffTime = today.getTime() - lastCompletionDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  };

  const sortedAndFilteredTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let activeTasks = tasks.filter(task => 
      !task.completed &&
      (!task.snoozeUntil || new Date(task.snoozeUntil) <= today)
    );

    if (selectedTags.length > 0) {
        activeTasks = activeTasks.filter(task => {
            const taskTags = extractTags(task.description);
            return selectedTags.every(selectedTag => taskTags.includes(selectedTag));
        });
    }

    if (sortOption === 'days_passed') {
        activeTasks.sort((a, b) => {
            const daysA = calculateLastTouchedDaysAgo(a);
            const daysB = calculateLastTouchedDaysAgo(b);

            const aIsEmpty = daysA === null;
            const bIsEmpty = daysB === null;

            if (aIsEmpty && bIsEmpty) return 0;
            if (aIsEmpty) return -1; 
            if (bIsEmpty) return 1; 
            
            return daysB - daysA;
        });
    }

    return activeTasks;
  }, [tasks, selectedTags, sortOption]);

  const snoozedTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return tasks
      .filter(task => task.snoozeUntil && new Date(task.snoozeUntil) > today && !task.completed)
      .sort((a, b) => new Date(a.snoozeUntil!).getTime() - new Date(b.snoozeUntil!).getTime());
  }, [tasks]);

  const archivedTasks = useMemo(() => {
    return tasks
      .filter(task => task.completed)
      .sort((a, b) => {
        if (a.completionDate && b.completionDate) {
          return new Date(b.completionDate).getTime() - new Date(a.completionDate).getTime();
        }
        return 0;
      });
  }, [tasks]);
  
  const todaySubtasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayString = getTodayDateString();
    const result: TodayItem[] = [];

    tasks.forEach(task => {
        task.subtasks.forEach(subtask => {
            const wasCompletedToday = subtask.completed && subtask.completionDate?.startsWith(todayString);
            
            let isDueToday = false;
            let isOverdueAndIncomplete = false;

            if (subtask.dueDate) {
                const dueDate = new Date(subtask.dueDate + 'T00:00:00');
                isDueToday = subtask.dueDate === todayString;
                isOverdueAndIncomplete = dueDate < today && !subtask.completed;
            }

            if (isDueToday || isOverdueAndIncomplete || wasCompletedToday) {
                result.push({ subtask, parentTask: task });
            }
        });
    });
    return result;
  }, [tasks]);

  useEffect(() => {
    setTodayOrder(currentOrder => {
      const incompleteTodaySubtasksList = todaySubtasks.filter(item => !item.subtask.completed);
      const incompleteTodaySubtaskIds = new Set(incompleteTodaySubtasksList.map(item => item.subtask.id));
      
      const newOrder = currentOrder.filter(id => incompleteTodaySubtaskIds.has(id));

      incompleteTodaySubtasksList.forEach(item => {
        if (!newOrder.includes(item.subtask.id)) {
          newOrder.push(item.subtask.id);
        }
      });
      
      return newOrder;
    });
  }, [todaySubtasks]);

  const incompleteTodaySubtasks = useMemo(() => {
    const subtaskMap = new Map(todaySubtasks.map(item => [item.subtask.id, item]));
    return todayOrder
        .map(id => subtaskMap.get(id))
        .filter((item): item is TodayItem => !!item && !item.subtask.completed);
  }, [todayOrder, todaySubtasks]);

  const completedTodaySubtasks = useMemo(() => {
    return todaySubtasks
      .filter(item => item.subtask.completed)
      .sort((a, b) => {
        if (!a.subtask.completionDate) return 1;
        if (!b.subtask.completionDate) return -1;
        return new Date(a.subtask.completionDate).getTime() - new Date(b.subtask.completionDate).getTime();
      });
  }, [todaySubtasks]);


  const handleTagClick = (tag: string) => {
    setSelectedTags(prev =>
        prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;

    if (isOnlineMode && supabase && supabaseSession) {
      const maxOrder = tasks.reduce((max, task) => Math.max(task.order, max), -1);
      const { data, error } = await supabase.from('online_tasks').insert({
        title: newTaskTitle.trim(),
        description: newTaskDescription.trim(),
        recurring: isNewTaskRecurring,
        user_id: supabaseSession.user.id,
        order: maxOrder + 1
      }).select().single();

      if (error) {
        setStatusMessage({type: 'error', text: `Failed to add task: ${error.message}`});
      } else {
        const newTask: Task = {
          id: data.id,
          title: data.title,
          description: data.description,
          completed: data.completed,
          recurring: data.recurring,
          order: data.order,
          subtasks: [],
        };
        setTasks(prev => [newTask, ...prev]);
      }

    } else {
      const maxOrder = tasks.reduce((max, task) => Math.max(task.order, max), -1);
      const newTask: Task = {
        id: crypto.randomUUID(),
        title: newTaskTitle.trim(),
        description: newTaskDescription.trim(),
        subtasks: [],
        recurring: isNewTaskRecurring,
        completed: false,
        order: maxOrder + 1,
      };
      setTasks(prevTasks => [newTask, ...prevTasks.filter(t => !t.completed), ...prevTasks.filter(t => t.completed)]);
    }
    setNewTaskTitle('');
    setNewTaskDescription('');
    setIsNewTaskRecurring(false);
    setIsFormVisible(false);
  };

  const closeConfirmationModal = () => {
    setConfirmationState(prev => ({ ...prev, isOpen: false }));
  };

  const handleDeleteTask = useCallback(async (taskId: string) => {
    if (isOnlineMode && supabase) {
      const { error } = await supabase.from('online_tasks').delete().match({ id: taskId });
      if (error) {
        setStatusMessage({type: 'error', text: `Failed to delete task: ${error.message}`});
        return;
      }
    }
    setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
  }, [isOnlineMode, supabase]);

  const requestDeleteTask = useCallback((taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    setConfirmationState({
        isOpen: true,
        title: 'Confirm Deletion',
        message: `Are you sure you want to delete the task "${task?.title || ''}"? This action cannot be undone.`,
        confirmText: 'Delete',
        confirmClass: 'bg-red-600 hover:bg-red-700',
        onConfirm: () => {
            handleDeleteTask(taskId);
            closeConfirmationModal();
        },
    });
  }, [tasks, handleDeleteTask]);

  const handleUpdateTask = useCallback(async (updatedTask: Task) => {
    if (isOnlineMode && supabase) {
        const { error } = await supabase.from('online_tasks').update({
            title: updatedTask.title,
            description: updatedTask.description,
            recurring: updatedTask.recurring,
            snooze_until: updatedTask.snoozeUntil,
            completed: updatedTask.completed,
            completion_date: updatedTask.completionDate,
        }).match({ id: updatedTask.id });
        if (error) {
            setStatusMessage({type: 'error', text: `Failed to update task: ${error.message}`});
            return;
        }

        const onlineSubtasks = updatedTask.subtasks.map(st => ({
            id: st.id,
            task_id: updatedTask.id,
            user_id: supabaseSession?.user.id,
            text: st.text,
            completed: st.completed,
            due_date: st.dueDate,
            completion_date: st.completionDate,
            is_instance: st.isInstance,
            order: st.order,
        }));

        // In a real app you might do more granular subtask updates
        // For simplicity here, we delete and re-insert
        await supabase.from('online_subtasks').delete().match({ task_id: updatedTask.id });
        const { error: subtaskError } = await supabase.from('online_subtasks').upsert(onlineSubtasks);

         if (subtaskError) {
            setStatusMessage({type: 'error', text: `Failed to update subtasks: ${subtaskError.message}`});
            return;
        }
    }

    setTasks(prevTasks => prevTasks.map(task => task.id === updatedTask.id ? updatedTask : task));
    if (modalTask && modalTask.id === updatedTask.id) {
        setModalTask(updatedTask);
    }
  }, [isOnlineMode, supabase, modalTask, supabaseSession]);
  
  const handleToggleTaskComplete = useCallback(async (taskId: string) => {
    const taskToToggle = tasks.find(task => task.id === taskId);
    if (!taskToToggle) return;

    const isCompleted = !taskToToggle.completed;
    const completionDate = isCompleted ? new Date().toISOString() : undefined;

    if (isOnlineMode && supabase) {
        const { error } = await supabase.from('online_tasks').update({
            completed: isCompleted,
            completion_date: completionDate,
        }).match({ id: taskId });
        if (error) {
            setStatusMessage({type: 'error', text: `Failed to toggle task: ${error.message}`});
            return;
        }
    }
    
    setTasks(prevTasks =>
      prevTasks.map(task => 
        task.id === taskId ? { ...task, completed: isCompleted, completionDate } : task
      )
    );
  }, [tasks, isOnlineMode, supabase]);

  const handleSnoozeTask = useCallback(async (taskId: string, duration: 'day' | 'week' | 'month') => {
    const newDate = new Date();
    newDate.setHours(0, 0, 0, 0); 
    if (duration === 'day') newDate.setDate(newDate.getDate() + 1);
    if (duration === 'week') newDate.setDate(newDate.getDate() + 7);
    if (duration === 'month') newDate.setMonth(newDate.getMonth() + 1);
    const snoozeUntilDate = newDate.toISOString().split('T')[0];

    if (isOnlineMode && supabase) {
        const { error } = await supabase.from('online_tasks').update({ snooze_until: snoozeUntilDate }).match({ id: taskId });
        if (error) {
            setStatusMessage({type: 'error', text: `Failed to snooze task: ${error.message}`});
            return;
        }
    }

    setTasks(prevTasks => prevTasks.map(task => 
        task.id === taskId ? { ...task, snoozeUntil: snoozeUntilDate } : task
    ));
  }, [isOnlineMode, supabase]);

  const handleUnsnoozeTask = useCallback(async (taskId: string) => {
    if (isOnlineMode && supabase) {
        const { error } = await supabase.from('online_tasks').update({ snooze_until: null }).match({ id: taskId });
        if (error) {
            setStatusMessage({type: 'error', text: `Failed to unsnooze task: ${error.message}`});
            return;
        }
    }
      setTasks(prevTasks => prevTasks.map(task => {
          if (task.id === taskId) {
              const { snoozeUntil, ...rest } = task;
              return rest;
          }
          return task;
      }));
  }, [isOnlineMode, supabase]);

  const handleSetSubtaskDueDate = useCallback(async (subtaskId: string, taskId: string, date: string) => {
      let finalTask: Task | undefined;
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;
      
      const subtaskIndex = task.subtasks.findIndex(st => st.id === subtaskId);
      if (subtaskIndex === -1) return;

      if (task.recurring) {
          const originalSubtask = task.subtasks[subtaskIndex];
          const maxOrder = task.subtasks.reduce((max, st) => Math.max(st.order, max), -1);
          const newInstance: Subtask = {
              ...originalSubtask,
              id: crypto.randomUUID(),
              completed: false,
              dueDate: date,
              isInstance: true,
              completionDate: undefined,
              order: maxOrder + 1
          };
          finalTask = { ...task, subtasks: [...task.subtasks, newInstance] };

          if (isOnlineMode && supabase && supabaseSession) {
              await supabase.from('online_subtasks').insert({
                  id: newInstance.id,
                  task_id: taskId,
                  user_id: supabaseSession.user.id,
                  text: newInstance.text,
                  due_date: date,
                  is_instance: true,
                  order: newInstance.order
              });
          }
      } else {
          const updatedSubtasks = [...task.subtasks];
          updatedSubtasks[subtaskIndex] = { ...updatedSubtasks[subtaskIndex], dueDate: date };
          finalTask = { ...task, subtasks: updatedSubtasks };
          if (isOnlineMode && supabase) {
              await supabase.from('online_subtasks').update({ due_date: date }).match({ id: subtaskId });
          }
      }

      if (finalTask) {
        setTasks(prevTasks => prevTasks.map(t => t.id === taskId ? finalTask! : t));
        if (modalTask?.id === taskId) {
            setModalTask(finalTask);
        }
      }
  }, [tasks, isOnlineMode, supabase, modalTask, supabaseSession]);


  const handleToggleTodaySubtaskComplete = useCallback(async (subtaskId: string, taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    const subtask = task?.subtasks.find(st => st.id === subtaskId);
    if (!task || !subtask) return;

    const isCompleted = !subtask.completed;
    const completionDate = isCompleted ? new Date().toISOString() : undefined;

    if (isOnlineMode && supabase) {
      await supabase.from('online_subtasks').update({
        completed: isCompleted,
        completion_date: completionDate,
      }).match({id: subtaskId});
    }

    setTasks(prevTasks => 
        prevTasks.map(t => {
            if (t.id !== taskId) return t;
            return {
                ...t,
                subtasks: t.subtasks.map(st => 
                    st.id === subtaskId ? { ...st, completed: isCompleted, completionDate } : st
                ),
            };
        })
    );
}, [tasks, isOnlineMode, supabase]);

  const handleUnsetSubtaskDueDate = useCallback(async (subtaskId: string, taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    const subtask = task?.subtasks.find(st => st.id === subtaskId);
    if (!task || !subtask) return;
    
    let updatedTask: Task;

    if (subtask.isInstance) {
        if(isOnlineMode && supabase) await supabase.from('online_subtasks').delete().match({id: subtaskId});
        updatedTask = { ...task, subtasks: task.subtasks.filter(st => st.id !== subtaskId) };
    } else {
        if(isOnlineMode && supabase) await supabase.from('online_subtasks').update({ due_date: null }).match({id: subtaskId});
        const updatedSubtasks = task.subtasks.map(st =>
            st.id === subtaskId ? { ...st, dueDate: undefined } : st
        );
        updatedTask = { ...task, subtasks: updatedSubtasks };
    }
    setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));

  }, [tasks, isOnlineMode, supabase]);
  
  const handleMoveTask = useCallback(async (taskId: string, direction: 'up' | 'down' | 'top' | 'bottom') => {
    
    const activeTasks = tasks.filter(t => !t.completed).sort((a,b) => a.order - b.order);
    const completedTasks = tasks.filter(t => t.completed);

    const fromIndex = activeTasks.findIndex(t => t.id === taskId);
    if(fromIndex === -1) return;

    const reorderedActive = [...activeTasks];
    const [movedItem] = reorderedActive.splice(fromIndex, 1);
    
    if (direction === 'top') reorderedActive.unshift(movedItem);
    else if (direction === 'bottom') reorderedActive.push(movedItem);
    else if (direction === 'up' && fromIndex > 0) reorderedActive.splice(fromIndex - 1, 0, movedItem);
    else if (direction === 'down' && fromIndex < reorderedActive.length) reorderedActive.splice(fromIndex + 1, 0, movedItem);
    else return;

    const updatedTasksWithOrder = reorderedActive.map((task, index) => ({...task, order: index}));

    if (isOnlineMode && supabase) {
        const updates = updatedTasksWithOrder.map(t => supabase.from('online_tasks').update({order: t.order}).match({id: t.id}));
        await Promise.all(updates);
    }
    
    setTasks([...updatedTasksWithOrder, ...completedTasks]);

}, [tasks, isOnlineMode, supabase]);

const handleMoveTodaySubtask = useCallback((subtaskId: string, direction: 'up' | 'down' | 'top' | 'bottom') => {
    setTodayOrder(currentOrder => {
        const fromIndex = currentOrder.findIndex(id => id === subtaskId);
        if (fromIndex === -1) return currentOrder;

        const newOrder = [...currentOrder];
        
        if (direction === 'top') {
            if (fromIndex === 0) return currentOrder;
            const [item] = newOrder.splice(fromIndex, 1);
            newOrder.unshift(item);
        } else if (direction === 'bottom') {
            if (fromIndex === newOrder.length - 1) return currentOrder;
            const [item] = newOrder.splice(fromIndex, 1);
            newOrder.push(item);
        } else if (direction === 'up') {
            if (fromIndex === 0) return currentOrder;
            [newOrder[fromIndex], newOrder[fromIndex - 1]] = [newOrder[fromIndex - 1], newOrder[fromIndex]];
        } else if (direction === 'down') {
            if (fromIndex === newOrder.length - 1) return currentOrder;
            [newOrder[fromIndex], newOrder[fromIndex + 1]] = [newOrder[fromIndex + 1], newOrder[fromIndex]];
        }
        return newOrder;
    });
}, []);


  const handleOpenSubtaskModal = useCallback((task: Task) => {
    setModalTask(task);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalTask(null);
  }, []);
  
  const onDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, task: Task) => {
    setDraggedTask(task);
  }, []);
  
  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>, targetTask: Task) => {
    e.preventDefault();
    if (!draggedTask || view !== 'backlog' || draggedTask.completed || targetTask.completed || sortOption !== 'manual') return;

    const activeTasks = tasks.filter(t => !t.completed).sort((a,b) => a.order - b.order);
    const completedTasks = tasks.filter(t => t.completed);

    const fromIndex = activeTasks.findIndex(t => t.id === draggedTask.id);
    const toIndex = activeTasks.findIndex(t => t.id === targetTask.id);

    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;
    
    const reordered = [...activeTasks];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    const updatedTasksWithOrder = reordered.map((t, i) => ({...t, order: i}));
    
    if (isOnlineMode && supabase) {
      const updates = updatedTasksWithOrder.map(t => supabase.from('online_tasks').update({order: t.order}).match({id: t.id}));
      Promise.all(updates);
    }
    
    setTasks([...updatedTasksWithOrder, ...completedTasks]);
    setDraggedTask(null);
  }, [draggedTask, view, sortOption, tasks, isOnlineMode, supabase]);
  
  const onTodayDragStart = useCallback((item: TodayItem) => setDraggedTodayItem(item), []);
  
  const onTodayDrop = useCallback((targetItem: TodayItem) => {
    if (!draggedTodayItem || draggedTodayItem.subtask.completed || targetItem.subtask.completed) {
      setDraggedTodayItem(null);
      return;
    }
    
    const fromId = draggedTodayItem.subtask.id;
    const toId = targetItem.subtask.id;
    
    if (fromId !== toId) {
      setTodayOrder(currentOrder => {
        const fromIndex = currentOrder.findIndex(id => id === fromId);
        const toIndex = currentOrder.findIndex(id => id === toId);
        
        if (fromIndex === -1 || toIndex === -1) {
          return currentOrder;
        }

        const newOrder = [...currentOrder];
        const [movedItem] = newOrder.splice(fromIndex, 1);
        newOrder.splice(toIndex, 0, movedItem);

        return newOrder;
      });
    }

    setDraggedTodayItem(null);
  }, [draggedTodayItem]);

  const handleExportTasks = useCallback(() => {
    try {
        const dataStr = JSON.stringify(tasks, null, 2);
        const dataBlob = new Blob([dataStr], {type: "application/json"});
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'backlog_export.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Error exporting tasks:", error);
    }
  }, [tasks]);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const text = e.target?.result;
            if (typeof text !== 'string') {
                throw new Error("File could not be read as text.");
            }
            const importedTasks = JSON.parse(text);

            if (!Array.isArray(importedTasks) || (importedTasks.length > 0 && typeof importedTasks[0].id === 'undefined')) {
                 setStatusMessage({ type: 'error', text: 'Invalid file format. Please import a valid JSON export file.' });
                 setTimeout(() => setStatusMessage(null), 3000);
                 return;
            }
            
            const sanitizedTasks = importedTasks.map((task: any, index: number) => ({
              ...task,
              order: task.order ?? index,
              subtasks: (task.subtasks || []).map((st: any, stIndex: number) => ({
                ...st,
                order: st.order ?? stIndex,
                isInstance: st.isInstance ?? false,
              }))
            }));

            setTasks(sanitizedTasks);
            setTodayOrder([]);
            setStatusMessage({ type: 'success', text: `${sanitizedTasks.length} tasks imported successfully!` });
            setTimeout(() => setStatusMessage(null), 3000);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during import.";
            setStatusMessage({ type: 'error', text: `Error importing tasks: ${errorMessage}` });
            setTimeout(() => setStatusMessage(null), 3000);
        } finally {
            if (event.target) {
                event.target.value = '';
            }
        }
    };
    reader.onerror = () => {
      setStatusMessage({ type: 'error', text: 'An error occurred while reading the file.' });
      setTimeout(() => setStatusMessage(null), 3000);
    };
    reader.readAsText(file);
  };
  
  const executeSupabaseAction = async (action: SupabaseAction, session: Session) => {
      if (!supabase) return;

      setIsSupabaseLoading(true);
      setStatusMessage(null);
      
      if (action === 'export') {
        const { error } = await supabase
          .from('tasks')
          .insert({ user_id: session.user.id, data: tasks });
        if (error) {
            setStatusMessage({ type: 'error', text: `Export failed: ${error.message}` });
        } else {
            setStatusMessage({ type: 'success', text: "New revision saved to Supabase!" });
        }
      } else if (action === 'import') {
        const { data, error } = await supabase
          .from('tasks')
          .select('data')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (error || !data) {
            setStatusMessage({ type: 'error', text: `Import failed: ${error?.message || 'No data found.'}` });
        } else if (data) {
            setTasks(data.data || []);
            setTodayOrder([]);
            setStatusMessage({ type: 'success', text: "Latest revision successfully imported!" });
        }
      }
      
      setIsSupabaseLoading(false);
      setSupabaseAction(null);
      setTimeout(() => setStatusMessage(null), 5000);
  };
  
  const handlePasswordConfirm = async () => {
    if (!supabase || !supabaseConfig || !supabaseAction) return;

    setIsSupabaseLoading(true);
    setStatusMessage(null);

    const { data, error } = await supabase.auth.signInWithPassword({
        email: supabaseConfig.email,
        password: password,
    });

    if (error) {
        setStatusMessage({ type: 'error', text: error.message });
        setIsSupabaseLoading(false);
        setPassword('');
    } else if (data.session) {
        setIsPasswordModalOpen(false);
        setPassword('');
        await executeSupabaseAction(supabaseAction, data.session);
    }
  };

  const triggerSupabaseAction = async (action: SupabaseAction) => {
      if (!supabase) return;

      setSupabaseAction(action);
      
      if (supabaseSession) {
          await executeSupabaseAction(action, supabaseSession);
      } else {
          setIsPasswordModalOpen(true);
      }
  };

  const requestSupabaseImport = () => {
    setConfirmationState({
      isOpen: true,
      title: 'Confirm Import from Cloud',
      message: 'This will overwrite all your local tasks with the latest version from the cloud. Are you sure you want to continue?',
      confirmText: 'Import & Overwrite',
      confirmClass: 'bg-cyan-600 hover:bg-cyan-700',
      onConfirm: () => {
        triggerSupabaseAction('import');
        closeConfirmationModal();
      },
    });
  };
  
  const handleLogout = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
        setStatusMessage({ type: 'error', text: `Logout failed: ${error.message}` });
    } else {
        setStatusMessage({ type: 'success', text: 'Successfully logged out.' });
    }
    setTimeout(() => setStatusMessage(null), 3000);
  }
  
  // MIGRATION AND MODE SWITCHING LOGIC
  
  const clearLocalStorage = () => {
    localStorage.removeItem('backlogTasks');
    localStorage.removeItem('todayOrder');
    localStorage.removeItem('selectedTags');
  };

  const handleMigrateToOnline = async () => {
    if (!supabase || !supabaseSession) {
      setStatusMessage({type: 'error', text: 'You must be logged in to migrate.'});
      return;
    }
    setIsLoading(true);
    
    // Sanitize local tasks before migration to ensure `order` property exists.
    const sanitizedLocalTasks = tasks.map((task, taskIndex) => ({
      ...task,
      order: task.order ?? taskIndex,
      subtasks: (task.subtasks || []).map((subtask, subtaskIndex) => ({
        ...subtask,
        order: subtask.order ?? subtaskIndex,
        isInstance: subtask.isInstance ?? false,
      })),
    }));
    
    // Clear online tables
    await supabase.from('online_subtasks').delete().eq('user_id', supabaseSession.user.id);
    await supabase.from('online_tasks').delete().eq('user_id', supabaseSession.user.id);

    const onlineTasks = sanitizedLocalTasks.map(t => ({
      id: t.id,
      user_id: supabaseSession.user.id,
      title: t.title,
      description: t.description,
      completed: t.completed,
      recurring: t.recurring,
      snooze_until: t.snoozeUntil,
      completion_date: t.completionDate,
      order: t.order,
    }));

    const { error: tasksError } = await supabase.from('online_tasks').insert(onlineTasks);
    if(tasksError) {
       setStatusMessage({type: 'error', text: `Migration error (tasks): ${tasksError.message}`});
       setIsLoading(false);
       return;
    }
    
    const allSubtasks = sanitizedLocalTasks.flatMap(t => t.subtasks.map(st => ({...st, task_id: t.id, user_id: supabaseSession.user.id})));
    const onlineSubtasks = allSubtasks.map(st => ({
        id: st.id,
        task_id: st.task_id,
        user_id: st.user_id,
        text: st.text,
        completed: st.completed,
        due_date: st.dueDate,
        completion_date: st.completionDate,
        is_instance: st.isInstance,
        order: st.order
    }));

    if (onlineSubtasks.length > 0) {
        const { error: subtasksError } = await supabase.from('online_subtasks').insert(onlineSubtasks);
        if(subtasksError) {
            setStatusMessage({type: 'error', text: `Migration error (subtasks): ${subtasksError.message}`});
            setIsLoading(false);
            return;
        }
    }
    
    setStatusMessage({type: 'success', text: 'Successfully migrated to online mode!'});
    setIsOnlineMode(true);
    
    // Clear local storage to prevent confusion and data conflicts
    clearLocalStorage();

    setIsLoading(false);
  };

  const handleMigrateToLocal = async () => {
    if (!supabase || !supabaseSession) return;
    setIsLoading(true);
    await fetchOnlineTasks(supabase);
    // fetchOnlineTasks updates the `tasks` state, the useEffect for `tasks` will save it to localStorage.
    setStatusMessage({type: 'success', text: 'Successfully migrated to local mode!'});
    setIsOnlineMode(false);
    setIsLoading(false);
  };
  
  const handleToggleOnlineMode = (enabled: boolean) => {
    if (enabled && !isOnlineMode) {
        // Switching from Local to Online
        const localTasksExist = localStorage.getItem('backlogTasks') && JSON.parse(localStorage.getItem('backlogTasks')!).length > 0;

        if (localTasksExist) {
            setConfirmationState({
                isOpen: true,
                title: 'Switch to Online Mode?',
                message: 'You have local data that has not been migrated. Switching to Online Mode will clear this local data to prevent conflicts. Your local data will be lost unless you export it first or migrate it. Are you sure you want to proceed?',
                confirmText: 'Switch & Clear Data',
                confirmClass: 'bg-yellow-600 hover:bg-yellow-700',
                onConfirm: () => {
                    clearLocalStorage();
                    setIsOnlineMode(true);
                    closeConfirmationModal();
                },
            });
        } else {
            // No local data, just switch
            setIsOnlineMode(true);
        }
    } else if (!enabled && isOnlineMode) {
        // Switching from Online to Local
        // This is safe, it will just load whatever is (or isn't) in localStorage
        setIsOnlineMode(false);
    }
  };


  return (
    <div className="min-h-screen font-sans">
      <div className="container mx-auto max-w-3xl px-2 py-4 sm:px-4 sm:py-8">
        <header className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 sm:mb-8">
          <div className="w-full">
            <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-teal-600 dark:from-cyan-400 dark:to-teal-500">
              Backlog
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm sm:text-base">Organize your work, focus on the next action.</p>
          </div>
          <div className="flex items-center space-x-1 sm:space-x-2 self-end sm:self-center mt-4 sm:mt-0 flex-shrink-0">
            {supabaseConfig?.url && !isOnlineMode && (
              <>
                {supabaseSession && (
                   <button
                        onClick={handleLogout}
                        className="p-2 rounded-full bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                        aria-label="Logout from Supabase"
                        title="Logout from Supabase"
                    >
                        <LogOutIcon />
                    </button>
                )}
                <button
                    onClick={requestSupabaseImport}
                    className="p-2 rounded-full bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                    aria-label="Import from Supabase"
                    title="Import from Supabase"
                    disabled={isSupabaseLoading}
                >
                    {isSupabaseLoading && supabaseAction === 'import' ? <SpinnerIcon/> : <CloudDownloadIcon />}
                </button>
                 <button
                    onClick={() => triggerSupabaseAction('export')}
                    className="p-2 rounded-full bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                    aria-label="Export to Supabase"
                    title="Export to Supabase"
                    disabled={isSupabaseLoading}
                >
                    {isSupabaseLoading && supabaseAction === 'export' ? <SpinnerIcon/> : <CloudUploadIcon />}
                </button>
              </>
            )}
            {!isOnlineMode && (
              <>
                <button
                    onClick={handleExportTasks}
                    className="p-2 rounded-full bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                    aria-label="Export tasks"
                    title="Export tasks"
                >
                    <DownloadIcon />
                </button>
                <button
                    onClick={handleImportClick}
                    className="p-2 rounded-full bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                    aria-label="Import tasks"
                    title="Import tasks"
                >
                    <UploadIcon />
                </button>
              </>
            )}
            <button
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="p-2 rounded-full bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? <MoonIcon /> : <SunIcon />}
            </button>
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="application/json"
                className="hidden"
            />
          </div>
        </header>

        {statusMessage && (
            <div className={`p-3 rounded-md mb-4 text-center ${statusMessage.type === 'success' ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300'}`}>
                {statusMessage.text}
            </div>
        )}

        <div className="flex justify-center mb-6 sm:mb-8 bg-gray-200 dark:bg-gray-800 rounded-lg p-1">
            <button
                onClick={() => setView('backlog')}
                className={`w-1/6 py-2 px-4 rounded-md transition-all duration-300 flex justify-center items-center ${view === 'backlog' ? 'bg-cyan-600 text-white shadow' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white'}`}
                aria-label="Backlog View"
            >
                <ListIcon />
            </button>
            <button
                onClick={() => setView('today')}
                className={`w-1/6 py-2 px-4 rounded-md transition-all duration-300 flex justify-center items-center ${view === 'today' ? 'bg-cyan-600 text-white shadow' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white'}`}
                aria-label="Today View"
            >
                <CalendarIcon />
            </button>
            <button
                onClick={() => setView('snoozed')}
                className={`w-1/6 py-2 px-4 rounded-md transition-all duration-300 flex justify-center items-center ${view === 'snoozed' ? 'bg-cyan-600 text-white shadow' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white'}`}
                aria-label="Snoozed View"
            >
                <SnoozeIcon />
            </button>
             <button
                onClick={() => setView('archive')}
                className={`w-1/6 py-2 px-4 rounded-md transition-all duration-300 flex justify-center items-center ${view === 'archive' ? 'bg-cyan-600 text-white shadow' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white'}`}
                aria-label="Archive View"
            >
                <ArchiveIcon />
            </button>
            <button
                onClick={() => setView('stats')}
                className={`w-1/6 py-2 px-4 rounded-md transition-all duration-300 flex justify-center items-center ${view === 'stats' ? 'bg-cyan-600 text-white shadow' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white'}`}
                aria-label="Stats View"
            >
                <BarChartIcon />
            </button>
            <button
                onClick={() => setView('settings')}
                className={`w-1/6 py-2 px-4 rounded-md transition-all duration-300 flex justify-center items-center ${view === 'settings' ? 'bg-cyan-600 text-white shadow' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white'}`}
                aria-label="Settings View"
            >
                <SettingsIcon />
            </button>
        </div>

        <main>
          {isLoading && (
              <div className="flex justify-center items-center p-10">
                  <SpinnerIcon className="h-10 w-10 text-cyan-500" />
              </div>
          )}
          {!isLoading && view === 'backlog' && (
            <>
            <div className="flex flex-col sm:flex-row justify-between items-start mb-6 gap-4">
                {allTags.length > 0 && (
                    <div className="p-3 sm:p-4 bg-white dark:bg-gray-800 rounded-lg flex-grow w-full">
                        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">Filter by tags:</h3>
                        <div className="flex flex-wrap gap-2">
                            {allTags.map(tag => (
                                <button
                                    key={tag}
                                    onClick={() => handleTagClick(tag)}
                                    className={`px-3 py-1 text-sm rounded-full transition-colors ${
                                        selectedTags.includes(tag)
                                            ? 'bg-cyan-500 text-white font-semibold'
                                            : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
                                    }`}
                                >
                                    {tag}
                                </button>
                            ))}
                        </div>
                        {selectedTags.length > 0 && (
                            <button onClick={() => setSelectedTags([])} className="text-xs text-cyan-600 dark:text-cyan-500 hover:underline mt-4">
                                Clear filters
                            </button>
                        )}
                    </div>
                )}
                
                {tasks.filter(t => !t.completed).length > 0 && (
                    <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                        <div className="relative">
                            <select
                                id="sort-order"
                                value={sortOption}
                                onChange={e => setSortOption(e.target.value as SortOption)}
                                className="appearance-none bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-colors"
                                aria-label="Sort tasks"
                                disabled={isOnlineMode}
                            >
                                <option value="manual">Ordina: Manuale</option>
                                <option value="days_passed">Ordina: Ultima azione</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300">
                                <ChevronDownIcon className="h-4 w-4" />
                            </div>
                        </div>

                        <button 
                            onClick={() => setIsCompactView(!isCompactView)} 
                            className="p-2.5 rounded-md bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            aria-label={isCompactView ? "Expand view" : "Compact view"}
                            title={isCompactView ? "Expand view" : "Compact view"}
                        >
                            {isCompactView ? <ArrowsPointingOutIcon /> : <ArrowsPointingInIcon />}
                        </button>
                    </div>
                )}
            </div>
            <div className="mb-6 sm:mb-8">
                {isFormVisible ? (
                <div className="bg-white dark:bg-gray-800 p-3 sm:p-4 rounded-lg shadow-lg animate-fade-in-down">
                    <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="Task Title"
                    className="w-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white placeholder-gray-500 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                    <textarea
                    value={newTaskDescription}
                    onChange={(e) => setNewTaskDescription(e.target.value)}
                    placeholder="Description... use #tag to add tags"
                    rows={3}
                    className="w-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white placeholder-gray-500 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                    {allTags.length > 0 && (
                        <div className="mb-3">
                            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Suggested tags:</h4>
                            <div className="flex flex-wrap gap-1">
                                {allTags
                                    .filter(tag => !newTaskDescription.includes(tag))
                                    .map(tag => (
                                    <button 
                                        key={tag} 
                                        onClick={() => handleAddTagToDescription(tag, setNewTaskDescription)}
                                        className="px-2 py-0.5 text-xs rounded-full bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 transition-colors"
                                    >
                                        {tag}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    <label className="flex items-center mb-3 text-sm text-gray-500 dark:text-gray-400">
                        <input
                            type="checkbox"
                            checked={isNewTaskRecurring}
                            onChange={e => setIsNewTaskRecurring(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 bg-gray-200 dark:bg-gray-700 text-teal-600 dark:text-teal-500 focus:ring-teal-500 dark:focus:ring-teal-600 cursor-pointer"
                        />
                        <span className="ml-2">Recurring Task</span>
                    </label>
                    <div className="flex justify-end space-x-2">
                    <button onClick={() => setIsFormVisible(false)} className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition-colors">
                        Cancel
                    </button>
                    <button onClick={handleAddTask} className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-md transition-colors">
                        Add Task
                    </button>
                    </div>
                </div>
                ) : (
                <button onClick={() => setIsFormVisible(true)} className="w-full flex items-center justify-center bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/80 border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-cyan-500 text-gray-500 dark:text-gray-400 hover:text-cyan-500 font-bold py-2 sm:py-3 px-4 rounded-lg transition-all duration-300">
                    <PlusIcon />
                    <span className="ml-2">Add New Task</span>
                </button>
                )}
            </div>
            </>
          )}

          <div className="task-list">
             {!isLoading && view === 'backlog' && (
                <>
                    {sortedAndFilteredTasks.map((task, index) => (
                        <TaskItem
                            key={task.id}
                            task={task}
                            onDelete={requestDeleteTask}
                            onUpdate={handleUpdateTask}
                            onOpenSubtaskModal={handleOpenSubtaskModal}
                            onDragStart={onDragStart}
                            onDragOver={onDragOver}
                            onDrop={onDrop}
                            isDragging={draggedTask?.id === task.id}
                            onSetSubtaskDueDate={handleSetSubtaskDueDate}
                            onToggleTaskComplete={handleToggleTaskComplete}
                            allTags={allTags}
                            isCompactView={isCompactView}
                            onMoveTask={handleMoveTask}
                            taskIndex={index}
                            totalTasks={sortedAndFilteredTasks.length}
                            onSnoozeTask={handleSnoozeTask}
                            isDraggable={sortOption === 'manual'}
                        />
                    ))}
                    {tasks.filter(t => !t.completed).length > 0 && sortedAndFilteredTasks.length === 0 && (
                        <div className="text-center py-10 px-4">
                            <h2 className="text-xl sm:text-2xl font-semibold text-gray-400 dark:text-gray-500">No tasks match the selected filters.</h2>
                            <p className="text-gray-500 dark:text-gray-600 mt-2">Try adjusting or clearing your filters.</p>
                        </div>
                    )}
                    {tasks.filter(t => !t.completed && (!t.snoozeUntil || new Date(t.snoozeUntil) <= new Date())).length === 0 && (
                         <div className="text-center py-10 px-4">
                            <h2 className="text-xl sm:text-2xl font-semibold text-gray-400 dark:text-gray-500">Your backlog is empty.</h2>
                            <p className="text-gray-500 dark:text-gray-600 mt-2">Add a new task, or check your snoozed tasks.</p>
                        </div>
                    )}
                </>
            )}

            {!isLoading && view === 'snoozed' && (
                <>
                    {snoozedTasks.map((task, index) => (
                         <TaskItem
                            key={task.id}
                            task={task}
                            onDelete={requestDeleteTask}
                            onUpdate={handleUpdateTask}
                            onOpenSubtaskModal={handleOpenSubtaskModal}
                            onDragStart={() => {}}
                            onDragOver={() => {}}
                            onDrop={() => {}}
                            isDragging={false}
                            onSetSubtaskDueDate={handleSetSubtaskDueDate}
                            onToggleTaskComplete={handleToggleTaskComplete}
                            allTags={allTags}
                            isCompactView={false}
                            onMoveTask={() => {}}
                            taskIndex={index}
                            totalTasks={snoozedTasks.length}
                            onSnoozeTask={handleSnoozeTask}
                            onUnsnoozeTask={handleUnsnoozeTask}
                            isDraggable={false}
                        />
                    ))}
                    {snoozedTasks.length === 0 && (
                        <div className="text-center py-10 px-4">
                            <h2 className="text-xl sm:text-2xl font-semibold text-gray-400 dark:text-gray-500">No snoozed tasks.</h2>
                            <p className="text-gray-500 dark:text-gray-600 mt-2">You can snooze a task from your backlog.</p>
                        </div>
                    )}
                </>
            )}
            
            {!isLoading && view === 'archive' && (
                <>
                    {archivedTasks.map((task, index) => (
                         <TaskItem
                            key={task.id}
                            task={task}
                            onDelete={requestDeleteTask}
                            onUpdate={handleUpdateTask}
                            onOpenSubtaskModal={handleOpenSubtaskModal}
                            onDragStart={() => {}}
                            onDragOver={() => {}}
                            onDrop={() => {}}
                            isDragging={false}
                            onSetSubtaskDueDate={handleSetSubtaskDueDate}
                            onToggleTaskComplete={handleToggleTaskComplete}
                            allTags={[]}
                            isCompactView={false}
                            onMoveTask={() => {}}
                            taskIndex={index}
                            totalTasks={archivedTasks.length}
                            onSnoozeTask={handleSnoozeTask}
                            isDraggable={false}
                        />
                    ))}
                    {archivedTasks.length === 0 && (
                        <div className="text-center py-10 px-4">
                            <h2 className="text-xl sm:text-2xl font-semibold text-gray-400 dark:text-gray-500">The archive is empty.</h2>
                            <p className="text-gray-500 dark:text-gray-600 mt-2">Complete a task in your backlog to see it here.</p>
                        </div>
                    )}
                </>
            )}

            {!isLoading && view === 'today' && (
                 <>
                    {incompleteTodaySubtasks.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 px-1 pt-2 mb-2">To Do</h3>
                            {incompleteTodaySubtasks.map((item, index) => (
                                <TodaySubtaskItem
                                    key={item.subtask.id}
                                    item={{ subtask: item.subtask, parentTaskTitle: item.parentTask.title }}
                                    onToggleComplete={() => handleToggleTodaySubtaskComplete(item.subtask.id, item.parentTask.id)}
                                    onRemove={() => handleUnsetSubtaskDueDate(item.subtask.id, item.parentTask.id)}
                                    onDragStart={() => onTodayDragStart(item)}
                                    onDragOver={onDragOver}
                                    onDrop={() => onTodayDrop(item)}
                                    isDragging={draggedTodayItem?.subtask.id === item.subtask.id}
                                    onMoveSubtask={handleMoveTodaySubtask}
                                    subtaskIndex={index}
                                    totalSubtasks={incompleteTodaySubtasks.length}
                                />
                            ))}
                        </div>
                    )}
                    
                    {completedTodaySubtasks.length > 0 && (
                       <div className="mt-8">
                            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 px-1 pt-2 mb-2">Completed</h3>
                            {completedTodaySubtasks.map((item, index) => (
                                <TodaySubtaskItem
                                    key={item.subtask.id}
                                    item={{ subtask: item.subtask, parentTaskTitle: item.parentTask.title }}
                                    onToggleComplete={() => handleToggleTodaySubtaskComplete(item.subtask.id, item.parentTask.id)}
                                    onRemove={() => handleUnsetSubtaskDueDate(item.subtask.id, item.parentTask.id)}
                                    onDragStart={(e) => e.preventDefault()}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={(e) => e.preventDefault()}
                                    isDragging={false}
                                    onMoveSubtask={() => {}}
                                    subtaskIndex={index}
                                    totalSubtasks={completedTodaySubtasks.length}
                                />
                            ))}
                        </div>
                    )}

                    {todaySubtasks.length === 0 ? (
                        <div className="text-center py-10 px-4">
                            <h2 className="text-xl sm:text-2xl font-semibold text-gray-400 dark:text-gray-500">Nothing scheduled for today.</h2>
                            <p className="text-gray-500 dark:text-gray-600 mt-2">Go to the backlog and assign a due date to your sub-tasks.</p>
                        </div>
                    ) : null}
                </>
            )}

            {!isLoading && view === 'stats' && <StatsView tasks={tasks} />}
            {!isLoading && view === 'settings' && <SettingsView currentConfig={supabaseConfig} onSave={handleSaveSupabaseConfig} isOnlineMode={isOnlineMode} onToggleOnlineMode={handleToggleOnlineMode} onMigrateToLocal={handleMigrateToLocal} onMigrateToOnline={handleMigrateToOnline} />}
          </div>
        </main>
      </div>
      {modalTask && <SubtaskModal task={modalTask} onClose={handleCloseModal} onUpdateTask={handleUpdateTask} onSetSubtaskDueDate={handleSetSubtaskDueDate} />}
      
      {isPasswordModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm p-4 m-2 sm:p-6 sm:m-4">
            <h3 className="text-lg font-bold mb-4">Enter Supabase Password</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              To {supabaseAction} your data, please enter the password for <span className="font-semibold">{supabaseConfig?.email}</span>.
            </p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handlePasswordConfirm()}
              className="w-full bg-gray-100 dark:bg-gray-700 rounded-md px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder="Your Supabase password"
              autoFocus
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setIsPasswordModalOpen(false)}
                className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePasswordConfirm}
                className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-md transition-colors"
                disabled={isSupabaseLoading}
              >
                {isSupabaseLoading ? <SpinnerIcon /> : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmationModal
        isOpen={confirmationState.isOpen}
        onClose={closeConfirmationModal}
        onConfirm={confirmationState.onConfirm}
        title={confirmationState.title}
        message={confirmationState.message}
        confirmButtonText={confirmationState.confirmText}
        confirmButtonClass={confirmationState.confirmClass}
      />
    </div>
  );
};

export default App;