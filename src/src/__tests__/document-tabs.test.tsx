import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { DocumentTabs } from '@/components/documents/document-tabs';

describe('document tabs mvp surface', () => {
  it('keeps the notes workspace focused on reading, drafts, and notes only', () => {
    render(<DocumentTabs value="reader" onValueChange={() => {}} />);

    expect(screen.getByRole('tab', { name: '阅读' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '草稿' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '笔记' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: '报告' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: '播客' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '显示高级功能' })).not.toBeInTheDocument();
  });
});
