import { useState, useCallback } from 'react';
import { Brain, Loader2, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { api } from '@/api/commands';

export function MindMapPage() {
  const [topic, setTopic] = useState('');
  const [outline, setOutline] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateOutline = useCallback(async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setOutline('');

    try {
      const prompt = `Create a detailed hierarchical outline (mind map structure) about: ${topic}

Format as indented markdown with ## for main topics, ### for subtopics, and bullet points for details.
Include at least 4-6 main branches with 2-4 sub-items each.`;

      const result = await api.aiAsk(prompt, 10);
      setOutline(result.answer || 'No outline generated. Try a different topic.');
    } catch {
      setOutline('Failed to generate outline. Please try again.');
    }
    setLoading(false);
  }, [topic]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(outline);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [outline]);

  // Parse outline into tree structure for visual rendering
  const parseTree = (text: string) => {
    const lines = text.split('\n').filter(l => l.trim());
    return lines.map((line, i) => {
      const indent = line.search(/\S/);
      const level = Math.floor(indent / 2);
      const cleanLine = line.replace(/^[\s#*\->]+/, '').replace(/\*\*/g, '').trim();
      return { key: i, level, text: cleanLine };
    });
  };

  const nodes = outline ? parseTree(outline) : [];

  // Get unique levels for coloring
  const levelColors = [
    'text-primary font-semibold text-sm',
    'text-blue-600 dark:text-blue-400 font-medium text-[13px]',
    'text-emerald-600 dark:text-emerald-400 text-[12px]',
    'text-amber-600 dark:text-amber-400 text-[12px]',
    'text-muted-foreground text-[11px]',
  ];

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold mb-1 flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Mind Map
            </h2>
            <p className="text-sm text-muted-foreground">Generate structured outlines from your knowledge base</p>
          </div>
          {outline && (
            <Button variant="outline" size="sm" onClick={handleCopy} className="text-xs gap-1.5">
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="flex gap-2 mb-6">
        <Input
          value={topic}
          onChange={e => setTopic(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && generateOutline()}
          placeholder="Enter a topic to map..."
          className="h-10 rounded-xl bg-muted/30 border-border/50"
        />
        <Button
          onClick={generateOutline}
          disabled={loading || !topic.trim()}
          className="h-10 px-5 rounded-xl gap-2"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
          Generate
        </Button>
      </div>

      {/* Output */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-sm text-muted-foreground">Generating mind map outline...</p>
        </div>
      ) : nodes.length > 0 ? (
        <ScrollArea className="h-[calc(100vh-280px)]">
          <div className="bg-card border border-border/50 rounded-xl p-6">
            {/* Visual tree */}
            <div className="space-y-0.5">
              {nodes.map(node => (
                <div
                  key={node.key}
                  className="flex items-start gap-2 py-0.5"
                  style={{ paddingLeft: `${node.level * 20}px` }}
                >
                  {/* Connector line */}
                  {node.level > 0 && (
                    <div className="w-3 flex-shrink-0 flex items-center justify-center pt-2">
                      <div className="w-2 h-2 rounded-full bg-border" />
                    </div>
                  )}
                  <span className={levelColors[Math.min(node.level, levelColors.length - 1)]}>
                    {node.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>
      ) : (
        <div className="text-center py-16">
          <div className="w-12 h-12 rounded-full bg-muted/40 flex items-center justify-center mx-auto mb-4">
            <Brain className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <p className="text-sm text-muted-foreground mb-1">Enter a topic above</p>
          <p className="text-xs text-muted-foreground/60">AI will generate a structured outline from your knowledge base</p>
        </div>
      )}
    </div>
  );
}
