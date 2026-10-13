import type { Store } from './database';
import type { StudySession } from '../src/shared';
export function effective(s: StudySession, now: number): number {
  return Math.min(
    s.plannedMs,
    s.effectiveMs + (s.runningSince === null ? 0 : Math.max(0, now - s.runningSince)),
  );
}
// Each interval belongs to an uninterrupted run. Cap its end at the planned target.
export function captureInterval(s: StudySession, now: number) {
  if (!s.intervals || s.runningSince === null) return;
  const elapsed = Math.min(
    Math.max(0, s.plannedMs - s.effectiveMs),
    Math.max(0, now - s.runningSince),
  );
  if (!elapsed) return;
  const end = s.runningSince + elapsed;
  const last = s.intervals.at(-1);
  if (last?.start === s.runningSince) last.end = Math.max(last.end, end);
  else s.intervals.push({ start: s.runningSince, end });
}
export class Sessions {
  active: StudySession | null = null;
  recovered = false;
  exitReadyAt: number | null = null;
  constructor(
    private store: Store,
    private clock = () => Date.now(),
  ) {
    const s = store.sessions().find((s) => s.status === 'running' || s.status === 'paused');
    if (s) {
      this.active = {
        ...s,
        effectiveMs: effective(s, s.checkpoint),
        runningSince: null,
        status: 'paused',
      };
      this.recovered = true;
      this.persist();
    }
  }
  private persist() {
    if (this.active) this.store.saveSession(this.active);
  }
  start(
    minutes: number,
    site: string,
    context: Pick<
      StudySession,
      'topicId' | 'topicName' | 'subjectId' | 'subjectName' | 'pdfId' | 'pdfName'
    > = {},
  ) {
    if (this.active) throw new Error('Encerre a sessão atual antes de iniciar outra.');
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 480)
      throw new Error('Escolha entre 1 e 480 minutos.');
    const now = this.clock();
    this.active = {
      ...context,
      intervals: [],
      profileId: this.store.settings().activeProfileId,
      profileName: this.store.profiles().find((p) => p.id === this.store.settings().activeProfileId)
        ?.name,
      id: now,
      start: now,
      end: null,
      plannedMs: Math.round(minutes * 60000),
      effectiveMs: 0,
      runningSince: now,
      checkpoint: now,
      status: 'running',
      site,
      pauses: 0,
      reason: '',
    };
    this.exitReadyAt = null;
    this.recovered = false;
    this.persist();
  }
  tick() {
    const s = this.active;
    if (!s) return;
    const now = this.clock();
    s.checkpoint = now;
    captureInterval(s, now);
    if (effective(s, now) >= s.plannedMs) {
      s.effectiveMs = s.plannedMs;
      s.runningSince = null;
      s.status = 'completed';
      s.end = now;
    }
    this.persist();
  }
  pause() {
    const s = this.active;
    if (!s || s.status !== 'running') return;
    const now = this.clock();
    captureInterval(s, now);
    s.effectiveMs = effective(s, now);
    s.runningSince = null;
    s.status = 'paused';
    s.pauses++;
    s.checkpoint = now;
    this.persist();
  }
  resume() {
    const s = this.active;
    if (!s || s.status !== 'paused') return;
    s.runningSince = this.clock();
    s.checkpoint = s.runningSince;
    s.status = 'running';
    this.recovered = false;
    this.persist();
  }
  extend(minutes: number) {
    const s = this.active;
    if (!s || s.status !== 'completed') throw new Error('A sessão ainda não terminou.');
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 480)
      throw new Error('Duração inválida.');
    s.plannedMs += minutes * 60000;
    s.end = null;
    s.status = 'running';
    s.runningSince = this.clock();
    s.checkpoint = s.runningSince;
    this.persist();
  }
  locked() {
    return !!this.active && this.active.status !== 'completed';
  }
  assertEditable() {
    if (this.locked())
      throw new Error('Os sites e as opções de foco ficam protegidos até encerrar a sessão.');
  }
  requestExit() {
    if (this.exitReadyAt === null)
      this.exitReadyAt =
        this.clock() +
        (this.store.settings().mode === 'strong' && this.locked()
          ? this.store.settings().reflectionSeconds * 1000
          : 0);
    return this.exitReadyAt;
  }
  cancelExit() {
    this.exitReadyAt = null;
  }
  finish(reason: string) {
    const s = this.active;
    if (!s) return;
    if (
      this.store.settings().mode === 'strong' &&
      this.locked() &&
      (this.exitReadyAt === null || this.clock() < this.exitReadyAt || !reason.trim())
    )
      throw new Error('Aguarde o intervalo de reflexão e informe o motivo.');
    const now = this.clock();
    captureInterval(s, now);
    s.effectiveMs = effective(s, now);
    s.end = now;
    s.checkpoint = s.end;
    s.runningSince = null;
    if (s.status !== 'completed') s.status = 'interrupted';
    s.reason = reason.slice(0, 300);
    this.persist();
    this.active = null;
    this.exitReadyAt = null;
  }
}
