import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Task, Subtask } from './types';
import TaskItem from './components/TaskItem';
import SubtaskModal from './components/SubtaskModal';
import TodaySubtaskItem from './components/TodaySubtaskItem';
import StatsView from './components/StatsView';
import SettingsView from './components/SettingsView';
import { createSupabaseClient } from './supabaseClient';
import { PlusIcon, SunIcon, MoonIcon, ListIcon, CalendarIcon, BarChartIcon, ArrowsPointingInIcon, ArrowsPointingOutIcon, DownloadIcon, UploadIcon, SettingsIcon, CloudUploadIcon, CloudDownloadIcon, SpinnerIcon, LogOutIcon, ArchiveIcon } from './components/icons';
import { Session } from '@supabase/supabase-js';

type TodayItem = { subtask: Subtask, parentTask: Task };
type Theme = 'light' | 'dark';
type View = 'backlog' | 'today' | 'archive' | 'stats' | 'settings';
type SupabaseAction = 'import' | 'export';

interface SupabaseConfig {
  url: string;
  anonKey: string;
  email: string;
}

interface StatusMessage {
  type: 'success' | 'error';
  text: string;
}


const App: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>(() => {
      const savedTasks = localStorage.getItem('backlogTasks');
      if (savedTasks) {
          try {
              const parsedTasks = JSON.parse(savedTasks);
              return parsedTasks.map((task: any) => ({
                  ...task,
                  completed: task.completed ?? false,
              }));
          } catch (e) {
              console.error("Failed to parse tasks from localStorage", e);
              return [];
          }
      }
      return [];
  });
  
  const [todayOrder, setTodayOrder] = useState<string[]>(() => {
      const savedOrder = localStorage.getItem('todayOrder');
      return savedOrder ? JSON.parse(savedOrder) : [];
  });

  const [view, setView] = useState<View>(() => {
    const savedTasks = localStorage.getItem('backlogTasks');
    if (savedTasks) {
        try {
            const initialTasks: Task[] = JSON.parse(savedTasks);
            const todayString = new Date().toISOString().split('T')[0];
            const hasTodayTasks = initialTasks.some(task =>
                task.subtasks?.some(subtask => subtask.dueDate === todayString)
            );
            if (hasTodayTasks) {
                return 'today';
            }
        } catch (e) {
            console.error("Error parsing tasks for initial view check", e);
            return 'backlog';
        }
    }
    return 'backlog';
  });

  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem('theme') as Theme;
    if (savedTheme) return savedTheme;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Supabase state
  const [supabaseSession, setSupabaseSession] = useState<Session | null>(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [supabaseAction, setSupabaseAction] = useState<SupabaseAction | null>(null);
  const [isSupabaseLoading, setIsSupabaseLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);


  useEffect(() => {
    localStorage.setItem('backlogTasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('todayOrder', JSON.stringify(todayOrder));
  }, [todayOrder]);
  
  useEffect(() => {
    localStorage.setItem('backlogView', view);
  }, [view]);

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
    if (supabaseConfig) {
      const supabase = createSupabaseClient(supabaseConfig.url, supabaseConfig.anonKey);
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSupabaseSession(session);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setSupabaseSession(session);
      });

      return () => subscription.unsubscribe();
    }
  }, [supabaseConfig]);

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

  const filteredTasks = useMemo(() => {
    const activeTasks = tasks.filter(task => !task.completed);
    if (selectedTags.length === 0) {
        return activeTasks;
    }
    return activeTasks.filter(task => {
        const taskTags = extractTags(task.description);
        return selectedTags.every(selectedTag => taskTags.includes(selectedTag));
    });
  }, [tasks, selectedTags]);

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
      const todayString = getTodayDateString();
      const result: TodayItem[] = [];
      tasks.forEach(task => {
          task.subtasks.forEach(subtask => {
              if (subtask.dueDate === todayString) {
                  result.push({ subtask, parentTask: task });
              }
          });
      });
      return result;
  }, [tasks]);

  useEffect(() => {
    setTodayOrder(currentOrder => {
      const todaySubtaskIds = new Set(todaySubtasks.map(item => item.subtask.id));
      const filteredOrder = currentOrder.filter(id => todaySubtaskIds.has(id));
      todaySubtasks.forEach(item => {
        if (!filteredOrder.includes(item.subtask.id)) {
          filteredOrder.push(item.subtask.id);
        }
      });
      return filteredOrder;
    });
  }, [todaySubtasks]);

  const sortedTodaySubtasks = useMemo(() => {
    const subtaskMap = new Map(todaySubtasks.map(item => [item.subtask.id, item]));
    return todayOrder.map(id => subtaskMap.get(id)).filter(Boolean) as TodayItem[];
  }, [todayOrder, todaySubtasks]);


  const handleTagClick = (tag: string) => {
    setSelectedTags(prev =>
        prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleAddTask = () => {
    if (newTaskTitle.trim()) {
      const newTask: Task = {
        id: crypto.randomUUID(),
        title: newTaskTitle.trim(),
        description: newTaskDescription.trim(),
        subtasks: [],
        recurring: isNewTaskRecurring,
        completed: false,
      };
      setTasks(prevTasks => [newTask, ...prevTasks.filter(t => !t.completed), ...prevTasks.filter(t => t.completed)]);
      setNewTaskTitle('');
      setNewTaskDescription('');
      setIsNewTaskRecurring(false);
      setIsFormVisible(false);
    }
  };

  const handleDeleteTask = useCallback((taskId: string) => {
    setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
  }, []);

  const handleUpdateTask = useCallback((updatedTask: Task) => {
    setTasks(prevTasks => prevTasks.map(task => task.id === updatedTask.id ? updatedTask : task));
    if (modalTask && modalTask.id === updatedTask.id) {
        setModalTask(updatedTask);
    }
  }, [modalTask]);
  
  const handleToggleTaskComplete = useCallback((taskId: string) => {
    setTasks(prevTasks =>
      prevTasks.map(task => {
        if (task.id !== taskId) return task;
        const isCompleted = !task.completed;
        return {
          ...task,
          completed: isCompleted,
          completionDate: isCompleted ? new Date().toISOString() : undefined,
        };
      })
    );
  }, []);

  const handleSetSubtaskDueDate = useCallback((subtaskId: string, taskId: string, date: string) => {
    setTasks(prevTasks => {
        return prevTasks.map(task => {
            if (task.id !== taskId) return task;

            const subtaskIndex = task.subtasks.findIndex(st => st.id === subtaskId);
            if (subtaskIndex === -1) return task;

            if (task.recurring) {
                const originalSubtask = task.subtasks[subtaskIndex];
                const newInstance: Subtask = {
                    ...originalSubtask,
                    id: crypto.randomUUID(),
                    completed: false,
                    dueDate: date,
                    isInstance: true,
                    completionDate: undefined,
                };
                return { ...task, subtasks: [...task.subtasks, newInstance] };
            } else {
                const updatedSubtasks = [...task.subtasks];
                updatedSubtasks[subtaskIndex] = { ...updatedSubtasks[subtaskIndex], dueDate: date };
                return { ...task, subtasks: updatedSubtasks };
            }
        });
    });
  }, []);


  const handleToggleTodaySubtaskComplete = useCallback((subtaskId: string, taskId: string) => {
    setTasks(prevTasks => 
        prevTasks.map(task => {
            if (task.id !== taskId) return task;
            return {
                ...task,
                subtasks: task.subtasks.map(st => {
                    if (st.id !== subtaskId) return st;
                    const isCompleted = !st.completed;
                    return {
                        ...st,
                        completed: isCompleted,
                        completionDate: isCompleted ? new Date().toISOString() : undefined,
                    };
                }),
            };
        })
    );
}, []);

  const handleUnsetSubtaskDueDate = useCallback((subtaskId: string, taskId: string) => {
    setTasks(prevTasks => {
        return prevTasks.map(task => {
            if (task.id !== taskId) return task;
            
            const subtask = task.subtasks.find(st => st.id === subtaskId);
            if (!subtask) return task;

            if (subtask.isInstance) {
                return { ...task, subtasks: task.subtasks.filter(st => st.id !== subtaskId) };
            } else {
                const updatedSubtasks = task.subtasks.map(st =>
                    st.id === subtaskId ? { ...st, dueDate: undefined } : st
                );
                return { ...task, subtasks: updatedSubtasks };
            }
        });
    });
  }, []);
  
  const handleMoveTask = useCallback((taskId: string, direction: 'up' | 'down' | 'top' | 'bottom') => {
    setTasks(currentTasks => {
        const activeTasks = currentTasks.filter(t => !t.completed);
        const completedTasks = currentTasks.filter(t => t.completed);

        const taskToMove = activeTasks.find(t => t.id === taskId);
        if (!taskToMove) return currentTasks;

        let reorderedActiveTasks = [...activeTasks];

        if (direction === 'top') {
            reorderedActiveTasks = [taskToMove, ...activeTasks.filter(t => t.id !== taskId)];
        } else if (direction === 'bottom') {
            reorderedActiveTasks = [...activeTasks.filter(t => t.id !== taskId), taskToMove];
        } else {
            const taskIndexInFiltered = filteredTasks.findIndex(t => t.id === taskId);
            if (taskIndexInFiltered === -1) return currentTasks;

            let targetTask: Task | undefined;
            if (direction === 'up' && taskIndexInFiltered > 0) {
                targetTask = filteredTasks[taskIndexInFiltered - 1];
            } else if (direction === 'down' && taskIndexInFiltered < filteredTasks.length - 1) {
                targetTask = filteredTasks[taskIndexInFiltered + 1];
            }

            if (!targetTask) return currentTasks;

            const fromIndex = activeTasks.findIndex(t => t.id === taskId);
            const toIndex = activeTasks.findIndex(t => t.id === targetTask!.id);

            if (fromIndex === -1 || toIndex === -1) return currentTasks;
            
            [reorderedActiveTasks[fromIndex], reorderedActiveTasks[toIndex]] = [reorderedActiveTasks[toIndex], reorderedActiveTasks[fromIndex]];
        }
        
        return [...reorderedActiveTasks, ...completedTasks];
    });
}, [filteredTasks]);


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
    if (!draggedTask || view !== 'backlog' || draggedTask.completed || targetTask.completed) return;

    setTasks(currentTasks => {
        const activeTasks = currentTasks.filter(t => !t.completed);
        const completedTasks = currentTasks.filter(t => t.completed);

        const fromIndex = activeTasks.findIndex(task => task.id === draggedTask.id);
        const toIndex = activeTasks.findIndex(task => task.id === targetTask.id);

        if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return currentTasks;

        const items = [...activeTasks];
        const [reorderedItem] = items.splice(fromIndex, 1);
        items.splice(toIndex, 0, reorderedItem);

        return [...items, ...completedTasks];
    });
    setDraggedTask(null);
  }, [draggedTask, view]);
  
  const onTodayDragStart = useCallback((item: TodayItem) => setDraggedTodayItem(item), []);
  
  const onTodayDrop = useCallback((targetItem: TodayItem) => {
    if (!draggedTodayItem) return;

    const fromId = draggedTodayItem.subtask.id;
    const toId = targetItem.subtask.id;

    if (fromId === toId) return;

    const fromIndex = todayOrder.findIndex(id => id === fromId);
    const toIndex = todayOrder.findIndex(id => id === toId);
    
    if (fromIndex === -1 || toIndex === -1) return;

    const newOrder = [...todayOrder];
    const [movedItem] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, movedItem);

    setTodayOrder(newOrder);
    setDraggedTodayItem(null);
  }, [draggedTodayItem, todayOrder]);

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
                 console.error('Invalid file format. Please import a valid JSON export file.');
                 return;
            }

            setTasks(importedTasks);
            setTodayOrder([]);
            console.log(`${importedTasks.length} tasks imported successfully!`);

        } catch (error) {
            console.error("Error importing tasks:", error);
        } finally {
            if (event.target) {
                event.target.value = '';
            }
        }
    };
    reader.onerror = () => console.error('An error occurred while reading the file.');
    reader.readAsText(file);
  };
  
  const executeSupabaseAction = async (action: SupabaseAction, session: Session) => {
      if (!supabaseConfig) return;

      setIsSupabaseLoading(true);
      setStatusMessage(null);
      const supabase = createSupabaseClient(supabaseConfig.url, supabaseConfig.anonKey);
      
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
    if (!supabaseConfig || !supabaseAction) return;

    setIsSupabaseLoading(true);
    setStatusMessage(null);

    const supabase = createSupabaseClient(supabaseConfig.url, supabaseConfig.anonKey);
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
      if (!supabaseConfig) return;

      setSupabaseAction(action);
      
      if (supabaseSession) {
          await executeSupabaseAction(action, supabaseSession);
      } else {
          setIsPasswordModalOpen(true);
      }
  };
  
  const handleLogout = async () => {
    if (!supabaseConfig) return;
    const supabase = createSupabaseClient(supabaseConfig.url, supabaseConfig.anonKey);
    const { error } = await supabase.auth.signOut();
    if (error) {
        setStatusMessage({ type: 'error', text: `Logout failed: ${error.message}` });
    } else {
        setStatusMessage({ type: 'success', text: 'Successfully logged out.' });
    }
    setTimeout(() => setStatusMessage(null), 3000);
  }

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
            {supabaseConfig?.url && (
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
                    onClick={() => triggerSupabaseAction('import')}
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
                className={`w-1/5 py-2 px-4 rounded-md transition-all duration-300 flex justify-center items-center ${view === 'backlog' ? 'bg-cyan-600 text-white shadow' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white'}`}
                aria-label="Backlog View"
            >
                <ListIcon />
            </button>
            <button
                onClick={() => setView('today')}
                className={`w-1/5 py-2 px-4 rounded-md transition-all duration-300 flex justify-center items-center ${view === 'today' ? 'bg-cyan-600 text-white shadow' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white'}`}
                aria-label="Today View"
            >
                <CalendarIcon />
            </button>
             <button
                onClick={() => setView('archive')}
                className={`w-1/5 py-2 px-4 rounded-md transition-all duration-300 flex justify-center items-center ${view === 'archive' ? 'bg-cyan-600 text-white shadow' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white'}`}
                aria-label="Archive View"
            >
                <ArchiveIcon />
            </button>
            <button
                onClick={() => setView('stats')}
                className={`w-1/5 py-2 px-4 rounded-md transition-all duration-300 flex justify-center items-center ${view === 'stats' ? 'bg-cyan-600 text-white shadow' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white'}`}
                aria-label="Stats View"
            >
                <BarChartIcon />
            </button>
            <button
                onClick={() => setView('settings')}
                className={`w-1/5 py-2 px-4 rounded-md transition-all duration-300 flex justify-center items-center ${view === 'settings' ? 'bg-cyan-600 text-white shadow' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white'}`}
                aria-label="Settings View"
            >
                <SettingsIcon />
            </button>
        </div>

        <main>
          {view === 'backlog' && (
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
                    <button 
                        onClick={() => setIsCompactView(!isCompactView)} 
                        className="p-2 rounded-md bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors self-end sm:self-center"
                        aria-label={isCompactView ? "Expand view" : "Compact view"}
                        title={isCompactView ? "Expand view" : "Compact view"}
                    >
                        {isCompactView ? <ArrowsPointingOutIcon /> : <ArrowsPointingInIcon />}
                    </button>
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
             {view === 'backlog' && (
                <>
                    {filteredTasks.map((task, index) => (
                        <TaskItem
                            key={task.id}
                            task={task}
                            onDelete={handleDeleteTask}
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
                            totalTasks={filteredTasks.length}
                        />
                    ))}
                    {tasks.filter(t => !t.completed).length > 0 && filteredTasks.length === 0 && (
                        <div className="text-center py-10 px-4">
                            <h2 className="text-xl sm:text-2xl font-semibold text-gray-400 dark:text-gray-500">No tasks match the selected filters.</h2>
                            <p className="text-gray-500 dark:text-gray-600 mt-2">Try adjusting or clearing your filters.</p>
                        </div>
                    )}
                    {tasks.filter(t => !t.completed).length === 0 && (
                        <div className="text-center py-10 px-4">
                            <h2 className="text-xl sm:text-2xl font-semibold text-gray-400 dark:text-gray-500">Your backlog is empty.</h2>
                            <p className="text-gray-500 dark:text-gray-600 mt-2">Add a new task to get started!</p>
                        </div>
                    )}
                </>
            )}
            
            {view === 'archive' && (
                <>
                    {archivedTasks.map((task, index) => (
                         <TaskItem
                            key={task.id}
                            task={task}
                            onDelete={handleDeleteTask}
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

            {view === 'today' && (
                 <>
                    {sortedTodaySubtasks.length > 0 ? (
                        sortedTodaySubtasks.map(item => (
                           <TodaySubtaskItem
                            key={item.subtask.id}
                            item={{ subtask: item.subtask, parentTaskTitle: item.parentTask.title }}
                            onToggleComplete={() => handleToggleTodaySubtaskComplete(item.subtask.id, item.parentTask.id)}
                            onRemove={() => handleUnsetSubtaskDueDate(item.subtask.id, item.parentTask.id)}
                            onDragStart={() => onTodayDragStart(item)}
                            onDragOver={onDragOver}
                            onDrop={() => onTodayDrop(item)}
                            isDragging={draggedTodayItem?.subtask.id === item.subtask.id}
                           />
                        ))
                    ) : (
                        <div className="text-center py-10 px-4">
                            <h2 className="text-xl sm:text-2xl font-semibold text-gray-400 dark:text-gray-500">Nothing scheduled for today.</h2>
                            <p className="text-gray-500 dark:text-gray-600 mt-2">Go to the backlog and assign a due date to your sub-tasks.</p>
                        </div>
                    )}
                </>
            )}

            {view === 'stats' && <StatsView tasks={tasks} />}
            {view === 'settings' && <SettingsView currentConfig={supabaseConfig} onSave={handleSaveSupabaseConfig} />}
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
    </div>
  );
};

export default App;