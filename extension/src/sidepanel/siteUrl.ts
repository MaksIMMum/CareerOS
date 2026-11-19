/** The CareerOS website, for links back (sign-up, full results, managing CVs). */
export const SITE_URL = (import.meta.env.VITE_SITE_URL || 'https://d34opbkbhqypsa.cloudfront.net').replace(/\/+$/, '');
export const siteLink = (path: string) => `${SITE_URL}${path}`;
