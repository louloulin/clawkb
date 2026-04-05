import { useState } from 'react';
import { FolderPlus, Library, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { RegistrySpace } from '@/store/kb-registry-store';

interface KbListPaneProps {
  title: string;
  spaces: RegistrySpace[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRegister: (path: string, name: string, description: string) => void;
  onUnregister: (id: string) => void;
  canRegister: boolean;
}

export function KbListPane({
  title,
  spaces,
  selectedId,
  onSelect,
  onRegister,
  onUnregister,
  canRegister,
}: KbListPaneProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [path, setPath] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const resetForm = () => {
    setPath('');
    setName('');
    setDescription('');
    setShowCreate(false);
  };

  return (
    <div className="flex h-full flex-col border-b border-white/10 bg-white/4 md:border-b-0 md:border-r">
      <div className="border-b border-white/10 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">{title}</div>
            <h3 className="mt-2 text-lg font-semibold text-white">Space Registry</h3>
          </div>
          {canRegister && (
            <Button
              onClick={() => setShowCreate((value) => !value)}
              variant="outline"
              className="h-10 rounded-full border-white/10 bg-white/4 px-4 text-xs text-white hover:bg-white/10"
            >
              <FolderPlus className="mr-2 h-4 w-4" />
              {showCreate ? 'Close' : 'Add'}
            </Button>
          )}
        </div>

        {showCreate && (
          <div className="mt-4 space-y-3 rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Space name"
              className="h-10 rounded-xl border-white/10 bg-white/6 text-white placeholder:text-slate-500"
            />
            <Input
              value={path}
              onChange={(event) => setPath(event.target.value)}
              placeholder="/path/to/knowledge.mv2"
              className="h-10 rounded-xl border-white/10 bg-white/6 text-white placeholder:text-slate-500"
            />
            <Input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Short description"
              className="h-10 rounded-xl border-white/10 bg-white/6 text-white placeholder:text-slate-500"
            />
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  onRegister(path, name || path.split('/').pop() || 'Knowledge Space', description);
                  resetForm();
                }}
                disabled={!path.trim()}
                className="h-10 flex-1 rounded-full bg-amber-300 text-slate-950 hover:bg-amber-200"
              >
                <Save className="mr-2 h-4 w-4" />
                Register Space
              </Button>
              <Button
                variant="ghost"
                onClick={resetForm}
                className="h-10 rounded-full px-4 text-slate-300 hover:bg-white/6 hover:text-white"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      <ScrollArea className="h-[calc(100vh-13rem)] md:h-[calc(100vh-7rem)]">
        <div className="space-y-3 p-4">
          {spaces.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm leading-7 text-slate-400">
              This collection has no entries yet.
            </div>
          ) : (
            spaces.map((space) => (
              <div
                key={space.id}
                className={`rounded-[1.4rem] border px-4 py-4 transition ${
                  selectedId === space.id
                    ? 'border-amber-200/40 bg-amber-200/10'
                    : 'border-white/8 bg-black/20 hover:border-white/16 hover:bg-black/30'
                }`}
              >
                <button className="w-full text-left" onClick={() => onSelect(space.id)}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-white">{space.name}</div>
                    <span className="rounded-full border border-white/10 bg-white/6 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-slate-300">
                      {space.kind === 'current' ? 'current' : space.collection}
                    </span>
                  </div>
                  <div className="mt-3 text-xs leading-6 text-slate-400">{space.description}</div>
                  <div className="mt-3 line-clamp-1 text-[11px] text-slate-500">{space.path}</div>
                  {space.stats && (
                    <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/4 px-2.5 py-1 text-[11px] text-slate-300">
                      <Library className="h-3.5 w-3.5" />
                      {space.stats.frame_count} docs
                    </div>
                  )}
                </button>

                {space.kind === 'registered' && (
                  <div className="mt-4 flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => onUnregister(space.id)}
                      className="h-8 rounded-full px-3 text-xs text-slate-400 hover:bg-red-500/10 hover:text-red-300"
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Remove
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
