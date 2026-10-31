import { useCallback, useMemo, useState } from 'react';
import { MapPin, PenLine, RefreshCw } from 'lucide-react';
import { useConnection } from './hooks/useConnection.js';
import { useReports } from './hooks/useReports.js';
import { AI_CATEGORIES } from './reportMeta.js';
import StatusLedger from './components/StatusLedger.jsx';
import Filters from './components/Filters.jsx';
import ReportList from './components/ReportList.jsx';
import ReportForm from './components/ReportForm.jsx';

const CONNECTION = {
  checking: { dot: 'bg-stone animate-pulse', label: 'Connecting…' },
  online: { dot: 'bg-moss', label: 'Live' },
  offline: { dot: 'bg-terracotta', label: 'Offline' },
};

function Header({ connection }) {
  const c = CONNECTION[connection];
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
      <a href="/" className="flex items-center gap-2.5 rounded-lg">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-forest text-paper">
          <MapPin className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="text-xl font-extrabold tracking-tight">Civicsense</span>
      </a>
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-full border border-stone px-3 py-1 text-sm font-medium" role="status">
          <span className={`h-2 w-2 rounded-full ${c.dot}`} aria-hidden="true" />
          <span className="sr-only">Server connection: </span>
          {c.label}
        </span>
        <a
          href="#report"
          className="inline-flex items-center gap-1.5 rounded-full bg-forest px-3.5 py-1.5 text-sm font-semibold text-paper hover:bg-forest/90 lg:hidden"
        >
          <PenLine className="h-4 w-4" aria-hidden="true" />
          Report
        </a>
      </div>
    </header>
  );
}

function OfflineBanner({ onRetry }) {
  return (
    <div role="alert" className="border-y border-terracotta/40 bg-terracotta/10">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm sm:px-6">
        <p className="text-clay">
          <strong>The Civicsense server isn't responding.</strong> You can still read what's loaded. New reports and status
          changes won't save until it's back.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-lg border border-clay/40 px-3 py-1.5 font-semibold text-clay hover:bg-white/60"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Check again
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [filters, setFilters] = useState({ category: '', status: '' });
  const { all, filtered, refresh } = useReports(filters);
  const connection = useConnection(refresh);
  const hasFilter = Boolean(filters.category || filters.status);

  // Fixed AI categories plus any other category already stored (reporters could set their own before Step 3).
  const categories = useMemo(() => {
    const extra = new Set((all.data ?? []).map((r) => r.category).filter((c) => !AI_CATEGORIES.includes(c)));
    return [...AI_CATEGORIES, ...[...extra].sort()];
  }, [all.data]);

  const retryAll = useCallback(() => {
    connection.recheck();
    refresh();
  }, [connection, refresh]);

  return (
    <div className="min-h-screen">
      <Header connection={connection.status} />
      {connection.status === 'offline' && <OfflineBanner onRetry={retryAll} />}

      <main className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <section className="grid gap-8 pb-10 pt-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-end lg:pt-14">
          <div>
            <h1 className="max-w-xl text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
              Welcome to Civicsense. See what needs fixing nearby.
            </h1>
            <p className="mt-4 max-w-lg text-lg leading-relaxed text-forest/75">
              Log a pothole, broken streetlight or missed garbage pickup in plain words. Gemma suggests a category and
              priority, and reviewers move each report from submitted to resolved.
            </p>
          </div>
          <StatusLedger
            reports={all.data}
            loading={all.status === 'loading'}
            activeStatus={filters.status}
            onSelectStatus={(status) => setFilters((f) => ({ ...f, status }))}
          />
        </section>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-start">
          <div className="lg:sticky lg:top-6">
            <ReportForm onCreated={refresh} />
          </div>

          <section aria-labelledby="recent-heading">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-stone pb-4">
              <div>
                <h2 id="recent-heading" className="text-2xl font-bold tracking-tight">
                  Recent reports
                </h2>
                <p className="mt-0.5 text-sm text-moss" aria-live="polite">
                  {filtered.data
                    ? hasFilter
                      ? `${filtered.data.length} of ${all.data?.length ?? '…'} match`
                      : 'Newest first. Open a report to review it.'
                    : ' '}
                </p>
              </div>
              <Filters categories={categories} filters={filters} onChange={setFilters} />
            </div>
            <div className="mt-2">
              <ReportList
                query={filtered}
                hasFilter={hasFilter}
                onClearFilters={() => setFilters({ category: '', status: '' })}
                onRetry={retryAll}
                onUpdated={refresh}
              />
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-stone py-6 text-center text-sm text-forest/60">
        Civicsense, built for Hack Day. AI suggestions are not official decisions.
      </footer>
    </div>
  );
}
