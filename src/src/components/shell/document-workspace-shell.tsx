import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { BookOpen, Loader2 } from 'lucide-react';
import { DocumentListPane } from '@/components/documents/document-list-pane';
import { DocumentTabs } from '@/components/documents/document-tabs';
import { DocumentToolbar } from '@/components/documents/document-toolbar';
import { useDocumentWorkspaceStore } from '@/store/document-workspace-store';
import { useKbStore } from '@/store/kb-store';
import { useWorkspaceStore } from '@/store/workspace-store';

const ReaderPage = lazy(() => import('@/components/pages/reader').then((module) => ({ default: module.ReaderPage })));
const EditorPage = lazy(() => import('@/components/pages/editor').then((module) => ({ default: module.EditorPage })));
const NotesPage = lazy(() => import('@/components/pages/notes').then((module) => ({ default: module.NotesPage })));
const ReportPage = lazy(() => import('@/components/pages/report').then((module) => ({ default: module.ReportPage })));
const PodcastPage = lazy(() => import('@/components/pages/podcast').then((module) => ({ default: module.PodcastPage })));

export function DocumentWorkspaceShell() {
  const { kbPath, stats } = useKbStore();
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
    void loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    if (activeDocumentsView === 'draft') {
      setActiveTab('draft');
    } else if (activeDocumentsView === 'reader') {
      setActiveTab('reader');
    }
  }, [activeDocumentsView, setActiveTab]);

  const headerSummary = useMemo(() => {
    if (!selectedDocument) return 'Choose a document from the stream to start reading, drafting, or generating outputs.';
    return `${selectedDocument.title} · unified workspace mode`;
  }, [selectedDocument]);

  const selectedDocsForGeneration = useMemo(
    () => (selectedDocument ? [selectedDocument] : []),
    [selectedDocument?.id],
  );

  const noteTags = useMemo(
    () => selectedDocument?.tags || [],
    [selectedDocument?.id],
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
    <div className="kb-shell flex h-full min-h-full text-white">
      <DocumentListPane
        documents={documents}
        selectedDocument={selectedDocument}
        isLoading={isLoading}
        onSelect={(doc) => {
          selectDocument(doc);
          seedDraftFromDocument(doc);
        }}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-white/10 bg-black/20 px-5 py-4 backdrop-blur-xl">
          <div className="flex flex-col gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Document Workspace</div>
            <h1 className="mt-2 text-2xl font-semibold">Read, draft, annotate, and generate from one document flow.</h1>
            <p className="mt-2 text-sm leading-7 text-slate-300">
              Personal, local document work happens here. {headerSummary}
            </p>
          </div>

            <div className="flex flex-wrap gap-3 text-xs text-slate-300">
              <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1">
                <BookOpen className="mr-1.5 inline h-3.5 w-3.5" />
                {kbPath ? kbPath.split('/').pop() : 'No KB open'}
              </span>
              <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1">
                {stats?.frame_count ?? 0} docs available
              </span>
            </div>

            <DocumentTabs value={activeTab} onValueChange={setActiveTab} />
          </div>
        </div>

        <DocumentToolbar
          onTabChange={setActiveTab}
          onSaveDraft={handleSaveDraft}
          savingDraft={savingDraft}
          lastSavedAt={lastSavedAt}
        />

        <div className="min-h-0 flex-1 overflow-hidden">
          {!selectedDocument && !isLoading ? (
            <div className="flex h-full items-center justify-center text-center">
              <div className="space-y-3">
                <BookOpen className="mx-auto h-12 w-12 text-slate-500" />
                <div className="text-base font-medium text-slate-300">Select a document to start the workspace flow</div>
                <div className="text-sm text-slate-500">The selected document drives your personal draft, note, report, and podcast actions.</div>
              </div>
            </div>
          ) : isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center text-sm text-slate-400">
                  Loading document tool...
                </div>
              }
            >
              {activeTab === 'reader' && (
                <ReaderPage
                  embedded
                  documents={documents}
                  selectedDocument={selectedDocument}
                  onSelectDocument={selectDocument}
                />
              )}
              {activeTab === 'draft' && (
                <EditorPage
                  embedded
                  initialTitle={draftTitle}
                  initialContent={draftContent}
                  sourceDocument={selectedDocument}
                  onDraftChange={(nextTitle, nextContent) => setDraftState(nextTitle, nextContent)}
                  onSaved={() => void loadDocuments()}
                />
              )}
              {activeTab === 'notes' && (
                <NotesPage
                  embedded
                  initialTitle={selectedDocument ? `${selectedDocument.title} · Notes` : 'Workspace Notes'}
                  initialContent={selectedDocument?.content || ''}
                  initialTags={noteTags}
                  onSaved={() => void loadDocuments()}
                />
              )}
              {activeTab === 'report' && (
                <ReportPage embedded preselectedDocs={selectedDocsForGeneration} />
              )}
              {activeTab === 'podcast' && (
                <PodcastPage embedded sourceDoc={selectedDocument} />
              )}
            </Suspense>
          )}
        </div>
      </div>
    </div>
  );
}
