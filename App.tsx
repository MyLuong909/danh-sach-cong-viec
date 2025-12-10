import React, { useState, useEffect, useMemo } from 'react';
import { User, Task, FilterOption, SortOption, Notification, TaskStatus } from './types';
import { storageService } from './services/storageService';
import { AuthScreen } from './components/AuthScreen';
import { TaskItem } from './components/TaskItem';
import { CreateTaskModal } from './components/CreateTaskModal';
import { ConfirmModal } from './components/ConfirmModal';
import { Button } from './components/Button';
import { NotificationBell } from './components/NotificationBell';
import { LogOut, Plus, Search, ListFilter, ArrowUpDown, LayoutList, Sun, Moon, Trash2 } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Theme State
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
        return localStorage.getItem('theme') || 'light';
    }
    return 'light';
  });
  
  // UI State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  
  // Filter/Sort State
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterOption>('all');
  const [sortBy, setSortBy] = useState<SortOption>('deadline-asc');

  // Apply Theme
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // Load user from session storage on mount
  useEffect(() => {
    const savedUser = sessionStorage.getItem('tm_active_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  // Load tasks and notifications when user changes
  useEffect(() => {
    if (user) {
      loadData();
    } else {
      setTasks([]);
      setNotifications([]);
    }
  }, [user]);

  // Check deadlines whenever tasks change
  useEffect(() => {
    if (user && tasks.length > 0) {
        checkDeadlines();
    }
  }, [tasks, user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [tasksData, notifsData] = await Promise.all([
        storageService.getTasks(user.id),
        storageService.getNotifications(user.id)
      ]);
      setTasks(tasksData);
      setNotifications(notifsData);
    } finally {
      setLoading(false);
    }
  };

  const checkDeadlines = async () => {
    if (!user) return;
    const now = new Date();
    const oneDay = 24 * 60 * 60 * 1000;
    
    let hasNewNotification = false;

    for (const task of tasks) {
        if (task.status === 'done') continue;
        
        const deadline = new Date(task.deadline);
        const diff = deadline.getTime() - now.getTime();
        
        let type: 'overdue' | 'upcoming' | null = null;
        let message = '';

        if (diff < 0) {
            type = 'overdue';
            message = `Công việc "${task.text}" đã quá hạn!`;
        } else if (diff < oneDay) {
            type = 'upcoming';
            message = `Công việc "${task.text}" sắp đến hạn (dưới 24h).`;
        }

        if (type) {
            // Check if we already notified for this specific state
            const alreadyNotified = notifications.some(n => n.taskId === task.id && n.type === type);
            if (!alreadyNotified) {
                const newNotification: Notification = {
                    id: crypto.randomUUID(),
                    userId: user.id,
                    taskId: task.id,
                    message: message,
                    type: type,
                    isRead: false,
                    createdAt: new Date().toISOString(),
                    emailSent: true
                };

                await storageService.addNotification(newNotification);
                // Simulate Email
                console.log(`[EMAIL MOCK] Sending email to ${user.email}: ${message}`);
                
                hasNewNotification = true;
            }
        }
    }

    if (hasNewNotification) {
        const updatedNotifs = await storageService.getNotifications(user.id);
        setNotifications(updatedNotifs);
    }
  };

  const handleLogin = (newUser: User) => {
    setUser(newUser);
    sessionStorage.setItem('tm_active_user', JSON.stringify(newUser));
  };

  const handleLogout = () => {
    setUser(null);
    sessionStorage.removeItem('tm_active_user');
  };

  const handleSaveTask = async (text: string, description: string, deadline: string, id?: string) => {
    if (!user) return;

    const newTask: Task = {
      id: id || crypto.randomUUID(),
      userId: user.id,
      text,
      description,
      deadline,
      status: id ? (tasks.find(t => t.id === id)?.status || 'pending') : 'pending',
      finishedTime: id ? (tasks.find(t => t.id === id)?.finishedTime) : undefined,
      createdAt: id ? (tasks.find(t => t.id === id)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
    };

    await storageService.saveTask(newTask);
    
    // Optimistic update
    setTasks(prev => {
      const idx = prev.findIndex(t => t.id === newTask.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = newTask;
        return copy;
      }
      return [...prev, newTask];
    });
  };

  const handleDelete = async (id: string) => {
    // Optimistic Update: Xóa trên UI ngay lập tức
    setTasks(prev => prev.filter(t => t.id !== id));
    
    // Sau đó gọi service để xóa trong storage
    await storageService.deleteTask(id);
  };

  // Mở modal xác nhận
  const handleDeleteAllClick = () => {
    if (tasks.length === 0) return;
    setIsDeleteConfirmOpen(true);
  };

  // Thực hiện xóa sau khi xác nhận
  const handleConfirmDeleteAll = async () => {
    if (!user) return;
    setIsDeleteConfirmOpen(false);
    
    // Xóa UI ngay
    setTasks([]);
    
    try {
        await storageService.deleteAllTasks(user.id);
    } catch (e) {
        loadData();
    }
  };

  const handleToggleStatus = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    const newStatus: TaskStatus = task.status === 'pending' ? 'done' : 'pending';
    const finishedTime = newStatus === 'done' ? new Date().toISOString() : null;

    const updatedTask: Task = { ...task, status: newStatus, finishedTime };
    await storageService.saveTask(updatedTask);
    
    setTasks(prev => prev.map(t => t.id === id ? updatedTask : t));
  };

  // Notification handlers
  const handleMarkRead = async (id: string) => {
      await storageService.markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const handleMarkAllRead = async () => {
      if(!user) return;
      await storageService.markAllNotificationsRead(user.id);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const filteredAndSortedTasks = useMemo(() => {
    let result = [...tasks];

    // Search
    if (searchQuery) {
      const lower = searchQuery.toLowerCase();
      result = result.filter(t => 
        t.text.toLowerCase().includes(lower) || 
        (t.description && t.description.toLowerCase().includes(lower))
      );
    }

    // Filter
    if (filter === 'pending') {
      result = result.filter(t => t.status === 'pending');
    } else if (filter === 'done') {
      result = result.filter(t => t.status === 'done');
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'deadline-asc':
          return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        case 'deadline-desc':
          return new Date(b.deadline).getTime() - new Date(a.deadline).getTime();
        case 'created-asc':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'created-desc':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        default:
          return 0;
      }
    });

    return result;
  }, [tasks, searchQuery, filter, sortBy]);

  // Derived stats
  const pendingCount = tasks.filter(t => t.status === 'pending').length;

  if (!user) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans transition-colors duration-200">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-20 border-b dark:border-gray-700 transition-colors duration-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 dark:bg-indigo-500 p-2 rounded-lg text-white">
              <LayoutList size={20} />
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight uppercase hidden sm:block">DANH SÁCH CÔNG VIỆC</h1>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight uppercase sm:hidden">DSCV</h1>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
            
            <button 
                onClick={toggleTheme}
                className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
            >
                {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>

            <NotificationBell 
                notifications={notifications} 
                onMarkRead={handleMarkRead}
                onMarkAllRead={handleMarkAllRead}
            />
            
            <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-1"></div>

            <div className="hidden sm:flex items-center gap-2">
              <img 
                src={user.avatar} 
                alt={user.name} 
                className="h-8 w-8 rounded-full border border-gray-200 dark:border-gray-600" 
              />
              <div className="text-sm">
                <p className="font-medium text-gray-700 dark:text-gray-200 max-w-[100px] truncate">{user.name}</p>
              </div>
            </div>
            
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/30">
              <LogOut size={18} />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Actions Bar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Công việc của bạn</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              Bạn đang có {pendingCount} công việc chưa hoàn thành.
            </p>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
             {tasks.length > 0 && (
                 <Button 
                    variant="danger"
                    onClick={handleDeleteAllClick}
                    icon={<Trash2 size={20} />}
                    className="flex-1 md:flex-none"
                  >
                    Xóa hết
                  </Button>
             )}
              <Button 
                onClick={() => { setEditingTask(null); setIsModalOpen(true); }}
                icon={<Plus size={20} />}
                className="flex-1 md:flex-none shadow-md"
              >
                Tạo mới
              </Button>
          </div>
        </div>

        {/* Controls: Search & Filter */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-6 space-y-4 md:space-y-0 md:flex md:items-center md:gap-4 transition-colors">
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Tìm kiếm công việc..."
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition duration-150 ease-in-out"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:flex-none">
                <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                    <ListFilter size={16} className="text-gray-500 dark:text-gray-400" />
                </div>
                <select 
                    className="block w-full pl-8 pr-8 py-2 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-lg border bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value as FilterOption)}
                >
                    <option value="all">Tất cả</option>
                    <option value="pending">Đang chờ</option>
                    <option value="done">Đã xong</option>
                </select>
            </div>

            <div className="relative flex-1 md:flex-none">
                <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                    <ArrowUpDown size={16} className="text-gray-500 dark:text-gray-400" />
                </div>
                <select 
                    className="block w-full pl-8 pr-8 py-2 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-lg border bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                >
                    <option value="deadline-asc">Hạn chót (Sớm nhất)</option>
                    <option value="deadline-desc">Hạn chót (Muộn nhất)</option>
                    <option value="created-desc">Ngày tạo (Mới nhất)</option>
                    <option value="created-asc">Ngày tạo (Cũ nhất)</option>
                </select>
            </div>
          </div>
        </div>

        {/* Task List */}
        {loading ? (
          <div className="text-center py-20">
             <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
             <p className="mt-2 text-gray-500 dark:text-gray-400">Đang tải danh sách công việc...</p>
          </div>
        ) : filteredAndSortedTasks.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 transition-colors">
            <LayoutList size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Không tìm thấy công việc</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {searchQuery ? 'Thử điều chỉnh tìm kiếm hoặc bộ lọc.' : 'Bắt đầu bằng cách tạo công việc mới.'}
            </p>
            {!searchQuery && (
              <div className="mt-6">
                <Button onClick={() => setIsModalOpen(true)}>Tạo mới</Button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAndSortedTasks.map(task => (
              <TaskItem 
                key={task.id} 
                task={task} 
                onToggle={handleToggleStatus}
                onEdit={(t) => { setEditingTask(t); setIsModalOpen(true); }}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </main>

      <CreateTaskModal 
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingTask(null); }}
        onSave={handleSaveTask}
        editingTask={editingTask}
      />

      <ConfirmModal 
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={handleConfirmDeleteAll}
        title="Bạn có chắc muốn xóa hết?"
        message="Hành động này sẽ xóa vĩnh viễn toàn bộ công việc trong danh sách của bạn và không thể khôi phục lại."
      />
    </div>
  );
};

export default App;
