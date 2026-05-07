/**
 * Inline Database — Notion-style inline database
 *
 * Features:
 * 1. Property types: text, number, select, date, checkbox
 * 2. Table view with sortable columns
 * 3. Row add/edit/delete
 * 4. View switching (Table/Kanban/Gallery)
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Database, Plus, Trash2, ChevronDown, ChevronRight,
  CheckSquare, Square, Calendar, Hash, Type,
  MoreHorizontal, GripVertical, ArrowUpDown, X, Edit3, Check
} from 'lucide-react';

// Property types
type PropertyType = 'text' | 'number' | 'select' | 'date' | 'checkbox' | 'url';

interface SelectOption {
  id: string;
  label: string;
  color: string;
}

interface Property {
  id: string;
  name: string;
  type: PropertyType;
  options?: SelectOption[]; // for select type
}

interface DatabaseRow {
  id: string;
  cells: Record<string, string | number | boolean | null>;
  createdAt: number;
}

interface InlineDatabaseProps {
  initialName?: string;
  onSave?: (data: { name: string; properties: Property[]; rows: DatabaseRow[] }) => void;
  storageKey?: string;
}

// Default properties
const DEFAULT_PROPERTIES: Property[] = [
  { id: 'title', name: '标题', type: 'text' },
  { id: 'status', name: '状态', type: 'select', options: [
    { id: 'todo', label: '待办', color: 'slate' },
    { id: 'doing', label: '进行中', color: 'amber' },
    { id: 'done', label: '已完成', color: 'emerald' },
  ]},
  { id: 'priority', name: '优先级', type: 'select', options: [
    { id: 'high', label: '高', color: 'red' },
    { id: 'medium', label: '中', color: 'amber' },
    { id: 'low', label: '低', color: 'slate' },
  ]},
  { id: 'due_date', name: '截止日期', type: 'date' },
];

const STORAGE_KEY = 'clawkb-inline-databases';

export function InlineDatabase({ initialName = '新数据库', onSave, storageKey }: InlineDatabaseProps) {
  const [name, setName] = useState(initialName);
  const [editingName, setEditingName] = useState(false);
  const [properties, setProperties] = useState<Property[]>(DEFAULT_PROPERTIES);
  const [rows, setRows] = useState<DatabaseRow[]>([]);
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [addingRow, setAddingRow] = useState(false);
  const [newRowValues, setNewRowValues] = useState<Record<string, string>>({});
  const [editingCell, setEditingCell] = useState<{ rowId: string; propertyId: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [collapsed, setCollapsed] = useState(false);

  // Load from storage
  useEffect(() => {
    if (storageKey) {
      const stored = localStorage.getItem(`${STORAGE_KEY}-${storageKey}`);
      if (stored) {
        try {
          const data = JSON.parse(stored);
          setName(data.name || initialName);
          setProperties(data.properties || DEFAULT_PROPERTIES);
          setRows(data.rows || []);
        } catch { /* ignore */ }
      }
    }
  }, [storageKey, initialName]);

  // Save to storage
  useEffect(() => {
    if (storageKey) {
      const data = { name, properties, rows };
      localStorage.setItem(`${STORAGE_KEY}-${storageKey}`, JSON.stringify(data));
      onSave?.(data);
    }
  }, [name, properties, rows, storageKey, onSave]);

  // Get property icon
  const getPropertyIcon = (type: PropertyType) => {
    switch (type) {
      case 'text': return <Type className="h-3 w-3" />;
      case 'number': return <Hash className="h-3 w-3" />;
      case 'select': return <ChevronDown className="h-3 w-3" />;
      case 'date': return <Calendar className="h-3 w-3" />;
      case 'checkbox': return <CheckSquare className="h-3 w-3" />;
      case 'url': return <Database className="h-3 w-3" />;
      default: return <Type className="h-3 w-3" />;
    }
  };

  // Get select option color
  const getSelectColor = (color: string) => {
    const colors: Record<string, string> = {
      slate: 'bg-slate-500/20 text-slate-400',
      amber: 'bg-amber-500/20 text-amber-400',
      emerald: 'bg-emerald-500/20 text-emerald-400',
      red: 'bg-red-500/20 text-red-400',
      blue: 'bg-blue-500/20 text-blue-400',
    };
    return colors[color] || colors.slate;
  };

  // Add new row
  const addRow = useCallback(() => {
    const newRow: DatabaseRow = {
      id: `row_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      cells: {},
      createdAt: Date.now(),
    };
    // Initialize empty cells
    properties.forEach(p => {
      if (p.type === 'checkbox') newRow.cells[p.id] = false;
      else newRow.cells[p.id] = '';
    });
    setRows(prev => [newRow, ...prev]);
    setAddingRow(false);
    setNewRowValues({});
  }, [properties]);

  // Update cell
  const updateCell = useCallback((rowId: string, propertyId: string, value: string | boolean) => {
    setRows(prev => prev.map(row =>
      row.id === rowId ? { ...row, cells: { ...row.cells, [propertyId]: value } } : row
    ));
  }, []);

  // Delete row
  const deleteRow = useCallback((rowId: string) => {
    setRows(prev => prev.filter(r => r.id !== rowId));
  }, []);

  // Sort rows
  const sortedRows = [...rows].sort((a, b) => {
    if (!sortColumn) return 0;
    const aVal = a.cells[sortColumn] ?? '';
    const bVal = b.cells[sortColumn] ?? '';
    const cmp = String(aVal).localeCompare(String(bVal));
    return sortDirection === 'asc' ? cmp : -cmp;
  });

  // Toggle sort
  const toggleSort = (columnId: string) => {
    if (sortColumn === columnId) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnId);
      setSortDirection('asc');
    }
  };

  // Render cell content
  const renderCell = (row: DatabaseRow, property: Property, isEditing: boolean) => {
    const value = row.cells[property.id];

    if (isEditing) {
      if (property.type === 'checkbox') {
        return (
          <button
            onClick={() => {
              updateCell(row.id, property.id, !value);
              setEditingCell(null);
            }}
            className="flex items-center justify-center"
          >
            {value ? <CheckSquare className="h-4 w-4 text-emerald-400" /> : <Square className="h-4 w-4 text-slate-500" />}
          </button>
        );
      }
      if (property.type === 'select' && property.options) {
        return (
          <select
            value={String(value || '')}
            onChange={(e) => {
              updateCell(row.id, property.id, e.target.value);
              setEditingCell(null);
            }}
            className="w-full bg-transparent border-none outline-none text-[12px]"
            autoFocus
            onBlur={() => setEditingCell(null)}
          >
            <option value="">选择...</option>
            {property.options.map(opt => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
        );
      }
      if (property.type === 'date') {
        return (
          <input
            type="date"
            value={String(value || '')}
            onChange={(e) => {
              updateCell(row.id, property.id, e.target.value);
              setEditingCell(null);
            }}
            className="w-full bg-transparent border-none outline-none text-[12px]"
            autoFocus
            onBlur={() => setEditingCell(null)}
          />
        );
      }
      return (
        <input
          type={property.type === 'number' ? 'number' : 'text'}
          value={String(value || '')}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => {
            updateCell(row.id, property.id, property.type === 'number' ? Number(editValue) : editValue);
            setEditingCell(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              updateCell(row.id, property.id, property.type === 'number' ? Number(editValue) : editValue);
              setEditingCell(null);
            }
            if (e.key === 'Escape') setEditingCell(null);
          }}
          className="w-full bg-transparent border-none outline-none text-[12px]"
          autoFocus
        />
      );
    }

    // Display mode
    if (property.type === 'checkbox') {
      return (
        <button
          onClick={() => updateCell(row.id, property.id, !value)}
          className="flex items-center justify-center"
        >
          {value ? <CheckSquare className="h-4 w-4 text-emerald-400" /> : <Square className="h-4 w-4 text-slate-500" />}
        </button>
      );
    }
    if (property.type === 'select' && property.options) {
      const option = property.options.find(o => o.id === value);
      if (!option) return <span className="text-slate-600">—</span>;
      return (
        <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] ${getSelectColor(option.color)}`}>
          {option.label}
        </span>
      );
    }
    if (property.type === 'date' && value) {
      const date = new Date(String(value));
      return (
        <span className="text-[12px] text-slate-400">
          {date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
        </span>
      );
    }
    if (!value && value !== 0) return <span className="text-slate-600">—</span>;
    return <span className="text-[12px] text-slate-300 truncate">{String(value)}</span>;
  };

  // Kanban view grouping
  const kanbanGroup = (propertyId: string) => {
    const prop = properties.find(p => p.id === propertyId);
    if (!prop || prop.type !== 'select' || !prop.options) return null;
    return prop;
  };

  const groupBySelect = kanbanGroup('status');

  return (
    <div className="rounded-[1rem] border border-white/10 bg-black/20 overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-white/5 flex items-center gap-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-slate-500 hover:text-slate-300 transition"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {editingName ? (
          <div className="flex items-center gap-1">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-transparent border-b border-amber-200/30 outline-none text-[13px] text-white"
              autoFocus
              onBlur={() => setEditingName(false)}
              onKeyDown={(e) => { if (e.key === 'Enter') setEditingName(false); }}
            />
            <button onClick={() => setEditingName(false)} className="text-emerald-400">
              <Check className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditingName(true)}
            className="text-[13px] text-white hover:text-amber-200 transition flex items-center gap-1"
          >
            <Database className="h-4 w-4" />
            {name}
          </button>
        )}

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setViewMode('table')}
            className={`px-2 py-1 rounded text-[10px] transition ${viewMode === 'table' ? 'bg-amber-200/20 text-amber-200' : 'text-slate-500 hover:text-slate-300'}`}
          >
            表格
          </button>
          <button
            onClick={() => setViewMode('kanban')}
            className={`px-2 py-1 rounded text-[10px] transition ${viewMode === 'kanban' ? 'bg-amber-200/20 text-amber-200' : 'text-slate-500 hover:text-slate-300'}`}
          >
            看板
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          {viewMode === 'table' ? (
            <>
              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[400px]">
                  <thead>
                    <tr className="border-b border-white/5">
                      {properties.map(prop => (
                        <th
                          key={prop.id}
                          onClick={() => prop.type !== 'checkbox' && toggleSort(prop.id)}
                          className={`px-3 py-2 text-left text-[10px] font-medium text-slate-500 uppercase tracking-wider ${prop.type !== 'checkbox' ? 'cursor-pointer hover:text-slate-300' : ''}`}
                        >
                          <div className="flex items-center gap-1">
                            {getPropertyIcon(prop.type)}
                            {prop.name}
                            {sortColumn === prop.id && (
                              <ArrowUpDown className={`h-2.5 w-2.5 ${sortDirection === 'asc' ? '' : 'rotate-180'}`} />
                            )}
                          </div>
                        </th>
                      ))}
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Add row */}
                    {addingRow && (
                      <tr className="border-b border-white/5 bg-amber-200/5">
                        {properties.map(prop => (
                          <td key={prop.id} className="px-3 py-1.5">
                            {prop.type === 'select' && prop.options ? (
                              <select
                                value={newRowValues[prop.id] || ''}
                                onChange={(e) => setNewRowValues(v => ({ ...v, [prop.id]: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-[12px] text-slate-300 outline-none"
                              >
                                <option value="">选择...</option>
                                {prop.options.map(opt => (
                                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                                ))}
                              </select>
                            ) : prop.type === 'checkbox' ? (
                              <input
                                type="checkbox"
                                checked={newRowValues[prop.id] === 'true'}
                                onChange={(e) => setNewRowValues(v => ({ ...v, [prop.id]: String(e.target.checked) }))}
                                className="h-4 w-4"
                              />
                            ) : prop.type === 'date' ? (
                              <input
                                type="date"
                                value={newRowValues[prop.id] || ''}
                                onChange={(e) => setNewRowValues(v => ({ ...v, [prop.id]: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-[12px] text-slate-300 outline-none"
                              />
                            ) : (
                              <input
                                type={prop.type === 'number' ? 'number' : 'text'}
                                value={newRowValues[prop.id] || ''}
                                onChange={(e) => setNewRowValues(v => ({ ...v, [prop.id]: e.target.value }))}
                                placeholder="..."
                                className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-[12px] text-slate-300 outline-none placeholder:text-slate-600"
                                autoFocus
                              />
                            )}
                          </td>
                        ))}
                        <td className="px-2">
                          <div className="flex items-center gap-1">
                            <button onClick={addRow} className="text-emerald-400 hover:text-emerald-300">
                              <Check className="h-4 w-4" />
                            </button>
                            <button onClick={() => { setAddingRow(false); setNewRowValues({}); }} className="text-slate-500 hover:text-slate-300">
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* Data rows */}
                    {sortedRows.map(row => (
                      <tr key={row.id} className="border-b border-white/5 hover:bg-white/[0.02] transition">
                        {properties.map(prop => {
                          const isEditing = editingCell?.rowId === row.id && editingCell?.propertyId === prop.id;
                          return (
                            <td
                              key={prop.id}
                              className={`px-3 py-1.5 ${prop.type === 'checkbox' ? 'w-12' : ''}`}
                              onDoubleClick={() => prop.type !== 'checkbox' && setEditingCell({ rowId: row.id, propertyId: prop.id })}
                            >
                              <div className={prop.type === 'checkbox' ? 'flex justify-center' : ''}>
                                {renderCell(row, prop, isEditing)}
                              </div>
                            </td>
                          );
                        })}
                        <td className="px-2">
                          <button
                            onClick={() => deleteRow(row.id)}
                            className="text-slate-600 hover:text-red-400 transition opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    ))}

                    {/* Empty state */}
                    {rows.length === 0 && !addingRow && (
                      <tr>
                        <td colSpan={properties.length + 1} className="px-3 py-6 text-center text-[11px] text-slate-500">
                          暂无数据，点击下方添加
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Add row button */}
              {!addingRow && (
                <button
                  onClick={() => setAddingRow(true)}
                  className="w-full flex items-center justify-center gap-1 py-2 text-[11px] text-slate-500 hover:text-slate-300 border-t border-white/5 transition"
                >
                  <Plus className="h-3 w-3" />
                  添加一行
                </button>
              )}
            </>
          ) : (
            /* Kanban View */
            <div className="p-2">
              {groupBySelect ? (
                <div className="flex gap-2 overflow-x-auto">
                  {groupBySelect.options?.map(option => {
                    const columnRows = rows.filter(r => r.cells['status'] === option.id);
                    const titleProp = properties.find(p => p.id === 'title');
                    return (
                      <div
                        key={option.id}
                        className="flex-1 min-w-[180px] max-w-[220px]"
                      >
                        <div className="flex items-center gap-1.5 mb-2 px-1">
                          <span className={`w-2 h-2 rounded-full ${option.color === 'emerald' ? 'bg-emerald-400' : option.color === 'amber' ? 'bg-amber-400' : 'bg-slate-500'}`} />
                          <span className="text-[11px] font-medium text-slate-400">{option.label}</span>
                          <span className="text-[10px] text-slate-600">({columnRows.length})</span>
                        </div>
                        <div className="space-y-1.5">
                          {columnRows.map(row => (
                            <div
                              key={row.id}
                              className="p-2 rounded-md border border-white/5 bg-white/[0.03] hover:bg-white/[0.06] cursor-pointer transition"
                              onClick={() => setEditingCell({ rowId: row.id, propertyId: 'title' })}
                            >
                              <div className="text-[12px] text-slate-300 line-clamp-2">
                                {String(row.cells['title'] || '无标题')}
                              </div>
                              {row.cells['priority'] && (
                                <span className={`inline-flex mt-1 px-1 py-0.5 rounded text-[9px] ${getSelectColor(String(row.cells['priority']))}`}>
                                  {groupBySelect.options?.find(o => o.id === row.cells['priority'])?.label}
                                </span>
                              )}
                            </div>
                          ))}
                          {columnRows.length === 0 && (
                            <div className="text-[10px] text-slate-600 text-center py-3">
                              拖拽任务至此
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-4 text-[11px] text-slate-500">
                  请先添加「状态」列以启用看板视图
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
