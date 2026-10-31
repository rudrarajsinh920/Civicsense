import { Inbox, RefreshCw, SearchX, WifiOff } from 'lucide-react';
import ReportRow from './ReportRow.jsx';

function Message({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-3xl border border-dashed border-stone px-6 py-10 sm:items-center sm:text-center">
      <Icon className="h-7 w-7 text-moss" aria-hidden="true" />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1 max-w-sm text-sm text-forest/70">{children}</p>
      </div>
      {action}
    </div>
  );
}

const secondaryButton =
  'inline-flex items-center gap-1.5 rounded-xl border border-stone bg-white px-3.5 py-2 text-sm font-semibold hover:border-forest/40';

export default function ReportList({ query, hasFilter, onClearFilters, onRetry, onUpdated }) {
  const { status, data, error } = query;

  if (status === 'loading' && !data) {
    return (
      <ul aria-busy="true" aria-label="Loading reports" className="space-y-3">
        {[0, 1, 2].map((i) => (
          <li key={i} className="animate-pulse rounded-2xl py-4 pl-5">
            <div className="h-5 w-2/3 rounded bg-stone" />
            <div className="mt-3 h-4 w-full rounded bg-stone/70" />
            <div className="mt-2 flex gap-3">
              <div className="h-4 w-20 rounded bg-stone/70" />
              <div className="h-4 w-24 rounded bg-stone/70" />
            </div>
          </li>
        ))}
      </ul>
    );
  }

  if (status === 'error' && !data) {
    const offline = error?.status === 0;
    return (
      <Message
        icon={offline ? WifiOff : Inbox}
        title={offline ? "Reports can't be loaded right now" : 'Something went wrong loading reports'}
        action={
          <button type="button" onClick={onRetry} className={secondaryButton}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Try again
          </button>
        }
      >
        {error?.message}
      </Message>
    );
  }

  if (data.length === 0) {
    return hasFilter ? (
      <Message
        icon={SearchX}
        title="No reports match these filters"
        action={
          <button type="button" onClick={onClearFilters} className={secondaryButton}>
            Clear filters
          </button>
        }
      >
        Try another category or status.
      </Message>
    ) : (
      <Message icon={Inbox} title="No reports yet">
        Use the form to log the first issue in your area. It will appear here straight away.
      </Message>
    );
  }

  return (
    <>
      {status === 'error' && (
        <p role="alert" className="mb-3 rounded-xl bg-clay/10 px-3 py-2 text-sm text-clay">
          Showing the last loaded reports. Refresh failed: {error.message}
        </p>
      )}
      <ul aria-busy={status === 'loading'} className="divide-y divide-stone">
        {data.map((report) => (
          <ReportRow key={report.id} report={report} onUpdated={onUpdated} />
        ))}
      </ul>
    </>
  );
}
