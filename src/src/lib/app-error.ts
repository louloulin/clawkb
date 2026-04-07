import type { ToastActionElement } from '@/components/ui/toast';

export type AppErrorKind = 'user' | 'system' | 'runtime';

export type AppErrorDetails = {
  kind: AppErrorKind;
  title: string;
  description: string;
  variant?: 'default' | 'destructive';
  action?: ToastActionElement;
};

type ClassifyOptions = {
  fallback: string;
};

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.trim();
  if (typeof error === 'string') return error.trim();
  return String(error).trim();
}

function isRuntimeLimitation(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('tauri mode') ||
    normalized.includes('desktop app') ||
    normalized.includes('desktop runtime required') ||
    normalized.includes('only available in tauri') ||
    normalized.includes('preview runtime')
  );
}

function isUserFacingInputIssue(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('knowledge base not open') ||
    normalized.includes('file not found') ||
    normalized.includes('not found') ||
    normalized.includes('please enter') ||
    normalized.includes('enter ') ||
    normalized.includes('invalid')
  );
}

export function userInputError(description: string): AppErrorDetails {
  return {
    kind: 'user',
    title: 'User action needed',
    description,
    variant: 'destructive',
  };
}

export function runtimeLimitError(description: string): AppErrorDetails {
  return {
    kind: 'runtime',
    title: 'Desktop runtime required',
    description,
    variant: 'default',
  };
}

export function systemError(description: string): AppErrorDetails {
  return {
    kind: 'system',
    title: 'System error',
    description,
    variant: 'destructive',
  };
}

export function classifyAppError(error: unknown, options: ClassifyOptions): AppErrorDetails {
  const message = normalizeErrorMessage(error);

  if (isRuntimeLimitation(message)) {
    return runtimeLimitError(options.fallback);
  }

  if (isUserFacingInputIssue(message)) {
    return userInputError(options.fallback);
  }

  return systemError(options.fallback);
}
