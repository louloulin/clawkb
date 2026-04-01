import { useEffect, useState, useRef, useCallback } from 'react';
import { GitBranch, X, User, Building2, MapPin, Box, Tag, Loader2, Brain, Network, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useGraphStore } from '@/store/graph-store';
import type { RelationEdge, MemoryCardInfo, EntityInfo } from '@/api';
import {
  forceSimulation, forceManyBody, forceLink, forceCenter, forceCollide
} from 'd3-force';
import type { SimulationNodeDatum, SimulationLinkDatum } from 'd3-force';

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

function ForceGraph({ entities, edges, onSelect }: {
  entities: EntityInfo[];
  edges: RelationEdge[];
  onSelect: (entity: EntityInfo) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [hoveredNode, setHoveredNode] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

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

  useEffect(() => {
    const graphNodes: GraphNode[] = entities.map(e => ({
      id: e.id,
      name: e.display_name,
      kind: e.kind,
      x: dimensions.width / 2 + (Math.random() - 0.5) * 200,
      y: dimensions.height / 2 + (Math.random() - 0.5) * 200,
    }));

    const idSet = new Set(entities.map(e => e.id));
    const graphLinks: GraphLink[] = edges
      .filter(e => idSet.has(e.from_id) && idSet.has(e.to_id))
      .map(e => ({
        source: e.from_id,
        target: e.to_id,
        link: e.link,
      }));

    const simulation = forceSimulation<GraphNode>(graphNodes)
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

    return () => { simulation.stop(); };
  }, [entities, edges, dimensions.width, dimensions.height]);

  const getLinkedNodeIds = useCallback((nodeId: number) => {
    const ids = new Set<number>();
    ids.add(nodeId);
    links.forEach(l => {
      const s = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
      const t = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
      if (s === nodeId) ids.add(t);
      if (t === nodeId) ids.add(s);
    });
    return ids;
  }, [links]);

  const highlightedIds = hoveredNode !== null ? getLinkedNodeIds(hoveredNode) : null;

  return (
    <div ref={containerRef} className="flex-1 relative overflow-hidden">
      <svg ref={svgRef} width={dimensions.width} height={dimensions.height} className="block">
        {/* Links */}
        {links.map((link, i) => {
          const s = link.source as GraphNode;
          const t = link.target as GraphNode;
          if (!s || !t || typeof s.x !== 'number') return null;
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
          const dimmed = highlightedIds && !highlightedIds.has(node.id);
          const isHovered = hoveredNode === node.id;
          const r = isHovered ? 14 : 10;
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
              <circle r={r} fill={color} opacity={0.2} />
              <circle r={r} fill="none" stroke={color} strokeWidth={isHovered ? 2.5 : 1.5} />
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
      </svg>
    </div>
  );
}

export function GraphPage() {
  const { entities, edges, stats, memories, selectedEntity, selectedEdges, isLoading, error, kindFilter, loadGraph, selectEntity, setKindFilter } = useGraphStore();
  const [showMemories, setShowMemories] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'graph'>('grid');

  useEffect(() => { loadGraph(); }, [loadGraph]);

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
                Knowledge Graph
              </h2>
              {stats && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {stats.node_count} entities, {stats.edge_count} relations
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center border rounded-md overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 transition-colors cursor-pointer ${
                    viewMode === 'grid' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title="Grid view"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setViewMode('graph')}
                  className={`p-1.5 transition-colors cursor-pointer ${
                    viewMode === 'graph' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title="Graph view"
                >
                  <Network className="h-3.5 w-3.5" />
                </button>
              </div>
              <Button
                variant={showMemories ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setShowMemories(!showMemories)}
                className="text-xs h-7"
              >
                <Brain className="h-3.5 w-3.5 mr-1" />
                Memories ({memories.length})
              </Button>
              <Button variant="ghost" size="sm" onClick={loadGraph} className="text-xs h-7">
                Refresh
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
                All
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

        {viewMode === 'graph' ? (
          /* Force-directed graph view */
          !isLoading && !error && filteredEntities.length > 0 ? (
            <ForceGraph
              entities={filteredEntities}
              edges={edges}
              onSelect={selectEntity}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">
                {isLoading ? 'Loading graph...' : error || 'No entities to display'}
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
                No entities found. Add documents to build the knowledge graph.
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
                            <span className="text-[10px] text-muted-foreground">{entity.mention_count} mentions</span>
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
                  Memory Cards
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
                    <span className="text-muted-foreground">Confidence</span>
                    <p className="font-medium">{selectedEntity.confidence}%</p>
                  </div>
                  <div className="bg-muted/40 rounded-md p-2">
                    <span className="text-muted-foreground">Mentions</span>
                    <p className="font-medium">{selectedEntity.mention_count}</p>
                  </div>
                </div>
              </div>

              {/* Relations */}
              {selectedEdges.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Relations</h4>
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
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Source Frames</h4>
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
