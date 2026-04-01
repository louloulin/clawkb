import { useState } from 'react';
import { Upload, Loader2, File, CheckCircle2, XCircle, Folder, Globe, Link } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/api';
import type { ImportResult, FetchUrlResult } from '@/api';
import { useToast } from '@/hooks/use-toast';

export function ImportPage() {
  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-1">Import</h2>
        <p className="text-sm text-muted-foreground">Import files, directories, or web pages into your knowledge base</p>
      </div>

      <Tabs defaultValue="file">
        <TabsList className="mb-6 bg-muted/40 rounded-xl">
          <TabsTrigger value="file" className="rounded-lg text-[13px] gap-1.5">
            <Upload className="h-3.5 w-3.5" /> File / Directory
          </TabsTrigger>
          <TabsTrigger value="url" className="rounded-lg text-[13px] gap-1.5">
            <Globe className="h-3.5 w-3.5" /> Web Page
          </TabsTrigger>
        </TabsList>

        <TabsContent value="file">
          <FileImportTab />
        </TabsContent>
        <TabsContent value="url">
          <UrlFetchTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FileImportTab() {
  const [path, setPath] = useState('');
  const [tags, setTags] = useState('');
  const [recursive, setRecursive] = useState(false);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);
  const { toast } = useToast();

  const handleImport = async () => {
    if (!path.trim()) return;
    setImporting(true);
    setResults([]);
    try {
      const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
      const isDir = path.endsWith('/');
      const res = isDir
        ? await api.importDirectory(path, tagList, recursive)
        : [await api.importFile(path, tagList)];
      await api.commit();
      setResults(res);
      const ok = res.filter(r => r.success).length;
      const fail = res.length - ok;
      toast({ title: 'Import complete', description: `${ok} succeeded, ${fail} failed` });
    } catch (e) {
      toast({ title: 'Import failed', description: String(e), variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  const successCount = results.filter(r => r.success).length;
  const failCount = results.length - successCount;

  return (
    <>
      <div className="space-y-4 mb-8">
        <div>
          <Label className="mb-2 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Path</Label>
          <div className="relative">
            {path.endsWith('/') ? <Folder className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /> : <File className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />}
            <Input
              type="text"
              value={path}
              onChange={e => setPath(e.target.value)}
              placeholder="File or directory path (end with / for dir)"
              className="pl-10 rounded-xl border-border/50 h-10"
            />
          </div>
        </div>
        <div>
          <Label className="mb-2 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Tags</Label>
          <Input
            type="text"
            value={tags}
            onChange={e => setTags(e.target.value)}
            placeholder="Comma separated"
            className="rounded-xl border-border/50 h-10"
          />
        </div>
        <div className="flex items-center gap-3">
          <Checkbox checked={recursive} onCheckedChange={(c) => setRecursive(c === true)} />
          <Label className="text-sm text-muted-foreground cursor-pointer">Recursive (for directories)</Label>
        </div>
        <Button onClick={handleImport} disabled={importing || !path.trim()} className="gap-2 rounded-xl h-10 px-6">
          {importing ? <><Loader2 className="h-4 w-4 animate-spin" /> Importing...</> : <><Upload className="h-4 w-4" /> Import</>}
        </Button>
      </div>

      {results.length > 0 && <ResultSummary successCount={successCount} failCount={failCount} results={results.map(r => ({ title: r.title, success: r.success, error: r.error }))} />}
    </>
  );
}

function UrlFetchTab() {
  const [url, setUrl] = useState('');
  const [tags, setTags] = useState('');
  const [fetching, setFetching] = useState(false);
  const [results, setResults] = useState<FetchUrlResult[]>([]);
  const { toast } = useToast();

  const handleFetch = async () => {
    if (!url.trim()) return;
    setFetching(true);
    setResults([]);
    try {
      const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
      const res = await api.fetchUrl(url, tagList);
      await api.commit();
      setResults([res]);
      if (res.success) {
        toast({ title: 'Page saved', description: `"${res.title}" (${res.content_length} chars)` });
      } else {
        toast({ title: 'Fetch failed', description: res.error || 'Unknown error', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Fetch failed', description: String(e), variant: 'destructive' });
    } finally {
      setFetching(false);
    }
  };

  const successCount = results.filter(r => r.success).length;
  const failCount = results.length - successCount;

  return (
    <>
      <div className="space-y-4 mb-8">
        <div>
          <Label className="mb-2 block text-xs font-medium text-muted-foreground uppercase tracking-wider">URL</Label>
          <div className="relative">
            <Link className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleFetch()}
              placeholder="https://example.com/article"
              className="pl-10 rounded-xl border-border/50 h-10"
            />
          </div>
        </div>
        <div>
          <Label className="mb-2 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Tags</Label>
          <Input
            type="text"
            value={tags}
            onChange={e => setTags(e.target.value)}
            placeholder="Comma separated"
            className="rounded-xl border-border/50 h-10"
          />
        </div>
        <Button onClick={handleFetch} disabled={fetching || !url.trim()} className="gap-2 rounded-xl h-10 px-6">
          {fetching ? <><Loader2 className="h-4 w-4 animate-spin" /> Fetching...</> : <><Globe className="h-4 w-4" /> Save Web Page</>}
        </Button>
      </div>

      {results.length > 0 && <ResultSummary successCount={successCount} failCount={failCount} results={results.map(r => ({ title: r.success ? r.title : r.url, success: r.success, error: r.error }))} />}
    </>
  );
}

function ResultSummary({ successCount, failCount, results }: {
  successCount: number;
  failCount: number;
  results: { title: string; success: boolean; error?: string }[];
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg">
          <CheckCircle2 className="h-3 w-3" /> {successCount} ok
        </span>
        {failCount > 0 && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive bg-destructive/10 px-2.5 py-1 rounded-lg">
            <XCircle className="h-3 w-3" /> {failCount} failed
          </span>
        )}
      </div>
      <div className="space-y-1.5">
        {results.map((r, i) => (
          <div key={i} className={`rounded-xl p-3 flex items-center gap-3 text-sm ${r.success ? 'bg-card border border-border/50' : 'bg-destructive/5 border border-destructive/20'}`}>
            {r.success ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" /> : <XCircle className="h-4 w-4 text-destructive shrink-0" />}
            <div className="min-w-0">
              <div className="font-medium truncate text-[13px]">{r.title}</div>
              {!r.success && r.error && <div className="text-xs text-destructive mt-0.5">{r.error}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
