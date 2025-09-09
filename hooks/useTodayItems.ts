import { useState, useMemo, useEffect, useCallback } from 'react';
import { Task, Subtask } from '../types';

type TodayItem = { subtask: Subtask, parentTask: Task };

export const useTodayItems = (allTasks: Task[], handleUpdateTask: (task: Task) => void) => {
    const [todayOrder, setTodayOrder] = useState<string[]>(() => {
        const savedOrder = localStorage.getItem('todayOrder');
        return savedOrder ? JSON.parse(savedOrder) : [];
    });
    const [draggedTodayItem, setDraggedTodayItem] = useState<TodayItem | null>(null);

    useEffect(() => {
        localStorage.setItem('todayOrder', JSON.stringify(todayOrder));
    }, [todayOrder]);

    const getTodayDateString = () => new Date().toISOString().split('T')[0];

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

    const onTodayDragStart = useCallback((item: TodayItem) => setDraggedTodayItem(item), []);
    const onTodayDrop = useCallback((targetItem: TodayItem) => {
        if (!draggedTodayItem || draggedTodayItem.subtask.id === targetItem.subtask.id) { 
            setDraggedTodayItem(null); 
            return; 
        }
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

    return {
        incompleteTodaySubtasks,
        completedTodaySubtasks,
        draggedTodayItem,
        handleToggleTodaySubtaskComplete,
        handleUnsetSubtaskDueDate,
        onTodayDragStart,
        onTodayDrop,
        handleMoveTodaySubtask
    };
};