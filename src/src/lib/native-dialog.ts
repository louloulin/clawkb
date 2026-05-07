import { isTauri } from '@/api/platform';

type DialogPath = string | null;

async function loadDialog() {
  return import('@tauri-apps/plugin-dialog');
}

function normalizeSinglePath(result: string | string[] | null): DialogPath {
  if (typeof result === 'string') return result;
  if (Array.isArray(result) && typeof result[0] === 'string') return result[0];
  return null;
}

export async function pickExistingKbPath(): Promise<DialogPath> {
  if (!isTauri()) return null;
  const { open } = await loadDialog();
  return normalizeSinglePath(
    await open({
      directory: false,
      multiple: false,
      filters: [{ name: 'ClawKB Knowledge Base', extensions: ['mv2'] }],
    }),
  );
}

export async function pickNewKbPath(): Promise<DialogPath> {
  if (!isTauri()) return null;
  const { save } = await loadDialog();
  return normalizeSinglePath(
    await save({
      filters: [{ name: 'ClawKB Knowledge Base', extensions: ['mv2'] }],
      defaultPath: 'knowledge.mv2',
    }),
  );
}

export async function pickImportFilePath(): Promise<DialogPath> {
  if (!isTauri()) return null;
  const { open } = await loadDialog();
  return normalizeSinglePath(
    await open({
      directory: false,
      multiple: false,
    }),
  );
}

export async function pickImportDirectoryPath(): Promise<DialogPath> {
  if (!isTauri()) return null;
  const { open } = await loadDialog();
  return normalizeSinglePath(
    await open({
      directory: true,
      multiple: false,
    }),
  );
}

export async function pickMediaPath(): Promise<DialogPath> {
  if (!isTauri()) return null;
  const { open } = await loadDialog();
  return normalizeSinglePath(
    await open({
      directory: false,
      multiple: false,
    }),
  );
}
