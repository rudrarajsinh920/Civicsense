import { useCallback, useEffect, useState } from 'react';
import { listReports } from '../api.js';

const initial = { status: 'loading', data: null, error: null };

// Loads one report list from the API; keeps the last good data visible while reloading.
function useReportQuery({ category, status }, version, enabled) {
  const [state, setState] = useState(initial);

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    setState((s) => ({ ...s, status: 'loading', error: null }));
    listReports({ category, status }, { signal: controller.signal })
      .then((data) => setState({ status: 'ready', data, error: null }))
      .catch((error) => {
        if (error.name !== 'AbortError') setState((s) => ({ ...s, status: 'error', error }));
      });
    return () => controller.abort();
  }, [category, status, version, enabled]);

  return state;
}

const NO_FILTER = {};

/**
 * all      – every report (drives the dashboard counts and category options)
 * filtered – server-filtered list for the current filters (same as `all` when no filter is set)
 */
export function useReports(filters) {
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  const hasFilter = Boolean(filters.category || filters.status);

  const all = useReportQuery(NO_FILTER, version, true);
  const filteredQuery = useReportQuery(filters, version, hasFilter);

  return { all, filtered: hasFilter ? filteredQuery : all, refresh };
}
