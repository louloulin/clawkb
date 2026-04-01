import { useState, useEffect, useCallback } from 'react';
import { Link2 } from 'lucide-react';
import { api } from '@/api';
import { useKbStore } from '@/store/kb-store';
import type { SearchHit } from '@/api';

interface Entity {
  name: string;
  count: number;
  last_seen: string;
}

const STOP_WORDS = new Set(['The', 'And', 'For', 'New', 'Update', 'Add', 'Fix', 'This', 'That', 'With', 'From']);

export function EntitiesPage() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [entityDocs, setEntityDocs] = useState<SearchHit[]>([]);
  const openDocument = useKbStore(s => s.openDocument);

  useEffect(() => {
    setLoading(true);
    api.timeline(100)
      .then(entries => {
        const entityMap = new Map<string, { count: number; last_seen: string }>();
        const pattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g;
        for (const entry of entries) {
          for (const match of entry.title.matchAll(pattern)) {
            const name = match[1];
            if (name.length > 2 && !STOP_WORDS.has(name)) {
              const existing = entityMap.get(name) || { count: 0, last_seen: '' };
              entityMap.set(name, { count: existing.count + 1, last_seen: entry.timestamp });
            }
          }
        }
        setEntities(
          Array.from(entityMap.entries())
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.count - a.count)
        );
      })
      .catch(() => setEntities([]))
      .finally(() => setLoading(false));
  }, []);

  const searchEntity = useCallback(async (name: string) => {
    setSelectedEntity(name);
    try {
      const hits = await api.search(name, 20, 'hybrid');
      setEntityDocs(hits);
    } catch {
      setEntityDocs([]);
    }
  }, []);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-1">Entities</h2>
        <p className="text-sm text-muted-foreground">Named entities extracted from your documents</p>
      </div>

      {loading ? (
        <div className="flex flex-wrap gap-2">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="h-7 w-20 rounded-lg bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : entities.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-12 h-12 rounded-full bg-muted/40 flex items-center justify-center mx-auto mb-4">
            <Link2 className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <p className="text-sm text-muted-foreground mb-1">No entities found</p>
          <p className="text-xs text-muted-foreground/60">Add some documents first</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-8">
            {entities.slice(0, 50).map(entity => {
              const isActive = selectedEntity === entity.name;
              return (
                <button
                  key={entity.name}
                  onClick={() => searchEntity(entity.name)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'bg-muted/40 text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                  }`}
                >
                  {entity.name}
                  <span className="opacity-50 text-[11px]">({entity.count})</span>
                </button>
              );
            })}
          </div>

          {selectedEntity && (
            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Documents mentioning "{selectedEntity}"
              </h3>
              <div className="space-y-1.5">
                {entityDocs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No documents found</p>
                ) : (
                  entityDocs.map(hit => (
                    <button
                      key={hit.id}
                      onClick={() => openDocument(hit)}
                      className="w-full text-left rounded-xl bg-card border border-border/50 p-4 hover:bg-muted/20 hover:border-border transition-colors cursor-pointer group"
                    >
                      <div className="text-[13px] font-medium mb-1 group-hover:text-primary transition-colors">{hit.title || '(untitled)'}</div>
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{hit.content}</p>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
