import { fetchAuthSession } from 'aws-amplify/auth';

const API_URL = import.meta.env.VITE_API_URL || '';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
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
      ...authHeaders,
      ...options.headers,
    },
  });

  if (!res.ok) {
    let errorMsg = `HTTP Error ${res.status}`;
    try {
      const errJson = await res.json();
      if (errJson.error) {
        errorMsg = errJson.error;
      }
    } catch {
      // Ignore JSON parse error on non-JSON response
    }
    throw new ApiError(errorMsg, res.status);
  }

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
