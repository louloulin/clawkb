import { BookOpen, FilePenLine, FileText } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { DocumentWorkspaceTab } from '@/store/document-workspace-store';

const PRIMARY_TAB_META: Array<{ id: DocumentWorkspaceTab; label: string; icon: typeof BookOpen }> = [
  { id: 'reader', label: '阅读', icon: BookOpen },
  { id: 'draft', label: '草稿', icon: FilePenLine },
  { id: 'notes', label: '笔记', icon: FileText },
];

interface DocumentTabsProps {
  value: DocumentWorkspaceTab;
  onValueChange: (tab: DocumentWorkspaceTab) => void;
}

export function DocumentTabs({ value, onValueChange }: DocumentTabsProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Tabs value={value} onValueChange={(next) => onValueChange(next as DocumentWorkspaceTab)}>
        <TabsList className="h-auto rounded-2xl border border-white/10 bg-white/6 p-1">
          {PRIMARY_TAB_META.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="rounded-xl px-3 py-2 text-xs data-[state=active]:bg-black/50 data-[state=active]:text-white"
              >
                <Icon className="mr-1.5 h-3.5 w-3.5" />
                {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>
    </div>
  );
}
