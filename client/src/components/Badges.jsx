import { CheckCircle2, SignalHigh, SignalLow, SignalMedium } from 'lucide-react';
import { categoryIcon, statusMeta } from '../reportMeta.js';

export function StatusBadge({ status }) {
  const s = statusMeta(status);
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${s.text}`}>
      {status === 'resolved' ? (
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
      ) : (
        <span className={`h-2 w-2 rounded-full ${s.swatch}`} aria-hidden="true" />
      )}
      {s.label}
    </span>
  );
}

const PRIORITY = {
  High: { icon: SignalHigh, className: 'text-clay' },
  Medium: { icon: SignalMedium, className: 'text-moss' },
  Low: { icon: SignalLow, className: 'text-forest/70' },
};

export function PriorityBadge({ priority }) {
  const { icon: Icon, className } = PRIORITY[priority] ?? PRIORITY.Medium;
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-medium ${className}`}>
      <Icon className="h-4 w-4" aria-hidden="true" />
      {priority} priority
    </span>
  );
}

export function CategoryTag({ category }) {
  const Icon = categoryIcon(category);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-stone/70 px-2.5 py-0.5 text-sm font-medium">
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {category}
    </span>
  );
}
