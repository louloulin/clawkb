import { useEffect, useMemo, useState } from 'react';
import { api, type ContextFragment, type SearchHit } from '@/api';
import { KbChatPane } from '@/components/spaces/kb-chat-pane';
import { KbDetailPane } from '@/components/spaces/kb-detail-pane';
import { KbListPane } from '@/components/spaces/kb-list-pane';
import { resolveSourceHit } from '@/lib/source-navigation';
import { useDocumentWorkspaceStore } from '@/store/document-workspace-store';
import { useKbStore } from '@/store/kb-store';
import { useKbRegistry } from '@/store/kb-registry-store';
import { useWorkspaceStore } from '@/store/workspace-store';

export function KnowledgeSpaceShell() {
  const { kbPath, openKb, setPage } = useKbStore();
  const registry = useKbRegistry();
  const { selectDocument, seedDraftFromDocument, setActiveTab } = useDocumentWorkspaceStore();
  const { selectedSpaceId, setActiveDocumentsView, setSelectedSpaceId } = useWorkspaceStore();
  const [switching, setSwitching] = useState(false);
  const [previewQuery, setPreviewQuery] = useState('*');
  const [previewHits, setPreviewHits] = useState<SearchHit[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  const visibleSpaces = useMemo(() => {
    const byRecent = (left: (typeof registry.registeredSpaces)[number], right: (typeof registry.registeredSpaces)[number]) =>
      (right.lastOpenedAt ?? right.addedAt) - (left.lastOpenedAt ?? left.addedAt);

    const personalSpaces = registry.registeredSpaces
      .filter((space) => space.collection === 'created')
      .sort(byRecent);
    const secondarySpaces = registry.registeredSpaces
      .filter((space) => space.collection === 'joined' || space.collection === 'shared')
      .sort(byRecent);

    return [
      ...(registry.currentSpace ? [registry.currentSpace] : []),
      ...personalSpaces,
      ...secondarySpaces,
    ];
  }, [registry.currentSpace, registry.registeredSpaces]);

  useEffect(() => {
    if (!selectedSpaceId || !visibleSpaces.some((space) => space.id === selectedSpaceId)) {
      setSelectedSpaceId(visibleSpaces[0]?.id ?? null);
    }
  }, [selectedSpaceId, setSelectedSpaceId, visibleSpaces]);

  const selectedSpace = registry.findSpaceById(selectedSpaceId);
  const isCurrent = !!selectedSpace && selectedSpace.path === kbPath;
  const currentAlreadyRegistered =
    !!registry.currentSpace &&
    registry.registeredSpaces.some((space) => space.path === registry.currentSpace?.path);

  const ensureSpaceReady = async () => {
    if (!selectedSpace || isCurrent) return;
    const stats = await api.openExtraKb(selectedSpace.path);
    registry.recordStats(selectedSpace.id, stats);
  };

  const loadPreview = async (query = previewQuery) => {
    if (!selectedSpace) return;
    setPreviewLoading(true);
    try {
      await onEnsureSelectedSpaceReady();
      const normalized = query.trim() || '*';
      const results = isCurrent
        ? await api.search(normalized, 12, 'hybrid')
        : await api.searchMultiKb(normalized, [selectedSpace.path], 12, 'hybrid');
      setPreviewHits(Array.isArray(results) ? results : []);
      setPreviewQuery(normalized);
    } finally {
      setPreviewLoading(false);
    }
  };

  const onEnsureSelectedSpaceReady = async () => {
    if (!selectedSpace || isCurrent) return;
    await ensureSpaceReady();
  };

  useEffect(() => {
    if (!selectedSpace || selectedSpace.kind !== 'registered' || selectedSpace.stats) return;
    void ensureSpaceReady();
  }, [selectedSpace?.id]);

  useEffect(() => {
    if (!selectedSpace) {
      setPreviewHits([]);
      return;
    }
    void loadPreview('*');
  }, [selectedSpace?.id, isCurrent]);

  useEffect(() => {
    if (!selectedSpace) {
      registry.setActiveKb(null);
      return;
    }
    registry.setActiveKb(selectedSpace.kind === 'registered' ? selectedSpace.id : null);
  }, [selectedSpace?.id, selectedSpace?.kind]);

  const handleRegisterCurrent = () => {
    if (!registry.currentSpace) return;
    const created = registry.registerKb(
      registry.currentSpace.path,
      registry.currentSpace.name,
      '当前正在使用的本地知识库。',
      'created',
    );
    setSelectedSpaceId(created?.id ?? null);
    if (created?.id) {
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
    setSelectedSpaceId(selectedSpace.id);
  };

  const activateSelectedSpace = async (targetPage: 'home' | 'documents') => {
    if (!selectedSpace) return;

    setSwitching(true);
    try {
      if (!isCurrent) {
        await openKb(selectedSpace.path);
        registry.markOpened(selectedSpace.id);
        registry.setActiveKb(selectedSpace.id);
      }
      setPage(targetPage);
    } finally {
      setSwitching(false);
    }
  };

  const handleOpenAsk = async () => {
    await activateSelectedSpace('home');
  };

  const handleOpenNotes = async (hit?: SearchHit) => {
    const previewTarget = hit ?? previewHits[0] ?? null;
    if (previewTarget) {
      selectDocument(previewTarget);
      seedDraftFromDocument(previewTarget);
    }
    setActiveDocumentsView('notes');
    setActiveTab('notes');
    await activateSelectedSpace('documents');
  };

  const handleOpenSource = async (fragment: ContextFragment) => {
    const doc = await resolveSourceHit(fragment, !isCurrent && selectedSpace ? [selectedSpace.path] : undefined);
    selectDocument(doc);
    seedDraftFromDocument(doc);
    setActiveDocumentsView('reader');
    setActiveTab('reader');
    await activateSelectedSpace('documents');
  };

  return (
    <div className="kb-shell flex h-full min-h-full text-white">
      <div className="grid flex-1 min-w-0 grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)]">
        <KbListPane
          title="知识库管理"
          spaces={visibleSpaces}
          selectedId={selectedSpace?.id ?? null}
          onSelect={setSelectedSpaceId}
          onUnregister={registry.unregisterKb}
        />

        <div className="flex min-w-0 flex-col bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),_transparent_30%),linear-gradient(180deg,_rgba(18,20,29,0.92)_0%,_rgba(11,13,19,1)_100%)]">
          <div className="border-b border-white/10 px-5 py-4 lg:px-8">
            <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">知识库管理</div>
            <h1 className="mt-2 text-2xl font-semibold text-white">选择当前要工作的知识库，并决定从资料还是笔记继续。</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              这里负责切换和整理知识库，不承载长期工作本身。选定后回到资料或笔记继续推进主任务。
            </p>
          </div>

          <div className="flex-1 p-5 lg:p-8">
            <KbDetailPane
              selectedSpace={selectedSpace}
              isCurrent={isCurrent}
              switching={switching}
              previewQuery={previewQuery}
              previewHits={previewHits}
              previewLoading={previewLoading}
              onPreviewQueryChange={setPreviewQuery}
              onPreviewSearch={(query) => void loadPreview(query)}
              onOpenAsk={() => void handleOpenAsk()}
              onOpenNotes={(hit) => void handleOpenNotes(hit)}
              onRegisterCurrent={handleRegisterCurrent}
              showRegisterCurrent={!!registry.currentSpace && !currentAlreadyRegistered}
              onSaveMetadata={handleSaveMetadata}
            />
          </div>

          <div className="border-t border-white/10 bg-[rgba(7,9,14,0.78)] p-5">
            <KbChatPane
              selectedSpace={selectedSpace}
              isCurrent={isCurrent}
              onEnsureSpaceReady={onEnsureSelectedSpaceReady}
              onOpenSource={(fragment) => void handleOpenSource(fragment)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
