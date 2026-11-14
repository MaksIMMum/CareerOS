import { fetchAuthSession } from 'aws-amplify/auth';
import i18n from '../i18n.js';

const API_URL = import.meta.env.VITE_API_URL || '';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    /** Machine-readable code from the backend, e.g. 'validation_error', 'quota_exceeded'. */
    public readonly code?: string,
    /** The whole error body (e.g. { kind, limit } for quota errors). */
    public readonly body?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function getAuthHeader(): Promise<Record<string, string>> {
  try {
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();
    if (token) {
      return { Authorization: `Bearer ${token}` };
    }
  } catch {
    // Not authenticated
  }
  return {};
}

export async function apiRequest<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const authHeaders = await getAuthHeader();
  const url = `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      // Lets the backend answer user-facing messages (e.g. quota errors) in the UI language.
      'Accept-Language': i18n.language === 'en' ? 'en' : 'uk',
      ...authHeaders,
      ...options.headers,
    },
  });

  if (!res.ok) {
    let errorMsg = `HTTP Error ${res.status}`;
    let errJson: Record<string, unknown> | undefined;
    try {
      errJson = await res.json();
      if (typeof errJson?.error === 'string') {
        errorMsg = errJson.error;
      }
    } catch {
      // Ignore JSON parse error on non-JSON response
    }
    throw new ApiError(errorMsg, res.status, errJson?.error as string | undefined, errJson);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface UserProfile {
  PK: string;
  SK: string;
  sub: string;
  email: string;
  createdAt: string;
  source: string;
  src?: string;
  lang: string;
}

export async function fetchMe(): Promise<{ profile: UserProfile }> {
  return apiRequest<{ profile: UserProfile }>('/me');
}

export async function syncMe(data: { source?: string; src?: string; lang?: string }): Promise<{ profile: UserProfile }> {
  return apiRequest<{ profile: UserProfile }>('/me', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ------------------------------------------------------------------ CVs

export interface CvSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface Cv extends CvSummary {
  text: string;
}

export interface CvInput {
  name: string;
  text: string;
}

export const listCvs = () => apiRequest<{ items: CvSummary[] }>('/cvs').then((r) => r.items);
export const getCv = (id: string) => apiRequest<{ item: Cv }>(`/cvs/${id}`).then((r) => r.item);
export const createCv = (data: CvInput) =>
  apiRequest<{ item: Cv }>('/cvs', { method: 'POST', body: JSON.stringify(data) }).then((r) => r.item);
export const updateCv = (id: string, data: CvInput) =>
  apiRequest<{ item: Cv }>(`/cvs/${id}`, { method: 'PUT', body: JSON.stringify(data) }).then(
    (r) => r.item,
  );
export const deleteCv = (id: string) => apiRequest<void>(`/cvs/${id}`, { method: 'DELETE' });

// ------------------------------------------------------------------ Vacancies

export interface VacancySummary {
  id: string;
  title: string;
  company: string;
  url: string;
  createdAt: string;
  updatedAt: string;
}

export interface Vacancy extends VacancySummary {
  text: string;
}

export type VacancyInput = Pick<Vacancy, 'title' | 'company' | 'url' | 'text'>;

export const listVacancies = () =>
  apiRequest<{ items: VacancySummary[] }>('/vacancies').then((r) => r.items);
export const getVacancy = (id: string) =>
  apiRequest<{ item: Vacancy }>(`/vacancies/${id}`).then((r) => r.item);
export const createVacancy = (data: VacancyInput) =>
  apiRequest<{ item: Vacancy }>('/vacancies', { method: 'POST', body: JSON.stringify(data) }).then(
    (r) => r.item,
  );
export const updateVacancy = (id: string, data: VacancyInput) =>
  apiRequest<{ item: Vacancy }>(`/vacancies/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }).then((r) => r.item);
export const deleteVacancy = (id: string) =>
  apiRequest<void>(`/vacancies/${id}`, { method: 'DELETE' });
