import { X } from 'lucide-react';
import { STATUSES } from '../reportMeta.js';

const selectClass =
  'w-full appearance-none rounded-xl border border-stone bg-white px-3 py-2 pr-8 text-sm font-medium focus:border-forest focus:outline-none bg-[url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%2312372a%27 stroke-width=%272.5%27%3E%3Cpath d=%27m6 9 6 6 6-6%27/%3E%3C/svg%3E")] bg-[length:12px] bg-[position:right_0.75rem_center] bg-no-repeat';

export default function Filters({ categories, filters, onChange }) {
  const active = filters.category || filters.status;
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="min-w-36 flex-1 sm:flex-none">
        <span className="mb-1 block text-sm font-medium text-moss">Category</span>
        <select
          className={selectClass}
          value={filters.category}
          onChange={(e) => onChange({ ...filters, category: e.target.value })}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className="min-w-36 flex-1 sm:flex-none">
        <span className="mb-1 block text-sm font-medium text-moss">Status</span>
        <select
          className={selectClass}
          value={filters.status}
          onChange={(e) => onChange({ ...filters, status: e.target.value })}
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      {active && (
        <button
          type="button"
          onClick={() => onChange({ category: '', status: '' })}
          className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-medium text-clay hover:bg-stone/60"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          Clear filters
        </button>
      )}
    </div>
  );
}
