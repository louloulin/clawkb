import { api, type ContextFragment, type SearchHit } from '@/api';

function basename(path: string) {
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1] || path;
}

export function buildSourceQuery(fragment: ContextFragment) {
  if (fragment.title?.trim()) return fragment.title.trim();
  if (fragment.uri?.trim()) return basename(fragment.uri.trim());
  if (fragment.text.trim()) return fragment.text.trim().slice(0, 80);
  return fragment.frame_id;
}

export function buildFallbackSourceHit(fragment: ContextFragment): SearchHit {
  return {
    id: fragment.frame_id,
    title: fragment.title || basename(fragment.uri) || '未命名资料',
    content: fragment.text,
    score: fragment.score ?? 0,
    tags: ['source-fragment'],
    created_at: '',
    source: fragment.uri || null,
  };
}

export function pickBestSourceHit(fragment: ContextFragment, hits: SearchHit[]) {
  return (
    hits.find((hit) => hit.id === fragment.frame_id) ||
    hits.find((hit) => fragment.title && hit.title === fragment.title) ||
    hits.find((hit) => fragment.uri && hit.source === fragment.uri) ||
    hits[0] ||
    buildFallbackSourceHit(fragment)
  );
}

export async function resolveSourceHit(fragment: ContextFragment, kbPaths?: string[]) {
  try {
    const query = buildSourceQuery(fragment);
    const hits =
      kbPaths && kbPaths.length > 0
        ? await api.searchMultiKb(query, kbPaths, 8, 'hybrid')
        : await api.search(query, 8, 'hybrid');
    return pickBestSourceHit(fragment, hits);
  } catch {
    return buildFallbackSourceHit(fragment);
  }
}
