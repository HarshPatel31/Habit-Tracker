export enum Category {
  HEALTH = 'Health',
  PRODUCTIVITY = 'Productivity',
  MINDFULNESS = 'Mindfulness',
  LEARNING = 'Learning',
  FITNESS = 'Fitness',
  OTHER = 'Other'
}

export interface Habit {
  id: string;
  title: string;
  category: Category;
  type: 'habit' | 'reminder';
  completedDates: string[]; // ISO Date strings "YYYY-MM-DD"
  createdAt: string;
  archivedAt?: string; // ISO Date strings "YYYY-MM-DD" - If set, habit is hidden from this date onwards
  excludedDates?: string[]; // Dates where this habit is skipped/removed specifically
}

export interface ChartDataPoint {
  name: string;
  value: number;
  fill?: string;
}

export interface WeeklyDataPoint {
  day: string; // "Sun", "Mon"
  fullDate: string; // ISO string
  completed: number;
  total: number;
}

export const THEME = {
  light: {
    primary: '#10b981', // Emerald 500
    secondary: '#f59e0b', // Amber 500
    background: '#ffffff',
    text: '#1e293b',
    grid: '#e2e8f0',
    barFill: '#d1fae5', // Emerald 100
    pieFill: '#ecfdf5', // Emerald 50
  },
  dark: {
    primary: '#34d399', // Emerald 400
    secondary: '#fbbf24', // Amber 400
    background: '#1e293b', // Slate 800
    text: '#f1f5f9', // Slate 100
    grid: '#334155', // Slate 700
    barFill: '#064e3b', // Emerald 900
    pieFill: '#0f172a', // Slate 900
  }
};