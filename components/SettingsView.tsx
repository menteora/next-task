import React, { useState, useRef } from 'react';

interface SupabaseConfig {
  url: string;
  anonKey: string;
  email: string;
}

interface SettingsViewProps {
  currentConfig: SupabaseConfig | null;
  onSave: (config: SupabaseConfig) => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ currentConfig, onSave }) => {
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
-- 1. Create a helper function to update 'updated_at' columns.
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Create the 'tasks' table.
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  recurring BOOLEAN DEFAULT false,
  completed BOOLEAN DEFAULT false,
  completion_date TIMESTAMPTZ,
  snooze_until DATE,
  "order" INTEGER, -- 'order' is a reserved keyword, so it needs quotes.
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
-- Add trigger for 'updated_at' on tasks
CREATE TRIGGER on_tasks_updated
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();

-- 3. Create the 'subtasks' table.
CREATE TABLE public.subtasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  text TEXT NOT NULL,
  completed BOOLEAN DEFAULT false,
  due_date DATE,
  is_instance BOOLEAN DEFAULT false,
  completion_date TIMESTAMPTZ,
  "order" INTEGER, -- Position within the task.
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
-- Add trigger for 'updated_at' on subtasks
CREATE TRIGGER on_subtasks_updated
  BEFORE UPDATE ON public.subtasks
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();

-- 4. Enable Row Level Security (RLS) for both tables.
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;

-- 5. Create policies to allow users to manage their own data.
-- Policies for 'tasks' table
CREATE POLICY "Allow users to manage their own tasks"
  ON public.tasks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policies for 'subtasks' table
CREATE POLICY "Allow users to manage their own subtasks"
  ON public.subtasks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 6. Recommended: Add indexes for performance.
CREATE INDEX ON public.tasks (user_id, "order");
CREATE INDEX ON public.subtasks (task_id, "order");

-- 7. Create a user account in your Supabase project.
-- Go to Authentication -> Users and click "Add user".
-- Use the email and password from that account in this app's settings.
  `.trim();

  return (
    <div className="space-y-8 animate-fade-in-down">
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
            In your Supabase project, go to the SQL Editor and run the following commands to set up the database tables.
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
