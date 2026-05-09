import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { BookOpen, FolderCog, LibraryBig, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DocumentListPane } from '@/components/documents/document-list-pane';
import { DocumentTabs } from '@/components/documents/document-tabs';
import { DocumentToolbar } from '@/components/documents/document-toolbar';
import { useDocumentWorkspaceStore } from '@/store/document-workspace-store';
import { useKbStore } from '@/store/kb-store';
import { useWorkspaceStore } from '@/store/workspace-store';

const ReaderPage = lazy(() => import('@/components/pages/reader').then((module) => ({ default: module.ReaderPage })));
const EditorPage = lazy(() => import('@/components/pages/editor').then((module) => ({ default: module.EditorPage })));
const NotesPage = lazy(() => import('@/components/pages/notes').then((module) => ({ default: module.NotesPage })));

export function DocumentWorkspaceShell() {
  const { kbPath, stats, isKbOpen, setPage } = useKbStore();
  const { activeDocumentsView } = useWorkspaceStore();
  const {
    documents,
    selectedDocument,
    activeTab,
    isLoading,
    draftTitle,
    draftContent,
    lastSavedAt,
    loadDocuments,
    selectDocument,
    setActiveTab,
    setDraftState,
    seedDraftFromDocument,
    saveDraftToKnowledgeBase,
  } = useDocumentWorkspaceStore();
  const [savingDraft, setSavingDraft] = useState(false);

  useEffect(() => {
    if (!isKbOpen) return;
    void loadDocuments();
  }, [isKbOpen, loadDocuments]);

  useEffect(() => {
    if (activeDocumentsView === 'draft') {
      setActiveTab('draft');
    } else if (activeDocumentsView === 'notes') {
      setActiveTab('notes');
    } else if (activeDocumentsView === 'reader') {
      setActiveTab('reader');
    }
  }, [activeDocumentsView, setActiveTab]);

  useEffect(() => {
    if (activeTab === 'report' || activeTab === 'podcast') {
      setActiveTab('reader');
    }
  }, [activeTab, setActiveTab]);

  const visibleDocuments = isKbOpen ? documents : [];
  const activeDocument = isKbOpen ? selectedDocument : null;

  const headerSummary = useMemo(() => {
    if (!isKbOpen) return '先打开真实的本地知识库，这里才会变成阅读、笔记和草稿的连续工作流。';
    if (!activeDocument) return '从左侧选择一份资料，然后继续阅读、做笔记或写草稿。';
    return `${activeDocument.title} · 当前资料工作流`;
  }, [activeDocument, isKbOpen]);

  const noteTags = useMemo(
    () => activeDocument?.tags || [],
    [activeDocument?.id],
  );

  const handleSaveDraft = async () => {
    setSavingDraft(true);
    try {
      await saveDraftToKnowledgeBase();
    } finally {
      setSavingDraft(false);
    }
  };

  return (
    <div className="kb-shell flex h-full min-h-full text-foreground">
      <DocumentListPane
        documents={visibleDocuments}
        selectedDocument={activeDocument}
        isLoading={isKbOpen ? isLoading : false}
        onSelect={(doc) => {
          selectDocument(doc);
          seedDraftFromDocument(doc);
        }}
        emptyTitle={isKbOpen ? '当前资料为空' : '还没有打开知识库'}
        emptyDescription={
          isKbOpen
            ? '先导入资料或回到知识库页选择一份内容，这里才会出现连续的阅读和笔记流。'
            : '先打开或创建一个本地知识库，这里才会出现当前知识库里的资料。'
        }
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-border bg-secondary px-5 py-4 backdrop-blur-xl">
          <div className="flex flex-col gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">笔记工作区</div>
            <h1 className="mt-2 text-2xl font-semibold">围绕当前资料阅读、做笔记并继续写作。</h1>
            <p className="mt-2 text-sm leading-7 text-foreground/80">
              这里承接个人知识库里的核心工作流。{headerSummary}
            </p>
          </div>

            <div className="flex flex-wrap gap-3 text-xs text-foreground/80">
              <span className="rounded-full border border-border bg-muted/50 px-3 py-1">
                <BookOpen className="mr-1.5 inline h-3.5 w-3.5" />
                {kbPath ? kbPath.split('/').pop() : '未打开知识库'}
              </span>
              <span className="rounded-full border border-border bg-muted/50 px-3 py-1">
                {stats?.frame_count ?? 0} 篇资料
              </span>
            </div>

            {isKbOpen && <DocumentTabs value={activeTab} onValueChange={setActiveTab} />}
          </div>
        </div>

        {isKbOpen && (
          <DocumentToolbar
            onSaveDraft={handleSaveDraft}
            savingDraft={savingDraft}
            lastSavedAt={lastSavedAt}
          />
        )}

        <div className="min-h-0 flex-1 overflow-hidden">
          {!isKbOpen ? (
            <div className="flex h-full items-center justify-center px-6 py-10">
              <div className="w-full max-w-3xl rounded-[2rem] border border-amber-200/16 bg-card p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
                <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/20 bg-amber-200/10 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-amber-100/80">
                      笔记初始化
                    </div>
                    <h2 className="mt-4 text-2xl font-semibold text-foreground sm:text-3xl">
                      先打开一个本地知识库，再进入笔记工作区
                    </h2>
                    <p className="mt-3 text-sm leading-7 text-foreground/80">
                      阅读、笔记和草稿都必须围绕真实的桌面本地资料工作。先挂载知识库，再回来继续基于原文做事。
                    </p>
                    <div className="mt-5 flex flex-wrap gap-3">
                      <Button
                        onClick={() => setPage('settings')}
                        className="h-11 rounded-full bg-amber-300 px-5 text-sm font-medium text-foreground hover:bg-amber-200"
                      >
                        <FolderCog className="mr-2 h-4 w-4" />
                        打开或创建知识库
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setPage('spaces')}
                        className="h-11 rounded-full border-border bg-secondary px-5 text-sm text-foreground hover:bg-accent"
                      >
                        <LibraryBig className="mr-2 h-4 w-4" />
                        查看个人知识库
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-border bg-secondary p-5">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">核心流程</div>
                    <div className="mt-4 space-y-3 text-sm text-foreground/80">
                      <div className="rounded-[1rem] border border-border bg-secondary px-4 py-3">
                        阅读器负责保留原文和引用上下文。
                      </div>
                      <div className="rounded-[1rem] border border-border bg-secondary px-4 py-3">
                        笔记和草稿始终跟着当前资料走。
                      </div>
                      <div className="rounded-[1rem] border border-border bg-secondary px-4 py-3">
                        保存后的内容会回到当前知识库，而不是浏览器假状态。
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : !activeDocument && !isLoading ? (
            <div className="flex h-full items-center justify-center text-center">
              <div className="space-y-3">
                <BookOpen className="mx-auto h-12 w-12 text-muted-foreground" />
                <div className="text-base font-medium text-foreground/80">先选择一份资料，再开始笔记工作流</div>
                <div className="text-sm text-muted-foreground">当前资料会驱动阅读、笔记和草稿，不再让高级输出抢走主流程。</div>
              </div>
            </div>
          ) : isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  正在打开笔记工作区…
                </div>
              }
            >
              {activeTab === 'reader' && (
                <ReaderPage
                  embedded
                  documents={visibleDocuments}
                  selectedDocument={activeDocument}
                  onSelectDocument={selectDocument}
                />
              )}
              {activeTab === 'draft' && (
                <EditorPage
                  embedded
                  initialTitle={draftTitle}
                  initialContent={draftContent}
                  sourceDocument={activeDocument}
                  onDraftChange={(nextTitle, nextContent) => setDraftState(nextTitle, nextContent)}
                  onSaved={() => void loadDocuments()}
                />
              )}
              {activeTab === 'notes' && (
                <NotesPage
                  embedded
                  initialTitle={activeDocument ? `${activeDocument.title} · Notes` : 'Workspace Notes'}
                  initialContent={activeDocument?.content || ''}
                  initialTags={noteTags}
                  onSaved={() => void loadDocuments()}
                />
              )}
            </Suspense>
          )}
        </div>
      </div>
    </div>
  );
}
