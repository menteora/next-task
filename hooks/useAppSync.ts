import { useState, useMemo, useEffect } from 'react';
import { createSupabaseClient } from '../supabaseClient';
import { createTaskService, TaskApi } from '../services/taskService';
import { Session } from '@supabase/supabase-js';
import { Task } from '../types';

type Theme = 'light' | 'dark';
type View = 'backlog' | 'today' | 'snoozed' | 'archive' | 'stats' | 'settings';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  email: string;
}

export interface StatusMessage {
  type: 'success' | 'error';
  text: string;
}

export const useAppSync = (view: View, theme: Theme) => {
  const [isOnlineMode, setIsOnlineMode] = useState<boolean>(() => JSON.parse(localStorage.getItem('isOnlineMode') || 'false'));
  const [supabaseConfig, setSupabaseConfig] = useState<SupabaseConfig | null>(() => JSON.parse(localStorage.getItem('supabaseConfig') || 'null'));
  const [supabaseSession, setSupabaseSession] = useState<Session | null>(null);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const supabase = useMemo(() => supabaseConfig ? createSupabaseClient(supabaseConfig.url, supabaseConfig.anonKey) : null, [supabaseConfig]);
  const api = useMemo<TaskApi>(() => createTaskService(isOnlineMode, supabase, supabaseSession), [isOnlineMode, supabase, supabaseSession]);

  useEffect(() => {
    localStorage.setItem('isOnlineMode', JSON.stringify(isOnlineMode));
  }, [isOnlineMode]);
  
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

  const showStatus = (type: 'success' | 'error', text: string, duration = 3000) => {
      setStatusMessage({ type, text });
      setTimeout(() => setStatusMessage(null), duration);
  };

  const handleSaveSupabaseConfig = (config: SupabaseConfig) => {
    setSupabaseConfig(config);
    localStorage.setItem('supabaseConfig', JSON.stringify(config));
    showStatus('success', 'Supabase settings saved!');
  };

  const handleMigrateToOnline = async (allTasks: Task[]) => {
    if (!supabase || !supabaseSession) return;
    setIsLoading(true);
    try {
        const localData = localStorage.getItem('backlogTasks');
        const tasksToMigrate: Task[] = localData ? JSON.parse(localData) : [];
        if (!tasksToMigrate.length) throw new Error("No local data to migrate.");

        await supabase.from('online_subtasks').delete().eq('user_id', supabaseSession.user.id);
        await supabase.from('online_tasks').delete().eq('user_id', supabaseSession.user.id);
        
        const { error: te } = await supabase.from('online_tasks').upsert(tasksToMigrate.map(t => ({ id: t.id, user_id: supabaseSession.user.id, title: t.title, description: t.description, completed: t.completed, completion_date: t.completionDate, snooze_until: t.snoozeUntil, order: t.order })));
        if (te) throw te;
        
        const subtasks = tasksToMigrate.flatMap(t => t.subtasks.map(st => ({ id: st.id, task_id: t.id, user_id: supabaseSession.user.id, text: st.text, completed: st.completed, due_date: st.dueDate, completion_date: st.completionDate, recurrence: st.recurrence, order: st.order })));
        if (subtasks.length > 0) { const { error: se } = await supabase.from('online_subtasks').upsert(subtasks); if (se) throw se; }
        
        showStatus('success', 'Migration successful! Switched to Online Mode.');
        setIsOnlineMode(true);
    } catch (error: any) { 
        showStatus('error', `Migration failed: ${error.message}`, 5000);
    } finally { 
        setIsLoading(false);
    }
  };

  const handleMigrateToLocal = (allTasks: Task[]) => {
      if (!isOnlineMode) return;
      localStorage.setItem('backlogTasks', JSON.stringify(allTasks));
      setIsOnlineMode(false);
      showStatus('success', 'Migrated to local mode!');
  };

  return {
    api,
    isOnlineMode,
    supabaseConfig,
    supabaseSession,
    isLoading,
    statusMessage,
    setIsLoading,
    setStatusMessage,
    setIsOnlineMode,
    handleSaveSupabaseConfig,
    handleMigrateToLocal,
    handleMigrateToOnline
  };
};