/**
 * LocalGraph — a lightweight per-note graph showing:
 * 1. Entities mentioned in this note (from LogicMesh)
 * 2. Backlinks (notes that reference this note)
 * Uses D3 force-directed layout for positioning.
 */
import { useEffect, useState, useRef, useCallback } from 'react';
import { Network, Loader2 } from 'lucide-react';
import { api } from '@/api/commands';
import type { EntityInfo, RelationEdge } from '@/api';
import {
  forceSimulation, forceManyBody, forceLink, forceCenter, forceCollide,
} from 'd3-force';
import type { SimulationNodeDatum, SimulationLinkDatum } from 'd3-force';

interface LocalNode extends SimulationNodeDatum {
  id: string; // unique key
  label: string;
  type: 'note' | 'entity';
  color: string;
}

interface LocalLink extends SimulationLinkDatum<LocalNode> {
  label: string;
}

interface LocalGraphProps {
  noteId: string;
  noteTitle: string;
  onNavigate?: (noteId: string, title: string) => void;
}

const ENTITY_COLORS: Record<string, string> = {
  person: '#3b82f6',
  organization: '#a855f7',
  location: '#22c55e',
  project: '#f97316',
  product: '#ec4899',
};

export function LocalGraph({ noteId, noteTitle, onNavigate }: LocalGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<LocalNode[]>([]);
  const [links, setLinks] = useState<LocalLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 300, height: 220 });

  // Observe container resize
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      const r = entries[0]?.contentRect;
      if (r) setDimensions({ width: r.width, height: r.height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Load graph data for this note
  useEffect(() => {
    let cancelled = false;
    const loadGraph = async () => {
      setLoading(true);
      try {
        const frameId = parseInt(noteId, 10);

        // Fetch all entities and backlinks in parallel
        const [allEntities, backlinks] = await Promise.all([
          api.listEntities().catch(() => [] as EntityInfo[]),
          api.listBacklinks(noteId).catch(() => []),
        ]);

        if (cancelled) return;

        // Filter entities that mention this note
        const noteEntities = allEntities.filter(e =>
          e.frame_ids.includes(frameId)
        );

        // Build nodes: center note + entities + backlink notes
        const newNodes: LocalNode[] = [
          { id: `note-${noteId}`, label: noteTitle || 'Note', type: 'note', color: '#f59e0b' },
        ];
        const newLinks: LocalLink[] = [];

        // Add entity nodes
        noteEntities.forEach(entity => {
          const eid = `entity-${entity.id}`;
          newNodes.push({
            id: eid,
            label: entity.display_name,
            type: 'entity',
            color: ENTITY_COLORS[entity.kind] || '#6b7280',
          });
          newLinks.push({
            source: `note-${noteId}`,
            target: eid,
            label: entity.kind,
          });
        });

        // Fetch edges between the note's entities
        if (noteEntities.length > 0) {
          const edgeSets = await Promise.all(
            noteEntities.map(e => api.getEntityEdges(e.id).catch(() => [] as RelationEdge[]))
          );
          if (cancelled) return;

          const entityIds = new Set(noteEntities.map(e => e.id));
          edgeSets.forEach(edges => {
            edges.forEach(edge => {
              if (entityIds.has(edge.from_id) && entityIds.has(edge.to_id)) {
                const fromKey = `entity-${edge.from_id}`;
                const toKey = `entity-${edge.to_id}`;
                // Avoid duplicate links
                if (!newLinks.some(l =>
                  (l.source === fromKey && l.target === toKey) ||
                  (l.source === toKey && l.target === fromKey)
                )) {
                  newLinks.push({ source: fromKey, target: toKey, label: edge.link });
                }
              }
            });
          });
        }

        // Add backlink note nodes
        backlinks.forEach((bl, i) => {
          const blKey = `bl-${bl.note_id}`;
          if (!newNodes.some(n => n.id === blKey)) {
            newNodes.push({
              id: blKey,
              label: bl.note_title,
              type: 'note',
              color: '#f59e0b',
            });
            newLinks.push({
              source: blKey,
              target: `note-${noteId}`,
              label: 'links to',
            });
          }
        });

        setNodes(newNodes);
        setLinks(newLinks);
      } catch {
        setNodes([]);
        setLinks([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadGraph();
    return () => { cancelled = true; };
  }, [noteId, noteTitle]);

  // Run D3 force simulation
  useEffect(() => {
    if (nodes.length === 0) return;

    const sim = forceSimulation<LocalNode>(nodes)
      .force('charge', forceManyBody().strength(-80))
      .force('center', forceCenter(dimensions.width / 2, dimensions.height / 2))
      .force('collide', forceCollide<LocalNode>().radius(30))
      .force('link', forceLink<LocalNode, LocalLink>(links)
        .id(d => d.id)
        .distance(60)
      );

    sim.on('tick', () => {
      // Trigger re-render by copying node positions
      setNodes([...nodes]);
    });

    return () => { sim.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length, links.length, dimensions]);

  const handleNodeClick = useCallback((node: LocalNode) => {
    if (node.type === 'note' && node.id !== `note-${noteId}` && onNavigate) {
      // Extract note ID from backlink node key "bl-{noteId}"
      const blId = node.id.replace('bl-', '');
      onNavigate(blId, node.label);
    }
  }, [noteId, onNavigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        <span className="text-xs">加载笔记图谱...</span>
      </div>
    );
  }

  if (nodes.length <= 1) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
        <Network className="h-6 w-6 opacity-40" />
        <span className="text-xs">此笔记暂无图谱数据</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-56 relative rounded-xl bg-card/50 border border-border/50 overflow-hidden">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="select-none"
      >
        {/* Links */}
        {links.map((link, i) => {
          const source = typeof link.source === 'object' ? link.source : nodes.find(n => n.id === link.source);
          const target = typeof link.target === 'object' ? link.target : nodes.find(n => n.id === link.target);
          if (!source || !target) return null;
          return (
            <line
              key={i}
              x1={source.x ?? 0}
              y1={source.y ?? 0}
              x2={target.x ?? 0}
              y2={target.y ?? 0}
              stroke="hsl(var(--border))"
              strokeWidth={1}
              opacity={0.6}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map(node => {
          const isCenter = node.id === `note-${noteId}`;
          const isHovered = hoveredNode === node.id;
          const r = isCenter ? 10 : 7;
          return (
            <g
              key={node.id}
              transform={`translate(${node.x ?? 0},${node.y ?? 0})`}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              onClick={() => handleNodeClick(node)}
              className={node.type === 'note' && node.id !== `note-${noteId}` ? 'cursor-pointer' : ''}
            >
              <circle
                r={r}
                fill={node.color}
                opacity={isHovered ? 1 : 0.8}
                stroke={isCenter ? '#fff' : 'none'}
                strokeWidth={isCenter ? 2 : 0}
              />
              {(isHovered || isCenter) && (
                <text
                  textAnchor="middle"
                  y={r + 12}
                  fill="hsl(var(--foreground))"
                  fontSize={10}
                  fontWeight={isCenter ? 600 : 400}
                  className="truncate"
                >
                  {node.label.length > 16 ? node.label.slice(0, 15) + '…' : node.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
