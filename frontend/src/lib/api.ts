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

let onUnauthorized: (() => void) | null = null;

/**
 * Called when the API answers 401 (the sign-in session is gone or expired). The Chrome extension
 * uses it to go back to its sign-in screen; the website relies on its route guards instead.
 */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
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
    if (res.status === 401) onUnauthorized?.();
    throw new ApiError(errorMsg, res.status, errJson?.error as string | undefined, errJson);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** The server's codes for "Gemini was too slow / overloaded" — the daily limit is refunded for them. */
const AI_RETRYABLE = new Set(['ai_timeout', 'ai_unavailable']);

/**
 * Runs an AI request and, if Gemini was too slow or busy, tries once more after a short pause.
 * Safe because the backend refunds the daily limit and saves nothing when the AI call fails.
 */
export async function withAiRetry<T>(fn: () => Promise<T>, delayMs = 2500): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (!(err instanceof ApiError) || !err.code || !AI_RETRYABLE.has(err.code)) throw err;
    await new Promise((r) => setTimeout(r, delayMs));
    return fn();
  }
}

/** apiRequest for endpoints that call the AI (see withAiRetry). */
const aiRequest = <T>(path: string, options: RequestInit = {}) => withAiRetry(() => apiRequest<T>(path, options));

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

export interface ImportedVacancy {
  title: string;
  company: string;
  url: string;
  text: string;
  site: 'djinni.co' | 'jobs.dou.ua' | 'work.ua';
}

/** Reads a vacancy from a Djinni / DOU / Work.ua link. Nothing is saved. */
export const importVacancy = (url: string) =>
  apiRequest<{ vacancy: ImportedVacancy }>('/vacancies/import', {
    method: 'POST',
    body: JSON.stringify({ url }),
  }).then((r) => r.vacancy);

// ------------------------------------------------------------------ Job-site profile text

export type ProfilePlatform = 'djinni' | 'linkedin';

export interface ProfileText {
  platform: ProfilePlatform;
  lang: 'uk' | 'en';
  headline: string;
  about: string;
  skills: string[];
  flagged: Flagged;
  createdAt: string;
  /** The CV's updatedAt when the text was written. */
  cvUpdatedAt: string;
}

export const getProfiles = (cvId: string) =>
  apiRequest<{ items: Partial<Record<ProfilePlatform, ProfileText>> }>(`/cvs/${cvId}/profile`).then((r) => r.items);
export const createProfile = (cvId: string, platform: ProfilePlatform, lang: 'uk' | 'en') =>
  aiRequest<{ profile: ProfileText }>(`/cvs/${cvId}/profile`, {
    method: 'POST',
    body: JSON.stringify({ platform, lang }),
  }).then((r) => r.profile);

// ------------------------------------------------------------------ Analyses

export interface AnalysisResult {
  matchScore: number;
  summary: string;
  matchedSkills: string[];
  missingSkills: { skill: string; advice: string }[];
  missingKeywords: string[];
  weakBullets: { original: string; rewritten: string; why: string }[];
  improvedCv: string;
}

export interface AnalysisSummary {
  id: string;
  cvId: string;
  cvName: string;
  vacancyId: string | null;
  vacancyTitle: string;
  company: string;
  lang: 'uk' | 'en';
  matchScore: number;
  flaggedCount: number;
  createdAt: string;
  shareId?: string;
  shareScores?: { before: number; after: number };
}

export interface Flagged {
  skills: string[];
  numbers: string[];
}

export interface CoverLetter {
  letter: string;
  lang: 'uk' | 'en';
  /** Terms in the letter that are not in the CV (same post-check as the improved CV). */
  flagged: Flagged;
  createdAt: string;
}

export interface Analysis extends AnalysisSummary {
  result: AnalysisResult;
  /** Terms in the rewrite that are not in the original CV (post-check), never silently trusted. */
  flagged: Flagged;
  /** The latest cover letter written for this analysis, if any. */
  coverLetter?: CoverLetter;
  /** The vacancy exactly as it was analysed. */
  vacancy?: { title: string; company?: string; text: string };
}

