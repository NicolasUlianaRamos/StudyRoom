import { describe, it, expect } from 'vitest';
import { allowed, frameAllowed, parseSafeUrl, trustedAuth, domainOnly } from '../electron/policy';
import type { Site } from '../src/shared';
const sites: Site[] = [
  { id: 1, name: 'QConcursos', url: 'https://qconcursos.com/', enabled: true, subdomains: true },
];
describe('política de navegação', () => {
  it.each([
    'https://qconcursos.com/',
    'https://www.qconcursos.com/questoes?foo=1',
    'https://app.qconcursos.com/',
  ])('permite %s', (url) => expect(allowed(url, sites)).toBe(true));
  it.each([
    'https://instagram.com',
    'https://www.instagram.com',
    'https://unknown.com',
    'https://qconcursos.com.evil.com',
    'https://evilqconcursos.com',
    'https://qconcursos.com@evil.com',
    'https://qconcursos.com:444',
    'http://qconcursos.com',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'data:text/html,test',
    'https://qconcursos.com.',
    'https://qconcursоs.com',
    'https://user:pass@qconcursos.com',
    'blob:https://qconcursos.com/foo',
  ])('bloqueia %s', (url) => expect(allowed(url, sites)).toBe(false));
  it('valida cada destino de redirecionamento independentemente', () => {
    expect(allowed('https://qconcursos.com/redirect?to=instagram.com', sites)).toBe(true);
    expect(allowed('https://instagram.com', sites)).toBe(false);
  });
  it('não promove recursos e frames a páginas principais', () => {
    expect(frameAllowed('https://challenges.cloudflare.com/turnstile', sites)).toBe(true);
    expect(allowed('https://challenges.cloudflare.com', sites)).toBe(false);
    expect(frameAllowed('https://youtube.com/embed/a', sites)).toBe(false);
  });
  it('limita autenticação a origem, caminho e janela temporal', () => {
    expect(trustedAuth('https://accounts.google.com/o/oauth2/v2/auth', 200, 100)).toBe(true);
    expect(trustedAuth('https://accounts.google.com/o/oauth2/v2/auth', 100, 200)).toBe(false);
    expect(trustedAuth('https://accounts.google.com.evil.com/o/oauth2/v2/auth', 200, 100)).toBe(
      false,
    );
    expect(trustedAuth('https://accounts.google.com/unrelated', 200, 100)).toBe(false);
  });
  it.each(['accounts.google.com', 'accounts.google.com.br'])(
    'permite a passagem regional de login em %s somente durante a autorização',
    (host) => {
      for (const path of [
        '/accounts/SetSID',
        '/CheckCookie',
        '/accounts/CheckCookie',
        '/RotateCookies',
        '/v3/signin/challenge/pwd',
      ]) {
        const url = `https://${host}${path}?continue=https%3A%2F%2Fwww.qconcursos.com`;
        expect(trustedAuth(url, 200, 100)).toBe(true);
        expect(trustedAuth(url, 0, 100)).toBe(false);
        expect(trustedAuth(url, 100, 100)).toBe(false);
        expect(allowed(url, sites)).toBe(false);
      }
      expect(frameAllowed(`https://${host}/accounts/SetSID`, sites, Date.now() + 60000)).toBe(true);
      expect(frameAllowed(`https://${host}/accounts/SetSID`, sites)).toBe(false);
    },
  );
  it.each([
    'https://accounts.google.com.br.evil.com/accounts/SetSID',
    'https://evilaccounts.google.com.br/accounts/SetSID',
    'https://accounts.google.com.br@evil.com/accounts/SetSID',
    'https://accounts.google.com.br:444/accounts/SetSID',
    'http://accounts.google.com.br/accounts/SetSID',
    'https://accounts.google.com.br/accounts/SetSIDanything',
    'https://accounts.google.com.br/search',
    'https://www.google.com.br/search',
    'https://mail.google.com/',
    'https://youtube.com/',
  ])('mantém bloqueado %s mesmo com login autorizado', (url) => {
    expect(trustedAuth(url, 200, 100)).toBe(false);
  });
  it('respeita desativação e subdomínios explícitos', () => {
    expect(
      allowed(
        'https://www.qconcursos.com',
        sites.map((s) => ({ ...s, enabled: false })),
      ),
    ).toBe(false);
    expect(
      allowed(
        'https://www.qconcursos.com',
        sites.map((s) => ({ ...s, subdomains: false })),
      ),
    ).toBe(false);
  });
  it('rejeita URL inválida e não registra tokens no domínio', () => {
    expect(parseSafeUrl('not a url')).toBe(null);
    expect(domainOnly('https://qconcursos.com/?token=secret')).toBe('qconcursos.com');
  });
});
