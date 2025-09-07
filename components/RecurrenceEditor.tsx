import React, { useState, useEffect } from 'react';
import { RecurrenceRule } from '../types';

interface RecurrenceEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (rule: RecurrenceRule | undefined) => void;
  initialRule?: RecurrenceRule;
}

type DayOfWeek = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';
const ALL_DAYS: DayOfWeek[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const RecurrenceEditor: React.FC<RecurrenceEditorProps> = ({ isOpen, onClose, onSave, initialRule }) => {
  const [frequency, setFrequency] = useState<RecurrenceRule['frequency']>('weekly');
  const [interval, setInterval] = useState(1);
  const [daysOfWeek, setDaysOfWeek] = useState<Set<DayOfWeek>>(new Set(['mon']));

  useEffect(() => {
    if (isOpen) {
      setFrequency(initialRule?.frequency || 'weekly');
      setInterval(initialRule?.interval || 1);
      setDaysOfWeek(new Set(initialRule?.daysOfWeek || ['mon']));
    }
  }, [isOpen, initialRule]);

  if (!isOpen) return null;
  
  const handleDayToggle = (day: DayOfWeek) => {
    setDaysOfWeek(prev => {
        const newDays = new Set(prev);
        if (newDays.has(day)) {
            newDays.delete(day);
        } else {
            newDays.add(day);
        }
        return newDays;
    });
  };

  const handleSave = () => {
    if (interval < 1) {
        alert("Interval must be 1 or greater.");
        return;
    }
    const rule: RecurrenceRule = {
        frequency,
        interval,
    };
    if (frequency === 'weekly') {
        if (daysOfWeek.size === 0) {
            alert("Please select at least one day for weekly recurrence.");
            return;
        }
        rule.daysOfWeek = Array.from(daysOfWeek);
    }
    onSave(rule);
  };

  const handleRemove = () => {
    onSave(undefined);
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 animate-fade-in-down"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      style={{ animationDuration: '0.2s' }}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6 m-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Set Recurrence</h3>
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">Frequency</label>
                <div className="flex rounded-md shadow-sm">
                    <button type="button" onClick={() => setFrequency('daily')} className={`px-4 py-2 text-sm font-medium border border-gray-200 dark:border-gray-600 rounded-l-md flex-1 ${frequency === 'daily' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'}`}>Daily</button>
                    <button type="button" onClick={() => setFrequency('weekly')} className={`px-4 py-2 text-sm font-medium border-t border-b border-gray-200 dark:border-gray-600 rounded-r-md flex-1 ${frequency === 'weekly' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'}`}>Weekly</button>
                </div>
            </div>
            <div>
                <label htmlFor="interval" className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                    Repeat every
                </label>
                <div className="flex items-center gap-2">
                    <input
                        type="number"
                        id="interval"
                        min="1"
                        value={interval}
                        onChange={e => setInterval(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="w-20 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                     <span className="text-gray-600 dark:text-gray-300">{frequency === 'daily' ? 'day(s)' : 'week(s)'}</span>
                </div>
            </div>
            {frequency === 'weekly' && (
                <div>
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">Repeat on</label>
                    <div className="flex flex-wrap gap-1">
                        {ALL_DAYS.map(day => (
                            <button
                                key={day}
                                type="button"
                                onClick={() => handleDayToggle(day)}
                                className={`w-10 h-10 rounded-full font-medium text-sm transition-colors ${daysOfWeek.has(day) ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
                            >
                                {day.toUpperCase().substring(0,2)}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
        
        <div className="flex justify-between items-center mt-6">
           <button
            onClick={handleRemove}
            className="text-red-600 hover:text-red-700 dark:text-red-500 dark:hover:text-red-400 font-medium text-sm transition-colors"
          >
            Remove Recurrence
          </button>
          <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md transition-colors"
              >
                Save
              </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecurrenceEditor;
