import { useState } from 'react';
import { FolderOpen, Plus, Database, FileJson, FileText, Code, Sparkles, Cpu, Globe, Key, Slider, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useKbStore } from '@/store/kb-store';
import { useAiStore } from '@/store/ai-store';
import { formatBytes } from '@/lib/format';
import { downloadFile } from '@/lib/format';
import { api } from '@/api';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function SettingsPage() {
  const { stats, kbPath, isKbOpen, openKb, createKb } = useKbStore();
  const aiStore = useAiStore();
  const [path, setPath] = useState('');
  const { toast } = useToast();

  const handleApplyAiConfig = async () => {
    try {
      await aiStore.applyConfig();
      toast({
        title: 'AI Configuration Applied',
        description: `Embedding: ${aiStore.embedding.provider}/${aiStore.embedding.model}`,
      });
    } catch (e) {
      toast({ title: 'Configuration Failed', description: String(e), variant: 'destructive' });
    }
  };

  const handleExport = async (format: 'md' | 'html' | 'json') => {
    try {
      const content = await api.export(format);
      const ext = { md: 'md', html: 'html', json: 'json' }[format];
      const mime = { md: 'text/markdown', html: 'text/html', json: 'application/json' }[format];
      downloadFile(content, `clawkb-export.${ext}`, mime);
      toast({ title: 'Export complete', description: `Exported as ${format.toUpperCase()}` });
    } catch (e) {
      toast({ title: 'Export failed', description: String(e), variant: 'destructive' });
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-1">Settings</h2>
        <p className="text-sm text-muted-foreground">Manage your knowledge base and preferences</p>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="mb-6 bg-muted/40 rounded-xl">
          <TabsTrigger value="general" className="rounded-lg text-[13px]">General</TabsTrigger>
          <TabsTrigger value="ai" className="rounded-lg text-[13px]">AI Models</TabsTrigger>
          <TabsTrigger value="export" className="rounded-lg text-[13px]">Export</TabsTrigger>
          <TabsTrigger value="about" className="rounded-lg text-[13px]">About</TabsTrigger>
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-4">
          {/* KB Info */}
          <div className="rounded-xl bg-card border border-border/50 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Database className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">Knowledge Base</h3>
            </div>
            {isKbOpen && stats ? (
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-[13px]">
                <InfoRow label="Path" value={<code className="text-[11px] bg-muted/60 px-1.5 py-0.5 rounded-md break-all">{kbPath}</code>} />
                <InfoRow label="Documents" value={stats.frame_count.toString()} />
                <InfoRow label="Size" value={formatBytes(stats.size_bytes)} />
                <InfoRow label="Payload" value={formatBytes(stats.payload_bytes)} />
                <InfoRow label="Compression" value={`${stats.compression_ratio_percent.toFixed(1)}%`} />
                <InfoRow label="Lex Index" value={stats.has_lex_index ? 'Active' : 'Inactive'} />
                <InfoRow label="Vec Index" value={stats.has_vec_index ? 'Active' : 'Inactive'} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No knowledge base open</p>
            )}
          </div>

          {/* Open/Create */}
          <div className="rounded-xl bg-card border border-border/50 p-5">
            <h3 className="text-sm font-medium mb-1">Open / Create</h3>
            <p className="text-xs text-muted-foreground mb-3">Open an existing or create a new knowledge base</p>
            <div className="flex gap-2">
              <Input
                type="text"
                value={path}
                onChange={e => setPath(e.target.value)}
                placeholder="/path/to/knowledge.mv2"
                className="flex-1 rounded-xl border-border/50 h-9 text-[13px]"
              />
              <Button onClick={() => openKb(path)} className="gap-1.5 rounded-xl h-9 text-[13px]">
                <FolderOpen className="h-3.5 w-3.5" /> Open
              </Button>
              <Button variant="secondary" onClick={() => createKb(path)} className="gap-1.5 rounded-xl h-9 text-[13px]">
                <Plus className="h-3.5 w-3.5" /> Create
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* AI Models Tab */}
        <TabsContent value="ai" className="space-y-4">
          {/* Embedding Model */}
          <div className="rounded-xl bg-card border border-border/50 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Cpu className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">Embedding Model</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-4">Choose how documents are converted to vector embeddings for semantic search.</p>

            {/* Provider Selection */}
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">Provider</label>
                <Select value={aiStore.embedding.provider} onValueChange={(v) => aiStore.setEmbeddingProvider(v as 'local' | 'openai' | 'custom')}>
                  <SelectTrigger className="h-9 rounded-xl border-border/50 text-[13px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local">
                      <div className="flex items-center gap-2">
                        <Cpu className="h-3.5 w-3.5" />
                        <span>Local (ONNX) — No API key needed</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="openai">
                      <div className="flex items-center gap-2">
                        <Globe className="h-3.5 w-3.5" />
                        <span>OpenAI API</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="custom">
                      <div className="flex items-center gap-2">
                        <Globe className="h-3.5 w-3.5" />
                        <span>Custom API Endpoint</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Model Selection */}
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">Model</label>
                {aiStore.embedding.provider === 'local' ? (
                  <Select value={aiStore.embedding.model} onValueChange={aiStore.setEmbeddingModel}>
                    <SelectTrigger className="h-9 rounded-xl border-border/50 text-[13px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bge-small-en">BGE Small EN (~120MB, fast)</SelectItem>
                      <SelectItem value="bge-base-en">BGE Base EN (~420MB, balanced)</SelectItem>
                      <SelectItem value="bge-small-zh">BGE Small ZH (~120MB, Chinese)</SelectItem>
                      <SelectItem value="nomic-embed">Nomic Embed Text (~280MB)</SelectItem>
                      <SelectItem value="gte-small">GTE Small (~240MB)</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={aiStore.embedding.model}
                    onChange={e => aiStore.setEmbeddingModel(e.target.value)}
                    placeholder="e.g., text-embedding-3-small"
                    className="h-9 rounded-xl border-border/50 text-[13px]"
                  />
                )}
              </div>

              {/* API Key (for OpenAI/Custom) */}
              {aiStore.embedding.provider !== 'local' && (
                <div>
                  <label className="text-xs text-muted-foreground block mb-1.5 flex items-center gap-1">
                    <Key className="h-3 w-3" /> API Key
                  </label>
                  <Input
                    type="password"
                    value={aiStore.embedding.apiKey}
                    onChange={e => aiStore.setApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="h-9 rounded-xl border-border/50 text-[13px]"
                  />
                </div>
              )}

              {/* Custom API Base (for Custom provider) */}
              {aiStore.embedding.provider === 'custom' && (
                <div>
                  <label className="text-xs text-muted-foreground block mb-1.5">
                    <Globe className="h-3 w-3 inline mr-1" /> API Base URL
                  </label>
                  <Input
                    value={aiStore.embedding.apiBase}
                    onChange={e => aiStore.setApiBase(e.target.value)}
                    placeholder="https://api.openai.com/v1"
                    className="h-9 rounded-xl border-border/50 text-[13px]"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Ask Model */}
          <div className="rounded-xl bg-card border border-border/50 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">Ask / Chat Model</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-4">Configure the LLM used for AI question answering and chat. Uses memvid's built-in RAG pipeline.</p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">Model</label>
                <Select value={aiStore.ask.model} onValueChange={(v) => aiStore.setAskModel(v as 'default' | 'gpt-4o-mini' | 'gpt-4o' | 'claude-3-haiku' | 'claude-3-sonnet' | 'custom')}>
                  <SelectTrigger className="h-9 rounded-xl border-border/50 text-[13px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">
                      <div className="flex items-center gap-2">
                        <Cpu className="h-3.5 w-3.5" />
                        <span>Default (local Ollama if available)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="gpt-4o-mini">
                      <div className="flex items-center gap-2">
                        <Globe className="h-3.5 w-3.5" />
                        <span>GPT-4o Mini (fast, affordable)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="gpt-4o">
                      <div className="flex items-center gap-2">
                        <Globe className="h-3.5 w-3.5" />
                        <span>GPT-4o (powerful, slower)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="claude-3-haiku">
                      <div className="flex items-center gap-2">
                        <Globe className="h-3.5 w-3.5" />
                        <span>Claude 3 Haiku (fast)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="claude-3-sonnet">
                      <div className="flex items-center gap-2">
                        <Globe className="h-3.5 w-3.5" />
                        <span>Claude 3 Sonnet (balanced)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="custom">
                      <div className="flex items-center gap-2">
                        <Globe className="h-3.5 w-3.5" />
                        <span>Custom Model</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {aiStore.ask.model === 'custom' && (
                <div>
                  <label className="text-xs text-muted-foreground block mb-1.5">Custom Model Name</label>
                  <Input
                    value={aiStore.ask.customModelName}
                    onChange={e => aiStore.setCustomModelName(e.target.value)}
                    placeholder="e.g., custom-model-name"
                    className="h-9 rounded-xl border-border/50 text-[13px]"
                  />
                </div>
              )}

              {/* Temperature */}
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5 flex items-center gap-1">
                  <Slider className="h-3 w-3" /> Temperature: {aiStore.ask.temperature.toFixed(1)}
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={aiStore.ask.temperature}
                  onChange={e => aiStore.setTemperature(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>Precise</span>
                  <span>Creative</span>
                </div>
              </div>

              {/* TopK */}
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">Context Chunks (topK): {aiStore.ask.topK}</label>
                <Select value={String(aiStore.ask.topK)} onValueChange={(v) => aiStore.setTopK(parseInt(v))}>
                  <SelectTrigger className="h-9 rounded-xl border-border/50 text-[13px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[4, 6, 8, 10, 12, 16, 20].map(k => (
                      <SelectItem key={k} value={String(k)}>{k} chunks</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground/60 mt-1">Number of context chunks retrieved for each AI answer.</p>
              </div>
            </div>
          </div>

          {/* Apply Button */}
          <Button
            onClick={handleApplyAiConfig}
            className="w-full gap-2 rounded-xl h-10"
            disabled={aiStore.embedding.provider !== 'local' && !aiStore.embedding.apiKey}
          >
            <Save className="h-4 w-4" />
            Apply AI Configuration
          </Button>
        </TabsContent>

        {/* Export Tab */}
        <TabsContent value="export">
          <div className="rounded-xl bg-card border border-border/50 p-5">
            <h3 className="text-sm font-medium mb-1">Export Knowledge Base</h3>
            <p className="text-xs text-muted-foreground mb-4">Export all documents to a single file</p>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => handleExport('md')} className="flex flex-col items-center gap-2 py-4 rounded-xl border border-border/50 hover:bg-muted/40 transition-colors cursor-pointer">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <span className="text-[13px] font-medium">Markdown</span>
              </button>
              <button onClick={() => handleExport('html')} className="flex flex-col items-center gap-2 py-4 rounded-xl border border-border/50 hover:bg-muted/40 transition-colors cursor-pointer">
                <Code className="h-5 w-5 text-muted-foreground" />
                <span className="text-[13px] font-medium">HTML</span>
              </button>
              <button onClick={() => handleExport('json')} className="flex flex-col items-center gap-2 py-4 rounded-xl border border-border/50 hover:bg-muted/40 transition-colors cursor-pointer">
                <FileJson className="h-5 w-5 text-muted-foreground" />
                <span className="text-[13px] font-medium">JSON</span>
              </button>
            </div>
          </div>
        </TabsContent>

        {/* About Tab */}
        <TabsContent value="about">
          <div className="rounded-xl bg-card border border-border/50 p-5">
            <h3 className="text-sm font-medium mb-4">About ClawKB</h3>
            <p className="text-[13px] text-muted-foreground mb-4">
              <strong className="text-foreground">ClawKB</strong> — Local-first Personal Knowledge Base
            </p>
            <div className="h-px bg-border/50 mb-4" />
            <div className="grid grid-cols-2 gap-y-2 text-[13px]">
              <span className="text-muted-foreground">Version</span><span>0.1.0</span>
              <span className="text-muted-foreground">Engine</span><span>memvid-core 2.0</span>
              <span className="text-muted-foreground">Framework</span><span>Tauri v2 + React 19</span>
              <span className="text-muted-foreground">UI</span><span>shadcn/ui + TailwindCSS 4</span>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground/60 uppercase tracking-wider">{label}</div>
      <div className="font-medium mt-0.5">{value}</div>
    </div>
  );
}
