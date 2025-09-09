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
import MarkdownInput from './components/MarkdownInput';

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
    confirmClass: 'bg-indigo-600 hover:bg-indigo-700',
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
        recurrence: st.recurrence,
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

  const getTodayDateString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

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

  const todayString = useMemo(() => getTodayDateString(), []);

  const sortedAndFilteredTasks = useMemo(() => {
    let activeTasks = tasks.filter(task => 
      !task.completed &&
      (!task.snoozeUntil || task.snoozeUntil <= todayString)
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
  }, [tasks, selectedTags, sortOption, todayString]);

  const snoozedTasks = useMemo(() => {
    return tasks
      .filter(task => task.snoozeUntil && task.snoozeUntil > todayString && !task.completed)
      .sort((a, b) => a.snoozeUntil!.localeCompare(b.snoozeUntil!));
  }, [tasks, todayString]);

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
    const result: TodayItem[] = [];
    tasks.forEach(task => {
        task.subtasks.forEach(subtask => {
            const wasCompletedToday = subtask.completed && subtask.completionDate?.startsWith(todayString);
            
            let isDueToday = false;
            let isOverdueAndIncomplete = false;

            if (subtask.dueDate) {
                isDueToday = subtask.dueDate === todayString;
                isOverdueAndIncomplete = subtask.dueDate < todayString && !subtask.completed;
            }

            if (isDueToday || isOverdueAndIncomplete || wasCompletedToday) {
                result.push({ subtask, parentTask: task });
            }
        });
    });
    return result;
  }, [tasks, todayString]);

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
        completed: false,
        order: maxOrder + 1,
      };
      setTasks(prevTasks => [newTask, ...prevTasks.filter(t => !t.completed), ...prevTasks.filter(t => t.completed)]);
    }
    setNewTaskTitle('');
    setNewTaskDescription('');
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
    if (isOnlineMode && supabase && supabaseSession) {
        const { error } = await supabase.from('online_tasks').update({
            title: updatedTask.title,
            description: updatedTask.description,
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
            user_id: supabaseSession.user.id,
            text: st.text,
            completed: st.completed,
            due_date: st.dueDate,
            completion_date: st.completionDate,
            recurrence: st.recurrence,
            order: st.order,
        }));

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
    
    const yyyy = newDate.getFullYear();
    const mm = String(newDate.getMonth() + 1).padStart(2, '0');
    const dd = String(newDate.getDate()).padStart(2, '0');
    const snoozeUntilDate = `${yyyy}-${mm}-${dd}`;

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
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    if (isOnlineMode && supabase) {
        await supabase.from('online_subtasks').update({ due_date: date }).match({ id: subtaskId });
    }

    const updatedTask = {
        ...task,
        subtasks: task.subtasks.map(st =>
            st.id === subtaskId ? { ...st, dueDate: date } : st
        )
    };

    setTasks(prevTasks => prevTasks.map(t => t.id === taskId ? updatedTask : t));
    if (modalTask?.id === taskId) {
        setModalTask(updatedTask);
    }
  }, [tasks, isOnlineMode, supabase, modalTask]);


  const handleToggleTodaySubtaskComplete = useCallback(async (subtaskId: string, taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    const subtask = task?.subtasks.find(st => st.id === subtaskId);
    if (!task || !subtask) return;

    const isCompleting = !subtask.completed;
    const completionDate = isCompleting ? new Date().toISOString() : undefined;
    let newSubtask: Subtask | null = null;

    if (isCompleting && subtask.recurrence) {
        const { unit, value } = subtask.recurrence;
        const baseDate = new Date();
        let nextDueDate = new Date(baseDate);

        if (unit === 'day') nextDueDate.setDate(nextDueDate.getDate() + value);
        else if (unit === 'week') nextDueDate.setDate(nextDueDate.getDate() + (value * 7));
        else if (unit === 'month') nextDueDate.setMonth(nextDueDate.getMonth() + value);
        else if (unit === 'year') nextDueDate.setFullYear(nextDueDate.getFullYear() + value);
        
        const maxOrder = task.subtasks.reduce((max, st) => Math.max(st.order, max), -1);
        
        newSubtask = {
            ...subtask,
            id: crypto.randomUUID(),
            completed: false,
            dueDate: nextDueDate.toISOString().split('T')[0],
            completionDate: undefined,
            order: maxOrder + 1,
        };
    }

    if (isOnlineMode && supabase && supabaseSession) {
      await supabase.from('online_subtasks').update({
        completed: isCompleting,
        completion_date: completionDate,
      }).match({id: subtaskId});
      
      if (newSubtask) {
          await supabase.from('online_subtasks').insert({
              id: newSubtask.id,
              task_id: taskId,
              user_id: supabaseSession.user.id,
              text: newSubtask.text,
              completed: false,
              due_date: newSubtask.dueDate,
              recurrence: newSubtask.recurrence,
              order: newSubtask.order,
          });
      }
    }

    setTasks(prevTasks => 
        prevTasks.map(t => {
            if (t.id !== taskId) return t;
            
            let updatedSubtasks = t.subtasks.map(st => 
                st.id === subtaskId ? { ...st, completed: isCompleting, completionDate } : st
            );
            
            if (newSubtask) {
                updatedSubtasks.push(newSubtask);
            }
            
            const incomplete = updatedSubtasks.filter(st => !st.completed).sort((a,b) => a.order - b.order);
            const completed = updatedSubtasks.filter(st => st.completed).sort((a,b) => {
              if(!a.completionDate) return 1;
              if(!b.completionDate) return -1;
              return new Date(b.completionDate).getTime() - new Date(a.completionDate).getTime();
            });

            const finalSubtasks = [...incomplete, ...completed].map((st, index) => ({...st, order: index}));

            return {
                ...t,
                subtasks: finalSubtasks,
            };
        })
    );
}, [tasks, isOnlineMode, supabase, supabaseSession]);

  const handleUnsetSubtaskDueDate = useCallback(async (subtaskId: string, taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    if(isOnlineMode && supabase) {
        await supabase.from('online_subtasks').update({ due_date: null }).match({id: subtaskId});
    }

    const updatedSubtasks = task.subtasks.map(st =>
        st.id === subtaskId ? { ...st, dueDate: undefined } : st
    );
    const updatedTask = { ...task, subtasks: updatedSubtasks };
    
    setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));

  }, [tasks, isOnlineMode, supabase]);

  const handleUpdateParentTaskDescription = useCallback(async (taskId: string, newDescription: string) => {
    const taskToUpdate = tasks.find(t => t.id === taskId);
    if (!taskToUpdate) return;
    
    const updatedTask = { ...taskToUpdate, description: newDescription };
    await handleUpdateTask(updatedTask);
  }, [tasks, handleUpdateTask]);
  
  const handleUpdateSubtaskText = useCallback(async (taskId: string, subtaskId: string, newText: string) => {
    const taskToUpdate = tasks.find(t => t.id === taskId);
    if (!taskToUpdate) return;

    if (isOnlineMode && supabase) {
      const { error } = await supabase.from('online_subtasks')
        .update({ text: newText })
        .match({ id: subtaskId });
      if (error) {
        setStatusMessage({ type: 'error', text: `Failed to update subtask: ${error.message}` });
        return;
      }
    }

    const updatedSubtasks = taskToUpdate.subtasks.map(st =>
      st.id === subtaskId ? { ...st, text: newText } : st
    );

    setTasks(prevTasks => prevTasks.map(task =>
      task.id === taskId ? { ...task, subtasks: updatedSubtasks } : task
    ));
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
            setStatusMessage({ type: 'error', text: `Import failed: ${error ? error.message : "No data found."}` });
        } else {
            const importedTasks = (data.data as any) || [];
            if (Array.isArray(importedTasks)) {
                setTasks(importedTasks);
                setStatusMessage({ type: 'success', text: "Successfully imported latest revision from Supabase!" });
            } else {
                setStatusMessage({ type: 'error', text: "Import failed: Invalid data format in Supabase." });
            }
        }
      }
      setIsSupabaseLoading(false);
      setSupabaseAction(null);
      setIsPasswordModalOpen(false);
      setPassword('');
      setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleMigrateToOnline = async () => {
    if (!supabase || !supabaseSession) {
      setStatusMessage({type: 'error', text: 'Supabase is not configured or you are not logged in.'});
      return;
    }
    
    setConfirmationState({
      isOpen: true,
      title: 'Migrate to Online Mode',
      message: 'This will overwrite your existing online data with your current local data. This action cannot be undone. Are you sure you want to proceed?',
      confirmText: 'Migrate & Overwrite',
      confirmClass: 'bg-red-600 hover:bg-red-700',
      onConfirm: async () => {
        closeConfirmationModal();
        setIsLoading(true);

        try {
          await supabase.from('online_subtasks').delete().eq('user_id', supabaseSession.user.id);
          await supabase.from('online_tasks').delete().eq('user_id', supabaseSession.user.id);

          const onlineTasks = tasks.map(t => ({
            id: t.id,
            user_id: supabaseSession.user.id,
            title: t.title,
            description: t.description,
            completed: t.completed,
            completion_date: t.completionDate,
            snooze_until: t.snoozeUntil,
            order: t.order,
          }));

          const onlineSubtasks = tasks.flatMap(t => t.subtasks.map(st => ({
            id: st.id,
            task_id: t.id,
            user_id: supabaseSession.user.id,
            text: st.text,
            completed: st.completed,
            due_date: st.dueDate,
            completion_date: st.completionDate,
            recurrence: st.recurrence,
            order: st.order,
          })));

          const { error: tasksError } = await supabase.from('online_tasks').upsert(onlineTasks);
          if (tasksError) throw tasksError;

          const { error: subtasksError } = await supabase.from('online_subtasks').upsert(onlineSubtasks);
          if (subtasksError) throw subtasksError;

          setStatusMessage({type: 'success', text: 'Successfully migrated local data to online mode!'});
          setIsOnlineMode(true);

        } catch (error: any) {
          setStatusMessage({type: 'error', text: `Migration failed: ${error.message}`});
        } finally {
          setIsLoading(false);
          setTimeout(() => setStatusMessage(null), 5000);
        }
      },
    });
  };

  const handleMigrateToLocal = async () => {
    if (!supabase || !supabaseSession) {
      setStatusMessage({type: 'error', text: 'Supabase is not configured or you are not logged in.'});
      return;
    }

    setConfirmationState({
      isOpen: true,
      title: 'Migrate to Local Mode',
      message: 'This will overwrite your current local data with your latest online data. This action cannot be undone. Are you sure?',
      confirmText: 'Migrate & Overwrite',
      confirmClass: 'bg-red-600 hover:bg-red-700',
      onConfirm: async () => {
        closeConfirmationModal();
        await fetchOnlineTasks(supabase);
        setIsOnlineMode(false);
        setStatusMessage({ type: 'success', text: 'Successfully migrated online data to local mode!' });
        setTimeout(() => setStatusMessage(null), 3000);
      },
    });
  };

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'dark' : ''} bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-white`}>
      {modalTask && (
        <SubtaskModal
          task={modalTask}
          onClose={handleCloseModal}
          onUpdateTask={handleUpdateTask}
          onSetSubtaskDueDate={handleSetSubtaskDueDate}
        />
      )}
      <ConfirmationModal {...confirmationState} onClose={closeConfirmationModal} />

      <div className="container mx-auto p-2 sm:p-4 max-w-5xl">
        <header className="mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
            <h1 className="text-3xl sm:text-4xl font-bold text-indigo-600 dark:text-indigo-400">Next Task</h1>
            <div className="flex items-center space-x-2 mt-3 sm:mt-0">
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${isOnlineMode ? 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}>
                {isOnlineMode ? 'Online' : 'Local'}
              </span>
              <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                {theme === 'light' ? <MoonIcon /> : <SunIcon />}
              </button>
            </div>
          </div>
          <nav className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => setView('backlog')} title="Tasks" className={`flex items-center justify-center sm:justify-start p-2 sm:px-3 sm:py-1.5 text-sm font-semibold rounded-md ${view === 'backlog' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
              <ListIcon className="h-5 w-5 sm:mr-1"/>
              <span className="hidden sm:inline">Tasks</span>
            </button>
            <button onClick={() => setView('today')} title="Today" className={`flex items-center justify-center sm:justify-start p-2 sm:px-3 sm:py-1.5 text-sm font-semibold rounded-md ${view === 'today' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
              <CalendarIcon className="h-5 w-5 sm:mr-1"/>
              <span className="hidden sm:inline">Today</span>
            </button>
            <button onClick={() => setView('snoozed')} title="Snoozed" className={`flex items-center justify-center sm:justify-start p-2 sm:px-3 sm:py-1.5 text-sm font-semibold rounded-md ${view === 'snoozed' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
              <SnoozeIcon className="h-5 w-5 sm:mr-1"/>
              <span className="hidden sm:inline">Snoozed</span>
            </button>
            <button onClick={() => setView('archive')} title="Archive" className={`flex items-center justify-center sm:justify-start p-2 sm:px-3 sm:py-1.5 text-sm font-semibold rounded-md ${view === 'archive' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
              <ArchiveIcon className="h-5 w-5 sm:mr-1"/>
              <span className="hidden sm:inline">Archive</span>
            </button>
            <button onClick={() => setView('stats')} title="Stats" className={`flex items-center justify-center sm:justify-start p-2 sm:px-3 sm:py-1.5 text-sm font-semibold rounded-md ${view === 'stats' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
              <BarChartIcon className="h-5 w-5 sm:mr-1"/>
              <span className="hidden sm:inline">Stats</span>
            </button>
            <button onClick={() => setView('settings')} title="Settings" className={`flex items-center justify-center sm:justify-start p-2 sm:px-3 sm:py-1.5 text-sm font-semibold rounded-md ${view === 'settings' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
              <SettingsIcon className="h-5 w-5 sm:mr-1"/>
              <span className="hidden sm:inline">Settings</span>
            </button>
          </nav>
        </header>

        {statusMessage && (
          <div className={`mb-4 p-3 rounded-md text-sm font-medium ${statusMessage.type === 'success' ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200'}`}>
            {statusMessage.text}
          </div>
        )}

        {isSupabaseLoading && <div className="flex items-center justify-center my-4"><SpinnerIcon /> <span className="ml-2">Contacting Supabase...</span></div>}
        {isLoading && <div className="flex items-center justify-center my-4"><SpinnerIcon /> <span className="ml-2">Loading data...</span></div>}


        {view === 'backlog' && (
          <>
            <div className="mb-6">
              {!isFormVisible ? (
                <button onClick={() => setIsFormVisible(true)} className="w-full bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-indigo-600 dark:text-indigo-400 font-bold py-3 px-4 rounded-lg shadow-md transition-colors flex items-center justify-center">
                  <PlusIcon className="mr-2"/> Add New Task
                </button>
              ) : (
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md space-y-4">
                  <input
                    autoFocus
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddTask()}
                    placeholder="New task title..."
                    className="w-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white placeholder-gray-500 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <MarkdownInput
                    value={newTaskDescription}
                    onChange={setNewTaskDescription}
                    placeholder="Add description... use #tag for tags"
                  />
                   {allTags.length > 0 && (
                      <div className="pt-1">
                          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Available tags:</h4>
                          <div className="flex flex-wrap gap-1">
                          {allTags.map(tag => (
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
                  <div className="flex justify-end space-x-2">
                    <button onClick={() => setIsFormVisible(false)} className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition-colors">
                      Cancel
                    </button>
                    <button onClick={handleAddTask} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md transition-colors">
                      Add Task
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center space-x-2">
                  <label htmlFor="sort-select" className="text-sm font-medium text-gray-600 dark:text-gray-300">Sort by:</label>
                  <select
                      id="sort-select"
                      value={sortOption}
                      onChange={(e) => setSortOption(e.target.value as SortOption)}
                      className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                      <option value="manual">Manual</option>
                      <option value="days_passed">Days Since Last Action</option>
                  </select>
                  <button onClick={() => setIsCompactView(!isCompactView)} className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700" title={isCompactView ? "Expand view" : "Compact view"}>
                      {isCompactView ? <ArrowsPointingOutIcon /> : <ArrowsPointingInIcon />}
                  </button>
              </div>
              {allTags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                      {allTags.map(tag => (
                          <button
                              key={tag}
                              onClick={() => handleTagClick(tag)}
                              className={`px-2 py-0.5 text-xs rounded-full transition-colors ${selectedTags.includes(tag) ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
                          >
                              {tag}
                          </button>
                      ))}
                      {selectedTags.length > 0 && (
                          <button onClick={() => setSelectedTags([])} className="px-2 py-0.5 text-xs rounded-full bg-red-500 text-white hover:bg-red-600">
                              Clear
                          </button>
                      )}
                  </div>
              )}
            </div>

            <div>
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
                  onUpdateSubtaskText={handleUpdateSubtaskText}
                />
              ))}
              {sortedAndFilteredTasks.length === 0 && (
                <div className="text-center py-10">
                  <p className="text-gray-500">No active tasks found. Time to add some!</p>
                </div>
              )}
            </div>
          </>
        )}

        {view === 'today' && (
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-700 dark:text-gray-300 mb-4">Today's Focus</h2>
            {incompleteTodaySubtasks.length > 0 && (
                 <div>
                    <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">To Do</h3>
                    {incompleteTodaySubtasks.map((item, index) => (
                        <TodaySubtaskItem 
                            key={item.subtask.id}
                            item={{...item, parentTaskTitle: item.parentTask.title, parentTaskDescription: item.parentTask.description, parentTaskId: item.parentTask.id}}
                            onToggleComplete={() => handleToggleTodaySubtaskComplete(item.subtask.id, item.parentTask.id)}
                            onRemove={() => handleUnsetSubtaskDueDate(item.subtask.id, item.parentTask.id)}
                            onDragStart={() => onTodayDragStart(item)}
                            onDragOver={onDragOver}
                            onDrop={() => onTodayDrop(item)}
                            isDragging={draggedTodayItem?.subtask.id === item.subtask.id}
                            onMoveSubtask={handleMoveTodaySubtask}
                            subtaskIndex={index}
                            totalSubtasks={incompleteTodaySubtasks.length}
                            onUpdateParentTaskDescription={handleUpdateParentTaskDescription}
                            onUpdateSubtaskText={handleUpdateSubtaskText}
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
                            onToggleComplete={() => handleToggleTodaySubtaskComplete(item.subtask.id, item.parentTask.id)}
                            onRemove={() => handleUnsetSubtaskDueDate(item.subtask.id, item.parentTask.id)}
                            onDragStart={(e) => e.preventDefault()}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => e.preventDefault()}
                            isDragging={false}
                            onMoveSubtask={() => {}}
                            subtaskIndex={-1}
                            totalSubtasks={-1}
                            onUpdateParentTaskDescription={handleUpdateParentTaskDescription}
                            onUpdateSubtaskText={handleUpdateSubtaskText}
                        />
                    ))}
                </div>
            )}

            {todaySubtasks.length === 0 && <p className="text-center py-10 text-gray-500">Nothing scheduled for today. Enjoy your day!</p>}
          </div>
        )}

        {view === 'snoozed' && (
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-700 dark:text-gray-300 mb-4">Snoozed Tasks</h2>
            {snoozedTasks.map((task) => (
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
                taskIndex={-1}
                totalTasks={-1}
                onSnoozeTask={handleSnoozeTask}
                onUnsnoozeTask={handleUnsnoozeTask}
                isDraggable={false}
                onUpdateSubtaskText={handleUpdateSubtaskText}
              />
            ))}
            {snoozedTasks.length === 0 && <p className="text-center py-10 text-gray-500">No snoozed tasks.</p>}
          </div>
        )}
        
        {view === 'archive' && (
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-700 dark:text-gray-300 mb-4">Archived Tasks</h2>
            {archivedTasks.map((task) => (
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
                taskIndex={-1}
                totalTasks={-1}
                onSnoozeTask={handleSnoozeTask}
                isDraggable={false}
                onUpdateSubtaskText={handleUpdateSubtaskText}
              />
            ))}
            {archivedTasks.length === 0 && <p className="text-center py-10 text-gray-500">No completed tasks yet.</p>}
          </div>
        )}

        {view === 'stats' && <StatsView tasks={tasks} />}

        {view === 'settings' && <SettingsView currentConfig={supabaseConfig} onSave={handleSaveSupabaseConfig} isOnlineMode={isOnlineMode} onToggleOnlineMode={setIsOnlineMode} onMigrateToLocal={handleMigrateToLocal} onMigrateToOnline={handleMigrateToOnline} />}

        {!isOnlineMode && (
          <div className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Local Data Management</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Export your current local tasks as a JSON file, or import from a previously exported file.</p>
              <div className="flex flex-col sm:flex-row gap-2">
                  <button onClick={handleImportClick} className="flex-1 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-indigo-600 dark:text-indigo-400 font-bold py-2 px-4 rounded-lg shadow-md transition-colors flex items-center justify-center">
                      <UploadIcon className="mr-2" /> Import from JSON
                  </button>
                  <button onClick={handleExportTasks} className="flex-1 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-indigo-600 dark:text-indigo-400 font-bold py-2 px-4 rounded-lg shadow-md transition-colors flex items-center justify-center">
                      <DownloadIcon className="mr-2" /> Export to JSON
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="application/json"
                    className="hidden"
                  />
              </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;