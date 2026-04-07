import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import type { KbStats, SearchHit, TagInfo, TimelineEntry } from '../api';

export function useKb() {
  const [stats, setStats] = useState<KbStats | null>(null);
  const [kbPath, setKbPath] = useState('');
  const [isKbOpen, setIsKbOpen] = useState(false);

  const open = useCallback(async (path: string) => {
    const s = await api.openKb(path);
    setStats(s);
    setKbPath(path);
    setIsKbOpen(true);
  }, []);

  const create = useCallback(async (path: string) => {
    const s = await api.createKb(path);
    setStats(s);
    setKbPath(path);
    setIsKbOpen(true);
  }, []);

  const refreshStats = useCallback(async () => {
    if (!isKbOpen) return;
    const s = await api.getStats();
    setStats(s);
  }, [isKbOpen]);

  return { stats, kbPath, isKbOpen, open, create, refreshStats };
}

export function useSearch() {
  const [results, setResults] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (query: string, mode: 'hybrid' | 'lex' | 'sem' = 'hybrid', topK = 10) => {
    if (!query.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const hits = await api.search(query, topK, mode);
      setResults(hits);
    } catch (error) {
      setResults([]);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  return { results, loading, search };
}

export function useTags() {
  const [tags, setTags] = useState<TagInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const t = await api.listTags();
      setTags(t);
    } catch {
      setTags([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { tags, loading, refresh };
}

export function useTimeline(limit = 20) {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.timeline(limit)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [limit]);

  return { entries, loading };
}

export function usePlatform() {
  const [isTauri, setIsTauri] = useState(false);

  useEffect(() => {
    setIsTauri(typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window);
  }, []);

  return { isTauri };
}
