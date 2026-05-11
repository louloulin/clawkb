import { useEffect, useState, useRef, useCallback } from 'react';
import { GitBranch, X, User, Building2, MapPin, Box, Tag, Loader2, Brain, Network, LayoutGrid, ZoomIn, ZoomOut, Maximize2, Search, Download, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useGraphStore } from '@/store/graph-store';
import type { RelationEdge, MemoryCardInfo, EntityInfo } from '@/api';
import {
  forceSimulation, forceManyBody, forceLink, forceCenter, forceCollide, forceRadial
} from 'd3-force';
import type { SimulationNodeDatum, SimulationLinkDatum } from 'd3-force';
import { safeStorageGet, safeStorageSet } from '@/store/persistence';
import { api } from '@/api/commands';

const GRAPH_POSITIONS_KEY = 'clawkb-graph-positions';

const KIND_CONFIG: Record<string, { icon: typeof User; color: string; label: string }> = {
  person: { icon: User, color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400', label: 'Person' },
  organization: { icon: Building2, color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400', label: 'Org' },
  location: { icon: MapPin, color: 'bg-green-500/10 text-green-600 dark:text-green-400', label: 'Location' },
  project: { icon: Box, color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400', label: 'Project' },
  product: { icon: Tag, color: 'bg-pink-500/10 text-pink-600 dark:text-pink-400', label: 'Product' },
};

function getKindConfig(kind: string) {
  return KIND_CONFIG[kind] || { icon: GitBranch, color: 'bg-muted text-muted-foreground', label: kind };
}

const KIND_COLORS: Record<string, string> = {
  person: '#3b82f6',
  organization: '#a855f7',
  location: '#22c55e',
  project: '#f97316',
  product: '#ec4899',
};

function getKindColor(kind: string) {
  return KIND_COLORS[kind] || '#6b7280';
}

interface GraphNode extends SimulationNodeDatum {
  id: number;
  name: string;
  kind: string;
}

interface GraphLink extends SimulationLinkDatum<GraphNode> {
  link: string;
}

function ForceGraph({ entities, edges, onSelect, svgRef: externalSvgRef, highlightedNodeId, layout = 'force' }: {
  entities: EntityInfo[];
  edges: RelationEdge[];
  onSelect: (entity: EntityInfo) => void;
  svgRef?: React.RefObject<SVGSVGElement | null>;
  highlightedNodeId?: number | null;
  layout?: 'force' | 'radial';
}) {
  const internalSvgRef = useRef<SVGSVGElement>(null);
  const svgRef = externalSvgRef || internalSvgRef;
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [hoveredNode, setHoveredNode] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Zoom/pan state
  const [transform, setTransform] = useState({ k: 1, x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const transformRef = useRef(transform);

  useEffect(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setDimensions({ width: rect.width, height: rect.height });
    const observer = new ResizeObserver(entries => {
      const r = entries[0]?.contentRect;
      if (r) setDimensions({ width: r.width, height: r.height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Load saved positions
  const savedPositions = useRef<Record<number, { x: number; y: number }>>(
    safeStorageGet<Record<number, { x: number; y: number }>>(GRAPH_POSITIONS_KEY, {})
  );

  // Save positions when nodes change
  useEffect(() => {
    if (nodes.length === 0) return;
    const positions: Record<number, { x: number; y: number }> = {};
    for (const n of nodes) {
      if (n.x != null && n.y != null) {
        positions[n.id] = { x: n.x, y: n.y };
      }
    }
    savedPositions.current = positions;
    safeStorageSet(GRAPH_POSITIONS_KEY, positions);
  }, [nodes]);

  useEffect(() => {
    const graphNodes: GraphNode[] = entities.map(e => {
      const saved = savedPositions.current[e.id];
      return {
        id: e.id,
        name: e.display_name,
        kind: e.kind,
        x: saved?.x ?? dimensions.width / 2 + (Math.random() - 0.5) * 200,
        y: saved?.y ?? dimensions.height / 2 + (Math.random() - 0.5) * 200,
      };
    });

    const idSet = new Set(entities.map(e => e.id));
    const graphLinks: GraphLink[] = edges
      .filter(e => idSet.has(e.from_id) && idSet.has(e.to_id))
      .map(e => ({
        source: e.from_id,
        target: e.to_id,
        link: e.link,
      }));

    // Configure simulation based on layout type
    let simulation;
    if (layout === 'radial') {
      // Radial layout - nodes arranged in concentric circles
      const centerX = dimensions.width / 2;
      const centerY = dimensions.height / 2;
      const maxRadius = Math.min(dimensions.width, dimensions.height) / 2 - 50;
      
      // Position nodes in a radial pattern
      graphNodes.forEach((node, i) => {
        const angle = (2 * Math.PI * i) / graphNodes.length;
        const radius = maxRadius * (0.3 + 0.7 * Math.random());
        node.x = centerX + radius * Math.cos(angle);
        node.y = centerY + radius * Math.sin(angle);
      });

      simulation = forceSimulation<GraphNode>(graphNodes)
        .force('charge', forceManyBody().strength(-80))
        .force('collision', forceCollide<GraphNode>().radius(30))
        .force('radial', forceRadial<GraphNode>(200)
          .radius(maxRadius)
          .strength(0.3)
          .x(centerX)
          .y(centerY)
        )
        .alpha(1)
        .alphaDecay(0.02)
        .on('tick', () => {
          setNodes([...graphNodes]);
          setLinks([...graphLinks]);
        });
    } else {
      // Force-directed layout (default)
      simulation = forceSimulation<GraphNode>(graphNodes)
        .force('charge', forceManyBody().strength(-120))
        .force('center', forceCenter(dimensions.width / 2, dimensions.height / 2))
        .force('collision', forceCollide<GraphNode>().radius(30))
        .force('link', forceLink<GraphNode, GraphLink>(graphLinks)
          .id(d => d.id)
          .distance(80)
        )
        .alpha(1)
        .alphaDecay(0.02)
        .on('tick', () => {
          setNodes([...graphNodes]);
          setLinks([...graphLinks]);
        });
    }

    return () => { simulation.stop(); };
  }, [entities, edges, dimensions.width, dimensions.height, layout]);

  const getLinkedNodeIds = useCallback((nodeId: number) => {
    const ids = new Set<number>();
    ids.add(nodeId);
    links.forEach(l => {
      const s = typeof l.source === 'object' ? (l.source as GraphNode).id : Number(l.source);
      const t = typeof l.target === 'object' ? (l.target as GraphNode).id : Number(l.target);
      if (s === nodeId) ids.add(t);
      if (t === nodeId) ids.add(s);
    });
    return ids;
  }, [links]);

  const highlightedIds = hoveredNode !== null ? getLinkedNodeIds(hoveredNode) : null;

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, tx: transform.x, ty: transform.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    const newT = { ...transformRef.current, x: dragStart.current.tx + dx, y: dragStart.current.ty + dy };
    transformRef.current = newT;
    setTransform({ ...newT });
  };

  const handleMouseUp = () => setIsDragging(false);

  const zoomIn = () => {
    const newK = Math.min(transform.k * 1.3, 5);
    setTransform({ ...transform, k: newK });
    transformRef.current = { ...transformRef.current, k: newK };
  };

  const zoomOut = () => {
    const newK = Math.max(transform.k / 1.3, 0.2);
    setTransform({ ...transform, k: newK });
    transformRef.current = { ...transformRef.current, k: newK };
  };

  const resetView = () => {
    const newT = { k: 1, x: 0, y: 0 };
    setTransform(newT);
    transformRef.current = newT;
  };

  return (
    <div ref={containerRef} className="flex-1 relative overflow-hidden">
      {/* Zoom controls */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
        <button
          onClick={zoomIn}
          title="放大"
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-card/60 backdrop-blur-sm border border-border text-foreground hover:bg-accent transition-colors"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          onClick={zoomOut}
          title="缩小"
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-card/60 backdrop-blur-sm border border-border text-foreground hover:bg-accent transition-colors"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          onClick={resetView}
          title="重置视图"
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-card/60 backdrop-blur-sm border border-border text-foreground hover:bg-accent transition-colors"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      {/* Zoom level indicator */}
      <div className="absolute bottom-3 left-3 z-10 text-[10px] text-foreground/50 bg-card/40 backdrop-blur-sm px-2 py-1 rounded-md">
        {Math.round(transform.k * 100)}%
      </div>

      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="block"
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
        {/* Links */}
        {links.map((link, i) => {
          const s = link.source as GraphNode;
          const t = link.target as GraphNode;
          if (!s || !t || typeof s.x !== 'number' || typeof s.y !== 'number' || typeof t.x !== 'number' || typeof t.y !== 'number') return null;
          const dimmed = highlightedIds && (!highlightedIds.has(s.id) && !highlightedIds.has(t.id));
          return (
            <g key={i}>
              <line
                x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                stroke={dimmed ? 'transparent' : 'currentColor'}
                strokeWidth={dimmed ? 0 : 1.5}
                className="text-muted-foreground/30"
              />
              <text
                x={(s.x + t.x) / 2}
                y={(s.y + t.y) / 2 - 4}
                textAnchor="middle"
                className="fill-muted-foreground text-[9px]"
                opacity={dimmed ? 0 : 0.7}
              >
                {link.link}
              </text>
            </g>
          );
        })}
        {/* Nodes */}
        {nodes.map(node => {
          if (node.x == null || node.y == null) return null;
          const dimmed = (highlightedIds && !highlightedIds.has(node.id)) || (highlightedNodeId !== null && highlightedNodeId !== node.id);
          const isHovered = hoveredNode === node.id;
          const isHighlighted = highlightedNodeId === node.id;
          const r = isHovered || isHighlighted ? 14 : 10;
          const color = getKindColor(node.kind);
          return (
            <g
              key={node.id}
              transform={`translate(${node.x},${node.y})`}
              onClick={() => {
                const entity = entities.find(e => e.id === node.id);
                if (entity) onSelect(entity);
              }}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              className="cursor-pointer"
              opacity={dimmed ? 0.15 : 1}
            >
              {isHighlighted && <circle r={r + 6} fill="none" stroke={color} strokeWidth={2} opacity={0.4} />}
              <circle r={r} fill={color} opacity={isHighlighted ? 0.5 : 0.2} />
              <circle r={r} fill="none" stroke={color} strokeWidth={isHovered || isHighlighted ? 2.5 : 1.5} />
              <text
                y={r + 14}
                textAnchor="middle"
                className="fill-foreground text-[10px] font-medium"
              >
                {node.name.length > 16 ? node.name.slice(0, 15) + '…' : node.name}
              </text>
            </g>
          );
        })}
        </g>
      </svg>
    </div>
  );
}

/**
 * NoteLinkGraph — shows the inter-note link structure using [[wikilinks]].
 * Fetches all notes and their backlinks, renders as a force-directed graph.
 */
function NoteLinkGraph() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [nodes, setNodes] = useState<Array<{ id: string; label: string; x?: number; y?: number }>>([]);
  const [links, setLinks] = useState<Array<{ source: string | object; target: string | object }>>([]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      const r = entries[0]?.contentRect;
      if (r) setDimensions({ width: r.width, height: r.height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const allNotes = await api.listNotes(undefined, 200);
        if (cancelled) return;

        const noteNodes = allNotes.map(n => ({ id: n.id, label: n.title }));
        const noteLinks: Array<{ source: string; target: string }> = [];
        const noteIds = new Set(allNotes.map(n => n.id));

        // Fetch backlinks for each note (batch, limit to first 100 notes)
        const batchSize = 20;
        for (let i = 0; i < Math.min(allNotes.length, 100); i += batchSize) {
          const batch = allNotes.slice(i, i + batchSize);
          const results = await Promise.all(
            batch.map(n => api.listBacklinks(n.id).catch(() => []))
          );
          if (cancelled) return;
          results.forEach((bls, idx) => {
            bls.forEach(bl => {
              if (noteIds.has(bl.note_id) && bl.note_id !== batch[idx].id) {
                // backlink: bl links TO current note
                noteLinks.push({ source: bl.note_id, target: batch[idx].id });
              }
            });
          });
        }

        setNodes(noteNodes);
        setLinks(noteLinks);
      } catch {
        setNodes([]);
        setLinks([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // D3 force simulation
  useEffect(() => {
    if (nodes.length === 0) return;

    const simNodes = nodes.map(n => ({ ...n }));
    const simLinks = links.map(l => ({
      source: typeof l.source === 'string' ? l.source : (l.source as { id: string }).id,
      target: typeof l.target === 'string' ? l.target : (l.target as { id: string }).id,
    }));

    const sim = forceSimulation(simNodes as Array<SimulationNodeDatum & { id: string; label: string }>)
      .force('charge', forceManyBody().strength(-60))
      .force('center', forceCenter(dimensions.width / 2, dimensions.height / 2))
      .force('collide', forceCollide().radius(20))
      .force('link', forceLink<SimulationNodeDatum, SimulationLinkDatum<SimulationNodeDatum>>(simLinks as any)
        .id((d: any) => d.id)
        .distance(80)
      );

    sim.on('tick', () => {
      setNodes([...simNodes]);
    });

    return () => { sim.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length, links.length, dimensions]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">加载笔记链接图谱...</span>
        </div>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">暂无笔记数据</p>
      </div>
    );
  }

  const connectedIds = new Set<string>();
  links.forEach(l => {
    const sId = typeof l.source === 'string' ? l.source : (l.source as { id: string }).id;
    const tId = typeof l.target === 'string' ? l.target : (l.target as { id: string }).id;
    connectedIds.add(sId);
    connectedIds.add(tId);
  });

  return (
    <div ref={containerRef} className="flex-1 relative bg-card/30">
      <div className="absolute top-3 left-3 z-10 text-xs text-muted-foreground bg-card/60 backdrop-blur-sm px-2 py-1 rounded-md">
        {nodes.length} 篇笔记 · {links.length} 条链接
      </div>
      <svg ref={svgRef} width={dimensions.width} height={dimensions.height}>
        {links.map((link, i) => {
          const s = typeof link.source === 'object' ? link.source : nodes.find(n => n.id === link.source);
          const t = typeof link.target === 'object' ? link.target : nodes.find(n => n.id === link.target);
          if (!s || !t) return null;
          return (
            <line
              key={i}
              x1={(s as { x?: number }).x ?? 0}
              y1={(s as { y?: number }).y ?? 0}
              x2={(t as { x?: number }).x ?? 0}
              y2={(t as { y?: number }).y ?? 0}
              stroke="hsl(var(--border))"
              strokeWidth={1}
              opacity={0.5}
            />
          );
        })}
        {nodes.map(node => {
          const isConnected = connectedIds.has(node.id);
          const r = isConnected ? 8 : 4;
          return (
            <g key={node.id} transform={`translate(${node.x ?? 0},${node.y ?? 0})`}>
              <circle
                r={r}
                fill={isConnected ? '#f59e0b' : 'hsl(var(--muted-foreground))'}
                opacity={isConnected ? 0.9 : 0.3}
              />
              {isConnected && (
                <text
                  textAnchor="middle"
                  y={r + 11}
                  fill="hsl(var(--foreground))"
                  fontSize={9}
                >
                  {node.label.length > 14 ? node.label.slice(0, 13) + '…' : node.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function GraphPage() {
  const { entities, edges, stats, memories, selectedEntity, selectedEdges, isLoading, error, kindFilter, loadGraph, selectEntity, setKindFilter } = useGraphStore();
  const [showMemories, setShowMemories] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'graph' | 'radial' | 'noteLinks'>('grid');
  const [graphLayout, setGraphLayout] = useState<'force' | 'radial'>('force');
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedNodeId, setHighlightedNodeId] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => { loadGraph(); }, [loadGraph]);

  // Search handler - highlight matching node
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setHighlightedNodeId(null);
      return;
    }
    const lower = query.toLowerCase();
    const match = entities.find(e => 
      e.display_name.toLowerCase().includes(lower) ||
      e.kind.toLowerCase().includes(lower)
    );
    setHighlightedNodeId(match?.id ?? null);
    
    // Auto-switch to graph view and select entity
    if (match) {
      setViewMode('graph');
      selectEntity(match);
    }
  }, [entities, selectEntity]);

  // Export SVG handler
  const handleExportSvg = useCallback(() => {
    if (!svgRef.current) return;
    
    // Clone the SVG to avoid modifying the original
    const svgClone = svgRef.current.cloneNode(true) as SVGSVGElement;
    
    // Get current styles and embed them
    const styles = `
      .node { fill: #3b82f6; }
      .link { stroke: #6b7280; stroke-width: 1.5px; }
      .label { fill: #e2e8f0; font-size: 10px; font-family: system-ui, sans-serif; }
      text { fill: #e2e8f0; font-size: 10px; font-family: system-ui, sans-serif; }
    `;
    
    // Create a style element and insert it
    const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    styleEl.textContent = styles;
    svgClone.insertBefore(styleEl, svgClone.firstChild);
    
    // Set background
    svgClone.setAttribute('style', 'background: #0a0c12;');
    
    // Serialize to string
    const serializer = new XMLSerializer();
    let svgString = serializer.serializeToString(svgClone);
    
    // Add XML declaration
    svgString = '<?xml version="1.0" encoding="UTF-8"?>\n' + svgString;
    
    // Create download
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clawkb-graph-${Date.now()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const uniqueKinds = [...new Set(entities.map(e => e.kind))];
  const filteredEntities = kindFilter ? entities.filter(e => e.kind === kindFilter) : entities;

  return (
    <div className="flex h-full">
      {/* Main entity list */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-5 py-4 border-b">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-primary" />
                知识图谱
              </h2>
              {stats && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {stats.node_count} 个实体，{stats.edge_count} 条关系
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="搜索节点..."
                  className="h-7 pl-8 pr-3 text-xs rounded-md bg-muted/40 border border-border/50 w-36 focus:w-48 transition-all outline-none focus:border-primary/30"
                />
              </div>
              
              {/* Export SVG button */}
              <Button variant="ghost" size="sm" onClick={handleExportSvg} className="text-xs h-7 gap-1" title="导出 SVG">
                <Download className="h-3.5 w-3.5" />
                导出
              </Button>
              
              <div className="flex items-center border rounded-md overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 transition-colors cursor-pointer ${
                    viewMode === 'grid' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title="网格视图"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => { setViewMode('graph'); setGraphLayout('force'); }}
                  className={`p-1.5 transition-colors cursor-pointer ${
                    viewMode === 'graph' && graphLayout === 'force' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title="力导向图"
                >
                  <Network className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => { setViewMode('graph'); setGraphLayout('radial'); }}
                  className={`p-1.5 transition-colors cursor-pointer ${
                    viewMode === 'graph' && graphLayout === 'radial' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title="放射状图"
                >
                  <span className="text-[10px] font-bold">◎</span>
                </button>
                <button
                  onClick={() => setViewMode('noteLinks')}
                  className={`p-1.5 transition-colors cursor-pointer ${
                    viewMode === 'noteLinks' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title="笔记链接图"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                </button>
              </div>
              <Button
                variant={showMemories ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setShowMemories(!showMemories)}
                className="text-xs h-7"
              >
                <Brain className="h-3.5 w-3.5 mr-1" />
                记忆 ({memories.length})
              </Button>
              <Button variant="ghost" size="sm" onClick={loadGraph} className="text-xs h-7">
                刷新
              </Button>
            </div>
          </div>

          {/* Kind filter chips */}
          {uniqueKinds.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setKindFilter(null)}
                className={`text-[11px] px-2 py-1 rounded-md transition-colors cursor-pointer ${
                  !kindFilter ? 'bg-primary/10 text-primary font-medium' : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                }`}
              >
                全部
              </button>
              {uniqueKinds.map(kind => (
                <button
                  key={kind}
                  onClick={() => setKindFilter(kind === kindFilter ? null : kind)}
                  className={`text-[11px] px-2 py-1 rounded-md transition-colors cursor-pointer capitalize ${
                    kind === kindFilter ? 'bg-primary/10 text-primary font-medium' : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {kind}
                </button>
              ))}
            </div>
          )}
        </div>

        {viewMode === 'noteLinks' ? (
          <NoteLinkGraph />
        ) : viewMode === 'graph' ? (
          /* Force-directed graph view */
          !isLoading && !error && filteredEntities.length > 0 ? (
            <ForceGraph
              entities={filteredEntities}
              edges={edges}
              onSelect={selectEntity}
              svgRef={svgRef}
              highlightedNodeId={highlightedNodeId}
              layout={graphLayout}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">
                {isLoading ? '正在加载图谱...' : error || '暂无实体可显示'}
              </p>
            </div>
          )
        ) : (
        <ScrollArea className="flex-1">
          <div className="p-4">
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {error && (
              <div className="bg-destructive/10 text-destructive text-sm rounded-lg px-4 py-2">
                {error}
              </div>
            )}

            {!isLoading && !error && filteredEntities.length === 0 && (
              <div className="text-center py-12 text-muted-foreground text-sm">
                暂未找到实体，导入资料后可构建知识图谱。
              </div>
            )}

            {/* Entity grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {filteredEntities.map(entity => {
                const config = getKindConfig(entity.kind);
                const Icon = config.icon;
                const isSelected = selectedEntity?.id === entity.id;
                return (
                  <button
                    key={entity.id}
                    onClick={() => selectEntity(isSelected ? null : entity)}
                    className={`text-left p-3 rounded-lg border transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-border/50 hover:border-primary/20 hover:bg-muted/30'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${config.color}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{entity.display_name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="secondary" className="text-[10px] h-4 px-1.5 capitalize">{entity.kind}</Badge>
                          {entity.mention_count > 0 && (
                            <span className="text-[10px] text-muted-foreground">{entity.mention_count} 次提及</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Memory cards */}
            {showMemories && memories.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-1.5">
                  <Brain className="h-4 w-4 text-primary" />
                  记忆卡片
                </h3>
                <div className="space-y-2">
                  {memories.map((m: MemoryCardInfo, idx: number) => (
                    <div key={idx} className="p-3 rounded-lg border border-border/50 bg-muted/20">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-foreground">{m.entity}</span>
                        <span className="text-[10px] text-muted-foreground">→</span>
                        <span className="text-xs text-primary">{m.slot}</span>
                      </div>
                      <p className="text-sm text-foreground">{m.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        )}
      </div>

      {/* Detail panel */}
      {selectedEntity && (
        <div className="w-80 border-l bg-card/60 backdrop-blur-sm flex flex-col shrink-0">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="text-sm font-medium truncate">{selectedEntity.display_name}</h3>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => selectEntity(null)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-3">
              {/* Entity info */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {(() => {
                    const config = getKindConfig(selectedEntity.kind);
                    const Icon = config.icon;
                    return (
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${config.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                    );
                  })()}
                  <div>
                    <p className="text-sm font-medium">{selectedEntity.display_name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{selectedEntity.kind}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-muted/40 rounded-md p-2">
                    <span className="text-muted-foreground">置信度</span>
                    <p className="font-medium">{selectedEntity.confidence}%</p>
                  </div>
                  <div className="bg-muted/40 rounded-md p-2">
                    <span className="text-muted-foreground">提及次数</span>
                    <p className="font-medium">{selectedEntity.mention_count}</p>
                  </div>
                </div>
              </div>

              {/* Relations */}
              {selectedEdges.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">关系</h4>
                  <div className="space-y-1.5">
                    {selectedEdges.map((edge: RelationEdge, idx: number) => {
                      const isFrom = edge.from_id === selectedEntity.id;
                      const otherId = isFrom ? edge.to_id : edge.from_id;
                      const otherEntity = entities.find(e => e.id === otherId);
                      return (
                        <button
                          key={idx}
                          onClick={() => {
                            if (otherEntity) selectEntity(otherEntity);
                          }}
                          className="w-full text-left p-2 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="text-muted-foreground">{isFrom ? '→' : '←'}</span>
                            <Badge variant="outline" className="text-[10px] h-4 px-1">{edge.link}</Badge>
                            <span className="font-medium truncate">{otherEntity?.display_name || `#${otherId}`}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Source frames */}
              {selectedEntity.frame_ids.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">来源帧</h4>
                  <div className="flex flex-wrap gap-1">
                    {selectedEntity.frame_ids.map(fid => (
                      <Badge key={fid} variant="secondary" className="text-[10px]">
                        Frame #{fid}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
