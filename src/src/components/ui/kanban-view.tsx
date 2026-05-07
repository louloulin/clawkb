/**
 * Kanban Board View — Logseq-style task board
 *
 * Features:
 * 1. Drag-and-drop between columns (TODO/DOING/DONE)
 * 2. Task cards with priority colors
 * 3. Scheduled/Deadline indicators
 * 4. Add new tasks per column
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Circle, CheckCircle2, Loader2, Plus, Trash2,
  AlertCircle, Flame, Calendar, Clock, GripVertical, X
} from 'lucide-react';

// Task types
type TaskStatus = 'todo' | 'doing' | 'done' | 'cancelled';
type TaskPriority = 'p0' | 'p1' | 'p2';

interface KanbanTask {
  id: string;
  text: string;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: number;
  scheduledAt?: number;
  deadlineAt?: number;
}

const KANBAN_STORAGE_KEY = 'clawkb-kanban-tasks';

// Column definitions
const COLUMNS: Array<{ id: TaskStatus; label: string; icon: typeof Circle; color: string }> = [
  { id: 'todo', label: '待办', icon: Circle, color: 'border-slate-500/40' },
  { id: 'doing', label: '进行中', icon: Loader2, color: 'border-amber-400/40' },
  { id: 'done', label: '已完成', icon: CheckCircle2, color: 'border-emerald-400/40' },
];

interface KanbanViewProps {
  date?: string; // optional date filter
  onTaskClick?: (task: KanbanTask) => void;
}

export function KanbanView({ date, onTaskClick }: KanbanViewProps) {
  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [dragTask, setDragTask] = useState<KanbanTask | null>(null);
  const [showAddFor, setShowAddFor] = useState<TaskStatus | null>(null);
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('p2');
  const [newTaskScheduled, setNewTaskScheduled] = useState('');
  const [newTaskDeadline, setNewTaskDeadline] = useState('');
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [editScheduled, setEditScheduled] = useState('');
  const [editDeadline, setEditDeadline] = useState('');

  // Load tasks
  useEffect(() => {
    const stored = localStorage.getItem(KANBAN_STORAGE_KEY);
    if (stored) {
      try { setTasks(JSON.parse(stored)); } catch { setTasks([]); }
    } else {
      setTasks([]);
    }
  }, []);

  // Save tasks
  useEffect(() => {
    localStorage.setItem(KANBAN_STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  // Filter by date if provided
  const filteredTasks = date 
    ? tasks.filter(t => {
        const taskDate = new Date(t.createdAt).toISOString().split('T')[0];
        return taskDate === date;
      })
    : tasks;

  // Tasks by column
  const tasksByColumn = (status: TaskStatus) =>
    filteredTasks.filter(t => t.status === status);

  // Add task
  const addTask = useCallback((status: TaskStatus) => {
    if (!newTaskText.trim()) return;
    const task: KanbanTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      text: newTaskText.trim(),
      status,
      priority: newTaskPriority,
      createdAt: Date.now(),
      scheduledAt: newTaskScheduled ? new Date(newTaskScheduled).setHours(9, 0, 0, 0) : undefined,
      deadlineAt: newTaskDeadline ? new Date(newTaskDeadline).setHours(23, 59, 59, 999) : undefined,
    };
    setTasks(prev => [task, ...prev]);
    setNewTaskText('');
    setNewTaskPriority('p2');
    setNewTaskScheduled('');
    setNewTaskDeadline('');
    setShowAddFor(null);
  }, [newTaskText, newTaskPriority, newTaskScheduled, newTaskDeadline]);

  // Set task scheduled/deadline
  const setTaskScheduled = useCallback((taskId: string, date: string | null) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      if (!date) return { ...t, scheduledAt: undefined };
      return { ...t, scheduledAt: new Date(date).setHours(9, 0, 0, 0) };
    }));
  }, []);

  const setTaskDeadline = useCallback((taskId: string, date: string | null) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      if (!date) return { ...t, deadlineAt: undefined };
      return { ...t, deadlineAt: new Date(date).setHours(23, 59, 59, 999) };
    }));
  }, []);

  // Move task to a different column
  const moveTask = useCallback((taskId: string, newStatus: TaskStatus) => {
    setTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, status: newStatus } : t
    ));
  }, []);

  // Delete task
  const deleteTask = useCallback((taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
  }, []);

  // Cycle priority
  const cyclePriority = useCallback((taskId: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      const next: Record<TaskPriority, TaskPriority> = { p2: 'p1', p1: 'p0', p0: 'p2' };
      return { ...t, priority: next[t.priority] };
    }));
  }, []);

  // Drag handlers
  const handleDragStart = (task: KanbanTask) => setDragTask(task);
  const handleDragEnd = () => setDragTask(null);

  const handleDrop = (status: TaskStatus) => {
    if (dragTask && dragTask.status !== status) {
      moveTask(dragTask.id, status);
    }
    setDragTask(null);
  };

  // Priority badge
  const PriorityBadge = ({ priority, onClick }: { priority: TaskPriority; onClick: () => void }) => {
    const colors = { p0: 'text-red-400 bg-red-400/10', p1: 'text-amber-400 bg-amber-400/10', p2: 'text-muted-foreground bg-muted/30' };
    const labels = { p0: 'P0', p1: 'P1', p2: 'P2' };
    return (
      <button
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        className={`text-[9px] px-1.5 py-0.5 rounded font-medium cursor-pointer ${colors[priority]}`}
      >
        {labels[priority]}
      </button>
    );
  };

  // Count per column
  const getCount = (status: TaskStatus) => tasksByColumn(status).length;

  return (
    <div className="rounded-[1.25rem] border border-white/10 bg-black/20 p-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] uppercase tracking-[0.18em] text-slate-400 flex items-center gap-1.5">
          <GripVertical className="h-3.5 w-3.5" />
          看板
        </span>
        <span className="text-[10px] text-slate-500">
          {filteredTasks.length} 个任务
        </span>
      </div>

      {/* Kanban columns */}
      <div className="flex gap-3">
        {COLUMNS.map(col => {
          const Icon = col.icon;
          const columnTasks = tasksByColumn(col.id);

          return (
            <div
              key={col.id}
              className={`flex-1 min-w-0 border rounded-lg ${col.color} bg-white/[0.02] overflow-hidden`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(col.id)}
            >
              {/* Column header */}
              <div className="px-2.5 py-2 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Icon className={`h-3 w-3 ${col.id === 'doing' ? 'animate-spin text-amber-400' : col.id === 'done' ? 'text-emerald-400' : 'text-slate-500'}`} />
                  <span className="text-[10px] font-medium text-slate-300 uppercase tracking-wider">{col.label}</span>
                </div>
                <span className="text-[10px] text-slate-500 tabular-nums">{getCount(col.id)}</span>
              </div>

              {/* Column tasks */}
              <div className="p-1.5 space-y-1 min-h-[60px]">
                {columnTasks.map(task => {
                  const isOverdue = task.deadlineAt && task.deadlineAt < Date.now() && task.status !== 'done';
                  const formatDate = (ts: number) => new Date(ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });

                  return (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={() => handleDragStart(task)}
                    onDragEnd={handleDragEnd}
                    onClick={() => onTaskClick?.(task)}
                    className={`p-2 rounded-md border border-white/5 bg-white/[0.03] hover:bg-white/[0.06] cursor-grab active:cursor-grabbing transition-colors ${
                      dragTask?.id === task.id ? 'opacity-40' : ''
                    }`}
                  >
                    <div className="flex items-start gap-1.5">
                      <span className="text-[12px] leading-snug text-slate-300 flex-1 min-w-0">
                        {task.text}
                      </span>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <PriorityBadge
                          priority={task.priority}
                          onClick={() => cyclePriority(task.id)}
                        />
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }}
                          className="text-slate-600 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    {/* Scheduled/Deadline indicators */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5 pt-1.5 border-t border-white/5">
                      {task.scheduledAt ? (
                        <div className="flex items-center gap-1 text-[9px] text-blue-400">
                          <Calendar className="h-2.5 w-2.5" />
                          <span>{formatDate(task.scheduledAt)}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); setTaskScheduled(task.id, null); }}
                            className="text-slate-600 hover:text-white ml-0.5"
                          >×</button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
                            setTaskScheduled(task.id, tomorrow.toISOString().split('T')[0]);
                          }}
                          className="flex items-center gap-1 text-[9px] text-slate-600 hover:text-blue-400 transition"
                          title="设置计划日期"
                        >
                          <Calendar className="h-2.5 w-2.5" />
                          <span>计划</span>
                        </button>
                      )}
                      {task.deadlineAt ? (
                        <div className={`flex items-center gap-1 text-[9px] ${isOverdue ? 'text-red-400 animate-pulse' : 'text-orange-400'}`}>
                          <Clock className="h-2.5 w-2.5" />
                          <span>{formatDate(task.deadlineAt)}</span>
                          {isOverdue && <span className="text-[8px]">逾期</span>}
                          <button
                            onClick={(e) => { e.stopPropagation(); setTaskDeadline(task.id, null); }}
                            className="text-slate-600 hover:text-white ml-0.5"
                          >×</button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
                            setTaskDeadline(task.id, tomorrow.toISOString().split('T')[0]);
                          }}
                          className="flex items-center gap-1 text-[9px] text-slate-600 hover:text-orange-400 transition"
                          title="设置截止日期"
                        >
                          <Clock className="h-2.5 w-2.5" />
                          <span>截止</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
                })}

                {/* Empty state */}
                {columnTasks.length === 0 && (
                  <div className="text-center py-4 text-[10px] text-slate-600">
                    拖拽任务至此
                  </div>
                )}
              </div>

              {/* Add task button */}
              <div className="p-1.5 border-t border-white/5">
                {showAddFor === col.id ? (
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      value={newTaskText}
                      onChange={(e) => setNewTaskText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') addTask(col.id);
                        if (e.key === 'Escape') { setShowAddFor(null); setNewTaskText(''); setNewTaskScheduled(''); setNewTaskDeadline(''); }
                      }}
                      placeholder="任务内容..."
                      className="w-full bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-[11px] text-white placeholder:text-slate-500 outline-none focus:border-amber-200/30"
                      autoFocus
                    />
                    <div className="flex flex-wrap items-center gap-1">
                      <select
                        value={newTaskPriority}
                        onChange={(e) => setNewTaskPriority(e.target.value as TaskPriority)}
                        className="bg-white/5 border border-white/10 rounded-md px-1.5 py-1 text-[10px] text-slate-400 outline-none"
                      >
                        <option value="p2">P2</option>
                        <option value="p1">P1</option>
                        <option value="p0">P0</option>
                      </select>
                      <input
                        type="date"
                        value={newTaskScheduled}
                        onChange={(e) => setNewTaskScheduled(e.target.value)}
                        placeholder="计划"
                        className="bg-white/5 border border-white/10 rounded-md px-1.5 py-1 text-[10px] text-blue-400 outline-none"
                        title="计划日期"
                      />
                      <input
                        type="date"
                        value={newTaskDeadline}
                        onChange={(e) => setNewTaskDeadline(e.target.value)}
                        placeholder="截止"
                        className="bg-white/5 border border-white/10 rounded-md px-1.5 py-1 text-[10px] text-orange-400 outline-none"
                        title="截止日期"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => addTask(col.id)}
                        className="ml-auto px-2 py-1 bg-amber-200/20 text-amber-200 rounded-md text-[10px] hover:bg-amber-200/30 transition"
                      >
                        添加
                      </button>
                      <button
                        onClick={() => { setShowAddFor(null); setNewTaskText(''); setNewTaskScheduled(''); setNewTaskDeadline(''); }}
                        className="px-1.5 py-1 text-slate-500 hover:text-slate-300 rounded-md text-[10px] transition"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAddFor(col.id)}
                    className="w-full flex items-center justify-center gap-1 py-1.5 text-[10px] text-slate-500 hover:text-slate-300 transition"
                  >
                    <Plus className="h-3 w-3" />
                    添加
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
