import { CircleDot, Construction, Droplets, Lightbulb, Trash2, Waves } from 'lucide-react';

// Mirrors server-side values (server/src/db.js REPORT_STATUSES, services/gemma.js AI_CATEGORIES).
export const STATUSES = [
  { value: 'submitted', label: 'Submitted', swatch: 'bg-terracotta', text: 'text-clay', rail: 'bg-terracotta' },
  { value: 'reviewing', label: 'Under review', swatch: 'bg-moss', text: 'text-moss', rail: 'bg-moss' },
  { value: 'resolved', label: 'Resolved', swatch: 'bg-forest', text: 'text-forest', rail: 'bg-forest' },
];
export const statusMeta = (value) => STATUSES.find((s) => s.value === value) ?? STATUSES[0];

export const AI_CATEGORIES = ['Pothole', 'Garbage', 'Water Supply', 'Streetlight', 'Drainage', 'Other'];

const CATEGORY_ICONS = {
  Pothole: Construction,
  Garbage: Trash2,
  'Water Supply': Droplets,
  Streetlight: Lightbulb,
  Drainage: Waves,
};
export const categoryIcon = (category) => CATEGORY_ICONS[category] ?? CircleDot;

export const LIMITS = { title: 120, description: 2000, location: 200 };

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
const absolute = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export const formatDate = (iso) => absolute.format(new Date(iso));

// "5 minutes ago" for the last week, otherwise a calendar date.
export function formatRelative(iso) {
  const date = new Date(iso);
  const seconds = Math.round((date - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return relative.format(seconds, 'second');
  if (abs < 3600) return relative.format(Math.round(seconds / 60), 'minute');
  if (abs < 86400) return relative.format(Math.round(seconds / 3600), 'hour');
  if (abs < 7 * 86400) return relative.format(Math.round(seconds / 86400), 'day');
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}
