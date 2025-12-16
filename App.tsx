import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  IconCheck, IconPlus, IconTrash, IconChevronLeft, IconChevronRight, IconSparkles, IconBell, IconSun, IconMoon 
} from './components/Icons';
import { DashboardCharts, DayDonut } from './components/Charts';
import { Habit, Category, WeeklyDataPoint } from './types';
import { getHabitAnalysis } from './services/geminiService';

// --- Helper Functions ---
const getISODate = (date: Date) => date.toISOString().split('T')[0];

const getWeekStart = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day; // Adjust to Sunday
  return new Date(d.setDate(diff));
};

const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

// --- Mock Initial Data ---
const INITIAL_HABITS: Habit[] = [];

const App = () => {
  // --- State ---
  const [darkMode, setDarkMode] = useState(() => {
    // Check local storage or system preference
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || 
             (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  const [habits, setHabits] = useState<Habit[]>(() => {
    const saved = localStorage.getItem('zenhabit_data');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((h: any) => ({ ...h, type: h.type || 'habit' }));
      } catch (e) {
        return INITIAL_HABITS;
      }
    }
    return INITIAL_HABITS;
  });
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showAddModal, setShowAddModal] = useState(false);
  const [newHabitTitle, setNewHabitTitle] = useState('');
  const [newHabitType, setNewHabitType] = useState<'habit' | 'reminder'>('habit');
  const [aiTips, setAiTips] = useState<string[]>([]);
  const [loadingAi, setLoadingAi] = useState(false);

  // Persistence
  useEffect(() => {
    localStorage.setItem('zenhabit_data', JSON.stringify(habits));
  }, [habits]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // --- Derived Data ---
  const weekStart = useMemo(() => getWeekStart(currentDate), [currentDate]);
  
  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(weekStart, i);
      return {
        dateObj: d,
        iso: getISODate(d),
        dayName: d.toLocaleDateString('en-US', { weekday: 'long' }),
        shortDay: d.toLocaleDateString('en-US', { weekday: 'short' }),
        formattedDate: d.toLocaleDateString('en-GB').replace(/\//g, '.')
      };
    });
  }, [weekStart]);

  const dailyHabits = useMemo(() => {
    const currentWeekStart = weekDates[0].iso;
    const currentWeekEnd = weekDates[6].iso;
    
    return habits.filter(h => {
      if (h.type !== 'habit') return false;
      
      // LOGIC: Show if not archived OR archived AFTER the start of this week
      const isVisible = !h.archivedAt || h.archivedAt > currentWeekStart;
      
      // LOGIC: Show if created ON or BEFORE the end of this week
      const isCreated = !h.createdAt || h.createdAt <= currentWeekEnd;
      
      return isVisible && isCreated;
    });
  }, [habits, weekDates]);

  const reminders = useMemo(() => {
    const currentWeekStart = weekDates[0].iso;
    return habits.filter(h => {
      if (h.type !== 'reminder') return false;
      return !h.archivedAt || h.archivedAt > currentWeekStart;
    });
  }, [habits, weekDates]);

  const weeklyDataPoints: WeeklyDataPoint[] = useMemo(() => {
    return weekDates.map(d => {
      // Only count habits that are NOT excluded for this specific day
      const activeHabitsForDay = dailyHabits.filter(h => !h.excludedDates?.includes(d.iso));
      
      const completedCount = activeHabitsForDay.reduce((acc, h) => acc + (h.completedDates.includes(d.iso) ? 1 : 0), 0);
      
      return {
        day: d.shortDay,
        fullDate: d.iso,
        completed: completedCount,
        total: activeHabitsForDay.length
      };
    });
  }, [weekDates, dailyHabits]);

  const totalWeeklyTasks = weeklyDataPoints.reduce((acc, day) => acc + day.total, 0);
  const completedWeeklyTasks = weeklyDataPoints.reduce((acc, day) => acc + day.completed, 0);
  const weeklyCompletionRate = totalWeeklyTasks > 0 ? (completedWeeklyTasks / totalWeeklyTasks) * 100 : 0;

  // --- Actions ---
  const toggleHabit = (id: string, dateIso: string) => {
    setHabits(prev => prev.map(h => {
      if (h.id !== id) return h;
      const isCompleted = h.completedDates.includes(dateIso);
      return {
        ...h,
        completedDates: isCompleted 
          ? h.completedDates.filter(d => d !== dateIso)
          : [...h.completedDates, dateIso]
      };
    }));
  };

  const toggleReminder = (id: string) => {
    const today = getISODate(new Date());
    setHabits(prev => prev.map(h => {
      if (h.id !== id) return h;
      const isDone = h.completedDates.length > 0;
      return {
        ...h,
        completedDates: isDone ? [] : [today]
      };
    }));
  };

  const addHabit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHabitTitle.trim()) return;
    const newHabit: Habit = {
      id: Date.now().toString(),
      title: newHabitTitle,
      category: Category.OTHER,
      type: newHabitType,
      completedDates: [],
      excludedDates: [],
      // Set creation date to the start of the currently viewed week so it appears immediately
      createdAt: weekDates[0].iso, 
    };
    setHabits([...habits, newHabit]);
    setNewHabitTitle('');
    setShowAddModal(false);
  };

  // If dateIso is provided, we only remove it for that day (add to excludedDates)
  // If dateIso is NOT provided, we act on the whole habit (Archive/Delete)
  const deleteHabit = (id: string, dateIso?: string) => {
    const habit = habits.find(h => h.id === id);
    if (!habit) return;

    if (dateIso) {
      // Delete from specific day only
      setHabits(prev => prev.map(h => {
        if (h.id !== id) return h;
        const currentExcluded = h.excludedDates || [];
        // Prevent duplicate entries
        if (currentExcluded.includes(dateIso)) return h;

        return {
          ...h,
          // Also uncheck it if it was checked, to prevent "ghost" completions
          completedDates: h.completedDates.filter(d => d !== dateIso),
          excludedDates: [...currentExcluded, dateIso]
        };
      }));
      return;
    }

    // --- Global Delete Logic (Existing) ---
    // Check if there is history before this week
    const currentWeekStartIso = weekDates[0].iso;
    const hasPriorHistory = habit.completedDates.some(date => date < currentWeekStartIso);

    if (hasPriorHistory) {
      // Soft delete: Archive it starting this week. 
      // It will disappear from this week's view but remain in history.
      setHabits(prev => prev.map(h => h.id === id ? { ...h, archivedAt: currentWeekStartIso } : h));
    } else {
      // Hard delete: No important history to preserve
      setHabits(prev => prev.filter(h => h.id !== id));
    }
  };

  const fetchInsights = useCallback(async () => {
    setLoadingAi(true);
    const tips = await getHabitAnalysis(dailyHabits);
    setAiTips(tips);
    setLoadingAi(false);
  }, [dailyHabits]);

  const handleWeekChange = (weeks: number) => {
    setCurrentDate(prev => addDays(prev, weeks * 7));
  };

  // --- UI Components ---

  return (
    <div className={`min-h-screen font-sans transition-colors duration-500 ease-in-out ${darkMode ? 'dark bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
      <div className="max-w-[1600px] mx-auto p-4 md:p-8">
        
        {/* Header Bar */}
        <div className="flex justify-between items-center mb-8">
           <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-emerald-500 to-teal-600 dark:from-emerald-400 dark:to-teal-300">
             ZenHabit
           </h1>
           <button 
             onClick={() => setDarkMode(!darkMode)}
             className="p-2 rounded-full bg-white dark:bg-slate-800 shadow-sm hover:shadow-md transition-all text-slate-500 dark:text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400 border border-slate-200 dark:border-slate-700"
           >
             {darkMode ? <IconSun className="w-6 h-6"/> : <IconMoon className="w-6 h-6"/>}
           </button>
        </div>

        {/* --- Top Grid --- */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-8">
          
          {/* Quote Card */}
          <div className="md:col-span-3 bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl dark:shadow-slate-900/50 flex flex-col justify-center items-center text-center relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-emerald-400 to-teal-500"></div>
            <h2 className="text-2xl font-bold text-slate-400 dark:text-slate-500 leading-snug">
              "Excellence is not an act, but a <span className="text-slate-800 dark:text-white underline decoration-emerald-500 decoration-4 underline-offset-4">habit</span>."
            </h2>
            <div className="mt-4 text-xs font-bold text-emerald-500 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0">
               Keep Going
            </div>
          </div>

          {/* Controls Column */}
          <div className="md:col-span-3 flex flex-col gap-6">
             {/* Week Nav */}
             <div className="flex bg-white dark:bg-slate-800 rounded-xl shadow-lg dark:shadow-slate-900/50 overflow-hidden border border-slate-100 dark:border-slate-700">
                <div className="bg-emerald-500 dark:bg-emerald-600 text-white font-bold px-4 flex items-center justify-center text-xs uppercase tracking-wide whitespace-nowrap">
                  Week Of
                </div>
                <div className="flex-1 flex items-center justify-between px-3 py-3">
                   <button onClick={() => handleWeekChange(-1)} className="hover:bg-slate-100 dark:hover:bg-slate-700 p-2 rounded-full transition-colors text-slate-600 dark:text-slate-300"><IconChevronLeft className="w-5 h-5"/></button>
                   <span className="font-bold text-lg text-slate-700 dark:text-white tracking-tight">{weekDates[0].formattedDate}</span>
                   <button onClick={() => handleWeekChange(1)} className="hover:bg-slate-100 dark:hover:bg-slate-700 p-2 rounded-full transition-colors text-slate-600 dark:text-slate-300"><IconChevronRight className="w-5 h-5"/></button>
                </div>
             </div>

             {/* Reminders Panel */}
             <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg dark:shadow-slate-900/50 flex-1 flex flex-col min-h-[200px] border border-slate-100 dark:border-slate-700 overflow-hidden">
                <div className="bg-gradient-to-r from-amber-400 to-orange-500 text-white px-5 py-3 font-bold flex items-center justify-between shadow-sm">
                  <span className="flex items-center gap-2 text-sm uppercase tracking-wide"><IconBell className="w-4 h-4" /> Reminders</span>
                  <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full backdrop-blur-sm">{reminders.filter(r => r.completedDates.length > 0).length}/{reminders.length}</span>
                </div>
                <div className="p-4 flex-1 overflow-y-auto custom-scrollbar space-y-3">
                  {reminders.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500">
                       <IconBell className="w-8 h-8 mb-2 opacity-20"/>
                       <p className="text-xs">No active reminders.</p>
                    </div>
                  )}
                  {reminders.map(rem => {
                    const isDone = rem.completedDates.length > 0;
                    return (
                      <div key={rem.id} className="flex items-center gap-3 group bg-slate-50 dark:bg-slate-700/50 p-2 rounded-lg transition-colors hover:bg-slate-100 dark:hover:bg-slate-700">
                        <button 
                          type="button"
                          onClick={() => toggleReminder(rem.id)}
                          className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all duration-300 flex-shrink-0 ${isDone ? 'bg-amber-400 border-amber-400 scale-90' : 'border-slate-300 dark:border-slate-500 hover:border-amber-400 dark:hover:border-amber-400'}`}
                        >
                           {isDone && <IconCheck className="w-4 h-4 text-white" />}
                        </button>
                        <span className={`text-sm font-medium flex-1 transition-colors ${isDone ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-200'}`}>{rem.title}</span>
                        <button 
                          type="button"
                          onClick={(e) => { e.stopPropagation(); deleteHabit(rem.id); }}
                          onMouseDown={(e) => e.stopPropagation()}
                          className="text-slate-400 hover:text-red-500 p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <IconTrash className="w-4 h-4"/>
                        </button>
                      </div>
                    );
                  })}
                </div>
             </div>

             {/* Action Buttons */}
             <div className="flex gap-4">
               <button 
                  type="button"
                  onClick={() => { setNewHabitType('habit'); setShowAddModal(true); }}
                  className="flex-1 bg-white dark:bg-slate-800 border-2 border-dashed border-emerald-400 dark:border-emerald-600 text-emerald-500 dark:text-emerald-400 font-bold py-3 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all duration-300 flex items-center justify-center gap-2 text-sm shadow-sm hover:shadow-md hover:-translate-y-0.5"
               >
                 <IconPlus className="w-5 h-5"/> <span>New Task</span>
               </button>
               <button
                 type="button"
                 onClick={fetchInsights}
                 className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white p-3 rounded-xl shadow-lg hover:shadow-indigo-500/30 hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center"
                 title="Get AI Insights"
               >
                  <IconSparkles className={`w-6 h-6 ${loadingAi ? 'animate-spin' : ''}`}/>
               </button>
             </div>
          </div>

          {/* Analytics Column */}
          <div className="md:col-span-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <DashboardCharts 
                 weeklyData={weeklyDataPoints} 
                 completionRate={weeklyCompletionRate}
                 totalTasks={totalWeeklyTasks}
                 completedTasks={completedWeeklyTasks}
                 isDarkMode={darkMode}
              />
              
              {/* Matrix Table */}
              <div className="bg-white dark:bg-slate-800 p-0 rounded-xl shadow-xl dark:shadow-slate-900/50 md:col-span-2 lg:col-span-1 lg:col-start-2 lg:row-start-1 h-[270px] flex flex-col overflow-hidden border border-slate-100 dark:border-slate-700">
                 <div className="flex items-center justify-between bg-gradient-to-r from-emerald-500 to-teal-500 p-3">
                    <h3 className="text-white font-bold text-center flex-1 text-sm uppercase tracking-wide">Habit Matrix</h3>
                    <button onClick={() => { setNewHabitType('habit'); setShowAddModal(true); }} className="text-white/80 hover:text-white hover:bg-white/20 p-1.5 rounded-lg transition-colors"><IconPlus className="w-4 h-4"/></button>
                 </div>
                 
                 <div className="overflow-x-auto overflow-y-auto custom-scrollbar flex-1 p-3">
                   <table className="w-full text-xs">
                     <thead>
                       <tr>
                         <th className="text-left py-2 text-emerald-600 dark:text-emerald-400 font-bold min-w-[80px]">Habit</th>
                         {weekDates.map(d => (
                           <th key={d.iso} className="text-center w-6 text-slate-400 dark:text-slate-500 font-semibold">{d.shortDay.charAt(0)}</th>
                         ))}
                         <th className="w-6"></th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                       {dailyHabits.map(habit => {
                         return (
                           <tr key={habit.id} className="group hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                              <td className="py-2.5 font-medium truncate max-w-[100px] text-slate-700 dark:text-slate-300">{habit.title}</td>
                              {weekDates.map(d => {
                                const isExcluded = habit.excludedDates?.includes(d.iso);
                                return (
                                  <td key={d.iso} className="text-center">
                                    {isExcluded ? (
                                      <div className="w-3 h-3 mx-auto flex items-center justify-center">
                                        <div className="w-1 h-0.5 bg-slate-300 dark:bg-slate-600 rounded-full"></div>
                                      </div>
                                    ) : (
                                      <div className={`w-3 h-3 rounded-sm mx-auto transition-all duration-300 ${habit.completedDates.includes(d.iso) ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                                    )}
                                  </td>
                                )
                              })}
                              <td className="text-center pl-1">
                                 <button 
                                   type="button"
                                   onClick={(e) => { e.stopPropagation(); deleteHabit(habit.id); }}
                                   onMouseDown={(e) => e.stopPropagation()}
                                   className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1"
                                 >
                                   <IconTrash className="w-3 h-3" />
                                 </button>
                              </td>
                           </tr>
                         );
                       })}
                     </tbody>
                   </table>
                 </div>
              </div>
          </div>
        </div>

        {/* AI Insight Box */}
        {aiTips.length > 0 && (
          <div className="mb-8 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-100 dark:border-indigo-800/50 p-6 rounded-2xl shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
             <h4 className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-2 mb-3 text-lg">
               <IconSparkles className="w-5 h-5"/> Your Insight Coach
             </h4>
             <ul className="grid grid-cols-1 md:grid-cols-3 gap-4">
               {aiTips.map((tip, i) => (
                 <li key={i} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm text-sm text-slate-600 dark:text-slate-300 leading-relaxed border border-indigo-50 dark:border-slate-700">
                   {tip}
                 </li>
               ))}
             </ul>
          </div>
        )}

        {/* --- Bottom Row: Daily Columns --- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {weekDates.map((dayData, index) => {
            const isToday = dayData.iso === getISODate(new Date());
            
            // Filter habits specifically for this day (checking excludedDates)
            const activeHabitsForDay = dailyHabits.filter(h => !h.excludedDates?.includes(dayData.iso));
            
            const dayCompletedCount = activeHabitsForDay.filter(h => h.completedDates.includes(dayData.iso)).length;
            const dayTotalCount = activeHabitsForDay.length;
            const dayPercentage = dayTotalCount > 0 ? (dayCompletedCount / dayTotalCount) * 100 : 0;
            const notCompletedCount = dayTotalCount - dayCompletedCount;

            return (
              <div key={dayData.iso} className={`bg-white dark:bg-slate-800 rounded-2xl shadow-lg dark:shadow-slate-900/30 flex flex-col min-h-[500px] border transition-all duration-300 hover:shadow-xl hover:-translate-y-1 overflow-hidden group ${isToday ? 'border-emerald-400 ring-2 ring-emerald-400/20 dark:border-emerald-500' : 'border-slate-100 dark:border-slate-700'}`}>
                {/* Column Header */}
                <div className={`p-4 text-center border-b border-slate-100 dark:border-slate-700 ${isToday ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''}`}>
                  <div className={`text-lg font-bold ${isToday ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200'}`}>{dayData.dayName}</div>
                  <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 mt-1">{dayData.formattedDate}</div>
                </div>

                {/* Column Body */}
                <div className="flex-1 p-3 flex flex-col bg-white dark:bg-slate-800">
                   <DayDonut percentage={dayPercentage} isDarkMode={darkMode} />

                   <div className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 text-center mb-3 mt-1">Tasks</div>
                   
                   <div className="space-y-2 flex-1 overflow-y-auto custom-scrollbar px-1">
                      {activeHabitsForDay.map(habit => {
                        const isDone = habit.completedDates.includes(dayData.iso);
                        return (
                          <div 
                            key={habit.id} 
                            onClick={() => toggleHabit(habit.id, dayData.iso)}
                            className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-300 group/item relative border ${isDone ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-transparent opacity-70' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-emerald-200 dark:hover:border-emerald-700 shadow-sm'}`}
                          >
                            <div className={`w-5 h-5 flex-shrink-0 rounded-md border-2 flex items-center justify-center transition-all duration-300 ${isDone ? 'bg-emerald-500 border-emerald-500 scale-110' : 'border-slate-300 dark:border-slate-600 bg-transparent group-hover/item:border-emerald-400'}`}>
                               {isDone && <IconCheck className="w-3.5 h-3.5 text-white stroke-[3px]" />}
                            </div>
                            <span className={`text-xs font-semibold leading-tight flex-1 transition-colors ${isDone ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-200'}`}>
                              {habit.title}
                            </span>
                            <button 
                               type="button"
                               onClick={(e) => { 
                                 e.stopPropagation(); 
                                 deleteHabit(habit.id, dayData.iso); 
                               }}
                               onMouseDown={(e) => e.stopPropagation()}
                               className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-red-500 opacity-0 group-hover/item:opacity-100 transition-all p-1.5 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 bg-white dark:bg-slate-800 shadow-sm"
                            >
                               <IconTrash className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                   </div>
                </div>

                {/* Column Footer */}
                <div className="mt-auto border-t border-slate-100 dark:border-slate-700">
                  <div className="flex justify-between items-center px-4 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/10">
                    <span>Done</span>
                    <span>{dayCompletedCount}</span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800">
                    <span>To Do</span>
                    <span>{notCompletedCount}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add Habit Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-800 w-full max-w-sm p-6 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 transform scale-100 animate-in zoom-in-95 duration-200">
              <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-6 bg-clip-text text-transparent bg-gradient-to-r from-emerald-500 to-teal-500 w-fit">Create Task</h3>
              <form onSubmit={addHabit}>
                <div className="mb-6">
                   <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Category</label>
                   <div className="grid grid-cols-2 gap-3">
                     <button 
                       type="button" 
                       onClick={() => setNewHabitType('habit')}
                       className={`py-3 px-4 text-sm font-bold rounded-xl border-2 transition-all duration-200 ${newHabitType === 'habit' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-500 hover:border-emerald-300'}`}
                     >
                       Regular Habit
                     </button>
                     <button 
                       type="button" 
                       onClick={() => setNewHabitType('reminder')}
                       className={`py-3 px-4 text-sm font-bold rounded-xl border-2 transition-all duration-200 ${newHabitType === 'reminder' ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-500 text-amber-600 dark:text-amber-400 shadow-sm' : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-500 hover:border-amber-300'}`}
                     >
                       One-off Reminder
                     </button>
                   </div>
                </div>

                <div className="mb-8">
                   <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Title</label>
                   <input 
                      type="text" 
                      autoFocus
                      placeholder={newHabitType === 'habit' ? "e.g. Morning Meditation" : "e.g. Buy Groceries"}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl focus:border-emerald-500 dark:focus:border-emerald-500 focus:ring-0 outline-none transition-colors text-slate-800 dark:text-white placeholder-slate-400"
                      value={newHabitTitle}
                      onChange={(e) => setNewHabitTitle(e.target.value)}
                    />
                </div>

                <div className="flex gap-3 justify-end">
                  <button 
                    type="button" 
                    onClick={() => setShowAddModal(false)}
                    className="px-5 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={!newHabitTitle.trim()}
                    className={`px-8 py-2.5 text-white text-sm font-bold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 ${newHabitType === 'habit' ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 shadow-emerald-500/30' : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 shadow-amber-500/30'}`}
                  >
                    Create
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default App;