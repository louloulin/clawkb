import { useState } from 'react';
import { FolderOpen, Plus, Database, FileJson, FileText, Code } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useKbStore } from '@/store/kb-store';
import { formatBytes } from '@/lib/format';
import { downloadFile } from '@/lib/format';
import { api } from '@/api';
import { useToast } from '@/hooks/use-toast';

export function SettingsPage() {
  const { stats, kbPath, isKbOpen, openKb, createKb } = useKbStore();
  const [path, setPath] = useState('');
  const { toast } = useToast();

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
