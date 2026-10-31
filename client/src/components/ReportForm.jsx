import { useId, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Send, Sparkles } from 'lucide-react';
import { createReport } from '../api.js';
import { LIMITS } from '../reportMeta.js';
import { CategoryTag, PriorityBadge, StatusBadge } from './Badges.jsx';

const EMPTY = { title: '', description: '', location: '', latitude: '', longitude: '' };

// Same rules as server/src/routes/reports.js; the server stays the source of truth.
function validate(values) {
  const errors = {};
  for (const field of ['title', 'description', 'location']) {
    const v = values[field].trim();
    if (!v) errors[field] = 'Required';
    else if (v.length > LIMITS[field]) errors[field] = `Keep it under ${LIMITS[field]} characters`;
  }
  const lat = values.latitude.trim();
  const lng = values.longitude.trim();
  if (lat || lng) {
    if (!lat || !lng) errors.coordinates = 'Enter both latitude and longitude, or leave both empty';
    if (lat && !(Number(lat) >= -90 && Number(lat) <= 90)) errors.latitude = 'Between -90 and 90';
    if (lng && !(Number(lng) >= -180 && Number(lng) <= 180)) errors.longitude = 'Between -180 and 180';
  }
  return errors;
}

function Field({ label, hint, error, counter, children, id }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
        </label>
        {counter}
      </div>
      {hint && (
        <p id={`${id}-hint`} className="mt-0.5 text-xs text-moss">
          {hint}
        </p>
      )}
      <div className="mt-1.5">{children}</div>
      {error && (
        <p id={`${id}-error`} className="mt-1 flex items-center gap-1 text-sm text-clay">
          <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

const inputClass = (invalid) =>
  `w-full rounded-xl border bg-white px-3.5 py-2.5 text-[15px] placeholder:text-forest/40 transition-colors focus:outline-none focus:ring-2 disabled:bg-paper ${
    invalid ? 'border-clay focus:ring-clay/30' : 'border-stone focus:border-forest focus:ring-forest/15'
  }`;

function AiResult({ report }) {
  return (
    <div className="reveal mt-6 rounded-2xl border border-moss/30 bg-moss/5 p-4" role="status">
      <p className="flex items-center gap-2 font-semibold">
        <CheckCircle2 className="h-5 w-5 text-moss" aria-hidden="true" />
        Report #{report.id} saved
      </p>
      <div className="mt-2">
        <StatusBadge status={report.status} />
      </div>

      <div className="mt-4 border-t border-moss/20 pt-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-moss" aria-hidden="true" />
          AI suggestion from Gemma
        </p>
        {report.ai_summary ? (
          <>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-2">
              <CategoryTag category={report.category} />
              <PriorityBadge priority={report.priority} />
            </div>
            <p className="mt-2 text-sm leading-relaxed text-forest/85">{report.ai_summary}</p>
            <p className="mt-2 text-xs text-moss">
              Suggested automatically and not checked by a person yet. A reviewer may change it.
            </p>
          </>
        ) : (
          <p className="mt-1 text-sm leading-relaxed text-forest/75">
            Gemma couldn't analyse this report just now, so it was saved with the default category (Other) and priority
            (Medium). A reviewer can still pick it up.
          </p>
        )}
      </div>
    </div>
  );
}

export default function ReportForm({ onCreated }) {
  const id = useId();
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const inFlight = useRef(false); // blocks double submits before React re-renders the disabled button

  const set = (field) => (e) => {
    setValues((v) => ({ ...v, [field]: e.target.value }));
    if (errors[field] || errors.coordinates) setErrors((er) => ({ ...er, [field]: undefined, coordinates: undefined }));
  };

  function focusFirstError(found) {
    const order = ['title', 'description', 'location', 'latitude', 'longitude', 'coordinates'];
    const first = order.find((f) => found[f]);
    if (!first) return;
    // Wait for React to re-enable the fieldset before focusing.
    setTimeout(() => {
      const el = document.getElementById(`${id}-${first === 'coordinates' ? 'latitude' : first}`);
      el?.closest('details')?.setAttribute('open', '');
      el?.focus();
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (inFlight.current) return;

    const found = validate(values);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) {
      focusFirstError(found);
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    setResult(null);
    try {
      const payload = {
        title: values.title.trim(),
        description: values.description.trim(),
        location: values.location.trim(),
      };
      if (values.latitude.trim()) {
        payload.latitude = Number(values.latitude);
        payload.longitude = Number(values.longitude);
      }
      const report = await createReport(payload);
      setResult(report);
      setValues(EMPTY);
      onCreated(report);
    } catch (err) {
      if (err.details) {
        setErrors(err.details);
        focusFirstError(err.details);
      }
      setFormError(
        err.status === 0 ? err.message : err.details ? 'Check the highlighted fields and try again.' : `Report not saved: ${err.message}`,
      );
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  const fid = (name) => `${id}-${name}`;
  const describedBy = (name, hint) =>
    [hint && `${fid(name)}-hint`, errors[name] && `${fid(name)}-error`].filter(Boolean).join(' ') || undefined;

  return (
    <section aria-labelledby={`${id}-heading`} className="rounded-3xl bg-forest p-5 text-paper sm:p-7" id="report">
      <h2 id={`${id}-heading`} className="text-xl font-bold">
        Report an issue
      </h2>
      <p className="mt-1 text-sm text-paper/75">Describe what you see. Gemma will suggest a category and priority.</p>

      <form onSubmit={handleSubmit} noValidate className="mt-5 rounded-2xl bg-paper p-4 text-forest sm:p-5">
        <fieldset disabled={submitting} className="space-y-4">
          <legend className="sr-only">Issue details</legend>
          <Field id={fid('title')} label="Issue title" error={errors.title}>
            <input
              id={fid('title')}
              value={values.title}
              onChange={set('title')}
              maxLength={LIMITS.title}
              placeholder="e.g. Deep pothole outside the bus stop"
              aria-invalid={Boolean(errors.title)}
              aria-describedby={describedBy('title')}
              className={inputClass(errors.title)}
              required
            />
          </Field>

          <Field
            id={fid('description')}
            label="What's happening?"
            hint="Include how long it's been like this and who it affects."
            error={errors.description}
            counter={
              <span className="text-xs tabular-nums text-forest/50">
                {values.description.length}/{LIMITS.description}
              </span>
            }
          >
            <textarea
              id={fid('description')}
              value={values.description}
              onChange={set('description')}
              maxLength={LIMITS.description}
              rows={4}
              aria-invalid={Boolean(errors.description)}
              aria-describedby={describedBy('description', true)}
              className={`${inputClass(errors.description)} resize-y`}
              required
            />
          </Field>

          <Field
            id={fid('location')}
            label="Location"
            hint="Street, landmark or area people would recognise."
            error={errors.location}
          >
            <input
              id={fid('location')}
              value={values.location}
              onChange={set('location')}
              maxLength={LIMITS.location}
              placeholder="e.g. MG Road, near the metro exit"
              aria-invalid={Boolean(errors.location)}
              aria-describedby={describedBy('location', true)}
              className={inputClass(errors.location)}
              required
            />
          </Field>

          <details className="group rounded-xl border border-stone px-3.5 py-2.5 open:pb-3.5">
            <summary className="cursor-pointer text-sm font-semibold text-moss marker:text-moss">
              Add coordinates (optional)
            </summary>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field id={fid('latitude')} label="Latitude" error={errors.latitude}>
                <input
                  id={fid('latitude')}
                  value={values.latitude}
                  onChange={set('latitude')}
                  inputMode="decimal"
                  placeholder="12.9716"
                  aria-invalid={Boolean(errors.latitude || errors.coordinates)}
                  aria-describedby={describedBy('latitude')}
                  className={inputClass(errors.latitude || errors.coordinates)}
                />
              </Field>
              <Field id={fid('longitude')} label="Longitude" error={errors.longitude}>
                <input
                  id={fid('longitude')}
                  value={values.longitude}
                  onChange={set('longitude')}
                  inputMode="decimal"
                  placeholder="77.5946"
                  aria-invalid={Boolean(errors.longitude || errors.coordinates)}
                  aria-describedby={describedBy('longitude')}
                  className={inputClass(errors.longitude || errors.coordinates)}
                />
              </Field>
            </div>
            {errors.coordinates && <p className="mt-2 text-sm text-clay">{errors.coordinates}</p>}
          </details>
        </fieldset>

        {formError && (
          <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl bg-clay/10 px-3 py-2.5 text-sm text-clay">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {formError}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          aria-describedby={`${id}-note`}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-clay px-5 py-3 font-semibold text-paper transition-colors hover:bg-[#873e25] disabled:cursor-wait disabled:opacity-80"
        >
          {submitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              Saving and asking Gemma…
            </>
          ) : (
            <>
              <Send className="h-4 w-4" aria-hidden="true" />
              Submit report
            </>
          )}
        </button>
        <p className="mt-2 min-h-4 text-center text-xs text-moss" aria-live="polite">
          {submitting && 'AI analysis can take up to 15 seconds. Your report is saved even if it fails.'}
        </p>
        <p id={`${id}-note`} className="mt-1 text-center text-xs text-forest/60">
          Reports are kept in Civicsense for review. They are not sent to your municipality automatically.
        </p>

        {result && <AiResult report={result} />}
      </form>
    </section>
  );
}
