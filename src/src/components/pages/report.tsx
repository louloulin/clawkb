import { useState } from 'react';
import { FileText, Loader2, Download, Plus, Trash2, Sparkles, Copy, Check, RotateCcw, FileDown, BookOpen, X, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { api } from '@/api/commands';
import { useReportStore, TEMPLATE_INFO, type ReportTemplate } from '@/store/report-store';
import type { SearchHit } from '@/api';
import { useEffect } from 'react';

type Step = 'select' | 'outline' | 'content' | 'export';

export function ReportPage() {
  const [step, setStep] = useState<Step>('select');
  const [docs, setDocs] = useState<SearchHit[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [generatingOutline, setGeneratingOutline] = useState(false);
  const [generatingSectionId, setGeneratingSectionId] = useState<string | null>(null);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [showAddSection, setShowAddSection] = useState(false);
  const [copied, setCopied] = useState(false);

  const {
    selectedDocs, template, outline, sections,
    selectDoc, deselectDoc, clearDocs, setTemplate,
    generateOutline, generateSection,
    deleteSection, addCustomSection, exportMarkdown, reset,
  } = useReportStore();

  // Load all documents
  useEffect(() => {
    loadDocs();
  }, []);

  const loadDocs = async () => {
    setLoadingDocs(true);
    try {
      const results = await api.search('*', 50, 'hybrid');
      setDocs(results);
    } catch {
      setDocs([]);
    }
    setLoadingDocs(false);
  };

  const filteredDocs = docs.filter(d =>
    d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.content?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleGenerateOutline = async () => {
    setGeneratingOutline(true);
    await generateOutline();
    setGeneratingOutline(false);
    setStep('outline');
  };

  const handleGenerateSection = async (sectionId: string, title: string) => {
    setGeneratingSectionId(sectionId);
    await generateSection(title);
    setGeneratingSectionId(null);
  };

  const handleExportMarkdown = () => {
    const md = exportMarkdown();
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(exportMarkdown());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    reset();
    setStep('select');
    setNewSectionTitle('');
    setShowAddSection(false);
  };

  const templates: ReportTemplate[] = ['blank', 'article', 'meeting', 'proposal', 'research', 'summary'];

  return (
    <div className="flex h-full">
      {/* Left Panel — Document Selection */}
      <div className="w-80 border-r flex flex-col shrink-0">
        <div className="p-3 border-b space-y-2">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">Select Documents</h3>
          </div>
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search documents..."
            className="h-8 text-xs"
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">
              {selectedDocs.length} selected
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[10px]"
              onClick={() => { selectDoc({ id: 'all', title: 'All Documents', content: '', score: 1, tags: [], created_at: '', source: null }); setStep('outline'); }}
            >
              Select All
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {loadingDocs ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : filteredDocs.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No documents found</p>
            ) : (
              filteredDocs.map(doc => {
                const isSelected = selectedDocs.some(d => d.id === doc.id);
                return (
                  <button
                    key={doc.id}
                    onClick={() => isSelected ? deselectDoc(doc.id) : selectDoc(doc)}
                    className={`w-full text-left p-2 rounded-lg border transition-colors ${
                      isSelected
                        ? 'bg-primary/10 border-primary/30'
                        : 'bg-card hover:bg-muted/30 border-border/50'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30'
                      }`}>
                        {isSelected && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium line-clamp-1">{doc.title}</p>
                        <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                          {doc.content?.slice(0, 60)}...
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>

        {/* Template selection */}
        <div className="p-3 border-t space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Report Template</p>
          <div className="grid grid-cols-3 gap-1">
            {templates.map(t => (
              <button
                key={t}
                onClick={() => setTemplate(t)}
                className={`p-1.5 rounded-lg border text-center transition-colors ${
                  template === t
                    ? 'bg-primary/10 border-primary/30'
                    : 'bg-card hover:bg-muted/30 border-border/50'
                }`}
                title={TEMPLATE_INFO[t].description}
              >
                <span className="text-sm">{TEMPLATE_INFO[t].icon}</span>
                <p className="text-[9px] mt-0.5 leading-tight">{TEMPLATE_INFO[t].label}</p>
              </button>
            ))}
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              className="flex-1 h-8 text-xs gap-1"
              onClick={handleGenerateOutline}
              disabled={generatingOutline || docs.length === 0}
            >
              {generatingOutline ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              Generate Outline
            </Button>
            {selectedDocs.length > 0 && (
              <Button size="sm" variant="ghost" className="h-8 px-2" onClick={clearDocs}>
                <RotateCcw className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Right Panel — Report Editor */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-base font-semibold">Report Generator</h2>
              <p className="text-xs text-muted-foreground">
                {TEMPLATE_INFO[template].icon} {TEMPLATE_INFO[template].label} template
                {selectedDocs.length > 0 && ` · ${selectedDocs.length} source(s)`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Step indicators */}
            <div className="flex items-center gap-1 mr-3">
              {(['select', 'outline', 'content'] as Step[]).map((s, i) => (
                <div key={s} className="flex items-center gap-1">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium ${
                    step === s ? 'bg-primary text-primary-foreground' :
                    (s === 'select' && step !== 'select') || (s === 'outline' && step === 'content') || (s === 'content')
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {i + 1}
                  </div>
                  {i < 2 && <div className="w-4 h-px bg-border" />}
                </div>
              ))}
            </div>

            {step === 'content' && sections.length > 0 && (
              <>
                <Button variant="outline" size="sm" className="text-xs gap-1" onClick={handleCopyMarkdown}>
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
                <Button size="sm" className="text-xs gap-1" onClick={handleExportMarkdown}>
                  <Download className="h-3 w-3" />
                  Export MD
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" onClick={handleReset} className="text-xs gap-1">
              <RotateCcw className="h-3 w-3" />
              New
            </Button>
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-6 max-w-3xl mx-auto">
            {/* Step 1: Outline */}
            {step === 'outline' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Report Outline</h3>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs gap-1"
                    onClick={() => setShowAddSection(true)}
                  >
                    <Plus className="h-3 w-3" />
                    Add Section
                  </Button>
                </div>

                {showAddSection && (
                  <div className="flex gap-2 mb-4">
                    <Input
                      value={newSectionTitle}
                      onChange={e => setNewSectionTitle(e.target.value)}
                      placeholder="Section title..."
                      className="h-8 text-xs flex-1"
                      onKeyDown={e => {
                        if (e.key === 'Enter' && newSectionTitle.trim()) {
                          addCustomSection(newSectionTitle.trim());
                          setNewSectionTitle('');
                          setShowAddSection(false);
                        }
                        if (e.key === 'Escape') setShowAddSection(false);
                      }}
                      autoFocus
                    />
                    <Button
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => {
                        if (newSectionTitle.trim()) {
                          addCustomSection(newSectionTitle.trim());
                          setNewSectionTitle('');
                          setShowAddSection(false);
                        }
                      }}
                    >
                      Add
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2"
                      onClick={() => setShowAddSection(false)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}

                {outline.length === 0 && sections.length === 0 ? (
                  <div className="text-center py-12">
                    <Sparkles className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                      No outline generated. Check your documents and click "Generate Outline".
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={handleGenerateOutline}
                      disabled={generatingOutline}
                    >
                      {generatingOutline ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                      Generate
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(outline.length > 0 ? outline.map((title, i) => ({
                      id: sections[i]?.id || `outline-${i}`,
                      title,
                      content: sections[i]?.content || '',
                    })) : sections).map((section) => (
                      <div key={section.id} className="p-3 rounded-lg border bg-card">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <CheckSquare className="h-3.5 w-3.5 text-muted-foreground" />
                            <h4 className="text-sm font-medium">{section.title}</h4>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-1.5 text-[10px] gap-1"
                              onClick={() => handleGenerateSection(section.id, section.title)}
                              disabled={generatingSectionId === section.id}
                            >
                              {generatingSectionId === section.id
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : <Sparkles className="h-3 w-3" />}
                              {section.content ? 'Regenerate' : 'Generate'}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => deleteSection(section.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>

                        {generatingSectionId === section.id ? (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Generating content...
                          </div>
                        ) : section.content ? (
                          <div>
                            <p className="text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
                              {section.content.length > 300
                                ? section.content.slice(0, 300) + '...'
                                : section.content}
                            </p>
                            {section.content.length > 300 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 mt-1 text-[10px]"
                                onClick={() => setStep('content')}
                              >
                                View full content →
                              </Button>
                            )}
                          </div>
                        ) : (
                          <p className="text-[10px] text-muted-foreground italic">No content yet. Click "Generate" to fill.</p>
                        )}
                      </div>
                    ))}

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full h-8 mt-2 text-xs gap-1"
                      onClick={() => setStep('content')}
                      disabled={sections.every(s => !s.content)}
                    >
                      <FileDown className="h-3 w-3" />
                      View Full Report
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Full Content View */}
            {step === 'content' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Full Report</h3>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs gap-1"
                      onClick={() => setStep('outline')}
                    >
                      <RotateCcw className="h-3 w-3" />
                      Edit Outline
                    </Button>
                    <Button
                      size="sm"
                      className="text-xs gap-1"
                      onClick={handleExportMarkdown}
                    >
                      <Download className="h-3 w-3" />
                      Download Markdown
                    </Button>
                  </div>
                </div>

                <div className="bg-card border rounded-xl p-6 space-y-6">
                  {sections.map((section, i) => (
                    <div key={section.id}>
                      {i > 0 && <div className="border-t mb-4" />}
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold">{section.title}</h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1.5 text-[10px] gap-1"
                          onClick={() => handleGenerateSection(section.id, section.title)}
                          disabled={generatingSectionId === section.id}
                        >
                          {generatingSectionId === section.id
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <Sparkles className="h-3 w-3" />}
                          Regenerate
                        </Button>
                      </div>
                      {generatingSectionId === section.id ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Generating...
                        </div>
                      ) : section.content ? (
                        <p className="text-xs leading-7 whitespace-pre-wrap">{section.content}</p>
                      ) : (
                        <p className="text-[10px] text-muted-foreground italic">No content.</p>
                      )}
                    </div>
                  ))}
                </div>

                {sections.every(s => !s.content) && (
                  <div className="text-center py-8">
                    <p className="text-xs text-muted-foreground mb-3">Generate content for each section from the outline.</p>
                    <Button
                      size="sm"
                      className="gap-1"
                      onClick={async () => {
                        for (const s of sections) {
                          setGeneratingSectionId(s.id);
                          await generateSection(s.title);
                          setGeneratingSectionId(null);
                        }
                      }}
                      disabled={generatingSectionId !== null}
                    >
                      {generatingSectionId ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                      Generate All Sections
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Step 0: Empty state */}
            {step === 'select' && (
              <div className="text-center py-16">
                <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-4" />
                <h3 className="text-base font-medium mb-2">Generate a Report</h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-xs mx-auto">
                  Select documents from your knowledge base, choose a template, and let AI generate a structured report.
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {templates.map(t => (
                    <Badge
                      key={t}
                      variant={template === t ? 'default' : 'outline'}
                      className="cursor-pointer text-xs gap-1"
                      onClick={() => setTemplate(t)}
                    >
                      {TEMPLATE_INFO[t].icon} {TEMPLATE_INFO[t].label}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
