import React from 'react';
import { SubtaskModal, ConfirmationModal } from './components';
import { SunIcon, MoonIcon, ListIcon, CalendarIcon, BarChartIcon, SettingsIcon, SpinnerIcon, ArchiveIcon, SnoozeIcon } from './components/icons';

// Import Page Components
import { BacklogPage, TodayPage, SnoozedPage, ArchivePage, StatsPage, SettingsPage } from './pages';

// Import Custom Hooks
import { useAppSync } from './hooks/useAppSync';
import { useTasks } from './hooks/useTasks';
import { useTodayItems } from './hooks/useTodayItems';
import { useUI } from './hooks/useUI';


const App: React.FC = () => {
  const {
    theme, view, isCompactView, sortOption, selectedTags, confirmationState,
    setTheme, setView, setCompactView, setSortOption, setSelectedTags,
    closeConfirmationModal, requestConfirmation
  } = useUI();

  const {
    // FIX: Destructure 'isLoading' from useAppSync and alias it to 'isSyncLoading' to resolve the error, as 'isSyncLoading' does not exist on the return type.
    api, isOnlineMode, supabaseConfig, isLoading: isSyncLoading, isSessionLoading, statusMessage,
    setIsOnlineMode, handleSaveSupabaseConfig, handleMigrateToLocal, handleMigrateToOnline
  } = useAppSync(view, theme);

  const {
    allTasks, backlogTasks, snoozedTasks, archivedTasks, modalTask, draggedTask,
    taskLoadingState, loadBacklogTasks, loadSnoozedTasks, loadArchivedTasks, loadAllTasks,
    handleAddTask, requestDeleteTask, handleUpdateTask, handleToggleTaskComplete,
    handleSnoozeTask, handleUnsnoozeTask, handleSetSubtaskDueDate, handleUpdateSubtaskText,
    handleMoveTask, handleOpenSubtaskModal, handleCloseModal,
    onDragStart, onDragOver, onDrop
  } = useTasks(api, requestConfirmation);

  const {
    incompleteTodaySubtasks, completedTodaySubtasks, draggedTodayItem,
    handleToggleTodaySubtaskComplete, handleUnsetSubtaskDueDate,
    onTodayDragStart, onTodayDrop, handleMoveTodaySubtask
  } = useTodayItems(allTasks, handleUpdateTask);
  
  const allTags = React.useMemo(() => {
    const tags = new Set<string>();
    backlogTasks.forEach(task => (task.description.match(/#(\w+)/g) || []).forEach(tag => tags.add(tag)));
    return Array.from(tags).sort();
  }, [backlogTasks]);


  const renderView = () => {
      switch (view) {
          case 'backlog':
              return <BacklogPage 
                  backlogTasks={backlogTasks} draggedTask={draggedTask} allTags={allTags} selectedTags={selectedTags}
                  isCompactView={isCompactView} sortOption={sortOption} onAddTask={handleAddTask} onDeleteTask={requestDeleteTask}
                  onUpdateTask={handleUpdateTask} onOpenSubtaskModal={handleOpenSubtaskModal} onDragStart={onDragStart}
                  onDragOver={onDragOver} onDrop={onDrop} onToggleTaskComplete={handleToggleTaskComplete} onMoveTask={handleMoveTask}
                  onSnoozeTask={handleSnoozeTask} onUnsnoozeTask={handleUnsnoozeTask} onTagClick={(tag) => setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
                  onClearTags={() => setSelectedTags([])} onSetSortOption={setSortOption} onSetCompactView={setCompactView}
                  onUpdateSubtaskText={handleUpdateSubtaskText} onSetSubtaskDueDate={handleSetSubtaskDueDate}
                  loadTasks={loadBacklogTasks} isLoading={taskLoadingState.backlog}
              />;
          case 'today':
              return <TodayPage
                  incompleteTodaySubtasks={incompleteTodaySubtasks} completedTodaySubtasks={completedTodaySubtasks} draggedTodayItem={draggedTodayItem}
                  onToggleComplete={handleToggleTodaySubtaskComplete} onRemoveDueDate={handleUnsetSubtaskDueDate} onDragStart={onTodayDragStart}
                  onDragOver={onDragOver} onDrop={onTodayDrop} onMoveSubtask={handleMoveTodaySubtask}
                  onUpdateParentTaskDescription={(taskId, newDescription) => {
                      const task = allTasks.find(t => t.id === taskId);
                      if(task) handleUpdateTask({ ...task, description: newDescription });
                  }} 
                  onUpdateSubtaskText={handleUpdateSubtaskText}
                  loadTasks={loadAllTasks} isLoading={taskLoadingState.backlog || taskLoadingState.snoozed || taskLoadingState.archive}
              />;
          case 'snoozed':
              return <SnoozedPage 
                  snoozedTasks={snoozedTasks} allTags={allTags} onDeleteTask={requestDeleteTask} onUpdateTask={handleUpdateTask}
                  onOpenSubtaskModal={handleOpenSubtaskModal} onToggleTaskComplete={handleToggleTaskComplete} onSnoozeTask={handleSnoozeTask}
                  onUnsnoozeTask={handleUnsnoozeTask} onUpdateSubtaskText={handleUpdateSubtaskText} onSetSubtaskDueDate={handleSetSubtaskDueDate}
                  loadTasks={loadSnoozedTasks} isLoading={taskLoadingState.snoozed}
              />;
          case 'archive':
              return <ArchivePage
                  archivedTasks={archivedTasks} allTags={allTags} onDeleteTask={requestDeleteTask} onUpdateTask={handleUpdateTask}
                  onOpenSubtaskModal={handleOpenSubtaskModal} onToggleTaskComplete={handleToggleTaskComplete}
                  onUpdateSubtaskText={handleUpdateSubtaskText} onSetSubtaskDueDate={handleSetSubtaskDueDate}
                  loadTasks={loadArchivedTasks} isLoading={taskLoadingState.archive}
              />;
          case 'stats':
              return <StatsPage 
                  tasks={allTasks} 
                  loadTasks={loadAllTasks} 
                  isLoading={taskLoadingState.backlog || taskLoadingState.snoozed || taskLoadingState.archive} 
              />;
          case 'settings':
              return <SettingsPage
                  currentConfig={supabaseConfig} onSave={handleSaveSupabaseConfig} isOnlineMode={isOnlineMode}
                  onToggleOnlineMode={setIsOnlineMode} onMigrateToLocal={() => handleMigrateToLocal(allTasks)} onMigrateToOnline={() => handleMigrateToOnline(allTasks)}
              />;
          default:
              return null;
      }
  };

  const isLoading = isSyncLoading || (isOnlineMode && isSessionLoading);

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
          <div className="flex flex-col items-center justify-center my-10">
            <SpinnerIcon className="h-10 w-10 text-indigo-500" /> 
            <span className="ml-2 mt-4 text-lg font-medium text-gray-600 dark:text-gray-300">
              {isSyncLoading ? 'Migrating data...' : 'Connecting to online service...'}
            </span>
          </div>
        ) : (
          renderView()
        )}
        
      </div>
    </div>
  );
};

export default App;
