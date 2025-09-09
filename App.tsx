import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Task, Subtask } from './types';
import SubtaskModal from './components/SubtaskModal';
import ConfirmationModal from './components/ConfirmationModal';
import { createSupabaseClient } from './supabaseClient';
import { SunIcon, MoonIcon, ListIcon, CalendarIcon, BarChartIcon, SettingsIcon, SpinnerIcon, ArchiveIcon, SnoozeIcon } from './components/icons';
import { Session } from '@supabase/supabase-js';
import { createTaskService, TaskApi } from './services/taskService';

// Import Page Components
import BacklogPage from './pages/BacklogPage';
import TodayPage from './pages/TodayPage';
import SnoozedPage from './pages/SnoozedPage';
import ArchivePage from './pages/ArchivePage';
import StatsPage from './pages/StatsPage';
import SettingsPage from './pages/SettingsPage';


type TodayItem = { subtask: Subtask, parentTask: Task };
type Theme = 'light' | 'dark';
type View = 'backlog' | 'today' | 'snoozed' | 'archive' | 'stats' | 'settings';
export type SortOption = 'manual' | 'days_passed';


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
  const [backlogTasks, setBacklogTasks] = useState<Task[]>([]);
  const [snoozedTasks, setSnoozedTasks] = useState<Task[]>([]);
  const [archivedTasks, setArchivedTasks] = useState<Task[]>([]);
  
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
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  
  const [isOnlineMode, setIsOnlineMode] = useState<boolean>(() => JSON.parse(localStorage.getItem('isOnlineMode') || 'false'));
  const [supabaseConfig, setSupabaseConfig] = useState<SupabaseConfig | null>(() => JSON.parse(localStorage.getItem('supabaseConfig') || 'null'));
  
  const [modalTask, setModalTask] = useState<Task | null>(null);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [draggedTodayItem, setDraggedTodayItem] = useState<TodayItem | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>(() => JSON.parse(localStorage.getItem('selectedTags') || '[]'));
  const [isCompactView, setIsCompactView] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>('manual');

  const supabase = useMemo(() => supabaseConfig ? createSupabaseClient(supabaseConfig.url, supabaseConfig.anonKey) : null, [supabaseConfig]);
  const [supabaseSession, setSupabaseSession] = useState<Session | null>(null);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const api = useMemo<TaskApi>(() => createTaskService(isOnlineMode, supabase, supabaseSession), [isOnlineMode, supabase, supabaseSession]);
  const allTasks = useMemo(() => [...backlogTasks, ...snoozedTasks, ...archivedTasks], [backlogTasks, snoozedTasks, archivedTasks]);

  const [confirmationState, setConfirmationState] = useState<ConfirmationState>({
    isOpen: false, title: '', message: '', confirmText: 'Confirm',
    confirmClass: 'bg-indigo-600 hover:bg-indigo-700', onConfirm: () => {},
  });


  useEffect(() => { localStorage.setItem('todayOrder', JSON.stringify(todayOrder)); }, [todayOrder]);
  useEffect(() => { localStorage.setItem('backlogView', view); }, [view]);
  useEffect(() => { localStorage.setItem('isOnlineMode', JSON.stringify(isOnlineMode)); }, [isOnlineMode]);
  useEffect(() => { localStorage.setItem('selectedTags', JSON.stringify(selectedTags)); }, [selectedTags]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);
  
   useEffect(() => {
    if (supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => setSupabaseSession(session));
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSupabaseSession(session));
      return () => subscription.unsubscribe();
    }
  }, [supabase]);
  
  useEffect(() => {
    const shouldFetch = !isOnlineMode || (isOnlineMode && supabase && supabaseSession);
    if (!shouldFetch) {
        setBacklogTasks([]); setSnoozedTasks([]); setArchivedTasks([]);
        return;
    }

    setIsLoading(true);
    let fetchPromise;

    const loadAllIfNeeded = () => {
      if (backlogTasks.length === 0 && snoozedTasks.length === 0 && archivedTasks.length === 0) {
        return Promise.all([api.getBacklogTasks(), api.getSnoozedTasks(), api.getArchivedTasks()])
          .then(([b, s, a]) => { setBacklogTasks(b); setSnoozedTasks(s); setArchivedTasks(a); });
      }
      return Promise.resolve();
    };

    switch (view) {
        case 'backlog': fetchPromise = api.getBacklogTasks().then(setBacklogTasks); break;
        case 'snoozed': fetchPromise = api.getSnoozedTasks().then(setSnoozedTasks); break;
        case 'archive': fetchPromise = api.getArchivedTasks().then(setArchivedTasks); break;
        case 'today': case 'stats': case 'settings': fetchPromise = loadAllIfNeeded(); break;
        default: fetchPromise = Promise.resolve();
    }
    
    fetchPromise
        .catch((error: Error) => setStatusMessage({ type: 'error', text: error.message }))
        .finally(() => setIsLoading(false));
  }, [view, api, isOnlineMode, supabase, supabaseSession]);

  const handleSaveSupabaseConfig = (config: SupabaseConfig) => {
    setSupabaseConfig(config);
    localStorage.setItem('supabaseConfig', JSON.stringify(config));
    setStatusMessage({ type: 'success', text: 'Supabase settings saved!' });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const getTodayDateString = () => new Date().toISOString().split('T')[0];
  const extractTags = (text: string): string[] => text.match(/#(\w+)/g) || [];

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    backlogTasks.forEach(task => extractTags(task.description).forEach(tag => tags.add(tag)));
    return Array.from(tags).sort();
  }, [backlogTasks]);

  const todaySubtasks = useMemo(() => {
    const todayString = getTodayDateString();
    const result: TodayItem[] = [];
    allTasks.forEach(task => {
        task.subtasks.forEach(subtask => {
            const wasCompletedToday = subtask.completed && subtask.completionDate?.startsWith(todayString);
            const isDueToday = subtask.dueDate === todayString;
            const isOverdueAndIncomplete = subtask.dueDate && subtask.dueDate < todayString && !subtask.completed;
            if (isDueToday || isOverdueAndIncomplete || wasCompletedToday) {
                result.push({ subtask, parentTask: task });
            }
        });
    });
    return result;
  }, [allTasks]);

  useEffect(() => {
    setTodayOrder(currentOrder => {
      const incompleteIds = new Set(todaySubtasks.filter(i => !i.subtask.completed).map(i => i.subtask.id));
      const newOrder = currentOrder.filter(id => incompleteIds.has(id));
      incompleteIds.forEach(id => { if (!newOrder.includes(id)) newOrder.push(id); });
      return newOrder;
    });
  }, [todaySubtasks]);

  const incompleteTodaySubtasks = useMemo(() => {
    const subtaskMap = new Map(todaySubtasks.map(item => [item.subtask.id, item]));
    return todayOrder.map(id => subtaskMap.get(id)).filter((i): i is TodayItem => !!i && !i.subtask.completed);
  }, [todayOrder, todaySubtasks]);

  const completedTodaySubtasks = useMemo(() => {
    return todaySubtasks.filter(i => i.subtask.completed).sort((a, b) => 
      new Date(b.subtask.completionDate!).getTime() - new Date(a.subtask.completionDate!).getTime());
  }, [todaySubtasks]);


  const handleTagClick = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const handleAddTask = async (title: string, description: string) => {
    const maxOrder = backlogTasks.reduce((max, task) => Math.max(task.order, max), -1);
    try {
        const newTask = await api.addTask(title, description, supabaseSession?.user.id || '', maxOrder + 1);
        setBacklogTasks(prev => [newTask, ...prev]);
    } catch (error: any) { setStatusMessage({type: 'error', text: error.message}); }
  };

  const closeConfirmationModal = () => setConfirmationState(prev => ({ ...prev, isOpen: false }));

  const handleDeleteTask = useCallback(async (taskId: string, taskView: 'backlog' | 'snoozed' | 'archive') => {
    const setState = taskView === 'backlog' ? setBacklogTasks : taskView === 'snoozed' ? setSnoozedTasks : setArchivedTasks;
    const originalState = taskView === 'backlog' ? backlogTasks : taskView === 'snoozed' ? snoozedTasks : archivedTasks;
    
    setState(prevTasks => prevTasks.filter(task => task.id !== taskId));
    try { await api.deleteTask(taskId); } 
    catch (error: any) {
        setStatusMessage({type: 'error', text: `Failed to delete task: ${error.message}`});
        setState(originalState);
    }
  }, [api, backlogTasks, snoozedTasks, archivedTasks]);

  const requestDeleteTask = useCallback((taskId: string) => {
    const task = allTasks.find(t => t.id === taskId);
    if (!task) return;
    const todayString = getTodayDateString();
    const taskView = task.completed ? 'archive' : (task.snoozeUntil && task.snoozeUntil > todayString) ? 'snoozed' : 'backlog';
    setConfirmationState({
        isOpen: true, title: 'Confirm Deletion', message: `Delete task "${task.title}"?`,
        confirmText: 'Delete', confirmClass: 'bg-red-600 hover:bg-red-700',
        onConfirm: () => { handleDeleteTask(taskId, taskView); closeConfirmationModal(); },
    });
  }, [allTasks, handleDeleteTask]);

  const handleUpdateTask = useCallback(async (updatedTask: Task) => {
    let sourceView: View | null = null;
    let targetView: View | null = null;
    const todayString = getTodayDateString();

    const findTask = allTasks.find(t => t.id === updatedTask.id);
    if(findTask) {
        sourceView = findTask.completed ? 'archive' : (findTask.snoozeUntil && findTask.snoozeUntil > todayString) ? 'snoozed' : 'backlog';
    }
    targetView = updatedTask.completed ? 'archive' : (updatedTask.snoozeUntil && updatedTask.snoozeUntil > todayString) ? 'snoozed' : 'backlog';
    
    // Optimistic update
    const setSourceState = sourceView === 'backlog' ? setBacklogTasks : sourceView === 'snoozed' ? setSnoozedTasks : setArchivedTasks;
    const setTargetState = targetView === 'backlog' ? setBacklogTasks : targetView === 'snoozed' ? setSnoozedTasks : setArchivedTasks;

    if(sourceView === targetView) {
        setTargetState(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
    } else {
        if(setSourceState) setSourceState(prev => prev.filter(t => t.id !== updatedTask.id));
        setTargetState(prev => [...prev, updatedTask]);
    }
    
    if (modalTask?.id === updatedTask.id) setModalTask(updatedTask);
    
    try { await api.updateTask(updatedTask); } 
    catch (error: any) {
        setStatusMessage({type: 'error', text: `Failed to update task: ${error.message}.`});
        // Revert on failure
        api.getBacklogTasks().then(setBacklogTasks);
        api.getSnoozedTasks().then(setSnoozedTasks);
        api.getArchivedTasks().then(setArchivedTasks);
    }
  }, [api, modalTask, allTasks]);
  
  const handleToggleTaskComplete = useCallback((taskId: string) => {
    const task = allTasks.find(t => t.id === taskId);
    if (!task) return;
    const isCompleted = !task.completed;
    handleUpdateTask({ ...task, completed: isCompleted, completionDate: isCompleted ? new Date().toISOString() : undefined });
  }, [allTasks, handleUpdateTask]);

  const handleSnoozeTask = useCallback((taskId: string, duration: 'day' | 'week' | 'month') => {
    const task = allTasks.find(t => t.id === taskId && !t.completed);
    if (!task) {
        console.warn(`[handleSnoozeTask] Could not find incomplete task with ID: ${taskId}`);
        return;
    }
    const newDate = new Date();
    if (duration === 'day') newDate.setDate(newDate.getDate() + 1);
    if (duration === 'week') newDate.setDate(newDate.getDate() + 7);
    if (duration === 'month') newDate.setMonth(newDate.getMonth() + 1);
    handleUpdateTask({ ...task, snoozeUntil: newDate.toISOString().split('T')[0] });
  }, [allTasks, handleUpdateTask]);

  const handleUnsnoozeTask = useCallback((taskId: string) => {
    const task = snoozedTasks.find(t => t.id === taskId);
    if (!task) return;
    const { snoozeUntil, ...rest } = task;
    handleUpdateTask(rest);
  }, [snoozedTasks, handleUpdateTask]);

  const handleSetSubtaskDueDate = useCallback((subtaskId: string, taskId: string, date: string) => {
    const task = allTasks.find(t => t.id === taskId);
    if (!task) return;
    handleUpdateTask({ ...task, subtasks: task.subtasks.map(st => st.id === subtaskId ? { ...st, dueDate: date } : st ) });
  }, [allTasks, handleUpdateTask]);

  const handleToggleTodaySubtaskComplete = useCallback(async (subtaskId: string, taskId: string) => {
    const task = allTasks.find(t => t.id === taskId);
    const subtask = task?.subtasks.find(st => st.id === subtaskId);
    if (!task || !subtask) return;
    const isCompleting = !subtask.completed;
    let updatedSubtasks = task.subtasks.map(st => st.id === subtaskId ? { ...st, completed: isCompleting, completionDate: isCompleting ? new Date().toISOString() : undefined } : st);
    if (isCompleting && subtask.recurrence) {
        const { unit, value } = subtask.recurrence;
        let nextDueDate = new Date();
        if (unit === 'day') nextDueDate.setDate(nextDueDate.getDate() + value);
        else if (unit === 'week') nextDueDate.setDate(nextDueDate.getDate() + (value * 7));
        else if (unit === 'month') nextDueDate.setMonth(nextDueDate.getMonth() + value);
        else if (unit === 'year') nextDueDate.setFullYear(nextDueDate.getFullYear() + value);
        updatedSubtasks.push({ ...subtask, id: crypto.randomUUID(), completed: false, dueDate: nextDueDate.toISOString().split('T')[0], completionDate: undefined, order: updatedSubtasks.length });
    }
    const incomplete = updatedSubtasks.filter(st => !st.completed).sort((a,b) => a.order - b.order);
    const completed = updatedSubtasks.filter(st => st.completed).sort((a,b) => new Date(b.completionDate!).getTime() - new Date(a.completionDate!).getTime());
    handleUpdateTask({ ...task, subtasks: [...incomplete, ...completed].map((st, i) => ({...st, order: i})) });
}, [allTasks, handleUpdateTask]);

  const handleUnsetSubtaskDueDate = useCallback((subtaskId: string, taskId: string) => {
    const task = allTasks.find(t => t.id === taskId);
    if (!task) return;
    handleUpdateTask({ ...task, subtasks: task.subtasks.map(st => st.id === subtaskId ? { ...st, dueDate: undefined } : st) });
  }, [allTasks, handleUpdateTask]);

  const handleUpdateParentTaskDescription = useCallback((taskId: string, newDescription: string) => {
    const task = allTasks.find(t => t.id === taskId);
    if (!task) return;
    handleUpdateTask({ ...task, description: newDescription });
  }, [allTasks, handleUpdateTask]);
  
  const handleUpdateSubtaskText = useCallback((taskId: string, subtaskId: string, newText: string) => {
    const task = allTasks.find(t => t.id === taskId);
    if (!task) return;
    handleUpdateTask({ ...task, subtasks: task.subtasks.map(st => st.id === subtaskId ? { ...st, text: newText } : st) });
  }, [allTasks, handleUpdateTask]);
  
  const handleMoveTask = useCallback(async (taskId: string, direction: 'up' | 'down' | 'top' | 'bottom') => {
    let activeTasks = [...backlogTasks].sort((a,b) => a.order - b.order);
    const fromIndex = activeTasks.findIndex(t => t.id === taskId);
    if(fromIndex === -1) return;
    const [movedItem] = activeTasks.splice(fromIndex, 1);
    if (direction === 'top') activeTasks.unshift(movedItem);
    else if (direction === 'bottom') activeTasks.push(movedItem);
    else if (direction === 'up' && fromIndex > 0) activeTasks.splice(fromIndex - 1, 0, movedItem);
    else if (direction === 'down' && fromIndex < activeTasks.length -1) activeTasks.splice(fromIndex + 1, 0, movedItem);
    const updatedTasks = activeTasks.map((t, i) => ({...t, order: i}));
    setBacklogTasks(updatedTasks);
    try { await api.reorderTasks(updatedTasks.map(t => ({ id: t.id, order: t.order }))); } 
    catch (error: any) { setStatusMessage({type: 'error', text: `Failed to reorder: ${error.message}`}); api.getBacklogTasks().then(setBacklogTasks); }
}, [backlogTasks, api]);

  const handleMoveTodaySubtask = useCallback((subtaskId: string, direction: 'up' | 'down' | 'top' | 'bottom') => {
    setTodayOrder(currentOrder => {
        const fromIndex = currentOrder.indexOf(subtaskId);
        if (fromIndex === -1) return currentOrder;
        const newOrder = [...currentOrder];
        const [item] = newOrder.splice(fromIndex, 1);
        if (direction === 'top') newOrder.unshift(item);
        else if (direction === 'bottom') newOrder.push(item);
        else if (direction === 'up') newOrder.splice(Math.max(0, fromIndex - 1), 0, item);
        else if (direction === 'down') newOrder.splice(fromIndex + 1, 0, item);
        return newOrder;
    });
  }, []);

  const handleOpenSubtaskModal = useCallback((task: Task) => setModalTask(task), []);
  const handleCloseModal = useCallback(() => setModalTask(null), []);
  
  const onDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, task: Task) => setDraggedTask(task), []);
  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => e.preventDefault(), []);
  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>, targetTask: Task) => {
    e.preventDefault();
    if (!draggedTask || view !== 'backlog' || draggedTask.completed || targetTask.completed || sortOption !== 'manual') return;
    const activeTasks = [...backlogTasks].sort((a,b) => a.order - b.order);
    const fromIndex = activeTasks.findIndex(t => t.id === draggedTask.id);
    const toIndex = activeTasks.findIndex(t => t.id === targetTask.id);
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;
    const [moved] = activeTasks.splice(fromIndex, 1);
    activeTasks.splice(toIndex, 0, moved);
    const updatedTasks = activeTasks.map((t, i) => ({...t, order: i}));
    setBacklogTasks(updatedTasks);
    setDraggedTask(null);
    api.reorderTasks(updatedTasks.map(t => ({ id: t.id, order: t.order })))
      .catch((err: any) => { setStatusMessage({type:'error', text:err.message}); api.getBacklogTasks().then(setBacklogTasks); });
  }, [draggedTask, view, sortOption, backlogTasks, api]);
  
  const onTodayDragStart = useCallback((item: TodayItem) => setDraggedTodayItem(item), []);
  const onTodayDrop = useCallback((targetItem: TodayItem) => {
    if (!draggedTodayItem || draggedTodayItem.subtask.id === targetItem.subtask.id) { setDraggedTodayItem(null); return; }
    setTodayOrder(current => {
      const fromIndex = current.indexOf(draggedTodayItem.subtask.id);
      const toIndex = current.indexOf(targetItem.subtask.id);
      if (fromIndex === -1 || toIndex === -1) return current;
      const newOrder = [...current];
      const [moved] = newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, moved);
      return newOrder;
    });
    setDraggedTodayItem(null);
  }, [draggedTodayItem]);

  const handleMigrateToOnline = async () => {
    if (!supabase || !supabaseSession) return;
    setConfirmationState({ isOpen: true, title: 'Migrate to Online', message: 'Overwrite online data with local data?', confirmText: 'Migrate', confirmClass: 'bg-red-600 hover:bg-red-700',
      onConfirm: async () => {
        closeConfirmationModal(); setIsLoading(true);
        try {
          const localData = localStorage.getItem('backlogTasks');
          const tasksToMigrate: Task[] = localData ? JSON.parse(localData) : [];
          if (!tasksToMigrate.length) throw new Error("No local data.");
          await supabase.from('online_subtasks').delete().eq('user_id', supabaseSession.user.id);
          await supabase.from('online_tasks').delete().eq('user_id', supabaseSession.user.id);
          const { error: te } = await supabase.from('online_tasks').upsert(tasksToMigrate.map(t => ({ id: t.id, user_id: supabaseSession.user.id, title: t.title, description: t.description, completed: t.completed, completion_date: t.completionDate, snooze_until: t.snoozeUntil, order: t.order })));
          if (te) throw te;
          const subtasks = tasksToMigrate.flatMap(t => t.subtasks.map(st => ({ id: st.id, task_id: t.id, user_id: supabaseSession.user.id, text: st.text, completed: st.completed, due_date: st.dueDate, completion_date: st.completionDate, recurrence: st.recurrence, order: st.order })));
          if (subtasks.length > 0) { const { error: se } = await supabase.from('online_subtasks').upsert(subtasks); if (se) throw se; }
          setStatusMessage({type: 'success', text: 'Migration successful!'}); setIsOnlineMode(true); setView('backlog');
        } catch (error: any) { setStatusMessage({type: 'error', text: `Migration failed: ${error.message}`}); } 
        finally { setIsLoading(false); setTimeout(() => setStatusMessage(null), 5000); }
      },
    });
  };

  const handleMigrateToLocal = () => {
      if (!isOnlineMode) return;
      setConfirmationState({ isOpen: true, title: 'Migrate to Local', message: 'Overwrite local data with online data?', confirmText: 'Migrate', confirmClass: 'bg-red-600 hover:bg-red-700',
          onConfirm: () => {
              closeConfirmationModal(); localStorage.setItem('backlogTasks', JSON.stringify(allTasks)); setIsOnlineMode(false);
              setStatusMessage({ type: 'success', text: 'Migrated to local mode!' }); setTimeout(() => setStatusMessage(null), 3000);
          },
      });
  };
  
  const renderView = () => {
      switch (view) {
          case 'backlog':
              return <BacklogPage 
                  backlogTasks={backlogTasks} draggedTask={draggedTask} allTags={allTags} selectedTags={selectedTags}
                  isCompactView={isCompactView} sortOption={sortOption} onAddTask={handleAddTask} onDeleteTask={requestDeleteTask}
                  onUpdateTask={handleUpdateTask} onOpenSubtaskModal={handleOpenSubtaskModal} onDragStart={onDragStart}
                  onDragOver={onDragOver} onDrop={onDrop} onToggleTaskComplete={handleToggleTaskComplete} onMoveTask={handleMoveTask}
                  onSnoozeTask={handleSnoozeTask} onUnsnoozeTask={handleUnsnoozeTask} onTagClick={handleTagClick}
                  onClearTags={() => setSelectedTags([])} onSetSortOption={setSortOption} onSetCompactView={setIsCompactView}
                  onUpdateSubtaskText={handleUpdateSubtaskText} onSetSubtaskDueDate={handleSetSubtaskDueDate}
              />;
          case 'today':
              return <TodayPage
                  incompleteTodaySubtasks={incompleteTodaySubtasks} completedTodaySubtasks={completedTodaySubtasks} draggedTodayItem={draggedTodayItem}
                  onToggleComplete={handleToggleTodaySubtaskComplete} onRemoveDueDate={handleUnsetSubtaskDueDate} onDragStart={onTodayDragStart}
                  onDragOver={onDragOver} onDrop={onTodayDrop} onMoveSubtask={handleMoveTodaySubtask}
                  onUpdateParentTaskDescription={handleUpdateParentTaskDescription} onUpdateSubtaskText={handleUpdateSubtaskText}
              />;
          case 'snoozed':
              return <SnoozedPage 
                  snoozedTasks={snoozedTasks} allTags={allTags} onDeleteTask={requestDeleteTask} onUpdateTask={handleUpdateTask}
                  onOpenSubtaskModal={handleOpenSubtaskModal} onToggleTaskComplete={handleToggleTaskComplete} onSnoozeTask={handleSnoozeTask}
                  onUnsnoozeTask={handleUnsnoozeTask} onUpdateSubtaskText={handleUpdateSubtaskText} onSetSubtaskDueDate={handleSetSubtaskDueDate}
              />;
          case 'archive':
              return <ArchivePage
                  archivedTasks={archivedTasks} allTags={allTags} onDeleteTask={requestDeleteTask} onUpdateTask={handleUpdateTask}
                  onOpenSubtaskModal={handleOpenSubtaskModal} onToggleTaskComplete={handleToggleTaskComplete}
                  onUpdateSubtaskText={handleUpdateSubtaskText} onSetSubtaskDueDate={handleSetSubtaskDueDate}
              />;
          case 'stats':
              return <StatsPage tasks={allTasks} />;
          case 'settings':
              return <SettingsPage
                  currentConfig={supabaseConfig} onSave={handleSaveSupabaseConfig} isOnlineMode={isOnlineMode}
                  onToggleOnlineMode={setIsOnlineMode} onMigrateToLocal={handleMigrateToLocal} onMigrateToOnline={handleMigrateToOnline}
              />;
          default:
              return null;
      }
  };

  return (
    <div className={`min-h-screen ${theme} bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-white`}>
      {modalTask && <SubtaskModal task={modalTask} onClose={handleCloseModal} onUpdateTask={handleUpdateTask} onSetSubtaskDueDate={handleSetSubtaskDueDate} />}
      <ConfirmationModal {...confirmationState} onClose={closeConfirmationModal} />

      <div className="container mx-auto p-2 sm:p-4 max-w-5xl">
        <header className="mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
            <h1 className="text-3xl sm:text-4xl font-bold text-indigo-600 dark:text-indigo-400">Next Task</h1>
            <div className="flex items-center space-x-2 mt-3 sm:mt-0">
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${isOnlineMode ? 'bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}`}>
                {isOnlineMode ? 'Online' : 'Local'}
              </span>
              <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                {theme === 'light' ? <MoonIcon /> : <SunIcon />}
              </button>
            </div>
          </div>
          <nav className="mt-4 flex flex-wrap gap-2">
            {(['backlog', 'today', 'snoozed', 'archive', 'stats', 'settings'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} title={v.charAt(0).toUpperCase() + v.slice(1)} className={`flex items-center justify-center sm:justify-start p-2 sm:px-3 sm:py-1.5 text-sm font-semibold rounded-md ${view === v ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                {v === 'backlog' && <ListIcon className="h-5 w-5 sm:mr-1"/>}
                {v === 'today' && <CalendarIcon className="h-5 w-5 sm:mr-1"/>}
                {v === 'snoozed' && <SnoozeIcon className="h-5 w-5 sm:mr-1"/>}
                {v === 'archive' && <ArchiveIcon className="h-5 w-5 sm:mr-1"/>}
                {v === 'stats' && <BarChartIcon className="h-5 w-5 sm:mr-1"/>}
                {v === 'settings' && <SettingsIcon className="h-5 w-5 sm:mr-1"/>}
                <span className="hidden sm:inline">{v.charAt(0).toUpperCase() + v.slice(1)}</span>
              </button>
            ))}
          </nav>
        </header>

        {statusMessage && (
          <div className={`mb-4 p-3 rounded-md text-sm font-medium ${statusMessage.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200'}`}>
            {statusMessage.text}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center my-4"><SpinnerIcon /> <span className="ml-2">Loading data...</span></div>
        ) : (
          renderView()
        )}
        
      </div>
    </div>
  );
};

export default App;