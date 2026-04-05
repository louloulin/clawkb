import { create } from 'zustand';
import { api } from '@/api';
import type { SearchHit } from '@/api';

export type ReportTemplate = 'blank' | 'article' | 'meeting' | 'proposal' | 'research' | 'summary';

export interface ReportSection {
  id: string;
  title: string;
  content: string;
}

export interface Report {
  title: string;
  template: ReportTemplate;
  selectedDocs: SearchHit[];
  outline: string[];
  sections: ReportSection[];
  generatedAt: string;
}

interface ReportState {
  selectedDocs: SearchHit[];
  template: ReportTemplate;
  outline: string[];
  sections: ReportSection[];
  isGenerating: boolean;
  isExporting: boolean;

  // Actions
  selectDoc: (doc: SearchHit) => void;
  deselectDoc: (docId: string) => void;
  clearDocs: () => void;
  setTemplate: (t: ReportTemplate) => void;
  generateOutline: (baseContext?: string) => Promise<void>;
  generateSection: (sectionTitle: string, baseContext?: string) => Promise<void>;
  updateSectionContent: (sectionId: string, content: string) => void;
  deleteSection: (sectionId: string) => void;
  addCustomSection: (title: string) => void;
  exportMarkdown: () => string;
  reset: () => void;
}

const TEMPLATE_PROMPTS: Record<ReportTemplate, string> = {
  blank: 'Generate a blank report outline with placeholders for sections.',
  article: 'Generate a structured article outline with introduction, body sections, and conclusion.',
  meeting: 'Generate a meeting minutes outline with attendees, agenda, discussions, and action items.',
  proposal: 'Generate a business proposal outline with executive summary, problem statement, solution, and pricing.',
  research: 'Generate a research report outline with abstract, background, methodology, results, and conclusion.',
  summary: 'Generate a comprehensive summary report outline covering key findings, analysis, and recommendations.',
};

export const useReportStore = create<ReportState>((set, get) => ({
  selectedDocs: [],
  template: 'article',
  outline: [],
  sections: [],
  isGenerating: false,
  isExporting: false,

  selectDoc: (doc) => {
    const { selectedDocs } = get();
    if (selectedDocs.some(d => d.id === doc.id)) return;
    set({ selectedDocs: [...selectedDocs, doc] });
  },

  deselectDoc: (docId) => {
    set({ selectedDocs: get().selectedDocs.filter(d => d.id !== docId) });
  },

  clearDocs: () => {
    set({ selectedDocs: [], outline: [], sections: [] });
  },

  setTemplate: (t) => {
    set({ template: t });
  },

  generateOutline: async (baseContext?: string) => {
    const { template, selectedDocs } = get();
    set({ isGenerating: true });

    const docsContext = selectedDocs.length > 0
      ? `Based on these documents from your knowledge base:\n${selectedDocs.map(d => `## ${d.title}\n${d.content?.slice(0, 500)}...`).join('\n\n')}\n\n`
      : '';

    const prompt = baseContext
      ? `Based on the following content, generate a detailed report outline:\n\n${baseContext}\n\nUse the "${template}" report format.`
      : `${docsContext}Generate a detailed report outline using the "${template}" report format. List each section as a line starting with "- ".`;

    try {
      const result = await api.aiAsk(prompt, 8);
      const answer = result.answer || '';

      // Parse outline from the response
      const outline = answer
        .split('\n')
        .filter(line => line.trim().startsWith('-') || line.trim().startsWith('##') || line.trim().match(/^\d+\./))
        .map(line => line.replace(/^[\s#*\->0-9.]+/, '').trim())
        .filter(Boolean);

      // Generate sections from outline
      const sections = outline.map((title, i) => ({
        id: `section-${Date.now()}-${i}`,
        title,
        content: '',
      }));

      set({ outline, sections, isGenerating: false });
    } catch {
      set({ isGenerating: false });
    }
  },

  generateSection: async (sectionTitle, baseContext?: string) => {
    const { selectedDocs, sections } = get();
    set({ isGenerating: true });

    const docsContext = selectedDocs.length > 0
      ? `Use the following documents from your knowledge base as reference:\n${selectedDocs.map(d => `## ${d.title}\n${d.content?.slice(0, 800)}...`).join('\n\n')}\n\n`
      : '';

    const existingSections = sections
      .filter(s => s.title !== sectionTitle && s.content)
      .map(s => `### ${s.title}\n${s.content}`)
      .join('\n\n');

    const prompt = `${docsContext}Write detailed content for the section "${sectionTitle}" of a report.
${existingSections ? `Other sections in this report:\n${existingSections}\n` : ''}
Write comprehensive, well-structured content for this section.`;

    try {
      const result = await api.aiAsk(prompt, 8);
      const content = result.answer || 'No content generated for this section.';

      set({
        sections: sections.map(s =>
          s.title === sectionTitle ? { ...s, content } : s
        ),
        isGenerating: false,
      });
    } catch {
      set({ isGenerating: false });
    }
  },

  updateSectionContent: (sectionId, content) => {
    set({
      sections: get().sections.map(s =>
        s.id === sectionId ? { ...s, content } : s
      ),
    });
  },

  deleteSection: (sectionId) => {
    set({
      sections: get().sections.filter(s => s.id !== sectionId),
      outline: get().outline.filter((_, i) => {
        // Match by index
        return true;
      }),
    });
  },

  addCustomSection: (title) => {
    set({
      sections: [
        ...get().sections,
        { id: `section-${Date.now()}`, title, content: '' },
      ],
    });
  },

  exportMarkdown: () => {
    const { sections, template, selectedDocs } = get();
    const date = new Date().toLocaleDateString();

    let md = `# Report\n\n`;
    md += `*Generated on ${date}*\n`;
    md += `*Template: ${template}*\n`;
    if (selectedDocs.length > 0) {
      md += `*Sources: ${selectedDocs.map(d => d.title).join(', ')}*\n`;
    }
    md += `\n---\n\n`;

    for (const section of sections) {
      md += `## ${section.title}\n\n`;
      md += section.content || '_No content yet._\n\n';
    }

    return md;
  },

  reset: () => {
    set({
      selectedDocs: [],
      template: 'article',
      outline: [],
      sections: [],
      isGenerating: false,
      isExporting: false,
    });
  },
}));

export const TEMPLATE_INFO: Record<ReportTemplate, { label: string; description: string; icon: string }> = {
  blank: { label: 'Blank', description: 'Start from scratch', icon: '📄' },
  article: { label: 'Article', description: 'News or blog article format', icon: '📰' },
  meeting: { label: 'Meeting', description: 'Meeting minutes with action items', icon: '📝' },
  proposal: { label: 'Proposal', description: 'Business proposal or project plan', icon: '💼' },
  research: { label: 'Research', description: 'Research report with methodology', icon: '🔬' },
  summary: { label: 'Summary', description: 'Executive summary with recommendations', icon: '📊' },
};
