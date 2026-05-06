import { safeStorageGet, safeStorageSet } from './persistence';

export const TEMPLATES_STORAGE_KEY = 'clawkb-templates';

export interface EditorTemplate {
  id: string;
  label: string;
  title: string;
  content: string;
  builtin?: boolean;
}

const DEFAULT_TEMPLATES: EditorTemplate[] = [
  {
    id: 'blank',
    label: '空白',
    title: '无标题文档',
    content: '',
    builtin: true,
  },
  {
    id: 'article',
    label: '文章',
    title: '文章标题',
    content: '<h2>引言</h2><p>以引人入胜的开头开始...</p><h2>要点</h2><p>讨论核心观点...</p><h2>总结</h2><p>归纳要点和收获...</p>',
    builtin: true,
  },
  {
    id: 'report',
    label: '报告',
    title: '报告标题',
    content: '<h2>摘要</h2><p>简要概述发现...</p><h2>背景</h2><p>上下文和动机...</p><h2>分析</h2><p>详细发现...</p><h2>建议</h2><ul><li>建议一</li><li>建议二</li></ul><h2>结论</h2><p>最终想法...</p>',
    builtin: true,
  },
  {
    id: 'email',
    label: '邮件',
    title: '邮件草稿',
    content: '<p>[收件人]，</p><p>你好！</p><p>[主要内容]</p><p>此致，<br/>[你的名字]</p>',
    builtin: true,
  },
  {
    id: 'meeting',
    label: '会议纪要',
    title: '会议纪要',
    content: '<h2>会议：[主题]</h2><p><strong>日期：</strong>[日期] | <strong>参与者：</strong>[姓名]</p><h3>议程</h3><ol><li>议题一</li><li>议题二</li></ol><h3>待办事项</h3><ul><li>[ ] 任务一 — @负责人</li><li>[ ] 任务二 — @负责人</li></ul><h3>笔记</h3><p>讨论要点...</p>',
    builtin: true,
  },
  {
    id: 'proposal',
    label: '提案',
    title: '提案标题',
    content: '<h2>问题描述</h2><p>我们要解决什么问题？</p><h2>解决方案</h2><p>我们如何解决？</p><h2>实施计划</h2><ol><li>阶段一：...</li><li>阶段二：...</li></ol><h2>时间线与预算</h2><p>预估时间和成本...</p><h2>预期成果</h2><ul><li>成果一</li><li>成果二</li></ul>',
    builtin: true,
  },
];

export function getTemplates(): EditorTemplate[] {
  const stored = safeStorageGet<EditorTemplate[]>(TEMPLATES_STORAGE_KEY, []);
  // Merge: builtin always present, user templates appended
  const userTemplates = stored.filter(t => !t.builtin);
  return [...DEFAULT_TEMPLATES, ...userTemplates];
}

export function saveUserTemplate(template: EditorTemplate): void {
  const stored = safeStorageGet<EditorTemplate[]>(TEMPLATES_STORAGE_KEY, []);
  const existing = stored.findIndex(t => t.id === template.id && !t.builtin);
  if (existing >= 0) {
    stored[existing] = template;
  } else {
    stored.push(template);
  }
  safeStorageSet(TEMPLATES_STORAGE_KEY, stored);
}

export function deleteUserTemplate(id: string): void {
  const stored = safeStorageGet<EditorTemplate[]>(TEMPLATES_STORAGE_KEY, []);
  safeStorageSet(
    TEMPLATES_STORAGE_KEY,
    stored.filter(t => t.builtin || t.id !== id),
  );
}

export function getUserTemplates(): EditorTemplate[] {
  return safeStorageGet<EditorTemplate[]>(TEMPLATES_STORAGE_KEY, []).filter(t => !t.builtin);
}
