import { useMemo } from 'react';
import type { KbStats } from '@/api';
import { useKbStore } from '@/store/kb-store';
import { useMultiKbStore } from '@/store/multi-kb-store';

export interface RegistrySpace {
  id: string;
  name: string;
  path: string;
  description: string;
  collection: 'personal' | 'created' | 'joined' | 'shared';
  kind: 'current' | 'registered';
  addedAt: number;
  lastOpenedAt: number | null;
  stats: Pick<KbStats, 'frame_count' | 'size_bytes'> | null;
}

export function useKbRegistry() {
  const { isKbOpen, kbPath, stats } = useKbStore();
  const registry = useMultiKbStore();

  const currentSpace = useMemo<RegistrySpace | null>(() => {
    if (!isKbOpen || !kbPath) return null;
    return {
      id: '__current__',
      name: kbPath.split('/').pop() || '当前知识库',
      path: kbPath,
      description: '当前正在使用的本地知识库。',
      collection: 'personal',
      kind: 'current',
      addedAt: 0,
      lastOpenedAt: Date.now() / 1000,
      stats: stats
        ? { frame_count: stats.frame_count, size_bytes: stats.size_bytes }
        : null,
    };
  }, [isKbOpen, kbPath, stats]);

  const registeredSpaces = useMemo<RegistrySpace[]>(
    () =>
      registry.registeredKbs.map((kb) => ({
        id: kb.id,
        name: kb.name,
        path: kb.path,
        description: kb.description || 'Registered knowledge base for later reuse.',
        collection: kb.collection,
        kind: 'registered',
        addedAt: kb.addedAt,
        lastOpenedAt: kb.lastOpenedAt,
        stats: kb.stats,
      })),
    [registry.registeredKbs],
  );

  const getSpacesForCollection = (collection: RegistrySpace['collection']) => {
    if (collection === 'personal') {
      return currentSpace ? [currentSpace] : [];
    }
    return registeredSpaces.filter((space) => space.collection === collection);
  };

  const findSpaceById = (id: string | null) => {
    if (!id) return null;
    if (id === '__current__') return currentSpace;
    return registeredSpaces.find((space) => space.id === id) ?? null;
  };

  return {
    currentSpace,
    registeredSpaces,
    getSpacesForCollection,
    findSpaceById,
    registerKb: registry.registerKb,
    unregisterKb: registry.unregisterKb,
    renameKb: registry.renameKb,
    updateKb: registry.updateKb,
    recordStats: registry.recordStats,
    markOpened: registry.markOpened,
    setActiveKb: registry.setActiveKb,
    activeKbId: registry.activeKbId,
    multiKbEnabled: registry.multiKbEnabled,
    setMultiKbEnabled: registry.setMultiKbEnabled,
  };
}

export type { KbRegistration } from '@/store/multi-kb-store';
