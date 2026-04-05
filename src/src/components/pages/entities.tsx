import { useEffect, useState } from 'react';
import { Link2, Network } from 'lucide-react';
import { api } from '@/api';
import { useKbStore } from '@/store/kb-store';
import type { EntityInfo, RelationEdge, SearchHit } from '@/api';

export function EntitiesPage() {
  const [entities, setEntities] = useState<EntityInfo[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<EntityInfo | null>(null);
  const [edges, setEdges] = useState<RelationEdge[]>([]);
  const [entityDocs, setEntityDocs] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(true);
  const openDocument = useKbStore((state) => state.openDocument);

  useEffect(() => {
    setLoading(true);
    api.listEntities()
      .then((result) => setEntities(result))
      .catch(() => setEntities([]))
      .finally(() => setLoading(false));
  }, []);

  const handleSelectEntity = async (entity: EntityInfo) => {
    setSelectedEntity(entity);
    const [entityEdges, hits] = await Promise.all([
      api.getEntityEdges(entity.id).catch(() => []),
      api.searchWithGraph('*', `${entity.kind}:${entity.display_name}`, 20, 'hybrid').catch(() => []),
    ]);
    setEdges(entityEdges);
    setEntityDocs(hits);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-1">Entities</h2>
        <p className="text-sm text-muted-foreground">Real entities from LogicMesh, with graph-aware document lookup.</p>
      </div>

      {loading ? (
        <div className="flex flex-wrap gap-2">
          {[...Array(10)].map((_, index) => (
            <div key={index} className="h-8 w-24 rounded-lg bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : entities.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-12 h-12 rounded-full bg-muted/40 flex items-center justify-center mx-auto mb-4">
            <Link2 className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <p className="text-sm text-muted-foreground mb-1">No graph entities available</p>
          <p className="text-xs text-muted-foreground/60">Import more knowledge and let entity extraction run.</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="space-y-2">
            {entities.map((entity) => {
              const active = selectedEntity?.id === entity.id;
              return (
                <button
                  key={entity.id}
                  onClick={() => void handleSelectEntity(entity)}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                    active
                      ? 'border-primary/30 bg-primary/8 text-primary'
                      : 'border-border/50 bg-card hover:bg-muted/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">{entity.display_name}</div>
                    <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{entity.kind}</span>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    mentions {entity.mention_count} · confidence {entity.confidence}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="rounded-2xl border bg-card p-5">
            {selectedEntity ? (
              <div className="space-y-5">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Selected Entity</div>
                  <h3 className="mt-2 text-lg font-semibold">{selectedEntity.display_name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Canonical: {selectedEntity.canonical_name} · Frames: {selectedEntity.frame_ids.length}
                  </p>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-2">
                    <Network className="h-3.5 w-3.5" />
                    Relations ({edges.length})
                  </div>
                  {edges.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No relation edges recorded for this entity.</p>
                  ) : (
                    <div className="space-y-2">
                      {edges.slice(0, 8).map((edge, index) => (
                        <div key={`${edge.from_id}-${edge.to_id}-${index}`} className="rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                          {edge.link} · confidence {edge.confidence}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-2">
                    Documents in Graph Context ({entityDocs.length})
                  </div>
                  {entityDocs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No graph-filtered documents found.</p>
                  ) : (
                    <div className="space-y-2">
                      {entityDocs.map((hit) => (
                        <button
                          key={hit.id}
                          onClick={() => openDocument(hit)}
                          className="w-full rounded-xl border border-border/50 bg-card px-4 py-3 text-left transition hover:bg-muted/20"
                        >
                          <div className="text-sm font-medium">{hit.title}</div>
                          <div className="mt-2 line-clamp-2 text-xs leading-6 text-muted-foreground">{hit.content}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-[320px] items-center justify-center text-center text-sm text-muted-foreground">
                Pick an entity on the left to inspect real graph relations and graph-filtered documents.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