export type CreateAnalysisInput = { cvId: string; lang: 'uk' | 'en' } & (
  | { vacancyId: string }
  | { vacancy: { title: string; company: string; url?: string; text: string } }
);

export const createAnalysis = (data: CreateAnalysisInput) =>
  aiRequest<{ item: Analysis }>('/analyses', { method: 'POST', body: JSON.stringify(data) }).then(
    (r) => r.item,
  );
export const listAnalyses = () =>
  apiRequest<{ items: AnalysisSummary[] }>('/analyses').then((r) => r.items);
export const getAnalysis = (id: string) =>
  apiRequest<{ item: Analysis }>(`/analyses/${id}`).then((r) => r.item);
export const shareAnalysis = (id: string) =>
  aiRequest<{ shareId: string; scores: { before: number; after: number } }>(
    `/analyses/${id}/share`,
    { method: 'POST' },
  );

/** Writes (or rewrites) the cover letter for an analysis. */
export const createCoverLetter = (analysisId: string, lang: 'uk' | 'en') =>
  aiRequest<{ coverLetter: CoverLetter }>(`/analyses/${analysisId}/cover-letter`, {
    method: 'POST',
    body: JSON.stringify({ lang }),
  }).then((r) => r.coverLetter);

// ------------------------------------------------------------------ Insights

export interface SkillGap {
  skill: string;
  /** In how many analyses the skill was missing. */
  count: number;
  vacancies: { analysisId: string; title: string; company: string }[];
  /** Current CVs that now mention the skill. */
  inCvs: string[];
}

export interface SkillGapReport {
  analyses: number;
  skills: SkillGap[];
}

export const getSkillInsights = () => apiRequest<SkillGapReport>('/insights/skills');

export interface PublicShare {
  jobTitle: string;
  scoreBefore: number;
  scoreAfter: number;
  createdAt: string;
}

/** Public, no login needed. */
export async function getPublicShare(shareId: string): Promise<PublicShare> {
  const res = await fetch(`${API_URL}/public/shares/${encodeURIComponent(shareId)}`);
  if (!res.ok) throw new ApiError('not_found', res.status, res.status === 404 ? 'not_found' : undefined);
  return (await res.json()) as PublicShare;
}

// ------------------------------------------------------------------ Applications (tracker)

export const APP_STATUSES = ['APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED'] as const;
export type AppStatus = (typeof APP_STATUSES)[number];

