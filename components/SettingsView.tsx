import React, { useState, useRef } from 'react';

interface SupabaseConfig {
  url: string;
  anonKey: string;
  email: string;
}

interface SettingsViewProps {
  currentConfig: SupabaseConfig | null;
  onSave: (config: SupabaseConfig) => void;
  isOnlineMode: boolean;
  onToggleOnlineMode: (enabled: boolean) => void;
  onMigrateToOnline: () => void;
  onMigrateToLocal: () => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ currentConfig, onSave, isOnlineMode, onToggleOnlineMode, onMigrateToOnline, onMigrateToLocal }) => {
  const [url, setUrl] = useState(currentConfig?.url || '');
  const [anonKey, setAnonKey] = useState(currentConfig?.anonKey || '');
  const [email, setEmail] = useState(currentConfig?.email || '');
  const configFileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    if (url.trim() && anonKey.trim() && email.trim()) {
      onSave({ url: url.trim(), anonKey: anonKey.trim(), email: email.trim() });
    } else {
      alert('Please fill in all Supabase fields.');
    }
  };
  
  const handleExportConfig = () => {
    if (!currentConfig) {
      alert("No configuration to export.");
      return;
    }
    try {
      const dataStr = JSON.stringify(currentConfig, null, 2);
      const dataBlob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'supabase_config.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting config:", error);
    }
  };

  const handleImportClick = () => {
    configFileInputRef.current?.click();
  };

  const handleConfigFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') throw new Error("File read error");
        const config = JSON.parse(text);
        if (config.url && config.anonKey && config.email) {
          setUrl(config.url);
          setAnonKey(config.anonKey);
          setEmail(config.email);
          onSave(config);
        } else {
          alert("Invalid config file format.");
        }
      } catch (error) {
        console.error("Error importing config:", error);
        alert("Failed to import config file.");
      } finally {
        if (event.target) event.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const revisionHistorySql = `
-- 1. Create the table to store task revisions for each user.
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Optional but recommended: Add an index for faster lookups of the latest revision.
CREATE INDEX ON public.tasks (user_id, created_at DESC);

-- 2. Enable Row Level Security (RLS) on the table.
-- This is crucial for data privacy.
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- 3. Create a policy that allows users to manage their own task revisions.
-- A user can only see, create, update, or delete their own revisions.
CREATE POLICY "Allow users to manage their own tasks"
ON public.tasks
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
  `.trim();

  const onlineModeSql = `
-- ONLINE MODE TABLES --

-- 1. Create the 'online_tasks' table
CREATE TABLE public.online_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  completed BOOLEAN DEFAULT false NOT NULL,
  recurring BOOLEAN DEFAULT false NOT NULL,
  snooze_until DATE,
  completion_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  "order" INTEGER NOT NULL
);

-- 2. Create the 'online_subtasks' table
CREATE TABLE public.online_subtasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.online_tasks(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  text TEXT NOT NULL,
  completed BOOLEAN DEFAULT false NOT NULL,
  due_date DATE,
  completion_date TIMESTAMPTZ,
  is_instance BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  "order" INTEGER NOT NULL
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.online_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.online_subtasks ENABLE ROW LEVEL SECURITY;

-- 4. Create policies for 'online_tasks'
CREATE POLICY "Allow users to manage their own online tasks"
ON public.online_tasks
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 5. Create policies for 'online_subtasks'
CREATE POLICY "Allow users to manage their own online subtasks"
ON public.online_subtasks
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 6. (Optional but Recommended) Create indexes for performance
CREATE INDEX idx_online_tasks_user_id ON public.online_tasks(user_id, "order");
CREATE INDEX idx_online_subtasks_task_id ON public.online_subtasks(task_id, "order");
CREATE INDEX idx_online_subtasks_user_id ON public.online_subtasks(user_id);
  `.trim();

  return (
    <div className="space-y-8 animate-fade-in-down">
       <div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300 mb-4">Supabase Connection</h2>
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md space-y-4">
          <div>
            <label htmlFor="supabaseUrl" className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
              Supabase Project URL
            </label>
            <input
              type="text"
              id="supabaseUrl"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-project-id.supabase.co"
              className="w-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white placeholder-gray-500 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label htmlFor="supabaseAnonKey" className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
              Supabase Anon Key (public)
            </label>
            <input
              type="text"
              id="supabaseAnonKey"
              value={anonKey}
              onChange={(e) => setAnonKey(e.target.value)}
              placeholder="your-public-anon-key"
              className="w-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white placeholder-gray-500 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
           <div>
            <label htmlFor="supabaseEmail" className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
              Supabase User Email
            </label>
            <input
              type="email"
              id="supabaseEmail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your-supabase-user@email.com"
              className="w-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white placeholder-gray-500 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
             <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Your password is only required on first login and is never stored in the browser.</p>
          </div>
          <button
            onClick={handleSave}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md transition-colors"
          >
            Save Configuration
          </button>
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <button
                onClick={handleImportClick}
                className="w-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold py-2 px-4 rounded-md transition-colors"
            >
                Import Config
            </button>
            <button
                onClick={handleExportConfig}
                className="w-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold py-2 px-4 rounded-md transition-colors"
            >
                Export Config
            </button>
             <input
                type="file"
                ref={configFileInputRef}
                onChange={handleConfigFileChange}
                accept="application/json"
                className="hidden"
            />
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300 mb-4">Mode & Data</h2>
         <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md">
            <div className="pb-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">One-Time Data Migration</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    If you have local data, use the buttons below to move it to/from the cloud. <strong>This should be done before switching modes manually.</strong> The app will switch modes for you after a successful migration.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                        <button
                            onClick={onMigrateToOnline}
                            disabled={isOnlineMode || !currentConfig}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Migrate Local to Online
                        </button>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Uploads local data to the cloud. You should do this while in Local Mode.
                            {isOnlineMode && <span className="text-yellow-600 dark:text-yellow-500"> (Disabled because you are already in Online Mode)</span>}
                        </p>
                    </div>
                    <div className="flex-1">
                        <button
                            onClick={onMigrateToLocal}
                            disabled={!isOnlineMode || !currentConfig}
                            className="w-full bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Migrate Online to Local
                        </button>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Downloads cloud data, overwriting local tasks. You should do this while in Online Mode.
                            {!isOnlineMode && <span className="text-yellow-600 dark:text-yellow-500"> (Disabled because you are in Local Mode)</span>}
                        </p>
                    </div>
                </div>
            </div>

            <div className="pt-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Enable Online Mode</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Toggle this to work directly with your cloud data. Use this if you don't need to migrate.</p>
                    </div>
                    <label htmlFor="online-mode-toggle" className="relative inline-flex items-center cursor-pointer">
                        <input 
                            type="checkbox" 
                            id="online-mode-toggle"
                            className="sr-only peer"
                            checked={isOnlineMode}
                            onChange={(e) => onToggleOnlineMode(e.target.checked)}
                            disabled={!currentConfig}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                    </label>
                </div>
                {!currentConfig && <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">Please configure Supabase settings below to enable online mode.</p>}
            </div>

         </div>
       </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300 mb-4">Database Setup</h2>
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md">
           <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">For Online Mode</h3>
           <p className="text-gray-600 dark:text-gray-300 mb-4">Run this in your Supabase SQL Editor to enable the live online mode.</p>
           <pre className="bg-gray-100 dark:bg-gray-900/50 p-4 rounded-md text-sm text-gray-800 dark:text-gray-200 overflow-x-auto">
             <code>{onlineModeSql}</code>
           </pre>
           <hr className="my-6 border-gray-200 dark:border-gray-700"/>
           <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">For Revision History Backup (Legacy)</h3>
           <p className="text-gray-600 dark:text-gray-300 mb-4">Run this to use the revision history import/export feature (works in local mode).</p>
           <pre className="bg-gray-100 dark:bg-gray-900/50 p-4 rounded-md text-sm text-gray-800 dark:text-gray-200 overflow-x-auto">
             <code>{revisionHistorySql}</code>
           </pre>
        </div>
      </div>

    </div>
  );
};

export default SettingsView;