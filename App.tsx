import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Task, Subtask } from './types';
import TaskItem from './components/TaskItem';
import SubtaskModal from './components/SubtaskModal';
import TodaySubtaskItem from './components/TodaySubtaskItem';
import StatsView from './components/StatsView';
import { PlusIcon, SunIcon, MoonIcon, ListIcon, CalendarIcon, BarChartIcon, ArrowsPointingInIcon, ArrowsPointingOutIcon, DownloadIcon, UploadIcon } from './components/icons';

type TodayItem = { subtask: Subtask, parentTask: Task };
type Theme = 'light' | 'dark';
type View = 'backlog' | 'today' | 'stats';

const App: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>(() => {
      const savedTasks = localStorage.getItem('backlogTasks');
      if (savedTasks) {
          try {
              const parsedTasks = JSON.parse(savedTasks);
              return parsedTasks.map((task: any) => ({
                  ...task,
                  completed: task.completed ?? false,
              }));
          } catch (e) {
              console.error("Failed to parse tasks from localStorage", e);
              return [];
          }
      }
      return [];
  });
  
  const [todayOrder, setTodayOrder] = useState<string[]>(() => {
      const savedOrder = localStorage.getItem('todayOrder');
      return savedOrder ? JSON.parse(savedOrder) : [];
  });

  const [view, setView] = useState<View>(() => {
    const savedTasks = localStorage.getItem('backlogTasks');
    if (savedTasks) {
        try {
            const initialTasks: Task[] = JSON.parse(savedTasks);
            const todayString = new Date().toISOString().split('T')[0];
            const hasTodayTasks = initialTasks.some(task =>
                task.subtasks?.some(subtask => subtask.dueDate === todayString)
            );
            if (hasTodayTasks) {
                return 'today';
            }
        } catch (e) {
            console.error("Error parsing tasks for initial view check", e);
            return 'backlog';
        }
    }
    return 'backlog';
  });

  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem('theme') as Theme;
    if (savedTheme) return savedTheme;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [isNewTaskRecurring, setIsNewTaskRecurring] = useState(false);
  const [isFormVisible, setIsFormVisible] = useState(false);
  
  const [modalTask, setModalTask] = useState<Task | null>(null);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [draggedTodayItem, setDraggedTodayItem] = useState<TodayItem | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>(() => {
    const savedTags = localStorage.getItem('selectedTags');
    return savedTags ? JSON.parse(savedTags) : [];
  });
  const [isCompactView, setIsCompactView] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('backlogTasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('todayOrder', JSON.stringify(todayOrder));
  }, [todayOrder]);
  
  useEffect(() => {
    localStorage.setItem('backlogView', view);
  }, [view]);

  useEffect(() => {
    localStorage.setItem('selectedTags', JSON.stringify(selectedTags));
  }, [selectedTags]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const getTodayDateString = () => new Date().toISOString().split('T')[0];

  const extractTags = (text: string): string[] => {
    const regex = /#(\w+)/g;
    return text.match(regex) || [];
  };

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    tasks.forEach(task => {
        extractTags(task.description).forEach(tag => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [tasks]);

  const handleAddTagToDescription = (tag: string, setter: React.Dispatch<React.SetStateAction<string>>) => {
    setter(prev => `${prev.trim()} ${tag}`.trim());
  };

  const filteredTasks = useMemo(() => {
    if (selectedTags.length === 0) {
        return tasks;
    }
    return tasks.filter(task => {
        const taskTags = extractTags(task.description);
        return selectedTags.every(selectedTag => taskTags.includes(selectedTag));
    });
  }, [tasks, selectedTags]);
  
  const todaySubtasks = useMemo(() => {
      const todayString = getTodayDateString();
      const result: TodayItem[] = [];
      tasks.forEach(task => {
          task.subtasks.forEach(subtask => {
              if (subtask.dueDate === todayString) {
                  result.push({ subtask, parentTask: task });
              }
          });
      });
      return result;
  }, [tasks]);

  useEffect(() => {
    setTodayOrder(currentOrder => {
      const todaySubtaskIds = new Set(todaySubtasks.map(item => item.subtask.id));
      const filteredOrder = currentOrder.filter(id => todaySubtaskIds.has(id));
      todaySubtasks.forEach(item => {
        if (!filteredOrder.includes(item.subtask.id)) {
          filteredOrder.push(item.subtask.id);
        }
      });
      return filteredOrder;
    });
  }, [todaySubtasks]);

  const sortedTodaySubtasks = useMemo(() => {
    const subtaskMap = new Map(todaySubtasks.map(item => [item.subtask.id, item]));
    return todayOrder.map(id => subtaskMap.get(id)).filter(Boolean) as TodayItem[];
  }, [todayOrder, todaySubtasks]);


  const handleTagClick = (tag: string) => {
    setSelectedTags(prev =>
        prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleAddTask = () => {
    if (newTaskTitle.trim()) {
      const newTask: Task = {
        id: crypto.randomUUID(),
        title: newTaskTitle.trim(),
        description: newTaskDescription.trim(),
        subtasks: [],
        recurring: isNewTaskRecurring,
        completed: false,
      };
      setTasks(prevTasks => [...prevTasks, newTask]);
      setNewTaskTitle('');
      setNewTaskDescription('');
      setIsNewTaskRecurring(false);
      setIsFormVisible(false);
    }
  };

  const handleDeleteTask = useCallback((taskId: string) => {
    setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
  }, []);

  const handleUpdateTask = useCallback((updatedTask: Task) => {
    setTasks(prevTasks => prevTasks.map(task => task.id === updatedTask.id ? updatedTask : task));
    if (modalTask && modalTask.id === updatedTask.id) {
        setModalTask(updatedTask);
    }
  }, [modalTask]);
  
  const handleToggleTaskComplete = useCallback((taskId: string) => {
    setTasks(prevTasks =>
      prevTasks.map(task => {
        if (task.id !== taskId) return task;
        const isCompleted = !task.completed;
        return {
          ...task,
          completed: isCompleted,
          completionDate: isCompleted ? new Date().toISOString() : undefined,
        };
      })
    );
  }, []);

  const handleSetSubtaskDueDate = useCallback((subtaskId: string, taskId: string, date: string) => {
    setTasks(prevTasks => {
        return prevTasks.map(task => {
            if (task.id !== taskId) return task;

            const subtaskIndex = task.subtasks.findIndex(st => st.id === subtaskId);
            if (subtaskIndex === -1) return task;

            if (task.recurring) {
                const originalSubtask = task.subtasks[subtaskIndex];
                const newInstance: Subtask = {
                    ...originalSubtask,
                    id: crypto.randomUUID(),
                    completed: false,
                    dueDate: date,
                    isInstance: true,
                    completionDate: undefined,
                };
                return { ...task, subtasks: [...task.subtasks, newInstance] };
            } else {
                const updatedSubtasks = [...task.subtasks];
                updatedSubtasks[subtaskIndex] = { ...updatedSubtasks[subtaskIndex], dueDate: date };
                return { ...task, subtasks: updatedSubtasks };
            }
        });
    });
  }, []);


  const handleToggleTodaySubtaskComplete = useCallback((subtaskId: string, taskId: string) => {
    setTasks(prevTasks => 
        prevTasks.map(task => {
            if (task.id !== taskId) return task;
            return {
                ...task,
                subtasks: task.subtasks.map(st => {
                    if (st.id !== subtaskId) return st;
                    const isCompleted = !st.completed;
                    return {
                        ...st,
                        completed: isCompleted,
                        completionDate: isCompleted ? new Date().toISOString() : undefined,
                    };
                }),
            };
        })
    );
}, []);

  const handleUnsetSubtaskDueDate = useCallback((subtaskId: string, taskId: string) => {
    setTasks(prevTasks => {
        return prevTasks.map(task => {
            if (task.id !== taskId) return task;
            
            const subtask = task.subtasks.find(st => st.id === subtaskId);
            if (!subtask) return task;

            if (subtask.isInstance) {
                return { ...task, subtasks: task.subtasks.filter(st => st.id !== subtaskId) };
            } else {
                const updatedSubtasks = task.subtasks.map(st =>
                    st.id === subtaskId ? { ...st, dueDate: undefined } : st
                );
                return { ...task, subtasks: updatedSubtasks };
            }
        });
    });
  }, []);


  const handleOpenSubtaskModal = useCallback((task: Task) => {
    setModalTask(task);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalTask(null);
  }, []);
  
  const onDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, task: Task) => {
    setDraggedTask(task);
  }, []);
  
  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>, targetTask: Task) => {
    e.preventDefault();
    if (!draggedTask || view !== 'backlog') return;

    const fromIndex = tasks.findIndex(task => task.id === draggedTask.id);
    const toIndex = tasks.findIndex(task => task.id === targetTask.id);

    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;

    const items = [...tasks];
    const [reorderedItem] = items.splice(fromIndex, 1);
    items.splice(toIndex, 0, reorderedItem);

    setTasks(items);
    setDraggedTask(null);
  }, [draggedTask, tasks, view]);
  
  const onTodayDragStart = useCallback((item: TodayItem) => setDraggedTodayItem(item), []);
  
  const onTodayDrop = useCallback((targetItem: TodayItem) => {
    if (!draggedTodayItem) return;

    const fromId = draggedTodayItem.subtask.id;
    const toId = targetItem.subtask.id;

    if (fromId === toId) return;

    const fromIndex = todayOrder.findIndex(id => id === fromId);
    const toIndex = todayOrder.findIndex(id => id === toId);
    
    if (fromIndex === -1 || toIndex === -1) return;

    const newOrder = [...todayOrder];
    const [movedItem] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, movedItem);

    setTodayOrder(newOrder);
    setDraggedTodayItem(null);
  }, [draggedTodayItem, todayOrder]);

  const handleExportTasks = useCallback(() => {
    try {
        const dataStr = JSON.stringify(tasks, null, 2);
        const dataBlob = new Blob([dataStr], {type: "application/json"});
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'backlog_export.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Error exporting tasks:", error);
    }
  }, [tasks]);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const text = e.target?.result;
            if (typeof text !== 'string') {
                throw new Error("File could not be read as text.");
            }
            const importedTasks = JSON.parse(text);

            if (!Array.isArray(importedTasks) || (importedTasks.length > 0 && typeof importedTasks[0].id === 'undefined')) {
                 console.error('Invalid file format. Please import a valid JSON export file.');
                 return;
            }

            setTasks(importedTasks);
            setTodayOrder([]);
            console.log(`${importedTasks.length} tasks imported successfully!`);

        } catch (error) {
            console.error("Error importing tasks:", error);
        } finally {
            if (event.target) {
                event.target.value = '';
            }
        }
    };
    reader.onerror = () => console.error('An error occurred while reading the file.');
    reader.readAsText(file);
  };
  
  return (
    <div className="min-h-screen font-sans">
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <header className="flex justify-between items-center mb-8">
          <div className="flex-grow">
            <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-teal-600 dark:from-cyan-400 dark:to-teal-500">
              Backlog
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2">Organize your work, focus on the next action.</p>
          </div>
          <div className="flex items-center space-x-2">
            <button
                onClick={handleExportTasks}
                className="p-2 rounded-full bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                aria-label="Export tasks"
                title="Export tasks"
            >
                <DownloadIcon />
            </button>
            <button
                onClick={handleImportClick}
                className="p-2 rounded-full bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                aria-label="Import tasks"
                title="Import tasks"
            >
                <UploadIcon />
            </button>
            <button
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="p-2 rounded-full bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? <MoonIcon /> : <SunIcon />}
            </button>
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="application/json"
                className="hidden"
            />
          </div>
        </header>

        <div className="flex justify-center mb-8 bg-gray-200 dark:bg-gray-800 rounded-lg p-1">
            <button
                onClick={() => setView('backlog')}
                className={`w-1/3 py-2 px-4 rounded-md transition-all duration-300 flex justify-center items-center ${view === 'backlog' ? 'bg-cyan-600 text-white shadow' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white'}`}
                aria-label="Backlog View"
            >
                <ListIcon />
            </button>
            <button
                onClick={() => setView('today')}
                className={`w-1/3 py-2 px-4 rounded-md transition-all duration-300 flex justify-center items-center ${view === 'today' ? 'bg-cyan-600 text-white shadow' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white'}`}
                aria-label="Today View"
            >
                <CalendarIcon />
            </button>
            <button
                onClick={() => setView('stats')}
                className={`w-1/3 py-2 px-4 rounded-md transition-all duration-300 flex justify-center items-center ${view === 'stats' ? 'bg-cyan-600 text-white shadow' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white'}`}
                aria-label="Stats View"
            >
                <BarChartIcon />
            </button>
        </div>

        <main>
          {view === 'backlog' && (
            <div className="flex justify-between items-center mb-6">
                {allTags.length > 0 ? (
                    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg flex-grow">
                        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">Filter by tags:</h3>
                        <div className="flex flex-wrap gap-2">
                            {allTags.map(tag => (
                                <button
                                    key={tag}
                                    onClick={() => handleTagClick(tag)}
                                    className={`px-3 py-1 text-sm rounded-full transition-colors ${
                                        selectedTags.includes(tag)
                                            ? 'bg-cyan-500 text-white font-semibold'
                                            : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
                                    }`}
                                >
                                    {tag}
                                </button>
                            ))}
                        </div>
                        {selectedTags.length > 0 && (
                            <button onClick={() => setSelectedTags([])} className="text-xs text-cyan-600 dark:text-cyan-500 hover:underline mt-4">
                                Clear filters
                            </button>
                        )}
                    </div>
                ) : <div className="flex-grow"></div>}
                
                {tasks.length > 0 && (
                    <button 
                        onClick={() => setIsCompactView(!isCompactView)} 
                        className="ml-4 p-2 rounded-md bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                        aria-label={isCompactView ? "Expand view" : "Compact view"}
                        title={isCompactView ? "Expand view" : "Compact view"}
                    >
                        {isCompactView ? <ArrowsPointingOutIcon /> : <ArrowsPointingInIcon />}
                    </button>
                )}
            </div>
          )}


          {view === 'backlog' && (
            <div className="mb-8">
                {isFormVisible ? (
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg animate-fade-in-down">
                    <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="Task Title"
                    className="w-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white placeholder-gray-500 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                    <textarea
                    value={newTaskDescription}
                    onChange={(e) => setNewTaskDescription(e.target.value)}
                    placeholder="Description... use #tag to add tags"
                    rows={3}
                    className="w-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white placeholder-gray-500 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                    {allTags.length > 0 && (
                        <div className="mb-3">
                            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Suggested tags:</h4>
                            <div className="flex flex-wrap gap-1">
                                {allTags
                                    .filter(tag => !newTaskDescription.includes(tag))
                                    .map(tag => (
                                    <button 
                                        key={tag} 
                                        onClick={() => handleAddTagToDescription(tag, setNewTaskDescription)}
                                        className="px-2 py-0.5 text-xs rounded-full bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 transition-colors"
                                    >
                                        {tag}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    <label className="flex items-center mb-3 text-sm text-gray-500 dark:text-gray-400">
                        <input
                            type="checkbox"
                            checked={isNewTaskRecurring}
                            onChange={e => setIsNewTaskRecurring(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 bg-gray-200 dark:bg-gray-700 text-teal-600 dark:text-teal-500 focus:ring-teal-500 dark:focus:ring-teal-600 cursor-pointer"
                        />
                        <span className="ml-2">Recurring Task</span>
                    </label>
                    <div className="flex justify-end space-x-2">
                    <button onClick={() => setIsFormVisible(false)} className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition-colors">
                        Cancel
                    </button>
                    <button onClick={handleAddTask} className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-md transition-colors">
                        Add Task
                    </button>
                    </div>
                </div>
                ) : (
                <button onClick={() => setIsFormVisible(true)} className="w-full flex items-center justify-center bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/80 border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-cyan-500 text-gray-500 dark:text-gray-400 hover:text-cyan-500 font-bold py-3 px-4 rounded-lg transition-all duration-300">
                    <PlusIcon />
                    <span className="ml-2">Add New Task</span>
                </button>
                )}
            </div>
           )}
          
          <div className="task-list">
             {view === 'backlog' && (
                <>
                    {filteredTasks.map(task => (
                        <TaskItem
                            key={task.id}
                            task={task}
                            onDelete={handleDeleteTask}
                            onUpdate={handleUpdateTask}
                            onOpenSubtaskModal={handleOpenSubtaskModal}
                            onDragStart={onDragStart}
                            onDragOver={onDragOver}
                            onDrop={onDrop}
                            isDragging={draggedTask?.id === task.id}
                            onSetSubtaskDueDate={handleSetSubtaskDueDate}
                            onToggleTaskComplete={handleToggleTaskComplete}
                            allTags={allTags}
                            isCompactView={isCompactView}
                        />
                    ))}
                    {tasks.length > 0 && filteredTasks.length === 0 && (
                        <div className="text-center py-10 px-4">
                            <h2 className="text-2xl font-semibold text-gray-400 dark:text-gray-500">No tasks match the selected filters.</h2>
                            <p className="text-gray-500 dark:text-gray-600 mt-2">Try adjusting or clearing your filters.</p>
                        </div>
                    )}
                    {tasks.length === 0 && (
                        <div className="text-center py-10 px-4">
                            <h2 className="text-2xl font-semibold text-gray-400 dark:text-gray-500">Your backlog is empty.</h2>
                            <p className="text-gray-500 dark:text-gray-600 mt-2">Add a new task to get started!</p>
                        </div>
                    )}
                </>
            )}

            {view === 'today' && (
                 <>
                    {sortedTodaySubtasks.length > 0 ? (
                        sortedTodaySubtasks.map(item => (
                           <TodaySubtaskItem
                            key={item.subtask.id}
                            item={{ subtask: item.subtask, parentTaskTitle: item.parentTask.title }}
                            onToggleComplete={() => handleToggleTodaySubtaskComplete(item.subtask.id, item.parentTask.id)}
                            onRemove={() => handleUnsetSubtaskDueDate(item.subtask.id, item.parentTask.id)}
                            onDragStart={() => onTodayDragStart(item)}
                            onDragOver={onDragOver}
                            onDrop={() => onTodayDrop(item)}
                            isDragging={draggedTodayItem?.subtask.id === item.subtask.id}
                           />
                        ))
                    ) : (
                        <div className="text-center py-10 px-4">
                            <h2 className="text-2xl font-semibold text-gray-400 dark:text-gray-500">Nothing scheduled for today.</h2>
                            <p className="text-gray-500 dark:text-gray-600 mt-2">Go to the backlog and assign a due date to your sub-tasks.</p>
                        </div>
                    )}
                </>
            )}

            {view === 'stats' && <StatsView tasks={tasks} />}
          </div>
        </main>
      </div>
      {modalTask && <SubtaskModal task={modalTask} onClose={handleCloseModal} onUpdateTask={handleUpdateTask} onSetSubtaskDueDate={handleSetSubtaskDueDate} />}
    </div>
  );
};

export default App;