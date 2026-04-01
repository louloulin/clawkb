import { useEffect, useRef } from 'react';
import { Search, Plus, Upload, Tag, Sparkles, ArrowRight, Database, Shield, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useKbStore } from '@/store/kb-store';
import { isTauri } from '@/api/platform';
import { formatBytes } from '@/lib/format';

export function DashboardPage() {
  const { stats, isKbOpen, setPage, openKb } = useKbStore();
  const demoInitRef = useRef(false);

  // Auto-open demo KB in browser mode
  useEffect(() => {
    if (!isTauri() && !isKbOpen && !demoInitRef.current) {
      demoInitRef.current = true;
      openKb('/demo/clawkb-demo');
    }
  }, [isKbOpen, openKb]);

  if (!isKbOpen || !stats) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md px-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center mx-auto mb-6">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-2xl font-semibold mb-2 tracking-tight">Welcome to ClawKB</h2>
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            Your local-first, secure personal knowledge base.<br />
            Store, search, and organize with AI-powered semantic search.
          </p>
          <div className="flex items-center justify-center gap-3 mb-8">
            <FeatureBadge icon={<Shield className="h-3 w-3" />} label="Local-first" />
            <FeatureBadge icon={<Zap className="h-3 w-3" />} label="Semantic Search" />
            <FeatureBadge icon={<Database className="h-3 w-3" />} label="Encrypted" />
          </div>
          <Button onClick={() => setPage('settings')} className="gap-2 rounded-xl">
            Get Started <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-1">Dashboard</h2>
        <p className="text-sm text-muted-foreground">Overview of your knowledge base</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Documents" value={stats.frame_count.toString()} />
        <StatCard label="Storage" value={formatBytes(stats.size_bytes)} />
        <StatCard label="Lex Index" value={stats.has_lex_index ? 'Active' : 'Inactive'} accent={stats.has_lex_index} />
        <StatCard label="Vec Index" value={stats.has_vec_index ? 'Active' : 'Inactive'} accent={stats.has_vec_index} />
      </div>

      {/* Compression */}
      <div className="rounded-xl bg-muted/40 p-4 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Compression Ratio</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {formatBytes(stats.payload_bytes)} payload in {formatBytes(stats.size_bytes)} storage
            </div>
          </div>
          <div className="text-2xl font-semibold text-primary tabular-nums">
            {stats.compression_ratio_percent.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-2">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Quick Actions</h3>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <ActionCard label="Search" icon={<Search className="h-5 w-5" />} onClick={() => setPage('search')} />
        <ActionCard label="Add Note" icon={<Plus className="h-5 w-5" />} onClick={() => setPage('notes')} />
        <ActionCard label="Import" icon={<Upload className="h-5 w-5" />} onClick={() => setPage('import')} />
        <ActionCard label="Tags" icon={<Tag className="h-5 w-5" />} onClick={() => setPage('tags')} />
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-card border border-border/50 p-4">
      <div className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">{label}</div>
      <div className={`text-lg font-semibold mt-1.5 tabular-nums ${
        accent === true ? 'text-emerald-600 dark:text-emerald-400' : accent === false ? 'text-muted-foreground/50' : ''
      }`}>
        {value}
      </div>
    </div>
  );
}

function ActionCard({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl bg-card border border-border/50 p-4 text-left hover:bg-muted/40 hover:border-border transition-all duration-100 cursor-pointer group"
    >
      <div className="text-muted-foreground group-hover:text-primary transition-colors mb-2">{icon}</div>
      <div className="text-sm font-medium">{label}</div>
    </button>
  );
}

function FeatureBadge({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-lg">
      {icon} {label}
    </span>
  );
}
