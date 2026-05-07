import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { HomeQuickActions } from '@/components/home/home-quick-actions';

describe('home quick actions mvp copy', () => {
  it('keeps the surface focused on import, notes, writing, and knowledge-base switching', () => {
    const onAction = vi.fn();

    render(<HomeQuickActions onAction={onAction} />);

    expect(screen.getByText('常用动作')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /导入资料/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /打开笔记/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /继续写作/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /切换知识库/i })).toBeInTheDocument();
    expect(screen.queryByText('Quick Actions')).not.toBeInTheDocument();
    expect(screen.queryByText('Open a KB first')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /导入资料/i }));

    expect(onAction).toHaveBeenCalledWith('import-material');
  });
});
