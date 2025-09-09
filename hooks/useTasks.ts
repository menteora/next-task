import { useState, useCallback, useEffect } from 'react';
import { Task } from '../types';
import { TaskApi } from '../services/taskService';
import { ConfirmationState } from './useUI';

const formatDate = (date: Date): string => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

export const useTasks = (
    api: TaskApi,
    requestConfirmation: (options: Omit<ConfirmationState, 'isOpen' | 'onConfirm'> & { onConfirm: () => void }) => void
) => {
    const [backlogTasks, setBacklogTasks] = useState<Task[]>([]);
    const [snoozedTasks, setSnoozedTasks] = useState<Task[]>([]);
    const [archivedTasks, setArchivedTasks] = useState<Task[]>([]);
    const [modalTask, setModalTask] = useState<Task | null>(null);
    const [draggedTask, setDraggedTask] = useState<Task | null>(null);
    
    const allTasks = [...backlogTasks, ...snoozedTasks, ...archivedTasks];

    // Fetch tasks when API changes
    useEffect(() => {
        api.getBacklogTasks().then(setBacklogTasks).catch(console.error);
        api.getSnoozedTasks().then(setSnoozedTasks).catch(console.error);
        api.getArchivedTasks().then(setArchivedTasks).catch(console.error);
    }, [api]);

    const handleAddTask = async (title: string, description: string) => {
        const maxOrder = backlogTasks.reduce((max, task) => Math.max(task.order, max), -1);
        try {
            const newTask = await api.addTask(title, description, '', maxOrder + 1); // userId is handled by RLS policies in Supabase
            setBacklogTasks(prev => [newTask, ...prev].sort((a,b) => a.order - b.order));
        } catch (error: any) { console.error(error.message); }
    };

    const handleUpdateTask = useCallback(async (updatedTask: Task) => {
        let sourceView: 'backlog' | 'snoozed' | 'archive' | null = null;
        let targetView: 'backlog' | 'snoozed' | 'archive' | null = null;
        const todayString = formatDate(new Date());

        const findTask = allTasks.find(t => t.id === updatedTask.id);
        if (findTask) {
            sourceView = findTask.completed ? 'archive' : (findTask.snoozeUntil && findTask.snoozeUntil > todayString) ? 'snoozed' : 'backlog';
        }
        targetView = updatedTask.completed ? 'archive' : (updatedTask.snoozeUntil && updatedTask.snoozeUntil > todayString) ? 'snoozed' : 'backlog';

        // Optimistic update
        const setSourceState = sourceView === 'backlog' ? setBacklogTasks : sourceView === 'snoozed' ? setSnoozedTasks : setArchivedTasks;
        const setTargetState = targetView === 'backlog' ? setBacklogTasks : targetView === 'snoozed' ? setSnoozedTasks : setArchivedTasks;

        if (sourceView === targetView) {
            setTargetState(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t).sort((a,b) => a.order - b.order));
        } else {
            if(setSourceState) setSourceState(prev => prev.filter(t => t.id !== updatedTask.id));
            setTargetState(prev => [...prev, updatedTask].sort((a,b) => a.order - b.order));
        }
        
        if (modalTask?.id === updatedTask.id) setModalTask(updatedTask);
        
        try { await api.updateTask(updatedTask); } 
        catch (error: any) {
            console.error(`Failed to update task: ${error.message}.`);
            // Revert on failure
            api.getBacklogTasks().then(setBacklogTasks);
            api.getSnoozedTasks().then(setSnoozedTasks);
            api.getArchivedTasks().then(setArchivedTasks);
        }
    }, [api, modalTask, allTasks]);

    const handleDeleteTask = useCallback(async (taskId: string) => {
        const task = allTasks.find(t => t.id === taskId);
        if (!task) return;
        const todayString = formatDate(new Date());
        const taskView = task.completed ? 'archive' : (task.snoozeUntil && task.snoozeUntil > todayString) ? 'snoozed' : 'backlog';
        const setState = taskView === 'backlog' ? setBacklogTasks : taskView === 'snoozed' ? setSnoozedTasks : setArchivedTasks;
        const originalState = [...(taskView === 'backlog' ? backlogTasks : taskView === 'snoozed' ? snoozedTasks : archivedTasks)];
        
        setState(prevTasks => prevTasks.filter(task => task.id !== taskId));
        try { await api.deleteTask(taskId); } 
        catch (error: any) {
            console.error(`Failed to delete task: ${error.message}`);
            setState(originalState);
        }
    }, [api, allTasks, backlogTasks, snoozedTasks, archivedTasks]);

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
        const task = allTasks.find(t => t.id === taskId && !t.completed);
        if (!task) return;
        const newDate = new Date();
        if (duration === 'day') newDate.setDate(newDate.getDate() + 1);
        if (duration === 'week') newDate.setDate(newDate.getDate() + 7);
        if (duration === 'month') newDate.setMonth(newDate.getMonth() + 1);
        handleUpdateTask({ ...task, snoozeUntil: formatDate(newDate) });
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
        else if (direction === 'down' && fromIndex < activeTasks.length) activeTasks.splice(fromIndex + 1, 0, movedItem);
        const updatedTasks = activeTasks.map((t, i) => ({...t, order: i}));
        setBacklogTasks(updatedTasks);
        try { await api.reorderTasks(updatedTasks.map(t => ({ id: t.id, order: t.order }))); } 
        catch (error: any) { console.error(error.message); api.getBacklogTasks().then(setBacklogTasks); }
    }, [backlogTasks, api]);

    const handleOpenSubtaskModal = useCallback((task: Task) => setModalTask(task), []);
    const handleCloseModal = useCallback(() => setModalTask(null), []);
    
    const onDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, task: Task) => setDraggedTask(task), []);
    const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => e.preventDefault(), []);
    const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>, targetTask: Task) => {
        e.preventDefault();
        if (!draggedTask || draggedTask.completed || targetTask.completed) return;
        
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
          .catch((err: any) => { console.error(err.message); api.getBacklogTasks().then(setBacklogTasks); });
    }, [draggedTask, backlogTasks, api]);

    return {
        allTasks,
        backlogTasks,
        snoozedTasks,
        archivedTasks,
        modalTask,
        draggedTask,
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