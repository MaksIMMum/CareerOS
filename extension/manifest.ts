import base from './manifest.base.json' with { type: 'json' };

/**
 * The extension manifest, generated at build time. The side panel calls the CareerOS API from its
 * chrome-extension:// origin; API Gateway CORS only accepts http(s) origins, so instead the API host
 * is listed in host_permissions — Chrome lets extension pages call such hosts without CORS.
 */
export function buildManifest(apiUrl: string | undefined): typeof base {
  const hosts = [...base.host_permissions];
  if (apiUrl) {
    const u = new URL(apiUrl);
    if (u.protocol !== 'https:') throw new Error(`VITE_API_URL must be https: ${apiUrl}`);
    hosts.push(`${u.origin}/*`);
  }
  return { ...base, host_permissions: hosts };
}
