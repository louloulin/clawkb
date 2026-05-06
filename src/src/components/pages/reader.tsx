import { useState, useEffect, useRef, useCallback } from 'react';
import { BookOpen, MessageSquare, Send, Loader2, FileText, X, Sparkles, Languages, Highlighter, MessageCircle, ChevronLeft, ChevronRight, Bookmark, BookmarkCheck, Trash2, Plus, Tag, Link2 } from 'lucide-react';
import { Document, Page } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import Markdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { api } from '@/api/commands';
import type { SearchHit, AskResult, ChatMessage } from '@/api';
import { useBookmarkStore, useReadingProgressStore, HIGHLIGHT_COLORS, type HighlightColor, type Bookmark as BookmarkType } from '@/store/bookmark-store';
import { useKbStore } from '@/store/kb-store';
import { STORAGE_KEYS, safeStorageGet, safeStorageSet } from '@/store/persistence';

interface SelectionPopup {
  text: string;
  x: number;
  y: number;
}

interface Highlight {
  id: string;
  docId: string;
  text: string;
  note: string;
  color: string;
  createdAt: string;
}

const HIGHLIGHTS_KEY = STORAGE_KEYS.bookmarks.highlights;

function loadHighlights(docId: string): Highlight[] {
  return safeStorageGet<Highlight[]>(HIGHLIGHTS_KEY, []).filter(h => h.docId === docId);
}

function saveHighlight(h: Highlight) {
  const all = safeStorageGet<Highlight[]>(HIGHLIGHTS_KEY, []);
  all.push(h);
  safeStorageSet(HIGHLIGHTS_KEY, all);
}

function deleteHighlight(id: string) {
  const all = safeStorageGet<Highlight[]>(HIGHLIGHTS_KEY, []);
  safeStorageSet(HIGHLIGHTS_KEY, all.filter(h => h.id !== id));
}

function isPdfSource(source: string | null): boolean {
  if (!source) return false;
  return source.toLowerCase().endsWith('.pdf');
}

function PdfViewer({ source }: { source: string }) {
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.2);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  return (
    <div className="flex flex-col items-center">
      <Document
        file={source}
        onLoadSuccess={onDocumentLoadSuccess}
        loading={
          <div className="flex items-center gap-2 py-8 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在加载 PDF...
          </div>
        }
        error={
          <div className="py-8 text-center text-sm text-muted-foreground">
            Failed to load PDF. The file may not be accessible in browser mode.
          </div>
        }
      >
        <Page
          pageNumber={pageNumber}
          scale={scale}
          className="shadow-lg mb-4"
        />
      </Document>
      {numPages > 0 && (
        <div className="flex items-center gap-3 py-3 sticky bottom-0 dark:bg-background/80 bg-transparent backdrop-blur-sm">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => setPageNumber(p => Math.max(1, p - 1))}
            disabled={pageNumber <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums">
            {pageNumber} / {numPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
            disabled={pageNumber >= numPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="w-px h-4 bg-border mx-1" />
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setScale(s => Math.max(0.5, s - 0.2))}
          >
            -
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums w-10 text-center">{Math.round(scale * 100)}%</span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setScale(s => Math.min(3, s + 0.2))}
          >
            +
          </Button>
        </div>
      )}
    </div>
  );
}

interface ReaderPageProps {
  embedded?: boolean;
  documents?: SearchHit[];
  selectedDocument?: SearchHit | null;
  onSelectDocument?: (doc: SearchHit) => void;
}