export interface Application {
  id: string;
  vacancyId: string | null;
  cvId: string;
  /** Name of the CV version when it was linked (still shown after the CV is deleted). */
  cvName: string;
  company: string;
  title: string;
  /** YYYY-MM-DD */
  appliedAt: string;
  status: AppStatus;
  statusChangedAt: string;
  hadInterview: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationInput {
  vacancyId?: string | null;
  cvId: string;
  company: string;
  title: string;
  appliedAt: string;
  status: AppStatus;
  hadInterview: boolean;
  notes: string;
}

export const listApplications = () =>
  apiRequest<{ items: Application[] }>('/applications').then((r) => r.items);
export const createApplication = (data: ApplicationInput) =>
  apiRequest<{ item: Application }>('/applications', {
    method: 'POST',
    body: JSON.stringify(data),
  }).then((r) => r.item);
export const updateApplication = (id: string, data: Partial<ApplicationInput>) =>
  apiRequest<{ item: Application }>(`/applications/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }).then((r) => r.item);
export const deleteApplication = (id: string) =>
  apiRequest<void>(`/applications/${id}`, { method: 'DELETE' });

// ------------------------------------------------------------------ Mock interviews

export const QUESTION_TYPES = ['HR', 'TECHNICAL', 'BEHAVIOURAL'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export interface InterviewQuestion {
  type: QuestionType;
  /** Short area name, e.g. "SQL" or "teamwork". */
  topic: string;
  question: string;
}

export interface InterviewAnswer {
  answer: string;
  seconds?: number;
  /** 1–10 */
  score: number;
  feedback: string;
  /** Example answer; [square brackets] are placeholders for facts the CV does not give. */
  betterAnswer: string;
  /** Terms in the example that are in neither the CV nor the user's answer (post-check). */
  flagged: { skills: string[]; numbers: string[] };
  answeredAt: string;
}

export interface InterviewSummary {
  id: string;
  cvId: string;
  cvName: string;
  vacancyId: string;
  vacancyTitle: string;
  company: string;
  lang: 'uk' | 'en';
  status: 'IN_PROGRESS' | 'DONE';
  questionCount: number;
  answeredCount: number;
  createdAt: string;
  finishedAt?: string;
  /** 1–10, one decimal; set when DONE. */
  overallScore?: number;
}

export interface InterviewOutcome {
  overallScore: number;
  byType: Partial<Record<QuestionType, number>>;
  strongest: string[];
  weakest: string[];
}

export interface Interview extends InterviewSummary {
  questions: InterviewQuestion[];
  answers: InterviewAnswer[];
  outcome?: InterviewOutcome;
}

export const createInterview = (data: { cvId: string; vacancyId: string; lang: 'uk' | 'en' }) =>
  aiRequest<{ item: Interview }>('/interviews', { method: 'POST', body: JSON.stringify(data) }).then(
    (r) => r.item,
  );
export const listInterviews = () =>
  apiRequest<{ items: InterviewSummary[] }>('/interviews').then((r) => r.items);
export const getInterview = (id: string) =>
  apiRequest<{ item: Interview }>(`/interviews/${id}`).then((r) => r.item);
export const answerInterview = (id: string, data: { index: number; answer: string; seconds?: number }) =>
  aiRequest<{ item: Interview }>(`/interviews/${id}/answers`, {
    method: 'POST',
    body: JSON.stringify(data),
  }).then((r) => r.item);

// ------------------------------------------------------------------ Feedback & Donations (Step 8)

export interface FeedbackInput {
  rating: number;
  useful?: string;
  confusing?: string;
  callRequested?: boolean;
  contact?: string;
  context?: string;
}

export interface FeedbackItem extends FeedbackInput {
  id: string;
  sub: string;
  createdAt: string;
}

export const submitFeedback = (data: FeedbackInput) =>
  apiRequest<{ item: FeedbackItem }>('/feedback', {
    method: 'POST',
    body: JSON.stringify(data),
  }).then((r) => r.item);

export const recordDonationClick = (url?: string) =>
  apiRequest<{ ok: boolean }>('/donations/click', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });

export const reportDonation = (data: { amount?: number; currency?: string; jarUrl?: string }) =>
  apiRequest<{ ok: boolean; id: string }>('/donations/report', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const deleteAccount = () =>
  apiRequest<{ ok: boolean }>('/me', {
    method: 'DELETE',
  });

// ------------------------------------------------------------------ Admin Metrics (Step 8)

export interface AdminUserMetric {
  id: string;
  sub: string;
  email: string;
  isTeam: boolean;
  source: string;
  src?: string;
  createdAt: string;
  analysesCount: number;
  interviewsCount: number;
  applicationsCount: number;
  daysActive: number;
  hasRealUse: boolean;
  hasReturn: boolean;
}

export interface AdminMetrics {
  totals: {
    signups: number;
    realUse: number;
    realUsePercent: number;
    returnUsers: number;
    returnPercent: number;
    donationClicks: number;
    donationsReported: number;
    totalDonatedAmount: number;
    feedbackCount: number;
  };
  signupsByDay: Record<string, number>;
  signupsBySource: Record<string, number>;
  signupsBySrc: Record<string, number>;
  users: AdminUserMetric[];
  feedback: (FeedbackItem & { isTeam: boolean })[];
  donations: { id: string; sub: string; amount?: number; currency: string; createdAt: string; isTeam: boolean }[];
}

export const fetchAdminMetrics = () => apiRequest<AdminMetrics>('/admin/metrics');

