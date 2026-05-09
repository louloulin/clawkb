import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Edit3, Check, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { EditorTemplate } from '@/store/template-store';
import { getTemplates, saveUserTemplate, deleteUserTemplate } from '@/store/template-store';

interface TemplateManagerProps {
  onClose: () => void;
  onSelect?: (template: EditorTemplate) => void;
}

export function TemplateManager({ onClose, onSelect }: TemplateManagerProps) {
  const [templates, setTemplates] = useState<EditorTemplate[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<EditorTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newTemplate, setNewTemplate] = useState<EditorTemplate>({
    id: `custom-${Date.now()}`,
    label: '',
    title: '',
    content: '',
  });

  useEffect(() => {
    setTemplates(getTemplates());
  }, []);

  const handleCreate = () => {
    if (!newTemplate.label.trim() || !newTemplate.title.trim()) return;
    const t: EditorTemplate = {
      ...newTemplate,
      id: `custom-${Date.now()}`,
      label: newTemplate.label.trim(),
      title: newTemplate.title.trim(),
      content: newTemplate.content,
    };
    saveUserTemplate(t);
    setTemplates(getTemplates());
    setIsCreating(false);
    setNewTemplate({ id: `custom-${Date.now()}`, label: '', title: '', content: '' });
  };

  const handleSaveEdit = () => {
    if (!editingTemplate || !editingTemplate.label.trim()) return;
    saveUserTemplate(editingTemplate);
    setTemplates(getTemplates());
    setEditingId(null);
    setEditingTemplate(null);
  };

  const handleDelete = (id: string) => {
    deleteUserTemplate(id);
    setTemplates(getTemplates());
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[80vh] flex flex-col rounded-2xl border border-white/10 bg-popover/95 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <h2 className="text-base font-semibold text-white">模板管理</h2>
            <p className="text-xs text-muted-foreground mt-0.5">管理你的写作模板</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-lg">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1 px-6 py-4">
          {/* Built-in templates */}
          <div className="mb-6">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">内置模板</div>
            <div className="grid grid-cols-2 gap-2">
              {templates.filter(t => t.builtin).map(t => (
                <button
                  key={t.id}
                  onClick={() => { onSelect?.(t); onClose(); }}
                  className="text-left p-3 rounded-xl border border-white/8 bg-white/4 hover:bg-white/8 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium text-white">{t.label}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1 truncate">{t.title}</div>
                </button>
              ))}
            </div>
          </div>

          {/* User templates */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">自定义模板</div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCreating(true)}
                className="h-7 text-xs gap-1 border-white/10 bg-white/4 text-white hover:bg-white/10"
              >
                <Plus className="h-3 w-3" />
                新建模板
              </Button>
            </div>

            {isCreating && (
              <div className="mb-3 p-4 rounded-xl border border-amber-200/30 bg-amber-200/5 space-y-3">
                <div className="text-xs text-amber-200/80 font-medium mb-2">新建模板</div>
                <Input
                  placeholder="模板名称（显示名）"
                  value={newTemplate.label}
                  onChange={e => setNewTemplate({ ...newTemplate, label: e.target.value })}
                  className="h-9 text-sm bg-white/6 border-white/10 text-white placeholder:text-muted-foreground"
                />
                <Input
                  placeholder="默认标题"
                  value={newTemplate.title}
                  onChange={e => setNewTemplate({ ...newTemplate, title: e.target.value })}
                  className="h-9 text-sm bg-white/6 border-white/10 text-white placeholder:text-muted-foreground"
                />
                <textarea
                  placeholder="HTML 内容模板（可选）"
                  value={newTemplate.content}
                  onChange={e => setNewTemplate({ ...newTemplate, content: e.target.value })}
                  className="w-full text-sm bg-white/6 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-muted-foreground resize-none"
                  rows={3}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleCreate} className="text-xs h-8 gap-1">
                    <Check className="h-3 w-3" /> 保存
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setIsCreating(false)} className="text-xs h-8 text-muted-foreground">
                    取消
                  </Button>
                </div>
              </div>
            )}

            {templates.filter(t => !t.builtin).length === 0 && !isCreating ? (
              <div className="text-xs text-muted-foreground text-center py-6 border border-dashed border-white/10 rounded-xl">
                还没有自定义模板，点击「新建模板」创建
              </div>
            ) : (
              <div className="space-y-2">
                {templates.filter(t => !t.builtin).map(t => (
                  <div key={t.id} className="flex items-start gap-2 p-3 rounded-xl border border-white/8 bg-white/4">
                    {editingId === t.id && editingTemplate ? (
                      <div className="flex-1 space-y-2">
                        <Input
                          value={editingTemplate.label}
                          onChange={e => setEditingTemplate({ ...editingTemplate, label: e.target.value })}
                          className="h-8 text-sm bg-white/6 border-white/10 text-white"
                          placeholder="模板名称"
                          autoFocus
                        />
                        <Input
                          value={editingTemplate.title}
                          onChange={e => setEditingTemplate({ ...editingTemplate, title: e.target.value })}
                          className="h-8 text-sm bg-white/6 border-white/10 text-white"
                          placeholder="默认标题"
                        />
                        <textarea
                          value={editingTemplate.content}
                          onChange={e => setEditingTemplate({ ...editingTemplate, content: e.target.value })}
                          className="w-full text-sm bg-white/6 border border-white/10 rounded-lg px-3 py-2 text-white resize-none"
                          rows={3}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleSaveEdit} className="text-xs h-7 gap-1">
                            <Check className="h-3 w-3" /> 保存
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setEditingTemplate(null); }} className="text-xs h-7 text-muted-foreground">
                            取消
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white">{t.label}</div>
                          <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{t.title}</div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button
                            onClick={() => { onSelect?.(t); onClose(); }}
                            className="p-1.5 rounded-lg text-muted-foreground hover:bg-white/8 hover:text-white transition-colors"
                            title="使用此模板"
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => { setEditingId(t.id); setEditingTemplate({ ...t }); }}
                            className="p-1.5 rounded-lg text-muted-foreground hover:bg-white/8 hover:text-white transition-colors"
                            title="编辑模板"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(t.id)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-300 transition-colors"
                            title="删除模板"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
