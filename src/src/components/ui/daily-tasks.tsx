/**
 * Daily Tasks Component — Logseq-style task management for Daily Notes
 * 
 * Features:
 * 1. Task states: TODO / DOING / DONE / CANCELLED
 * 2. Priority: P0 (urgent) / P1 (high) / P2 (normal)
 * 3. Scheduled/Deadline timestamps
 * 4. Local storage persistence per date
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  Circle, CheckCircle2, Loader2, Trash2, Clock, 
  AlertCircle, ChevronRight, Plus, Calendar, Flame
} from 'lucide-react';

// Task status enum
type TaskStatus = 'todo' | 'doing' | 'done' | 'cancelled';
type TaskPriority = 'p0' | 'p1' | 'p2';

// Task interface
interface Task {
  id: string;
  text: string;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: number;
  scheduledAt?: number;
  deadlineAt?: number;
}

// Storage key for tasks
const TASKS_STORAGE_KEY = 'clawkb-daily-tasks';

interface DailyTasksProps {
  date: string; // Format: YYYY-MM-DD
  onTaskClick?: (task: Task) => void;
}

export function DailyTasks({ date, onTaskClick }: DailyTasksProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskText, setNewTaskText] = useState('');
  const [addingTask, setAddingTask] = useState(false);
  const [filter, setFilter] = useState<TaskStatus | 'all'>('all');
  
  // Load tasks for this date
  useEffect(() => {
    const stored = localStorage.getItem(`${TASKS_STORAGE_KEY}-${date}`);
    if (stored) {
      try {
        setTasks(JSON.parse(stored));
      } catch {
        setTasks([]);
      }
    } else {
      setTasks([]);
    }
  }, [date]);
  
  // Save tasks whenever they change
  useEffect(() => {
    localStorage.setItem(`${TASKS_STORAGE_KEY}-${date}`, JSON.stringify(tasks));
  }, [tasks, date]);
  
  // Add new task
  const addTask = useCallback(() => {
    if (!newTaskText.trim()) return;
    const task: Task = {
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      text: newTaskText.trim(),
      status: 'todo',
      priority: 'p2',
      createdAt: Date.now(),
    };
    setTasks(prev => [task, ...prev]);
    setNewTaskText('');
    setAddingTask(false);
  }, [newTaskText]);
  
  // Toggle task status (TODO → DOING → DONE)
  const toggleStatus = useCallback((taskId: string) => {
    setTasks(prev => prev.map(task => {
      if (task.id !== taskId) return task;
      const nextStatus: Record<TaskStatus, TaskStatus> = {
        todo: 'doing',
        doing: 'done',
        done: 'todo',
        cancelled: 'todo',
      };
      return { ...task, status: nextStatus[task.status] };
    }));
  }, []);
  
  // Cancel task
  const cancelTask = useCallback((taskId: string) => {
    setTasks(prev => prev.map(task => 
      task.id === taskId ? { ...task, status: 'cancelled' as TaskStatus } : task
    ));
  }, []);
  
  // Delete task
  const deleteTask = useCallback((taskId: string) => {
    setTasks(prev => prev.filter(task => task.id !== taskId));
  }, []);
  
  // Cycle priority
  const cyclePriority = useCallback((taskId: string) => {
    setTasks(prev => prev.map(task => {
      if (task.id !== taskId) return task;
      const nextPriority: Record<TaskPriority, TaskPriority> = {
        p2: 'p1',
        p1: 'p0',
        p0: 'p2',
      };
      return { ...task, priority: nextPriority[task.priority] };
    }));
  }, []);

  // Set scheduled date
  const setScheduledDate = useCallback((taskId: string, date: string | null) => {
    setTasks(prev => prev.map(task => {
      if (task.id !== taskId) return task;
      if (!date) return { ...task, scheduledAt: undefined };
      const d = new Date(date);
      d.setHours(9, 0, 0, 0);
      return { ...task, scheduledAt: d.getTime() };
    }));
  }, []);

  // Set deadline date
  const setDeadlineDate = useCallback((taskId: string, date: string | null) => {
    setTasks(prev => prev.map(task => {
      if (task.id !== taskId) return task;
      if (!date) return { ...task, deadlineAt: undefined };
      const d = new Date(date);
      d.setHours(23, 59, 59, 999);
      return { ...task, deadlineAt: d.getTime() };
    }));
  }, []);

  // Format date for display
  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (d.toDateString() === now.toDateString()) return '今天';
    if (d.toDateString() === tomorrow.toDateString()) return '明天';
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  // Check if deadline is overdue
  const isOverdue = (deadlineAt?: number) => {
    if (!deadlineAt) return false;
    return deadlineAt < Date.now();
  };
  
  // Filtered tasks
  const filteredTasks = filter === 'all' 
    ? tasks 
    : tasks.filter(t => t.status === filter);
  
  // Count by status
  const counts = {
    todo: tasks.filter(t => t.status === 'todo').length,
    doing: tasks.filter(t => t.status === 'doing').length,
    done: tasks.filter(t => t.status === 'done').length,
    cancelled: tasks.filter(t => t.status === 'cancelled').length,
  };
  
  // Task card component
  const TaskCard = ({ task }: { task: Task }) => {
    const PriorityIcon = task.priority === 'p0' ? AlertCircle
      : task.priority === 'p1' ? Flame
      : Circle;
    const StatusIcon = task.status === 'done' ? CheckCircle2
      : task.status === 'doing' ? Loader2
      : task.status === 'cancelled' ? Circle
      : Circle;

    const statusStyles = {
      todo: 'border-border/50 hover:border-border',
      doing: 'border-primary/30 bg-primary/5',
      done: 'border-emerald-200/30 bg-emerald-200/5 opacity-60',
      cancelled: 'border-border/30 bg-muted/20 opacity-40',
    };

    const priorityColors = {
      p0: 'text-red-400',
      p1: 'text-amber-400',
      p2: 'text-muted-foreground/50',
    };

    const taskOverdue = task.status !== 'done' && task.status !== 'cancelled' && isOverdue(task.deadlineAt);

    // Quick date setters
    const getQuickDateStr = (daysFromNow: number) => {
      const d = new Date();
      d.setDate(d.getDate() + daysFromNow);
      return d.toISOString().split('T')[0];
    };

    return (
      <div
        className={`flex items-start gap-2.5 p-2.5 rounded-lg border transition-colors cursor-pointer ${statusStyles[task.status]}`}
        onClick={() => onTaskClick?.(task)}
      >
        {/* Status toggle button */}
        <button
          onClick={(e) => { e.stopPropagation(); toggleStatus(task.id); }}
          className={`mt-0.5 shrink-0 transition-colors ${
            task.status === 'done' ? 'text-emerald-400'
            : task.status === 'doing' ? 'text-amber-400'
            : 'text-muted-foreground/40 hover:text-muted-foreground'
          }`}
        >
          <StatusIcon className={`h-4 w-4 ${task.status === 'doing' ? 'animate-spin' : ''}`} />
        </button>

        {/* Task content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <span className={`text-sm leading-snug ${task.status === 'done' ? 'line-through text-muted-foreground/60' : ''}`}>
              {task.text}
            </span>
          </div>

          {/* Time blocks */}
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            {/* Scheduled indicator */}
            {task.scheduledAt ? (
              <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] ${
                task.status === 'done' ? 'bg-emerald-200/10 text-emerald-400/70' : 'bg-blue-200/15 text-blue-400'
              }`}>
                <Calendar className="h-2.5 w-2.5" />
                <span>{formatDate(task.scheduledAt)}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); setScheduledDate(task.id, null); }}
                  className="ml-0.5 hover:text-foreground/80"
                >
                  ×
                </button>
              </div>
            ) : (
              <div className="relative group/sched">
                <button
                  onClick={(e) => { e.stopPropagation(); setScheduledDate(task.id, getQuickDateStr(0)); }}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] text-muted-foreground hover:text-blue-400 hover:bg-blue-200/10 transition"
                  title="设置计划日期"
                >
                  <Calendar className="h-2.5 w-2.5" />
                  <span>计划</span>
                </button>
                {/* Quick date dropdown */}
                <div className="absolute left-0 top-full mt-1 hidden group-hover/sched:block z-10">
                  <div className="bg-popover border border-border rounded-lg shadow-lg p-1.5 min-w-[120px]">
                    <div className="text-[9px] text-muted-foreground mb-1 px-1">计划日期</div>
                    {[
                      { label: '今天', days: 0 },
                      { label: '明天', days: 1 },
                      { label: '后天', days: 2 },
                      { label: '本周', days: 7 - new Date().getDay() },
                    ].map(item => (
                      <button
                        key={item.label}
                        onClick={(e) => { e.stopPropagation(); setScheduledDate(task.id, getQuickDateStr(item.days)); }}
                        className="w-full text-left px-2 py-1 text-[11px] text-foreground/80 hover:bg-blue-200/15 hover:text-blue-300 rounded transition"
                      >
                        {item.label}
                      </button>
                    ))}
                    <div className="mt-1 pt-1 border-t border-border/50">
                      <input
                        type="date"
                        className="w-full bg-background/50 border border-border/50 rounded px-2 py-1 text-[10px] text-foreground/80 outline-none focus:border-blue-400/50"
                        onChange={(e) => { e.stopPropagation(); setScheduledDate(task.id, e.target.value || null); }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Deadline indicator */}
            {task.deadlineAt ? (
              <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] ${
                taskOverdue ? 'bg-red-200/20 text-red-400 animate-pulse' : 'bg-orange-200/15 text-orange-400'
              }`}>
                <AlertCircle className="h-2.5 w-2.5" />
                <span>{formatDate(task.deadlineAt)}</span>
                {taskOverdue && <span className="text-[8px]">逾期</span>}
                <button
                  onClick={(e) => { e.stopPropagation(); setDeadlineDate(task.id, null); }}
                  className="ml-0.5 hover:text-foreground/80"
                >
                  ×
                </button>
              </div>
            ) : (
              <div className="relative group/dead">
                <button
                  onClick={(e) => { e.stopPropagation(); setDeadlineDate(task.id, getQuickDateStr(1)); }}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] text-muted-foreground hover:text-orange-400 hover:bg-orange-200/10 transition"
                  title="设置截止日期"
                >
                  <AlertCircle className="h-2.5 w-2.5" />
                  <span>截止</span>
                </button>
                {/* Quick deadline dropdown */}
                <div className="absolute left-0 top-full mt-1 hidden group-hover/dead:block z-10">
                  <div className="bg-popover border border-border rounded-lg shadow-lg p-1.5 min-w-[120px]">
                    <div className="text-[9px] text-muted-foreground mb-1 px-1">截止日期</div>
                    {[
                      { label: '今天', days: 0 },
                      { label: '明天', days: 1 },
                      { label: '后天', days: 2 },
                      { label: '本周', days: 7 - new Date().getDay() },
                    ].map(item => (
                      <button
                        key={item.label}
                        onClick={(e) => { e.stopPropagation(); setDeadlineDate(task.id, getQuickDateStr(item.days)); }}
                        className="w-full text-left px-2 py-1 text-[11px] text-foreground/80 hover:bg-orange-200/15 hover:text-orange-300 rounded transition"
                      >
                        {item.label}
                      </button>
                    ))}
                    <div className="mt-1 pt-1 border-t border-border/50">
                      <input
                        type="date"
                        className="w-full bg-background/50 border border-border/50 rounded px-2 py-1 text-[10px] text-foreground/80 outline-none focus:border-orange-400/50"
                        onChange={(e) => { e.stopPropagation(); setDeadlineDate(task.id, e.target.value || null); }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Priority badge */}
        <button
          onClick={(e) => { e.stopPropagation(); cyclePriority(task.id); }}
          className={`shrink-0 ${priorityColors[task.priority]}`}
          title={`Priority: ${task.priority.toUpperCase()}`}
        >
          <PriorityIcon className="h-3.5 w-3.5" />
        </button>

        {/* Delete button */}
        <button
          onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }}
          className="shrink-0 text-muted-foreground/30 hover:text-red-400 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  };
  
  return (
    <div className="rounded-[1.25rem] border border-border bg-secondary p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          任务
        </span>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="text-amber-400">{counts.doing} 进行中</span>
          <span className="text-muted-foreground/50">{counts.todo} 待办</span>
        </div>
      </div>
      
      {/* Filter tabs */}
      <div className="flex gap-1 mb-3">
        {(['all', 'todo', 'doing', 'done'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-2 py-1 rounded-md text-[10px] transition-colors ${
              filter === status 
                ? 'bg-primary/15 text-primary' 
                : 'text-muted-foreground hover:text-foreground/80 hover:bg-muted/50'
            }`}
          >
            {status === 'all' ? '全部' 
              : status === 'todo' ? `待办${counts.todo > 0 ? ` (${counts.todo})` : ''}`
              : status === 'doing' ? `进行中${counts.doing > 0 ? ` (${counts.doing})` : ''}`
              : `已完成${counts.done > 0 ? ` (${counts.done})` : ''}`
            }
          </button>
        ))}
      </div>
      
      {/* Task list */}
      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-6 text-[11px] text-muted-foreground">
            {filter === 'all' 
              ? '暂无任务，添加一个开始吧'
              : filter === 'todo' ? '没有待办任务'
              : filter === 'doing' ? '没有进行中的任务'
              : '没有已完成的任务'
            }
          </div>
        ) : (
          filteredTasks.map(task => <TaskCard key={task.id} task={task} />)
        )}
      </div>
      
      {/* Add task input */}
      {addingTask ? (
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addTask();
              if (e.key === 'Escape') { setAddingTask(false); setNewTaskText(''); }
            }}
            placeholder="输入任务内容..."
            className="flex-1 bg-muted/30 border border-border rounded-lg px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground outline-none focus:border-amber-200/30"
            autoFocus
          />
          <button
            onClick={addTask}
            className="px-3 py-2 bg-primary/15 text-primary rounded-lg hover:bg-amber-200/30 transition"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAddingTask(true)}
          className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed border-border text-[11px] text-muted-foreground hover:text-foreground/80 hover:border-white/20 transition"
        >
          <Plus className="h-3 w-3" />
          添加任务
        </button>
      )}
    </div>
  );
}

// Quick insert for editor (generates markdown task syntax)
export function generateTaskMarkdown(text: string, status: TaskStatus = 'todo', priority?: TaskPriority): string {
  const statusPrefix = status === 'done' ? '[x]' 
    : status === 'doing' ? '[>]'
    : status === 'cancelled' ? '[>]'
    : '[ ]';
  
  const priorityPrefix = priority === 'p0' ? '[!]' 
    : priority === 'p1' ? '[!]'
    : '';
  
  return `${statusPrefix} ${priorityPrefix} ${text}`;
}

// Parse task from markdown
export function parseTaskMarkdown(line: string): { text: string; status: TaskStatus; priority: TaskPriority } | null {
  const todoMatch = line.match(/^([\-\*])\s*\[([ x>])\]\s*(.+)$/);
  if (!todoMatch) return null;
  
  const statusMap: Record<string, TaskStatus> = {
    ' ': 'todo',
    'x': 'done',
    '>': 'doing',
  };
  
  return {
    text: todoMatch[3],
    status: statusMap[todoMatch[2]] || 'todo',
    priority: 'p2',
  };
}
