/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_USER_POOL_ID?: string;
  readonly VITE_USER_POOL_CLIENT_ID?: string;
  readonly VITE_REGION?: string;
  /** Monobank jar link for the donation prompt (defaults to the CareerOS jar). */
  readonly VITE_DONATION_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
