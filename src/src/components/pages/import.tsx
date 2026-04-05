import { useState, useCallback } from 'react';
import { Upload, Loader2, File, CheckCircle2, XCircle, Folder, Globe, Link, Music, Image, Scan, Clipboard, AlertCircle, Hash, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/api';
import type { ImportResult, FetchUrlResult } from '@/api';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
          <TabsTrigger value="media" className="rounded-lg text-[13px] gap-1.5">
            <Music className="h-3.5 w-3.5" /> Media
          </TabsTrigger>
          <TabsTrigger value="screenshot" className="rounded-lg text-[13px] gap-1.5">
            <Scan className="h-3.5 w-3.5" /> Screenshot
          </TabsTrigger>
        </TabsList>

        <TabsContent value="file">
          <FileImportTab />
        </TabsContent>
        <TabsContent value="url">
          <UrlFetchTab />
        </TabsContent>
        <TabsContent value="media">
          <MediaImportTab />
        </TabsContent>
        <TabsContent value="screenshot">
          <ScreenshotTab />
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

  const supportedFormats = [
    { ext: 'PDF', name: 'PDF Document' },
    { ext: 'DOCX', name: 'Word Document' },
    { ext: 'PPTX', name: 'PowerPoint' },
    { ext: 'XLSX', name: 'Excel Spreadsheet' },
    { ext: 'EPUB', name: 'E-Book' },
    { ext: 'RTF', name: 'Rich Text' },
    { ext: 'MD', name: 'Markdown' },
    { ext: 'TXT', name: 'Plain Text' },
    { ext: 'HTML', name: 'Web Page' },
    { ext: 'CSV', name: 'CSV Data' },
    { ext: 'JSON', name: 'JSON Data' },
  ];

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

        {/* Supported formats */}
        <div className="rounded-lg bg-muted/30 p-3">
          <p className="text-[11px] text-muted-foreground mb-2 font-medium">Supported formats:</p>
          <div className="flex flex-wrap gap-1.5">
            {supportedFormats.map(fmt => (
              <span key={fmt.ext} className="inline-flex items-center px-1.5 py-0.5 rounded bg-background/60 text-[10px] font-mono text-muted-foreground">
                .{fmt.ext}
              </span>
            ))}
          </div>
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

function ScreenshotTab() {
  const [imageData, setImageData] = useState<string>('');
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');
  const [language, setLanguage] = useState('eng');
  const [ocrResult, setOcrResult] = useState<{ text: string; success: boolean; error: string | null } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importedResult, setImportedResult] = useState<ImportResult | null>(null);
  const { toast } = useToast();

  // Handle paste event
  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (!blob) continue;

        // Convert blob to base64
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          setImageData(result); // data:image/png;base64,...
          setOcrResult(null);
          setImportedResult(null);
          toast({ title: 'Image pasted', description: 'Screenshot captured. Click "OCR & Preview" to extract text.' });
        };
        reader.readAsDataURL(blob);
        break;
      }
    }
  }, [toast]);

  // Register paste listener
  useState(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('paste', handlePaste as any);
      return () => window.removeEventListener('paste', handlePaste as any);
    }
  });

  const hasImage = imageData.length > 0;

  const handleOcr = async () => {
    if (!imageData) return;
    setProcessing(true);
    try {
      // Strip data URL prefix to get raw base64
      const rawBase64 = imageData.replace(/^data:image\/\w+;base64,/, '');
      const result = await api.ocrImage(rawBase64, language);
      setOcrResult(result);
      if (!result.success) {
        toast({ title: 'OCR Failed', description: result.error || 'Unknown error', variant: 'destructive' });
      } else if (!result.text.trim()) {
        toast({ title: 'No text found', description: 'The image may not contain readable text.', variant: 'default' });
      } else {
        toast({ title: 'OCR Complete', description: `Extracted ${result.text.length} characters` });
      }
    } catch (e) {
      toast({ title: 'OCR Error', description: String(e), variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const handleImport = async () => {
    if (!ocrResult?.success || !ocrResult?.text) return;
    setImporting(true);
    try {
      const rawBase64 = imageData.replace(/^data:image\/\w+;base64,/, '');
      const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
      const result = await api.importScreenshot(rawBase64, title, tagList, language);
      setImportedResult(result);
      await api.commit();
      if (result.success) {
        toast({ title: 'Screenshot Imported', description: `"${result.title}" saved to knowledge base` });
      } else {
        toast({ title: 'Import Failed', description: result.error || 'Unknown error', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Import Failed', description: String(e), variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  const handleClear = () => {
    setImageData('');
    setOcrResult(null);
    setImportedResult(null);
    setTitle('');
  };

  return (
    <div className="space-y-4">
      {/* Instructions */}
      <div className="rounded-xl bg-card border border-border/50 p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Clipboard className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-medium mb-1">Screenshot OCR</h3>
            <p className="text-[12px] text-muted-foreground">
              Take a screenshot (Cmd+Shift+4 on Mac) and paste it here (Cmd+V or Ctrl+V), then click <strong>OCR & Preview</strong> to extract text. Supports Chinese, English, Japanese, Korean, and more.
            </p>
          </div>
        </div>

        {/* Language selector */}
        <div className="mt-3">
          <label className="text-[11px] text-muted-foreground block mb-1">OCR Language</label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="h-8 rounded-lg border-border/50 text-[12px] w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="eng">English</SelectItem>
              <SelectItem value="chi_sim">Chinese (Simplified)</SelectItem>
              <SelectItem value="chi_tra">Chinese (Traditional)</SelectItem>
              <SelectItem value="jpn">Japanese</SelectItem>
              <SelectItem value="kor">Korean</SelectItem>
              <SelectItem value="eng+chi_sim">English + Chinese</SelectItem>
              <SelectItem value="eng+jpn">English + Japanese</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Image Preview / Paste Zone */}
      <div
        className={`rounded-xl border-2 border-dashed transition-colors ${
          hasImage ? 'border-primary/30 bg-primary/5' : 'border-border/50 bg-muted/20'
        }`}
        style={{ minHeight: '160px' }}
      >
        {hasImage ? (
          <div className="p-4 space-y-3">
            {/* Image preview */}
            <img
              src={imageData}
              alt="Screenshot"
              className="max-h-48 rounded-lg object-contain mx-auto"
            />
            <div className="flex gap-2 justify-center">
              <Button size="sm" variant="secondary" onClick={handleClear} className="rounded-lg text-[12px] gap-1">
                <XCircle className="h-3 w-3" /> Clear
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-xl bg-muted/60 flex items-center justify-center mb-3">
              <Scan className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-[13px] text-muted-foreground font-medium">Paste screenshot here</p>
            <p className="text-[11px] text-muted-foreground/70 mt-1">
              Cmd+Shift+4 → Cmd+V / Ctrl+V
            </p>
          </div>
        )}
      </div>

      {/* OCR Button */}
      {hasImage && !ocrResult?.text && (
        <Button
          onClick={handleOcr}
          disabled={processing}
          className="w-full gap-2 rounded-xl h-10"
        >
          {processing ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</>
          ) : (
            <><Scan className="h-4 w-4" /> OCR & Preview Text</>
          )}
        </Button>
      )}

      {/* Tesseract not found warning */}
      {ocrResult && !ocrResult.success && ocrResult.error?.includes('Tesseract not found') && (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-[12px] text-amber-700 dark:text-amber-300 space-y-1">
              <p className="font-medium">Tesseract OCR not installed</p>
              <p className="text-[11px] opacity-80">Install Tesseract to enable screenshot OCR:</p>
              <code className="block text-[11px] bg-amber-500/20 rounded px-2 py-1 mt-1">
                macOS: brew install tesseract tesseract-lang
              </code>
              <code className="block text-[11px] bg-amber-500/20 rounded px-2 py-1">
                Ubuntu: sudo apt install tesseract-ocr tesseract-ocr-lang
              </code>
            </div>
          </div>
        </div>
      )}

      {/* OCR Result */}
      {ocrResult?.text && (
        <div className="space-y-3">
          {/* Extracted text preview */}
          <div className="rounded-xl bg-card border border-border/50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <h3 className="text-sm font-medium">Extracted Text</h3>
              <span className="ml-auto text-[11px] text-muted-foreground">{ocrResult.text.length} chars</span>
            </div>
            <textarea
              readOnly
              value={ocrResult.text}
              className="w-full h-48 rounded-lg bg-muted/30 border border-border/30 p-3 text-[13px] text-foreground resize-none"
              placeholder="Extracted text will appear here..."
            />
          </div>

          {/* Title & Tags */}
          <div className="rounded-xl bg-card border border-border/50 p-4 space-y-3">
            <div>
              <label className="text-[11px] text-muted-foreground block mb-1">Title (optional)</label>
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Screenshot title"
                className="rounded-xl border-border/50 h-9 text-[13px]"
              />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground block mb-1">Tags</label>
              <Input
                value={tags}
                onChange={e => setTags(e.target.value)}
                placeholder="screenshot, ocr, notes"
                className="rounded-xl border-border/50 h-9 text-[13px]"
              />
            </div>
          </div>

          {/* Import button */}
          <Button
            onClick={handleImport}
            disabled={importing}
            className="w-full gap-2 rounded-xl h-10"
          >
            {importing ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Importing...</>
            ) : (
              <><Upload className="h-4 w-4" /> Import to Knowledge Base</>
            )}
          </Button>

          {/* Import result */}
          {importedResult && (
            <div className={`rounded-xl p-4 border ${
              importedResult.success
                ? 'bg-green-500/10 border-green-500/30'
                : 'bg-destructive/10 border-destructive/30'
            }`}>
              <div className="flex items-center gap-2">
                {importedResult.success ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
                <span className="text-[13px] font-medium">
                  {importedResult.success ? 'Imported successfully!' : 'Import failed'}
                </span>
              </div>
              {importedResult.success && (
                <p className="text-[12px] text-muted-foreground mt-1 ml-6">
                  "{importedResult.title}" — {importedResult.chunks} chunk(s), tags: {importedResult.tags.join(', ')}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MediaImportTab() {
  const [path, setPath] = useState('');
  const [type, setType] = useState<'audio' | 'image'>('audio');
  const [tags, setTags] = useState('');
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);
  const { toast } = useToast();

  const handleImport = async () => {
    if (!path.trim()) return;
    setImporting(true);
    setResults([]);
    try {
      const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
      const res = type === 'audio'
        ? await api.importAudio(path, tagList)
        : await api.importImage(path, tagList);
      await api.commit();
      setResults([res]);
      if (res.success) {
        toast({
          title: type === 'audio' ? 'Audio imported' : 'Image imported',
          description: `${res.title} (Whisper/CLIP processing enabled)`
        });
      } else {
        toast({ title: 'Import failed', description: res.error || 'Unknown error', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Import failed', description: String(e), variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <div className="space-y-4 mb-8">
        {/* Type Selection */}
        <div>
          <Label className="mb-2 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</Label>
          <div className="flex gap-3">
            <button
              onClick={() => setType('audio')}
              className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-xl border transition-colors cursor-pointer ${
                type === 'audio' ? 'border-primary/50 bg-primary/5' : 'border-border/50 hover:bg-muted/40'
              }`}
            >
              <Music className={`h-5 w-5 ${type === 'audio' ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className="text-sm font-medium">Audio</span>
            </button>
            <button
              onClick={() => setType('image')}
              className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-xl border transition-colors cursor-pointer ${
                type === 'image' ? 'border-primary/50 bg-primary/5' : 'border-border/50 hover:bg-muted/40'
              }`}
            >
              <Image className={`h-5 w-5 ${type === 'image' ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className="text-sm font-medium">Image</span>
            </button>
          </div>
        </div>

        <div>
          <Label className="mb-2 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Path</Label>
          <div className="relative">
            {type === 'audio' ? (
              <Music className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            ) : (
              <Image className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            )}
            <Input
              type="text"
              value={path}
              onChange={e => setPath(e.target.value)}
              placeholder={type === 'audio' ? '/path/to/audio.mp3' : '/path/to/image.png'}
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

        <div className="rounded-lg bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground">
            {type === 'audio' ? (
              <>
                <strong>Whisper Transcription:</strong> Audio files will be transcribed using Whisper ML model.
                Supported formats: MP3, WAV, M4A, OGG.
              </>
            ) : (
              <>
                <strong>CLIP Vision Search:</strong> Images will be indexed with CLIP embeddings for visual similarity search.
                Supported formats: PNG, JPEG, JPG, WEBP, GIF.
              </>
            )}
          </p>
        </div>

        <Button onClick={handleImport} disabled={importing || !path.trim()} className="gap-2 rounded-xl h-10 px-6">
          {importing ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</>
          ) : (
            <>{type === 'audio' ? <><Music className="h-4 w-4" /> Transcribe & Import</> : <><Image className="h-4 w-4" /> Index & Import</>}</>
          )}
        </Button>
      </div>

      {results.length > 0 && (
        <ResultSummary
          successCount={results.filter(r => r.success).length}
          failCount={results.length - results.filter(r => r.success).length}
          results={results.map(r => ({ title: r.title, success: r.success, error: r.error }))}
        />
      )}
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
          <div key={i} className={`rounded-xl p-3 flex items-start gap-3 text-sm ${r.success ? 'bg-card border border-border/50' : 'bg-destructive/5 border border-destructive/20'}`}>
            {r.success ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" /> : <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />}
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate text-[13px]">{r.title}</div>
              {!r.success && r.error && <div className="text-xs text-destructive mt-0.5">{r.error}</div>}
              {r.success && r.auto_tags && r.auto_tags.length > 0 && (
                <div className="flex items-center gap-1 mt-1 flex-wrap">
                  <Sparkles className="h-2.5 w-2.5 text-primary/60 shrink-0" />
                  {r.auto_tags.map(tag => (
                    <span key={tag} className="inline-flex items-center gap-0.5 text-[10px] text-primary/70 bg-primary/5 px-1.5 py-0.5 rounded-full border border-primary/10">
                      <Hash className="h-2 w-2" />{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
