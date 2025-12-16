import React from 'react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid 
} from 'recharts';
import { WeeklyDataPoint, THEME } from '../types';

interface ChartsProps {
  weeklyData: WeeklyDataPoint[];
  completionRate: number;
  totalTasks: number;
  completedTasks: number;
  isDarkMode: boolean;
}

export const DashboardCharts: React.FC<ChartsProps> = ({ 
  weeklyData, 
  completionRate,
  totalTasks,
  completedTasks,
  isDarkMode
}) => {
  const theme = isDarkMode ? THEME.dark : THEME.light;

  const donutData = [
    { name: 'Completed', value: completedTasks },
    { name: 'Remaining', value: totalTasks - completedTasks }
  ];

  return (
    <div className="contents">
      {/* Bar Chart: Overall Progress */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-lg dark:shadow-slate-900/50 h-64 flex flex-col transition-colors duration-300">
        <h3 className="text-white font-bold bg-gradient-to-r from-emerald-500 to-teal-600 p-3 text-center -mx-4 -mt-4 mb-4 rounded-t-xl shadow-md">Overall Progress</h3>
        <div className="flex-1 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.grid} />
              <XAxis 
                dataKey="day" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: theme.text, fontSize: 12, fontWeight: 600, opacity: 0.7 }}
                dy={10}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fill: theme.text, fontSize: 12, opacity: 0.7 }}
              />
              <Tooltip 
                cursor={{ fill: isDarkMode ? '#334155' : '#F3F4F6' }}
                contentStyle={{ 
                  borderRadius: '8px', 
                  border: 'none', 
                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                  backgroundColor: theme.background,
                  color: theme.text
                }}
              />
              <Bar 
                dataKey="total" 
                fill={theme.barFill} 
                radius={[4, 4, 0, 0]} 
                barSize={20}
                stackId="a"
              />
              <Bar 
                dataKey="completed" 
                fill={theme.primary} 
                radius={[4, 4, 0, 0]} 
                barSize={20}
                stackId="a"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Donut Chart: Percentage */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-lg dark:shadow-slate-900/50 h-64 flex flex-col items-center justify-center relative transition-colors duration-300">
        <div className="h-48 w-full relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={donutData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                startAngle={90}
                endAngle={-270}
                dataKey="value"
                stroke="none"
              >
                <Cell fill={theme.primary} />
                <Cell fill={theme.pieFill} />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          {/* Center Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className={`text-4xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{Math.round(completionRate)}%</span>
            <span className={`text-xs uppercase font-bold tracking-wider mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>Weekly</span>
          </div>
        </div>
        <p className={`font-medium text-sm mt-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>
          {completedTasks} / {totalTasks} Completed
        </p>
      </div>
    </div>
  );
};

export const DayDonut: React.FC<{ percentage: number; isDarkMode: boolean }> = ({ percentage, isDarkMode }) => {
  const theme = isDarkMode ? THEME.dark : THEME.light;
  const data = [
    { value: percentage },
    { value: 100 - percentage }
  ];

  return (
    <div className="h-32 w-32 relative mx-auto my-4 transition-transform hover:scale-105 duration-300">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={55}
            startAngle={90}
            endAngle={-270}
            dataKey="value"
            stroke="none"
          >
            <Cell fill={theme.primary} />
            <Cell fill={theme.pieFill} />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-xl font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{Math.round(percentage)}%</span>
      </div>
    </div>
  );
};