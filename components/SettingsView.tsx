import React, { useState, useRef } from 'react';
import { SpinnerIcon } from './icons';

interface SupabaseConfig {
  url: string;
  anonKey: string;
  email: string;
}

interface SettingsViewProps {
  currentConfig: SupabaseConfig | null;
  onSave: (config: SupabaseConfig) => void;
  isSyncEnabled: boolean;
  onToggleSync: (enabled: boolean) => void;
  isSupabaseLoading: boolean;
}

const SettingsView: React.FC<SettingsViewProps> = ({ currentConfig, onSave, isSyncEnabled, onToggleSync, isSupabaseLoading }) => {
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

  const sqlInstruction = `
-- This table stores your Backlog data.
-- It can store both a single "live" record for real-time syncing,
-- and multiple historical "backup" records from manual exports.

-- 1. Create the table.
CREATE TABLE public.backlog_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB,
  is_live_data BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create a function to automatically update the 'updated_at' timestamp.
CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to call the function before any update.
CREATE TRIGGER set_timestamp
BEFORE UPDATE ON public.backlog_data
FOR EACH ROW
EXECUTE PROCEDURE public.trigger_set_timestamp();


-- 2. Add an index for faster lookups of backups.
CREATE INDEX ON public.backlog_data (user_id, created_at DESC);

-- 3. Create a unique index to ensure only ONE live record per user.
-- This is the key to the live sync feature.
CREATE UNIQUE INDEX backlog_data_user_id_is_live_data_true_idx
ON public.backlog_data (user_id)
WHERE (is_live_data = true);

-- 4. Enable Row Level Security (RLS) for data privacy.
ALTER TABLE public.backlog_data ENABLE ROW LEVEL SECURITY;

-- 5. Create a policy that allows users to manage their own data.
CREATE POLICY "Allow users to manage their own data"
ON public.backlog_data
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 6. Create a user account in your Supabase project.
-- Go to Authentication -> Users and click "Add user".
-- Use the email and password from that account in this app's settings.
  `.trim();

  return (
    <div className="space-y-8 animate-fade-in-down">
       <div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300 mb-4">Live Sync</h2>
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md">
           <div className="flex justify-between items-center">
             <div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Enable Cloud Sync</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Store and sync your tasks with Supabase in real-time.
                </p>
             </div>
            <button
                type="button"
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-cyan-600 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${isSyncEnabled ? 'bg-cyan-600' : 'bg-gray-200 dark:bg-gray-600'}`}
                role="switch"
                aria-checked={isSyncEnabled}
                onClick={() => onToggleSync(!isSyncEnabled)}
                disabled={!currentConfig || isSupabaseLoading}
            >
                <span className="sr-only">Use setting</span>
                <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isSyncEnabled ? 'translate-x-5' : 'translate-x-0'}`}
                />
            </button>
           </div>
           {!currentConfig && (
            <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-3">Please configure Supabase settings below to enable Live Sync.</p>
           )}
        </div>
      </div>
      <div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300 mb-4">Supabase Settings</h2>
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
              className="w-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white placeholder-gray-500 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
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
              className="w-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white placeholder-gray-500 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
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
              className="w-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white placeholder-gray-500 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
             <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Your password is only required on first login and is never stored in the browser.</p>
          </div>
          <button
            onClick={handleSave}
            className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-md transition-colors"
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
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300 mb-4">Table Setup</h2>
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md">
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            In your Supabase project, go to the SQL Editor and run the following commands to set up the data table.
          </p>
          <pre className="bg-gray-100 dark:bg-gray-900/50 p-4 rounded-md text-sm text-gray-800 dark:text-gray-200 overflow-x-auto">
            <code>
              {sqlInstruction}
            </code>
          </pre>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;