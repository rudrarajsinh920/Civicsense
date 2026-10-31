import { STATUSES } from '../reportMeta.js';

// Pipeline view of all reports. Each status doubles as a filter toggle.
export default function StatusLedger({ reports, loading, activeStatus, onSelectStatus }) {
  const total = reports?.length ?? 0;
  const counts = Object.fromEntries(STATUSES.map((s) => [s.value, 0]));
  for (const r of reports ?? []) if (r.status in counts) counts[r.status] += 1;
  const pending = loading && !reports;
  const unavailable = !loading && !reports; // load failed: show no numbers rather than misleading zeros

  return (
    <section aria-labelledby="ledger-heading" className="rounded-3xl border border-stone bg-white/60 p-5 sm:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 id="ledger-heading" className="text-lg font-semibold">
          Where reports stand
        </h2>
        <p className="text-sm text-moss" aria-live="polite">
          {pending ? (
            'Counting reports…'
          ) : unavailable ? (
            'Counts unavailable until the server responds'
          ) : (
            <>
              <span className="text-2xl font-bold tabular-nums text-forest">{total}</span>{' '}
              {total === 1 ? 'report' : 'reports'} in total
            </>
          )}
        </p>
      </div>

      <div
        className="mt-5 flex h-3 overflow-hidden rounded-full bg-stone"
        role="img"
        aria-label={
          unavailable ? 'Report counts unavailable' : STATUSES.map((s) => `${counts[s.value]} ${s.label.toLowerCase()}`).join(', ')
        }
      >
        {total > 0 &&
          STATUSES.map(
            (s, i) =>
              counts[s.value] > 0 && (
                <div
                  // Re-key on counts so the grow animation replays when numbers change.
                  key={`${s.value}-${counts[s.value]}-${total}`}
                  className={`ledger-segment ${s.swatch} h-full border-r-2 border-paper last:border-r-0`}
                  style={{ width: `${(counts[s.value] / total) * 100}%`, animationDelay: `${i * 90}ms` }}
                />
              ),
          )}
      </div>

      <ul className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
        {STATUSES.map((s) => {
          const active = activeStatus === s.value;
          return (
            <li key={s.value}>
              <button
                type="button"
                onClick={() => onSelectStatus(active ? '' : s.value)}
                aria-pressed={active}
                className={`flex w-full flex-col items-start rounded-2xl border px-3 py-3 text-left transition-colors sm:px-4 ${
                  active ? 'border-forest bg-forest text-paper' : 'border-transparent hover:border-stone hover:bg-paper'
                }`}
              >
                <span className="mt-1 flex items-start gap-1.5 text-xs font-medium sm:mt-0 sm:items-center sm:gap-2 sm:text-sm">
                  <span
                    className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full sm:mt-0 ${s.swatch} ${active ? 'ring-2 ring-paper/70' : ''}`}
                    aria-hidden="true"
                  />
                  {s.label}
                </span>
                {/* Count goes first on phones so numbers stay aligned when a label wraps. */}
                <span className="order-first text-2xl font-bold tabular-nums sm:order-none sm:mt-1 sm:text-3xl">
                  {pending ? (
                    <span className="inline-block h-7 w-8 animate-pulse rounded bg-stone" />
                  ) : unavailable ? (
                    <span aria-label="unknown">–</span>
                  ) : (
                    counts[s.value]
                  )}
                </span>
                <span className={`hidden text-xs sm:block ${active ? 'text-paper/80' : 'text-moss'}`}>
                  {active ? 'Showing only these' : 'Show only these'}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
