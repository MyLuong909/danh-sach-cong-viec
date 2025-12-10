
export type TaskStatus = 'pending' | 'done';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  provider: 'credentials' | 'google' | 'github';
}

export interface Task {
  id: string;
  userId: string;
  text: string; // Tiêu đề
  description?: string; // Nội dung chi tiết
  deadline: string; // ISO string
  status: TaskStatus;
  finishedTime?: string | null; // ISO string or null
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  taskId: string;
  message: string;
  type: 'upcoming' | 'overdue';
  isRead: boolean;
  createdAt: string;
  emailSent: boolean;
}

export type SortOption = 'deadline-asc' | 'deadline-desc' | 'created-desc' | 'created-asc';
export type FilterOption = 'all' | 'pending' | 'done';
