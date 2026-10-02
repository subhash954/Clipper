import dns from 'dns/promises';
import { URL } from 'url';

export interface SafeUrlValidationResult {
  isValid: boolean;
  resolvedIp?: string;
  error?: string;
}

/**
 * Checks if an IPv4 address is in a private, loopback, or metadata subnet
 */
export function isPrivateOrReservedIpv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return true;

  const [b0, b1] = parts;

  // 0.0.0.0/8
  if (b0 === 0) return true;
  // 127.0.0.0/8 (Loopback)
  if (b0 === 127) return true;
  // 10.0.0.0/8 (Private RFC 1918)
  if (b0 === 10) return true;
  // 172.16.0.0/12 (Private RFC 1918)
  if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;
  // 192.168.0.0/16 (Private RFC 1918)
  if (b0 === 192 && b1 === 168) return true;
  // 169.254.0.0/16 (Link Local / Cloud Metadata)
  if (b0 === 169 && b1 === 254) return true;
  // 100.64.0.0/10 (Shared address space)
  if (b0 === 100 && b1 >= 64 && b1 <= 127) return true;
  // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved)
  if (b0 >= 224) return true;

  return false;
}

/**
 * Checks if an IPv6 address is loopback, unique local, or link local
 */
export function isPrivateOrReservedIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase().trim();
  if (normalized === '::1' || normalized === '::') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // fc00::/7
  if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return true; // fe80::/10
  return false;
}

/**
 * Comprehensive SSRF validation: checks scheme, resolves DNS, and validates IP against private networks
 */
export async function validateSafeRemoteUrl(urlStr: string): Promise<SafeUrlValidationResult> {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    return { isValid: false, error: 'Malformed URL.' };
  }

  // Scheme restriction: only http: and https: allowed
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { isValid: false, error: `Disallowed protocol: ${parsed.protocol}. Only HTTP and HTTPS are permitted.` };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block explicit localhost names and common aliases
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname === 'local' ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.local')
  ) {
    return { isValid: false, error: 'Localhost and internal hostnames are forbidden.' };
  }

  // Resolve DNS to underlying IP addresses to prevent DNS rebinding attacks
  try {
    const lookupResult = await dns.lookup(hostname, { all: true });
    if (!lookupResult || lookupResult.length === 0) {
      return { isValid: false, error: 'DNS resolution returned no addresses.' };
    }

    for (const record of lookupResult) {
      if (record.family === 4) {
        if (isPrivateOrReservedIpv4(record.address)) {
          return {
            isValid: false,
            resolvedIp: record.address,
            error: `Resolved IP ${record.address} belongs to a private, loopback, or cloud metadata subnet.`,
          };
        }
      } else if (record.family === 6) {
        if (isPrivateOrReservedIpv6(record.address)) {
          return {
            isValid: false,
            resolvedIp: record.address,
            error: `Resolved IPv6 ${record.address} belongs to a reserved or local subnet.`,
          };
        }
      }
    }

    return { isValid: true, resolvedIp: lookupResult[0].address };
  } catch (err: any) {
    return { isValid: false, error: `DNS resolution failed: ${err.message}` };
  }
}

/**
 * Safely fetches remote media with redirect validation, timeout, and max size limits.
 * Protects against open-redirect SSRF bypasses and memory exhaustion.
 */
export async function safeFetchRemoteMedia(
  urlStr: string,
  options: {
    maxBytes?: number;
    timeoutMs?: number;
    maxRedirects?: number;
  } = {}
): Promise<{ buffer: Buffer; contentType: string }> {
  const maxBytes = options.maxBytes ?? 200 * 1024 * 1024; // 200MB limit
  const timeoutMs = options.timeoutMs ?? 15000;
  const maxRedirects = options.maxRedirects ?? 3;

  let currentUrl = urlStr;
  let redirectsFollowed = 0;

  while (redirectsFollowed <= maxRedirects) {
    const ssrfCheck = await validateSafeRemoteUrl(currentUrl);
    if (!ssrfCheck.isValid) {
      throw new Error(`SSRF violation fetching remote media: ${ssrfCheck.error}`);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: 'manual',
      });

      // Handle redirects explicitly
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) {
          throw new Error('Redirect missing location header');
        }
        currentUrl = new URL(location, currentUrl).toString();
        redirectsFollowed++;
        continue;
      }

      if (!response.ok) {
        throw new Error(`Remote media fetch failed with HTTP ${response.status}`);
      }

      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > maxBytes) {
        throw new Error(`Remote media exceeds maximum allowed size of ${maxBytes} bytes`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (buffer.length > maxBytes) {
        throw new Error(`Remote media body exceeded maximum allowed size (${buffer.length} bytes)`);
      }

      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      return { buffer, contentType };
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(`Exceeded maximum redirect limit (${maxRedirects}) fetching remote media`);
}
