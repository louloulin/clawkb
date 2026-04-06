import { useEffect, useMemo, useState } from 'react';
import { BookMarked, Library, Share2, Users } from 'lucide-react';
import { api } from '@/api';
import { KbChatPane } from '@/components/spaces/kb-chat-pane';
import { KbDetailPane } from '@/components/spaces/kb-detail-pane';
import { KbListPane } from '@/components/spaces/kb-list-pane';
import { useKbStore } from '@/store/kb-store';
import { useKbRegistry } from '@/store/kb-registry-store';
import { useWorkspaceStore, type SpaceCollection } from '@/store/workspace-store';

const COLLECTIONS: Array<{
  id: SpaceCollection;
  label: string;
  caption: string;
  icon: typeof Library;
}> = [
  { id: 'personal', label: '当前知识库', caption: '当前正在使用的本地知识库', icon: Library },
  { id: 'created', label: '我的知识库', caption: '我主动登记的本地知识库', icon: BookMarked },
  { id: 'joined', label: '归档知识库', caption: '暂不常用但保留访问的本地库', icon: Users },
  { id: 'shared', label: '参考资料库', caption: '只读参考素材或备用资料库', icon: Share2 },
] as const;

export function KnowledgeSpaceShell() {
  const { kbPath, openKb, setPage } = useKbStore();
  const registry = useKbRegistry();
  const {
    activeSpaceCollection,
    selectedSpaceId,
    setActiveSpaceCollection,
    setSelectedSpaceId,
  } = useWorkspaceStore();
  const [switching, setSwitching] = useState(false);

  const visibleSpaces = useMemo(
    () => registry.getSpacesForCollection(activeSpaceCollection),
    [activeSpaceCollection, registry.currentSpace, registry.registeredSpaces],
  );

  useEffect(() => {
    if (!selectedSpaceId || !visibleSpaces.some((space) => space.id === selectedSpaceId)) {
      setSelectedSpaceId(visibleSpaces[0]?.id ?? null);
    }
  }, [selectedSpaceId, setSelectedSpaceId, visibleSpaces]);

  const selectedSpace = registry.findSpaceById(selectedSpaceId);
  const isCurrent = !!selectedSpace && selectedSpace.path === kbPath;
  const currentAlreadyRegistered = !!registry.currentSpace && registry.registeredSpaces.some((space) => space.path === registry.currentSpace?.path);

  const ensureSpaceReady = async () => {
    if (!selectedSpace || isCurrent) return;
    const stats = await api.openExtraKb(selectedSpace.path);
    registry.recordStats(selectedSpace.id, stats);
  };

  useEffect(() => {
    if (!selectedSpace || selectedSpace.kind !== 'registered' || selectedSpace.stats) return;
    void ensureSpaceReady();
  }, [selectedSpace?.id]);

  useEffect(() => {
    if (!selectedSpace) {
      registry.setActiveKb(null);
      return;
    }
    registry.setActiveKb(selectedSpace.kind === 'registered' ? selectedSpace.id : null);
  }, [selectedSpace?.id, selectedSpace?.kind]);

  const handleOpenSpace = async () => {
    if (!selectedSpace) return;
    if (isCurrent) {
      setPage('home');
      return;
    }

    setSwitching(true);
    try {
      await openKb(selectedSpace.path);
      registry.markOpened(selectedSpace.id);
      registry.setActiveKb(selectedSpace.id);
      setPage('home');
    } finally {
      setSwitching(false);
    }
  };

  const handleRegisterCurrent = () => {
    if (!registry.currentSpace) return;
    const created = registry.registerKb(
      registry.currentSpace.path,
      registry.currentSpace.name,
      'Registered from the current local knowledge base.',
      'created',
    );
    setActiveSpaceCollection('created');
    setSelectedSpaceId(created?.id ?? null);
    if (created?.id) {
      registry.setActiveKb(created.id);
    }
  };

  const handleRegister = (path: string, name: string, description: string) => {
    const created = registry.registerKb(path.trim(), name.trim(), description.trim(), 'created');
    if (created) {
      setSelectedSpaceId(created.id);
      registry.setActiveKb(created.id);
    }
  };

  const handleSaveMetadata = async (updates: { name: string; description: string; collection: 'created' | 'joined' | 'shared' }) => {
    if (!selectedSpace || selectedSpace.kind !== 'registered') return;
    if (updates.name !== selectedSpace.name) {
      registry.renameKb(selectedSpace.id, updates.name.trim());
    }
    registry.updateKb(selectedSpace.id, {
      description: updates.description.trim(),
      collection: updates.collection,
    });
    registry.setActiveKb(selectedSpace.id);
    setActiveSpaceCollection(updates.collection);
    setSelectedSpaceId(selectedSpace.id);
  };

  const placeholderMessage =
    activeSpaceCollection === 'joined' || activeSpaceCollection === 'shared'
      ? 'This lane is available for organizing your local archive and reference libraries. Add entries when you want a calmer separation between active work and long-tail material.'
      : 'Select or register a local knowledge base to begin.';

  return (
    <div className="kb-shell flex h-full min-h-full text-white">
      <aside className="hidden w-64 shrink-0 border-r border-white/10 bg-black/20 p-4 md:flex md:flex-col">
        <div>
          <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Local Libraries</div>
          <h2 className="mt-2 text-2xl font-semibold">Choose the right local library before you ask.</h2>
          <p className="mt-3 text-sm leading-7 text-slate-400">
            The spaces shell is now the control center for your personal, on-device knowledge libraries.
          </p>
        </div>
        <div className="mt-8 space-y-2">
          {COLLECTIONS.map((collection) => {
            const Icon = collection.icon;
            const isActive = activeSpaceCollection === collection.id;
            return (
              <button
                key={collection.id}
                onClick={() => setActiveSpaceCollection(collection.id)}
                className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                  isActive
                    ? 'border-amber-200/40 bg-amber-200/12 text-white'
                    : 'border-white/8 bg-white/4 text-slate-300 hover:border-white/16 hover:bg-white/6'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-black/20">
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <div className="font-medium">{collection.label}</div>
                    <div className="mt-1 text-xs text-slate-400">{collection.caption}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

          <div className="kb-panel-strong mt-auto rounded-[1.5rem] px-4 py-3 text-xs leading-6 text-slate-400">
            {placeholderMessage}
          </div>
        </aside>

      <div className="grid flex-1 min-w-0 grid-cols-1 border-l border-white/5 xl:grid-cols-[340px_minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <KbListPane
          title={COLLECTIONS.find((item) => item.id === activeSpaceCollection)?.label ?? '知识库'}
          spaces={visibleSpaces}
          selectedId={selectedSpace?.id ?? null}
          onSelect={setSelectedSpaceId}
          onRegister={handleRegister}
          onUnregister={registry.unregisterKb}
          canRegister={activeSpaceCollection === 'created'}
        />

        <div className="min-w-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),_transparent_30%),linear-gradient(180deg,_rgba(18,20,29,0.92)_0%,_rgba(11,13,19,1)_100%)] p-5 lg:p-8">
          <KbDetailPane
            selectedSpace={selectedSpace}
            isCurrent={isCurrent}
            switching={switching}
          onOpen={() => void handleOpenSpace()}
          onRegisterCurrent={handleRegisterCurrent}
          showRegisterCurrent={!!registry.currentSpace && !currentAlreadyRegistered}
          onOpenDocuments={() => setPage('documents')}
          onSaveMetadata={handleSaveMetadata}
        />
      </div>

        <div className="border-t border-white/10 bg-[rgba(7,9,14,0.75)] p-5 xl:border-l xl:border-t-0">
          <KbChatPane
            selectedSpace={selectedSpace}
            isCurrent={isCurrent}
            onEnsureSpaceReady={ensureSpaceReady}
          />
        </div>
      </div>
    </div>
  );
}
