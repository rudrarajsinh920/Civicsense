import { useEffect, useState } from 'react';
import { CalendarClock, ChevronDown, MapPin, Sparkles } from 'lucide-react';
import { getReport } from '../api.js';
import { formatDate, formatRelative, statusMeta } from '../reportMeta.js';
import { CategoryTag, PriorityBadge, StatusBadge } from './Badges.jsx';
import StatusControl from './StatusControl.jsx';

export default function ReportRow({ report: initial, onUpdated }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState({ status: 'idle', report: null, error: null });
  const report = detail.report ?? initial;
  const panelId = `report-${report.id}-detail`;

  // Fresh copy from GET /api/reports/:id each time the row is opened.
  useEffect(() => {
    if (!open) return undefined;
    const controller = new AbortController();
    setDetail((d) => ({ ...d, status: 'loading', error: null }));
    getReport(initial.id, { signal: controller.signal })
      .then((r) => setDetail({ status: 'ready', report: r, error: null }))
      .catch((error) => {
        if (error.name !== 'AbortError') setDetail((d) => ({ ...d, status: 'error', error }));
      });
    return () => controller.abort();
  }, [open, initial.id]);

  // List refreshes (e.g. after another status change) replace the cached detail.
  useEffect(() => {
    setDetail((d) => (d.report && d.report.updated_at !== initial.updated_at ? { ...d, report: null } : d));
  }, [initial.updated_at]);

  function handleUpdated(updated) {
    setDetail({ status: 'ready', report: updated, error: null });
    onUpdated(updated);
  }

  return (
    <li className="relative">
      <span className={`absolute inset-y-4 left-0 w-1 rounded-full ${statusMeta(report.status).rail}`} aria-hidden="true" />
      <div className="pl-5">
        {/* The title button's ::after stretches over the whole summary so the row is one click target. */}
        <div className="relative rounded-2xl py-4 pr-2 transition-colors hover:bg-white/70 has-focus-visible:bg-white/70 has-focus-visible:ring-2 has-focus-visible:ring-terracotta sm:pr-3">
          <h3 className="text-base font-semibold leading-snug sm:text-lg">
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-controls={panelId}
              className="flex w-full items-start justify-between gap-3 text-left after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
            >
              {report.title}
              <ChevronDown
                className={`mt-1 h-5 w-5 shrink-0 text-moss transition-transform ${open ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>
          </h3>
          <p className="mt-1 line-clamp-2 max-w-prose text-sm leading-relaxed text-forest/75">
            {report.ai_summary ? (
              <>
                <Sparkles className="mr-1 inline h-3.5 w-3.5 -translate-y-px text-moss" aria-hidden="true" />
                <span className="sr-only">AI summary: </span>
                {report.ai_summary}
              </>
            ) : (
              report.description
            )}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <StatusBadge status={report.status} />
            <CategoryTag category={report.category} />
            <PriorityBadge priority={report.priority} />
            <span className="inline-flex min-w-0 items-center gap-1 text-sm text-forest/70">
              <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{report.location}</span>
            </span>
            <time dateTime={report.created_at} title={formatDate(report.created_at)} className="text-sm text-forest/60">
              {formatRelative(report.created_at)}
            </time>
          </div>
        </div>

        {open && (
          <div id={panelId} className="reveal mb-4 mr-2 rounded-2xl border border-stone bg-white/70 p-4 sm:p-5">
            {detail.status === 'error' && (
              <p className="mb-3 text-sm text-clay">Couldn't load the latest version: {detail.error.message}</p>
            )}
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div className="sm:col-span-2">
                <dt className="font-semibold">What the reporter wrote</dt>
                <dd className="mt-1 whitespace-pre-line leading-relaxed text-forest/80">{report.description}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="flex items-center gap-1.5 font-semibold">
                  <Sparkles className="h-4 w-4 text-moss" aria-hidden="true" />
                  AI suggestion
                </dt>
                <dd className="mt-1 leading-relaxed text-forest/80">
                  {report.ai_summary ? (
                    <>
                      {report.ai_summary}
                      <span className="mt-1 block text-xs text-moss">
                        Category, priority and summary were suggested by Gemma and haven't been checked by a person.
                      </span>
                    </>
                  ) : (
                    <span className="text-forest/60">No AI suggestion for this report. Category and priority are defaults.</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="font-semibold">Location</dt>
                <dd className="mt-1 text-forest/80">
                  {report.location}
                  {report.latitude != null && (
                    <span className="block tabular-nums text-forest/60">
                      {report.latitude.toFixed(5)}, {report.longitude.toFixed(5)}
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 font-semibold">
                  <CalendarClock className="h-4 w-4" aria-hidden="true" />
                  Timeline
                </dt>
                <dd className="mt-1 text-forest/80">
                  Reported {formatDate(report.created_at)}
                  {report.updated_at !== report.created_at && (
                    <span className="block text-forest/60">Last updated {formatDate(report.updated_at)}</span>
                  )}
                </dd>
              </div>
            </dl>
            <div className="mt-5 border-t border-stone pt-4">
              <StatusControl report={report} onUpdated={handleUpdated} />
            </div>
          </div>
        )}
      </div>
    </li>
  );
}
