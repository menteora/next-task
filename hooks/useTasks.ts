import { useState, useCallback, useEffect, useMemo } from 'react';
import { Task } from '../types';
import { TaskApi } from '../services/taskService';
import { ConfirmationState } from './useUI';
import { Session } from '@supabase/supabase-js';

const formatDate = (date: Date): string => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

export const useTasks = (
    api: TaskApi | null,
    session: Session | null,
    requestConfirmation: (options: Omit<ConfirmationState, 'isOpen' | 'onConfirm'> & { onConfirm: () => void }) => void
) => {
    const [backlogTasks, setBacklogTasks] = useState<Task[]>([]);
    const [snoozedTasks, setSnoozedTasks] = useState<Task[]>([]);
    const [archivedTasks, setArchivedTasks] = useState<Task[]>([]);
    const [modalTask, setModalTask] = useState<Task | null>(null);
    const [draggedTask, setDraggedTask] = useState<Task | null>(null);
    
    const [taskLoadingState, setTaskLoadingState] = useState({ backlog: false, snoozed: false, archive: false });
    const [taskLoadedState, setTaskLoadedState] = useState({ backlog: false, snoozed: false, archive: false });

    useEffect(() => {
        // When the API changes (e.g., switching between local and online, or from null to ready),
        // reset the loaded state to trigger a refetch of data from the new source.
        // Also clear current tasks to avoid showing stale data.
        if (api) {
            setTaskLoadedState({ backlog: false, snoozed: false, archive: false });
            setBacklogTasks([]);
            setSnoozedTasks([]);
            setArchivedTasks([]);
        }
    }, [api]);

    const allTasks = useMemo(() => [...backlogTasks, ...snoozedTasks, ...archivedTasks], [backlogTasks, snoozedTasks, archivedTasks]);

    const loadBacklogTasks = useCallback(async (force = false) => {
        if (!api || ((taskLoadedState.backlog && !force) || taskLoadingState.backlog)) return;
        setTaskLoadingState(prev => ({ ...prev, backlog: true }));
        try {
            const tasks = await api.getBacklogTasks();
            setBacklogTasks(tasks);
            setTaskLoadedState(prev => ({ ...prev, backlog: true }));
        } catch (error) { console.error("Failed to load backlog tasks:", error); } 
        finally { setTaskLoadingState(prev => ({ ...prev, backlog: false })); }
    }, [api, taskLoadedState.backlog, taskLoadingState.backlog]);

    const loadSnoozedTasks = useCallback(async (force = false) => {
        if (!api || ((taskLoadedState.snoozed && !force) || taskLoadingState.snoozed)) return;
        setTaskLoadingState(prev => ({ ...prev, snoozed: true }));
        try {
            const tasks = await api.getSnoozedTasks();
            setSnoozedTasks(tasks);
            setTaskLoadedState(prev => ({ ...prev, snoozed: true }));
        } catch (error) { console.error("Failed to load snoozed tasks:", error); } 
        finally { setTaskLoadingState(prev => ({ ...prev, snoozed: false })); }
    }, [api, taskLoadedState.snoozed, taskLoadingState.snoozed]);

    const loadArchivedTasks = useCallback(async (force = false) => {
        if (!api || ((taskLoadedState.archive && !force) || taskLoadingState.archive)) return;
        setTaskLoadingState(prev => ({ ...prev, archive: true }));
        try {
            const tasks = await api.getArchivedTasks();
            setArchivedTasks(tasks);
            setTaskLoadedState(prev => ({ ...prev, archive: true }));
        } catch (error) { console.error("Failed to load archived tasks:", error); } 
        finally { setTaskLoadingState(prev => ({ ...prev, archive: false })); }
    }, [api, taskLoadedState.archive, taskLoadingState.archive]);

    const loadAllTasks = useCallback(async () => {
        if (!api) return;
        await Promise.all([loadBacklogTasks(), loadSnoozedTasks(), loadArchivedTasks()]);
    }, [api, loadBacklogTasks, loadSnoozedTasks, loadArchivedTasks]);

    const handleAddTask = async (title: string, description: string) => {
        if (!api || !session?.user.id) {
            console.error("Cannot add task: API not ready or user not logged in.");
            return;
        }
        const maxOrder = backlogTasks.reduce((max, task) => Math.max(task.order, max), -1);
        try {
            const newTask = await api.addTask(title, description, session.user.id, maxOrder + 1);
            setBacklogTasks(prev => [newTask, ...prev].sort((a,b) => a.order - b.order));
        } catch (error: any) { console.error(error.message); }
    };

    const handleUpdateTask = useCallback(async (updatedTask: Task) => {
        if (!api) return;
        const todayString = formatDate(new Date());
        const findTask = allTasks.find(t => t.id === updatedTask.id);
        
        let sourceView: 'backlog' | 'snoozed' | 'archive' | null = null;
        if (findTask) {
            sourceView = findTask.completed ? 'archive' : (findTask.snoozeUntil && findTask.snoozeUntil > todayString) ? 'snoozed' : 'backlog';
        }
        const targetView = updatedTask.completed ? 'archive' : (updatedTask.snoozeUntil && updatedTask.snoozeUntil > todayString) ? 'snoozed' : 'backlog';
        
        // Optimistic update
        if (sourceView === targetView) {
            if (targetView === 'backlog') setBacklogTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t).sort((a,b) => a.order - b.order));
            if (targetView === 'snoozed') setSnoozedTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t).sort((a,b) => (a.snoozeUntil || '').localeCompare(b.snoozeUntil || '')));
            if (targetView === 'archive') setArchivedTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t).sort((a,b) => (b.completionDate || '').localeCompare(a.completionDate || '')));
        } else {
            if (sourceView === 'backlog') setBacklogTasks(prev => prev.filter(t => t.id !== updatedTask.id));
            if (sourceView === 'snoozed') setSnoozedTasks(prev => prev.filter(t => t.id !== updatedTask.id));
            if (sourceView === 'archive') setArchivedTasks(prev => prev.filter(t => t.id !== updatedTask.id));

            if (targetView === 'backlog') setBacklogTasks(prev => [...prev, updatedTask].sort((a,b) => a.order - b.order));
            if (targetView === 'snoozed') setSnoozedTasks(prev => [...prev, updatedTask].sort((a,b) => (a.snoozeUntil || '').localeCompare(b.snoozeUntil || '')));
            if (targetView === 'archive') setArchivedTasks(prev => [...prev, updatedTask].sort((a,b) => (b.completionDate || '').localeCompare(a.completionDate || '')));
        }
        
        if (modalTask?.id === updatedTask.id) setModalTask(updatedTask);
        
        try { await api.updateTask(updatedTask); } 
        catch (error: any) {
            console.error(`Failed to update task: ${error.message}.`);
            // Revert state on failure by forcing a refetch
            if (taskLoadedState.backlog) loadBacklogTasks(true);
            if (taskLoadedState.snoozed) loadSnoozedTasks(true);
            if (taskLoadedState.archive) loadArchivedTasks(true);
        }
    }, [api, modalTask, allTasks, taskLoadedState, loadBacklogTasks, loadSnoozedTasks, loadArchivedTasks]);

    const handleDeleteTask = useCallback(async (taskId: string) => {
        if (!api) return;
        const task = allTasks.find(t => t.id === taskId);
        if (!task) return;
        const todayString = formatDate(new Date());
        const taskView = task.completed ? 'archive' : (task.snoozeUntil && task.snoozeUntil > todayString) ? 'snoozed' : 'backlog';
        
        // Optimistic deletion
        if (taskView === 'backlog') setBacklogTasks(prev => prev.filter(t => t.id !== taskId));
        if (taskView === 'snoozed') setSnoozedTasks(prev => prev.filter(t => t.id !== taskId));
        if (taskView === 'archive') setArchivedTasks(prev => prev.filter(t => t.id !== taskId));
        
        try { await api.deleteTask(taskId); } 
        catch (error: any) {
            console.error(`Failed to delete task: ${error.message}`);
            // Revert by refetching
            if (taskView === 'backlog') loadBacklogTasks(true);
            if (taskView === 'snoozed') loadSnoozedTasks(true);
            if (taskView === 'archive') loadArchivedTasks(true);
        }
    }, [api, allTasks, loadBacklogTasks, loadSnoozedTasks, loadArchivedTasks]);

    const requestDeleteTask = useCallback((taskId: string) => {
        const task = allTasks.find(t => t.id === taskId);
        if (!task) return;
        requestConfirmation({
            title: 'Confirm Deletion',
            message: `Delete task "${task.title}"?`,
            confirmText: 'Delete',
            confirmClass: 'bg-red-600 hover:bg-red-700',
            onConfirm: () => handleDeleteTask(taskId),
        });
    }, [allTasks, handleDeleteTask, requestConfirmation]);

    const handleToggleTaskComplete = useCallback((taskId: string) => {
        const task = allTasks.find(t => t.id === taskId);
        if (!task) return;
        const isCompleted = !task.completed;
        handleUpdateTask({ ...task, completed: isCompleted, completionDate: isCompleted ? new Date().toISOString() : undefined });
    }, [allTasks, handleUpdateTask]);

    const handleSnoozeTask = useCallback((taskId: string, duration: 'day' | 'week' | 'month') => {
        const task = backlogTasks.find(t => t.id === taskId && !t.completed);
        if (!task) return;
        const newDate = new Date();
        if (duration === 'day') newDate.setDate(newDate.getDate() + 1);
        if (duration === 'week') newDate.setDate(newDate.getDate() + 7);
        if (duration === 'month') newDate.setMonth(newDate.getMonth() + 1);
        handleUpdateTask({ ...task, snoozeUntil: formatDate(newDate) });
    }, [backlogTasks, handleUpdateTask]);

    const handleUnsnoozeTask = useCallback((taskId: string) => {
        const task = allTasks.find(t => t.id === taskId);
        if (!task) return;
        const { snoozeUntil, ...rest } = task;
        handleUpdateTask(rest);
    }, [allTasks, handleUpdateTask]);

    const handleSetSubtaskDueDate = useCallback((subtaskId: string, taskId: string, date: string) => {
        const task = allTasks.find(t => t.id === taskId);
        if (!task) return;
        handleUpdateTask({ ...task, subtasks: task.subtasks.map(st => st.id === subtaskId ? { ...st, dueDate: date } : st ) });
    }, [allTasks, handleUpdateTask]);

    const handleUpdateSubtaskText = useCallback((taskId: string, subtaskId: string, newText: string) => {
        const task = allTasks.find(t => t.id === taskId);
        if (!task) return;
        handleUpdateTask({ ...task, subtasks: task.subtasks.map(st => st.id === subtaskId ? { ...st, text: newText } : st) });
    }, [allTasks, handleUpdateTask]);
    
    const handleMoveTask = useCallback(async (taskId: string, direction: 'up' | 'down' | 'top' | 'bottom') => {
        if (!api) return;
        let activeTasks = [...backlogTasks].sort((a,b) => a.order - b.order);
        const fromIndex = activeTasks.findIndex(t => t.id === taskId);
        if(fromIndex === -1) return;
        const [movedItem] = activeTasks.splice(fromIndex, 1);
        if (direction === 'top') activeTasks.unshift(movedItem);
        else if (direction === 'bottom') activeTasks.push(movedItem);
        else if (direction === 'up' && fromIndex > 0) activeTasks.splice(fromIndex - 1, 0, movedItem);
        else if (direction === 'down' && fromIndex < activeTasks.length) activeTasks.splice(fromIndex + 1, 0, movedItem);
        const updatedTasks = activeTasks.map((t, i) => ({...t, order: i}));
        setBacklogTasks(updatedTasks);
        try { await api.reorderTasks(updatedTasks.map(t => ({ id: t.id, order: t.order }))); } 
        catch (error: any) { console.error(error.message); loadBacklogTasks(true); }
    }, [backlogTasks, api, loadBacklogTasks]);

    const handleOpenSubtaskModal = useCallback((task: Task) => setModalTask(task), []);
    const handleCloseModal = useCallback(() => setModalTask(null), []);
    
    const onDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, task: Task) => setDraggedTask(task), []);
    const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => e.preventDefault(), []);
    const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>, targetTask: Task) => {
        e.preventDefault();
        if (!api || !draggedTask || draggedTask.completed || targetTask.completed) return;
        
        let activeTasks = [...backlogTasks].sort((a,b) => a.order - b.order);
        const fromIndex = activeTasks.findIndex(t => t.id === draggedTask.id);
        const toIndex = activeTasks.findIndex(t => t.id === targetTask.id);
        if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;
        
        const [moved] = activeTasks.splice(fromIndex, 1);
        activeTasks.splice(toIndex, 0, moved);
        
        const updatedTasks = activeTasks.map((t, i) => ({...t, order: i}));
        setBacklogTasks(updatedTasks);
        setDraggedTask(null);
        api.reorderTasks(updatedTasks.map(t => ({ id: t.id, order: t.order })))
          .catch((err: any) => { console.error(err.message); loadBacklogTasks(true); });
    }, [draggedTask, backlogTasks, api, loadBacklogTasks]);

    return {
        allTasks,
        backlogTasks,
        snoozedTasks,
        archivedTasks,
        modalTask,
        draggedTask,
        taskLoadingState,
        loadBacklogTasks,
        loadSnoozedTasks,
        loadArchivedTasks,
        loadAllTasks,
        handleAddTask,
        requestDeleteTask,
        handleUpdateTask,
        handleToggleTaskComplete,
        handleSnoozeTask,
        handleUnsnoozeTask,
        handleSetSubtaskDueDate,
        handleUpdateSubtaskText,
        handleMoveTask,
        handleOpenSubtaskModal,
        handleCloseModal,
        onDragStart,
        onDragOver,
        onDrop,
    };
};

