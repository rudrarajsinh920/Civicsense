import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { updateReportStatus } from '../api.js';
import { STATUSES } from '../reportMeta.js';
import ConfirmDialog from './ConfirmDialog.jsx';

// Reviewer control: submitted → reviewing → resolved. Resolving asks for confirmation.
export default function StatusControl({ report, onUpdated }) {
  const [pending, setPending] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState(null);

  async function apply(status) {
    setConfirming(false);
    setPending(status);
    setError(null);
    try {
      onUpdated(await updateReportStatus(report.id, status));
    } catch (err) {
      setError(err.message);
    } finally {
      setPending(null);
    }
  }

  function choose(status) {
    if (status === report.status || pending) return;
    if (status === 'resolved') setConfirming(true);
    else apply(status);
  }

  return (
    <div>
      <p id={`status-label-${report.id}`} className="text-sm font-semibold">
        Reviewer status
      </p>
      <div
        role="group"
        aria-labelledby={`status-label-${report.id}`}
        className="mt-2 inline-flex flex-wrap gap-1 rounded-2xl bg-stone/60 p-1"
      >
        {STATUSES.map((s) => {
          const current = report.status === s.value;
          return (
            <button
              key={s.value}
              type="button"
              aria-pressed={current}
              disabled={Boolean(pending)}
              onClick={() => choose(s.value)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors disabled:cursor-wait ${
                current ? 'bg-white text-forest shadow-sm' : 'text-forest/70 hover:bg-white/60 hover:text-forest'
              }`}
            >
              {pending === s.value ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <span className={`h-2 w-2 rounded-full ${s.swatch}`} aria-hidden="true" />
              )}
              {s.label}
            </button>
          );
        })}
      </div>
      <p className="mt-1 min-h-5 text-sm" aria-live="polite">
        {pending && <span className="text-moss">Saving…</span>}
        {error && <span className="text-clay">Status not changed: {error}</span>}
      </p>

      <ConfirmDialog
        open={confirming}
        title="Mark this report resolved?"
        confirmLabel="Mark resolved"
        cancelLabel="Keep current status"
        onConfirm={() => apply('resolved')}
        onCancel={() => setConfirming(false)}
      >
        <p>
          Only do this once “{report.title}” has been fixed on the ground. Everyone using Civicsense will see it as resolved.
          You can change it back later.
        </p>
      </ConfirmDialog>
    </div>
  );
}
