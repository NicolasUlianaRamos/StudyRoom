import type { Site } from '../src/shared';
export const HOME = 'https://www.qconcursos.com/';
const distracting = [
  'instagram.com',
  'tiktok.com',
  'facebook.com',
  'x.com',
  'reddit.com',
  'youtube.com',
];
export function parseSafeUrl(raw: string): URL | null {
  try {
    const u = new URL(raw);
    if (
      u.protocol !== 'https:' ||
      u.username ||
      u.password ||
      (u.port && u.port !== '443') ||
      u.hostname.endsWith('.') ||
      !u.hostname.includes('.')
    )
      return null;
    return u;
  } catch {
    return null;
  }
}
export function matches(host: string, domain: string, subdomains: boolean): boolean {
  return host === domain || (subdomains && host.endsWith('.' + domain));
}
export function allowed(raw: string, sites: Site[]): boolean {
  const u = parseSafeUrl(raw);
  if (!u) return false;
  return sites.some((s) => {
    const site = parseSafeUrl(s.url);
    return (
      (s.enabled && site !== null && u.origin === site.origin) ||
      !!(
        s.enabled &&
        site &&
        s.subdomains &&
        u.port === site.port &&
        matches(u.hostname, site.hostname, true)
      )
    );
  });
}
export function domainOnly(raw: string): string {
  try {
    return new URL(raw).hostname.slice(0, 253) || 'endereço inválido';
  } catch {
    return 'endereço inválido';
  }
}
export function trustedAuth(raw: string, until: number, now = Date.now()): boolean {
  const u = parseSafeUrl(raw);
  return !!(
    u &&
    now < until &&
    ['accounts.google.com', 'accounts.google.com.br'].includes(u.hostname) &&
    /^\/(?:o\/oauth2(?:\/|$)|v3\/signin(?:\/|$)|signin(?:\/|$)|ServiceLogin(?:\/|$)|CheckCookie(?:\/|$)|RotateCookies(?:\/|$)|accounts\/(?:SetSID|CheckCookie|RotateCookies)(?:\/|$))/.test(
      u.pathname,
    )
  );
}
export function frameAllowed(raw: string, sites: Site[], authUntil = 0): boolean {
  if (allowed(raw, sites) || trustedAuth(raw, authUntil)) return true;
  const u = parseSafeUrl(raw);
  if (!u) return false;
  if (distracting.some((d) => matches(u.hostname, d, true))) return false;
  if (u.hostname === 'www.google.com' || u.hostname === 'www.recaptcha.net')
    return u.pathname.startsWith('/recaptcha/');
  return [
    'challenges.cloudflare.com',
    'recaptcha.google.com',
    'js.stripe.com',
    'hooks.stripe.com',
  ].includes(u.hostname);
}
