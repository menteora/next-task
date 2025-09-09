import React from 'react';
import SettingsView from '../components/SettingsView';

interface SupabaseConfig {
  url: string;
  anonKey: string;
  email: string;
}

interface SettingsPageProps {
  currentConfig: SupabaseConfig | null;
  onSave: (config: SupabaseConfig) => void;
  isOnlineMode: boolean;
  onToggleOnlineMode: (enabled: boolean) => void;
  onMigrateToOnline: () => void;
  onMigrateToLocal: () => void;
}

const SettingsPage: React.FC<SettingsPageProps> = (props) => {
  return <SettingsView {...props} />;
};

export default SettingsPage;
