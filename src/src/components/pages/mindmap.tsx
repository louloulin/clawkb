import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Brain, Loader2, Copy, Check, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/api/commands';
import { safeStorageGet, safeStorageSet } from '@/store/persistence';

interface MindMapNode {
  key: string;
  text: string;
  level: number;
  children: MindMapNode[];
  x?: number;
  y?: number;
  angle?: number;
  radius?: number;
}

const MINDMAP_POSITIONS_KEY = 'clawkb-mindmap-transform';

const BRANCH_COLORS = [
  '#f59e0b', // amber
  '#3b82f6', // blue
  '#10b981', // emerald
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
];

export function MindMapPage() {
  const [topic, setTopic] = useState('');
  const [outline, setOutline] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [transform, setTransform] = useState(() =>
    safeStorageGet<{ k: number; x: number; y: number }>(MINDMAP_POSITIONS_KEY, { k: 1, x: 0, y: 0 })
  );
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

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

  // Parse outline into hierarchical tree
  const tree = useMemo((): MindMapNode | null => {
    if (!outline) return null;
    const lines = outline.split('\n').filter(l => l.trim());
    if (lines.length === 0) return null;

    const flat = lines.map((line, i) => {
      const indent = line.search(/\S/);
      const level = Math.floor(indent / 2);
      const cleanLine = line.replace(/^[\s#*\->]+/, '').replace(/\*\*/g, '').trim();
      return { key: `n${i}`, text: cleanLine || `节点 ${i + 1}`, level, children: [] as MindMapNode[] };
    });

    // Build tree from flat list
    const root: MindMapNode = { key: 'root', text: topic || '主题', level: -1, children: [] };
    const stack: MindMapNode[] = [root];

    for (const item of flat) {
      // Pop stack until we find parent
      while (stack.length > 1 && stack[stack.length - 1].level >= item.level) {
        stack.pop();
      }
      stack[stack.length - 1].children.push(item);
      stack.push(item);
    }

    return root;
  }, [outline, topic]);

  // Compute radial positions
  const positionedNodes = useMemo(() => {
    if (!tree || tree.children.length === 0) return { nodes: [] as (MindMapNode & { x: number; y: number })[], links: [] as { x1: number; y1: number; x2: number; y2: number; color: string }[] };

    const nodes: (MindMapNode & { x: number; y: number })[] = [];
    const links: { x1: number; y1: number; x2: number; y2: number; color: string }[] = [];
    const centerX = 400;
    const centerY = 350;

    // Root at center
    nodes.push({ ...tree, x: centerX, y: centerY });

    const branches = tree.children;
    const angleStep = (2 * Math.PI) / Math.max(branches.length, 1);

    branches.forEach((branch, i) => {
      const branchAngle = angleStep * i - Math.PI / 2;
      const branchRadius = 160;
      const bx = centerX + branchRadius * Math.cos(branchAngle);
      const by = centerY + branchRadius * Math.sin(branchAngle);

      const color = BRANCH_COLORS[i % BRANCH_COLORS.length];
      nodes.push({ ...branch, x: bx, y: by });
      links.push({ x1: centerX, y1: centerY, x2: bx, y2: by, color });

      // Sub-items fan out from branch
      const subAngleSpan = Math.min(angleStep * 0.8, Math.PI / 3);
      const subItems = branch.children;
      subItems.forEach((sub, j) => {
        const subAngleCount = Math.max(subItems.length, 1);
        const subAngle = branchAngle - subAngleSpan / 2 + (subAngleSpan / (subAngleCount - 1 || 1)) * j;
        const subRadius = 120;
        const sx = bx + subRadius * Math.cos(subAngle);
        const sy = by + subRadius * Math.sin(subAngle);

        nodes.push({ ...sub, x: sx, y: sy });
        links.push({ x1: bx, y1: by, x2: sx, y2: sy, color });
      });
    });

    return { nodes, links };
  }, [tree]);

  // Zoom/pan handlers
  const zoomIn = useCallback(() => setTransform(t => ({ ...t, k: Math.min(t.k * 1.3, 5) })), []);
  const zoomOut = useCallback(() => setTransform(t => ({ ...t, k: Math.max(t.k / 1.3, 0.3) })), []);
  const resetView = useCallback(() => setTransform({ k: 1, x: 0, y: 0 }), []);

  useEffect(() => {
    safeStorageSet(MINDMAP_POSITIONS_KEY, transform);
  }, [transform]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, tx: transform.x, ty: transform.y };
  }, [transform]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setTransform(t => ({
      ...t,
      x: dragStart.current.tx + (e.clientX - dragStart.current.x),
      y: dragStart.current.ty + (e.clientY - dragStart.current.y),
    }));
  }, [isDragging]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold mb-1 flex items-center gap-2">
              <Brain className="h-5 w-5" />
              脑图
            </h2>
            <p className="text-sm text-muted-foreground">基于知识库生成结构化脑图</p>
          </div>
          {outline && (
            <Button variant="outline" size="sm" onClick={handleCopy} className="text-xs gap-1.5">
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? '已复制' : '复制'}
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
          placeholder="输入主题生成脑图…"
          className="h-10 rounded-xl bg-muted/30 border-border/50"
        />
        <Button
          onClick={generateOutline}
          disabled={loading || !topic.trim()}
          className="h-10 px-5 rounded-xl gap-2"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
          生成
        </Button>
      </div>

      {/* Output */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-sm text-muted-foreground">正在生成脑图…</p>
        </div>
      ) : positionedNodes.nodes.length > 0 ? (
        <div className="relative border border-white/10 rounded-2xl bg-black/20 overflow-hidden" style={{ height: 500 }}>
          {/* Zoom controls */}
          <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
            <button onClick={zoomIn} title="放大" className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-black/60 text-white hover:bg-white/10 transition">
              <ZoomIn className="h-4 w-4" />
            </button>
            <button onClick={zoomOut} title="缩小" className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-black/60 text-white hover:bg-white/10 transition">
              <ZoomOut className="h-4 w-4" />
            </button>
            <button onClick={resetView} title="重置" className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-black/60 text-white hover:bg-white/10 transition">
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>

          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            viewBox="0 0 800 700"
            className="cursor-grab select-none"
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
              {/* Links */}
              {positionedNodes.links.map((link, i) => (
                <path
                  key={`link-${i}`}
                  d={`M ${link.x1} ${link.y1} Q ${(link.x1 + link.x2) / 2 + (link.y2 - link.y1) * 0.1} ${(link.y1 + link.y2) / 2 - (link.x2 - link.x1) * 0.1} ${link.x2} ${link.y2}`}
                  fill="none"
                  stroke={link.color}
                  strokeWidth={1.5}
                  strokeOpacity={0.4}
                />
              ))}

              {/* Nodes */}
              {positionedNodes.nodes.map((node, i) => {
                const isRoot = i === 0;
                const branchIndex = tree?.children.findIndex(c => c.key === node.key) ?? -1;
                const color = isRoot ? '#f59e0b' : branchIndex >= 0 ? BRANCH_COLORS[branchIndex % BRANCH_COLORS.length] : '#94a3b8';

                return (
                  <g key={`node-${node.key}`}>
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={isRoot ? 28 : i <= (tree?.children.length ?? 0) ? 14 : 8}
                      fill={isRoot ? color : `${color}22`}
                      stroke={color}
                      strokeWidth={isRoot ? 2 : 1}
                      strokeOpacity={isRoot ? 1 : 0.6}
                    />
                    <text
                      x={node.x}
                      y={node.y + (isRoot ? 5 : 4)}
                      textAnchor="middle"
                      fill={isRoot ? '#fff' : '#e2e8f0'}
                      fontSize={isRoot ? 13 : 10}
                      fontWeight={isRoot ? 'bold' : 'normal'}
                      className="pointer-events-none"
                    >
                      {isRoot ? node.text : node.text.length > 8 ? `${node.text.slice(0, 8)}…` : node.text}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="w-12 h-12 rounded-full bg-muted/40 flex items-center justify-center mx-auto mb-4">
            <Brain className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <p className="text-sm text-muted-foreground mb-1">输入主题后生成脑图</p>
          <p className="text-xs text-muted-foreground/60">AI 将基于知识库生成结构化脑图</p>
        </div>
      )}
    </div>
  );
}
