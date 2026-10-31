export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export class ApiError extends Error {
  constructor(message, { status = 0, details = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status; // 0 = network error / server unreachable
    this.details = details; // per-field validation messages from the server
  }
}

async function request(path, { method = 'GET', body, signal } = {}) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      signal,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(`Can't reach the Civicsense server at ${API_URL}. Check that it is running.`);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(data?.error || `Request failed (HTTP ${res.status})`, { status: res.status, details: data?.details });
  }
  return data;
}

export async function getHealth({ signal } = {}) {
  const res = await fetch(`${API_URL}/api/health`, { signal });
  if (!res.ok) throw new Error(`Health check failed (HTTP ${res.status})`);
  return res.json();
}

export function listReports({ category, status } = {}, { signal } = {}) {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (status) params.set('status', status);
  const qs = params.toString();
  return request(`/api/reports${qs ? `?${qs}` : ''}`, { signal });
}

export const getReport = (id, { signal } = {}) => request(`/api/reports/${id}`, { signal });

export const createReport = (report) => request('/api/reports', { method: 'POST', body: report });

export const updateReportStatus = (id, status) =>
  request(`/api/reports/${id}/status`, { method: 'PATCH', body: { status } });