export function ReaderPage({
  embedded = false,
  documents: externalDocuments,
  selectedDocument: externalSelectedDocument,
  onSelectDocument,
}: ReaderPageProps) {
  const [documents, setDocuments] = useState<SearchHit[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<SearchHit | null>(null);
  const [loading, setLoading] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [selectionPopup, setSelectionPopup] = useState<SelectionPopup | null>(null);
  const [selectionLoading, setSelectionLoading] = useState(false);
  const [selectionResult, setSelectionResult] = useState<string | null>(null);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [annotationsOpen, setAnnotationsOpen] = useState(false);
  const [bookmarkOpen, setBookmarkOpen] = useState(false);
  const [highlightColor, setHighlightColor] = useState<HighlightColor>('yellow');
  const [editingHighlightId, setEditingHighlightId] = useState<string | null>(null);
  const [highlightNote, setHighlightNote] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Bookmark & progress stores
  const { loadBookmarks, addBookmark, removeBookmark, getBookmarksForDoc } = useBookmarkStore();
  const { loadProgress, saveProgress, getProgress } = useReadingProgressStore();

  // Load bookmarks & progress on mount
  useEffect(() => {
    loadBookmarks();
    loadProgress();
  }, []);

  // Load documents on mount
  useEffect(() => {
    if (externalDocuments && externalDocuments.length > 0) {
      setDocuments(externalDocuments);
      return;
    }
    loadDocuments();
  }, [externalDocuments]);

  useEffect(() => {
    if (externalDocuments) {
      setDocuments(externalDocuments);
    }
  }, [externalDocuments]);

  useEffect(() => {
    if (externalSelectedDocument !== undefined) {
      setSelectedDoc(externalSelectedDocument);
    }
  }, [externalSelectedDocument]);

  // Load reading progress & bookmarks when document changes
  useEffect(() => {
    if (!selectedDoc) return;
    setHighlights(loadHighlights(selectedDoc.id));

    // Restore reading progress
    const progress = getProgress(selectedDoc.id);
    if (progress && scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = progress.scrollTop;
    }
  }, [selectedDoc?.id]);

  const currentBookmarks = selectedDoc ? getBookmarksForDoc(selectedDoc.id) : [];

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const results = await api.search('*', 50, 'hybrid');
      setDocuments(results);
    } catch {
      // Use empty list on error
    }
    setLoading(false);
  };

  const handleSelectDoc = (doc: SearchHit) => {
    setSelectedDoc(doc);
    onSelectDocument?.(doc);
    setChatMessages([]);
    setChatOpen(false);
    setAnnotationsOpen(false);
    setHighlights(loadHighlights(doc.id));
  };

  const handleAskDocument = async () => {
    if (!chatInput.trim() || !selectedDoc) return;
    const question = chatInput.trim();
    setChatInput('');

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: question,
      timestamp: new Date().toISOString(),
    };
    setChatMessages(prev => [...prev, userMsg]);
    setChatLoading(true);

    try {
      const result: AskResult = await api.askDocument(
        question,
        selectedDoc.source || selectedDoc.id,
        5
      );

      const aiMsg: ChatMessage = {
        id: `msg-${Date.now()}-ai`,
        role: 'assistant',
        content: result.answer || 'No answer found for this document.',
        timestamp: new Date().toISOString(),
        citations: result.citations,
        context: result.context,
      };
      setChatMessages(prev => [...prev, aiMsg]);
    } catch {
      const errMsg: ChatMessage = {
        id: `msg-${Date.now()}-err`,
        role: 'assistant',
        content: 'Failed to get an answer. Please try again.',
        timestamp: new Date().toISOString(),
      };
      setChatMessages(prev => [...prev, errMsg]);
    }
    setChatLoading(false);
  };

  const handleSummarize = async () => {
    if (!selectedDoc) return;
    setChatOpen(true);
    setChatLoading(true);

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: 'Summarize this document',
      timestamp: new Date().toISOString(),
    };
    setChatMessages(prev => [...prev, userMsg]);

    try {
      const result = await api.askDocument(
        'Please summarize the main points of this document in a concise format.',
        selectedDoc.source || selectedDoc.id,
        5
      );
      const aiMsg: ChatMessage = {
        id: `msg-${Date.now()}-ai`,
        role: 'assistant',
        content: result.answer || 'Unable to generate summary.',
        timestamp: new Date().toISOString(),
        citations: result.citations,
        context: result.context,
      };
      setChatMessages(prev => [...prev, aiMsg]);
    } catch {
      const errMsg: ChatMessage = {
        id: `msg-${Date.now()}-err`,
        role: 'assistant',
        content: 'Failed to generate summary.',
        timestamp: new Date().toISOString(),
      };
      setChatMessages(prev => [...prev, errMsg]);
    }
    setChatLoading(false);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Handle text selection for AI explain/translate
  useEffect(() => {
    const handleSelection = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.toString().trim() || !contentRef.current) {
        return;
      }
      // Check if selection is inside content area
      const range = selection.getRangeAt(0);
      if (!contentRef.current.contains(range.commonAncestorContainer)) return;

      const rect = range.getBoundingClientRect();
      const text = selection.toString().trim();
      if (text.length < 2) return;

      setSelectionPopup({
        text,
        x: rect.left + rect.width / 2,
        y: rect.top - 10,
      });
      setSelectionResult(null);
    };

    const handleMouseDown = (e: MouseEvent) => {
      // Close popup if clicking outside
      if (selectionPopup && !(e.target as HTMLElement).closest('.selection-popup')) {
        setSelectionPopup(null);
        setSelectionResult(null);
      }
    };

    document.addEventListener('mouseup', handleSelection);
    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      document.removeEventListener('mouseup', handleSelection);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [selectionPopup]);

  // Save reading progress on scroll
  const handleScroll = useCallback(() => {
    if (!selectedDoc || !scrollAreaRef.current) return;
    const scrollTop = scrollAreaRef.current.scrollTop;
    saveProgress(selectedDoc.id, scrollTop);
  }, [selectedDoc, saveProgress]);

  // Handle text selection for AI explain/translate
  const handleSelectionAction = async (action: 'explain' | 'translate') => {
    if (!selectionPopup || !selectedDoc) return;
    setSelectionLoading(true);
    setSelectionResult(null);

    const prompt = action === 'explain'
      ? `Please explain the following text in simple, clear terms:\n\n"${selectionPopup.text}"`
      : `Please translate the following text to Chinese (简体中文):\n\n"${selectionPopup.text}"`;

    try {
      const result = await api.askDocument(prompt, selectedDoc.source || selectedDoc.id, 3);
      setSelectionResult(result.answer || 'No result.');
    } catch {
      setSelectionResult('Failed to process. Please try again.');
    }
    setSelectionLoading(false);
  };

  const handleHighlight = () => {
    if (!selectionPopup || !selectedDoc) return;
    const h: Highlight = {
      id: `hl-${Date.now()}`,
      docId: selectedDoc.id,
      text: selectionPopup.text,
      note: '',
      color: 'yellow',
      createdAt: new Date().toISOString(),
    };
    saveHighlight(h);
    setHighlights(prev => [...prev, h]);
    setSelectionPopup(null);
    setSelectionResult(null);
  };

  const handleDeleteHighlight = (id: string) => {
    deleteHighlight(id);
    setHighlights(prev => prev.filter(h => h.id !== id));
  };

  const handleAddBookmark = () => {
    if (!selectedDoc || !scrollAreaRef.current) return;
    addBookmark(
      selectedDoc.id,
      selectedDoc.source || null,
      selectedDoc.title,
      scrollAreaRef.current.scrollTop
    );
  };

  const handleJumpToBookmark = (bm: BookmarkType) => {
    if (!scrollAreaRef.current) return;
    scrollAreaRef.current.scrollTop = bm.scrollTop;
    setBookmarkOpen(false);
  };

  // Render content using react-markdown for safe rendering
  const renderContent = (text: string) => {
    return (
      <Markdown
        components={{
          h1: ({ children }) => <h1 className="text-xl font-bold mt-6 mb-3">{children}</h1>,
          h2: ({ children }) => <h2 className="text-lg font-semibold mt-5 mb-2">{children}</h2>,
          h3: ({ children }) => <h3 className="text-base font-semibold mt-4 mb-2">{children}</h3>,
          p: ({ children }) => <p className="mb-1 leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="ml-4 list-disc">{children}</ul>,
          ol: ({ children }) => <ol className="ml-4 list-decimal">{children}</ol>,
          code: ({ className, children, ...props }) => {
            const isBlock = className?.includes('language-');
            return isBlock ? (
              <pre className="rounded bg-black/30 p-3 my-2 overflow-x-auto text-sm"><code className={className} {...props}>{children}</code></pre>
            ) : (
              <code className="rounded bg-black/20 px-1 text-sm" {...props}>{children}</code>
            );
          },
        }}
      >
        {text}
      </Markdown>
    );
  };

  return (
    <div className="flex h-full">
      {/* Document list sidebar */}
      {!embedded && (
      <div className="w-64 border-r bg-card/40 flex flex-col shrink-0">
        <div className="p-3 border-b">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Documents
          </h2>
        </div>
        <ScrollArea className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : documents.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground text-center">
              No documents yet. Add notes or import files.
            </div>
          ) : (
            <div className="p-1">
              {documents.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => handleSelectDoc(doc)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-[13px] transition-colors cursor-pointer ${
                    selectedDoc?.id === doc.id
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'hover:bg-muted/60 text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate font-medium">{doc.title}</span>
                  </div>
                  {doc.tags.length > 0 && (
                    <div className="flex gap-1 mt-1.5 ml-5.5 flex-wrap">
                      {doc.tags.slice(0, 2).map(tag => (
                        <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedDoc ? (
          <>
            {/* Document header */}
            <div className="px-6 py-4 border-b bg-card/40 flex items-center justify-between">
              <div>
                <h1 className="text-lg font-semibold">{selectedDoc.title}</h1>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span>{selectedDoc.created_at}</span>
                  {selectedDoc.source && <span className="truncate max-w-[200px]">{selectedDoc.source}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSummarize}
                  disabled={chatLoading}
                  className="text-xs gap-1.5"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  Summarize
                </Button>
                <Button
                  variant={annotationsOpen ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAnnotationsOpen(!annotationsOpen)}
                  className="text-xs gap-1.5"
                >
                  <Highlighter className="h-3.5 w-3.5" />
                  Notes ({highlights.length})
                </Button>
                <Button
                  variant={chatOpen ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setChatOpen(!chatOpen)}
                  className="text-xs gap-1.5"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Chat
                </Button>
                <Button
                  variant={bookmarkOpen ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setBookmarkOpen(!bookmarkOpen)}
                  className="text-xs gap-1.5"
                  title="Bookmarks"
                >
                  <Bookmark className="h-3.5 w-3.5" />
                  {currentBookmarks.length > 0 && (
                    <span className="ml-0.5 text-[10px]">{currentBookmarks.length}</span>
                  )}
                </Button>
              </div>
            </div>

            <div className="flex flex-1 overflow-hidden relative">
              {/* Document content */}
              <div
                className={`flex-1 overflow-auto ${chatOpen ? 'border-r' : ''}`}
                ref={scrollAreaRef as unknown as React.RefObject<HTMLDivElement>}
                onScroll={handleScroll}
              >
                <div className="p-6">
                {isPdfSource(selectedDoc.source) ? (
                  <PdfViewer source={selectedDoc.source!} />
                ) : (
                  <article ref={contentRef} className="prose prose-sm dark:prose-invert max-w-none">
                    {renderContent(selectedDoc.content)}
                  </article>
                )}
                <BacklinksPanel noteId={selectedDoc.id} />
                </div>
              </div>

              {/* Selection popup for AI explain/translate */}
              {selectionPopup && selectedDoc && (
                <div
                  className="selection-popup absolute z-50"
                  style={{
                    left: selectionPopup.x,
                    top: selectionPopup.y,
                    transform: 'translate(-50%, -100%)',
                  }}
                >
                  <div className="bg-card border rounded-lg shadow-lg p-1.5 flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs gap-1"
                      onClick={handleHighlight}
                    >
                      <Highlighter className="h-3 w-3" />
                      Highlight
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs gap-1"
                      onClick={() => handleSelectionAction('explain')}
                      disabled={selectionLoading}
                    >
                      <Sparkles className="h-3 w-3" />
                      Explain
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs gap-1"
                      onClick={() => handleSelectionAction('translate')}
                      disabled={selectionLoading}
                    >
                      <Languages className="h-3 w-3" />
                      Translate
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => { setSelectionPopup(null); setSelectionResult(null); }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  {selectionLoading && (
                    <div className="mt-1 bg-card border rounded-lg shadow-lg p-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Processing...
                    </div>
                  )}
                  {selectionResult && (
                    <div className="mt-1 bg-card border rounded-lg shadow-lg p-3 max-w-xs text-xs leading-relaxed">
                      {selectionResult}
                    </div>
                  )}
                </div>
              )}

              {/* Document chat sidebar */}
              {chatOpen && (
                <div className="w-80 flex flex-col bg-card/40 shrink-0">
                  <div className="p-3 border-b flex items-center justify-between">
                    <span className="text-xs font-medium">Document Chat</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setChatOpen(false)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <ScrollArea className="flex-1 p-3">
                    {chatMessages.length === 0 && (
                      <div className="text-xs text-muted-foreground text-center py-8">
                        Ask questions about this document
                      </div>
                    )}
                    {chatMessages.map(msg => (
                      <div key={msg.id} className={`mb-3 ${msg.role === 'user' ? 'text-right' : ''}`}>
                        <div className={`inline-block rounded-lg px-3 py-2 text-[13px] max-w-[90%] ${
                          msg.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}>
                          {msg.content}
                        </div>
                        {msg.citations && msg.citations.length > 0 && (
                          <div className="mt-1 text-[10px] text-muted-foreground">
                            {msg.citations.length} source(s) cited
                          </div>
                        )}
                      </div>
                    ))}
                    {chatLoading && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Thinking...
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </ScrollArea>
                  <div className="p-3 border-t">
                    <form
                      onSubmit={(e) => { e.preventDefault(); handleAskDocument(); }}
                      className="flex items-center gap-2"
                    >
                      <input
                        type="text"
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        placeholder="Ask about this doc..."
                        className="flex-1 dark:bg-background bg-white rounded-md border px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                        disabled={chatLoading}
                      />
                      <Button type="submit" size="icon" disabled={chatLoading || !chatInput.trim()} className="h-7 w-7 shrink-0">
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                    </form>
                  </div>
                </div>
              )}
              {/* Bookmarks sidebar */}
              {bookmarkOpen && (
                <div className="w-64 flex flex-col bg-card/40 shrink-0 border-l">
                  <div className="p-3 border-b flex items-center justify-between">
                    <span className="text-xs font-medium flex items-center gap-1.5">
                      <BookmarkCheck className="h-3.5 w-3.5" />
                      Bookmarks ({currentBookmarks.length})
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={handleAddBookmark}
                        title="Add bookmark at current position"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setBookmarkOpen(false)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <ScrollArea className="flex-1 p-3">
                    {currentBookmarks.length === 0 ? (
                      <div className="text-xs text-muted-foreground text-center py-8">
                        No bookmarks yet. Click + to save your current reading position.
                      </div>
                    ) : (
                      currentBookmarks.map(bm => (
                        <div key={bm.id} className="mb-2 p-2 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
                          <p className="text-xs font-medium line-clamp-2">{bm.title}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Saved {new Date(bm.createdAt).toLocaleDateString()}
                          </p>
                          {bm.note && (
                            <p className="text-[10px] italic text-muted-foreground/70 mt-0.5 line-clamp-2">"{bm.note}"</p>
                          )}
                          <div className="flex items-center gap-1 mt-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 px-1.5 text-[10px]"
                              onClick={() => handleJumpToBookmark(bm)}
                            >
                              Jump
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 px-1.5 text-[10px] text-destructive hover:text-destructive"
                              onClick={() => removeBookmark(bm.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </ScrollArea>
                </div>
              )}
              {/* Annotations sidebar */}
              {annotationsOpen && (
                <div className="w-72 flex flex-col bg-card/40 shrink-0 border-l">
                  <div className="p-3 border-b flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium flex items-center gap-1.5">
                        <MessageCircle className="h-3.5 w-3.5" />
                        Highlights ({highlights.length})
                      </span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setAnnotationsOpen(false)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {/* Color picker */}
                    <div className="flex items-center gap-1.5">
                      <Tag className="h-3 w-3 text-muted-foreground" />
                      <div className="flex gap-1">
                        {(Object.keys(HIGHLIGHT_COLORS) as HighlightColor[]).map(color => (
                          <button
                            key={color}
                            className={`w-4 h-4 rounded-full border-2 transition-transform ${
                              highlightColor === color ? 'scale-125 border-foreground' : 'border-transparent'
                            } ${HIGHLIGHT_COLORS[color].light} dark:${HIGHLIGHT_COLORS[color].dark}`}
                            title={HIGHLIGHT_COLORS[color].label}
                            onClick={() => setHighlightColor(color)}
                          />
                        ))}
                      </div>
                      <span className="text-[10px] text-muted-foreground ml-1">Color</span>
                    </div>
                  </div>
                  <ScrollArea className="flex-1 p-3">
                    {highlights.length === 0 ? (
                      <div className="text-xs text-muted-foreground text-center py-8">
                        Select text and click Highlight to save annotations.
                      </div>
                    ) : (
                      highlights.map(hl => {
                        const colorClass = HIGHLIGHT_COLORS[hl.color as HighlightColor] || HIGHLIGHT_COLORS.yellow;
                        return (
                          <div key={hl.id} className={`mb-3 p-2 rounded-lg border ${colorClass.light} ${colorClass.dark}`}>
                            <p className="text-xs leading-relaxed line-clamp-3">"{hl.text}"</p>
                            {editingHighlightId === hl.id ? (
                              <div className="mt-2 flex flex-col gap-1.5">
                                <textarea
                                  className="w-full text-[11px] dark:bg-background/50 bg-white/50 border rounded px-2 py-1 resize-none"
                                  rows={2}
                                  placeholder="添加注释..."
                                  value={highlightNote}
                                  onChange={e => setHighlightNote(e.target.value)}
                                  autoFocus
                                />
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    className="h-5 px-2 text-[10px]"
                                    onClick={() => {
                                      if (editingHighlightId === hl.id) {
                                        const all = safeStorageGet<Highlight[]>(HIGHLIGHTS_KEY, []);
                                        const updated = all.map(h => h.id === hl.id ? { ...h, note: highlightNote } : h);
                                        safeStorageSet(HIGHLIGHTS_KEY, updated);
                                        setHighlights(updated);
                                        setEditingHighlightId(null);
                                      }
                                    }}
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 px-1.5 text-[10px]"
                                    onClick={() => setEditingHighlightId(null)}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <>
                                {hl.note && (
                                  <p className="text-[10px] italic text-muted-foreground/70 mt-1">"{hl.note}"</p>
                                )}
                                <div className="flex items-center justify-between mt-1.5">
                                  <span className="text-[10px] text-muted-foreground">{new Date(hl.createdAt).toLocaleDateString()}</span>
                                  <div className="flex gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-5 px-1.5 text-[10px]"
                                      onClick={() => {
                                        setEditingHighlightId(hl.id);
                                        setHighlightNote(hl.note);
                                      }}
                                    >
                                      {hl.note ? 'Edit' : 'Note'}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-5 px-1.5 text-[10px] text-destructive hover:text-destructive"
                                      onClick={() => handleDeleteHighlight(hl.id)}
                                    >
                                      Delete
                                    </Button>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })
                    )}
                  </ScrollArea>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-3">
              <BookOpen className="h-10 w-10 text-muted-foreground/40 mx-auto" />
              <h2 className="text-base font-medium text-muted-foreground">Select a document to read</h2>
              <p className="text-xs text-muted-foreground/60 max-w-xs">
                Choose a document from the list to view its content and chat with AI about it.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Backlinks panel — shows notes that reference the current note. */
function BacklinksPanel({ noteId }: { noteId: string }) {
  const [backlinks, setBacklinks] = useState<Array<{ note_id: string; note_title: string; context_snippet: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.listBacklinks(noteId)
      .then((result) => { if (!cancelled) setBacklinks(result); })
      .catch(() => { if (!cancelled) setBacklinks([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [noteId]);

  if (loading) {
    return (
      <div className="mt-8 border-t border-white/10 pt-4">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          查找反向链接…
        </div>
      </div>
    );
  }

  if (backlinks.length === 0) {
    return (
      <div className="mt-8 border-t border-white/10 pt-4">
        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400 flex items-center gap-1.5">
          <Link2 className="h-3.5 w-3.5" />
          反向链接
        </div>
        <p className="mt-2 text-xs text-slate-500">暂无笔记引用此文档。</p>
      </div>
    );
  }

  return (
    <div className="mt-8 border-t border-white/10 pt-4">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-slate-400 hover:text-white transition"
      >
        <Link2 className="h-3.5 w-3.5" />
        反向链接 ({backlinks.length})
        <ChevronRight className={`h-3 w-3 transition ${expanded ? 'rotate-90' : ''}`} />
      </button>

      {expanded && (
        <div className="mt-3 grid gap-2">
          {backlinks.map((bl) => (
            <button
              key={bl.note_id}
              type="button"
              className="rounded-xl border border-white/10 bg-white/4 p-3 text-left transition hover:border-white/20 hover:bg-white/8"
              onClick={() => {
                useKbStore.getState().openDocument({
                  id: bl.note_id,
                  title: bl.note_title,
                  content: bl.context_snippet,
                  score: 0,
                  tags: [],
                  created_at: '',
                  source: null,
                });
              }}
            >
              <div className="text-sm font-medium text-white">{bl.note_title}</div>
              <div className="mt-1 text-xs leading-6 text-slate-400 line-clamp-2">{bl.context_snippet}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
