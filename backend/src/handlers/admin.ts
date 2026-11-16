import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { ScanCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamo.js';
import { json, withErrorHandling, HttpError } from '../lib/http.js';
import type { UserProfile } from './me.js';
import type { FeedbackRecord } from './feedback.js';
import type { EventRecord } from '../lib/events.js';

/**
 * Team accounts for the "exclude team accounts" filter. Comma-separated e-mails in the
 * TEAM_EMAILS env var, set at deploy time (never committed: the repository is public).
 */
export function getTeamEmails(raw: string | undefined = process.env.TEAM_EMAILS): string[] {
  return [...new Set((raw ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean))];
}

/**
 * Group names from the `cognito:groups` claim. The HTTP API JWT authorizer passes list claims as
 * one string like "[admins]" or "[admins testers]"; tests and other callers may pass a real array.
 */
export function parseGroups(claim: unknown): string[] {
  if (Array.isArray(claim)) return claim.map(String);
  if (typeof claim !== 'string') return [];
  return claim
    .replace(/^\[|\]$/g, '')
    .split(/[\s,]+/)
    .map((g) => g.trim())
    .filter(Boolean);
}

export function assertAdmin(event: APIGatewayProxyEventV2): void {
  const claims = (
    event.requestContext as { authorizer?: { jwt?: { claims?: Record<string, unknown> } } }
  ).authorizer?.jwt?.claims;
  if (!parseGroups(claims?.['cognito:groups']).includes('admins')) {
    throw new HttpError(403, 'forbidden', 'Admin access required');
  }
}

export interface UserSummaryMetrics {
  id: string; // anonymized identifier e.g. usr_1
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

export interface AdminMetricsResponse {
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
  users: UserSummaryMetrics[];
  feedback: (FeedbackRecord & { isTeam: boolean })[];
  donations: { id: string; sub: string; amount?: number; currency: string; createdAt: string; isTeam: boolean }[];
}

export function createAdminHandler(
  client: Pick<DynamoDBDocumentClient, 'send'> = docClient,
  tableName = TABLE_NAME,
) {
  return withErrorHandling(async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    assertAdmin(event);

    const teamEmails = getTeamEmails();

    // Scan table to gather all profiles, events, feedback and donations
    const profiles: UserProfile[] = [];
    const events: EventRecord[] = [];
    const feedbacks: FeedbackRecord[] = [];
    const donations: { id: string; sub: string; amount?: number; currency: string; createdAt: string }[] = [];

    let lastEvaluatedKey: Record<string, unknown> | undefined;
    do {
      const res = await client.send(
        new ScanCommand({
          TableName: tableName,
          ExclusiveStartKey: lastEvaluatedKey,
        }),
      );

      if (res.Items) {
        for (const item of res.Items) {
          const pk = (item.PK as string) || '';
          const sk = (item.SK as string) || '';

          if (sk === 'PROFILE' && pk.startsWith('USER#')) {
            profiles.push(item as UserProfile);
          } else if (pk.startsWith('EVENT#')) {
            events.push(item as EventRecord);
          } else if (sk.startsWith('FEEDBACK#')) {
            feedbacks.push(item as FeedbackRecord);
          } else if (sk.startsWith('DONATION#')) {
            donations.push(item as any);
          }
        }
      }
      lastEvaluatedKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (lastEvaluatedKey);

    // Map events per user
    const userEvents = new Map<string, EventRecord[]>();
    for (const evt of events) {
      const sub = evt.sub || (evt.GSI1PK ? evt.GSI1PK.replace('USER#', '') : '');
      if (sub) {
        const list = userEvents.get(sub) || [];
        list.push(evt);
        userEvents.set(sub, list);
      }
    }

    // Build user summaries
    const users: UserSummaryMetrics[] = profiles.map((p, idx) => {
      const isTeam = teamEmails.includes(p.email.toLowerCase());
      const evts = userEvents.get(p.sub) || [];

      let analysesCount = 0;
      let interviewsCount = 0;
      let applicationsCount = 0;
      const activeDays = new Set<string>();

      const signupDate = p.createdAt ? p.createdAt.slice(0, 10) : '';
      if (signupDate) activeDays.add(signupDate);

      let addedAppWithin7Days = false;
      const signupTime = p.createdAt ? new Date(p.createdAt).getTime() : 0;
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

      for (const e of evts) {
        const evtDate = e.createdAt ? e.createdAt.slice(0, 10) : '';
        if (evtDate) activeDays.add(evtDate);

        if (e.type === 'ANALYSIS') analysesCount++;
        if (e.type === 'INTERVIEW_DONE') interviewsCount++;
        if (e.type === 'APPLICATION_ADDED') {
          applicationsCount++;
          if (signupTime && e.createdAt) {
            const appTime = new Date(e.createdAt).getTime();
            if (appTime >= signupTime && appTime - signupTime <= sevenDaysMs) {
              addedAppWithin7Days = true;
            }
          }
        }
      }

      const returnedAnotherDay = activeDays.size > 1;
      const hasRealUse = analysesCount >= 2 || interviewsCount >= 1;
      const hasReturn = returnedAnotherDay && addedAppWithin7Days;

      return {
        id: `usr_${idx + 1}`,
        sub: p.sub,
        email: p.email,
        isTeam,
        source: p.source || 'unknown',
        src: p.src,
        createdAt: p.createdAt,
        analysesCount,
        interviewsCount,
        applicationsCount,
        daysActive: activeDays.size,
        hasRealUse,
        hasReturn,
      };
    });

    // Compute aggregate metrics
    const signupsByDay: Record<string, number> = {};
    const signupsBySource: Record<string, number> = {};
    const signupsBySrc: Record<string, number> = {};

    for (const u of users) {
      const day = u.createdAt ? u.createdAt.slice(0, 10) : 'unknown';
      signupsByDay[day] = (signupsByDay[day] || 0) + 1;

      const srcAnswer = u.source || 'unknown';
      signupsBySource[srcAnswer] = (signupsBySource[srcAnswer] || 0) + 1;

      if (u.src) {
        signupsBySrc[u.src] = (signupsBySrc[u.src] || 0) + 1;
      }
    }

    let donationClicks = 0;
    let donationsReported = 0;
    let totalDonatedAmount = 0;

    for (const evt of events) {
      if (evt.type === 'DONATE_CLICK') donationClicks++;
      if (evt.type === 'DONATE_REPORTED') {
        donationsReported++;
        const amt = Number(evt.payload?.amount);
        if (!isNaN(amt) && amt > 0) totalDonatedAmount += amt;
      }
    }

    const realUseCount = users.filter((u) => u.hasRealUse).length;
    const returnCount = users.filter((u) => u.hasReturn).length;
    const totalSignups = users.length;

    const emailToTeamMap = new Map(profiles.map((p) => [p.sub, teamEmails.includes(p.email.toLowerCase())]));

    const response: AdminMetricsResponse = {
      totals: {
        signups: totalSignups,
        realUse: realUseCount,
        realUsePercent: totalSignups > 0 ? Math.round((realUseCount / totalSignups) * 100) : 0,
        returnUsers: returnCount,
        returnPercent: totalSignups > 0 ? Math.round((returnCount / totalSignups) * 100) : 0,
        donationClicks,
        donationsReported,
        totalDonatedAmount,
        feedbackCount: feedbacks.length,
      },
      signupsByDay,
      signupsBySource,
      signupsBySrc,
      users,
      feedback: feedbacks.map((f) => ({
        ...f,
        isTeam: emailToTeamMap.get(f.sub) ?? false,
      })),
      donations: donations.map((d) => ({
        ...d,
        isTeam: emailToTeamMap.get(d.sub) ?? false,
      })),
    };

    return json(200, response);
  });
}

export const handler = createAdminHandler();
