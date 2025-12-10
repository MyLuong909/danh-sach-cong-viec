import { Task, User, Notification } from '../types';

const TASKS_STORAGE_KEY = 'tm_tasks_db_v1';
const USERS_STORAGE_KEY = 'tm_users_db_v1';
const NOTIFICATIONS_STORAGE_KEY = 'tm_notifications_db_v1';

// Simulate a database delay for realism
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: Safely parse users from local storage
const getSafeUsers = (): any[] => {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('LocalStorage data corrupted, resetting users list.');
    return [];
  }
};

export const storageService = {
  // --- Tasks ---
  getTasks: async (userId: string): Promise<Task[]> => {
    await delay(200);
    try {
        const raw = localStorage.getItem(TASKS_STORAGE_KEY);
        const allTasks: Task[] = raw ? JSON.parse(raw) : [];
        return Array.isArray(allTasks) ? allTasks.filter(t => t.userId === userId) : [];
    } catch {
        return [];
    }
  },

  saveTask: async (task: Task): Promise<Task> => {
    await delay(150);
    let allTasks: Task[] = [];
    try {
        const raw = localStorage.getItem(TASKS_STORAGE_KEY);
        allTasks = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(allTasks)) allTasks = [];
    } catch {
        allTasks = [];
    }
    
    const existingIndex = allTasks.findIndex(t => t.id === task.id);
    if (existingIndex >= 0) {
      allTasks[existingIndex] = task;
    } else {
      allTasks.push(task);
    }
    
    localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(allTasks));
    return task;
  },

  deleteTask: async (taskId: string): Promise<void> => {
    await delay(100);
    try {
        const raw = localStorage.getItem(TASKS_STORAGE_KEY);
        let allTasks: Task[] = raw ? JSON.parse(raw) : [];
        if (Array.isArray(allTasks)) {
            allTasks = allTasks.filter(t => t.id !== taskId);
            localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(allTasks));
        }
    } catch (e) {
        console.error("Error deleting task", e);
    }
  },

  deleteAllTasks: async (userId: string): Promise<void> => {
    await delay(300);
    try {
        const raw = localStorage.getItem(TASKS_STORAGE_KEY);
        let allTasks: Task[] = raw ? JSON.parse(raw) : [];
        if (Array.isArray(allTasks)) {
            // Chỉ giữ lại task của user KHÁC
            allTasks = allTasks.filter(t => t.userId !== userId);
            localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(allTasks));
        }
    } catch (e) {
        console.error("Error deleting all tasks", e);
    }
  },

  // --- Notifications ---
  getNotifications: async (userId: string): Promise<Notification[]> => {
    try {
        const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
        const all: Notification[] = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(all)) return [];
        return all.filter(n => n.userId === userId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch {
        return [];
    }
  },

  addNotification: async (notification: Notification): Promise<void> => {
    try {
        const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
        const all: Notification[] = raw ? JSON.parse(raw) : [];
        const safeAll = Array.isArray(all) ? all : [];
        
        // Avoid duplicates for same task and type
        const exists = safeAll.find(n => n.taskId === notification.taskId && n.type === notification.type && n.userId === notification.userId);
        if (!exists) {
            safeAll.push(notification);
            localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(safeAll));
        }
    } catch (e) {
        console.error("Error adding notification", e);
    }
  },

  markNotificationRead: async (notificationId: string): Promise<void> => {
    try {
        const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
        let all: Notification[] = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(all)) return;

        const idx = all.findIndex(n => n.id === notificationId);
        if (idx >= 0) {
            all[idx].isRead = true;
            localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(all));
        }
    } catch (e) { console.error(e); }
  },
  
  markAllNotificationsRead: async (userId: string): Promise<void> => {
    try {
        const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
        let all: Notification[] = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(all)) return;

        all = all.map(n => n.userId === userId ? { ...n, isRead: true } : n);
        localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(all));
    } catch (e) { console.error(e); }
  },

  // --- Auth Service ---
  register: async (username: string, password: string): Promise<User> => {
    await delay(600);
    
    // Sử dụng hàm an toàn để lấy danh sách users
    const users = getSafeUsers();

    if (users.find((u: any) => u.username === username)) {
      throw new Error('Tên đăng nhập đã tồn tại');
    }

    const newUser = {
      id: `user_cred_${Date.now()}`,
      username,
      password, // Lưu ý: Trong thực tế cần mã hóa mật khẩu
      name: username,
      email: `${username}@example.com`,
      avatar: `https://ui-avatars.com/api/?name=${username}&background=random&color=fff&background=6366f1`,
      provider: 'credentials'
    };

    users.push(newUser);
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));

    return {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      avatar: newUser.avatar,
      provider: 'credentials'
    };
  },

  login: async (provider: string, credentials?: {username: string, password?: string}): Promise<User> => {
    await delay(600); // Simulate network request
    
    let user: User;

    if (provider === 'google') {
      user = {
        id: 'user_google_123',
        name: 'Alex Google',
        email: 'alex@gmail.com',
        avatar: 'https://picsum.photos/seed/google/200',
        provider: 'google'
      };
    } else if (provider === 'github') {
      user = {
        id: 'user_github_456',
        name: 'Dev Github',
        email: 'dev@github.com',
        avatar: 'https://picsum.photos/seed/github/200',
        provider: 'github'
      };
    } else {
      // Credentials login
      const users = getSafeUsers();
      
      const found = users.find((u: any) => u.username === credentials?.username && u.password === credentials?.password);
      
      if (!found) {
          throw new Error('Tên đăng nhập hoặc mật khẩu không đúng');
      }

      user = {
        id: found.id,
        name: found.name,
        email: found.email,
        avatar: found.avatar,
        provider: 'credentials'
      };
    }
    
    return user;
  }
};
